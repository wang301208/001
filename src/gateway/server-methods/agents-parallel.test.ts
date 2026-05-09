import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  agentsParallelHandlers,
  resetAgentsParallelBatchesForTests,
  setAgentsParallelRuntimeForTests,
} from "./agents-parallel.js";

type HandlerMethod = keyof typeof agentsParallelHandlers;

function waitUntil(predicate: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt > 1000) {
        clearInterval(timer);
        reject(new Error("condition not reached"));
      }
    }, 5);
  });
}

function invoke(method: HandlerMethod, params: Record<string, unknown>) {
  const respond = vi.fn();
  const done = Promise.resolve(
    agentsParallelHandlers[method]({
      params,
      respond: respond as never,
      context: {} as never,
      client: null,
      req: { type: "req", id: "req-1", method },
      isWebchatConnect: () => false,
    }),
  );
  return { respond, done };
}

describe("agents.parallel gateway handlers", () => {
  beforeEach(() => {
    resetAgentsParallelBatchesForTests();
  });

  it("starts child agent tasks concurrently with a concurrency cap and records status", async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    setAgentsParallelRuntimeForTests({
      startTask: vi.fn(async ({ task }) => {
        started.push(task.id);
        await new Promise<void>((resolve) => releases.push(resolve));
        return {
          sessionKey: `agent:${task.agentId ?? "main"}:parallel:${task.id}`,
          runId: `run-${task.id}`,
          status: "started",
        };
      }),
      abortTask: vi.fn(),
    });

    const { respond, done } = invoke("agents.parallel.start", {
      title: "parallel rollout",
      parentSessionKey: "agent:main:main",
      concurrency: 2,
      tasks: [
        { id: "research", agentId: "researcher", goal: "check constraints" },
        { id: "build", agentId: "developer", goal: "implement patch" },
        { id: "verify", agentId: "qa", goal: "run verification" },
      ],
    });

    await waitUntil(() => started.length === 2);
    expect(started).toEqual(["research", "build"]);

    releases.shift()?.();
    await waitUntil(() => started.length === 3);
    expect(started).toEqual(["research", "build", "verify"]);

    while (releases.length > 0) {
      releases.shift()?.();
    }
    await done;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        batchId: expect.stringMatching(/^parallel_/),
        status: "running",
        counts: { total: 3, queued: 0, starting: 0, running: 3, failed: 0, cancelled: 0 },
        tasks: [
          expect.objectContaining({ id: "research", status: "running", runId: "run-research" }),
          expect.objectContaining({ id: "build", status: "running", runId: "run-build" }),
          expect.objectContaining({ id: "verify", status: "running", runId: "run-verify" }),
        ],
      }),
      undefined,
    );

    const payload = respond.mock.calls[0]?.[1] as { batchId: string };
    const status = await invoke("agents.parallel.status", { batchId: payload.batchId }).done;
    expect(status).toBeUndefined();
  });

  it("reports partial launch failures without blocking successful workers", async () => {
    setAgentsParallelRuntimeForTests({
      startTask: vi.fn(async ({ task }) => {
        if (task.id === "bad") {
          throw new Error("model unavailable");
        }
        return {
          sessionKey: `session-${task.id}`,
          runId: `run-${task.id}`,
          status: "started",
        };
      }),
      abortTask: vi.fn(),
    });

    const { respond, done } = invoke("agents.parallel.start", {
      tasks: [
        { id: "ok", goal: "finish usable work" },
        { id: "bad", goal: "hit unavailable model" },
      ],
    });
    await done;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        status: "running",
        counts: { total: 2, queued: 0, starting: 0, running: 1, failed: 1, cancelled: 0 },
        tasks: [
          expect.objectContaining({ id: "ok", status: "running" }),
          expect.objectContaining({
            id: "bad",
            status: "failed",
            error: expect.stringContaining("model unavailable"),
          }),
        ],
      }),
      undefined,
    );
  });

  it("cancels launched parallel workers through their recorded session runs", async () => {
    const abortTask = vi.fn(async () => ({ aborted: true }));
    setAgentsParallelRuntimeForTests({
      startTask: vi.fn(async ({ task }) => ({
        sessionKey: `session-${task.id}`,
        runId: `run-${task.id}`,
        status: "started",
      })),
      abortTask,
    });

    const started = invoke("agents.parallel.start", {
      tasks: [
        { id: "a", goal: "one" },
        { id: "b", goal: "two" },
      ],
    });
    await started.done;
    const batchId = (started.respond.mock.calls[0]?.[1] as { batchId: string }).batchId;

    const cancelled = invoke("agents.parallel.cancel", { batchId });
    await cancelled.done;

    expect(abortTask).toHaveBeenCalledTimes(2);
    expect(abortTask).toHaveBeenCalledWith({ sessionKey: "session-a", runId: "run-a" });
    expect(abortTask).toHaveBeenCalledWith({ sessionKey: "session-b", runId: "run-b" });
    expect(cancelled.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        batchId,
        status: "cancelled",
        counts: { total: 2, queued: 0, starting: 0, running: 0, failed: 0, cancelled: 2 },
      }),
      undefined,
    );
  });
});
