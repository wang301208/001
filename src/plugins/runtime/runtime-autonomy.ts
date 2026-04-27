import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "../../agents/agent-scope.js";
import { getRuntimeConfigSnapshot, loadConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/paths.js";
import {
  canonicalizeMainSessionAlias,
  loadSessionStore,
  resolveAgentMainSessionKey,
  resolveSessionStoreEntry,
  resolveStorePath,
} from "../../config/sessions.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { CronService } from "../../cron/service.js";
import type { CronServiceContract } from "../../cron/service-contract.js";
import { resolveCronStorePath } from "../../cron/store.js";
import type { CronJob } from "../../cron/types.js";
import {
  listGovernanceCharterAgentBlueprints,
  resolveGovernanceCharterAgentBlueprint,
} from "../../governance/charter-agents.js";
import {
  getGovernanceCapabilityInventory,
  planGovernanceGenesisWork,
  type GovernanceCapabilityGap,
  type GovernanceGenesisPlanResult,
  type GovernanceGenesisPlanStage,
} from "../../governance/capability-registry.js";
import {
  createSandboxUniverseController,
  createSandboxUniverseReplayRunner,
  planSandboxUniverseExperiment,
  runSandboxUniverseReplayRunner,
} from "../../governance/sandbox-universe.js";
import { loadGovernanceCharter } from "../../governance/charter-runtime.js";
import {
  synthesizeGovernanceAutonomyProposals,
  type GovernanceAutonomyProposalSynthesisResult,
} from "../../governance/autonomy-proposals.js";
import {
  getGovernanceOverview,
  reconcileGovernanceProposals as reconcileControlPlaneGovernanceProposals,
} from "../../governance/control-plane.js";
import {
  resolveAgentGovernanceRuntimeContract,
  type AgentGovernanceRuntimeContract,
} from "../../governance/runtime-contract.js";
import { createAgentGovernanceRuntimeSnapshot } from "../../governance/runtime-snapshot.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { isRecord } from "../../utils.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.shared.js";
import { mapTaskFlowDetail, mapTaskRunDetail } from "../../tasks/task-domain-views.js";
import { isTerminalTaskStatus } from "../../tasks/task-executor-policy.js";
import { getFlowTaskSummary } from "../../tasks/task-executor.js";
import { getTaskFlowByIdForOwner } from "../../tasks/task-flow-owner-access.js";
import type { JsonValue } from "../../tasks/task-flow-registry.types.js";
import { listTasksForFlowId } from "../../tasks/runtime-internal.js";
import {
  appendAutonomyFleetHistoryEvent,
  listAutonomyFleetHistory,
} from "./runtime-autonomy.telemetry.js";
import type {
  ManagedTaskFlowAutonomyProjectRuntime,
  PluginRuntimeTaskFlow,
} from "./runtime-taskflow.types.js";
import type {
  AutonomyAgentProfile,
  AutonomyBootstrapTemplate,
  AutonomyCancelManagedFlowParams,
  AutonomyCancelManagedFlowResult,
  AutonomyCapabilityInventoryParams,
  AutonomyCapabilityInventoryResult,
  AutonomyFleetHistoryEntry,
  AutonomyFleetHistoryEvent,
  AutonomyFleetHistoryParams,
  AutonomyFleetHistoryResult,
  AutonomyFleetHistorySource,
  AutonomyFleetHistoryTotals,
  AutonomyFleetHealEntry,
  AutonomyFleetHealParams,
  AutonomyFleetHealResult,
  AutonomyFleetStatusEntry,
  AutonomyFleetStatusHealth,
  AutonomyFleetStatusParams,
  AutonomyFleetStatusResult,
  AutonomyLoopJobSnapshot,
  AutonomyLoopReconcileParams,
  AutonomyLoopReconcileResult,
  AutonomyLoopRemoveParams,
  AutonomyLoopRemoveResult,
  AutonomyLoopShowParams,
  AutonomyLoopShowResult,
  AutonomyLoopTemplate,
  AutonomyLoopUpsertParams,
  AutonomyLoopUpsertResult,
  AutonomyGovernanceReconcileParams,
  AutonomyGovernanceReconcileResult,
  AutonomyGovernanceProposalsParams,
  AutonomyGenesisPlanParams,
  AutonomyGenesisPlanResult,
  AutonomyManagedFlowSnapshot,
  AutonomySeedTaskTemplate,
  AutonomySubmitSandboxReplayParams,
  AutonomySubmitSandboxReplayResult,
  AutonomySupervisorGovernanceMode,
  AutonomySupervisorParams,
  AutonomySupervisorResult,
  AutonomyStartManagedFlowParams,
  AutonomyStartManagedFlowResult,
  BoundAutonomyRuntime,
  PluginRuntimeAutonomy,
} from "./runtime-autonomy.types.js";

const AUTONOMY_PREFERRED_AGENT_ORDER = [
  "founder",
  "strategist",
  "algorithmist",
  "librarian",
  "sentinel",
  "archaeologist",
  "tdd_developer",
  "qa",
  "publisher",
  "executor",
  "sovereignty_auditor",
] as const;
const log = createSubsystemLogger("plugins/runtime/autonomy");
const AUTONOMY_LOOP_MODE = "managed-flow" as const;
const ACTIVE_AUTONOMY_FLOW_STATUSES = new Set(["queued", "running", "waiting", "blocked"]);
const TERMINAL_AUTONOMY_FLOW_STATUSES = new Set(["succeeded", "failed", "cancelled", "lost"]);
const AUTONOMY_GENESIS_STAGE_BY_AGENT_ID = {
  sentinel: "gap_detection",
  archaeologist: "root_cause_analysis",
  tdd_developer: "implementation",
  qa: "qa_and_replay",
  publisher: "promotion_or_rollback",
  librarian: "registration",
} as const;

function resolveAutonomySandboxStateDir(): string {
  return resolveStateDir(process.env);
}

type BoundTaskFlowRuntime = ReturnType<PluginRuntimeTaskFlow["bindSession"]>;
type FleetProfileRuntimeState = {
  profile: AutonomyAgentProfile;
  profileSessionKey: string;
  taskFlow: BoundTaskFlowRuntime;
  latest?: AutonomyManagedFlowSnapshot;
  loops: CronJob[];
  entry: AutonomyFleetStatusEntry;
};
type ManagedAutonomyFlowAutomationMode = "manual" | "autonomous";
type ManagedAutonomyTaskTemplate = AutonomySeedTaskTemplate & {
  progressSummary?: string | null;
};
type ManagedAutonomyFlowPlan = {
  goal: string;
  currentStep?: string;
  stateJson?: JsonValue | null;
  tasks?: ManagedAutonomyTaskTemplate[];
};

const noopCronLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function assertSessionKey(sessionKey: string | undefined, errorMessage: string): string {
  const normalized = sessionKey?.trim();
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function resolveRuntimeConfig(): OpenClawConfig {
  return getRuntimeConfigSnapshot() ?? loadConfig();
}

function normalizeWorkspaceDirList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))).toSorted(
    (left, right) => left.localeCompare(right),
  );
}

function resolveExistingWorkspaceDir(workspaceDir: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(workspaceDir);
  if (!normalized) {
    return undefined;
  }
  try {
    return fs.statSync(normalized).isDirectory() ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function resolveSessionWorkspaceDir(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
}): string | undefined {
  const normalizedSessionKey = normalizeOptionalString(params.sessionKey);
  if (!normalizedSessionKey) {
    return undefined;
  }
  const parsed = parseAgentSessionKey(normalizedSessionKey);
  if (!parsed?.agentId) {
    return undefined;
  }
  const agentId = normalizeAgentId(parsed.agentId);
  const storePath = resolveStorePath(params.cfg.session?.store, { agentId });
  try {
    const store = loadSessionStore(storePath);
    const canonicalSessionKey = canonicalizeMainSessionAlias({
      cfg: params.cfg,
      agentId,
      sessionKey: normalizedSessionKey.toLowerCase(),
    });
    const entry = resolveSessionStoreEntry({
      store,
      sessionKey: canonicalSessionKey,
    }).existing;
    return resolveExistingWorkspaceDir(entry?.spawnedWorkspaceDir);
  } catch {
    return undefined;
  }
}

function resolveBoundAutonomyWorkspaceDir(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  workspaceDir?: string;
}): string | undefined {
  const explicitWorkspaceDir = resolveExistingWorkspaceDir(params.workspaceDir);
  if (explicitWorkspaceDir) {
    return explicitWorkspaceDir;
  }
  return resolveSessionWorkspaceDir({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
  });
}

function resolveAutonomyWorkspaceDirs(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  agentIds?: string[];
  workspaceDirs?: string[];
  boundWorkspaceDir?: string;
}): string[] | undefined {
  const explicitWorkspaceDirs = normalizeWorkspaceDirList(params.workspaceDirs);
  if (explicitWorkspaceDirs.length > 0) {
    return explicitWorkspaceDirs;
  }
  const boundWorkspaceDir = resolveExistingWorkspaceDir(params.boundWorkspaceDir);
  if (boundWorkspaceDir) {
    return [boundWorkspaceDir];
  }

  const defaultWorkspaceConfigured = Boolean(params.cfg.agents?.defaults?.workspace?.trim());
  const defaultWorkspaceDir = defaultWorkspaceConfigured
    ? resolveExistingWorkspaceDir(
        resolveAgentWorkspaceDir(params.cfg, resolveDefaultAgentId(params.cfg)),
      )
    : undefined;
  const candidateAgentIds = normalizeWorkspaceDirList([
    ...normalizeWorkspaceDirList(params.agentIds),
    resolveSessionAgentId({
      sessionKey: params.sessionKey,
      config: params.cfg,
    }),
  ]);
  const inferredWorkspaceDirs = normalizeWorkspaceDirList(
    candidateAgentIds.flatMap((agentId) => {
      const configuredWorkspace = resolveAgentConfig(params.cfg, agentId)?.workspace?.trim();
      const resolvedWorkspaceDir = resolveExistingWorkspaceDir(
        resolveAgentWorkspaceDir(params.cfg, agentId),
      );
      if (resolvedWorkspaceDir) {
        return [resolvedWorkspaceDir];
      }
      if (!configuredWorkspace && defaultWorkspaceDir) {
        return [defaultWorkspaceDir];
      }
      return [];
    }),
  );
  return inferredWorkspaceDirs.length > 0 ? inferredWorkspaceDirs : undefined;
}

function buildRecommendedGoals(params: {
  agentId: string;
  title?: string;
  missionPrimary?: string;
}): string[] {
  switch (params.agentId) {
    case "founder":
      return [
        "Scan organization performance and queue structural evolution work.",
        "Review capability coverage, collaborator topology, and external horizon pressure.",
      ];
    case "strategist":
      return [
        "Review recent execution history and extract reusable strategic principles.",
        "Identify repeated failure patterns and queue strategy remediation experiments.",
      ];
    case "algorithmist":
      return [
        "Review algorithmic bottlenecks, benchmark signals, and decision-quality regressions across the governed runtime.",
        "Queue replay-backed research cycles that improve retrieval, scheduling, compaction, and evaluation algorithms.",
      ];
    case "librarian":
      return [
        "Audit capability inventory, stale assets, and missing retrieval coverage.",
        "Curate skills and plugins, then queue maintenance or indexing work.",
      ];
    case "sentinel":
      return [
        "Scan runtime telemetry for governed capability gaps, regressions, and emerging risks.",
        "Open ranked evolution signals before repeated failures harden into system debt.",
      ];
    case "archaeologist":
      return [
        "Turn the highest-value failure signal into a concrete root-cause map and change plan.",
        "Trace real execution paths and isolate the smallest governed repair surface.",
      ];
    case "tdd_developer":
      return [
        "Implement or repair the highest-priority governed capability with tests and bounded blast radius.",
        "Convert an approved change plan into a candidate patch, validation delta, and handoff package.",
      ];
    case "qa":
      return [
        "Validate governed candidate changes through tests, replay, and regression evidence.",
        "Block weak promotions and open follow-up incidents when evidence is incomplete.",
      ];
    case "publisher":
      return [
        "Promote validated governed assets with manifest completeness, audit attribution, and rollback readiness.",
        "Reject incomplete promotion packages and keep the capability registry coherent.",
      ];
    case "executor":
      return [
        "Decompose the current high-level goal into a governed task graph and dispatch the safest available capability mix.",
        "Drive execution forward, recover from stalls, and escalate true capability gaps back into evolution.",
      ];
    case "sovereignty_auditor":
      return [
        "Watch for audit drift, boundary violations, and governance integrity failures before they propagate.",
        "Triangulate missing artifacts, critical findings, and freeze posture, then queue incident or clearance actions.",
      ];
    default:
      return [
        params.missionPrimary || `Bootstrap autonomy for ${params.title ?? params.agentId}.`,
      ];
  }
}

function buildDefaultCurrentStep(agentId: string): string {
  switch (agentId) {
    case "founder":
      return "scan-organization";
    case "strategist":
      return "review-execution-history";
    case "algorithmist":
      return "algorithm.signal_review";
    case "librarian":
      return "audit-capability-inventory";
    case "sentinel":
      return "scan-runtime-telemetry";
    case "archaeologist":
      return "trace-root-cause";
    case "tdd_developer":
      return "write-test-and-implement";
    case "qa":
      return "run-validation";
    case "publisher":
      return "promote-governed-asset";
    case "executor":
      return "decompose-goal";
    case "sovereignty_auditor":
      return "sovereignty.audit_snapshot";
    default:
      return "bootstrap";
  }
}

function joinInline(values: string[]): string | undefined {
  return values.length > 0 ? values.join(", ") : undefined;
}

