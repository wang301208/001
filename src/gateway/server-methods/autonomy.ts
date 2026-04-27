import { formatErrorMessage } from "../../infra/errors.js";
import type {
  AutonomySeedTaskTemplate,
  AutonomyStartManagedFlowParams,
} from "../../plugins/runtime/runtime-autonomy.types.js";
import { createRuntimeAutonomy } from "../../plugins/runtime/runtime-autonomy.js";
import { createRuntimeTaskFlow } from "../../plugins/runtime/runtime-taskflow.js";
import { buildAgentMainSessionKey, normalizeAgentId } from "../../routing/session-key.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import type { TaskRuntime } from "../../tasks/task-registry.types.js";
import {
  ErrorCodes,
  validateAutonomyCapabilityInventoryParams,
  validateAutonomyCancelParams,
  validateAutonomyGenesisPlanParams,
  validateAutonomyGovernanceProposalsParams,
  validateAutonomyGovernanceReconcileParams,
  validateAutonomyHealParams,
  validateAutonomyHistoryParams,
  validateAutonomyLoopRemoveParams,
  validateAutonomyLoopReconcileParams,
  validateAutonomyLoopShowParams,
  validateAutonomyLoopUpsertParams,
  validateAutonomyOverviewParams,
  errorShape,
  validateAutonomyListParams,
  validateAutonomyShowParams,
  validateAutonomyStartParams,
  validateAutonomySubmitSandboxReplayParams,
  validateAutonomySuperviseParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";
import { assertValidParams } from "./validation.js";

const AUTONOMY_NOTIFY_POLICIES = new Set(["done_only", "state_changes", "silent"]);
const AUTONOMY_FLOW_STATUSES = new Set(["queued", "running"]);
const AUTONOMY_SEED_TASK_RUNTIMES = new Set<TaskRuntime>(["subagent", "acp", "cli", "cron"]);
const AUTONOMY_SEED_TASK_STATUSES = new Set<AutonomySeedTaskTemplate["status"]>([
  "queued",
  "running",
]);

function isAutonomySeedTaskRuntime(value: string): value is TaskRuntime {
  return AUTONOMY_SEED_TASK_RUNTIMES.has(value as TaskRuntime);
}

function isAutonomySeedTaskStatus(
  value: string,
): value is AutonomySeedTaskTemplate["status"] {
  return AUTONOMY_SEED_TASK_STATUSES.has(value as AutonomySeedTaskTemplate["status"]);
}

function resolveAutonomySessionKey(params: {
  agentId?: string;
  sessionKey?: string;
}): string {
  const sessionKey = normalizeOptionalString(params.sessionKey);
  if (sessionKey) {
    return sessionKey;
  }
  return buildAgentMainSessionKey({
    agentId: normalizeAgentId(params.agentId),
  });
}

function bindAutonomyRuntime(params: {
  agentId?: string;
  sessionKey?: string;
  cronService?: import("../../cron/service-contract.js").CronServiceContract;
}) {
  const sessionKey = resolveAutonomySessionKey(params);
  const runtime = createRuntimeAutonomy({
    legacyTaskFlow: createRuntimeTaskFlow(),
    cronService: params.cronService,
  }).bindSession({
    sessionKey,
  });
  return {
    sessionKey,
    runtime,
  };
}

function resolveSeedTaskInput(
  params: Record<string, unknown>,
): AutonomyStartManagedFlowParams["seedTask"] {
  const seedTaskEnabled =
    typeof params.seedTaskEnabled === "boolean" ? params.seedTaskEnabled : undefined;
  const seedTaskRuntime =
    typeof params.seedTaskRuntime === "string" && isAutonomySeedTaskRuntime(params.seedTaskRuntime)
      ? params.seedTaskRuntime
      : undefined;
  const seedTaskStatus =
    typeof params.seedTaskStatus === "string" && isAutonomySeedTaskStatus(params.seedTaskStatus)
      ? params.seedTaskStatus
      : undefined;
  const seedTaskLabel =
    typeof params.seedTaskLabel === "string" ? params.seedTaskLabel : undefined;
  const seedTaskTask = typeof params.seedTaskTask === "string" ? params.seedTaskTask : undefined;

  if (
    seedTaskEnabled === false &&
    seedTaskRuntime === undefined &&
    seedTaskStatus === undefined &&
    seedTaskLabel === undefined &&
    seedTaskTask === undefined
  ) {
    return false;
  }

  if (
    seedTaskEnabled === undefined &&
    seedTaskRuntime === undefined &&
    seedTaskStatus === undefined &&
    seedTaskLabel === undefined &&
    seedTaskTask === undefined
  ) {
    return undefined;
  }

  return {
    ...(seedTaskEnabled !== undefined ? { enabled: seedTaskEnabled } : {}),
    ...(seedTaskRuntime ? { runtime: seedTaskRuntime } : {}),
    ...(seedTaskStatus ? { status: seedTaskStatus } : {}),
    ...(seedTaskLabel !== undefined ? { label: seedTaskLabel } : {}),
    ...(seedTaskTask !== undefined ? { task: seedTaskTask } : {}),
  };
}

function resolveAgentIdsInput(params: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(params.agentIds)) {
    return undefined;
  }
  const agentIds = params.agentIds.filter((value): value is string => typeof value === "string");
  return agentIds.length > 0 ? agentIds : undefined;
}

