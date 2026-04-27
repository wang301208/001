import type { AgentGovernanceRuntimeContract } from "../../governance/runtime-contract.js";
import type { GovernanceAutonomyProposalSynthesisResult } from "../../governance/autonomy-proposals.js";
import type { GovernanceProposalsReconcileResult } from "../../governance/control-plane.js";
import type {
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
} from "../../governance/capability-registry.js";
import type { CronJob } from "../../cron/types.js";
import type {
  SandboxUniverseControllerState,
  SandboxUniversePromotionGateDecision,
  SandboxUniverseReplayRunnerState,
} from "../../governance/sandbox-universe.js";
import type { JsonValue } from "../../tasks/task-flow-registry.types.js";
import type {
  TaskDeliveryState,
  TaskDeliveryStatus,
  TaskNotifyPolicy,
  TaskRuntime,
} from "../../tasks/task-registry.types.js";
import type { OpenClawPluginToolContext } from "../tool-types.js";
import type { TaskFlowDetail, TaskRunDetail } from "./task-domain-types.js";

export type AutonomySeedTaskTemplate = {
  runtime: TaskRuntime;
  label: string;
  task: string;
  status: "queued" | "running";
  progressSummary?: string;
};

export type AutonomyLoopTemplate = {
  mode: "managed-flow";
  name: string;
  description: string;
  schedule: {
    kind: "every";
    everyMs: number;
  };
  sessionTarget: "isolated";
  wakeMode: "now";
  message: string;
};

export type AutonomyBootstrapTemplate = {
  controllerId: string;
  defaultGoal: string;
  defaultCurrentStep: string;
  recommendedGoals: string[];
  seedTask: AutonomySeedTaskTemplate;
  loop: AutonomyLoopTemplate;
};

export type AutonomyAgentProfile = {
  id: string;
  name?: string;
  layer?: string;
  missionPrimary?: string;
  authorityLevel?: string;
  collaborators: string[];
  reportsTo: string[];
  mutationAllow: string[];
  mutationDeny: string[];
  networkDefault?: string;
  networkConditions: string[];
  runtimeHooks: string[];
  resourceBudget?: AgentGovernanceRuntimeContract["resourceBudget"];
  contract: AgentGovernanceRuntimeContract;
  bootstrap: AutonomyBootstrapTemplate;
};

export type AutonomyStartManagedFlowParams = {
  agentId: string;
  goal?: string;
  controllerId?: string;
  currentStep?: string | null;
  workspaceDirs?: string[];
  notifyPolicy?: TaskNotifyPolicy;
  status?: "queued" | "running";
  stateJson?: JsonValue | null;
  waitJson?: JsonValue | null;
  seedTask?:
    | false
    | ({
        enabled?: boolean;
        sourceId?: string;
        runId?: string;
        preferMetadata?: boolean;
        deliveryStatus?: TaskDeliveryStatus;
        startedAt?: number;
        lastEventAt?: number;
      } & Partial<AutonomySeedTaskTemplate>);
};

export type AutonomyStartManagedFlowResult = {
  profile: AutonomyAgentProfile;
  flow: TaskFlowDetail;
  seedTask?: TaskRunDetail;
};

export type AutonomyCancelManagedFlowParams = {
  agentId: string;
  flowId?: string;
};

export type AutonomyCancelManagedFlowOutcome = {
  found: boolean;
  cancelled: boolean;
  reason?: string;
  flow?: TaskFlowDetail;
  seedTask?: TaskRunDetail;
};

export type AutonomyCancelManagedFlowResult = {
  profile: AutonomyAgentProfile;
  requestedFlowId?: string;
  targetFlowId?: string;
  outcome: AutonomyCancelManagedFlowOutcome;
};

export type AutonomySubmitSandboxReplayParams = {
  agentId: string;
  flowId?: string;
  replayPassed: boolean;
  qaPassed: boolean;
  auditPassed?: boolean;
};

export type AutonomySubmitSandboxReplayOutcome = {
  found: boolean;
  applied: boolean;
  reason?: string;
  flow?: TaskFlowDetail;
  seedTask?: TaskRunDetail;
  sandboxController?: SandboxUniverseControllerState;
  sandboxReplayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
};

