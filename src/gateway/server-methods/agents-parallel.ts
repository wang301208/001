import { randomUUID } from "node:crypto";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsParallelCancelParams,
  validateAgentsParallelListParams,
  validateAgentsParallelStartParams,
  validateAgentsParallelStatusParams,
  type AgentsParallelBatchResult,
  type AgentsParallelStartParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlerOptions, GatewayRequestHandlers, RespondFn } from "./types.js";

type ParallelTaskInput = AgentsParallelStartParams["tasks"][number];
type ParallelTaskStatus = AgentsParallelBatchResult["tasks"][number]["status"];
type ParallelBatchStatus = AgentsParallelBatchResult["status"];
type ParallelTaskRecord = AgentsParallelBatchResult["tasks"][number] & {
  model?: string;
  label?: string;
};
type ParallelBatchRecord = AgentsParallelBatchResult;

export type AgentsParallelRuntime = {
  startTask: (params: {
    task: ParallelTaskRecord;
    batch: ParallelBatchRecord;
    request: GatewayRequestHandlerOptions;
  }) => Promise<{ sessionKey?: string; runId?: string; status?: string }>;
  abortTask: (params: { sessionKey: string; runId?: string }) => Promise<unknown>;
};

const batches = new Map<string, ParallelBatchRecord>();
let runtimeOverride: AgentsParallelRuntime | null = null;

