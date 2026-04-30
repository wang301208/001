import { loadSandboxUniverseStateByPathSync } from "../../governance/sandbox-universe.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import type { JsonValue, TaskFlowRecord } from "../../tasks/task-flow-registry.types.js";
import { isRecord } from "../../utils.js";
import type {
  ManagedTaskFlowAlgorithmResearchRuntime,
  ManagedTaskFlowAutonomyProjectRuntime,
  ManagedTaskFlowAutonomyRuntimeState,
  ManagedTaskFlowExecutionCapabilityRequest,
  ManagedTaskFlowExecutionGraphNode,
  ManagedTaskFlowExecutionSystemRuntime,
  ManagedTaskFlowGenesisStageRuntime,
  ManagedTaskFlowSovereigntyWatchRuntime,
} from "./runtime-taskflow.types.js";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)),
  );
}

function cloneJsonValue<T extends JsonValue | undefined>(value: T): T {
  return value === undefined ? value : (structuredClone(value) as T);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

type SandboxHydratableProject = {
  sandboxUniverse?: unknown;
  sandboxController?: { statePath?: string } | undefined;
  sandboxReplayRunner?: { statePath?: string } | undefined;
};

function normalizeGenesisStageStatus(
  value: unknown,
): ManagedTaskFlowGenesisStageRuntime["stage"]["status"] {
  return value === "ready" || value === "waiting" || value === "blocked" ? value : "ready";
}

function normalizeGraphNode(value: unknown): ManagedTaskFlowExecutionGraphNode | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = normalizeOptionalString(value.id);
  const title = normalizeOptionalString(value.title);
  const output = normalizeOptionalString(value.output);
  if (!id || !title || !output) {
    return undefined;
  }
  return {
    id,
    title,
    dependsOn: normalizeStringArray(value.dependsOn),
    output,
  };
}

function normalizeCapabilityRequest(
  value: unknown,
): ManagedTaskFlowExecutionCapabilityRequest | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const status =
    value.status === "required" || value.status === "recommended" || value.status === "not_needed"
      ? value.status
      : undefined;
  const handoffTeamId = normalizeOptionalString(value.handoffTeamId);
  const reason = normalizeOptionalString(value.reason);
  if (!status || !handoffTeamId || !reason) {
    return undefined;
  }
  return {
    status,
    focusGapIds: normalizeStringArray(value.focusGapIds),
    handoffTeamId,
    reason,
    blockers: normalizeStringArray(value.blockers),
  };
}

function hydrateSandboxProjectPersistence<T extends SandboxHydratableProject>(project: T): T {
  const statePath = normalizeOptionalString(
    project.sandboxController?.statePath ?? project.sandboxReplayRunner?.statePath,
  );
  if (!statePath) {
    return project;
  }
  const snapshot = loadSandboxUniverseStateByPathSync(statePath);
  if (!snapshot) {
    return project;
  }
  const hydrated = {
    ...project,
    ...(snapshot.plan
      ? {
          sandboxUniverse: cloneJsonValue(snapshot.plan as JsonValue) as T["sandboxUniverse"],
        }
      : {}),
    ...(snapshot.controller
      ? {
          sandboxController: cloneJsonValue(
            snapshot.controller as JsonValue,
          ) as T["sandboxController"],
        }
      : {}),
    ...(snapshot.replayRunner
      ? {
          sandboxReplayRunner: cloneJsonValue(
            snapshot.replayRunner as JsonValue,
          ) as T["sandboxReplayRunner"],
        }
      : {}),
  } as T;
  return hydrated;
}

