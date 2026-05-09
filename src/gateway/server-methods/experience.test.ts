import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { experienceHandlers } from "./experience.js";

async function invoke(method: keyof typeof experienceHandlers, params: Record<string, unknown>) {
  const respond = vi.fn();
  await experienceHandlers[method]({
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    req: { type: "req", id: "req-1", method },
    isWebchatConnect: () => false,
  });
  return respond.mock.calls[0] as [boolean, unknown?, { code: number; message: string }?];
}

describe("experience gateway handlers", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-experience-gateway-"));
    process.env.ASSISTANT_STATE_DIR = stateDir;
  });

  afterEach(() => {
    delete process.env.ASSISTANT_STATE_DIR;
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("captures, searches, and summarizes experience events", async () => {
    const captured = await invoke("experience.capture", {
      kind: "fix",
      summary: "Gateway stdio transport should keep TUI and backend aligned.",
      source: "tui",
      tags: ["gateway", "tui"],
    });
    expect(captured[0]).toBe(true);
    expect(captured[1]).toEqual({
      event: expect.objectContaining({
        id: expect.stringMatching(/^exp_/),
        kind: "fix",
      }),
    });

    const searched = await invoke("experience.search", { query: "stdio transport" });
    expect(searched[0]).toBe(true);
    expect(searched[1]).toEqual({
      query: "stdio transport",
      results: [
        expect.objectContaining({
          type: "event",
          summary: expect.stringContaining("stdio transport"),
        }),
      ],
    });

    const summary = await invoke("experience.summary", {});
    expect(summary[0]).toBe(true);
    expect(summary[1]).toEqual(expect.objectContaining({
      counts: expect.objectContaining({ events: 1, skillCandidates: 0 }),
      recentEvents: [expect.objectContaining({ kind: "fix" })],
    }));
  });

  it("creates and lists skill candidates", async () => {
    const created = await invoke("skill.candidates.create", {
      title: "Gateway transport diagnosis",
      trigger: "When TUI reports backend connection failures",
      steps: ["Check stdio gateway process", "Call health RPC", "Surface actionable error"],
      tags: ["gateway"],
    });
    expect(created[0]).toBe(true);
    expect(created[1]).toEqual({
      candidate: expect.objectContaining({
        id: expect.stringMatching(/^skill_candidate_/),
        status: "proposed",
      }),
    });

    const listed = await invoke("skill.candidates.list", { status: "proposed" });
    expect(listed[0]).toBe(true);
    expect(listed[1]).toEqual({
      candidates: [
        expect.objectContaining({
          title: "Gateway transport diagnosis",
        }),
      ],
    });
  });

  it("gets and updates the persistent self model", async () => {
    const updated = await invoke("self.model.update", {
      preferences: ["Prefer terminal-first operation"],
      nextGrowthAreas: ["Turn repeated fixes into reusable skill candidates"],
    });
    expect(updated[0]).toBe(true);
    expect(updated[1]).toEqual({
      selfModel: expect.objectContaining({
        preferences: ["Prefer terminal-first operation"],
      }),
    });

    const current = await invoke("self.model.get", {});
    expect(current[0]).toBe(true);
    expect(current[1]).toEqual(updated[1]);
  });

  it("exposes session recall, strategic pushes, skill usage, skill export, and user model dialectic", async () => {
    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, "gateway-session.jsonl"),
      JSON.stringify({
        message: {
          role: "user",
          content: "Remember that rollout checks should verify migrations before deploy.",
        },
      }),
      "utf8",
    );

    const recall = await invoke("experience.sessionRecall", {
      query: "rollout migrations",
      limit: 2,
    });
    expect(recall[0]).toBe(true);
    expect(recall[1]).toEqual(expect.objectContaining({
      backend: "sqlite-fts5",
      hits: [expect.objectContaining({ snippet: expect.stringContaining("migrations") })],
    }));

    const captured = await invoke("experience.capture", {
      kind: "complex_task",
      summary: "Fix repeated deploy rollback procedure",
      tags: ["complex-task"],
      evidence: ["Reproduced rollback failure", "Patched deploy order", "Verified rollback"],
      outcome: "Deploy rollback succeeded",
    });
    expect(captured[0]).toBe(true);
    const listed = await invoke("skill.candidates.list", { limit: 1 });
    const candidate = (listed[1] as { candidates: Array<{ id: string }> }).candidates[0];

    const usage = await invoke("skill.usage.record", {
      candidateId: candidate.id,
      outcome: "Added rollback smoke check",
      observations: ["Run rollback smoke check after deploy"],
    });
    expect(usage[0]).toBe(true);
    expect(usage[1]).toEqual(expect.objectContaining({
      candidate: expect.objectContaining({
        tags: expect.arrayContaining(["self-improved"]),
      }),
    }));

    const exported = await invoke("skill.candidates.exportAgentSkill", {
      candidateId: candidate.id,
    });
    expect(exported[0]).toBe(true);
    expect(exported[1]).toEqual(expect.objectContaining({
      name: expect.any(String),
      skillPath: expect.stringContaining("SKILL.md"),
    }));

    const strategy = await invoke("strategy.memory.capture", {
      title: "Periodic skill harvest",
      objective: "Review complex tasks and create reusable skills",
      nextPushAt: 1,
    });
    expect(strategy[0]).toBe(true);

    const due = await invoke("strategy.memory.due", { now: 2 });
    expect(due[0]).toBe(true);
    expect(due[1]).toEqual({
      pushes: [expect.objectContaining({ prompt: expect.stringContaining("reusable skills") })],
    });

    const strategyId = ((strategy[1] as { memory: { id: string } }).memory.id);
    const advanced = await invoke("strategy.memory.advance", {
      id: strategyId,
      pushedAt: 2,
    });
    expect(advanced[0]).toBe(true);
    expect(advanced[1]).toEqual({
      memory: expect.objectContaining({
        id: strategyId,
        lastPushedAt: 2,
      }),
    });

    const updatedUser = await invoke("user.model.update", {
      preferences: ["Prefers concise terminal-first execution"],
      contradictions: ["Sometimes asks for detailed architecture analysis"],
    });
    expect(updatedUser[0]).toBe(true);

    const dialectic = await invoke("user.model.dialectic", {
      query: "communication style",
    });
    expect(dialectic[0]).toBe(true);
    expect(dialectic[1]).toEqual(expect.objectContaining({
      answer: expect.stringContaining("terminal-first"),
      hypotheses: [expect.objectContaining({
        contradictingEvidence: expect.arrayContaining([
          expect.stringContaining("detailed architecture"),
        ]),
      })],
    }));
  });

  it("rejects invalid requests with protocol errors", async () => {
    const missingSummary = await invoke("experience.capture", { kind: "lesson" });
    expect(missingSummary[0]).toBe(false);
    expect(missingSummary[2]).toEqual(expect.objectContaining({
      code: ErrorCodes.INVALID_REQUEST,
      message: expect.stringContaining("invalid experience.capture params"),
    }));

    const missingSkillSteps = await invoke("skill.candidates.create", {
      title: "missing steps",
      trigger: "when incomplete",
    });
    expect(missingSkillSteps[0]).toBe(false);
    expect(missingSkillSteps[2]).toEqual(expect.objectContaining({
      code: ErrorCodes.INVALID_REQUEST,
      message: expect.stringContaining("invalid skill.candidates.create params"),
    }));
  });
});