function resolveWorkspaceDirsInput(params: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(params.workspaceDirs)) {
    return undefined;
  }
  const workspaceDirs = params.workspaceDirs.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return workspaceDirs.length > 0 ? workspaceDirs : undefined;
}

function resolveAutonomyHistoryModeInput(params: Record<string, unknown>) {
  return params.mode === "heal" || params.mode === "reconcile" ? params.mode : undefined;
}

function resolveAutonomyHistorySourceInput(params: Record<string, unknown>) {
  return params.source === "manual" || params.source === "startup" || params.source === "supervisor"
    ? params.source
    : undefined;
}

function resolveAutonomySupervisorGovernanceModeInput(params: Record<string, unknown>) {
  return params.governanceMode === "none" ||
    params.governanceMode === "apply_safe" ||
    params.governanceMode === "force_apply_all"
    ? params.governanceMode
    : undefined;
}

function respondAutonomyFailure(
  respond: RespondFn,
  error: unknown,
) {
  const message = formatErrorMessage(error) || "autonomy operation failed";
  const code = /not found/i.test(message) ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE;
  respond(false, undefined, errorShape(code, message));
}

export const autonomyHandlers: GatewayRequestHandlers = {
  "autonomy.list": ({ params, respond }) => {
    if (!assertValidParams(params, validateAutonomyListParams, "autonomy.list", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
    });
    respond(
      true,
      {
        sessionKey,
        profiles: runtime.listProfiles(),
      },
      undefined,
    );
  },
  "autonomy.overview": async ({ params, respond, context }) => {
    if (
      !assertValidParams(params, validateAutonomyOverviewParams, "autonomy.overview", respond)
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const overview = await runtime.getFleetStatus({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          overview,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.capability.inventory": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomyCapabilityInventoryParams,
        "autonomy.capability.inventory",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const capabilities = await runtime.getCapabilityInventory({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          capabilities,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.genesis.plan": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomyGenesisPlanParams,
        "autonomy.genesis.plan",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const genesisPlan = await runtime.planGenesisWork({
        ...(agentIds ? { agentIds } : {}),
        ...(typeof params.teamId === "string" ? { teamId: params.teamId } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          genesisPlan,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.heal": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyHealParams, "autonomy.heal", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const healed = await runtime.healFleet({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          healed,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.supervise": async ({ params, respond, context }) => {
    if (
      !assertValidParams(params, validateAutonomySuperviseParams, "autonomy.supervise", respond)
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const governanceMode = resolveAutonomySupervisorGovernanceModeInput(params);
      const supervised = await runtime.superviseFleet({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
        ...(typeof params.teamId === "string" ? { teamId: params.teamId } : {}),
        ...(typeof params.restartBlockedFlows === "boolean"
          ? { restartBlockedFlows: params.restartBlockedFlows }
          : {}),
        ...(governanceMode ? { governanceMode } : {}),
        ...(typeof params.decisionNote === "string" ? { decisionNote: params.decisionNote } : {}),
        ...(typeof params.includeCapabilityInventory === "boolean"
          ? { includeCapabilityInventory: params.includeCapabilityInventory }
          : {}),
        ...(typeof params.includeGenesisPlan === "boolean"
          ? { includeGenesisPlan: params.includeGenesisPlan }
          : {}),
        ...(typeof params.recordHistory === "boolean"
          ? { recordHistory: params.recordHistory }
          : {}),
      });
      respond(
        true,
        {
          sessionKey,
          supervised,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.history": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyHistoryParams, "autonomy.history", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const mode = resolveAutonomyHistoryModeInput(params);
      const source = resolveAutonomyHistorySourceInput(params);
      const history = await runtime.getFleetHistory({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
        ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
        ...(mode ? { mode } : {}),
        ...(source ? { source } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          history,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.governance.proposals": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomyGovernanceProposalsParams,
        "autonomy.governance.proposals",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const governanceProposals = await runtime.synthesizeGovernanceProposals({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          governance: governanceProposals,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.governance.reconcile": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomyGovernanceReconcileParams,
        "autonomy.governance.reconcile",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const governanceReconciled = await runtime.reconcileGovernanceProposals({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
        ...(params.mode === "apply_safe" || params.mode === "force_apply_all"
          ? { mode: params.mode }
          : {}),
        ...(typeof params.decisionNote === "string" ? { decisionNote: params.decisionNote } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          governanceReconciled,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.show": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyShowParams, "autonomy.show", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    const profile = runtime.getProfile(params.agentId);
    if (!profile) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `Unknown autonomy profile "${normalizeAgentId(params.agentId)}".`,
        ),
      );
      return;
    }
    const latest = runtime.getLatestManagedFlowSnapshot(params.agentId);
    const loopJob = await runtime.getLoopJob(params.agentId);
    respond(
      true,
      {
        sessionKey,
        profile,
        ...(latest?.flow ? { latestFlow: latest.flow } : {}),
        ...(latest?.seedTask ? { latestSeedTask: latest.seedTask } : {}),
        ...(loopJob ? { loopJob } : {}),
      },
      undefined,
    );
  },
  "autonomy.start": ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyStartParams, "autonomy.start", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const seedTask = resolveSeedTaskInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const started = runtime.startManagedFlow({
        agentId: params.agentId,
        ...(typeof params.goal === "string" ? { goal: params.goal } : {}),
        ...(typeof params.controllerId === "string" ? { controllerId: params.controllerId } : {}),
        ...(typeof params.currentStep === "string" ? { currentStep: params.currentStep } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
        ...(typeof params.notifyPolicy === "string" &&
        AUTONOMY_NOTIFY_POLICIES.has(params.notifyPolicy)
          ? { notifyPolicy: params.notifyPolicy }
          : {}),
        ...(typeof params.status === "string" && AUTONOMY_FLOW_STATUSES.has(params.status)
          ? { status: params.status }
          : {}),
        ...(seedTask !== undefined ? { seedTask } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          started,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.replay.submit": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomySubmitSandboxReplayParams,
        "autonomy.replay.submit",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const submitted = await runtime.submitSandboxReplay({
        agentId: params.agentId,
        replayPassed: params.replayPassed,
        qaPassed: params.qaPassed,
        ...(typeof params.flowId === "string" ? { flowId: params.flowId } : {}),
        ...(typeof params.auditPassed === "boolean" ? { auditPassed: params.auditPassed } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          submitted,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.cancel": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyCancelParams, "autonomy.cancel", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const cancelled = await runtime.cancelManagedFlow({
        agentId: params.agentId,
        ...(typeof params.flowId === "string" ? { flowId: params.flowId } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          cancelled,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.loop.show": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateAutonomyLoopShowParams, "autonomy.loop.show", respond)) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const loop = await runtime.showLoopJob({
        agentId: params.agentId,
      });
      respond(
        true,
        {
          sessionKey,
          loop,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.loop.upsert": async ({ params, respond, context }) => {
    if (
      !assertValidParams(params, validateAutonomyLoopUpsertParams, "autonomy.loop.upsert", respond)
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const upserted = await runtime.upsertLoopJob({
        agentId: params.agentId,
        ...(typeof params.everyMs === "number" ? { everyMs: params.everyMs } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          upserted,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.loop.reconcile": async ({ params, respond, context }) => {
    if (
      !assertValidParams(
        params,
        validateAutonomyLoopReconcileParams,
        "autonomy.loop.reconcile",
        respond,
      )
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const agentIds = resolveAgentIdsInput(params);
      const workspaceDirs = resolveWorkspaceDirsInput(params);
      const reconciled = await runtime.reconcileLoopJobs({
        ...(agentIds ? { agentIds } : {}),
        ...(workspaceDirs ? { workspaceDirs } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          reconciled,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
  "autonomy.loop.remove": async ({ params, respond, context }) => {
    if (
      !assertValidParams(params, validateAutonomyLoopRemoveParams, "autonomy.loop.remove", respond)
    ) {
      return;
    }
    const { sessionKey, runtime } = bindAutonomyRuntime({
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      cronService: context.cron,
    });
    try {
      const removed = await runtime.removeLoopJob({
        agentId: params.agentId,
        ...(typeof params.jobId === "string" ? { jobId: params.jobId } : {}),
      });
      respond(
        true,
        {
          sessionKey,
          removed,
        },
        undefined,
      );
    } catch (error) {
      respondAutonomyFailure(respond, error);
    }
  },
};