function normalizeExecutionProject(
  value: unknown,
): ManagedTaskFlowExecutionSystemRuntime | undefined {
  if (!isRecord(value) || value.kind !== "execution_system" || !isRecord(value.goalContract)) {
    return undefined;
  }
  const goal = normalizeOptionalString(value.goalContract.goal);
  if (!goal) {
    return undefined;
  }
  const taskGraph = Array.isArray(value.taskGraph)
    ? value.taskGraph.map((entry) => normalizeGraphNode(entry)).filter(isDefined)
    : [];
  const phases =
    isRecord(value.executionPlan) && Array.isArray(value.executionPlan.phases)
      ? value.executionPlan.phases.map((entry) => normalizeGraphNode(entry)).filter(isDefined)
      : [];
  const capabilityRequest = normalizeCapabilityRequest(value.capabilityRequest);
  if (!capabilityRequest) {
    return undefined;
  }
  const project: ManagedTaskFlowExecutionSystemRuntime = {
    kind: "execution_system",
    goalContract: {
      goal,
      ...(typeof value.goalContract.layer === "string" ? { layer: value.goalContract.layer } : {}),
      ...(typeof value.goalContract.authorityLevel === "string"
        ? { authorityLevel: value.goalContract.authorityLevel }
        : {}),
    },
    taskGraph,
    executionPlan: {
      phases,
      runtimeHooks: isRecord(value.executionPlan)
        ? normalizeStringArray(value.executionPlan.runtimeHooks)
        : [],
      collaborators: isRecord(value.executionPlan)
        ? normalizeStringArray(value.executionPlan.collaborators)
        : [],
    },
    capabilityRequest,
    observedCapabilityGaps: normalizeStringArray(value.observedCapabilityGaps),
    genesisPlan: {
      teamId:
        isRecord(value.genesisPlan) && typeof value.genesisPlan.teamId === "string"
          ? value.genesisPlan.teamId
          : capabilityRequest.handoffTeamId,
      mode:
        isRecord(value.genesisPlan) &&
        (value.genesisPlan.mode === "repair" ||
          value.genesisPlan.mode === "build" ||
          value.genesisPlan.mode === "steady_state")
          ? value.genesisPlan.mode
          : "repair",
      focusGapIds: isRecord(value.genesisPlan)
        ? normalizeStringArray(value.genesisPlan.focusGapIds)
        : [],
      blockers: isRecord(value.genesisPlan) ? normalizeStringArray(value.genesisPlan.blockers) : [],
    },
    ...(isRecord(value.sandboxUniverse)
      ? {
          sandboxUniverse: cloneJsonValue(
            value.sandboxUniverse as JsonValue,
          ) as ManagedTaskFlowExecutionSystemRuntime["sandboxUniverse"],
        }
      : {}),
    ...(isRecord(value.sandboxController)
      ? {
          sandboxController: cloneJsonValue(
            value.sandboxController as JsonValue,
          ) as ManagedTaskFlowExecutionSystemRuntime["sandboxController"],
        }
      : {}),
    ...(isRecord(value.sandboxReplayRunner)
      ? {
          sandboxReplayRunner: cloneJsonValue(
            value.sandboxReplayRunner as JsonValue,
          ) as ManagedTaskFlowExecutionSystemRuntime["sandboxReplayRunner"],
        }
      : {}),
  };
  return hydrateSandboxProjectPersistence(project);
}