export type AutonomySubmitSandboxReplayResult = {
  profile: AutonomyAgentProfile;
  requestedFlowId?: string;
  targetFlowId?: string;
  outcome: AutonomySubmitSandboxReplayOutcome;
};

export type AutonomyManagedFlowSnapshot = {
  flow: TaskFlowDetail;
  seedTask?: TaskRunDetail;
};

export type AutonomyLoopJobSnapshot = {
  agentId: string;
  mode: "managed-flow";
  job: CronJob;
  workspaceDirs?: string[];
  primaryWorkspaceDir?: string;
};

export type AutonomyLoopShowParams = {
  agentId: string;
};

export type AutonomyLoopShowResult = {
  profile: AutonomyAgentProfile;
  loop?: AutonomyLoopJobSnapshot;
};

export type AutonomyLoopUpsertParams = {
  agentId: string;
  everyMs?: number;
  workspaceDirs?: string[];
};

export type AutonomyLoopUpsertResult = {
  profile: AutonomyAgentProfile;
  created: boolean;
  updated: boolean;
  loop: AutonomyLoopJobSnapshot;
  reconciledRemovedJobIds?: string[];
};

export type AutonomyLoopReconcileParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
  telemetrySource?: AutonomyFleetHistorySource;
  recordHistory?: boolean;
};

export type AutonomyLoopReconcileResult = {
  reconciled: AutonomyLoopUpsertResult[];
  createdCount: number;
  updatedCount: number;
};

export type AutonomyFleetStatusHealth = "healthy" | "idle" | "drift" | "missing_loop";

export type AutonomyFleetStatusEntry = {
  agentId: string;
  profile: AutonomyAgentProfile;
  latestFlow?: TaskFlowDetail;
  latestSeedTask?: TaskRunDetail;
  loopJob?: AutonomyLoopJobSnapshot;
  workspaceDirs?: string[];
  primaryWorkspaceDir?: string;
  duplicateLoopCount: number;
  expectedLoopEveryMs: number;
  actualLoopEveryMs?: number;
  loopCadenceAligned: boolean;
  hasActiveFlow: boolean;
  driftReasons: string[];
  suggestedAction: "observe" | "start_flow" | "inspect_flow" | "reconcile_loop";
  health: AutonomyFleetStatusHealth;
};

export type AutonomyFleetStatusParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
};

export type AutonomyFleetStatusResult = {
  entries: AutonomyFleetStatusEntry[];
  totals: {
    totalProfiles: number;
    healthy: number;
    idle: number;
    drift: number;
    missingLoop: number;
    activeFlows: number;
  };
};

export type AutonomyFleetHealLoopAction = "none" | "created" | "updated";

export type AutonomyFleetHealFlowAction = "none" | "started" | "restarted";

export type AutonomyFleetHistorySource = "manual" | "startup" | "supervisor";

export type AutonomyFleetHistoryMode = "heal" | "reconcile";

export type AutonomyFleetHistoryTotals = {
  totalProfiles: number;
  changed: number;
  unchanged: number;
  loopCreated: number;
  loopUpdated: number;
  flowStarted: number;
  flowRestarted: number;
};

export type AutonomyFleetHistoryEntry = {
  agentId: string;
  changed: boolean;
  healthBefore?: AutonomyFleetStatusHealth;
  healthAfter?: AutonomyFleetStatusHealth;
  loopAction?: AutonomyFleetHealLoopAction;
  flowAction?: AutonomyFleetHealFlowAction;
  workspaceDirs?: string[];
  primaryWorkspaceDir?: string;
  reasons: string[];
  latestFlowIdBefore?: TaskFlowDetail["id"];
  latestFlowIdAfter?: TaskFlowDetail["id"];
  latestFlowStatusBefore?: TaskFlowDetail["status"];
  latestFlowStatusAfter?: TaskFlowDetail["status"];
  latestSeedTaskStatusBefore?: TaskRunDetail["status"];
  latestSeedTaskStatusAfter?: TaskRunDetail["status"];
  startedFlowId?: TaskFlowDetail["id"];
  cancelledFlowId?: TaskFlowDetail["id"];
};