function resolveDefaultLoopEveryMs(agentId: string): number {
  switch (agentId) {
    case "founder":
      return 6 * 60 * 60 * 1000;
    case "strategist":
      return 3 * 60 * 60 * 1000;
    case "algorithmist":
      return 4 * 60 * 60 * 1000;
    case "librarian":
      return 12 * 60 * 60 * 1000;
    case "sentinel":
      return 60 * 60 * 1000;
    case "archaeologist":
      return 2 * 60 * 60 * 1000;
    case "tdd_developer":
      return 45 * 60 * 1000;
    case "qa":
      return 90 * 60 * 1000;
    case "publisher":
      return 2 * 60 * 60 * 1000;
    case "executor":
      return 30 * 60 * 1000;
    case "sovereignty_auditor":
      return 30 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

function buildLoopMessage(params: {
  agentId: string;
  title?: string;
}): string {
  const role = params.title ?? params.agentId;
  switch (params.agentId) {
    case "founder":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        'Use the autonomy tool to inspect the founder profile and the latest managed flow on the bound control session.',
        "If there is no active managed flow, or the latest flow is blocked, failed, cancelled, or otherwise terminal, start a fresh managed flow from the governed default goal unless current evidence justifies a better one.",
        "If the current flow is active, inspect recent tasks and drive concrete evolution work forward instead of stopping at commentary.",
        "If machine-determinable governance gaps exist, use the autonomy governance proposal synthesis path to queue pending charter proposals for review instead of leaving the gap as commentary only.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "strategist":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the strategist profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on strategy retrospectives and execution remediation.",
        "If a flow is already active, continue it by extracting reusable strategy principles and queueing concrete follow-up work.",
        "When deterministic governance drift is visible, trigger autonomy governance proposal synthesis so the governance layer receives pending proposals instead of passive notes.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "algorithmist":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the algorithmist profile, capability inventory, and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on benchmark review, algorithm hypothesis generation, replay planning, and promotion evidence.",
        "If a flow is already active, continue it by turning observed bottlenecks into concrete algorithm research tasks instead of passive analysis notes.",
        "Use sandbox planning when the next candidate change touches governed decision engines or promotion gates.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "librarian":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the librarian profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on capability inventory, indexing gaps, and asset maintenance.",
        "If a flow is already active, continue it with concrete curation or maintenance work instead of passive inspection only.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "sentinel":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the sentinel profile, fleet telemetry, and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on detecting governed gaps, regressions, and risk signals.",
        "If a flow is already active, continue it by ranking signals and queueing actionable follow-up work instead of passive monitoring.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "archaeologist":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the archaeologist profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on root-cause isolation, evidence mapping, and bounded change planning.",
        "If a flow is already active, continue it by producing concrete causal maps and implementation handoffs instead of open-ended analysis.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "tdd_developer":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the tdd_developer profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on test-first candidate implementation inside the governed project boundary.",
        "If a flow is already active, continue it by landing the smallest validated candidate patch and handing the result to QA.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "qa":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the qa profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on validation planning, regression testing, and replay evidence.",
        "If a flow is already active, continue it by producing acceptance or rejection evidence instead of commentary-only notes.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "publisher":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the publisher profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on governed promotion readiness, manifest completeness, and rollback posture.",
        "If a flow is already active, continue it by promoting validated assets or rejecting incomplete packages with explicit reasons.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "executor":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the executor profile and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on goal decomposition, dispatch, recovery, and delivery.",
        "If a flow is already active, continue it by driving the task graph forward and escalating true missing-capability gaps back into evolution.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    case "sovereignty_auditor":
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect governance overview, audit facts, freeze posture, and the latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow focused on sovereignty watch, breach triage, and incident packaging.",
        "If a flow is already active, continue it by converting deterministic governance drift into freeze, incident, or clearance actions instead of commentary-only warnings.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
    default:
      return [
        `Run one governed autonomy control cycle for ${role}.`,
        "Inspect the profile and latest managed flow through the autonomy tool.",
        "If no active managed flow exists, or the latest one is blocked or terminal, start a fresh managed flow from the governed default goal.",
        "Stay inside the charter and finish with a concise operator-facing status summary.",
      ].join("\n");
  }
}

function buildSeedTaskTemplate(params: {
  agentId: string;
  title?: string;
  missionPrimary?: string;
  contract: AgentGovernanceRuntimeContract;
}): AutonomySeedTaskTemplate {
  const collaborators = joinInline(params.contract.collaborators);
  const hooks = joinInline(params.contract.runtimeHooks);
  const suffixParts = [
    collaborators ? `Collaborators: ${collaborators}.` : undefined,
    hooks ? `Hooks: ${hooks}.` : undefined,
  ].filter((value): value is string => Boolean(value));
  const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(" ")}` : "";

  switch (params.agentId) {
    case "founder":
      return {
        runtime: "cli",
        status: "queued",
        label: "Organization evolution scan",
        task:
          "Review organization performance, missing capability edges, and structural upgrade opportunities. Queue concrete evolution work." +
          suffix,
      };
    case "strategist":
      return {
        runtime: "cli",
        status: "queued",
        label: "Strategy retrospective",
        task:
          "Review recent execution outcomes, extract reusable strategy principles, and queue remediation experiments for recurring failure patterns." +
          suffix,
      };
    case "algorithmist":
      return {
        runtime: "cli",
        status: "queued",
        label: "Algorithm benchmark review",
        task:
          "Review algorithm telemetry, benchmark gaps, and replay opportunities. Queue the next governed research cycle with explicit promotion evidence." +
          suffix,
      };
    case "librarian":
      return {
        runtime: "cli",
        status: "queued",
        label: "Capability inventory audit",
        task:
          "Audit skill and plugin inventory, identify stale or missing assets, and queue maintenance work to improve retrieval and reuse." +
          suffix,
      };
    case "sentinel":
      return {
        runtime: "cli",
        status: "queued",
        label: "Governed gap scan",
        task:
          "Scan runtime behavior for governed capability gaps, regression signals, and repeat failures. Open ranked evolution signals with concrete evidence." +
          suffix,
      };
    case "archaeologist":
      return {
        runtime: "cli",
        status: "queued",
        label: "Root-cause excavation",
        task:
          "Trace the highest-value governed failure path, map dependencies, and produce an actionable change plan with explicit evidence." +
          suffix,
      };
    case "tdd_developer":
      return {
        runtime: "cli",
        status: "queued",
        label: "Candidate implementation cycle",
        task:
          "Write or update validation first where practical, implement the bounded governed fix, and prepare a candidate handoff for QA." +
          suffix,
      };
    case "qa":
      return {
        runtime: "cli",
        status: "queued",
        label: "Governed validation pass",
        task:
          "Validate the current candidate through tests, replay, and regression checks. Produce an acceptance or rejection record with evidence." +
          suffix,
      };
    case "publisher":
      return {
        runtime: "cli",
        status: "queued",
        label: "Promotion readiness review",
        task:
          "Verify manifest completeness, audit attribution, and rollback readiness before promoting a governed asset into the capability layer." +
          suffix,
      };
    case "executor":
      return {
        runtime: "cli",
        status: "queued",
        label: "Goal decomposition run",
        task:
          "Decompose the current goal into a governed task graph, select the best available capabilities, and drive execution toward delivery." +
          suffix,
      };
    case "sovereignty_auditor":
      return {
        runtime: "cli",
        status: "queued",
        label: "Sovereignty watch pass",
        task:
          "Review governance integrity, audit continuity, and freeze posture. Escalate or clear deterministic sovereignty issues with explicit evidence." +
          suffix,
      };
    default:
      return {
        runtime: "cli",
        status: "queued",
        label: `${params.title ?? params.agentId} bootstrap`,
        task:
          `${params.missionPrimary || `Bootstrap autonomy for ${params.title ?? params.agentId}.`}` +
          suffix,
      };
  }
}

function formatWorkspaceScopeInline(workspaceDirs: string[] | undefined): string | undefined {
  const normalizedWorkspaceDirs = normalizeWorkspaceDirList(workspaceDirs);
  return normalizedWorkspaceDirs.length > 0 ? normalizedWorkspaceDirs.join(", ") : undefined;
}

function resolvePrimaryWorkspaceDir(
  workspaceDirs: string[] | undefined,
): string | undefined {
  return normalizeWorkspaceDirList(workspaceDirs)[0];
}

function augmentSeedTaskTextWithWorkspaceScope(
  task: string,
  workspaceDirs: string[] | undefined,
): string {
  const workspaceScope = formatWorkspaceScopeInline(workspaceDirs);
  if (!workspaceScope) {
    return task;
  }
  return [
    task,
    `Workspace scope: ${workspaceScope}.`,
    "Treat these directories as the active project boundary for this autonomy run.",
  ].join("\n");
}

function augmentLoopMessageWithWorkspaceScope(
  message: string,
  workspaceDirs: string[] | undefined,
): string {
  const workspaceScope = formatWorkspaceScopeInline(workspaceDirs);
  if (!workspaceScope) {
    return message;
  }
  return [
    message,
    `Workspace scope: ${workspaceScope}.`,
    "Treat these directories as the active project boundary for this autonomy control cycle.",
  ].join("\n");
}

function buildLoopTemplate(params: {
  agentId: string;
  title?: string;
}): AutonomyLoopTemplate {
  return {
    mode: AUTONOMY_LOOP_MODE,
    name: `Autonomy Loop: ${params.title ?? params.agentId}`,
    description: `Governed autonomy control loop for ${params.title ?? params.agentId}.`,
    schedule: {
      kind: "every",
      everyMs: resolveDefaultLoopEveryMs(params.agentId),
    },
    sessionTarget: "isolated",
    wakeMode: "now",
    message: buildLoopMessage(params),
  };
}

function buildBootstrapTemplate(params: {
  agentId: string;
  title?: string;
  missionPrimary?: string;
  contract: AgentGovernanceRuntimeContract;
}): AutonomyBootstrapTemplate {
  const recommendedGoals = buildRecommendedGoals(params);
  return {
    controllerId: `runtime.autonomy/${params.agentId}`,
    defaultGoal: recommendedGoals[0] ?? params.missionPrimary ?? `Bootstrap ${params.agentId}.`,
    defaultCurrentStep: buildDefaultCurrentStep(params.agentId),
    recommendedGoals,
    seedTask: buildSeedTaskTemplate(params),
    loop: buildLoopTemplate({
      agentId: params.agentId,
      title: params.title,
    }),
  };
}

function resolveAutonomyStateJson(params: {
  profile: AutonomyAgentProfile;
  controllerId: string;
  goal: string;
  currentStep?: string | null;
  workspaceDirs?: string[];
  stateJson?: JsonValue | null;
}): JsonValue {
  const normalizedWorkspaceDirs = normalizeWorkspaceDirList(params.workspaceDirs);
  const existingAutonomyState =
    isRecord(params.stateJson) && isRecord(params.stateJson.autonomy)
      ? params.stateJson.autonomy
      : undefined;
  const autonomyState = {
    ...(existingAutonomyState ?? {}),
    agentId: params.profile.id,
    controllerId: params.controllerId,
    goal: params.goal,
    currentStep: params.currentStep ?? params.profile.bootstrap.defaultCurrentStep,
    layer: params.profile.layer ?? null,
    missionPrimary: params.profile.missionPrimary ?? null,
    collaborators: params.profile.collaborators,
    reportsTo: params.profile.reportsTo,
    runtimeHooks: params.profile.runtimeHooks,
    mutationAllow: params.profile.mutationAllow,
    mutationDeny: params.profile.mutationDeny,
    networkDefault: params.profile.networkDefault ?? null,
    networkConditions: params.profile.networkConditions,
    recommendedGoals: params.profile.bootstrap.recommendedGoals,
    workspaceDirs: normalizedWorkspaceDirs,
    primaryWorkspaceDir: resolvePrimaryWorkspaceDir(normalizedWorkspaceDirs) ?? null,
  } satisfies JsonValue;
  const baseState = {
    autonomy: autonomyState,
  } satisfies JsonValue;
  if (params.stateJson === null) {
    return baseState;
  }
  if (isRecord(params.stateJson)) {
    return {
      ...params.stateJson,
      autonomy: autonomyState,
    };
  }
  return params.stateJson ?? baseState;
}

function mergeAutonomyStateJson(baseState: JsonValue, extraState: JsonValue | null | undefined): JsonValue {
  if (!extraState) {
    return baseState;
  }
  if (!isRecord(baseState) || !isRecord(extraState)) {
    return extraState;
  }
  const baseAutonomy = isRecord(baseState.autonomy) ? baseState.autonomy : undefined;
  const extraAutonomy = isRecord(extraState.autonomy) ? extraState.autonomy : undefined;
  const merged = {
    ...baseState,
    ...extraState,
  };
  if (!baseAutonomy && !extraAutonomy) {
    return merged;
  }
  return {
    ...merged,
    autonomy: {
      ...(baseAutonomy ?? {}),
      ...(extraAutonomy ?? {}),
    },
  };
}

function resolveGenesisAssignedStageId(
  agentId: string,
): (typeof AUTONOMY_GENESIS_STAGE_BY_AGENT_ID)[keyof typeof AUTONOMY_GENESIS_STAGE_BY_AGENT_ID] | undefined {
  return AUTONOMY_GENESIS_STAGE_BY_AGENT_ID[
    normalizeAgentId(agentId) as keyof typeof AUTONOMY_GENESIS_STAGE_BY_AGENT_ID
  ];
}

function createGenesisActionTaskTemplates(params: {
  profile: AutonomyAgentProfile;
  stage: GovernanceGenesisPlanStage;
  plan: GovernanceGenesisPlanResult;
}): ManagedAutonomyTaskTemplate[] {
  const actions = params.stage.actions.length > 0 ? params.stage.actions : [`advance ${params.stage.id}`];
  return actions.map((action, index) => ({
    runtime: "cli",
    status: "queued",
    label: index === 0 ? params.stage.title : `${params.stage.title} Action ${index + 1}`,
    progressSummary:
      params.stage.status === "blocked"
        ? "blocked by governance or missing-role dependencies"
        : params.stage.status === "waiting"
          ? "waiting for upstream genesis stages"
          : "ready for governed execution",
    task: [
      `Run the governed Genesis Team stage for ${params.profile.name ?? params.profile.id}.`,
      `Stage: ${params.stage.title} (${params.stage.id})`,
      `Goal: ${params.stage.goal}`,
      `Action: ${action}`,
      params.stage.dependsOn.length > 0 ? `Depends on: ${params.stage.dependsOn.join(", ")}` : undefined,
      params.stage.inputRefs.length > 0 ? `Inputs: ${params.stage.inputRefs.join(", ")}` : undefined,
      params.stage.outputRefs.length > 0
        ? `Expected outputs: ${params.stage.outputRefs.join(", ")}`
        : undefined,
      params.plan.focusGapIds.length > 0
        ? `Focus gaps: ${params.plan.focusGapIds.join(", ")}`
        : "Focus gaps: none",
      params.plan.blockers.length > 0
        ? `Current blockers: ${params.plan.blockers.join("; ")}`
        : "Current blockers: none",
      "Leave machine-verifiable artifacts that can be consumed by the next governed Genesis stage.",
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
  }));
}

function buildGenesisManagedFlowPlan(params: {
  profile: AutonomyAgentProfile;
  goal: string;
  workspaceDirs?: string[];
  cfg: OpenClawConfig;
  charterDir?: string;
}): ManagedAutonomyFlowPlan | undefined {
  const assignedStageId = resolveGenesisAssignedStageId(params.profile.id);
  if (!assignedStageId) {
    return undefined;
  }
  const plan = planGovernanceGenesisWork({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  const stage = plan.stages.find((entry) => entry.id === `genesis.${assignedStageId}`);
  if (!stage) {
    return undefined;
  }
  const sandboxExperiment = planSandboxUniverseExperiment({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    requestedByAgentId: params.profile.id,
    observedAt: plan.observedAt,
    targetKind: "capability",
    targetId: stage.id,
    genesisPlan: plan,
  });
  const sandboxStateDir = resolveAutonomySandboxStateDir();
  const sandboxController = createSandboxUniverseController({
    plan: sandboxExperiment,
    observedAt: plan.observedAt,
    stateDir: sandboxStateDir,
  });
  const sandboxReplayRunner = createSandboxUniverseReplayRunner({
    plan: sandboxExperiment,
    controller: sandboxController,
    observedAt: plan.observedAt,
    producedByAgentId: params.profile.id,
    stateDir: sandboxStateDir,
  });
  const projectState = {
    kind: "genesis_stage",
    teamId: plan.teamId,
    teamTitle: plan.teamTitle ?? null,
    mode: plan.mode,
    stage: {
      id: stage.id,
      title: stage.title,
      ownerAgentId: stage.ownerAgentId,
      status: stage.status,
      goal: stage.goal,
      dependsOn: [...stage.dependsOn],
      inputRefs: [...stage.inputRefs],
      outputRefs: [...stage.outputRefs],
      actions: [...stage.actions],
      rationale: stage.rationale ?? null,
    },
    focusGapIds: [...plan.focusGapIds],
    blockers: [...plan.blockers],
    stageGraph: plan.stages.map((entry) => ({
      id: entry.id,
      title: entry.title,
      ownerAgentId: entry.ownerAgentId,
      status: entry.status,
      dependsOn: [...entry.dependsOn],
    })),
    ...(plan.projectBlueprint ? { projectBlueprint: plan.projectBlueprint } : {}),
    sandboxUniverse: sandboxExperiment,
    sandboxController,
    sandboxReplayRunner,
  } satisfies JsonValue;
  return {
    goal:
      params.goal === params.profile.bootstrap.defaultGoal
        ? `Genesis Team: ${stage.goal}`
        : params.goal,
    currentStep: stage.id,
    stateJson: {
      autonomy: {
        project: projectState,
      },
    } satisfies JsonValue,
    tasks: createGenesisActionTaskTemplates({
      profile: params.profile,
      stage,
      plan,
    }),
  };
}

function summarizeCapabilityGaps(gaps: GovernanceCapabilityGap[]): string[] {
  return gaps.slice(0, 5).map((entry) => `${entry.id}: ${entry.title}`);
}

function selectGovernedGapsByEntryPrefix(params: {
  gaps: GovernanceCapabilityGap[];
  entryIdPrefix: string;
  fallbackLimit?: number;
}): GovernanceCapabilityGap[] {
  const matched = params.gaps.filter((entry) =>
    entry.relatedEntryIds.some((relatedEntryId) => relatedEntryId.startsWith(params.entryIdPrefix)),
  );
  if (matched.length > 0) {
    return matched.slice(0, params.fallbackLimit ?? 5);
  }
  return params.gaps.slice(0, params.fallbackLimit ?? 5);
}

function buildAlgorithmResearchManagedFlowPlan(params: {
  profile: AutonomyAgentProfile;
  goal: string;
  workspaceDirs?: string[];
  cfg: OpenClawConfig;
  charterDir?: string;
}): ManagedAutonomyFlowPlan | undefined {
  if (params.profile.id !== "algorithmist") {
    return undefined;
  }
  const capabilityInventory = getGovernanceCapabilityInventory({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  const genesisPlan = planGovernanceGenesisWork({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    inventory: capabilityInventory,
  });
  const prioritizedAlgorithmGaps = selectGovernedGapsByEntryPrefix({
    gaps: capabilityInventory.gaps,
    entryIdPrefix: "algorithm:",
    fallbackLimit: 5,
  });
  const researchPhases = [
    {
      id: "algorithm_signal_review",
      title: "Signal Review",
      dependsOn: [],
      output: "algorithm_signal_report",
    },
    {
      id: "algorithm_hypothesis_generation",
      title: "Hypothesis Generation",
      dependsOn: ["algorithm_signal_review"],
      output: "candidate_algorithm_hypothesis",
    },
    {
      id: "historical_replay_planning",
      title: "Historical Replay Planning",
      dependsOn: ["algorithm_hypothesis_generation"],
      output: "replay_plan",
    },
    {
      id: "sandbox_ab_validation",
      title: "Sandbox A/B Validation",
      dependsOn: ["historical_replay_planning"],
      output: "validation_packet",
    },
    {
      id: "promotion_or_rejection",
      title: "Promotion or Rejection",
      dependsOn: ["sandbox_ab_validation"],
      output: "promotion_recommendation",
    },
  ];
  const sandboxExperiment = planSandboxUniverseExperiment({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    requestedByAgentId: params.profile.id,
    targetKind: "algorithm",
    targetId: prioritizedAlgorithmGaps[0]?.id ?? "algorithm_research",
    inventory: capabilityInventory,
    genesisPlan,
  });
  const sandboxStateDir = resolveAutonomySandboxStateDir();
  const sandboxController = createSandboxUniverseController({
    plan: sandboxExperiment,
    stateDir: sandboxStateDir,
  });
  const sandboxReplayRunner = createSandboxUniverseReplayRunner({
    plan: sandboxExperiment,
    controller: sandboxController,
    producedByAgentId: params.profile.id,
    stateDir: sandboxStateDir,
  });
  const projectState = {
    kind: "algorithm_research",
    focusGapIds: prioritizedAlgorithmGaps.map((entry) => entry.id),
    observedAlgorithmGaps: summarizeCapabilityGaps(prioritizedAlgorithmGaps),
    inventorySummary: {
      gapCount: capabilityInventory.summary.gapCount,
      criticalGapCount: capabilityInventory.summary.criticalGapCount,
      algorithmCount: capabilityInventory.summary.algorithmCount ?? 0,
      algorithmReady: capabilityInventory.summary.algorithmReady ?? 0,
      algorithmAttention: capabilityInventory.summary.algorithmAttention ?? 0,
      algorithmBlocked: capabilityInventory.summary.algorithmBlocked ?? 0,
    },
    researchPlan: {
      phases: researchPhases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        dependsOn: [...phase.dependsOn],
        output: phase.output,
      })),
      targetDomains: [
        "retrieval",
        "memory_selection",
        "compaction",
        "task_scheduling",
        "agent_selection",
        "qa_scoring",
      ],
      runtimeHooks: [...params.profile.runtimeHooks],
      collaborators: [...params.profile.collaborators],
    },
    promotionPolicy: {
      requiredEvidence: [
        "sandbox_ab_gain",
        "historical_replay_gain",
        "qa_validation",
        "audit_trace",
        "rollback_plan",
      ],
      blockers: [...genesisPlan.blockers],
    },
    sandboxUniverse: sandboxExperiment,
    sandboxController,
    sandboxReplayRunner,
  } satisfies JsonValue;
  const tasks: ManagedAutonomyTaskTemplate[] = [
    {
      runtime: "cli",
      status: "queued",
      label: "Benchmark review",
      progressSummary: "review algorithm telemetry and benchmark pressure",
      task: [
        "Review algorithm-related capability gaps, benchmark pressure, and quality regressions.",
        prioritizedAlgorithmGaps.length > 0
          ? `Observed algorithm gaps: ${summarizeCapabilityGaps(prioritizedAlgorithmGaps).join(" | ")}`
          : "Observed algorithm gaps: none",
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Hypothesis generation",
      progressSummary: "translate signals into a candidate decision-engine change",
      task: [
        "Generate the next governed algorithm hypothesis with explicit affected domains.",
        `Target domains: retrieval, memory_selection, compaction, task_scheduling, agent_selection, qa_scoring`,
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Replay and validation plan",
      progressSummary: "prepare historical replay and sandbox evidence requirements",
      task: [
        "Define the replay plan, A/B validation path, and evidence requirements for the candidate algorithm change.",
        `Sandbox target: ${sandboxExperiment.target.kind}:${sandboxExperiment.target.id}`,
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Promotion dossier",
      progressSummary: "prepare promotion or rejection evidence",
      task: [
        "Assemble the promotion or rejection dossier for the candidate algorithm.",
        `Required evidence: sandbox_ab_gain, historical_replay_gain, qa_validation, audit_trace, rollback_plan`,
      ].join("\n"),
    },
  ];
  return {
    goal: params.goal,
    currentStep: "algorithm.signal_review",
    stateJson: {
      autonomy: {
        project: projectState,
      },
    } satisfies JsonValue,
    tasks,
  };
}

function buildExecutorManagedFlowPlan(params: {
  profile: AutonomyAgentProfile;
  goal: string;
  workspaceDirs?: string[];
  cfg: OpenClawConfig;
  charterDir?: string;
}): ManagedAutonomyFlowPlan | undefined {
  if (params.profile.id !== "executor") {
    return undefined;
  }
  const capabilityInventory = getGovernanceCapabilityInventory({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  const genesisPlan = planGovernanceGenesisWork({
    cfg: params.cfg,
    charterDir: params.charterDir,
    ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    inventory: capabilityInventory,
  });
  const prioritizedGaps = capabilityInventory.gaps.slice(0, 5);
  const criticalGapIds = capabilityInventory.gaps
    .filter((entry) => entry.severity === "critical")
    .map((entry) => entry.id);
  const taskGraphNodes = [
    {
      id: "goal_intake",
      title: "Goal Intake",
      dependsOn: [],
      output: "goal_contract",
    },
    {
      id: "task_decomposition",
      title: "Task Decomposition",
      dependsOn: ["goal_intake"],
      output: "task_graph",
    },
    {
      id: "capability_selection",
      title: "Capability Selection",
      dependsOn: ["task_decomposition"],
      output: "execution_plan",
    },
    ...(prioritizedGaps.length > 0
      ? [
          {
            id: "capability_escalation",
            title: "Capability Escalation",
            dependsOn: ["capability_selection"],
            output: "capability_request",
          },
        ]
      : []),
    {
      id: "dispatch_recovery_delivery",
      title: "Dispatch, Recovery, Delivery",
      dependsOn:
        prioritizedGaps.length > 0
          ? ["capability_selection", "capability_escalation"]
          : ["capability_selection"],
      output: "delivery_summary",
    },
  ];
  const taskGraph = taskGraphNodes.map((entry) => ({
    id: entry.id,
    title: entry.title,
    dependsOn: [...entry.dependsOn],
    output: entry.output,
  })) satisfies JsonValue;
  const capabilityRequest =
    prioritizedGaps.length > 0
      ? ({
          status: criticalGapIds.length > 0 ? "required" : "recommended",
          focusGapIds: prioritizedGaps.map((entry) => entry.id),
          handoffTeamId: genesisPlan.teamId,
          reason:
            criticalGapIds.length > 0
              ? "critical capability gaps block safe execution"
              : "capability gaps reduce delivery confidence or reuse quality",
          blockers: [...genesisPlan.blockers],
        } satisfies JsonValue)
      : ({
          status: "not_needed",
          focusGapIds: [],
          handoffTeamId: genesisPlan.teamId,
          reason: "current governed capability inventory is sufficient for execution planning",
          blockers: [],
        } satisfies JsonValue);
  const sandboxExperiment =
    prioritizedGaps.length > 0
      ? planSandboxUniverseExperiment({
          cfg: params.cfg,
          charterDir: params.charterDir,
          ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
          requestedByAgentId: params.profile.id,
          targetKind: "capability",
          targetId: prioritizedGaps[0]?.id,
          inventory: capabilityInventory,
          genesisPlan,
        })
      : undefined;
  const sandboxStateDir = sandboxExperiment ? resolveAutonomySandboxStateDir() : undefined;
  const sandboxController = sandboxExperiment
    ? createSandboxUniverseController({
        plan: sandboxExperiment,
        ...(sandboxStateDir ? { stateDir: sandboxStateDir } : {}),
      })
    : undefined;
  const sandboxReplayRunner =
    sandboxExperiment && sandboxController
      ? createSandboxUniverseReplayRunner({
          plan: sandboxExperiment,
          controller: sandboxController,
          producedByAgentId: params.profile.id,
          ...(sandboxStateDir ? { stateDir: sandboxStateDir } : {}),
        })
      : undefined;
  const projectState = {
    kind: "execution_system",
    goalContract: {
      goal: params.goal,
      layer: params.profile.layer ?? null,
      authorityLevel: params.profile.authorityLevel ?? null,
    },
    taskGraph,
    executionPlan: {
      phases: taskGraphNodes.map((entry) => ({
        id: entry.id,
        title: entry.title,
        dependsOn: [...entry.dependsOn],
        output: entry.output,
      })),
      runtimeHooks: [...params.profile.runtimeHooks],
      collaborators: [...params.profile.collaborators],
    },
    capabilityRequest,
    observedCapabilityGaps: summarizeCapabilityGaps(prioritizedGaps),
    genesisPlan: {
      teamId: genesisPlan.teamId,
      mode: genesisPlan.mode,
      focusGapIds: [...genesisPlan.focusGapIds],
      blockers: [...genesisPlan.blockers],
      ...(genesisPlan.projectBlueprint
        ? { projectBlueprint: genesisPlan.projectBlueprint }
        : {}),
    },
    ...(sandboxExperiment ? { sandboxUniverse: sandboxExperiment } : {}),
    ...(sandboxController ? { sandboxController } : {}),
    ...(sandboxReplayRunner ? { sandboxReplayRunner } : {}),
  } satisfies JsonValue;
  const tasks: ManagedAutonomyTaskTemplate[] = [
    {
      runtime: "cli",
      status: "queued",
      label: "Goal intake",
      progressSummary: "capture the governed goal contract",
      task: [
        "Translate the current objective into a governed execution contract.",
        `Goal: ${params.goal}`,
        "Define delivery boundaries, completion criteria, and non-negotiable constraints.",
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Task graph synthesis",
      progressSummary: "decompose goal into an executable task graph",
      task: [
        "Generate the executor task graph and execution plan.",
        `Graph nodes: ${taskGraphNodes.map((entry) => entry.id).join(", ")}`,
        `Collaborators: ${params.profile.collaborators.join(", ") || "none"}`,
        `Runtime hooks: ${params.profile.runtimeHooks.join(", ") || "none"}`,
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Capability selection and dispatch",
      progressSummary: "bind capabilities and prepare dispatch",
      task: [
        "Select the best governed capabilities for each task-graph edge and prepare dispatch.",
        prioritizedGaps.length > 0
          ? `Observed capability gaps: ${summarizeCapabilityGaps(prioritizedGaps).join(" | ")}`
          : "Observed capability gaps: none",
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: prioritizedGaps.length > 0 ? "Capability escalation" : "Delivery and recovery",
      progressSummary:
        prioritizedGaps.length > 0
          ? "prepare or trigger handoff to genesis_team where needed"
          : "drive the goal to a delivered outcome",
      task:
        prioritizedGaps.length > 0
          ? [
              "Escalate missing governed capabilities back into Genesis Team while keeping safe work flowing.",
              `Genesis Team: ${genesisPlan.teamId}`,
              `Focus gaps: ${genesisPlan.focusGapIds.join(", ") || "none"}`,
              `Blockers: ${genesisPlan.blockers.join("; ") || "none"}`,
            ].join("\n")
          : [
              "Drive dispatch, observe runtime signals, recover from failures, and produce the delivery summary.",
              "Close the loop by recording execution evidence and reusable outcomes.",
            ].join("\n"),
    },
  ];
  if (prioritizedGaps.length > 0) {
    tasks.push({
      runtime: "cli",
      status: "queued",
      label: "Delivery and recovery",
      progressSummary: "continue safe work while escalated capability work is tracked",
      task: [
        "Continue all safe, currently-supported execution paths while escalated capability work is tracked separately.",
        "Observe recoverability, record blockers, and produce a delivery or partial-delivery summary.",
      ].join("\n"),
    });
  }
  return {
    goal: params.goal,
    currentStep: "execution.goal_intake",
    stateJson: {
      autonomy: {
        project: projectState,
      },
    } satisfies JsonValue,
    tasks,
  };
}

function buildSovereigntyAuditorManagedFlowPlan(params: {
  profile: AutonomyAgentProfile;
  goal: string;
  workspaceDirs?: string[];
  cfg: OpenClawConfig;
  charterDir?: string;
}): ManagedAutonomyFlowPlan | undefined {
  if (params.profile.id !== "sovereignty_auditor") {
    return undefined;
  }
  const overview = getGovernanceOverview({
    cfg: params.cfg,
    charterDir: params.charterDir,
  });
  const criticalFindings = overview.findings
    .filter((entry) => entry.severity === "critical")
    .slice(0, 5)
    .map((entry) => entry.title);
  const watchPhases = [
    {
      id: "audit_snapshot",
      title: "Audit Snapshot",
      dependsOn: [],
      output: "audit_snapshot",
    },
    {
      id: "boundary_drift_triage",
      title: "Boundary Drift Triage",
      dependsOn: ["audit_snapshot"],
      output: "drift_triage_report",
    },
    {
      id: "freeze_or_clearance_decision",
      title: "Freeze or Clearance Decision",
      dependsOn: ["boundary_drift_triage"],
      output: "freeze_or_clearance_order",
    },
    {
      id: "incident_package",
      title: "Incident Package",
      dependsOn: ["freeze_or_clearance_decision"],
      output: "sovereignty_incident_packet",
    },
  ];
  const projectState = {
    kind: "sovereignty_watch",
    governanceOverview: {
      discovered: overview.discovered,
      missingArtifactCount: overview.missingArtifactPaths.length,
      findingCount: overview.findings.length,
      proposalPendingCount: overview.proposals.pending,
      enforcementActive: overview.enforcement.active,
      freezeReasonCode: overview.enforcement.reasonCode ?? null,
    },
    watchPlan: {
      phases: watchPhases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        dependsOn: [...phase.dependsOn],
        output: phase.output,
      })),
      reservedAuthorities: [...overview.reservedAuthorities],
      freezeTargets: [...overview.freezeTargets],
    },
    incidentPolicy: {
      automaticEnforcementActions: [...overview.automaticEnforcementActions],
      criticalFindings,
    },
  } satisfies JsonValue;
  const tasks: ManagedAutonomyTaskTemplate[] = [
    {
      runtime: "cli",
      status: "queued",
      label: "Audit snapshot",
      progressSummary: "collect the current governance and audit integrity snapshot",
      task: [
        "Collect the current governance overview, audit continuity, and proposal pressure snapshot.",
        `Missing artifacts: ${overview.missingArtifactPaths.length}`,
        `Open findings: ${overview.findings.length}`,
        `Pending proposals: ${overview.proposals.pending}`,
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Boundary drift triage",
      progressSummary: "triage sovereignty drift into actionable boundary decisions",
      task: [
        "Triage governance drift, missing charter artifacts, and critical findings into a concrete boundary decision.",
        criticalFindings.length > 0
          ? `Critical findings: ${criticalFindings.join(" | ")}`
          : "Critical findings: none",
      ].join("\n"),
    },
    {
      runtime: "cli",
      status: "queued",
      label: "Freeze or clearance decision",
      progressSummary: "prepare the next freeze, release, or escalation action",
      task: [
        "Prepare the next freeze, release, or escalation action for deterministic sovereignty issues.",
        `Automatic enforcement actions: ${overview.automaticEnforcementActions.join(", ") || "none"}`,
      ].join("\n"),
    },
  ];
  return {
    goal: params.goal,
    currentStep: "sovereignty.audit_snapshot",
    stateJson: {
      autonomy: {
        project: projectState,
      },
    } satisfies JsonValue,
    tasks,
  };
}

function resolveManagedAutonomyFlowPlan(params: {
  automationMode: ManagedAutonomyFlowAutomationMode;
  profile: AutonomyAgentProfile;
  goal: string;
  workspaceDirs?: string[];
  cfg: OpenClawConfig;
  charterDir?: string;
}): ManagedAutonomyFlowPlan | undefined {
  if (params.automationMode !== "autonomous") {
    return undefined;
  }
  return (
    buildGenesisManagedFlowPlan(params) ??
    buildAlgorithmResearchManagedFlowPlan(params) ??
    buildSovereigntyAuditorManagedFlowPlan(params) ??
    buildExecutorManagedFlowPlan(params)
  );
}

function resolveAutonomyProfile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  charterDir?: string;
}): AutonomyAgentProfile | undefined {
  const blueprint = resolveGovernanceCharterAgentBlueprint(params.agentId, {
    charterDir: params.charterDir,
  });
  if (!blueprint) {
    return undefined;
  }
  const contract = resolveAgentGovernanceRuntimeContract({
    cfg: params.cfg,
    agentId: params.agentId,
    charterDir: params.charterDir,
  });
  return {
    id: blueprint.id,
    name: blueprint.title,
    layer: blueprint.layer,
    missionPrimary: blueprint.missionPrimary,
    authorityLevel: blueprint.authorityLevel,
    collaborators: [...contract.collaborators],
    reportsTo: [...contract.reportsTo],
    mutationAllow: [...contract.mutationAllow],
    mutationDeny: [...contract.mutationDeny],
    networkDefault: contract.networkDefault,
    networkConditions: [...contract.networkConditions],
    runtimeHooks: [...contract.runtimeHooks],
    resourceBudget: contract.resourceBudget ? { ...contract.resourceBudget } : undefined,
    contract,
    bootstrap: buildBootstrapTemplate({
      agentId: blueprint.id,
      title: blueprint.title,
      missionPrimary: blueprint.missionPrimary,
      contract,
    }),
  };
}

function assertManagedAutonomyProfile(params: {
  cfg: OpenClawConfig;
  agentId: string;
  charterDir?: string;
}): AutonomyAgentProfile {
  const profile = resolveAutonomyProfile(params);
  if (!profile) {
    throw new Error(`Autonomy profile not found for "${params.agentId}".`);
  }
  return profile;
}

function sortManagedAutonomyAgentIds(agentIds: string[]): string[] {
  const preferredOrder = new Map<string, number>(
    AUTONOMY_PREFERRED_AGENT_ORDER.map((agentId, index) => [agentId, index] as const),
  );
  return Array.from(new Set(agentIds.map((agentId) => normalizeAgentId(agentId)).filter(Boolean))).toSorted(
    (left, right) => {
      const leftRank = preferredOrder.get(left);
      const rightRank = preferredOrder.get(right);
      if (leftRank !== undefined && rightRank !== undefined) {
        return leftRank - rightRank;
      }
      if (leftRank !== undefined) {
        return -1;
      }
      if (rightRank !== undefined) {
        return 1;
      }
      return left.localeCompare(right);
    },
  );
}

function listAutonomyProfiles(params: {
  cfg: OpenClawConfig;
  charterDir?: string;
}): AutonomyAgentProfile[] {
  return sortManagedAutonomyAgentIds(
    listGovernanceCharterAgentBlueprints({ charterDir: params.charterDir }).map((entry) => entry.id),
  )
    .map((agentId) =>
      resolveAutonomyProfile({
        cfg: params.cfg,
        agentId,
        charterDir: params.charterDir,
      }),
    )
    .filter((profile): profile is AutonomyAgentProfile => Boolean(profile));
}

function resolveFlowDetailForOwner(params: {
  ownerKey: string;
  flowId: string;
}) {
  const flow = getTaskFlowByIdForOwner({
    flowId: params.flowId,
    callerOwnerKey: params.ownerKey,
  });
  if (!flow) {
    return undefined;
  }
  const tasks = listTasksForFlowId(flow.flowId);
  return mapTaskFlowDetail({
    flow,
    tasks,
    summary: getFlowTaskSummary(flow.flowId),
  });
}

function normalizeOptionalAgentId(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(typeof value === "string" ? value : undefined);
  return normalized ? normalizeAgentId(normalized) : undefined;
}

function buildAutonomyLoopMarker(agentId: string): string {
  return `[[autonomy-loop:${normalizeAgentId(agentId)}]]`;
}

function buildAutonomyWorkspaceScopeMarker(
  workspaceDirs: string[] | undefined,
): string | undefined {
  const normalizedWorkspaceDirs = normalizeWorkspaceDirList(workspaceDirs);
  if (normalizedWorkspaceDirs.length === 0) {
    return undefined;
  }
  return `[[autonomy-workspace-scope:${Buffer.from(
    JSON.stringify(normalizedWorkspaceDirs),
    "utf8",
  ).toString("base64url")}]]`;
}

function parseAutonomyWorkspaceScopeMarker(value: string | undefined): string[] | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  const matched = normalized.match(/\[\[autonomy-workspace-scope:([A-Za-z0-9_-]+)\]\]/iu);
  if (!matched?.[1]) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(matched[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    return Array.isArray(parsed)
      ? normalizeWorkspaceDirList(
          parsed.filter((entry): entry is string => typeof entry === "string"),
        )
      : undefined;
  } catch {
    return undefined;
  }
}

function buildAutonomyLoopDescription(
  agentId: string,
  description: string,
  workspaceDirs?: string[],
): string {
  return [buildAutonomyLoopMarker(agentId), buildAutonomyWorkspaceScopeMarker(workspaceDirs), description]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();
}

function buildAutonomyLoopPayloadMessage(
  agentId: string,
  message: string,
  workspaceDirs?: string[],
): string {
  return `${buildAutonomyLoopMarker(agentId)}\n${augmentLoopMessageWithWorkspaceScope(
    message,
    workspaceDirs,
  )}`.trim();
}

function hasAutonomyLoopMarker(value: unknown, agentId: string): boolean {
  const normalized = normalizeOptionalString(typeof value === "string" ? value : undefined);
  return normalized?.includes(buildAutonomyLoopMarker(agentId)) ?? false;
}

function resolveAutonomyLoopWorkspaceDirs(job: CronJob | undefined): string[] | undefined {
  if (!job) {
    return undefined;
  }
  return (
    parseAutonomyWorkspaceScopeMarker(job.description) ??
    (job.payload.kind === "agentTurn"
      ? parseAutonomyWorkspaceScopeMarker(job.payload.message)
      : undefined)
  );
}

function resolveAutonomyFlowWorkspaceDirs(
  flow:
    | {
        state?: JsonValue;
        stateJson?: JsonValue;
      }
    | undefined,
): string[] | undefined {
  if (!flow) {
    return undefined;
  }
  const state = "state" in flow ? flow.state : flow.stateJson;
  if (!isRecord(state) || !isRecord(state.autonomy) || !Array.isArray(state.autonomy.workspaceDirs)) {
    return undefined;
  }
  return normalizeWorkspaceDirList(
    state.autonomy.workspaceDirs.filter((entry): entry is string => typeof entry === "string"),
  );
}

function resolveWorkspaceScopeMetadata(
  workspaceDirs: string[] | undefined,
): Pick<AutonomyLoopJobSnapshot, "workspaceDirs" | "primaryWorkspaceDir"> {
  const normalizedWorkspaceDirs = normalizeWorkspaceDirList(workspaceDirs);
  return normalizedWorkspaceDirs.length > 0
    ? {
        workspaceDirs: normalizedWorkspaceDirs,
        primaryWorkspaceDir: normalizedWorkspaceDirs[0],
      }
    : {};
}

function resolvePreferredWorkspaceDirs(
  ...workspaceDirCandidates: Array<string[] | undefined>
): string[] | undefined {
  for (const candidate of workspaceDirCandidates) {
    const normalizedWorkspaceDirs = normalizeWorkspaceDirList(candidate);
    if (normalizedWorkspaceDirs.length > 0) {
      return normalizedWorkspaceDirs;
    }
  }
  return undefined;
}

function hasWorkspaceScopeIntersection(params: {
  requestedWorkspaceDirs?: string[];
  entryWorkspaceDirs?: string[];
  primaryWorkspaceDir?: string;
}): boolean {
  const requestedWorkspaceDirs = normalizeWorkspaceDirList(params.requestedWorkspaceDirs);
  if (requestedWorkspaceDirs.length === 0) {
    return true;
  }
  const entryWorkspaceDirs = normalizeWorkspaceDirList([
    ...normalizeWorkspaceDirList(params.entryWorkspaceDirs),
    params.primaryWorkspaceDir ?? "",
  ]);
  if (entryWorkspaceDirs.length === 0) {
    return false;
  }
  const requestedWorkspaceDirSet = new Set(requestedWorkspaceDirs);
  return entryWorkspaceDirs.some((workspaceDir) => requestedWorkspaceDirSet.has(workspaceDir));
}

function resolveAutonomyStateAgentId(stateJson: JsonValue | undefined): string | undefined {
  if (!isRecord(stateJson)) {
    return undefined;
  }
  return normalizeOptionalAgentId(isRecord(stateJson.autonomy) ? stateJson.autonomy.agentId : undefined);
}

function matchesAutonomyManagedFlow(params: {
  agentId: string;
  flow: import("../../tasks/task-flow-registry.types.js").TaskFlowRecord;
  tasks: ReturnType<typeof listTasksForFlowId>;
}): boolean {
  if (params.flow.syncMode !== "managed") {
    return false;
  }

  const targetAgentId = normalizeAgentId(params.agentId);
  if (resolveAutonomyStateAgentId(params.flow.stateJson) === targetAgentId) {
    return true;
  }

  const controllerId = normalizeOptionalString(params.flow.controllerId);
  if (
    controllerId &&
    (controllerId === `runtime.autonomy/${targetAgentId}` ||
      controllerId.startsWith(`runtime.autonomy/${targetAgentId}/`))
  ) {
    return true;
  }

  return params.tasks.some(
    (task) =>
      normalizeOptionalAgentId(task.agentId) === targetAgentId &&
      normalizeOptionalString(task.sourceId) === controllerId,
  );
}

function matchesAutonomyLoopJob(params: {
  agentId: string;
  job: CronJob;
}): boolean {
  const targetAgentId = normalizeAgentId(params.agentId);
  if (normalizeOptionalAgentId(params.job.agentId) !== targetAgentId) {
    return false;
  }
  if (params.job.payload.kind !== "agentTurn") {
    return false;
  }
  if (params.job.sessionTarget !== "isolated") {
    return false;
  }
  if (params.job.wakeMode !== "now") {
    return false;
  }
  return (
    hasAutonomyLoopMarker(params.job.description, targetAgentId) ||
    hasAutonomyLoopMarker(params.job.payload.message, targetAgentId)
  );
}

function resolveLatestSeedTaskForFlow(params: {
  agentId: string;
  flow: import("../../tasks/task-flow-registry.types.js").TaskFlowRecord;
  tasks: ReturnType<typeof listTasksForFlowId>;
}) {
  const targetAgentId = normalizeAgentId(params.agentId);
  const controllerId = normalizeOptionalString(params.flow.controllerId);
  return (
    params.tasks.find(
      (task) =>
        normalizeOptionalAgentId(task.agentId) === targetAgentId &&
        normalizeOptionalString(task.sourceId) === controllerId,
    ) ??
    params.tasks.find((task) => normalizeOptionalAgentId(task.agentId) === targetAgentId) ??
    params.tasks[0]
  );
}

function createManagedFlowSnapshot(params: {
  agentId: string;
  flow: import("../../tasks/task-flow-registry.types.js").TaskFlowRecord;
  tasks: ReturnType<typeof listTasksForFlowId>;
}): AutonomyManagedFlowSnapshot {
  const detail = mapTaskFlowDetail({
    flow: params.flow,
    tasks: params.tasks,
    summary: getFlowTaskSummary(params.flow.flowId),
  });
  const seedTask = resolveLatestSeedTaskForFlow(params);
  return {
    flow: detail,
    ...(seedTask ? { seedTask: mapTaskRunDetail(seedTask) } : {}),
  };
}

function resolveSandboxReplayStepPrefix(project: ManagedTaskFlowAutonomyProjectRuntime): string {
  switch (project.kind) {
    case "genesis_stage":
      return "genesis";
    case "algorithm_research":
      return "algorithm";
    case "execution_system":
      return "execution";
    case "sovereignty_watch":
      return "sovereignty";
  }
}

function resolveSandboxReplayCurrentStep(params: {
  project: ManagedTaskFlowAutonomyProjectRuntime;
  replayResult: ReturnType<typeof runSandboxUniverseReplayRunner>;
}): string {
  const prefix = resolveSandboxReplayStepPrefix(params.project);
  const lastRun = params.replayResult.replayRunner.lastRun;
  if (!lastRun?.replayPassed) {
    return `${prefix}.sandbox_validation`;
  }
  if (!lastRun.qaPassed) {
    return `${prefix}.qa_replay`;
  }
  if (params.replayResult.decision.canPromote) {
    return `${prefix}.promotion_complete`;
  }
  return `${prefix}.promotion_gate`;
}

function resolveSandboxReplayBlockedSummary(
  replayResult: ReturnType<typeof runSandboxUniverseReplayRunner>,
): string {
  const failures: string[] = [];
  const lastRun = replayResult.replayRunner.lastRun;
  if (!lastRun?.replayPassed) {
    failures.push("sandbox replay failed");
  }
  if (lastRun && !lastRun.qaPassed) {
    failures.push("qa replay failed");
  }
  if (lastRun && !lastRun.auditPassed) {
    failures.push("audit trace failed");
  }
  if (failures.length > 0) {
    return `Sandbox validation rejected the candidate: ${failures.join("; ")}.`;
  }
  if (replayResult.decision.freezeActive) {
    return "Sandbox promotion is frozen by governance enforcement.";
  }
  if (replayResult.decision.blockers.length > 0) {
    return `Sandbox promotion remains blocked: ${replayResult.decision.blockers.join("; ")}.`;
  }
  return "Sandbox promotion remains blocked.";
}

function buildSandboxReplayWaitJson(
  replayResult: ReturnType<typeof runSandboxUniverseReplayRunner>,
): JsonValue {
  return {
    kind: "sandbox_replay_gate",
    observedAt: replayResult.observedAt,
    decision: replayResult.decision,
    sandboxController: replayResult.controller,
    sandboxReplayRunner: replayResult.replayRunner,
  } satisfies JsonValue;
}

function applySandboxReplayResultToProject(params: {
  project: ManagedTaskFlowAutonomyProjectRuntime;
  replayResult: ReturnType<typeof runSandboxUniverseReplayRunner>;
}): ManagedTaskFlowAutonomyProjectRuntime {
  switch (params.project.kind) {
    case "genesis_stage": {
      const lastRun = params.replayResult.replayRunner.lastRun;
      return {
        ...params.project,
        blockers: [...params.replayResult.decision.blockers],
        stage: {
          ...params.project.stage,
          status:
            !lastRun?.replayPassed || !lastRun?.qaPassed || !lastRun?.auditPassed
              ? "blocked"
              : params.replayResult.decision.canPromote
                ? "ready"
                : "waiting",
        },
        sandboxController: params.replayResult.controller,
        sandboxReplayRunner: params.replayResult.replayRunner,
      };
    }
    case "algorithm_research":
      return {
        ...params.project,
        promotionPolicy: {
          ...params.project.promotionPolicy,
          requiredEvidence: [...params.replayResult.decision.requiredEvidence],
          blockers: [...params.replayResult.decision.blockers],
        },
        sandboxController: params.replayResult.controller,
        sandboxReplayRunner: params.replayResult.replayRunner,
      };
    case "execution_system":
      return {
        ...params.project,
        sandboxController: params.replayResult.controller,
        sandboxReplayRunner: params.replayResult.replayRunner,
      };
    case "sovereignty_watch":
      return params.project;
  }
}

function explainManagedFlowMutationFailure(params: {
  action: string;
  code: "not_found" | "not_managed" | "revision_conflict";
  flowId: string;
}): string {
  switch (params.code) {
    case "not_found":
      return `Autonomy flow "${params.flowId}" disappeared while attempting to ${params.action}.`;
    case "not_managed":
      return `Autonomy flow "${params.flowId}" is no longer a managed flow.`;
    case "revision_conflict":
      return `Autonomy flow "${params.flowId}" changed concurrently while attempting to ${params.action}.`;
  }
}

function resolveLatestManagedFlowSnapshot(params: {
  ownerKey: string;
  agentId: string;
  taskFlow: ReturnType<PluginRuntimeTaskFlow["bindSession"]>;
}): AutonomyManagedFlowSnapshot | undefined {
  const targetAgentId = normalizeAgentId(params.agentId);
  let latest:
    | {
        flow: import("../../tasks/task-flow-registry.types.js").TaskFlowRecord;
        tasks: ReturnType<typeof listTasksForFlowId>;
      }
    | undefined;

  for (const flow of params.taskFlow.list()) {
    const tasks = listTasksForFlowId(flow.flowId);
    if (
      !matchesAutonomyManagedFlow({
        agentId: targetAgentId,
        flow,
        tasks,
      })
    ) {
      continue;
    }
    if (!latest) {
      latest = { flow, tasks };
      continue;
    }
    const updatedAt = flow.updatedAt ?? flow.createdAt ?? 0;
    const latestUpdatedAt = latest.flow.updatedAt ?? latest.flow.createdAt ?? 0;
    if (updatedAt >= latestUpdatedAt) {
      latest = { flow, tasks };
    }
  }

  return latest
    ? createManagedFlowSnapshot({
        agentId: targetAgentId,
        flow: latest.flow,
        tasks: latest.tasks,
      })
    : undefined;
}

function inferManagedFlowSandboxReplaySubmission(params: {
  flow: import("../../tasks/task-flow-registry.types.js").TaskFlowRecord;
  tasks: ReturnType<typeof listTasksForFlowId>;
  autonomy: ReturnType<ReturnType<PluginRuntimeTaskFlow["bindSession"]>["getManagedAutonomy"]>;
}):
  | {
      replayPassed: boolean;
      qaPassed: boolean;
      auditPassed: boolean;
      reason: string;
    }
  | undefined {
  const autonomy = params.autonomy;
  if (!autonomy?.project) {
    return undefined;
  }
  const project = autonomy.project;
  if (
    project.kind === "sovereignty_watch" ||
    !("sandboxUniverse" in project) ||
    !project.sandboxUniverse ||
    !project.sandboxController ||
    !project.sandboxReplayRunner
  ) {
    return undefined;
  }
  if (project.sandboxReplayRunner.status !== "ready" || project.sandboxReplayRunner.lastRun) {
    return undefined;
  }
  if (
    params.flow.status === "succeeded" ||
    params.flow.status === "failed" ||
    params.flow.status === "cancelled" ||
    params.flow.status === "lost" ||
    params.flow.cancelRequestedAt != null
  ) {
    return undefined;
  }
  if (params.tasks.length === 0 || !params.tasks.every((task) => isTerminalTaskStatus(task.status))) {
    return undefined;
  }

  const allSucceeded = params.tasks.every(
    (task) => task.status === "succeeded" && task.terminalOutcome !== "blocked",
  );
  if (allSucceeded) {
    return {
      replayPassed: true,
      qaPassed: true,
      auditPassed: true,
      reason: "all managed flow tasks reached succeeded terminal states",
    };
  }

  return {
    replayPassed: false,
    qaPassed: false,
    auditPassed: false,
    reason: "managed flow contains failed, cancelled, timed-out, lost, or blocked task terminals",
  };
}

async function maybeAutoSubmitManagedFlowSandboxReplay(params: {
  cfg: OpenClawConfig;
  profile: AutonomyAgentProfile;
  profileSessionKey: string;
  taskFlow: ReturnType<PluginRuntimeTaskFlow["bindSession"]>;
  latest?: AutonomyManagedFlowSnapshot;
}): Promise<AutonomyManagedFlowSnapshot | undefined> {
  if (!params.latest?.flow?.id) {
    return params.latest;
  }

  const flowRecord = params.taskFlow.get(params.latest.flow.id);
  if (!flowRecord) {
    return params.latest;
  }
  const tasks = listTasksForFlowId(flowRecord.flowId);
  if (
    !matchesAutonomyManagedFlow({
      agentId: params.profile.id,
      flow: flowRecord,
      tasks,
    })
  ) {
    return params.latest;
  }

  const autonomy = params.taskFlow.getManagedAutonomy(flowRecord.flowId);
  const inferred = inferManagedFlowSandboxReplaySubmission({
    flow: flowRecord,
    tasks,
    autonomy,
  });
  if (!inferred) {
    return params.latest;
  }

  const submitted = await submitManagedAutonomySandboxReplay({
    cfg: params.cfg,
    profile: params.profile,
    taskFlow: params.taskFlow,
    targetFlowId: flowRecord.flowId,
    input: {
      replayPassed: inferred.replayPassed,
      qaPassed: inferred.qaPassed,
      auditPassed: inferred.auditPassed,
    },
  });
  if (!submitted.outcome.applied) {
    log.debug("Skipped auto-submitting sandbox replay for managed flow", {
      agentId: params.profile.id,
      flowId: flowRecord.flowId,
      reason: submitted.outcome.reason ?? inferred.reason,
    });
    return resolveLatestManagedFlowSnapshot({
      ownerKey: params.profileSessionKey,
      agentId: params.profile.id,
      taskFlow: params.taskFlow,
    });
  }

  log.info("Auto-submitted sandbox replay for managed autonomy flow", {
    agentId: params.profile.id,
    flowId: flowRecord.flowId,
    replayPassed: inferred.replayPassed,
    qaPassed: inferred.qaPassed,
    auditPassed: inferred.auditPassed,
    reason: inferred.reason,
  });
  return resolveLatestManagedFlowSnapshot({
    ownerKey: params.profileSessionKey,
    agentId: params.profile.id,
    taskFlow: params.taskFlow,
  });
}

function createStandaloneCronService(cfg: OpenClawConfig): CronServiceContract {
  return new CronService({
    storePath: resolveCronStorePath(cfg.cron?.store),
    cronEnabled: process.env.OPENCLAW_SKIP_CRON !== "1" && cfg.cron?.enabled !== false,
    cronConfig: cfg.cron,
    defaultAgentId: resolveDefaultAgentId(cfg),
    log: noopCronLogger,
    enqueueSystemEvent: () => {},
    requestHeartbeatNow: () => {},
    runIsolatedAgentJob: async () => ({
      status: "error",
      error: "standalone cron runtime cannot execute jobs",
    }),
  });
}

function resolveAutonomyCronService(params: {
  cfg: OpenClawConfig;
  cronService?: CronServiceContract;
}): CronServiceContract {
  return params.cronService ?? createStandaloneCronService(params.cfg);
}

function sortAutonomyLoopJobs(jobs: CronJob[]): CronJob[] {
  return jobs.toSorted((a, b) => {
    const updatedDelta = (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
    if (updatedDelta !== 0) {
      return updatedDelta;
    }
    return a.id.localeCompare(b.id);
  });
}

async function listAutonomyLoopJobRecords(params: {
  cfg: OpenClawConfig;
  agentId: string;
  cronService?: CronServiceContract;
}): Promise<CronJob[]> {
  const cron = resolveAutonomyCronService(params);
  const jobs = await cron.list({ includeDisabled: true });
  return sortAutonomyLoopJobs(
    jobs.filter((job) =>
      matchesAutonomyLoopJob({
        agentId: params.agentId,
        job,
      }),
    ),
  );
}

function createLoopJobSnapshot(params: {
  profile: AutonomyAgentProfile;
  job: CronJob;
}): AutonomyLoopJobSnapshot {
  const workspaceDirs = resolveAutonomyLoopWorkspaceDirs(params.job);
  return {
    agentId: params.profile.id,
    mode: AUTONOMY_LOOP_MODE,
    job: params.job,
    ...resolveWorkspaceScopeMetadata(workspaceDirs),
  };
}

async function listAutonomyLoopJobSnapshots(params: {
  cfg: OpenClawConfig;
  profiles: AutonomyAgentProfile[];
  cronService?: CronServiceContract;
}): Promise<AutonomyLoopJobSnapshot[]> {
  const cron = resolveAutonomyCronService(params);
  const jobs = sortAutonomyLoopJobs(await cron.list({ includeDisabled: true }));
  const profileById = new Map(params.profiles.map((profile) => [profile.id, profile] as const));

  return jobs
    .filter((job) => {
      const agentId = normalizeOptionalAgentId(job.agentId);
      return Boolean(
        agentId &&
          profileById.has(agentId) &&
          matchesAutonomyLoopJob({
            agentId,
            job,
          }),
      );
    })
    .flatMap((job) => {
      const agentId = normalizeOptionalAgentId(job.agentId);
      const profile = agentId ? profileById.get(agentId) : undefined;
      return profile
        ? [
            createLoopJobSnapshot({
              profile,
              job,
            }),
          ]
        : [];
    });
}

function resolveLoopEveryMs(input: number | undefined, fallbackEveryMs: number): number {
  if (input === undefined) {
    return fallbackEveryMs;
  }
  const normalized = Math.floor(input);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Autonomy loop everyMs must be a positive integer.");
  }
  return normalized;
}

function resolveManagedLoopProfiles(params: {
  cfg: OpenClawConfig;
  agentIds?: string[];
  charterDir?: string;
}): AutonomyAgentProfile[] {
  if (!params.agentIds?.length) {
    return listAutonomyProfiles({
      cfg: params.cfg,
      charterDir: params.charterDir,
    });
  }

  const seen = new Set<string>();
  return params.agentIds.flatMap((agentId) => {
    const normalized = normalizeAgentId(agentId);
    if (seen.has(normalized)) {
      return [];
    }
    seen.add(normalized);
    return [
      assertManagedAutonomyProfile({
        cfg: params.cfg,
        agentId: normalized,
        charterDir: params.charterDir,
      }),
    ];
  });
}

function resolveGovernanceProposalProfiles(params: {
  cfg: OpenClawConfig;
  agentIds?: string[];
  charterDir?: string;
}): AutonomyAgentProfile[] {
  return resolveManagedLoopProfiles(params).filter(
    (profile) =>
      profile.id === "founder" || profile.id === "strategist" || profile.id === "librarian",
  );
}

function resolveGovernanceProposalAuthor(
  profiles: AutonomyAgentProfile[],
): string | undefined {
  if (profiles.some((profile) => profile.id === "founder")) {
    return "founder";
  }
  return profiles[0]?.id;
}

function resolveLoopEveryMsFromJob(job: CronJob | undefined): number | undefined {
  return job?.schedule.kind === "every" ? job.schedule.everyMs : undefined;
}

function hasLoopReconcileDrift(entry: AutonomyFleetStatusEntry): boolean {
  const loopJob = entry.loopJob?.job;
  return (
    !loopJob ||
    !loopJob.enabled ||
    entry.duplicateLoopCount > 0 ||
    !entry.loopCadenceAligned ||
    loopJob.schedule.kind !== "every"
  );
}

function buildFleetStatusEntry(params: {
  profile: AutonomyAgentProfile;
  latest?: AutonomyManagedFlowSnapshot;
  loops: CronJob[];
}): AutonomyFleetStatusEntry {
  const [primary, ...duplicates] = params.loops;
  const loopJob = primary
    ? createLoopJobSnapshot({
        profile: params.profile,
        job: primary,
      })
    : undefined;
  const workspaceDirs = resolvePreferredWorkspaceDirs(
    resolveAutonomyFlowWorkspaceDirs(params.latest?.flow),
    loopJob?.workspaceDirs,
  );
  const expectedLoopEveryMs = params.profile.bootstrap.loop.schedule.everyMs;
  const actualLoopEveryMs = resolveLoopEveryMsFromJob(primary);
  const hasLoopDrift =
    !primary ||
    !primary.enabled ||
    duplicates.length > 0 ||
    primary.schedule.kind !== "every" ||
    actualLoopEveryMs !== expectedLoopEveryMs;
  const hasActiveFlow = params.latest?.flow
    ? ACTIVE_AUTONOMY_FLOW_STATUSES.has(params.latest.flow.status)
    : false;
  const flowBlocked = params.latest?.flow?.status === "blocked";
  const driftReasons: string[] = [];

  if (!primary) {
    driftReasons.push("managed loop missing");
  } else {
    if (!primary.enabled) {
      driftReasons.push("managed loop disabled");
    }
    if (duplicates.length > 0) {
      driftReasons.push(`${duplicates.length} duplicate managed loop job(s) detected`);
    }
    if (primary.schedule.kind !== "every") {
      driftReasons.push("managed loop schedule kind drifted");
    } else if (actualLoopEveryMs !== expectedLoopEveryMs) {
      driftReasons.push(
        `managed loop cadence drifted (${actualLoopEveryMs}ms != ${expectedLoopEveryMs}ms)`,
      );
    }
  }

  if (flowBlocked) {
    driftReasons.push("latest managed flow is blocked");
  } else if (!hasActiveFlow) {
    if (!params.latest?.flow) {
      driftReasons.push("no managed flow recorded yet");
    } else {
      driftReasons.push(`latest managed flow is ${params.latest.flow.status}`);
    }
  }

  let health: AutonomyFleetStatusHealth;
  if (!primary) {
    health = "missing_loop";
  } else if (hasLoopDrift || flowBlocked) {
    health = "drift";
  } else if (hasActiveFlow) {
    health = "healthy";
  } else {
    health = "idle";
  }

  return {
    agentId: params.profile.id,
    profile: params.profile,
    ...(params.latest?.flow ? { latestFlow: params.latest.flow } : {}),
    ...(params.latest?.seedTask ? { latestSeedTask: params.latest.seedTask } : {}),
    ...(loopJob ? { loopJob } : {}),
    ...resolveWorkspaceScopeMetadata(workspaceDirs),
    duplicateLoopCount: duplicates.length,
    expectedLoopEveryMs,
    ...(actualLoopEveryMs !== undefined ? { actualLoopEveryMs } : {}),
    loopCadenceAligned: Boolean(primary && actualLoopEveryMs === expectedLoopEveryMs),
    hasActiveFlow,
    driftReasons,
    suggestedAction:
      !primary || hasLoopDrift
        ? "reconcile_loop"
        : flowBlocked
          ? "inspect_flow"
          : hasActiveFlow
            ? "observe"
            : "start_flow",
    health,
  };
}

function buildFleetStatusTotals(
  entries: AutonomyFleetStatusEntry[],
): AutonomyFleetStatusResult["totals"] {
  return {
    totalProfiles: entries.length,
    healthy: entries.filter((entry) => entry.health === "healthy").length,
    idle: entries.filter((entry) => entry.health === "idle").length,
    drift: entries.filter((entry) => entry.health === "drift").length,
    missingLoop: entries.filter((entry) => entry.health === "missing_loop").length,
    activeFlows: entries.filter((entry) => entry.hasActiveFlow).length,
  };
}

function buildFleetHistoryTotalsFromHeal(
  result: AutonomyFleetHealResult,
): AutonomyFleetHistoryTotals {
  return {
    totalProfiles: result.totals.totalProfiles,
    changed: result.totals.changed,
    unchanged: result.totals.unchanged,
    loopCreated: result.totals.loopCreated,
    loopUpdated: result.totals.loopUpdated,
    flowStarted: result.totals.flowStarted,
    flowRestarted: result.totals.flowRestarted,
  };
}

function buildFleetHistoryTotalsFromReconcile(
  result: AutonomyLoopReconcileResult,
): AutonomyFleetHistoryTotals {
  return {
    totalProfiles: result.reconciled.length,
    changed: result.createdCount + result.updatedCount,
    unchanged: 0,
    loopCreated: result.createdCount,
    loopUpdated: result.updatedCount,
    flowStarted: 0,
    flowRestarted: 0,
  };
}

function buildFleetHistoryEntryFromHeal(
  entry: AutonomyFleetHealEntry,
): AutonomyFleetHistoryEntry {
  const workspaceDirs = resolvePreferredWorkspaceDirs(
    entry.workspaceDirs,
    resolveAutonomyFlowWorkspaceDirs(entry.startedFlow),
    resolveAutonomyFlowWorkspaceDirs(entry.latestFlowAfter),
    entry.loopAfter?.workspaceDirs,
    resolveAutonomyFlowWorkspaceDirs(entry.latestFlowBefore),
    entry.loopBefore?.workspaceDirs,
  );
  return {
    agentId: entry.agentId,
    changed: entry.loopAction !== "none" || entry.flowAction !== "none",
    healthBefore: entry.healthBefore,
    healthAfter: entry.healthAfter,
    loopAction: entry.loopAction,
    flowAction: entry.flowAction,
    ...resolveWorkspaceScopeMetadata(workspaceDirs),
    reasons: [...entry.reasons],
    ...(entry.latestFlowBefore?.id ? { latestFlowIdBefore: entry.latestFlowBefore.id } : {}),
    ...(entry.latestFlowAfter?.id ? { latestFlowIdAfter: entry.latestFlowAfter.id } : {}),
    ...(entry.latestFlowBefore?.status
      ? { latestFlowStatusBefore: entry.latestFlowBefore.status }
      : {}),
    ...(entry.latestFlowAfter?.status ? { latestFlowStatusAfter: entry.latestFlowAfter.status } : {}),
    ...(entry.latestSeedTaskBefore?.status
      ? { latestSeedTaskStatusBefore: entry.latestSeedTaskBefore.status }
      : {}),
    ...(entry.latestSeedTaskAfter?.status
      ? { latestSeedTaskStatusAfter: entry.latestSeedTaskAfter.status }
      : {}),
    ...(entry.startedFlow?.id ? { startedFlowId: entry.startedFlow.id } : {}),
    ...(entry.cancelledFlowBeforeRestart?.id
      ? { cancelledFlowId: entry.cancelledFlowBeforeRestart.id }
      : {}),
  };
}

function buildFleetHistoryEntryFromReconcile(
  entry: AutonomyLoopUpsertResult,
): AutonomyFleetHistoryEntry {
  const reasons =
    entry.reconciledRemovedJobIds?.length && entry.reconciledRemovedJobIds.length > 0
      ? [`removed duplicate loop jobs: ${entry.reconciledRemovedJobIds.join(", ")}`]
      : [];
  const workspaceDirs = resolvePreferredWorkspaceDirs(entry.loop.workspaceDirs);
  return {
    agentId: entry.profile.id,
    changed: entry.created || entry.updated,
    loopAction: entry.created ? "created" : "updated",
    flowAction: "none",
    ...resolveWorkspaceScopeMetadata(workspaceDirs),
    reasons,
  };
}

function resolveAutonomyHistoryEventAgentIds(params: {
  agentIds?: string[];
  entries: AutonomyFleetHistoryEntry[];
}): string[] {
  const raw = params.agentIds?.length
    ? params.agentIds
    : params.entries.map((entry) => entry.agentId);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const agentId of raw) {
    const normalized = normalizeAgentId(agentId);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

async function recordAutonomyFleetHistory(params: {
  sessionKey: string;
  mode: AutonomyFleetHistoryEvent["mode"];
  source?: AutonomyFleetHistorySource;
  recordHistory?: boolean;
  agentIds?: string[];
  workspaceDirs?: string[];
  totals: AutonomyFleetHistoryTotals;
  entries: AutonomyFleetHistoryEntry[];
}): Promise<void> {
  if (params.recordHistory === false || params.entries.length === 0) {
    return;
  }
  await appendAutonomyFleetHistoryEvent({
    event: {
      eventId: randomUUID(),
      ts: Date.now(),
      sessionKey: params.sessionKey,
      mode: params.mode,
      source: params.source ?? "manual",
      agentIds: resolveAutonomyHistoryEventAgentIds({
        agentIds: params.agentIds,
        entries: params.entries,
      }),
      ...resolveWorkspaceScopeMetadata(
        resolvePreferredWorkspaceDirs(
          params.workspaceDirs,
          ...params.entries.map((entry) => entry.workspaceDirs),
        ),
      ),
      changed: params.totals.changed > 0,
      totals: params.totals,
      entries: params.entries,
    },
  });
}

function buildAutonomySupervisorSummary(params: {
  overviewAfter: AutonomyFleetStatusResult;
  healed: AutonomyFleetHealResult;
  governanceReconciled?: AutonomyGovernanceReconcileResult;
  capabilityInventory?: AutonomyCapabilityInventoryResult;
  genesisPlan?: AutonomyGenesisPlanResult;
}): AutonomySupervisorResult["summary"] {
  const governanceSynthesis =
    params.governanceReconciled?.synthesized ?? params.healed.governanceProposals;
  const governancePendingCount =
    params.governanceReconciled?.entries.filter((entry) => entry.proposalStatusAfter !== "applied")
      .length ??
    governanceSynthesis?.results.filter((entry) => entry.proposalStatus !== "applied").length ??
    0;
  const recommendedNextActions: string[] = [];

  if (params.overviewAfter.totals.drift > 0 || params.overviewAfter.totals.missingLoop > 0) {
    recommendedNextActions.push(
      "Inspect remaining autonomy drift and rerun the supervisor after targeted corrections.",
    );
  }
  if (params.governanceReconciled?.skippedCount) {
    recommendedNextActions.push(
      "Review skipped governance proposals and decide whether a force-apply pass is justified.",
    );
  } else if (!params.governanceReconciled && governancePendingCount > 0) {
    recommendedNextActions.push(
      "Review or reconcile the pending governance proposals created by the supervisor pass.",
    );
  }
  if ((params.capabilityInventory?.summary.criticalGapCount ?? 0) > 0) {
    recommendedNextActions.push(
      "Prioritize critical capability gaps before the next autonomous development cycle.",
    );
  } else if ((params.capabilityInventory?.summary.gapCount ?? 0) > 0) {
    recommendedNextActions.push(
      "Execute the genesis plan stages to close the remaining governed capability gaps.",
    );
  }
  if (recommendedNextActions.length === 0) {
    recommendedNextActions.push(
      "No immediate intervention is required; continue observing the autonomous fleet.",
    );
  }

  return {
    totalProfiles: params.overviewAfter.totals.totalProfiles,
    changedProfiles: params.healed.totals.changed,
    healthyProfiles: params.overviewAfter.totals.healthy,
    driftProfiles: params.overviewAfter.totals.drift,
    missingLoopProfiles: params.overviewAfter.totals.missingLoop,
    activeFlows: params.overviewAfter.totals.activeFlows,
    governanceCreatedCount: governanceSynthesis?.createdCount ?? 0,
    governanceAppliedCount: params.governanceReconciled?.appliedCount ?? 0,
    governancePendingCount,
    capabilityGapCount: params.capabilityInventory?.summary.gapCount ?? 0,
    criticalCapabilityGapCount: params.capabilityInventory?.summary.criticalGapCount ?? 0,
    genesisStageCount: params.genesisPlan?.stages.length ?? 0,
    genesisBlockedStageCount:
      params.genesisPlan?.stages.filter((stage) => stage.status === "blocked").length ?? 0,
    recommendedNextActions,
  };
}

async function resolveFleetProfileRuntimeState(params: {
  cfg: OpenClawConfig;
  profile: AutonomyAgentProfile;
  requesterOrigin?: import("../../tasks/task-registry.types.js").TaskDeliveryState["requesterOrigin"];
  legacyTaskFlow: PluginRuntimeTaskFlow;
  cronService?: CronServiceContract;
}): Promise<FleetProfileRuntimeState> {
  const profileSessionKey = resolveAgentMainSessionKey({
    cfg: params.cfg,
    agentId: params.profile.id,
  });
  const taskFlow = params.legacyTaskFlow.bindSession({
    sessionKey: profileSessionKey,
    requesterOrigin: params.requesterOrigin,
  });
  const latest = await maybeAutoSubmitManagedFlowSandboxReplay({
    cfg: params.cfg,
    profile: params.profile,
    profileSessionKey,
    taskFlow,
    latest: resolveLatestManagedFlowSnapshot({
      ownerKey: profileSessionKey,
      agentId: params.profile.id,
      taskFlow,
    }),
  });
  const loops = await listAutonomyLoopJobRecords({
    cfg: params.cfg,
    agentId: params.profile.id,
    cronService: params.cronService,
  });

  return {
    profile: params.profile,
    profileSessionKey,
    taskFlow,
    latest,
    loops,
    entry: buildFleetStatusEntry({
      profile: params.profile,
      latest,
      loops,
    }),
  };
}

function resolveManagedFlowHealDecision(params: {
  latest?: AutonomyManagedFlowSnapshot;
  restartBlockedFlows: boolean;
}):
  | { action: "none"; reasons: string[] }
  | { action: "start"; reasons: string[] }
  | { action: "restart"; reasons: string[] } {
  const status = params.latest?.flow?.status;
  if (!status) {
    return {
      action: "start",
      reasons: ["no managed flow recorded yet"],
    };
  }
  if (TERMINAL_AUTONOMY_FLOW_STATUSES.has(status)) {
    return {
      action: "start",
      reasons: [`latest managed flow is ${status}`],
    };
  }
  if (status === "blocked" && params.restartBlockedFlows) {
    return {
      action: "restart",
      reasons: ["latest managed flow is blocked"],
    };
  }
  return {
    action: "none",
    reasons: [],
  };
}

async function cancelManagedAutonomyFlowById(params: {
  cfg: OpenClawConfig;
  profile: AutonomyAgentProfile;
  taskFlow: BoundTaskFlowRuntime;
  targetFlowId: string;
  requestedFlowId?: string;
}): Promise<AutonomyCancelManagedFlowResult> {
  const cancelled = await params.taskFlow.cancel({
    flowId: params.targetFlowId,
    cfg: params.cfg,
  });
  const flowRecord =
    cancelled.flow ??
    (cancelled.found
      ? params.taskFlow.get(params.targetFlowId)
      : undefined);
  const taskRecords = cancelled.tasks ?? (flowRecord ? listTasksForFlowId(flowRecord.flowId) : undefined);
  const snapshot =
    flowRecord && taskRecords
      ? createManagedFlowSnapshot({
          agentId: params.profile.id,
          flow: flowRecord,
          tasks: taskRecords,
        })
      : undefined;

  return {
    profile: params.profile,
    ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
    targetFlowId: params.targetFlowId,
    outcome: {
      found: cancelled.found,
      cancelled: cancelled.cancelled,
      ...(cancelled.reason ? { reason: cancelled.reason } : {}),
      ...(snapshot?.flow ? { flow: snapshot.flow } : {}),
      ...(snapshot?.seedTask ? { seedTask: snapshot.seedTask } : {}),
    },
  };
}

async function submitManagedAutonomySandboxReplay(params: {
  cfg: OpenClawConfig;
  profile: AutonomyAgentProfile;
  taskFlow: BoundTaskFlowRuntime;
  targetFlowId: string;
  requestedFlowId?: string;
  input: Omit<AutonomySubmitSandboxReplayParams, "agentId">;
}): Promise<AutonomySubmitSandboxReplayResult> {
  const flowRecord = params.taskFlow.get(params.targetFlowId);
  if (!flowRecord) {
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: params.targetFlowId,
      outcome: {
        found: false,
        applied: false,
        reason: `Autonomy flow "${params.targetFlowId}" not found.`,
      },
    };
  }

  const existingTasks = listTasksForFlowId(flowRecord.flowId);
  if (
    !matchesAutonomyManagedFlow({
      agentId: params.profile.id,
      flow: flowRecord,
      tasks: existingTasks,
    })
  ) {
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: `Flow "${flowRecord.flowId}" is not managed by autonomy profile "${params.profile.id}".`,
      },
    };
  }

  if (
    flowRecord.status === "succeeded" ||
    flowRecord.status === "cancelled" ||
    flowRecord.status === "lost"
  ) {
    const snapshot = createManagedFlowSnapshot({
      agentId: params.profile.id,
      flow: flowRecord,
      tasks: existingTasks,
    });
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: `Flow "${flowRecord.flowId}" is already terminal with status "${flowRecord.status}".`,
        flow: snapshot.flow,
        ...(snapshot.seedTask ? { seedTask: snapshot.seedTask } : {}),
      },
    };
  }

  const autonomyState = params.taskFlow.getManagedAutonomy(flowRecord.flowId);
  const project = autonomyState?.project;
  if (!autonomyState || !project) {
    const snapshot = createManagedFlowSnapshot({
      agentId: params.profile.id,
      flow: flowRecord,
      tasks: existingTasks,
    });
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: `Flow "${flowRecord.flowId}" does not contain a managed autonomy project projection.`,
        flow: snapshot.flow,
        ...(snapshot.seedTask ? { seedTask: snapshot.seedTask } : {}),
      },
    };
  }

  if (
    project.kind === "sovereignty_watch" ||
    !("sandboxUniverse" in project) ||
    !project.sandboxUniverse ||
    !project.sandboxController ||
    !project.sandboxReplayRunner
  ) {
    const snapshot = createManagedFlowSnapshot({
      agentId: params.profile.id,
      flow: flowRecord,
      tasks: existingTasks,
    });
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: `Flow "${flowRecord.flowId}" does not expose a sandbox replay runner.`,
        flow: snapshot.flow,
        ...(snapshot.seedTask ? { seedTask: snapshot.seedTask } : {}),
      },
    };
  }

  const observedAt = Date.now();
  const replayResult = runSandboxUniverseReplayRunner({
    cfg: params.cfg,
    plan: project.sandboxUniverse,
    controller: project.sandboxController,
    replayRunner: project.sandboxReplayRunner,
    replayPassed: params.input.replayPassed,
    qaPassed: params.input.qaPassed,
    ...(params.input.auditPassed !== undefined ? { auditPassed: params.input.auditPassed } : {}),
    observedAt,
    producedByAgentId: params.profile.id,
    stateDir: resolveAutonomySandboxStateDir(),
  });
  const updatedProject = applySandboxReplayResultToProject({
    project,
    replayResult,
  });
  const currentStep = resolveSandboxReplayCurrentStep({
    project: updatedProject,
    replayResult,
  });
  const updatedAutonomy = {
    ...autonomyState,
    currentStep,
    project: updatedProject,
  };
  const patchedAutonomy = params.taskFlow.setManagedAutonomy({
    flowId: flowRecord.flowId,
    expectedRevision: flowRecord.revision,
    autonomy: updatedAutonomy,
    currentStep,
    updatedAt: observedAt,
  });
  if (!patchedAutonomy.applied) {
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: explainManagedFlowMutationFailure({
          action: "persist sandbox replay state",
          code: patchedAutonomy.code,
          flowId: flowRecord.flowId,
        }),
      },
    };
  }

  const blockedSummary = resolveSandboxReplayBlockedSummary(replayResult);
  const flowMutation = replayResult.decision.canPromote
    ? params.taskFlow.finish({
        flowId: flowRecord.flowId,
        expectedRevision: patchedAutonomy.flow.revision,
        currentStep,
        stateJson: patchedAutonomy.flow.stateJson,
        updatedAt: observedAt,
        endedAt: observedAt,
      })
    : replayResult.replayRunner.lastRun &&
        (!replayResult.replayRunner.lastRun.replayPassed ||
          !replayResult.replayRunner.lastRun.qaPassed ||
          !replayResult.replayRunner.lastRun.auditPassed)
      ? params.taskFlow.fail({
          flowId: flowRecord.flowId,
          expectedRevision: patchedAutonomy.flow.revision,
          currentStep,
          stateJson: patchedAutonomy.flow.stateJson,
          blockedSummary,
          updatedAt: observedAt,
          endedAt: observedAt,
        })
      : params.taskFlow.setWaiting({
          flowId: flowRecord.flowId,
          expectedRevision: patchedAutonomy.flow.revision,
          currentStep,
          stateJson: patchedAutonomy.flow.stateJson,
          waitJson: buildSandboxReplayWaitJson(replayResult),
          blockedSummary,
          updatedAt: observedAt,
        });

  if (!flowMutation.applied) {
    return {
      profile: params.profile,
      ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
      targetFlowId: flowRecord.flowId,
      outcome: {
        found: true,
        applied: false,
        reason: explainManagedFlowMutationFailure({
          action: "apply sandbox replay outcome",
          code: flowMutation.code,
          flowId: flowRecord.flowId,
        }),
      },
    };
  }

  const finalTasks = listTasksForFlowId(flowMutation.flow.flowId);
  const snapshot = createManagedFlowSnapshot({
    agentId: params.profile.id,
    flow: flowMutation.flow,
    tasks: finalTasks,
  });
  return {
    profile: params.profile,
    ...(params.requestedFlowId ? { requestedFlowId: params.requestedFlowId } : {}),
    targetFlowId: flowMutation.flow.flowId,
    outcome: {
      found: true,
      applied: true,
      flow: snapshot.flow,
      ...(snapshot.seedTask ? { seedTask: snapshot.seedTask } : {}),
      sandboxController: replayResult.controller,
      sandboxReplayRunner: replayResult.replayRunner,
      decision: replayResult.decision,
    },
  };
}

function createManagedAutonomyFlow(params: {
  cfg: OpenClawConfig;
  ownerKey: string;
  taskFlow: BoundTaskFlowRuntime;
  profile: AutonomyAgentProfile;
  charterDir?: string;
  workspaceDir?: string;
  automationMode?: ManagedAutonomyFlowAutomationMode;
  input: Omit<AutonomyStartManagedFlowParams, "agentId">;
}): AutonomyStartManagedFlowResult {
  const controllerId =
    normalizeOptionalString(params.input.controllerId) ?? params.profile.bootstrap.controllerId;
  const requestedGoal =
    normalizeOptionalString(params.input.goal) ?? params.profile.bootstrap.defaultGoal;
  const requestedCurrentStep =
    params.input.currentStep === null
      ? undefined
      : normalizeOptionalString(params.input.currentStep) ??
        params.profile.bootstrap.defaultCurrentStep;
  const workspaceDirs = resolveAutonomyWorkspaceDirs({
    cfg: params.cfg,
    sessionKey: params.ownerKey,
    agentIds: [params.profile.id],
    workspaceDirs: params.input.workspaceDirs,
    boundWorkspaceDir: params.workspaceDir,
  });
  const structuredPlan = resolveManagedAutonomyFlowPlan({
    automationMode: params.automationMode ?? "manual",
    profile: params.profile,
    goal: requestedGoal,
    workspaceDirs,
    cfg: params.cfg,
    charterDir: params.charterDir,
  });
  const goal = structuredPlan?.goal ?? requestedGoal;
  const currentStep = structuredPlan?.currentStep ?? requestedCurrentStep;

  const created = params.taskFlow.createManaged({
    controllerId,
    goal,
    status: params.input.status ?? "running",
    notifyPolicy: params.input.notifyPolicy ?? "state_changes",
    currentStep,
    stateJson: resolveAutonomyStateJson({
      profile: params.profile,
      controllerId,
      goal,
      currentStep,
      workspaceDirs,
      stateJson: mergeAutonomyStateJson(params.input.stateJson ?? null, structuredPlan?.stateJson),
    }),
    ...(params.input.waitJson !== undefined ? { waitJson: params.input.waitJson } : {}),
  });

  let seedTask = undefined;
  const seedConfig = params.input.seedTask === false ? undefined : params.input.seedTask;
  const seedEnabled = params.input.seedTask === false ? false : seedConfig?.enabled !== false;
  const taskTemplates =
    seedEnabled
      ? seedConfig
        ? [
            {
              ...params.profile.bootstrap.seedTask,
              ...(seedConfig.runtime ? { runtime: seedConfig.runtime } : {}),
              ...(seedConfig.label !== undefined ? { label: seedConfig.label } : {}),
              ...(seedConfig.task !== undefined ? { task: seedConfig.task } : {}),
              ...(seedConfig.status ? { status: seedConfig.status } : {}),
              ...(seedConfig.progressSummary !== undefined
                ? { progressSummary: seedConfig.progressSummary }
                : {}),
            } satisfies ManagedAutonomyTaskTemplate,
          ]
        : structuredPlan?.tasks?.length
          ? structuredPlan.tasks
          : [params.profile.bootstrap.seedTask]
      : [];
  if (taskTemplates.length > 0) {
    const governanceRuntime = createAgentGovernanceRuntimeSnapshot({
      cfg: params.cfg,
      agentId: params.profile.id,
      charterDir: params.charterDir,
    });
    for (const [index, template] of taskTemplates.entries()) {
      const seeded = params.taskFlow.runTask({
        flowId: created.flowId,
        runtime: template.runtime,
        sourceId: normalizeOptionalString(seedConfig?.sourceId) ?? controllerId,
        agentId: params.profile.id,
        runId: index === 0 ? normalizeOptionalString(seedConfig?.runId) : undefined,
        governanceRuntime,
        label: template.label,
        task: augmentSeedTaskTextWithWorkspaceScope(template.task, workspaceDirs),
        preferMetadata: index === 0 ? seedConfig?.preferMetadata : undefined,
        deliveryStatus: index === 0 ? seedConfig?.deliveryStatus : undefined,
        status: template.status,
        startedAt: index === 0 ? seedConfig?.startedAt : undefined,
        lastEventAt: index === 0 ? seedConfig?.lastEventAt : undefined,
        progressSummary:
          normalizeOptionalString(template.progressSummary) ?? null,
      });
      if (!seeded.created) {
        throw new Error(seeded.reason);
      }
      if (index === 0) {
        seedTask = mapTaskRunDetail(seeded.task);
      }
    }
  }

  const flow = resolveFlowDetailForOwner({
    ownerKey: params.ownerKey,
    flowId: created.flowId,
  });
  if (!flow) {
    throw new Error(`Autonomy flow "${created.flowId}" was created but could not be reloaded.`);
  }

  return {
    profile: params.profile,
    flow,
    ...(seedTask ? { seedTask } : {}),
  };
}

function createBoundAutonomyRuntime(params: {
  sessionKey: string;
  requesterOrigin?: import("../../tasks/task-registry.types.js").TaskDeliveryState["requesterOrigin"];
  legacyTaskFlow: PluginRuntimeTaskFlow;
  charterDir?: string;
  cronService?: CronServiceContract;
  workspaceDir?: string;
}): BoundAutonomyRuntime {
  const ownerKey = assertSessionKey(
    params.sessionKey,
    "Autonomy runtime requires a bound sessionKey.",
  );
  const requesterOrigin = params.requesterOrigin
    ? normalizeDeliveryContext(params.requesterOrigin)
    : undefined;
  const taskFlow = params.legacyTaskFlow.bindSession({
    sessionKey: ownerKey,
    requesterOrigin,
  });

  const upsertLoopJob = async (
    input: AutonomyLoopUpsertParams,
  ): Promise<AutonomyLoopUpsertResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const profile = assertManagedAutonomyProfile({
      cfg,
      agentId: normalizeAgentId(input.agentId),
      charterDir: params.charterDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: [profile.id],
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    const cron = resolveAutonomyCronService({
      cfg,
      cronService: params.cronService,
    });
    const existing = await listAutonomyLoopJobRecords({
      cfg,
      agentId: profile.id,
      cronService: cron,
    });
    const [primary, ...duplicates] = existing;
    const loopTemplate = profile.bootstrap.loop;
    const fallbackEveryMs =
      primary?.schedule.kind === "every"
        ? primary.schedule.everyMs
        : loopTemplate.schedule.everyMs;
    const everyMs = resolveLoopEveryMs(input.everyMs, fallbackEveryMs);
    const sessionKey = resolveAgentMainSessionKey({
      cfg,
      agentId: profile.id,
    });

    const created = primary === undefined;
    const job = created
      ? await cron.add({
          name: loopTemplate.name,
          description: buildAutonomyLoopDescription(
            profile.id,
            loopTemplate.description,
            workspaceDirs,
          ),
          agentId: profile.id,
          sessionKey,
          enabled: true,
          schedule: {
            kind: "every",
            everyMs,
          },
          sessionTarget: loopTemplate.sessionTarget,
          wakeMode: loopTemplate.wakeMode,
          payload: {
            kind: "agentTurn",
            message: buildAutonomyLoopPayloadMessage(profile.id, loopTemplate.message, workspaceDirs),
          },
        })
      : await cron.update(primary.id, {
          name: loopTemplate.name,
          description: buildAutonomyLoopDescription(
            profile.id,
            loopTemplate.description,
            workspaceDirs,
          ),
          agentId: profile.id,
          sessionKey,
          enabled: true,
          schedule: {
            kind: "every",
            everyMs,
          },
          sessionTarget: loopTemplate.sessionTarget,
          wakeMode: loopTemplate.wakeMode,
          payload: {
            kind: "agentTurn",
            message: buildAutonomyLoopPayloadMessage(profile.id, loopTemplate.message, workspaceDirs),
          },
        });

    const reconciledRemovedJobIds: string[] = [];
    for (const duplicate of duplicates) {
      const removed = await cron.remove(duplicate.id);
      if (removed.removed) {
        reconciledRemovedJobIds.push(duplicate.id);
      }
    }

    return {
      profile,
      created,
      updated: !created,
      loop: createLoopJobSnapshot({
        profile,
        job: cron.getJob(job.id) ?? job,
      }),
      ...(reconciledRemovedJobIds.length > 0 ? { reconciledRemovedJobIds } : {}),
    };
  };

  const reconcileLoopJobs = async (
    input: AutonomyLoopReconcileParams,
  ): Promise<AutonomyLoopReconcileResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const profiles = resolveManagedLoopProfiles({
      cfg,
      agentIds: input.agentIds,
      charterDir: params.charterDir,
    });
    const reconciled: AutonomyLoopUpsertResult[] = [];
    for (const profile of profiles) {
      const workspaceDirs = resolveAutonomyWorkspaceDirs({
        cfg,
        sessionKey: ownerKey,
        agentIds: [profile.id],
        workspaceDirs: input.workspaceDirs,
        boundWorkspaceDir,
      });
      reconciled.push(
        await upsertLoopJob({
          agentId: profile.id,
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        }),
      );
    }
    const result = {
      reconciled,
      createdCount: reconciled.filter((entry) => entry.created).length,
      updatedCount: reconciled.filter((entry) => entry.updated).length,
    };
    await recordAutonomyFleetHistory({
      sessionKey: ownerKey,
      mode: "reconcile",
      source: input.telemetrySource,
      recordHistory: input.recordHistory,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      totals: buildFleetHistoryTotalsFromReconcile(result),
      entries: result.reconciled.map((entry) => buildFleetHistoryEntryFromReconcile(entry)),
    });
    return result;
  };

  const getFleetStatus = async (
    input: AutonomyFleetStatusParams,
  ): Promise<AutonomyFleetStatusResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    const profiles = resolveManagedLoopProfiles({
      cfg,
      agentIds: input.agentIds,
      charterDir: params.charterDir,
    });
    const states = await Promise.all(
      profiles.map(async (profile) => {
        return await resolveFleetProfileRuntimeState({
          cfg,
          requesterOrigin,
          profile,
          legacyTaskFlow: params.legacyTaskFlow,
          cronService: params.cronService,
        });
      }),
    );
    const entries = states
      .map((state) => {
        const scopedWorkspaceDirs = resolvePreferredWorkspaceDirs(
          state.entry.workspaceDirs,
          resolveAutonomyWorkspaceDirs({
            cfg,
            sessionKey: state.profileSessionKey,
            agentIds: [state.profile.id],
            workspaceDirs,
            boundWorkspaceDir,
          }),
        );
        return {
          ...state.entry,
          ...resolveWorkspaceScopeMetadata(scopedWorkspaceDirs),
        };
      })
      .filter((entry) =>
        hasWorkspaceScopeIntersection({
          requestedWorkspaceDirs: workspaceDirs,
          entryWorkspaceDirs: entry.workspaceDirs,
          primaryWorkspaceDir: entry.primaryWorkspaceDir,
        }),
      );
    return {
      entries,
      totals: buildFleetStatusTotals(entries),
    };
  };

  const getCapabilityInventory = async (
    input: AutonomyCapabilityInventoryParams,
  ): Promise<AutonomyCapabilityInventoryResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    return getGovernanceCapabilityInventory({
      cfg,
      charterDir: params.charterDir,
      agentIds: input.agentIds,
      ...(workspaceDirs?.length ? { workspaceDirs } : {}),
    });
  };

  const planGenesisWork = async (
    input: AutonomyGenesisPlanParams,
  ): Promise<AutonomyGenesisPlanResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    return planGovernanceGenesisWork({
      cfg,
      charterDir: params.charterDir,
      agentIds: input.agentIds,
      ...(input.teamId ? { teamId: input.teamId } : {}),
      ...(workspaceDirs?.length ? { workspaceDirs } : {}),
    });
  };

  const synthesizeGovernanceProposals = async (
    input: AutonomyGovernanceProposalsParams,
  ): Promise<GovernanceAutonomyProposalSynthesisResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    const profiles = resolveGovernanceProposalProfiles({
      cfg,
      agentIds: input.agentIds,
      charterDir: params.charterDir,
    });
    if (profiles.length === 0) {
      const snapshot = loadGovernanceCharter({
        charterDir: params.charterDir,
      });
      return {
        observedAt: Date.now(),
        charterDir: snapshot.charterDir,
        requestedAgentIds: input.agentIds?.map((entry) => normalizeAgentId(entry)) ?? [],
        eligibleAgentIds: [],
        findingIds: [],
        results: [],
        createdCount: 0,
        existingCount: 0,
        skippedCount: 0,
      };
    }
    return await synthesizeGovernanceAutonomyProposals({
      cfg,
      charterDir: params.charterDir,
      agentIds: profiles.map((profile) => profile.id),
      createdByAgentId: resolveGovernanceProposalAuthor(profiles),
      createdBySessionKey: ownerKey,
      ...(workspaceDirs?.length ? { workspaceDirs } : {}),
    });
  };

  const reconcileGovernanceProposals = async (
    input: AutonomyGovernanceReconcileParams,
  ): Promise<AutonomyGovernanceReconcileResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const workspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    const profiles = resolveGovernanceProposalProfiles({
      cfg,
      agentIds: input.agentIds,
      charterDir: params.charterDir,
    });
    if (profiles.length === 0) {
      const snapshot = loadGovernanceCharter({
        charterDir: params.charterDir,
      });
      const observedAt = Date.now();
      const requestedAgentIds = input.agentIds?.map((entry) => normalizeAgentId(entry)) ?? [];
      return {
        observedAt,
        charterDir: snapshot.charterDir,
        requestedAgentIds,
        eligibleAgentIds: [],
        findingIds: [],
        mode: input.mode ?? "apply_safe",
        synthesized: {
          observedAt,
          charterDir: snapshot.charterDir,
          requestedAgentIds,
          eligibleAgentIds: [],
          findingIds: [],
          results: [],
          createdCount: 0,
          existingCount: 0,
          skippedCount: 0,
        },
        entries: [],
        reviewedCount: 0,
        appliedCount: 0,
        skippedCount: 0,
      };
    }
    const author = resolveGovernanceProposalAuthor(profiles);
    return await reconcileControlPlaneGovernanceProposals({
      cfg,
      charterDir: params.charterDir,
      agentIds: profiles.map((profile) => profile.id),
      ...(workspaceDirs?.length ? { workspaceDirs } : {}),
      ...(author ? { createdByAgentId: author } : {}),
      createdBySessionKey: ownerKey,
      ...(typeof input.decisionNote === "string" ? { decisionNote: input.decisionNote } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
    });
  };

  const healFleet = async (
    input: AutonomyFleetHealParams,
  ): Promise<AutonomyFleetHealResult> => {
    const cfg = resolveRuntimeConfig();
    const boundWorkspaceDir = resolveBoundAutonomyWorkspaceDir({
      cfg,
      sessionKey: ownerKey,
      workspaceDir: params.workspaceDir,
    });
    const profiles = resolveManagedLoopProfiles({
      cfg,
      agentIds: input.agentIds,
      charterDir: params.charterDir,
    });
    const restartBlockedFlows = input.restartBlockedFlows ?? true;
    const entries: AutonomyFleetHealEntry[] = [];

    for (const profile of profiles) {
      const before = await resolveFleetProfileRuntimeState({
        cfg,
        requesterOrigin,
        profile,
        legacyTaskFlow: params.legacyTaskFlow,
        cronService: params.cronService,
      });
      const workspaceDirs = resolveAutonomyWorkspaceDirs({
        cfg,
        sessionKey: before.profileSessionKey,
        agentIds: [profile.id],
        workspaceDirs: input.workspaceDirs,
        boundWorkspaceDir,
      });

      let loopAction: AutonomyFleetHealEntry["loopAction"] = "none";
      let flowAction: AutonomyFleetHealEntry["flowAction"] = "none";
      let started:
        | AutonomyStartManagedFlowResult
        | undefined;
      let cancelledBeforeRestart:
        | AutonomyCancelManagedFlowResult
        | undefined;
      const reasons: string[] = [];

      if (hasLoopReconcileDrift(before.entry)) {
        const upserted = await upsertLoopJob({
          agentId: profile.id,
          ...(workspaceDirs?.length ? { workspaceDirs } : {}),
        });
        loopAction = upserted.created ? "created" : "updated";
        reasons.push(
          ...before.entry.driftReasons.filter((reason) => /loop|duplicate/i.test(reason)),
        );
      }

      const flowDecision = resolveManagedFlowHealDecision({
        latest: before.latest,
        restartBlockedFlows,
      });
      reasons.push(...flowDecision.reasons);
      if (flowDecision.action === "restart") {
        const targetFlowId = before.latest?.flow?.id;
        if (targetFlowId) {
          cancelledBeforeRestart = await cancelManagedAutonomyFlowById({
            cfg,
            profile,
            taskFlow: before.taskFlow,
            targetFlowId,
          });
          if (cancelledBeforeRestart.outcome.cancelled) {
            started = createManagedAutonomyFlow({
              cfg,
              ownerKey: before.profileSessionKey,
              taskFlow: before.taskFlow,
              profile,
              charterDir: params.charterDir,
              workspaceDir: boundWorkspaceDir,
              automationMode: "autonomous",
              input: {
                ...(workspaceDirs?.length ? { workspaceDirs } : {}),
              },
            });
            flowAction = "restarted";
            reasons.push(`cancelled blocked flow "${targetFlowId}" before restart`);
          } else {
            reasons.push(
              cancelledBeforeRestart.outcome.reason ??
                `failed to cancel blocked flow "${targetFlowId}" before restart`,
            );
          }
        }
      } else if (flowDecision.action === "start") {
        started = createManagedAutonomyFlow({
          cfg,
          ownerKey: before.profileSessionKey,
          taskFlow: before.taskFlow,
          profile,
          charterDir: params.charterDir,
          workspaceDir: boundWorkspaceDir,
          automationMode: "autonomous",
          input: {
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          },
        });
        flowAction = "started";
      }

      const after =
        loopAction !== "none" || flowAction !== "none"
          ? await resolveFleetProfileRuntimeState({
              cfg,
              requesterOrigin,
              profile,
              legacyTaskFlow: params.legacyTaskFlow,
              cronService: params.cronService,
            })
          : before;

      entries.push({
        agentId: profile.id,
        profile,
        healthBefore: before.entry.health,
        healthAfter: after.entry.health,
        loopAction,
        flowAction,
        ...resolveWorkspaceScopeMetadata(
          resolvePreferredWorkspaceDirs(
            workspaceDirs,
            after.entry.workspaceDirs,
            before.entry.workspaceDirs,
          ),
        ),
        ...(before.entry.latestFlow ? { latestFlowBefore: before.entry.latestFlow } : {}),
        ...(after.entry.latestFlow ? { latestFlowAfter: after.entry.latestFlow } : {}),
        ...(before.entry.latestSeedTask ? { latestSeedTaskBefore: before.entry.latestSeedTask } : {}),
        ...(after.entry.latestSeedTask ? { latestSeedTaskAfter: after.entry.latestSeedTask } : {}),
        ...(before.entry.loopJob ? { loopBefore: before.entry.loopJob } : {}),
        ...(after.entry.loopJob ? { loopAfter: after.entry.loopJob } : {}),
        ...(cancelledBeforeRestart?.outcome.flow
          ? { cancelledFlowBeforeRestart: cancelledBeforeRestart.outcome.flow }
          : {}),
        ...(cancelledBeforeRestart?.outcome.seedTask
          ? { cancelledSeedTaskBeforeRestart: cancelledBeforeRestart.outcome.seedTask }
          : {}),
        ...(started?.flow ? { startedFlow: started.flow } : {}),
        ...(started?.seedTask ? { startedSeedTask: started.seedTask } : {}),
        reasons: Array.from(new Set(reasons)),
      });
    }

    const governanceProposalAgentIds = profiles
      .filter(
        (profile) =>
          profile.id === "founder" || profile.id === "strategist" || profile.id === "librarian",
      )
      .map((profile) => profile.id);
    const governanceProposalWorkspaceDirs = resolveAutonomyWorkspaceDirs({
      cfg,
      sessionKey: ownerKey,
      agentIds: governanceProposalAgentIds,
      workspaceDirs: input.workspaceDirs,
      boundWorkspaceDir,
    });
    const governanceProposals =
      input.synthesizeGovernanceProposals !== false && governanceProposalAgentIds.length > 0
        ? await synthesizeGovernanceProposals({
            agentIds: governanceProposalAgentIds,
            ...(governanceProposalWorkspaceDirs?.length
              ? { workspaceDirs: governanceProposalWorkspaceDirs }
              : {}),
          })
        : undefined;

    const result = {
      entries,
      totals: {
        totalProfiles: entries.length,
        changed: entries.filter(
          (entry) => entry.loopAction !== "none" || entry.flowAction !== "none",
        ).length,
        unchanged: entries.filter(
          (entry) => entry.loopAction === "none" && entry.flowAction === "none",
        ).length,
        loopCreated: entries.filter((entry) => entry.loopAction === "created").length,
        loopUpdated: entries.filter((entry) => entry.loopAction === "updated").length,
        flowStarted: entries.filter((entry) => entry.flowAction !== "none").length,
        flowRestarted: entries.filter((entry) => entry.flowAction === "restarted").length,
      },
      ...(governanceProposals ? { governanceProposals } : {}),
    };
    await recordAutonomyFleetHistory({
      sessionKey: ownerKey,
      mode: "heal",
      source: input.telemetrySource,
      recordHistory: input.recordHistory,
      agentIds: input.agentIds,
      workspaceDirs: input.workspaceDirs,
      totals: buildFleetHistoryTotalsFromHeal(result),
      entries: result.entries.map((entry) => buildFleetHistoryEntryFromHeal(entry)),
    });
    return result;
  };

  const superviseFleet = async (
    input: AutonomySupervisorParams,
  ): Promise<AutonomySupervisorResult> => {
    const governanceMode: AutonomySupervisorGovernanceMode = input.governanceMode ?? "apply_safe";
    const overviewBefore = await getFleetStatus({
      ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
      ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
    });
    const healed = await healFleet({
      ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
      ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
      ...(typeof input.restartBlockedFlows === "boolean"
        ? { restartBlockedFlows: input.restartBlockedFlows }
        : {}),
      telemetrySource: "supervisor",
      recordHistory: input.recordHistory ?? true,
      synthesizeGovernanceProposals: governanceMode === "none",
    });

    const governanceReconciled =
      governanceMode === "none"
        ? undefined
        : await reconcileGovernanceProposals({
            ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
            ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
            mode: governanceMode,
            decisionNote:
              input.decisionNote ??
              `Autonomy supervisor reconcile pass (${governanceMode}) for managed fleet.`,
          });

    const [capabilityInventory, genesisPlan] = await Promise.all([
      input.includeCapabilityInventory === false
        ? Promise.resolve<AutonomyCapabilityInventoryResult | undefined>(undefined)
        : getCapabilityInventory({
            ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
            ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
          }),
      input.includeGenesisPlan === false
        ? Promise.resolve<AutonomyGenesisPlanResult | undefined>(undefined)
        : planGenesisWork({
            ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
            ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
            ...(typeof input.teamId === "string" ? { teamId: input.teamId } : {}),
          }),
    ]);

    const overviewAfter = await getFleetStatus({
      ...(input.agentIds?.length ? { agentIds: input.agentIds } : {}),
      ...(input.workspaceDirs?.length ? { workspaceDirs: input.workspaceDirs } : {}),
    });

    return {
      observedAt: Date.now(),
      governanceMode,
      overviewBefore,
      healed,
      ...(governanceReconciled ? { governanceReconciled } : {}),
      ...(capabilityInventory ? { capabilityInventory } : {}),
      ...(genesisPlan ? { genesisPlan } : {}),
      overviewAfter,
      summary: buildAutonomySupervisorSummary({
        overviewAfter,
        healed,
        ...(governanceReconciled ? { governanceReconciled } : {}),
        ...(capabilityInventory ? { capabilityInventory } : {}),
        ...(genesisPlan ? { genesisPlan } : {}),
      }),
    };
  };

  return {
    sessionKey: ownerKey,
    ...(requesterOrigin ? { requesterOrigin } : {}),
    listProfiles: () =>
      listAutonomyProfiles({
        cfg: resolveRuntimeConfig(),
        charterDir: params.charterDir,
      }),
    getProfile: (agentId) =>
      resolveAutonomyProfile({
        cfg: resolveRuntimeConfig(),
        agentId: normalizeAgentId(agentId),
        charterDir: params.charterDir,
      }),
    getLatestManagedFlowSnapshot: (agentId) =>
      resolveLatestManagedFlowSnapshot({
        ownerKey,
        agentId,
        taskFlow,
      }),
    listLoopJobs: async () => {
      const cfg = resolveRuntimeConfig();
      return await listAutonomyLoopJobSnapshots({
        cfg,
        profiles: listAutonomyProfiles({
          cfg,
          charterDir: params.charterDir,
        }),
        cronService: params.cronService,
      });
    },
    getLoopJob: async (agentId) => {
      const cfg = resolveRuntimeConfig();
      const profile = resolveAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(agentId),
        charterDir: params.charterDir,
      });
      if (!profile) {
        return undefined;
      }
      const job = (
        await listAutonomyLoopJobRecords({
          cfg,
          agentId: profile.id,
          cronService: params.cronService,
        })
      )[0];
      return job
        ? createLoopJobSnapshot({
            profile,
            job,
          })
        : undefined;
    },
    getFleetHistory: async (
      input: AutonomyFleetHistoryParams,
    ): Promise<AutonomyFleetHistoryResult> => {
      return await listAutonomyFleetHistory(input);
    },
    getCapabilityInventory,
    planGenesisWork,
    startManagedFlow: (input: AutonomyStartManagedFlowParams): AutonomyStartManagedFlowResult => {
      const cfg = resolveRuntimeConfig();
      const profile = assertManagedAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(input.agentId),
        charterDir: params.charterDir,
      });
      return createManagedAutonomyFlow({
        cfg,
        ownerKey,
        taskFlow,
        profile,
        charterDir: params.charterDir,
        workspaceDir: params.workspaceDir,
        input,
      });
    },
    cancelManagedFlow: async (
      input: AutonomyCancelManagedFlowParams,
    ): Promise<AutonomyCancelManagedFlowResult> => {
      const cfg = resolveRuntimeConfig();
      const profile = assertManagedAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(input.agentId),
        charterDir: params.charterDir,
      });
      const requestedFlowId = normalizeOptionalString(input.flowId);

      let targetFlowId = requestedFlowId;
      if (requestedFlowId) {
        const flow = taskFlow.get(requestedFlowId);
        if (!flow) {
          return {
            profile,
            requestedFlowId,
            outcome: {
              found: false,
              cancelled: false,
              reason: `Autonomy flow "${requestedFlowId}" not found.`,
            },
          };
        }
        const tasks = listTasksForFlowId(flow.flowId);
        if (
          !matchesAutonomyManagedFlow({
            agentId: profile.id,
            flow,
            tasks,
          })
        ) {
          return {
            profile,
            requestedFlowId,
            targetFlowId: flow.flowId,
            outcome: {
              found: false,
              cancelled: false,
              reason: `Flow "${flow.flowId}" is not managed by autonomy profile "${profile.id}".`,
            },
          };
        }
        targetFlowId = flow.flowId;
      } else {
        targetFlowId = resolveLatestManagedFlowSnapshot({
          ownerKey,
          agentId: profile.id,
          taskFlow,
        })?.flow.id;
      }

      if (!targetFlowId) {
        return {
          profile,
          ...(requestedFlowId ? { requestedFlowId } : {}),
          outcome: {
            found: false,
            cancelled: false,
            reason: `No managed autonomy flow found for "${profile.id}".`,
          },
        };
      }

      return await cancelManagedAutonomyFlowById({
        cfg,
        profile,
        taskFlow,
        targetFlowId,
        ...(requestedFlowId ? { requestedFlowId } : {}),
      });
    },
    submitSandboxReplay: async (
      input: AutonomySubmitSandboxReplayParams,
    ): Promise<AutonomySubmitSandboxReplayResult> => {
      const cfg = resolveRuntimeConfig();
      const profile = assertManagedAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(input.agentId),
        charterDir: params.charterDir,
      });
      const requestedFlowId = normalizeOptionalString(input.flowId);

      let targetFlowId = requestedFlowId;
      if (requestedFlowId) {
        const flow = taskFlow.get(requestedFlowId);
        if (!flow) {
          return {
            profile,
            requestedFlowId,
            outcome: {
              found: false,
              applied: false,
              reason: `Autonomy flow "${requestedFlowId}" not found.`,
            },
          };
        }
        const tasks = listTasksForFlowId(flow.flowId);
        if (
          !matchesAutonomyManagedFlow({
            agentId: profile.id,
            flow,
            tasks,
          })
        ) {
          return {
            profile,
            requestedFlowId,
            targetFlowId: flow.flowId,
            outcome: {
              found: true,
              applied: false,
              reason: `Flow "${flow.flowId}" is not managed by autonomy profile "${profile.id}".`,
            },
          };
        }
        targetFlowId = flow.flowId;
      } else {
        targetFlowId = resolveLatestManagedFlowSnapshot({
          ownerKey,
          agentId: profile.id,
          taskFlow,
        })?.flow.id;
      }

      if (!targetFlowId) {
        return {
          profile,
          ...(requestedFlowId ? { requestedFlowId } : {}),
          outcome: {
            found: false,
            applied: false,
            reason: `No managed autonomy flow found for "${profile.id}".`,
          },
        };
      }

      return await submitManagedAutonomySandboxReplay({
        cfg,
        profile,
        taskFlow,
        targetFlowId,
        ...(requestedFlowId ? { requestedFlowId } : {}),
        input: {
          replayPassed: input.replayPassed,
          qaPassed: input.qaPassed,
          ...(input.auditPassed !== undefined ? { auditPassed: input.auditPassed } : {}),
        },
      });
    },
    showLoopJob: async (input: AutonomyLoopShowParams): Promise<AutonomyLoopShowResult> => {
      const cfg = resolveRuntimeConfig();
      const profile = assertManagedAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(input.agentId),
        charterDir: params.charterDir,
      });
      const loop = await listAutonomyLoopJobRecords({
        cfg,
        agentId: profile.id,
        cronService: params.cronService,
      });
      return {
        profile,
        ...(loop[0]
          ? {
              loop: createLoopJobSnapshot({
                profile,
                job: loop[0],
              }),
            }
          : {}),
      };
    },
    upsertLoopJob,
    reconcileLoopJobs,
    getFleetStatus,
    synthesizeGovernanceProposals,
    reconcileGovernanceProposals,
    healFleet,
    superviseFleet,
    removeLoopJob: async (
      input: AutonomyLoopRemoveParams,
    ): Promise<AutonomyLoopRemoveResult> => {
      const cfg = resolveRuntimeConfig();
      const profile = assertManagedAutonomyProfile({
        cfg,
        agentId: normalizeAgentId(input.agentId),
        charterDir: params.charterDir,
      });
      const cron = resolveAutonomyCronService({
        cfg,
        cronService: params.cronService,
      });
      const requestedJobId = normalizeOptionalString(input.jobId);
      const matchingJobs = await listAutonomyLoopJobRecords({
        cfg,
        agentId: profile.id,
        cronService: cron,
      });

      if (requestedJobId) {
        const target = matchingJobs.find((job) => job.id === requestedJobId);
        if (!target) {
          return {
            profile,
            requestedJobId,
            removed: false,
            removedJobIds: [],
            reason: `Managed autonomy loop job "${requestedJobId}" not found for "${profile.id}".`,
          };
        }
        const removed = await cron.remove(target.id);
        return {
          profile,
          requestedJobId,
          targetJobId: target.id,
          removed: removed.removed,
          removedJobIds: removed.removed ? [target.id] : [],
          ...(removed.removed
            ? {}
            : {
                reason: `Failed to remove managed autonomy loop job "${target.id}" for "${profile.id}".`,
              }),
        };
      }

      if (matchingJobs.length === 0) {
        return {
          profile,
          removed: false,
          removedJobIds: [],
          reason: `No managed autonomy loop found for "${profile.id}".`,
        };
      }

      const removedJobIds: string[] = [];
      for (const job of matchingJobs) {
        const removed = await cron.remove(job.id);
        if (removed.removed) {
          removedJobIds.push(job.id);
        }
      }

      return {
        profile,
        targetJobId: matchingJobs[0]?.id,
        removed: removedJobIds.length > 0,
        removedJobIds,
        ...(removedJobIds.length > 0
          ? {}
          : {
              reason: `Failed to remove managed autonomy loop for "${profile.id}".`,
            }),
      };
    },
  };
}

export function createRuntimeAutonomy(params: {
  legacyTaskFlow: PluginRuntimeTaskFlow;
  charterDir?: string;
  cronService?: CronServiceContract;
}): PluginRuntimeAutonomy {
  return {
    bindSession: (input) =>
      createBoundAutonomyRuntime({
        sessionKey: input.sessionKey,
        requesterOrigin: input.requesterOrigin,
        workspaceDir: input.workspaceDir,
        legacyTaskFlow: params.legacyTaskFlow,
        charterDir: params.charterDir,
        cronService: params.cronService,
      }),
    fromToolContext: (ctx) =>
      createBoundAutonomyRuntime({
        sessionKey: assertSessionKey(
          ctx.sessionKey,
          "Autonomy runtime requires tool context with a sessionKey.",
        ),
        requesterOrigin: ctx.deliveryContext,
        workspaceDir: ctx.workspaceDir,
        legacyTaskFlow: params.legacyTaskFlow,
        charterDir: params.charterDir,
        cronService: params.cronService,
      }),
  };
}