function normalizeAlgorithmResearchProject(
  value: unknown,
): ManagedTaskFlowAlgorithmResearchRuntime | undefined {
  if (!isRecord(value) || value.kind !== "algorithm_research") {
    return undefined;
  }
  const phases =
    isRecord(value.researchPlan) && Array.isArray(value.researchPlan.phases)
      ? value.researchPlan.phases.map((entry) => normalizeGraphNode(entry)).filter(isDefined)
      : [];
  const inventorySummary = isRecord(value.inventorySummary) ? value.inventorySummary : undefined;
  if (!inventorySummary) {
    return undefined;
  }
  const project: ManagedTaskFlowAlgorithmResearchRuntime = {
    kind: "algorithm_research",
    focusGapIds: normalizeStringArray(value.focusGapIds),
    observedAlgorithmGaps: normalizeStringArray(value.observedAlgorithmGaps),
    inventorySummary: {
      gapCount:
        typeof inventorySummary.gapCount === "number" ? Math.max(0, inventorySummary.gapCount) : 0,
      criticalGapCount:
        typeof inventorySummary.criticalGapCount === "number"
          ? Math.max(0, inventorySummary.criticalGapCount)
          : 0,
      algorithmCount:
        typeof inventorySummary.algorithmCount === "number"
          ? Math.max(0, inventorySummary.algorithmCount)
          : 0,
      algorithmReady:
        typeof inventorySummary.algorithmReady === "number"
          ? Math.max(0, inventorySummary.algorithmReady)
          : 0,
      algorithmAttention:
        typeof inventorySummary.algorithmAttention === "number"
          ? Math.max(0, inventorySummary.algorithmAttention)
          : 0,
      algorithmBlocked:
        typeof inventorySummary.algorithmBlocked === "number"
          ? Math.max(0, inventorySummary.algorithmBlocked)
          : 0,
    },
    researchPlan: {
      phases,
      targetDomains: isRecord(value.researchPlan)
        ? normalizeStringArray(value.researchPlan.targetDomains)
        : [],
      runtimeHooks: isRecord(value.researchPlan)
        ? normalizeStringArray(value.researchPlan.runtimeHooks)
        : [],
      collaborators: isRecord(value.researchPlan)
        ? normalizeStringArray(value.researchPlan.collaborators)
        : [],
    },
    promotionPolicy: {
      requiredEvidence: isRecord(value.promotionPolicy)
        ? normalizeStringArray(value.promotionPolicy.requiredEvidence)
        : [],
      blockers: isRecord(value.promotionPolicy)
        ? normalizeStringArray(value.promotionPolicy.blockers)
        : [],
    },
    ...(isRecord(value.sandboxUniverse)
      ? {
          sandboxUniverse: cloneJsonValue(
            value.sandboxUniverse as JsonValue,
          ) as ManagedTaskFlowAlgorithmResearchRuntime["sandboxUniverse"],
        }
      : {}),
    ...(isRecord(value.sandboxController)
      ? {
          sandboxController: cloneJsonValue(
            value.sandboxController as JsonValue,
          ) as ManagedTaskFlowAlgorithmResearchRuntime["sandboxController"],
        }
      : {}),
    ...(isRecord(value.sandboxReplayRunner)
      ? {
          sandboxReplayRunner: cloneJsonValue(
            value.sandboxReplayRunner as JsonValue,
          ) as ManagedTaskFlowAlgorithmResearchRuntime["sandboxReplayRunner"],
        }
      : {}),
  };
  return hydrateSandboxProjectPersistence(project);
}