export type AutonomyFleetHistoryEvent = {
  eventId: string;
  ts: number;
  sessionKey: string;
  mode: AutonomyFleetHistoryMode;
  source: AutonomyFleetHistorySource;
  agentIds: string[];
  workspaceDirs?: string[];
  primaryWorkspaceDir?: string;
  changed: boolean;
  totals: AutonomyFleetHistoryTotals;
  entries: AutonomyFleetHistoryEntry[];
};

export type AutonomyFleetHistoryParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
  limit?: number;
  mode?: AutonomyFleetHistoryMode;
  source?: AutonomyFleetHistorySource;
};

export type AutonomyFleetHistoryResult = {
  events: AutonomyFleetHistoryEvent[];
  total: number;
  truncated: boolean;
};

export type AutonomyGovernanceProposalsParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
};

export type AutonomyGovernanceReconcileParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
  mode?: "apply_safe" | "force_apply_all";
  decisionNote?: string;
};

export type AutonomyGovernanceReconcileResult = GovernanceProposalsReconcileResult;

export type AutonomyCapabilityInventoryParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
};

export type AutonomyCapabilityInventoryResult = GovernanceCapabilityInventoryResult;

export type AutonomyGenesisPlanParams = {
  agentIds?: string[];
  teamId?: string;
  workspaceDirs?: string[];
};

export type AutonomyGenesisPlanResult = GovernanceGenesisPlanResult;

export type AutonomyFleetHealParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
  restartBlockedFlows?: boolean;
  telemetrySource?: AutonomyFleetHistorySource;
  recordHistory?: boolean;
  synthesizeGovernanceProposals?: boolean;
};

export type AutonomyFleetHealEntry = {
  agentId: string;
  profile: AutonomyAgentProfile;
  healthBefore: AutonomyFleetStatusHealth;
  healthAfter: AutonomyFleetStatusHealth;
  loopAction: AutonomyFleetHealLoopAction;
  flowAction: AutonomyFleetHealFlowAction;
  workspaceDirs?: string[];
  primaryWorkspaceDir?: string;
  latestFlowBefore?: TaskFlowDetail;
  latestFlowAfter?: TaskFlowDetail;
  latestSeedTaskBefore?: TaskRunDetail;
  latestSeedTaskAfter?: TaskRunDetail;
  loopBefore?: AutonomyLoopJobSnapshot;
  loopAfter?: AutonomyLoopJobSnapshot;
  cancelledFlowBeforeRestart?: TaskFlowDetail;
  cancelledSeedTaskBeforeRestart?: TaskRunDetail;
  startedFlow?: TaskFlowDetail;
  startedSeedTask?: TaskRunDetail;
  reasons: string[];
};

export type AutonomyFleetHealResult = {
  entries: AutonomyFleetHealEntry[];
  totals: {
    totalProfiles: number;
    changed: number;
    unchanged: number;
    loopCreated: number;
    loopUpdated: number;
    flowStarted: number;
    flowRestarted: number;
  };
  governanceProposals?: GovernanceAutonomyProposalSynthesisResult;
};

export type AutonomySupervisorGovernanceMode = "none" | "apply_safe" | "force_apply_all";

export type AutonomySupervisorParams = {
  agentIds?: string[];
  workspaceDirs?: string[];
  teamId?: string;
  restartBlockedFlows?: boolean;
  governanceMode?: AutonomySupervisorGovernanceMode;
  decisionNote?: string;
  includeCapabilityInventory?: boolean;
  includeGenesisPlan?: boolean;
  recordHistory?: boolean;
};

export type AutonomySupervisorSummary = {
  totalProfiles: number;
  changedProfiles: number;
  healthyProfiles: number;
  driftProfiles: number;
  missingLoopProfiles: number;
  activeFlows: number;
  governanceCreatedCount: number;
  governanceAppliedCount: number;
  governancePendingCount: number;
  capabilityGapCount: number;
  criticalCapabilityGapCount: number;
  genesisStageCount: number;
  genesisBlockedStageCount: number;
  recommendedNextActions: string[];
};

