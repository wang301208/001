import { Type } from "@sinclair/typebox";
import { createRuntimeAutonomy } from "../../plugins/runtime/runtime-autonomy.js";
import { createRuntimeTaskFlow } from "../../plugins/runtime/runtime-taskflow.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { stringEnum } from "../schema/typebox.js";
import {
  AUTONOMY_TOOL_DISPLAY_SUMMARY,
  describeAutonomyTool,
} from "../tool-description-presets.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const AUTONOMY_ACTIONS = [
  "list",
  "overview",
  "capabilities",
  "genesis_plan",
  "heal",
  "supervise",
  "bootstrap",
  "architecture",
  "history",
  "governance_proposals",
  "governance_reconcile",
  "show",
  "start",
  "cancel",
  "replay_submit",
  "loop_show",
  "loop_upsert",
  "loop_reconcile",
  "loop_remove",
] as const;
const AUTONOMY_NOTIFY_POLICIES = ["done_only", "state_changes", "silent"] as const;
const AUTONOMY_FLOW_STATUSES = ["queued", "running"] as const;
const AUTONOMY_SEED_TASK_RUNTIMES = ["subagent", "acp", "cli", "cron"] as const;
const AUTONOMY_SEED_TASK_STATUSES = ["queued", "running"] as const;
const AUTONOMY_HISTORY_MODES = ["heal", "reconcile"] as const;
const AUTONOMY_HISTORY_SOURCES = ["manual", "startup", "supervisor"] as const;
const AUTONOMY_GOVERNANCE_RECONCILE_MODES = ["apply_safe", "force_apply_all"] as const;
const AUTONOMY_SUPERVISOR_GOVERNANCE_MODES = [
  "none",
  ...AUTONOMY_GOVERNANCE_RECONCILE_MODES,
] as const;
const AUTONOMY_TOOL_MODES = [
  ...AUTONOMY_HISTORY_MODES,
  ...AUTONOMY_GOVERNANCE_RECONCILE_MODES,
] as const;

const AutonomyToolSchema = Type.Object({
  action: stringEnum(AUTONOMY_ACTIONS),
  agentId: Type.Optional(Type.String({ description: "Autonomy profile id." })),
  flowId: Type.Optional(
    Type.String({
      description: "Target managed flow id. Defaults to the latest flow for the profile.",
    }),
  ),
  jobId: Type.Optional(
    Type.String({
      description: "Target managed loop job id. Defaults to the latest loop job for the profile.",
    }),
  ),
  goal: Type.Optional(Type.String({ description: "Override the managed flow goal." })),
  controllerId: Type.Optional(
    Type.String({ description: "Override the autonomy controller id for the flow." }),
  ),
  currentStep: Type.Optional(
    Type.String({ description: "Override the current step recorded on the autonomy flow." }),
  ),
  replayPassed: Type.Optional(
    Type.Boolean({ description: "Sandbox replay verdict for replay_submit." }),
  ),
  qaPassed: Type.Optional(Type.Boolean({ description: "QA replay verdict for replay_submit." })),
  auditPassed: Type.Optional(
    Type.Boolean({ description: "Audit trace verdict for replay_submit." }),
  ),
  notifyPolicy: Type.Optional(stringEnum(AUTONOMY_NOTIFY_POLICIES)),
  status: Type.Optional(stringEnum(AUTONOMY_FLOW_STATUSES)),
  seedTaskEnabled: Type.Optional(
    Type.Boolean({ description: "Disable automatic seed task creation when false." }),
  ),
  seedTaskRuntime: Type.Optional(stringEnum(AUTONOMY_SEED_TASK_RUNTIMES)),
  seedTaskStatus: Type.Optional(stringEnum(AUTONOMY_SEED_TASK_STATUSES)),
  seedTaskLabel: Type.Optional(Type.String({ description: "Override the seed task label." })),
  seedTaskTask: Type.Optional(Type.String({ description: "Override the seed task body." })),
  agentIds: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description:
        "Autonomy profile ids for overview, capabilities, genesis_plan, heal, history, governance_proposals, or loop_reconcile. Defaults to all managed profiles.",
    }),
  ),
  workspaceDirs: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description:
        "Explicit workspace directories for start, capabilities, genesis_plan, heal, history, governance_proposals, loop_upsert, or loop_reconcile when scoped autonomy context is required.",
    }),
  ),
  teamId: Type.Optional(
    Type.String({
      description: "Target governed evolution team id for genesis_plan or supervise.",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 200, description: "Maximum history events to return." }),
  ),
  mode: Type.Optional(stringEnum(AUTONOMY_TOOL_MODES)),
  governanceMode: Type.Optional(stringEnum(AUTONOMY_SUPERVISOR_GOVERNANCE_MODES)),
  source: Type.Optional(stringEnum(AUTONOMY_HISTORY_SOURCES)),
  decisionNote: Type.Optional(
    Type.String({ description: "Decision note for governance_reconcile or supervise actions." }),
  ),
  everyMs: Type.Optional(
    Type.Integer({ minimum: 1, description: "Loop interval in milliseconds for loop_upsert." }),
  ),
  restartBlockedFlows: Type.Optional(
    Type.Boolean({
      description: "Restart blocked flows during supervise or heal passes when true.",
    }),
  ),
  includeCapabilityInventory: Type.Optional(
    Type.Boolean({
      description:
        "Include capability inventory in supervise results when true; defaults to runtime behavior.",
    }),
  ),
  includeGenesisPlan: Type.Optional(
    Type.Boolean({
      description:
        "Include genesis planning detail in supervise results when true; defaults to runtime behavior.",
    }),
  ),
  recordHistory: Type.Optional(
    Type.Boolean({
      description: "Record supervisor or heal activity into persistent fleet history when true.",
    }),
  ),
});

