import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { startQaLabServer } from "./lab-server.js";
import { readQaBootstrapScenarioCatalog } from "./scenario-catalog.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function isRetryableLocalFetchError(error: unknown) {
  if (!(error instanceof TypeError)) {
    return false;
  }
  const cause = (error as TypeError & { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") {
    return false;
  }
  const code = "code" in cause ? (cause as { code?: unknown }).code : undefined;
  return code === "ECONNRESET" || code === "UND_ERR_SOCKET";
}

async function fetchWithRetry(input: string, init?: RequestInit, attempts = 3) {
  const method = init?.method?.toUpperCase() ?? "GET";
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if ((method !== "GET" && method !== "HEAD") || !isRetryableLocalFetchError(error)) {
        throw error;
      }
      if (attempt === attempts) {
        throw error;
      }
      await sleep(50);
    }
  }
  throw lastError;
}

async function waitForRunnerCatalog(baseUrl: string, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetchWithRetry(`${baseUrl}/api/bootstrap`);
    const bootstrap = (await response.json()) as {
      runnerCatalog: {
        status: "loading" | "ready" | "failed";
        real: Array<{ key: string; name: string }>;
      };
    };
    if (bootstrap.runnerCatalog.status !== "loading") {
      return bootstrap.runnerCatalog;
    }
    await sleep(50);
  }
  throw new Error("runner catalog stayed loading");
}

async function waitForFile(filePath: string, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      await sleep(50);
    }
  }
  throw new Error(`file did not appear: ${filePath}`);
}

