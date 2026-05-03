import type { ZhushouConfig } from "../../config/types.zhushou.js";
import type { GovernanceGenesisPlanStageStatus } from "../../governance/capability-registry.js";
import type { AgentGovernanceRuntimeSnapshot } from "../../governance/runtime-snapshot.js";
import type {
  SandboxUniverseControllerState,
  SandboxUniverseExperimentPlan,
  SandboxUniverseReplayRunnerState,
} from "../../governance/sandbox-universe.js";
import type { JsonValue, TaskFlowRecord } from "../../tasks/task-flow-registry.types.js";
import type {
  TaskDeliveryState,
  TaskDeliveryStatus,
  TaskNotifyPolicy,
  TaskRecord,
  TaskRegistrySummary,
  TaskRuntime,
} from "../../tasks/task-registry.types.js";
import type { OpenClawPluginToolContext } from "../tool-types.js";

export type ManagedTaskFlowRecord = TaskFlowRecord & {
  syncMode: "managed";
  controllerId: string;
};

export type ManagedTaskFlowGenesisStageRuntime = {
  kind: "genesis_stage";
  teamId: string;
  teamTitle?: string | null;
  mode: "repair" | "build" | "steady_state";
  stage: {
    id: string;
    title: string;
    ownerAgentId: string;
    status: GovernanceGenesisPlanStageStatus;
    goal: string;
    dependsOn: string[];
    inputRefs: string[];
    outputRefs: string[];
    actions: string[];
    rationale?: string | null;
  };
  focusGapIds: string[];
  blockers: string[];
  stageGraph: Array<{
    id: string;
    title: string;
    ownerAgentId: string;
    status: GovernanceGenesisPlanStageStatus;
    dependsOn: string[];
  }>;
  developmentPackage: {
    packageId: string;
    candidateKinds: string[];
    targetArtifacts: string[];
    writeScopes: string[];
    qaGates: string[];
    promotionEvidence: string[];
    rollbackPlan: string[];
    publishTargets: string[];
  };
  sandboxUniverse: SandboxUniverseExperimentPlan;
  sandboxController?: SandboxUniverseControllerState;
  sandboxReplayRunner?: SandboxUniverseReplayRunnerState;
};

export type ManagedTaskFlowExecutionGraphNode = {
  id: string;
  title: string;
  dependsOn: string[];
  output: string;
};

export type ManagedTaskFlowExecutionCapabilityRequest = {
  status: "required" | "recommended" | "not_needed";
  focusGapIds: string[];
  handoffTeamId: string;
  reason: string;
  blockers: string[];
};

export type ManagedTaskFlowExecutionSystemRuntime = {
  kind: "execution_system";
  goalContract: {
    goal: string;
    layer?: string | null;
    authorityLevel?: string | null;
  };
  taskGraph: ManagedTaskFlowExecutionGraphNode[];
  executionPlan: {
    phases: ManagedTaskFlowExecutionGraphNode[];
    runtimeHooks: string[];
    collaborators: string[];
  };
  capabilityRequest: ManagedTaskFlowExecutionCapabilityRequest;
  observedCapabilityGaps: string[];
  genesisPlan: {
    teamId: string;
    mode: "repair" | "build" | "steady_state";
    focusGapIds: string[];
    blockers: string[];
  };
  sandboxUniverse?: SandboxUniverseExperimentPlan;
  sandboxController?: SandboxUniverseControllerState;
  sandboxReplayRunner?: SandboxUniverseReplayRunnerState;
};

export type ManagedTaskFlowAlgorithmResearchRuntime = {
  kind: "algorithm_research";
  focusGapIds: string[];
  observedAlgorithmGaps: string[];
  inventorySummary: {
    gapCount: number;
    criticalGapCount: number;
    algorithmCount: number;
    algorithmReady: number;
    algorithmAttention: number;
    algorithmBlocked: number;
  };
  researchPlan: {
    phases: ManagedTaskFlowExecutionGraphNode[];
    targetDomains: string[];
    runtimeHooks: string[];
    collaborators: string[];
  };
  promotionPolicy: {
    requiredEvidence: string[];
    blockers: string[];
  };
  sandboxUniverse?: SandboxUniverseExperimentPlan;
  sandboxController?: SandboxUniverseControllerState;
  sandboxReplayRunner?: SandboxUniverseReplayRunnerState;
};

export type ManagedTaskFlowSovereigntyWatchRuntime = {
  kind: "sovereignty_watch";
  governanceOverview: {
    discovered: boolean;
    missingArtifactCount: number;
    findingCount: number;
    proposalPendingCount: number;
    enforcementActive: boolean;
    freezeReasonCode?: string | null;
  };
  watchPlan: {
    phases: ManagedTaskFlowExecutionGraphNode[];
    reservedAuthorities: string[];
    freezeTargets: string[];
  };
  incidentPolicy: {
    automaticEnforcementActions: string[];
    criticalFindings: string[];
  };
};

export type ManagedTaskFlowAutonomyProjectRuntime =
  | ManagedTaskFlowGenesisStageRuntime
  | ManagedTaskFlowExecutionSystemRuntime
  | ManagedTaskFlowAlgorithmResearchRuntime
  | ManagedTaskFlowSovereigntyWatchRuntime;