export type AutonomySupervisorResult = {
  observedAt: number;
  governanceMode: AutonomySupervisorGovernanceMode;
  overviewBefore: AutonomyFleetStatusResult;
  healed: AutonomyFleetHealResult;
  governanceReconciled?: AutonomyGovernanceReconcileResult;
  capabilityInventory?: AutonomyCapabilityInventoryResult;
  genesisPlan?: AutonomyGenesisPlanResult;
  overviewAfter: AutonomyFleetStatusResult;
  summary: AutonomySupervisorSummary;
};

export type AutonomyLoopRemoveParams = {
  agentId: string;
  jobId?: string;
};

export type AutonomyLoopRemoveResult = {
  profile: AutonomyAgentProfile;
  requestedJobId?: string;
  targetJobId?: string;
  removed: boolean;
  removedJobIds: string[];
  reason?: string;
};

export type BoundAutonomyRuntime = {
  readonly sessionKey: string;
  readonly requesterOrigin?: TaskDeliveryState["requesterOrigin"];
  listProfiles: () => AutonomyAgentProfile[];
  getProfile: (agentId: string) => AutonomyAgentProfile | undefined;
  getLatestManagedFlowSnapshot: (agentId: string) => AutonomyManagedFlowSnapshot | undefined;
  listLoopJobs: () => Promise<AutonomyLoopJobSnapshot[]>;
  getLoopJob: (agentId: string) => Promise<AutonomyLoopJobSnapshot | undefined>;
  startManagedFlow: (params: AutonomyStartManagedFlowParams) => AutonomyStartManagedFlowResult;
  cancelManagedFlow: (
    params: AutonomyCancelManagedFlowParams,
  ) => Promise<AutonomyCancelManagedFlowResult>;
  submitSandboxReplay: (
    params: AutonomySubmitSandboxReplayParams,
  ) => Promise<AutonomySubmitSandboxReplayResult>;
  showLoopJob: (params: AutonomyLoopShowParams) => Promise<AutonomyLoopShowResult>;
  upsertLoopJob: (params: AutonomyLoopUpsertParams) => Promise<AutonomyLoopUpsertResult>;
  reconcileLoopJobs: (
    params: AutonomyLoopReconcileParams,
  ) => Promise<AutonomyLoopReconcileResult>;
  getFleetStatus: (params: AutonomyFleetStatusParams) => Promise<AutonomyFleetStatusResult>;
  getFleetHistory: (params: AutonomyFleetHistoryParams) => Promise<AutonomyFleetHistoryResult>;
  getCapabilityInventory: (
    params: AutonomyCapabilityInventoryParams,
  ) => Promise<AutonomyCapabilityInventoryResult>;
  planGenesisWork: (params: AutonomyGenesisPlanParams) => Promise<AutonomyGenesisPlanResult>;
  synthesizeGovernanceProposals: (
    params: AutonomyGovernanceProposalsParams,
  ) => Promise<GovernanceAutonomyProposalSynthesisResult>;
  reconcileGovernanceProposals: (
    params: AutonomyGovernanceReconcileParams,
  ) => Promise<AutonomyGovernanceReconcileResult>;
  healFleet: (params: AutonomyFleetHealParams) => Promise<AutonomyFleetHealResult>;
  superviseFleet: (params: AutonomySupervisorParams) => Promise<AutonomySupervisorResult>;
  removeLoopJob: (params: AutonomyLoopRemoveParams) => Promise<AutonomyLoopRemoveResult>;
};

export type PluginRuntimeAutonomy = {
  bindSession: (params: {
    sessionKey: string;
    requesterOrigin?: TaskDeliveryState["requesterOrigin"];
    workspaceDir?: string;
  }) => BoundAutonomyRuntime;
  fromToolContext: (
    ctx: Pick<OpenClawPluginToolContext, "sessionKey" | "deliveryContext" | "workspaceDir">,
  ) => BoundAutonomyRuntime;
};