function resolveBoundAutonomyRuntime(params?: {
  agentSessionKey?: string;
  charterDir?: string;
  workspaceDir?: string;
}) {
  const sessionKey = params?.agentSessionKey?.trim();
  if (!sessionKey) {
    throw new ToolInputError("autonomy tool requires a bound agent session");
  }
  return {
    sessionKey,
    runtime: createRuntimeAutonomy({
      legacyTaskFlow: createRuntimeTaskFlow(),
      ...(params?.charterDir?.trim() ? { charterDir: params.charterDir.trim() } : {}),
    }).bindSession({
      sessionKey,
      ...(params?.workspaceDir?.trim() ? { workspaceDir: params.workspaceDir.trim() } : {}),
    }),
  };
}

function resolveRequesterAgentId(sessionKey: string): string | undefined {
  return parseAgentSessionKey(sessionKey)?.agentId;
}

function resolveWorkspaceDirsParam(params: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(params.workspaceDirs)) {
    return undefined;
  }
  const workspaceDirs = params.workspaceDirs.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return workspaceDirs.length > 0 ? workspaceDirs : undefined;
}

function resolveScopedWorkspaceDirs(
  params: Record<string, unknown>,
  defaultWorkspaceDir?: string,
): string[] | undefined {
  const explicitWorkspaceDirs = resolveWorkspaceDirsParam(params);
  if (explicitWorkspaceDirs?.length) {
    return explicitWorkspaceDirs;
  }
  const normalizedWorkspaceDir = defaultWorkspaceDir?.trim();
  return normalizedWorkspaceDir ? [normalizedWorkspaceDir] : undefined;
}