export type ManagedTaskFlowAutonomyRuntimeState = {
  agentId: string;
  controllerId: string;
  goal: string;
  currentStep?: string;
  workspaceDirs: string[];
  primaryWorkspaceDir?: string;
  project?: ManagedTaskFlowAutonomyProjectRuntime;
};

export type ManagedTaskFlowMutationErrorCode = "not_found" | "not_managed" | "revision_conflict";

export type ManagedTaskFlowMutationResult =
  | {
      applied: true;
      flow: ManagedTaskFlowRecord;
    }
  | {
      applied: false;
      code: ManagedTaskFlowMutationErrorCode;
      current?: TaskFlowRecord;
    };

export type BoundTaskFlowTaskRunResult =
  | {
      created: true;
      flow: ManagedTaskFlowRecord;
      task: TaskRecord;
    }
  | {
      created: false;
      reason: string;
      found: boolean;
      flow?: TaskFlowRecord;
    };

export type BoundTaskFlowCancelResult = {
  found: boolean;
  cancelled: boolean;
  reason?: string;
  flow?: TaskFlowRecord;
  tasks?: TaskRecord[];
};

export type BoundTaskFlowRuntime = {
  readonly sessionKey: string;
  readonly requesterOrigin?: TaskDeliveryState["requesterOrigin"];
  createManaged: (params: {
    controllerId: string;
    goal: string;
    status?: ManagedTaskFlowRecord["status"];
    notifyPolicy?: TaskNotifyPolicy;
    currentStep?: string | null;
    stateJson?: JsonValue | null;
    waitJson?: JsonValue | null;
    cancelRequestedAt?: number | null;
    createdAt?: number;
    updatedAt?: number;
    endedAt?: number | null;
  }) => ManagedTaskFlowRecord;
  get: (flowId: string) => TaskFlowRecord | undefined;
  list: () => TaskFlowRecord[];
  findLatest: () => TaskFlowRecord | undefined;
  resolve: (token: string) => TaskFlowRecord | undefined;
  getTaskSummary: (flowId: string) => TaskRegistrySummary | undefined;
  getManagedAutonomy: (flowId: string) => ManagedTaskFlowAutonomyRuntimeState | undefined;
  setManagedAutonomy: (params: {
    flowId: string;
    expectedRevision: number;
    autonomy: ManagedTaskFlowAutonomyRuntimeState;
    currentStep?: string | null;
    updatedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  getManagedExecution: (flowId: string) => ManagedTaskFlowExecutionSystemRuntime | undefined;
  setManagedExecution: (params: {
    flowId: string;
    expectedRevision: number;
    execution: ManagedTaskFlowExecutionSystemRuntime;
    currentStep?: string | null;
    updatedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  setWaiting: (params: {
    flowId: string;
    expectedRevision: number;
    currentStep?: string | null;
    stateJson?: JsonValue | null;
    waitJson?: JsonValue | null;
    blockedTaskId?: string | null;
    blockedSummary?: string | null;
    updatedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  resume: (params: {
    flowId: string;
    expectedRevision: number;
    status?: Extract<ManagedTaskFlowRecord["status"], "queued" | "running">;
    currentStep?: string | null;
    stateJson?: JsonValue | null;
    updatedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  finish: (params: {
    flowId: string;
    expectedRevision: number;
    currentStep?: string | null;
    stateJson?: JsonValue | null;
    updatedAt?: number;
    endedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  fail: (params: {
    flowId: string;
    expectedRevision: number;
    currentStep?: string | null;
    stateJson?: JsonValue | null;
    blockedTaskId?: string | null;
    blockedSummary?: string | null;
    updatedAt?: number;
    endedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  requestCancel: (params: {
    flowId: string;
    expectedRevision: number;
    cancelRequestedAt?: number;
  }) => ManagedTaskFlowMutationResult;
  cancel: (params: { flowId: string; cfg: ZhushouConfig }) => Promise<BoundTaskFlowCancelResult>;
  runTask: (params: {
    flowId: string;
    runtime: TaskRuntime;
    sourceId?: string;
    childSessionKey?: string;
    parentTaskId?: string;
    agentId?: string;
    runId?: string;
    governanceRuntime?: AgentGovernanceRuntimeSnapshot;
    label?: string;
    task: string;
    preferMetadata?: boolean;
    notifyPolicy?: TaskNotifyPolicy;
    deliveryStatus?: TaskDeliveryStatus;
    status?: "queued" | "running";
    startedAt?: number;
    lastEventAt?: number;
    progressSummary?: string | null;
  }) => BoundTaskFlowTaskRunResult;
};

export type PluginRuntimeTaskFlow = {
  bindSession: (params: {
    sessionKey: string;
    requesterOrigin?: TaskDeliveryState["requesterOrigin"];
  }) => BoundTaskFlowRuntime;
  fromToolContext: (
    ctx: Pick<OpenClawPluginToolContext, "sessionKey" | "deliveryContext">,
  ) => BoundTaskFlowRuntime;
};
