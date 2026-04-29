import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { afterEach, describe, expect, test } from "vitest";
import { loadSessionStore } from "../config/sessions/store.js";
import { resolveGatewaySessionStoreTarget } from "./session-utils.js";
import {
  captureCompactionCheckpointSnapshot,
  cleanupCompactionCheckpointSnapshot,
  persistSessionCompactionCheckpoint,
} from "./session-compaction-checkpoints.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("session-compaction-checkpoints", () => {
  test("persists structured continuation onto compaction checkpoints", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-checkpoint-"));
    tempDirs.push(dir);

    const storePath = path.join(dir, "sessions.json");
    const session = SessionManager.create(dir, dir);
    session.appendMessage({
      role: "user",
      content: "before checkpoint",
      timestamp: Date.now(),
    } satisfies UserMessage);
    const sessionFile = session.getSessionFile();
    const leafId = session.getLeafId();
    expect(sessionFile).toBeTruthy();
    expect(leafId).toBeTruthy();

    await fs.writeFile(
      storePath,
      JSON.stringify(
        {
          main: {
            sessionId: session.getSessionId(),
            sessionFile,
            updatedAt: Date.now(),
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const snapshot = captureCompactionCheckpointSnapshot({
      sessionManager: session,
      sessionFile: sessionFile!,
    });
    expect(snapshot).not.toBeNull();

    const checkpoint = await persistSessionCompactionCheckpoint({
      cfg: { session: { store: storePath, mainKey: "main" } },
      sessionKey: "main",
      sessionId: session.getSessionId(),
      reason: "manual",
      snapshot: snapshot!,
      summary: "checkpoint summary",
      firstKeptEntryId: leafId!,
      continuation: {
        taskId: "task-1",
        runId: "run-1",
        statusText: "blocked on verification",
        recentOutcome: "runtime summary normalized",
        nextStep: "resume from checkpoint continuation",
      },
      continuationAudit: {
        consumer: "compaction",
        projectedTaskStatusOverride:
          "blocked on verification\nRecent outcome: runtime summary normalized\nNext step: resume from checkpoint continuation",
        explanation: {
          meaningful: true,
          restoreBoundary: true,
          statusKind: "blocked",
          source: "active-task",
          sourceLabel: "active runtime task",
          projectionMode: "blocked-like",
          auditCodes: ["continuation.meaningful", "projection.blocked_like"],
          reasons: ["blocked-like continuation keeps blocker and next-step context"],
        },
      },
      postSessionFile: sessionFile!,
      postLeafId: leafId!,
      postEntryId: leafId!,
    });

    expect(checkpoint?.continuation).toMatchObject({
      taskId: "task-1",
      runId: "run-1",
      statusText: "blocked on verification",
      recentOutcome: "runtime summary normalized",
      nextStep: "resume from checkpoint continuation",
    });
    expect(checkpoint?.continuationAudit).toMatchObject({
      consumer: "compaction",
      projectedTaskStatusOverride:
        "blocked on verification\nRecent outcome: runtime summary normalized\nNext step: resume from checkpoint continuation",
      explanation: {
        projectionMode: "blocked-like",
        source: "active-task",
      },
    });

    const store = loadSessionStore(storePath, { skipCache: true });
    const persistedTarget = resolveGatewaySessionStoreTarget({
      cfg: { session: { store: storePath, mainKey: "main" } },
      key: "main",
      store,
    });
    const persisted = store[persistedTarget.canonicalKey]?.compactionCheckpoints?.[0];
    expect(persisted?.continuation).toMatchObject({
      taskId: "task-1",
      runId: "run-1",
      statusText: "blocked on verification",
      recentOutcome: "runtime summary normalized",
      nextStep: "resume from checkpoint continuation",
    });
    expect(persisted?.continuationAudit).toMatchObject({
      consumer: "compaction",
      projectedTaskStatusOverride:
        "blocked on verification\nRecent outcome: runtime summary normalized\nNext step: resume from checkpoint continuation",
      explanation: {
        projectionMode: "blocked-like",
        source: "active-task",
      },
    });
  });

  test("capture stores the copied pre-compaction transcript path and cleanup removes only the copy", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-checkpoint-"));
    tempDirs.push(dir);

    const session = SessionManager.create(dir, dir);
    const userMessage: UserMessage = {
      role: "user",
      content: "before compaction",
      timestamp: Date.now(),
    };
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "working on it" }],
      api: "responses",
      provider: "openai",
      model: "gpt-test",
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };
    session.appendMessage(userMessage);
    session.appendMessage(assistantMessage);

    const sessionFile = session.getSessionFile();
    const leafId = session.getLeafId();
    expect(sessionFile).toBeTruthy();
    expect(leafId).toBeTruthy();

    const originalBefore = await fs.readFile(sessionFile!, "utf-8");
    const snapshot = captureCompactionCheckpointSnapshot({
      sessionManager: session,
      sessionFile: sessionFile!,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.leafId).toBe(leafId);
    expect(snapshot?.sessionFile).not.toBe(sessionFile);
    expect(snapshot?.sessionFile).toContain(".checkpoint.");
    expect(fsSync.existsSync(snapshot!.sessionFile)).toBe(true);
    expect(await fs.readFile(snapshot!.sessionFile, "utf-8")).toBe(originalBefore);

    session.appendCompaction("checkpoint summary", leafId!, 123, { ok: true });

    expect(await fs.readFile(snapshot!.sessionFile, "utf-8")).toBe(originalBefore);
    expect(await fs.readFile(sessionFile!, "utf-8")).not.toBe(originalBefore);

    await cleanupCompactionCheckpointSnapshot(snapshot);

    expect(fsSync.existsSync(snapshot!.sessionFile)).toBe(false);
    expect(fsSync.existsSync(sessionFile!)).toBe(true);
  });
});