describe("qa-lab server", () => {
  it("tracks inbound messages in bus state", async () => {
    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      embeddedGateway: "disabled",
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const messageResponse = await fetch(`${lab.baseUrl}/api/inbound/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        conversation: { id: "bob", kind: "direct" },
        senderId: "bob",
        senderName: "Bob",
        text: "hello from test",
      }),
    });
    expect(messageResponse.status).toBe(200);
    await messageResponse.arrayBuffer();

    const stateResponse = await fetchWithRetry(`${lab.baseUrl}/api/state`);
    expect(stateResponse.status).toBe(200);
    const snapshot = (await stateResponse.json()) as {
      messages: Array<{ direction: string; text: string }>;
    };
    expect(snapshot.messages.some((message) => message.text === "hello from test")).toBe(true);
  });

  it("writes a self-check report to an explicit output path", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "qa-lab-explicit-self-check-"));
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "qa-lab-explicit-self-check-root-"));
    cleanups.push(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });
    cleanups.push(async () => {
      await rm(repoRoot, { recursive: true, force: true });
    });
    const outputPath = path.join(tempDir, "self-check.md");
    await mkdir(path.join(repoRoot, "dist"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "dist/index.js"),
      'process.stdout.write(JSON.stringify({ models: [] }));\n',
      "utf8",
    );

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      repoRoot,
      outputPath,
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const result = await lab.runSelfCheck();
    expect(result.scenarioResult.status).toBe("pass");
    expect(result.outputPath).toBe(outputPath);
    const markdown = await readFile(outputPath, "utf8");
    expect(markdown).toContain("Synthetic Slack-class roundtrip");
    expect(markdown).toContain("- Status: pass");
  });

  it("anchors direct self-check runs under the explicit repo root by default", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "qa-lab-self-check-root-"));
    cleanups.push(async () => {
      await rm(repoRoot, { recursive: true, force: true });
    });

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      repoRoot,
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const result = await lab.runSelfCheck();
    expect(result.outputPath).toBe(path.join(repoRoot, ".artifacts", "qa-e2e", "self-check.md"));
    expect(await readFile(result.outputPath, "utf8")).toContain("Synthetic Slack-class roundtrip");
  });

  it("injects the kickoff task on demand and on startup", async () => {
    const kickoffTask = readQaBootstrapScenarioCatalog().kickoffTask;
    const autoKickoffLab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      sendKickoffOnStart: true,
      embeddedGateway: "disabled",
    });
    cleanups.push(async () => {
      await autoKickoffLab.stop();
    });

    const autoSnapshot = (await (
      await fetchWithRetry(`${autoKickoffLab.baseUrl}/api/state`)
    ).json()) as {
      messages: Array<{ text: string }>;
    };
    expect(autoSnapshot.messages.some((message) => message.text === kickoffTask)).toBe(true);

    const manualLab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      embeddedGateway: "disabled",
    });
    cleanups.push(async () => {
      await manualLab.stop();
    });

    const kickoffResponse = await fetch(`${manualLab.baseUrl}/api/kickoff`, {
      method: "POST",
    });
    expect(kickoffResponse.status).toBe(200);
    await kickoffResponse.arrayBuffer();

    const manualSnapshot = (await (
      await fetchWithRetry(`${manualLab.baseUrl}/api/state`)
    ).json()) as {
      messages: Array<{ text: string }>;
    };
    expect(manualSnapshot.messages.some((message) => message.text === kickoffTask)).toBe(true);
  });

  it("serves the removed browser UI placeholder at the root", async () => {
    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const rootResponse = await fetchWithRetry(`${lab.baseUrl}/`);
    expect(rootResponse.status).toBe(200);
    const html = await rootResponse.text();
    expect(html).toContain("QA Lab browser UI removed");
    expect(html).toContain("assistant --tui");
  });

  it("uses the explicit repo root for runner model discovery", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "qa-lab-repo-root-"));
    cleanups.push(async () => {
      await rm(repoRoot, { recursive: true, force: true });
    });
    await mkdir(path.join(repoRoot, "dist"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "dist/index.js"),
      [
        "process.stdout.write(JSON.stringify({",
        "  models: [{",
        '    key: "anthropic/qa-temp-model",',
        '    name: "QA Temp Model",',
        '    input: "anthropic/qa-temp-model",',
        "    available: true,",
        "    missing: false,",
        "  }],",
        "}));",
      ].join("\n"),
      "utf8",
    );

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      repoRoot,
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const rootResponse = await fetchWithRetry(`${lab.baseUrl}/`);
    expect(rootResponse.status).toBe(200);
    expect(await rootResponse.text()).toContain("QA Lab browser UI removed");

    const runnerCatalog = await waitForRunnerCatalog(lab.baseUrl);
    expect(runnerCatalog.status).toBe("ready");
    expect(runnerCatalog.real).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "anthropic/qa-temp-model",
          name: "QA Temp Model",
        }),
      ]),
    );
  });

  it("does not eagerly load the runner model catalog before bootstrap is requested", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "qa-lab-lazy-catalog-"));
    cleanups.push(async () => {
      await rm(repoRoot, { recursive: true, force: true });
    });
    const markerPath = path.join(repoRoot, "runner-catalog-hit.txt");

    await mkdir(path.join(repoRoot, "dist"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "dist/index.js"),
      [
        'const fs = require("node:fs");',
        `fs.writeFileSync(${JSON.stringify(markerPath)}, process.argv.slice(2).join(" "), "utf8");`,
        "process.stdout.write(JSON.stringify({",
        "  models: [{",
        '    key: "openai/gpt-5.4",',
        '    name: "GPT-5.4",',
        '    input: "openai/gpt-5.4",',
        "    available: true,",
        "    missing: false,",
        "  }],",
        "}));",
      ].join("\n"),
      "utf8",
    );

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      repoRoot,
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    await sleep(150);
    await expect(readFile(markerPath, "utf8")).rejects.toThrow();

    const bootstrapResponse = await fetchWithRetry(`${lab.baseUrl}/api/bootstrap`);
    expect(bootstrapResponse.status).toBe(200);

    const runnerCatalog = await waitForRunnerCatalog(lab.baseUrl);
    expect(runnerCatalog.status).toBe("ready");
    expect(await readFile(markerPath, "utf8")).toContain("models list --all --json");
  });

  it("aborts an in-flight runner model catalog when the lab stops", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "qa-lab-abort-catalog-"));
    cleanups.push(async () => {
      await rm(repoRoot, { recursive: true, force: true });
    });
    const markerPath = path.join(repoRoot, "runner-catalog-started.txt");
    const stoppedPath = path.join(repoRoot, "runner-catalog-stopped.txt");

    await mkdir(path.join(repoRoot, "dist"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "dist/index.js"),
      [
        'const fs = require("node:fs");',
        `fs.writeFileSync(${JSON.stringify(markerPath)}, process.env.ASSISTANT_CODEX_DISCOVERY_LIVE || "", "utf8");`,
        "process.on('SIGTERM', () => {",
        `  fs.writeFileSync(${JSON.stringify(stoppedPath)}, "terminated", "utf8");`,
        "  process.exit(0);",
        "});",
        "setInterval(() => {}, 1000);",
      ].join("\n"),
      "utf8",
    );

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      repoRoot,
    });
    let stopped = false;
    cleanups.push(async () => {
      if (!stopped) {
        await lab.stop();
      }
    });

    const bootstrapResponse = await fetchWithRetry(`${lab.baseUrl}/api/bootstrap`);
    expect(bootstrapResponse.status).toBe(200);
    expect(await waitForFile(markerPath)).toBe("0");

    await lab.stop();
    stopped = true;
    if (process.platform !== "win32") {
      expect(await waitForFile(stoppedPath)).toBe("terminated");
    }
  });

  it("can disable the embedded echo gateway for real-suite runs", async () => {
    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      embeddedGateway: "disabled",
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    await fetch(`${lab.baseUrl}/api/inbound/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        conversation: { id: "bob", kind: "direct" },
        senderId: "bob",
        senderName: "Bob",
        text: "hello from suite",
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 800));
    const snapshot = (await (await fetchWithRetry(`${lab.baseUrl}/api/state`)).json()) as {
      messages: Array<{ direction: string }>;
    };
    expect(snapshot.messages.filter((message) => message.direction === "outbound")).toHaveLength(0);
  });

  it("exposes structured outcomes without browser frontend metadata", async () => {
    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
      embeddedGateway: "disabled",
    });
    cleanups.push(async () => {
      await lab.stop();
    });

    const initialOutcomes = (await (
      await fetchWithRetry(`${lab.baseUrl}/api/outcomes`)
    ).json()) as {
      run: unknown;
    };
    expect(initialOutcomes.run).toBeNull();

    lab.setScenarioRun({
      kind: "suite",
      status: "running",
      startedAt: "2026-04-06T09:00:00.000Z",
      scenarios: [
        {
          id: "channel-chat-baseline",
          name: "Channel baseline conversation",
          status: "pass",
          steps: [{ name: "reply check", status: "pass", details: "ok" }],
          finishedAt: "2026-04-06T09:00:01.000Z",
        },
        {
          id: "cron-one-minute-ping",
          name: "Cron one-minute ping",
          status: "running",
          startedAt: "2026-04-06T09:00:02.000Z",
        },
      ],
    });

    const bootstrap = (await (await fetchWithRetry(`${lab.baseUrl}/api/bootstrap`)).json()) as {
      controlUiEmbeddedUrl?: string | null;
      controlUiUrl?: string | null;
    };
    expect(bootstrap.controlUiEmbeddedUrl).toBeUndefined();
    expect(bootstrap.controlUiUrl).toBeUndefined();

    const outcomes = (await (await fetchWithRetry(`${lab.baseUrl}/api/outcomes`)).json()) as {
      run: {
        status: string;
        counts: { total: number; passed: number; running: number };
        scenarios: Array<{ id: string; status: string }>;
      };
    };
    expect(outcomes.run.status).toBe("running");
    expect(outcomes.run.counts).toEqual({
      total: 2,
      pending: 0,
      running: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
    });
    expect(outcomes.run.scenarios.map((scenario) => scenario.id)).toEqual([
      "channel-chat-baseline",
      "cron-one-minute-ping",
    ]);
  });

  it("serves proxy capture sessions, events, and query rows", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "qa-lab-capture-"));
    cleanups.push(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });
    process.env.ASSISTANT_DEBUG_PROXY_DB_PATH = path.join(tempDir, "capture.sqlite");
    process.env.ASSISTANT_DEBUG_PROXY_BLOB_DIR = path.join(tempDir, "blobs");
    const { closeDebugProxyCaptureStore, getDebugProxyCaptureStore } =
      await import("../../../src/proxy-capture/store.sqlite.js");
    const store = getDebugProxyCaptureStore(
      process.env.ASSISTANT_DEBUG_PROXY_DB_PATH,
      process.env.ASSISTANT_DEBUG_PROXY_BLOB_DIR,
    );
    store.upsertSession({
      id: "qa-capture-session",
      startedAt: Date.now(),
      mode: "proxy-run",
      sourceScope: "assistant",
      sourceProcess: "assistant",
      dbPath: process.env.ASSISTANT_DEBUG_PROXY_DB_PATH,
      blobDir: process.env.ASSISTANT_DEBUG_PROXY_BLOB_DIR,
    });
    store.recordEvent({
      sessionId: "qa-capture-session",
      ts: Date.now(),
      sourceScope: "assistant",
      sourceProcess: "assistant",
      protocol: "https",
      direction: "outbound",
      kind: "request",
      flowId: "flow-1",
      method: "POST",
      host: "api.example.com",
      path: "/v1/send",
      dataText: '{"hello":"world"}',
      dataSha256: "abc",
      metaJson: JSON.stringify({
        provider: "openai",
        api: "responses",
        model: "gpt-5.4",
        captureOrigin: "shared-fetch",
      }),
    });
    store.recordEvent({
      sessionId: "qa-capture-session",
      ts: Date.now() + 1,
      sourceScope: "assistant",
      sourceProcess: "assistant",
      protocol: "https",
      direction: "outbound",
      kind: "request",
      flowId: "flow-2",
      method: "POST",
      host: "api.example.com",
      path: "/v1/send",
      dataText: '{"hello":"world"}',
      dataSha256: "abc",
      metaJson: JSON.stringify({
        provider: "openai",
        api: "responses",
        model: "gpt-5.4",
        captureOrigin: "shared-fetch",
      }),
    });
    store.recordEvent({
      sessionId: "qa-capture-session",
      ts: Date.now() + 2,
      sourceScope: "assistant",
      sourceProcess: "assistant",
      protocol: "https",
      direction: "outbound",
      kind: "request",
      flowId: "flow-3",
      method: "POST",
      host: "127.0.0.1:11434",
      path: "/api/chat",
      metaJson: JSON.stringify({
        provider: "ollama",
        model: "kimi-k2.5:cloud",
        captureOrigin: "shared-fetch",
      }),
    });

    const lab = await startQaLabServer({
      host: "127.0.0.1",
      port: 0,
    });
    cleanups.push(async () => {
      closeDebugProxyCaptureStore();
    });
    cleanups.push(async () => {
      delete process.env.ASSISTANT_DEBUG_PROXY_DB_PATH;
      delete process.env.ASSISTANT_DEBUG_PROXY_BLOB_DIR;
      await lab.stop();
    });

    const sessions = (await (
      await fetchWithRetry(`${lab.baseUrl}/api/capture/sessions`)
    ).json()) as { sessions: Array<{ id: string }> };
    expect(sessions.sessions.some((session) => session.id === "qa-capture-session")).toBe(true);

    const events = (await (
      await fetchWithRetry(`${lab.baseUrl}/api/capture/events?sessionId=qa-capture-session`)
    ).json()) as {
      events: Array<{ flowId: string; provider?: string; model?: string; captureOrigin?: string }>;
    };
    expect(events.events.some((event) => event.flowId === "flow-1")).toBe(true);
    expect(events.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flowId: "flow-1",
          provider: "openai",
          model: "gpt-5.4",
          captureOrigin: "shared-fetch",
        }),
        expect.objectContaining({
          flowId: "flow-3",
          provider: "ollama",
          model: "kimi-k2.5:cloud",
        }),
      ]),
    );

    const coverage = (await (
      await fetchWithRetry(`${lab.baseUrl}/api/capture/coverage?sessionId=qa-capture-session`)
    ).json()) as {
      coverage: {
        totalEvents: number;
        unlabeledEventCount: number;
        providers: Array<{ value: string; count: number }>;
        models: Array<{ value: string; count: number }>;
        localPeers: Array<{ value: string; count: number }>;
      };
    };
    expect(coverage.coverage.totalEvents).toBe(3);
    expect(coverage.coverage.unlabeledEventCount).toBe(0);
    expect(coverage.coverage.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "openai", count: 2 }),
        expect.objectContaining({ value: "ollama", count: 1 }),
      ]),
    );
    expect(coverage.coverage.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "gpt-5.4", count: 2 }),
        expect.objectContaining({ value: "kimi-k2.5:cloud", count: 1 }),
      ]),
    );
    expect(coverage.coverage.localPeers).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "127.0.0.1:11434", count: 1 })]),
    );

    const query = (await (
      await fetchWithRetry(
        `${lab.baseUrl}/api/capture/query?sessionId=qa-capture-session&preset=double-sends`,
      )
    ).json()) as { rows: Array<{ host: string; duplicateCount: number }> };
    expect(query.rows).toEqual([
      expect.objectContaining({
        host: "api.example.com",
        duplicateCount: 2,
      }),
    ]);
  });
});
