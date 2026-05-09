import { createRuntimeAutonomy } from "../../plugins/runtime/runtime-autonomy.js";
import { createRuntimeTaskFlow } from "../../plugins/runtime/runtime-taskflow.js";
import { loadGovernanceCharter } from "../../governance/charter-runtime.js";
import {
  createBusinessTask,
  deleteBusinessTask,
  listBusinessTasks,
  updateBusinessTask,
  type BusinessTaskDuration,
  type BusinessTaskPriority,
  type BusinessTaskStatus,
} from "../../tasks/business-task-store.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function readRequiredString(params: Record<string, unknown>, key: string): string | null {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDuration(value: unknown): BusinessTaskDuration {
  return value === "medium" || value === "long" ? value : "short";
}

function readPriority(value: unknown): BusinessTaskPriority {
  return value === "high" || value === "low" ? value : "medium";
}

function readStatus(value: unknown): BusinessTaskStatus | undefined {
  return value === "pending" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
    ? value
    : undefined;
}

function readBusinessContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      domain: "general",
      accessMode: "manual",
    };
  }
  const input = value as Record<string, unknown>;
  const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload as Record<string, unknown>
    : undefined;
  return {
    domain: typeof input.domain === "string" && input.domain.trim() ? input.domain.trim() : "general",
    ...(typeof input.domainLabel === "string" ? { domainLabel: input.domainLabel } : {}),
    accessMode: typeof input.accessMode === "string" && input.accessMode.trim()
      ? input.accessMode.trim()
      : "manual",
    ...(typeof input.accessModeLabel === "string" ? { accessModeLabel: input.accessModeLabel } : {}),
    ...(typeof input.object === "string" ? { object: input.object } : {}),
    ...(typeof input.acceptanceCriteria === "string"
      ? { acceptanceCriteria: input.acceptanceCriteria }
      : {}),
    ...(payload ? { payload } : {}),
  };
}

function startBusinessAutonomy(params: {
  agentId: string;
  name: string;
  goal: string;
  business: ReturnType<typeof readBusinessContext>;
  cronService: Parameters<typeof createRuntimeAutonomy>[0]["cronService"];
}) {
  const runtime = createRuntimeAutonomy({
    legacyTaskFlow: createRuntimeTaskFlow(),
    charterDir: loadGovernanceCharter().charterDir,
    cronService: params.cronService,
  }).bindSession({ sessionKey: `agent:${params.agentId}:main` });
  return runtime.startManagedFlow({
    agentId: params.agentId,
    goal: [
      params.name,
      "",
      `业务域：${params.business.domainLabel ?? params.business.domain}`,
      `接入方式：${params.business.accessModeLabel ?? params.business.accessMode}`,
      params.business.object ? `业务对象：${params.business.object}` : "业务对象：未指定",
      params.business.acceptanceCriteria
        ? `验收标准：${params.business.acceptanceCriteria}`
        : "验收标准：按任务目标判断",
      "",
      `目标：${params.goal}`,
    ].join("\n"),
  });
}

export const businessTaskHandlers: GatewayRequestHandlers = {
  "business.tasks.list": ({ params, respond }) => {
    const status = readStatus(params.status);
    const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.floor(params.limit))
      : undefined;
    respond(true, { tasks: listBusinessTasks({ status, limit }) }, undefined);
  },
  "business.tasks.create": ({ params, respond, context }) => {
    const agentId = readRequiredString(params, "agentId") ?? "main";
    const name = readRequiredString(params, "name");
    const goal = readRequiredString(params, "goal");
    if (!name || !goal) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "name and goal are required"));
      return;
    }
    const business = readBusinessContext(params.business);
    const task = createBusinessTask({
      agentId,
      name,
      goal,
      duration: readDuration(params.duration),
      priority: readPriority(params.priority),
      group: typeof params.group === "string" && params.group.trim() ? params.group.trim() : "ai",
      business,
    });
    try {
      const started = startBusinessAutonomy({
        agentId,
        name,
        goal,
        business,
        cronService: context.cron,
      });
      const updated = updateBusinessTask(task.id, {
        progress: 15,
        autonomy: {
          flowId: typeof started?.flow?.id === "string" ? started.flow.id : undefined,
          started,
        },
      }) ?? task;
      respond(true, { task: updated, autonomyStarted: true }, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = updateBusinessTask(task.id, {
        status: "failed",
        progress: 100,
        error: message,
      }) ?? task;
      respond(true, { task: updated, autonomyStarted: false, error: message }, undefined);
    }
  },
  "business.tasks.update": ({ params, respond }) => {
    const id = readRequiredString(params, "id");
    if (!id) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "id is required"));
      return;
    }
    const task = updateBusinessTask(id, {
      status: readStatus(params.status),
      progress: typeof params.progress === "number" ? params.progress : undefined,
      error: typeof params.error === "string" ? params.error : undefined,
    });
    if (!task) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `unknown business task: ${id}`));
      return;
    }
    respond(true, { task }, undefined);
  },
  "business.tasks.delete": ({ params, respond }) => {
    const id = readRequiredString(params, "id");
    if (!id) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "id is required"));
      return;
    }
    const task = deleteBusinessTask(id);
    if (!task) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `unknown business task: ${id}`));
      return;
    }
    respond(true, { task }, undefined);
  },
};