function normalizeGenesisProject(value: unknown): ManagedTaskFlowGenesisStageRuntime | undefined {
  if (!isRecord(value) || value.kind !== "genesis_stage" || !isRecord(value.stage)) {
    return undefined;
  }
  const stageId = normalizeOptionalString(value.stage.id);
  const stageTitle = normalizeOptionalString(value.stage.title);
  const stageOwnerAgentId = normalizeOptionalString(value.stage.ownerAgentId);
  const stageGoal = normalizeOptionalString(value.stage.goal);
  const teamId = normalizeOptionalString(value.teamId);
  if (!stageId || !stageTitle || !stageOwnerAgentId || !stageGoal || !teamId) {
    return undefined;
  }
  const project: ManagedTaskFlowGenesisStageRuntime = {
    kind: "genesis_stage",
    teamId,
    ...(typeof value.teamTitle === "string" || value.teamTitle === null
      ? { teamTitle: value.teamTitle as string | null }
      : {}),
    mode:
      value.mode === "repair" || value.mode === "build" || value.mode === "steady_state"
        ? value.mode
        : "repair",
    stage: {
      id: stageId,
      title: stageTitle,
      ownerAgentId: stageOwnerAgentId,
      status: normalizeGenesisStageStatus(value.stage.status),
      goal: stageGoal,
      dependsOn: normalizeStringArray(value.stage.dependsOn),
      inputRefs: normalizeStringArray(value.stage.inputRefs),
      outputRefs: normalizeStringArray(value.stage.outputRefs),
      actions: normalizeStringArray(value.stage.actions),
      ...(typeof value.stage.rationale === "string" || value.stage.rationale === null
        ? { rationale: value.stage.rationale as string | null }
        : {}),
    },
    focusGapIds: normalizeStringArray(value.focusGapIds),
    blockers: normalizeStringArray(value.blockers),
    stageGraph: Array.isArray(value.stageGraph)
      ? value.stageGraph
          .map((entry) => {
            if (!isRecord(entry)) {
              return undefined;
            }
            const id = normalizeOptionalString(entry.id);
            const title = normalizeOptionalString(entry.title);
            const ownerAgentId = normalizeOptionalString(entry.ownerAgentId);
            if (!id || !title || !ownerAgentId) {
              return undefined;
            }
            return {
              id,
              title,
              ownerAgentId,
              status: normalizeGenesisStageStatus(entry.status),
              dependsOn: normalizeStringArray(entry.dependsOn),
            };
          })
          .filter(isDefined)
      : [],
    developmentPackage: {
      packageId:
        isRecord(value.developmentPackage) &&
        typeof value.developmentPackage.packageId === "string" &&
        value.developmentPackage.packageId.trim()
          ? value.developmentPackage.packageId.trim()
          : `${stageId}.development_package`,
      candidateKinds: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.candidateKinds)
        : [],
      targetArtifacts: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.targetArtifacts)
        : [],
      writeScopes: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.writeScopes)
        : [],
      qaGates: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.qaGates)
        : [],
      promotionEvidence: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.promotionEvidence)
        : [],
      rollbackPlan: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.rollbackPlan)
        : [],
      publishTargets: isRecord(value.developmentPackage)
        ? normalizeStringArray(value.developmentPackage.publishTargets)
        : [],
    },
    sandboxUniverse: cloneJsonValue(
      value.sandboxUniverse as JsonValue,
    ) as ManagedTaskFlowGenesisStageRuntime["sandboxUniverse"],
    ...(isRecord(value.sandboxController)
      ? {
          sandboxController: cloneJsonValue(
            value.sandboxController as JsonValue,
          ) as ManagedTaskFlowGenesisStageRuntime["sandboxController"],
        }
      : {}),
    ...(isRecord(value.sandboxReplayRunner)
      ? {
          sandboxReplayRunner: cloneJsonValue(
            value.sandboxReplayRunner as JsonValue,
          ) as ManagedTaskFlowGenesisStageRuntime["sandboxReplayRunner"],
        }
      : {}),
  };
  return hydrateSandboxProjectPersistence(project);
}