export function createAutonomyTool(opts?: {
  agentSessionKey?: string;
  workspaceDir?: string;
  charterDir?: string;
}): AnyAgentTool {
  return {
    label: "Autonomy",
    name: "autonomy",
    displaySummary: AUTONOMY_TOOL_DISPLAY_SUMMARY,
    description: describeAutonomyTool(),
    parameters: AutonomyToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const { sessionKey, runtime } = resolveBoundAutonomyRuntime({
        agentSessionKey: opts?.agentSessionKey,
        charterDir: opts?.charterDir,
        workspaceDir: opts?.workspaceDir,
      });
      const requesterAgentId = resolveRequesterAgentId(sessionKey);

      if (action === "list") {
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          profiles: runtime.listProfiles(),
        });
      }

      if (action === "overview") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const overview = await runtime.getFleetStatus({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          overview,
        });
      }

      if (action === "capabilities") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const capabilities = await runtime.getCapabilityInventory({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          capabilities,
        });
      }

      if (action === "genesis_plan") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const genesisPlan = await runtime.planGenesisWork({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(typeof params.teamId === "string" ? { teamId: params.teamId } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          genesisPlan,
        });
      }

      if (action === "heal") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const healed = await runtime.healFleet({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          ...(typeof params.restartBlockedFlows === "boolean"
            ? { restartBlockedFlows: params.restartBlockedFlows }
            : {}),
          ...(typeof params.recordHistory === "boolean"
            ? { recordHistory: params.recordHistory }
            : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          healed,
        });
      }

      if (action === "supervise") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const governanceMode =
          typeof params.governanceMode === "string" &&
          (params.governanceMode === "none" ||
            params.governanceMode === "apply_safe" ||
            params.governanceMode === "force_apply_all")
            ? params.governanceMode
            : undefined;
        const supervised = await runtime.superviseFleet({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
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
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          supervised,
        });
      }

      if (action === "bootstrap") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const governanceMode =
          typeof params.governanceMode === "string" &&
          (params.governanceMode === "none" ||
            params.governanceMode === "apply_safe" ||
            params.governanceMode === "force_apply_all")
            ? params.governanceMode
            : undefined;
        const bootstrapped = await runtime.bootstrapFleet({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
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
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          bootstrapped,
        });
      }

      if (action === "architecture") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const governanceMode =
          typeof params.governanceMode === "string" &&
          (params.governanceMode === "none" ||
            params.governanceMode === "apply_safe" ||
            params.governanceMode === "force_apply_all")
            ? params.governanceMode
            : undefined;
        const architectureReadiness = await runtime.getArchitectureReadiness({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
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
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          architectureReadiness,
        });
      }

      if (action === "history") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const history = await runtime.getFleetHistory({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
          ...(params.mode === "heal" || params.mode === "reconcile" ? { mode: params.mode } : {}),
          ...(params.source === "manual" ||
          params.source === "startup" ||
          params.source === "supervisor"
            ? { source: params.source }
            : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          history,
        });
      }

      if (action === "governance_proposals") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const governanceProposals = await runtime.synthesizeGovernanceProposals({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          governanceProposals,
        });
      }

      if (action === "governance_reconcile") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const governanceReconciled = await runtime.reconcileGovernanceProposals({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          ...(params.mode === "apply_safe" || params.mode === "force_apply_all"
            ? { mode: params.mode }
            : {}),
          ...(typeof params.decisionNote === "string" ? { decisionNote: params.decisionNote } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          governanceReconciled,
        });
      }

      if (action === "loop_reconcile") {
        const agentIds = Array.isArray(params.agentIds)
          ? params.agentIds.filter((value): value is string => typeof value === "string")
          : undefined;
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const reconciled = await runtime.reconcileLoopJobs({
          ...(agentIds?.length ? { agentIds } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          reconciled,
        });
      }

      const agentId = readStringParam(params, "agentId", {
        required: true,
        label: "agentId",
      });

      if (action === "show") {
        const profile = runtime.getProfile(agentId);
        if (!profile) {
          throw new ToolInputError(`Unknown autonomy profile "${agentId}".`);
        }
        const latest = runtime.getLatestManagedFlowSnapshot(agentId);
        const loopJob = await runtime.getLoopJob(agentId);
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          profile,
          ...(latest?.flow ? { latestFlow: latest.flow } : {}),
          ...(latest?.seedTask ? { latestSeedTask: latest.seedTask } : {}),
          ...(loopJob ? { loopJob } : {}),
        });
      }

      if (action === "start") {
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const started = runtime.startManagedFlow({
          agentId,
          goal: readStringParam(params, "goal"),
          controllerId: readStringParam(params, "controllerId"),
          currentStep: readStringParam(params, "currentStep"),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          notifyPolicy: readStringParam(params, "notifyPolicy") as
            | (typeof AUTONOMY_NOTIFY_POLICIES)[number]
            | undefined,
          status: readStringParam(params, "status") as
            | (typeof AUTONOMY_FLOW_STATUSES)[number]
            | undefined,
          seedTask:
            typeof params.seedTaskEnabled === "boolean" &&
            params.seedTaskEnabled === false &&
            params.seedTaskRuntime === undefined &&
            params.seedTaskStatus === undefined &&
            params.seedTaskLabel === undefined &&
            params.seedTaskTask === undefined
              ? false
              : {
                  enabled:
                    typeof params.seedTaskEnabled === "boolean"
                      ? params.seedTaskEnabled
                      : undefined,
                  runtime: readStringParam(params, "seedTaskRuntime") as
                    | (typeof AUTONOMY_SEED_TASK_RUNTIMES)[number]
                    | undefined,
                  status: readStringParam(params, "seedTaskStatus") as
                    | (typeof AUTONOMY_SEED_TASK_STATUSES)[number]
                    | undefined,
                  label: readStringParam(params, "seedTaskLabel"),
                  task: readStringParam(params, "seedTaskTask"),
                },
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          started,
        });
      }

      if (action === "cancel") {
        const cancelled = await runtime.cancelManagedFlow({
          agentId,
          flowId: readStringParam(params, "flowId"),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          cancelled,
        });
      }

      if (action === "replay_submit") {
        if (typeof params.replayPassed !== "boolean") {
          throw new ToolInputError("autonomy replay_submit requires boolean replayPassed");
        }
        if (typeof params.qaPassed !== "boolean") {
          throw new ToolInputError("autonomy replay_submit requires boolean qaPassed");
        }
        const submitted = await runtime.submitSandboxReplay({
          agentId,
          flowId: readStringParam(params, "flowId"),
          replayPassed: params.replayPassed,
          qaPassed: params.qaPassed,
          ...(typeof params.auditPassed === "boolean" ? { auditPassed: params.auditPassed } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          submitted,
        });
      }

      if (action === "loop_show") {
        const loop = await runtime.showLoopJob({
          agentId,
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          loop,
        });
      }

      if (action === "loop_upsert") {
        const workspaceDirs = resolveScopedWorkspaceDirs(params, opts?.workspaceDir);
        const upserted = await runtime.upsertLoopJob({
          agentId,
          ...(typeof params.everyMs === "number" ? { everyMs: params.everyMs } : {}),
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          upserted,
        });
      }

      if (action === "loop_remove") {
        const removed = await runtime.removeLoopJob({
          agentId,
          jobId: readStringParam(params, "jobId"),
        });
        return jsonResult({
          action,
          sessionKey,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          removed,
        });
      }

      throw new ToolInputError(`Unknown autonomy action "${action}".`);
    },
  };
}
