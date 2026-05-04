import { createRuntimeAutonomy } from "../plugins/runtime/runtime-autonomy.js";
import { createRuntimeTaskFlow } from "../plugins/runtime/runtime-taskflow.js";
import type {
  ManagedTaskFlowAutonomyProjectRuntime,
  ManagedTaskFlowAutonomyRuntimeState,
  ManagedTaskFlowExecutionGraphNode,
  ManagedTaskFlowExecutionSystemRuntime,
  ManagedTaskFlowSovereigntyWatchRuntime,
} from "../plugins/runtime/runtime-taskflow.types.js";
import type { TaskFlowDetail } from "../plugins/runtime/task-domain-types.js";
import { buildAgentMainSessionKey, normalizeAgentId } from "../routing/session-key.js";
import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import { initializeGenesisTeamLoop, getGenesisTeamLoop } from "../governance/genesis-team-loop.js";
import { initializePostPromotionObserver, getPostPromotionObserver } from "../governance/post-promotion-observer.js";
import { loadConfig } from "../config/config.js";

export function registerAutonomyCommands(program: Command, runtime: RuntimeEnv): void {
import { theme } from "../terminal/theme.js";
import { isRecord } from "../utils.js";

const info = theme.info;
const AUTONOMY_HISTORY_MODES = new Set(["heal", "reconcile"]);
const AUTONOMY_HISTORY_SOURCES = new Set(["manual", "startup", "supervisor"]);

type AutonomyListOptions = {
  json?: boolean;
  sessionKey?: string;
};

type AutonomyShowOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
};

type AutonomyOverviewOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
};

type AutonomyCapabilityInventoryOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
};

type AutonomyGenesisPlanOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  teamId?: string;
  workspaceDirs?: string[];
};

type AutonomyHealOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
};

type AutonomySuperviseOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
  teamId?: string;
  restartBlockedFlows?: boolean;
  governanceMode?: "none" | "apply_safe" | "force_apply_all";
  decisionNote?: string;
  includeCapabilityInventory?: boolean;
  includeGenesisPlan?: boolean;
  recordHistory?: boolean;
};

type AutonomyBootstrapOptions = AutonomySuperviseOptions;

type AutonomyArchitectureReadinessOptions = AutonomySuperviseOptions;

type AutonomyActivateOptions = AutonomySuperviseOptions;

type AutonomyHistoryOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
  limit?: number;
  mode?: "heal" | "reconcile";
  source?: "manual" | "startup" | "supervisor";
};

type AutonomyGovernanceOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
};

type AutonomyGovernanceReconcileOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
  mode?: "apply_safe" | "force_apply_all";
  decisionNote?: string;
};

type AutonomyStartOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
  goal?: string;
  controllerId?: string;
  currentStep?: string;
  workspaceDirs?: string[];
  notifyPolicy?: "done_only" | "state_changes" | "silent";
  status?: "queued" | "running";
  seedTaskEnabled?: boolean;
  seedTaskRuntime?: "subagent" | "acp" | "cli" | "cron";
  seedTaskStatus?: "queued" | "running";
  seedTaskLabel?: string;
  seedTaskTask?: string;
};

type AutonomyCancelOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
  flowId?: string;
};

type AutonomyReplaySubmitOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
  flowId?: string;
  replayPassed: boolean;
  qaPassed: boolean;
  auditPassed?: boolean;
};

type SandboxManagedTaskFlowProjectRuntime = Exclude<
  ManagedTaskFlowAutonomyProjectRuntime,
  ManagedTaskFlowSovereigntyWatchRuntime
>;

type SandboxControllerRuntime = NonNullable<
  SandboxManagedTaskFlowProjectRuntime["sandboxController"]
>;

function resolveSandboxManagedProject(
  project: ManagedTaskFlowAutonomyProjectRuntime | undefined,
): SandboxManagedTaskFlowProjectRuntime | undefined {
  if (!project || project.kind === "sovereignty_watch") {
    return undefined;
  }
  return project;
}

type AutonomyLoopShowOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
};

type AutonomyLoopEnableOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
  everyMs?: number;
  workspaceDirs?: string[];
};

type AutonomyLoopReconcileOptions = {
  agentIds?: string[];
  json?: boolean;
  sessionKey?: string;
  workspaceDirs?: string[];
};

type AutonomyLoopDisableOptions = {
  agentId: string;
  json?: boolean;
  sessionKey?: string;
  jobId?: string;
};

function resolveAutonomySessionKey(params: { agentId?: string; sessionKey?: string }): string {
  const sessionKey = normalizeOptionalString(params.sessionKey);
  if (sessionKey) {
    return sessionKey;
  }
  return buildAgentMainSessionKey({
    agentId: normalizeAgentId(params.agentId),
  });
}

function bindAutonomyRuntime(params: { agentId?: string; sessionKey?: string }) {
  const sessionKey = resolveAutonomySessionKey(params);
  return {
    sessionKey,
    runtime: createRuntimeAutonomy({
      legacyTaskFlow: createRuntimeTaskFlow(),
    }).bindSession({
      sessionKey,
    }),
  };
}

function resolveSeedTaskInput(opts: AutonomyStartOptions) {
  if (
    opts.seedTaskEnabled === false &&
    opts.seedTaskRuntime === undefined &&
    opts.seedTaskStatus === undefined &&
    opts.seedTaskLabel === undefined &&
    opts.seedTaskTask === undefined
  ) {
    return false;
  }
  if (
    opts.seedTaskEnabled === undefined &&
    opts.seedTaskRuntime === undefined &&
    opts.seedTaskStatus === undefined &&
    opts.seedTaskLabel === undefined &&
    opts.seedTaskTask === undefined
  ) {
    return undefined;
  }
  return {
    ...(typeof opts.seedTaskEnabled === "boolean" ? { enabled: opts.seedTaskEnabled } : {}),
    ...(opts.seedTaskRuntime ? { runtime: opts.seedTaskRuntime } : {}),
    ...(opts.seedTaskStatus ? { status: opts.seedTaskStatus } : {}),
    ...(opts.seedTaskLabel !== undefined ? { label: opts.seedTaskLabel } : {}),
    ...(opts.seedTaskTask !== undefined ? { task: opts.seedTaskTask } : {}),
  };
}