function normalizeSovereigntyWatchProject(
  value: unknown,
): ManagedTaskFlowSovereigntyWatchRuntime | undefined {
  if (
    !isRecord(value) ||
    value.kind !== "sovereignty_watch" ||
    !isRecord(value.governanceOverview) ||
    !isRecord(value.watchPlan) ||
    !isRecord(value.incidentPolicy)
  ) {
    return undefined;
  }
  const phases = Array.isArray(value.watchPlan.phases)
    ? value.watchPlan.phases.map((entry) => normalizeGraphNode(entry)).filter(isDefined)
    : [];
  return {
    kind: "sovereignty_watch",
    governanceOverview: {
      discovered: value.governanceOverview.discovered === true,
      missingArtifactCount:
        typeof value.governanceOverview.missingArtifactCount === "number"
          ? Math.max(0, value.governanceOverview.missingArtifactCount)
          : 0,
      findingCount:
        typeof value.governanceOverview.findingCount === "number"
          ? Math.max(0, value.governanceOverview.findingCount)
          : 0,
      proposalPendingCount:
        typeof value.governanceOverview.proposalPendingCount === "number"
          ? Math.max(0, value.governanceOverview.proposalPendingCount)
          : 0,
      enforcementActive: value.governanceOverview.enforcementActive === true,
      ...(typeof value.governanceOverview.freezeReasonCode === "string" ||
      value.governanceOverview.freezeReasonCode === null
        ? {
            freezeReasonCode: value.governanceOverview.freezeReasonCode as string | null,
          }
        : {}),
    },
    watchPlan: {
      phases,
      reservedAuthorities: normalizeStringArray(value.watchPlan.reservedAuthorities),
      freezeTargets: normalizeStringArray(value.watchPlan.freezeTargets),
    },
    incidentPolicy: {
      automaticEnforcementActions: normalizeStringArray(
        value.incidentPolicy.automaticEnforcementActions,
      ),
      criticalFindings: normalizeStringArray(value.incidentPolicy.criticalFindings),
    },
  };
}

function normalizeProjectRuntime(
  value: unknown,
): ManagedTaskFlowAutonomyProjectRuntime | undefined {
  return (
    normalizeExecutionProject(value) ??
    normalizeGenesisProject(value) ??
    normalizeAlgorithmResearchProject(value) ??
    normalizeSovereigntyWatchProject(value)
  );
}

export function extractManagedAutonomyRuntimeState(
  flow: Pick<TaskFlowRecord, "controllerId" | "goal" | "currentStep" | "stateJson">,
): ManagedTaskFlowAutonomyRuntimeState | undefined {
  if (!isRecord(flow.stateJson) || !isRecord(flow.stateJson.autonomy)) {
    return undefined;
  }
  const autonomy = flow.stateJson.autonomy;
  const agentId = normalizeOptionalString(autonomy.agentId);
  const controllerId =
    normalizeOptionalString(autonomy.controllerId) ?? normalizeOptionalString(flow.controllerId);
  const goal = normalizeOptionalString(autonomy.goal) ?? normalizeOptionalString(flow.goal);
  const project = normalizeProjectRuntime(autonomy.project);
  if (!agentId || !controllerId || !goal) {
    return undefined;
  }
  return {
    agentId,
    controllerId,
    goal,
    ...((normalizeOptionalString(autonomy.currentStep) ?? normalizeOptionalString(flow.currentStep))
      ? {
          currentStep:
            normalizeOptionalString(autonomy.currentStep) ??
            normalizeOptionalString(flow.currentStep),
        }
      : {}),
    workspaceDirs: normalizeStringArray(autonomy.workspaceDirs),
    ...(typeof autonomy.primaryWorkspaceDir === "string" && autonomy.primaryWorkspaceDir.trim()
      ? { primaryWorkspaceDir: autonomy.primaryWorkspaceDir.trim() }
      : {}),
    ...(project ? { project } : {}),
  };
}

export function extractManagedExecutionRuntimeState(
  flow: Pick<TaskFlowRecord, "controllerId" | "goal" | "currentStep" | "stateJson">,
): ManagedTaskFlowExecutionSystemRuntime | undefined {
  const autonomy = extractManagedAutonomyRuntimeState(flow);
  return autonomy?.project?.kind === "execution_system" ? autonomy.project : undefined;
}

export function mergeManagedAutonomyRuntimeState(params: {
  stateJson?: JsonValue;
  autonomy: ManagedTaskFlowAutonomyRuntimeState;
}): JsonValue {
  const root = isRecord(params.stateJson)
    ? (cloneJsonValue(params.stateJson) as Record<string, JsonValue>)
    : {};
  root.autonomy = cloneJsonValue(params.autonomy as unknown as JsonValue) ?? null;
  return root as JsonValue;
}