function now() {
  return Date.now();
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeTaskId(task: ParallelTaskInput, index: number): string {
  const raw = task.id?.trim();
  if (raw) {
    return raw;
  }
  return `task_${index + 1}`;
}

function buildCounts(tasks: ParallelTaskRecord[]): ParallelBatchRecord["counts"] {
  const counts = {
    total: tasks.length,
    queued: 0,
    starting: 0,
    running: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

function resolveBatchStatus(tasks: ParallelTaskRecord[]): ParallelBatchStatus {
  const counts = buildCounts(tasks);
  if (counts.total > 0 && counts.cancelled === counts.total) {
    return "cancelled";
  }
  if (counts.running > 0 || counts.queued > 0 || counts.starting > 0) {
    return "running";
  }
  if (counts.failed > 0) {
    return "failed";
  }
  return "running";
}

function refreshBatch(batch: ParallelBatchRecord): ParallelBatchRecord {
  const updated: ParallelBatchRecord = {
    ...batch,
    status: resolveBatchStatus(batch.tasks),
    counts: buildCounts(batch.tasks),
    updatedAt: now(),
  };
  batches.set(updated.batchId, updated);
  return updated;
}

function getStartRuntime(): Pick<AgentsParallelRuntime, "startTask"> {
  return runtimeOverride ?? defaultAgentsParallelRuntime;
}

async function invokeHandlerPayload(
  method: "sessions.create" | "sessions.abort",
  request: GatewayRequestHandlerOptions,
  params: Record<string, unknown>,
): Promise<unknown> {
  let response:
    | { ok: boolean; payload?: unknown; error?: ReturnType<typeof errorShape> }
    | undefined;
  const { sessionsHandlers } = await import("./sessions.js");
  await sessionsHandlers[method]({
    ...request,
    req: { ...request.req, method },
    params,
    respond: (ok, payload, error) => {
      response = { ok, payload, error };
    },
  });
  if (!response) {
    throw new Error(`${method} did not respond`);
  }
  if (!response.ok) {
    throw new Error(response.error?.message ?? `${method} failed`);
  }
  return response.payload;
}

const defaultAgentsParallelRuntime: Pick<AgentsParallelRuntime, "startTask"> = {
  async startTask({ task, batch, request }) {
    const payload = await invokeHandlerPayload("sessions.create", request, {
      ...(task.agentId ? { agentId: task.agentId } : {}),
      ...(task.model ? { model: task.model } : {}),
      ...(task.label ? { label: task.label } : { label: `${batch.title ?? "parallel"}:${task.id}` }),
      ...(batch.parentSessionKey ? { parentSessionKey: batch.parentSessionKey } : {}),
      message: task.goal,
    });
    const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    return {
      sessionKey: typeof result.key === "string" ? result.key : undefined,
      runId: typeof result.runId === "string" ? result.runId : undefined,
      status: typeof result.status === "string" ? result.status : undefined,
    };
  },
};

async function startBatchTasks(batch: ParallelBatchRecord, request: GatewayRequestHandlerOptions) {
  const runtime = getStartRuntime();
  let cursor = 0;
  const concurrency = Math.min(Math.max(1, batch.concurrency), batch.tasks.length);

  async function worker() {
    while (cursor < batch.tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = batch.tasks[index];
      if (!task || task.status !== "queued") {
        continue;
      }
      task.status = "starting";
      task.startedAt = now();
      task.updatedAt = task.startedAt;
      refreshBatch(batch);
      try {
        const started = await runtime.startTask({ task, batch, request });
        task.status = "running";
        task.sessionKey = started.sessionKey;
        task.runId = started.runId;
      } catch (err) {
        task.status = "failed";
        task.error = toErrorMessage(err);
      }
      task.updatedAt = now();
      refreshBatch(batch);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

function createBatch(params: AgentsParallelStartParams): ParallelBatchRecord {
  const createdAt = now();
  const taskIds = new Set<string>();
  const tasks = params.tasks.map((task, index): ParallelTaskRecord => {
    let id = normalizeTaskId(task, index);
    if (taskIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    taskIds.add(id);
    return {
      id,
      ...(task.agentId ? { agentId: task.agentId } : {}),
      ...(task.model ? { model: task.model } : {}),
      ...(task.label ? { label: task.label } : {}),
      goal: task.goal.trim(),
      status: "queued" as ParallelTaskStatus,
      updatedAt: createdAt,
    };
  });
  const batch: ParallelBatchRecord = {
    batchId: `parallel_${randomUUID()}`,
    ...(params.title ? { title: params.title } : {}),
    status: "running",
    concurrency: params.concurrency ?? Math.min(4, tasks.length),
    ...(params.parentSessionKey ? { parentSessionKey: params.parentSessionKey } : {}),
    createdAt,
    updatedAt: createdAt,
    counts: buildCounts(tasks),
    tasks,
  };
  batches.set(batch.batchId, batch);
  return batch;
}

function respondInvalidParams(
  respond: RespondFn,
  method: string,
  errors: unknown,
) {
  respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid ${method} params: ${formatValidationErrors(errors as never)}`,
    ),
  );
}

export const agentsParallelHandlers: GatewayRequestHandlers = {
  "agents.parallel.start": async (request) => {
    const { params, respond } = request;
    if (!validateAgentsParallelStartParams(params)) {
      respondInvalidParams(respond, "agents.parallel.start", validateAgentsParallelStartParams.errors);
      return;
    }

    const batch = createBatch(params);
    await startBatchTasks(batch, request);
    respond(true, refreshBatch(batch), undefined);
  },

  "agents.parallel.status": ({ params, respond }) => {
    if (!validateAgentsParallelStatusParams(params)) {
      respondInvalidParams(
        respond,
        "agents.parallel.status",
        validateAgentsParallelStatusParams.errors,
      );
      return;
    }
    const batch = batches.get(params.batchId);
    if (!batch) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `parallel batch not found: ${params.batchId}`),
      );
      return;
    }
    respond(true, refreshBatch(batch), undefined);
  },

  "agents.parallel.list": ({ params, respond }) => {
    if (!validateAgentsParallelListParams(params)) {
      respondInvalidParams(respond, "agents.parallel.list", validateAgentsParallelListParams.errors);
      return;
    }
    const limit = params.limit ?? 20;
    const listed = Array.from(batches.values())
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((batch) => refreshBatch(batch));
    respond(true, { batches: listed }, undefined);
  },

  "agents.parallel.cancel": async (request) => {
    const { params, respond } = request;
    if (!validateAgentsParallelCancelParams(params)) {
      respondInvalidParams(
        respond,
        "agents.parallel.cancel",
        validateAgentsParallelCancelParams.errors,
      );
      return;
    }
    const batch = batches.get(params.batchId);
    if (!batch) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `parallel batch not found: ${params.batchId}`),
      );
      return;
    }
    await Promise.all(
      batch.tasks.map(async (task) => {
        if (task.status === "failed" || task.status === "cancelled") {
          return;
        }
        if (task.sessionKey) {
          if (runtimeOverride) {
            await runtimeOverride.abortTask({ sessionKey: task.sessionKey, runId: task.runId });
          } else {
            await invokeHandlerPayload("sessions.abort", request, {
              key: task.sessionKey,
              ...(task.runId ? { runId: task.runId } : {}),
            });
          }
        }
        task.status = "cancelled";
        task.updatedAt = now();
      }),
    );
    respond(true, refreshBatch(batch), undefined);
  },
};

export function setAgentsParallelRuntimeForTests(runtime: AgentsParallelRuntime): void {
  runtimeOverride = runtime;
}

export function resetAgentsParallelBatchesForTests(): void {
  batches.clear();
  runtimeOverride = null;
}