function normalizeWorkspaceDirs(workspaceDirs?: string[]): string[] {
  return Array.from(
    new Set((workspaceDirs ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function formatWorkspaceScope(workspaceDirs?: string[]): string {
  const normalized = normalizeWorkspaceDirs(workspaceDirs);
  return normalized.length > 0 ? normalized.join(", ") : "n/a";
}

function formatList(values: string[] | undefined, empty = "none"): string {
  return values && values.length > 0 ? values.join(", ") : empty;
}

function resolveFlowManagedAutonomy(
  flow?: TaskFlowDetail,
): ManagedTaskFlowAutonomyRuntimeState | undefined {
  if (flow?.managedAutonomy) {
    return flow.managedAutonomy;
  }
  if (!flow || !isRecord(flow.state) || !isRecord(flow.state.autonomy)) {
    return undefined;
  }
  const autonomyState = flow.state.autonomy;
  const agentId = normalizeOptionalString(autonomyState.agentId);
  const controllerId = normalizeOptionalString(autonomyState.controllerId);
  const goal = normalizeOptionalString(autonomyState.goal) ?? normalizeOptionalString(flow.goal);
  if (!agentId || !controllerId || !goal) {
    return undefined;
  }
  const workspaceDirs = Array.isArray(autonomyState.workspaceDirs)
    ? autonomyState.workspaceDirs.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const primaryWorkspaceDir =
    typeof autonomyState.primaryWorkspaceDir === "string" ? autonomyState.primaryWorkspaceDir : "";
  const currentStep =
    normalizeOptionalString(autonomyState.currentStep) ?? normalizeOptionalString(flow.currentStep);
  return {
    agentId,
    controllerId,
    goal,
    ...(currentStep ? { currentStep } : {}),
    workspaceDirs: normalizeWorkspaceDirs(workspaceDirs),
    ...(primaryWorkspaceDir.trim() ? { primaryWorkspaceDir: primaryWorkspaceDir.trim() } : {}),
  };
}

function resolveFlowProjectRuntime(
  flow?: TaskFlowDetail,
): ManagedTaskFlowAutonomyProjectRuntime | undefined {
  return resolveFlowManagedAutonomy(flow)?.project;
}

function resolveFlowManagedExecution(
  flow?: TaskFlowDetail,
): ManagedTaskFlowExecutionSystemRuntime | undefined {
  if (flow?.managedExecution) {
    return flow.managedExecution;
  }
  const project = resolveFlowProjectRuntime(flow);
  return project?.kind === "execution_system" ? project : undefined;
}

function resolveFlowControllerId(flow?: TaskFlowDetail): string | undefined {
  const managedAutonomy = resolveFlowManagedAutonomy(flow);
  if (managedAutonomy?.controllerId) {
    return managedAutonomy.controllerId;
  }
  if (flow && isRecord(flow.state) && isRecord(flow.state.autonomy)) {
    return normalizeOptionalString(flow.state.autonomy.controllerId) ?? undefined;
  }
  return undefined;
}

function resolveFlowWorkspaceDirs(flow?: TaskFlowDetail): string[] {
  const autonomy = resolveFlowManagedAutonomy(flow);
  if (autonomy) {
    return normalizeWorkspaceDirs([
      ...autonomy.workspaceDirs,
      ...(autonomy.primaryWorkspaceDir ? [autonomy.primaryWorkspaceDir] : []),
    ]);
  }
  if (flow && isRecord(flow.state) && isRecord(flow.state.autonomy)) {
    const legacyAutonomy = flow.state.autonomy;
    const workspaceDirs = Array.isArray(legacyAutonomy.workspaceDirs)
      ? legacyAutonomy.workspaceDirs.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [];
    const primaryWorkspaceDir =
      typeof legacyAutonomy.primaryWorkspaceDir === "string"
        ? legacyAutonomy.primaryWorkspaceDir.trim()
        : "";
    return normalizeWorkspaceDirs([
      ...workspaceDirs,
      ...(primaryWorkspaceDir ? [primaryWorkspaceDir] : []),
    ]);
  }
  return [];
}

function formatExecutionGraphNodes(nodes: ManagedTaskFlowExecutionGraphNode[]): string {
  if (nodes.length === 0) {
    return "none";
  }
  return nodes
    .map(
      (node) =>
        `${node.id}${node.dependsOn.length > 0 ? `<=${node.dependsOn.join("+")}` : ""}:${node.output}`,
    )
    .join("; ");
}

function formatStageGraph(
  nodes: Extract<ManagedTaskFlowAutonomyProjectRuntime, { kind: "genesis_stage" }>["stageGraph"],
): string {
  if (nodes.length === 0) {
    return "none";
  }
  return nodes
    .map(
      (node) =>
        `${node.id}[${node.status}]${node.dependsOn.length > 0 ? `<=${node.dependsOn.join("+")}` : ""}`,
    )
    .join("; ");
}

function formatSandboxControllerStages(stages: SandboxControllerRuntime["stages"]): string {
  if (stages.length === 0) {
    return "none";
  }
  return stages.map((stage) => `${stage.id}:${stage.status}`).join(", ");
}

function formatSandboxEvidenceLedger(evidence: SandboxControllerRuntime["evidence"]): string {
  if (evidence.length === 0) {
    return "none";
  }
  return evidence
    .map((entry) => {
      const persisted = normalizeOptionalString(entry.storagePath);
      const sha = normalizeOptionalString(entry.sha256);
      const size =
        typeof entry.sizeBytes === "number" && Number.isFinite(entry.sizeBytes)
          ? `${entry.sizeBytes}b`
          : undefined;
      return [
        `${entry.id}:${entry.status}`,
        ...(persisted ? [`path=${persisted}`] : []),
        ...(size ? [`size=${size}`] : []),
        ...(sha ? [`sha=${sha.slice(0, 12)}`] : []),
      ].join(" ");
    })
    .join(" | ");
}

function logSandboxProjection(
  runtime: RuntimeEnv,
  project: ManagedTaskFlowAutonomyProjectRuntime | undefined,
): void {
  const sandboxProject = resolveSandboxManagedProject(project);
  const sandboxUniverse = sandboxProject?.sandboxUniverse;
  const sandboxController = sandboxProject?.sandboxController;
  const sandboxReplayRunner = sandboxProject?.sandboxReplayRunner;
  if (!sandboxUniverse && !sandboxController && !sandboxReplayRunner) {
    return;
  }

  const universeId =
    sandboxUniverse?.universeId ?? sandboxController?.universeId ?? sandboxReplayRunner?.universeId;
  runtime.log(`sandboxUniverseId: ${universeId ?? "n/a"}`);
  if (sandboxUniverse) {
    runtime.log(
      `sandboxTarget: ${sandboxUniverse.target.kind}:${sandboxUniverse.target.id} team=${sandboxUniverse.target.teamId}`,
    );
    runtime.log(`sandboxTargetFocusGaps: ${formatList(sandboxUniverse.target.focusGapIds)}`);
    runtime.log(
      `sandboxStages: ${sandboxUniverse.stages.map((stage) => `${stage.id}:${stage.status}`).join(", ") || "none"}`,
    );
    runtime.log(
      `sandboxPromotionGate: freeze=${sandboxUniverse.promotionGate.freezeActive ? "active" : "inactive"} blockers=${formatList(sandboxUniverse.promotionGate.blockers)} evidence=${formatList(sandboxUniverse.promotionGate.requiredEvidence)}`,
    );
  }
  if (sandboxController) {
    const collectedEvidence = sandboxController.evidence.filter(
      (entry) => entry.status === "collected",
    ).length;
    const failedEvidence = sandboxController.evidence.filter(
      (entry) => entry.status === "failed",
    ).length;
    const persistedEvidence = sandboxController.evidence.filter((entry) =>
      Boolean(normalizeOptionalString(entry.storagePath)),
    ).length;
    runtime.log(
      `sandboxController: activeStage=${sandboxController.activeStageId ?? "none"} blockers=${sandboxController.blockers.length} evidence=${collectedEvidence}/${sandboxController.evidence.length}${failedEvidence > 0 ? ` failed=${failedEvidence}` : ""}${persistedEvidence > 0 ? ` persisted=${persistedEvidence}` : ""}`,
    );
    runtime.log(
      `sandboxControllerStages: ${formatSandboxControllerStages(sandboxController.stages)}`,
    );
    if (sandboxController.statePath || sandboxController.artifactDir) {
      runtime.log(
        `sandboxPersistence: state=${sandboxController.statePath ?? "n/a"} artifacts=${sandboxController.artifactDir ?? "n/a"}`,
      );
    }
    runtime.log(
      `sandboxEvidenceLedger: ${formatSandboxEvidenceLedger(sandboxController.evidence)}`,
    );
  }
  if (sandboxReplayRunner) {
    runtime.log(
      `sandboxReplayRunner: status=${sandboxReplayRunner.status} scenarios=${sandboxReplayRunner.scenarios.length} outputs=${sandboxReplayRunner.requiredOutputs.length} blockers=${sandboxReplayRunner.blockers.length}`,
    );
    if (
      (sandboxReplayRunner.statePath || sandboxReplayRunner.artifactDir) &&
      !sandboxController?.statePath &&
      !sandboxController?.artifactDir
    ) {
      runtime.log(
        `sandboxReplayPersistence: state=${sandboxReplayRunner.statePath ?? "n/a"} artifacts=${sandboxReplayRunner.artifactDir ?? "n/a"}`,
      );
    }
    if (sandboxReplayRunner.lastRun) {
      runtime.log(
        `sandboxPromotionDecision: replay=${sandboxReplayRunner.lastRun.replayPassed ? "pass" : "fail"} qa=${sandboxReplayRunner.lastRun.qaPassed ? "pass" : "fail"} audit=${sandboxReplayRunner.lastRun.auditPassed ? "pass" : "fail"} promote=${sandboxReplayRunner.lastRun.canPromote ? "yes" : "no"}`,
      );
    }
  }
}

function logFlowRuntimeProjection(runtime: RuntimeEnv, flow: TaskFlowDetail): void {
  const managedAutonomy = resolveFlowManagedAutonomy(flow);
  const managedExecution = resolveFlowManagedExecution(flow);
  const project = resolveFlowProjectRuntime(flow);

  if (managedAutonomy) {
    runtime.log(`latestFlowControllerId: ${managedAutonomy.controllerId}`);
    runtime.log(`latestFlowManagedAgentId: ${managedAutonomy.agentId}`);
    runtime.log(`latestFlowProjectKind: ${managedAutonomy.project?.kind ?? "none"}`);
  }
  if (project?.kind === "genesis_stage") {
    runtime.log(
      `latestFlowGenesisStage: ${project.stage.id} [${project.stage.status}] ${project.stage.title}`,
    );
    runtime.log(
      `latestFlowGenesisTeam: ${project.teamId} (${project.teamTitle ?? "n/a"}) mode=${project.mode}`,
    );
    runtime.log(`latestFlowGenesisFocusGaps: ${formatList(project.focusGapIds)}`);
    runtime.log(`latestFlowGenesisBlockers: ${formatList(project.blockers)}`);
    runtime.log(`latestFlowGenesisStageGraph: ${formatStageGraph(project.stageGraph)}`);
  }
  if (managedExecution) {
    runtime.log(
      `latestFlowExecutionGoalContract: goal=${managedExecution.goalContract.goal} layer=${managedExecution.goalContract.layer ?? "n/a"} authority=${managedExecution.goalContract.authorityLevel ?? "n/a"}`,
    );
    runtime.log(
      `latestFlowExecutionCapabilityRequest: ${managedExecution.capabilityRequest.status} handoff=${managedExecution.capabilityRequest.handoffTeamId} gaps=${formatList(managedExecution.capabilityRequest.focusGapIds)} blockers=${formatList(managedExecution.capabilityRequest.blockers)}`,
    );
    runtime.log(
      `latestFlowExecutionPlan: phases=${managedExecution.executionPlan.phases.length} taskGraph=${managedExecution.taskGraph.length}`,
    );
    runtime.log(
      `latestFlowExecutionHooks: ${formatList(managedExecution.executionPlan.runtimeHooks)}`,
    );
    runtime.log(
      `latestFlowExecutionCollaborators: ${formatList(managedExecution.executionPlan.collaborators)}`,
    );
    runtime.log(
      `latestFlowExecutionTaskGraph: ${formatExecutionGraphNodes(managedExecution.taskGraph)}`,
    );
    runtime.log(
      `latestFlowExecutionPhases: ${formatExecutionGraphNodes(managedExecution.executionPlan.phases)}`,
    );
    runtime.log(
      `latestFlowExecutionObservedGaps: ${formatList(managedExecution.observedCapabilityGaps)}`,
    );
    runtime.log(
      `latestFlowExecutionGenesisHandoff: team=${managedExecution.genesisPlan.teamId} mode=${managedExecution.genesisPlan.mode} focus=${formatList(managedExecution.genesisPlan.focusGapIds)} blockers=${formatList(managedExecution.genesisPlan.blockers)}`,
    );
  }
  logSandboxProjection(runtime, project);
}

export async function autonomyListCommand(
  opts: AutonomyListOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const profiles = autonomy.listProfiles();

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          count: profiles.length,
          profiles,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(info(`Autonomy profiles: ${profiles.length}`));
  runtime.log(info(`Control session: ${sessionKey}`));
  if (profiles.length === 0) {
    runtime.log("No autonomy profiles available.");
    return;
  }
  for (const profile of profiles) {
    const title = profile.name ?? profile.id;
    const layer = profile.layer ?? "unclassified";
    const goal = profile.bootstrap.defaultGoal;
    runtime.log(`${profile.id} [${layer}] ${title}`);
    runtime.log(`  goal: ${goal}`);
  }
}

export async function autonomyShowCommand(
  opts: AutonomyShowOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  const profile = autonomy.getProfile(opts.agentId);

  if (!profile) {
    runtime.error(`Autonomy profile not found: ${normalizeAgentId(opts.agentId)}`);
    runtime.exit(1);
    return;
  }
  const latest = autonomy.getLatestManagedFlowSnapshot(opts.agentId);
  const loopJob = await autonomy.getLoopJob(opts.agentId);

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          profile,
          ...(latest?.flow ? { latestFlow: latest.flow } : {}),
          ...(latest?.seedTask ? { latestSeedTask: latest.seedTask } : {}),
          ...(loopJob ? { loopJob } : {}),
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy profile:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`agentId: ${profile.id}`);
  runtime.log(`name: ${profile.name ?? "n/a"}`);
  runtime.log(`layer: ${profile.layer ?? "n/a"}`);
  runtime.log(`mission: ${profile.missionPrimary ?? "n/a"}`);
  runtime.log(`authority: ${profile.authorityLevel ?? "n/a"}`);
  runtime.log(`controllerId: ${profile.bootstrap.controllerId}`);
  runtime.log(`defaultGoal: ${profile.bootstrap.defaultGoal}`);
  runtime.log(`defaultCurrentStep: ${profile.bootstrap.defaultCurrentStep}`);
  runtime.log(`loopName: ${profile.bootstrap.loop.name}`);
  runtime.log(`loopEveryMs: ${profile.bootstrap.loop.schedule.everyMs}`);
  runtime.log(`collaborators: ${profile.collaborators.join(", ") || "n/a"}`);
  runtime.log(`reportsTo: ${profile.reportsTo.join(", ") || "n/a"}`);
  runtime.log(`runtimeHooks: ${profile.runtimeHooks.join(", ") || "n/a"}`);
  if (loopJob?.job) {
    runtime.log(`loopJobId: ${loopJob.job.id}`);
    runtime.log(`loopEnabled: ${loopJob.job.enabled ? "yes" : "no"}`);
    runtime.log(`loopWorkspaceScope: ${formatWorkspaceScope(loopJob.workspaceDirs)}`);
    runtime.log(`loopNextRunAt: ${loopJob.job.state.nextRunAtMs ?? "n/a"}`);
    runtime.log(`loopLastRunAt: ${loopJob.job.state.lastRunAtMs ?? "n/a"}`);
  } else {
    runtime.log("loopJobId: none");
  }
  if (!latest?.flow) {
    runtime.log("latestFlow: none");
    return;
  }
  runtime.log(`latestFlowId: ${latest.flow.id}`);
  runtime.log(`latestFlowStatus: ${latest.flow.status}`);
  runtime.log(`latestFlowGoal: ${latest.flow.goal}`);
  runtime.log(`latestFlowStep: ${latest.flow.currentStep ?? "n/a"}`);
  runtime.log(
    `latestFlowWorkspaceScope: ${formatWorkspaceScope(resolveFlowWorkspaceDirs(latest.flow))}`,
  );
  runtime.log(`latestFlowUpdatedAt: ${latest.flow.updatedAt}`);
  runtime.log(`latestTaskTotal: ${latest.flow.taskSummary.total}`);
  logFlowRuntimeProjection(runtime, latest.flow);
  if (latest.seedTask) {
    runtime.log(`latestSeedTaskId: ${latest.seedTask.id}`);
    runtime.log(`latestSeedTaskStatus: ${latest.seedTask.status}`);
  }
}

export async function autonomyOverviewCommand(
  opts: AutonomyOverviewOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const overview = await autonomy.getFleetStatus({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          overview,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(info(`Autonomy fleet profiles: ${overview.totals.totalProfiles}`));
  runtime.log(info(`Control session: ${sessionKey}`));
  runtime.log(info(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`));
  runtime.log(
    info(
      `healthy=${overview.totals.healthy} idle=${overview.totals.idle} drift=${overview.totals.drift} missingLoop=${overview.totals.missingLoop} activeFlows=${overview.totals.activeFlows}`,
    ),
  );
  for (const entry of overview.entries) {
    runtime.log(
      `${entry.agentId} [${entry.health}] loop=${entry.actualLoopEveryMs ?? "none"}/${entry.expectedLoopEveryMs} flow=${entry.latestFlow?.status ?? "none"} action=${entry.suggestedAction} scope=${formatWorkspaceScope(entry.workspaceDirs)}`,
    );
    if (entry.driftReasons.length > 0) {
      runtime.log(`  reasons: ${entry.driftReasons.join("; ")}`);
    }
  }
}

export async function autonomyCapabilityInventoryCommand(
  opts: AutonomyCapabilityInventoryOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const inventory = await autonomy.getCapabilityInventory({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          inventory,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy capability inventory:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`observedAt: ${new Date(inventory.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${inventory.charterDir}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(inventory.workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(inventory.requestedAgentIds)}`);
  runtime.log(
    `summary: total=${inventory.summary.totalEntries} skills=${inventory.summary.skillCount} plugins=${inventory.summary.pluginCount} memory=${inventory.summary.memoryCount ?? 0} strategy=${inventory.summary.strategyCount ?? 0} algorithm=${inventory.summary.algorithmCount ?? 0} agentBlueprints=${inventory.summary.agentBlueprintCount} teamBlueprints=${inventory.summary.teamBlueprintCount} autonomyProfiles=${inventory.summary.autonomyProfileCount} genesisMembers=${inventory.summary.genesisMemberCount} gaps=${inventory.summary.gapCount}`,
  );
  runtime.log(
    `readiness: skillReady=${inventory.summary.skillReady} skillAttention=${inventory.summary.skillAttention} skillBlocked=${inventory.summary.skillBlocked} pluginActivated=${inventory.summary.pluginActivated} pluginAttention=${inventory.summary.pluginAttention} pluginBlocked=${inventory.summary.pluginBlocked}`,
  );
  runtime.log(
    `knowledgeAssets: memoryReady=${inventory.summary.memoryReady ?? 0} memoryAttention=${inventory.summary.memoryAttention ?? 0} memoryBlocked=${inventory.summary.memoryBlocked ?? 0} strategyReady=${inventory.summary.strategyReady ?? 0} strategyAttention=${inventory.summary.strategyAttention ?? 0} strategyBlocked=${inventory.summary.strategyBlocked ?? 0} algorithmReady=${inventory.summary.algorithmReady ?? 0} algorithmAttention=${inventory.summary.algorithmAttention ?? 0} algorithmBlocked=${inventory.summary.algorithmBlocked ?? 0}`,
  );
  runtime.log(
    `gapSeverity: critical=${inventory.summary.criticalGapCount} warning=${inventory.summary.warningGapCount} info=${inventory.summary.infoGapCount}`,
  );
  if (inventory.entries.length === 0) {
    runtime.log("No capability inventory entries resolved.");
  } else {
    runtime.log("entries:");
    for (const entry of inventory.entries) {
      runtime.log(`${entry.id} [${entry.kind}/${entry.status}] ${entry.title}`);
      runtime.log(
        `  owner=${entry.ownerAgentId ?? "n/a"} scope=${formatWorkspaceScope(entry.workspaceDir ? [entry.workspaceDir] : undefined)} activation=${entry.activation ? `${entry.activation.enabled ? "enabled" : "disabled"}/${entry.activation.activated ? "active" : "inactive"}:${entry.activation.source}` : "n/a"}`,
      );
      runtime.log(
        `  coverage=${formatList(entry.coverage)} dependencies=${formatList(entry.dependencies)} installs=${formatList(entry.installOptions)}`,
      );
      if (entry.issues.length > 0) {
        runtime.log(`  issues: ${entry.issues.join("; ")}`);
      }
    }
  }
  if (inventory.gaps.length === 0) {
    runtime.log("gaps: none");
    return;
  }
  runtime.log("gaps:");
  for (const gap of inventory.gaps) {
    runtime.log(`${gap.id} [${gap.severity}] ${gap.title}`);
    runtime.log(
      `  owner=${gap.ownerAgentId ?? "n/a"} related=${formatList(gap.relatedEntryIds)} actions=${formatList(gap.suggestedActions)}`,
    );
    runtime.log(`  detail: ${gap.detail}`);
  }
}

export async function autonomyGenesisPlanCommand(
  opts: AutonomyGenesisPlanOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const genesisPlan = await autonomy.planGenesisWork({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          genesisPlan,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy genesis plan:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`observedAt: ${new Date(genesisPlan.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${genesisPlan.charterDir}`);
  runtime.log(`teamId: ${genesisPlan.teamId}`);
  runtime.log(`teamTitle: ${genesisPlan.teamTitle ?? "n/a"}`);
  runtime.log(`mode: ${genesisPlan.mode}`);
  runtime.log(`primaryWorkspaceDir: ${genesisPlan.primaryWorkspaceDir ?? "n/a"}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(genesisPlan.workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(genesisPlan.requestedAgentIds)}`);
  runtime.log(`focusGapIds: ${formatList(genesisPlan.focusGapIds)}`);
  runtime.log(`blockers: ${formatList(genesisPlan.blockers)}`);
  if (genesisPlan.stages.length === 0) {
    runtime.log("No genesis stages were planned.");
    return;
  }
  runtime.log("stages:");
  for (const stage of genesisPlan.stages) {
    runtime.log(`${stage.id} [${stage.status}] ${stage.title}`);
    runtime.log(
      `  owner=${stage.ownerAgentId} deps=${formatList(stage.dependsOn)} inputs=${formatList(stage.inputRefs)} outputs=${formatList(stage.outputRefs)}`,
    );
    runtime.log(`  goal: ${stage.goal}`);
    runtime.log(`  actions: ${formatList(stage.actions)}`);
    if (stage.rationale) {
      runtime.log(`  rationale: ${stage.rationale}`);
    }
  }
}

export async function autonomyHealCommand(
  opts: AutonomyHealOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const healed = await autonomy.healFleet({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          healed,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy fleet heal:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
  runtime.log(`profiles: ${healed.totals.totalProfiles}`);
  runtime.log(`changed: ${healed.totals.changed}`);
  runtime.log(`unchanged: ${healed.totals.unchanged}`);
  runtime.log(`loopCreated: ${healed.totals.loopCreated}`);
  runtime.log(`loopUpdated: ${healed.totals.loopUpdated}`);
  runtime.log(`flowStarted: ${healed.totals.flowStarted}`);
  runtime.log(`flowRestarted: ${healed.totals.flowRestarted}`);
  if (healed.governanceProposals) {
    runtime.log(
      `governanceProposals: created=${healed.governanceProposals.createdCount} existing=${healed.governanceProposals.existingCount} skipped=${healed.governanceProposals.skippedCount}`,
    );
  }
  for (const entry of healed.entries) {
    runtime.log(
      `${entry.agentId}: health ${entry.healthBefore} -> ${entry.healthAfter} loop=${entry.loopAction} flow=${entry.flowAction} scope=${formatWorkspaceScope(entry.workspaceDirs)}`,
    );
    if (entry.reasons.length > 0) {
      runtime.log(`  reasons: ${entry.reasons.join("; ")}`);
    }
  }
}

export async function autonomySuperviseCommand(
  opts: AutonomySuperviseOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const supervised = await autonomy.superviseFleet({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(typeof opts.restartBlockedFlows === "boolean"
      ? { restartBlockedFlows: opts.restartBlockedFlows }
      : {}),
    ...(opts.governanceMode ? { governanceMode: opts.governanceMode } : {}),
    ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
    ...(typeof opts.includeCapabilityInventory === "boolean"
      ? { includeCapabilityInventory: opts.includeCapabilityInventory }
      : {}),
    ...(typeof opts.includeGenesisPlan === "boolean"
      ? { includeGenesisPlan: opts.includeGenesisPlan }
      : {}),
    ...(typeof opts.recordHistory === "boolean" ? { recordHistory: opts.recordHistory } : {}),
    telemetrySource: "manual",
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          supervised,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy supervisor:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
  runtime.log(`governanceMode: ${supervised.governanceMode}`);
  runtime.log(
    `profiles: changed=${supervised.summary.changedProfiles}/${supervised.summary.totalProfiles} healthy=${supervised.summary.healthyProfiles} drift=${supervised.summary.driftProfiles} missingLoop=${supervised.summary.missingLoopProfiles} activeFlows=${supervised.summary.activeFlows}`,
  );
  runtime.log(
    `governance: created=${supervised.summary.governanceCreatedCount} applied=${supervised.summary.governanceAppliedCount} pending=${supervised.summary.governancePendingCount}`,
  );
  runtime.log(
    `capabilityGaps: total=${supervised.summary.capabilityGapCount} critical=${supervised.summary.criticalCapabilityGapCount}`,
  );
  runtime.log(
    `genesis: stages=${supervised.summary.genesisStageCount} blocked=${supervised.summary.genesisBlockedStageCount}`,
  );
  if (supervised.genesisPlan) {
    runtime.log(`genesisTeam: ${supervised.genesisPlan.teamId}`);
    runtime.log(`genesisMode: ${supervised.genesisPlan.mode}`);
  }
  runtime.log("nextActions:");
  for (const action of supervised.summary.recommendedNextActions) {
    runtime.log(`  - ${action}`);
  }
}

export async function autonomyBootstrapCommand(
  opts: AutonomyBootstrapOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const bootstrapped = await autonomy.bootstrapFleet({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(typeof opts.restartBlockedFlows === "boolean"
      ? { restartBlockedFlows: opts.restartBlockedFlows }
      : {}),
    ...(opts.governanceMode ? { governanceMode: opts.governanceMode } : {}),
    ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
    ...(typeof opts.includeCapabilityInventory === "boolean"
      ? { includeCapabilityInventory: opts.includeCapabilityInventory }
      : {}),
    ...(typeof opts.includeGenesisPlan === "boolean"
      ? { includeGenesisPlan: opts.includeGenesisPlan }
      : {}),
    ...(typeof opts.recordHistory === "boolean" ? { recordHistory: opts.recordHistory } : {}),
    telemetrySource: "manual",
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          bootstrapped,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy bootstrap:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
  runtime.log(`ready: ${bootstrapped.readiness.ready ? "yes" : "no"}`);
  runtime.log(
    `profiles: ready=${bootstrapped.readiness.profileReadyCount}/${bootstrapped.supervised.summary.totalProfiles} notReady=${bootstrapped.readiness.profileNotReadyCount} missingLoop=${bootstrapped.readiness.missingLoopProfiles} drift=${bootstrapped.readiness.driftProfiles} idle=${bootstrapped.readiness.idleProfiles} activeFlows=${bootstrapped.readiness.activeFlows}`,
  );
  runtime.log(
    `capabilityGaps: total=${bootstrapped.readiness.capabilityGapCount} critical=${bootstrapped.readiness.criticalCapabilityGapCount}`,
  );
  runtime.log(`genesisBlocked: ${bootstrapped.readiness.genesisBlockedStageCount}`);
  if (bootstrapped.readiness.blockers.length > 0) {
    runtime.log("blockers:");
    for (const blocker of bootstrapped.readiness.blockers) {
      runtime.log(`  - ${blocker}`);
    }
  }
}

export async function autonomyArchitectureReadinessCommand(
  opts: AutonomyArchitectureReadinessOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const readiness = await autonomy.getArchitectureReadiness({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(typeof opts.restartBlockedFlows === "boolean"
      ? { restartBlockedFlows: opts.restartBlockedFlows }
      : {}),
    ...(opts.governanceMode ? { governanceMode: opts.governanceMode } : {}),
    ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
    ...(typeof opts.includeCapabilityInventory === "boolean"
      ? { includeCapabilityInventory: opts.includeCapabilityInventory }
      : {}),
    ...(typeof opts.includeGenesisPlan === "boolean"
      ? { includeGenesisPlan: opts.includeGenesisPlan }
      : {}),
    ...(typeof opts.recordHistory === "boolean" ? { recordHistory: opts.recordHistory } : {}),
    telemetrySource: "manual",
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          architectureReadiness: readiness,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy architecture readiness:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`charterDir: ${readiness.charterDir || "n/a"}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(readiness.workspaceDirs)}`);
  runtime.log(`status: ${readiness.summary.status}`);
  runtime.log(
    `checks: ready=${readiness.summary.readyChecks}/${readiness.summary.totalChecks} attention=${readiness.summary.attentionChecks} blocked=${readiness.summary.blockedChecks}`,
  );
  runtime.log(
    `bootstrap: ready=${readiness.bootstrapped.readiness.ready ? "yes" : "no"} healthy=${readiness.bootstrapped.readiness.profileReadyCount}/${readiness.bootstrapped.supervised.summary.totalProfiles} activeFlows=${readiness.bootstrapped.readiness.activeFlows}`,
  );
  runtime.log("layers:");
  for (const layer of readiness.layers) {
    runtime.log(`  ${layer.id}: ${layer.status} evidence=${formatList(layer.evidence)}`);
    if (layer.blockers.length > 0) {
      runtime.log(`    blockers=${formatList(layer.blockers)}`);
    }
  }
  runtime.log("loops:");
  for (const loop of readiness.loops) {
    runtime.log(`  ${loop.id}: ${loop.status} evidence=${formatList(loop.evidence)}`);
    if (loop.blockers.length > 0) {
      runtime.log(`    blockers=${formatList(loop.blockers)}`);
    }
  }
  for (const check of [
    readiness.sandboxUniverse,
    readiness.algorithmEvolutionProtocol,
    readiness.autonomousDevelopment,
    readiness.continuousRuntime,
  ]) {
    runtime.log(`${check.id}: ${check.status} evidence=${formatList(check.evidence)}`);
    if (check.blockers.length > 0) {
      runtime.log(`  blockers=${formatList(check.blockers)}`);
    }
  }
  if (readiness.summary.blockers.length > 0) {
    runtime.log("remainingBlockers:");
    for (const blocker of readiness.summary.blockers) {
      runtime.log(`  - ${blocker}`);
    }
  }
}

export async function autonomyActivateCommand(
  opts: AutonomyActivateOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const restartBlockedFlows =
    typeof opts.restartBlockedFlows === "boolean" ? opts.restartBlockedFlows : true;
  const governanceMode = opts.governanceMode ?? "apply_safe";
  const includeCapabilityInventory =
    typeof opts.includeCapabilityInventory === "boolean" ? opts.includeCapabilityInventory : true;
  const includeGenesisPlan =
    typeof opts.includeGenesisPlan === "boolean" ? opts.includeGenesisPlan : true;
  const recordHistory = typeof opts.recordHistory === "boolean" ? opts.recordHistory : true;
  const readiness = await autonomy.getArchitectureReadiness({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    restartBlockedFlows,
    governanceMode,
    ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
    includeCapabilityInventory,
    includeGenesisPlan,
    recordHistory,
    telemetrySource: "manual",
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          activated: readiness,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy governed activation:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`charterDir: ${readiness.charterDir || "n/a"}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(readiness.workspaceDirs)}`);
  runtime.log(`status: ${readiness.summary.status}`);
  runtime.log(
    `activationDefaults: governanceMode=${governanceMode} restartBlockedFlows=${restartBlockedFlows ? "yes" : "no"} capabilityInventory=${includeCapabilityInventory ? "yes" : "no"} genesisPlan=${includeGenesisPlan ? "yes" : "no"} history=${recordHistory ? "yes" : "no"}`,
  );
  runtime.log(
    `checks: ready=${readiness.summary.readyChecks}/${readiness.summary.totalChecks} attention=${readiness.summary.attentionChecks} blocked=${readiness.summary.blockedChecks}`,
  );
  runtime.log(
    `bootstrap: ready=${readiness.bootstrapped.readiness.ready ? "yes" : "no"} healthy=${readiness.bootstrapped.readiness.profileReadyCount}/${readiness.bootstrapped.supervised.summary.totalProfiles} activeFlows=${readiness.bootstrapped.readiness.activeFlows}`,
  );
  runtime.log(
    `supervisor: changed=${readiness.bootstrapped.supervised.summary.changedProfiles ?? "n/a"} healthy=${readiness.bootstrapped.supervised.summary.healthyProfiles ?? "n/a"} activeFlows=${readiness.bootstrapped.supervised.summary.activeFlows ?? "n/a"}`,
  );
  if (readiness.summary.blockers.length > 0) {
    runtime.log("remainingBlockers:");
    for (const blocker of readiness.summary.blockers) {
      runtime.log(`  - ${blocker}`);
    }
  }
}

export async function autonomyGovernanceCommand(
  opts: AutonomyGovernanceOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const governanceProposals = await autonomy.synthesizeGovernanceProposals({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          governanceProposals,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy governance proposal synthesis:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(governanceProposals.requestedAgentIds)}`);
  runtime.log(`eligibleAgentIds: ${formatList(governanceProposals.eligibleAgentIds)}`);
  runtime.log(`findings: ${formatList(governanceProposals.findingIds)}`);
  runtime.log(`created: ${governanceProposals.createdCount}`);
  runtime.log(`existing: ${governanceProposals.existingCount}`);
  runtime.log(`skipped: ${governanceProposals.skippedCount}`);
  if (governanceProposals.results.length === 0) {
    runtime.log("No governance proposal work was synthesized.");
    return;
  }
  for (const result of governanceProposals.results) {
    runtime.log(
      `${result.ruleId} [${result.status}] ${result.title}${result.proposalId ? ` -> ${result.proposalId}` : ""}`,
    );
    if (result.reason) {
      runtime.log(`  reason: ${result.reason}`);
    }
    if (result.operations.length > 0) {
      runtime.log(
        `  ops: ${result.operations.map((entry) => `${entry.kind}:${entry.path}`).join(", ")}`,
      );
    }
  }
}

export async function autonomyGovernanceReconcileCommand(
  opts: AutonomyGovernanceReconcileOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const governanceReconciled = await autonomy.reconcileGovernanceProposals({
    ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          sessionKey,
          governanceReconciled,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log("Autonomy governance reconcile:");
  runtime.log(`sessionKey: ${sessionKey}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(governanceReconciled.requestedAgentIds)}`);
  runtime.log(`eligibleAgentIds: ${formatList(governanceReconciled.eligibleAgentIds)}`);
  runtime.log(`findings: ${formatList(governanceReconciled.findingIds)}`);
  runtime.log(`mode: ${governanceReconciled.mode}`);
  runtime.log(
    `synthesized: created=${governanceReconciled.synthesized.createdCount} existing=${governanceReconciled.synthesized.existingCount} skipped=${governanceReconciled.synthesized.skippedCount}`,
  );
  runtime.log(`reviewed: ${governanceReconciled.reviewedCount}`);
  runtime.log(`applied: ${governanceReconciled.appliedCount}`);
  runtime.log(`skipped: ${governanceReconciled.skippedCount}`);
  if (governanceReconciled.entries.length === 0) {
    runtime.log("No governance proposal work was reconciled.");
    return;
  }
  for (const entry of governanceReconciled.entries) {
    runtime.log(
      `${entry.ruleId} [${entry.synthesisStatus}] safe=${entry.safe ? "yes" : "no"} autoApproved=${entry.autoApproved ? "yes" : "no"} autoApplied=${entry.autoApplied ? "yes" : "no"}${entry.proposalId ? ` -> ${entry.proposalId}` : ""}`,
    );
    runtime.log(
      `  proposalStatus: before=${entry.proposalStatusBefore ?? "n/a"} after=${entry.proposalStatusAfter ?? "n/a"}`,
    );
    if (entry.reason) {
      runtime.log(`  reason: ${entry.reason}`);
    }
    if (entry.operations.length > 0) {
      runtime.log(
        `  ops: ${entry.operations.map((operation) => `${operation.kind}:${operation.path}`).join(", ")}`,
      );
    }
  }
}

export async function autonomyHistoryCommand(
  opts: AutonomyHistoryOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const mode = normalizeOptionalString(opts.mode);
  const source = normalizeOptionalString(opts.source);
  if (mode && !AUTONOMY_HISTORY_MODES.has(mode)) {
    runtime.error(`Unsupported autonomy history mode: ${mode}`);
    runtime.exit(1);
    return;
  }
  if (source && !AUTONOMY_HISTORY_SOURCES.has(source)) {
    runtime.error(`Unsupported autonomy history source: ${source}`);
    runtime.exit(1);
    return;
  }

  try {
    const history = await autonomy.getFleetHistory({
      ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
      ...(typeof opts.limit === "number" ? { limit: opts.limit } : {}),
      ...(mode ? { mode: mode as "heal" | "reconcile" } : {}),
      ...(source ? { source: source as "manual" | "startup" | "supervisor" } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            history,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy history:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
    runtime.log(`events: ${history.events.length}`);
    runtime.log(`total: ${history.total}`);
    runtime.log(`truncated: ${history.truncated ? "yes" : "no"}`);
    if (history.events.length === 0) {
      runtime.log("No autonomy maintenance history recorded yet.");
      return;
    }
    for (const event of history.events) {
      runtime.log(
        `${new Date(event.ts).toISOString()} ${event.mode}/${event.source} changed=${event.totals.changed}/${event.totals.totalProfiles} loopCreated=${event.totals.loopCreated} loopUpdated=${event.totals.loopUpdated} flowStarted=${event.totals.flowStarted} flowRestarted=${event.totals.flowRestarted} scope=${formatWorkspaceScope(event.workspaceDirs)}`,
      );
      for (const entry of event.entries) {
        runtime.log(
          `  ${entry.agentId}: health ${entry.healthBefore ?? "n/a"} -> ${entry.healthAfter ?? "n/a"} loop=${entry.loopAction ?? "n/a"} flow=${entry.flowAction ?? "n/a"} scope=${formatWorkspaceScope(entry.workspaceDirs)}`,
        );
        if (entry.reasons.length > 0) {
          runtime.log(`    reasons: ${entry.reasons.join("; ")}`);
        }
      }
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to read autonomy history.");
    runtime.exit(1);
  }
}

export async function autonomyLoopShowCommand(
  opts: AutonomyLoopShowOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  try {
    const loop = await autonomy.showLoopJob({
      agentId: opts.agentId,
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            loop,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy loop:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${loop.profile.id}`);
    runtime.log(`defaultLoopName: ${loop.profile.bootstrap.loop.name}`);
    runtime.log(`defaultEveryMs: ${loop.profile.bootstrap.loop.schedule.everyMs}`);
    if (!loop.loop?.job) {
      runtime.log("jobId: none");
      return;
    }
    runtime.log(`jobId: ${loop.loop.job.id}`);
    runtime.log(`enabled: ${loop.loop.job.enabled ? "yes" : "no"}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(loop.loop.workspaceDirs)}`);
    runtime.log(`schedule: ${JSON.stringify(loop.loop.job.schedule)}`);
    runtime.log(`nextRunAt: ${loop.loop.job.state.nextRunAtMs ?? "n/a"}`);
    runtime.log(`lastRunAt: ${loop.loop.job.state.lastRunAtMs ?? "n/a"}`);
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to show autonomy loop.");
    runtime.exit(1);
  }
}

export async function autonomyLoopEnableCommand(
  opts: AutonomyLoopEnableOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  try {
    const upserted = await autonomy.upsertLoopJob({
      agentId: opts.agentId,
      ...(typeof opts.everyMs === "number" ? { everyMs: opts.everyMs } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            upserted,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy loop upserted:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${upserted.profile.id}`);
    runtime.log(`created: ${upserted.created ? "yes" : "no"}`);
    runtime.log(`updated: ${upserted.updated ? "yes" : "no"}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(upserted.loop.workspaceDirs)}`);
    runtime.log(`jobId: ${upserted.loop.job.id}`);
    runtime.log(
      `everyMs: ${upserted.loop.job.schedule.kind === "every" ? upserted.loop.job.schedule.everyMs : "n/a"}`,
    );
    if (upserted.reconciledRemovedJobIds?.length) {
      runtime.log(`reconciledRemovedJobIds: ${upserted.reconciledRemovedJobIds.join(", ")}`);
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to enable autonomy loop.");
    runtime.exit(1);
  }
}

export async function autonomyLoopReconcileCommand(
  opts: AutonomyLoopReconcileOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  try {
    const reconciled = await autonomy.reconcileLoopJobs({
      ...(opts.agentIds?.length ? { agentIds: opts.agentIds } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            reconciled,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy loops reconciled:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
    runtime.log(`profiles: ${reconciled.reconciled.length}`);
    runtime.log(`created: ${reconciled.createdCount}`);
    runtime.log(`updated: ${reconciled.updatedCount}`);
    for (const entry of reconciled.reconciled) {
      runtime.log(
        `${entry.profile.id}: ${entry.created ? "created" : "updated"} (${entry.loop.job.id}) scope=${formatWorkspaceScope(entry.loop.workspaceDirs)}`,
      );
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to reconcile autonomy loops.");
    runtime.exit(1);
  }
}

export async function autonomyLoopDisableCommand(
  opts: AutonomyLoopDisableOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  try {
    const removed = await autonomy.removeLoopJob({
      agentId: opts.agentId,
      ...(opts.jobId !== undefined ? { jobId: opts.jobId } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            removed,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy loop remove result:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${removed.profile.id}`);
    runtime.log(`removed: ${removed.removed ? "yes" : "no"}`);
    runtime.log(`targetJobId: ${removed.targetJobId ?? "n/a"}`);
    runtime.log(`removedJobIds: ${removed.removedJobIds.join(", ") || "n/a"}`);
    if (removed.reason) {
      runtime.log(`reason: ${removed.reason}`);
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to disable autonomy loop.");
    runtime.exit(1);
  }
}

export async function autonomyStartCommand(
  opts: AutonomyStartOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  try {
    const seedTask = resolveSeedTaskInput(opts);
    const started = autonomy.startManagedFlow({
      agentId: opts.agentId,
      ...(opts.goal !== undefined ? { goal: opts.goal } : {}),
      ...(opts.controllerId !== undefined ? { controllerId: opts.controllerId } : {}),
      ...(opts.currentStep !== undefined ? { currentStep: opts.currentStep } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
      ...(opts.notifyPolicy !== undefined ? { notifyPolicy: opts.notifyPolicy } : {}),
      ...(opts.status !== undefined ? { status: opts.status } : {}),
      ...(seedTask !== undefined ? { seedTask } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            started,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy flow started:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${started.profile.id}`);
    runtime.log(`flowId: ${started.flow.id}`);
    runtime.log(`flowStatus: ${started.flow.status}`);
    runtime.log(`controllerId: ${resolveFlowControllerId(started.flow) ?? "n/a"}`);
    runtime.log(`goal: ${started.flow.goal}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(resolveFlowWorkspaceDirs(started.flow))}`);
    logFlowRuntimeProjection(runtime, started.flow);
    if (started.seedTask) {
      runtime.log(`seedTaskId: ${started.seedTask.id}`);
      runtime.log(`seedTaskStatus: ${started.seedTask.status}`);
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to start autonomy flow.");
    runtime.exit(1);
  }
}

export async function autonomyCancelCommand(
  opts: AutonomyCancelOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  try {
    const cancelled = await autonomy.cancelManagedFlow({
      agentId: opts.agentId,
      ...(opts.flowId !== undefined ? { flowId: opts.flowId } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            cancelled,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy flow cancel result:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${cancelled.profile.id}`);
    runtime.log(`targetFlowId: ${cancelled.targetFlowId ?? "n/a"}`);
    runtime.log(`found: ${cancelled.outcome.found ? "yes" : "no"}`);
    runtime.log(`cancelled: ${cancelled.outcome.cancelled ? "yes" : "no"}`);
    if (cancelled.outcome.reason) {
      runtime.log(`reason: ${cancelled.outcome.reason}`);
    }
    if (cancelled.outcome.flow) {
      runtime.log(`flowId: ${cancelled.outcome.flow.id}`);
      runtime.log(`flowStatus: ${cancelled.outcome.flow.status}`);
      runtime.log(`flowUpdatedAt: ${cancelled.outcome.flow.updatedAt}`);
    }
    if (cancelled.outcome.seedTask) {
      runtime.log(`seedTaskId: ${cancelled.outcome.seedTask.id}`);
      runtime.log(`seedTaskStatus: ${cancelled.outcome.seedTask.status}`);
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to cancel autonomy flow.");
    runtime.exit(1);
  }
}

export async function autonomyReplaySubmitCommand(
  opts: AutonomyReplaySubmitOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const { sessionKey, runtime: autonomy } = bindAutonomyRuntime({
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
  });
  try {
    const submitted = await autonomy.submitSandboxReplay({
      agentId: opts.agentId,
      ...(opts.flowId !== undefined ? { flowId: opts.flowId } : {}),
      replayPassed: opts.replayPassed,
      qaPassed: opts.qaPassed,
      ...(opts.auditPassed !== undefined ? { auditPassed: opts.auditPassed } : {}),
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            sessionKey,
            submitted,
          },
          null,
          2,
        ),
      );
      return;
    }

    runtime.log("Autonomy sandbox replay submission:");
    runtime.log(`sessionKey: ${sessionKey}`);
    runtime.log(`agentId: ${submitted.profile.id}`);
    runtime.log(`targetFlowId: ${submitted.targetFlowId ?? "n/a"}`);
    runtime.log(`found: ${submitted.outcome.found ? "yes" : "no"}`);
    runtime.log(`applied: ${submitted.outcome.applied ? "yes" : "no"}`);
    if (submitted.outcome.reason) {
      runtime.log(`reason: ${submitted.outcome.reason}`);
    }
    if (submitted.outcome.decision) {
      runtime.log(
        `promotionDecision: replay=${submitted.outcome.decision.replayPassed ? "pass" : "fail"} qa=${submitted.outcome.decision.qaPassed ? "pass" : "fail"} audit=${submitted.outcome.decision.auditPassed ? "pass" : "fail"} promote=${submitted.outcome.decision.canPromote ? "yes" : "no"}`,
      );
    }
    if (submitted.outcome.flow) {
      runtime.log(`flowId: ${submitted.outcome.flow.id}`);
      runtime.log(`flowStatus: ${submitted.outcome.flow.status}`);
      runtime.log(`flowUpdatedAt: ${submitted.outcome.flow.updatedAt}`);
    }
    if (submitted.outcome.seedTask) {
      runtime.log(`seedTaskId: ${submitted.outcome.seedTask.id}`);
      runtime.log(`seedTaskStatus: ${submitted.outcome.seedTask.status}`);
    }
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to submit autonomy sandbox replay.",
    );
    runtime.exit(1);
  }
}
