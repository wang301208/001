import { html, nothing } from "lit";
import { formatDurationHuman, formatMs, formatRelativeTimestamp } from "../format.ts";
import { formatCronSchedule, formatCronState } from "../presenter.ts";
import type {
  AutonomyFlowStatus,
  AutonomyHistoryModeFilter,
  AutonomyHistorySourceFilter,
  AutonomyNotifyPolicy,
  AutonomyReplayVerdictDraft,
  AutonomySeedTaskRuntime,
  AutonomySeedTaskStatus,
} from "../controllers/autonomy.ts";
import {
  formatAutonomyWorkspaceDirsDraft,
  parseAutonomyWorkspaceDirsDraft,
} from "../controllers/autonomy.ts";
import type {
  AutonomyCapabilityInventoryResult,
  AutonomyGenesisPlanResult,
  AutonomyGovernanceReconcileResult,
  AutonomyGovernanceProposalsResult,
  AutonomyHistoryResult,
  AutonomyOverviewResult,
  AutonomyReplaySubmitResult,
  AutonomyShowResult,
  AutonomySuperviseResult,
} from "../types.ts";

type LatestAutonomyFlow = NonNullable<AutonomyShowResult["latestFlow"]>;
type ManagedAutonomyProjection = NonNullable<LatestAutonomyFlow["managedAutonomy"]>;
type ManagedExecutionProjection = NonNullable<LatestAutonomyFlow["managedExecution"]>;
type ManagedProjectProjection = NonNullable<ManagedAutonomyProjection["project"]>;
type ManagedAlgorithmProjection = Extract<ManagedProjectProjection, { kind: "algorithm_research" }>;
type ManagedSovereigntyProjection = Extract<ManagedProjectProjection, { kind: "sovereignty_watch" }>;
type SandboxManagedProjectProjection = Exclude<ManagedProjectProjection, ManagedSovereigntyProjection>;
type SandboxControllerProjection = NonNullable<
  NonNullable<SandboxManagedProjectProjection["sandboxController"]>
>;
type SandboxReplayRunnerProjection = NonNullable<
  NonNullable<SandboxManagedProjectProjection["sandboxReplayRunner"]>
>;
type ManagedGraphNode = ManagedExecutionProjection["taskGraph"][number];

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function renderChipList(values: string[], emptyLabel = "none") {
  if (values.length === 0) {
    return html`<span class="muted">${emptyLabel}</span>`;
  }
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      ${values.map((value) => html`<span class="chip">${value}</span>`)}
    </div>
  `;
}

function normalizeWorkspaceScopeDirs(
  workspaceDirs?: string[],
  primaryWorkspaceDir?: string | null,
): string[] {
  return Array.from(
    new Set(
      [...(workspaceDirs ?? []), ...(primaryWorkspaceDir ? [primaryWorkspaceDir] : [])]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).toSorted((left, right) => left.localeCompare(right));
}

function renderWorkspaceScope(
  label: string,
  workspaceDirs?: string[],
  primaryWorkspaceDir?: string | null,
) {
  const scope = normalizeWorkspaceScopeDirs(workspaceDirs, primaryWorkspaceDir);
  if (scope.length === 0) {
    return nothing;
  }
  return html`
    <div style="margin-top: 12px;">
      <div class="label">${label}</div>
      ${renderChipList(scope)}
    </div>
  `;
}

function renderKv(label: string, value: unknown, mono = false) {
  const displayValue =
    value === null || value === undefined || value === "" ? "n/a" : String(value);
  return html`
    <div class="agent-kv">
      <div class="label">${label}</div>
      <div class=${mono ? "mono" : ""}>${displayValue}</div>
    </div>
  `;
}

function resolveAutonomyFlowState(
  flow: { state?: unknown } | null | undefined,
): Record<string, unknown> | null {
  const state = flow?.state;
  if (!isRecordLike(state)) {
    return null;
  }
  const autonomy = state.autonomy;
  return isRecordLike(autonomy) ? autonomy : null;
}

function resolveManagedAutonomyProjection(
  flow: AutonomyShowResult["latestFlow"] | null | undefined,
): ManagedAutonomyProjection | null {
  return flow?.managedAutonomy ?? null;
}

function resolveManagedProjectProjection(
  flow: AutonomyShowResult["latestFlow"] | null | undefined,
): ManagedProjectProjection | null {
  return resolveManagedAutonomyProjection(flow)?.project ?? null;
}

function resolveManagedExecutionProjection(
  flow: AutonomyShowResult["latestFlow"] | null | undefined,
): ManagedExecutionProjection | null {
  if (flow?.managedExecution) {
    return flow.managedExecution;
  }
  const project = resolveManagedProjectProjection(flow);
  return project?.kind === "execution_system" ? project : null;
}

function resolveSandboxManagedProjectProjection(
  project: ManagedProjectProjection | null | undefined,
): SandboxManagedProjectProjection | null {
  if (!project || project.kind === "sovereignty_watch") {
    return null;
  }
  return project;
}

function resolveFlowSandboxReplayRunner(
  flow: AutonomyShowResult["latestFlow"] | null | undefined,
): SandboxReplayRunnerProjection | null {
  const project = resolveSandboxManagedProjectProjection(resolveManagedProjectProjection(flow));
  if (project?.sandboxReplayRunner) {
    return project.sandboxReplayRunner;
  }
  return resolveManagedExecutionProjection(flow)?.sandboxReplayRunner ?? null;
}

function resolveFlowControllerId(result: AutonomyShowResult | null): string | null {
  const managedAutonomy = resolveManagedAutonomyProjection(result?.latestFlow);
  if (managedAutonomy?.controllerId) {
    return managedAutonomy.controllerId;
  }
  const autonomy = resolveAutonomyFlowState(result?.latestFlow);
  if (!autonomy || typeof autonomy.controllerId !== "string") {
    return null;
  }
  return autonomy.controllerId;
}

function resolveFlowWorkspaceDirs(
  flow: { state?: unknown } | null | undefined,
): string[] {
  const managedAutonomy = resolveManagedAutonomyProjection(
    flow as AutonomyShowResult["latestFlow"] | null | undefined,
  );
  if (managedAutonomy) {
    return normalizeWorkspaceScopeDirs(
      managedAutonomy.workspaceDirs,
      managedAutonomy.primaryWorkspaceDir ?? null,
    );
  }
  const autonomy = resolveAutonomyFlowState(flow);
  if (!autonomy) {
    return [];
  }
  const primaryWorkspaceDir =
    typeof autonomy.primaryWorkspaceDir === "string" && autonomy.primaryWorkspaceDir.trim().length > 0
      ? autonomy.primaryWorkspaceDir
      : null;
  const workspaceDirs = Array.isArray(autonomy.workspaceDirs)
    ? autonomy.workspaceDirs.filter((value): value is string => typeof value === "string")
    : [];
  return normalizeWorkspaceScopeDirs(workspaceDirs, primaryWorkspaceDir);
}

function resolveFlowPrimaryWorkspaceDir(
  flow: { state?: unknown } | null | undefined,
): string | null {
  const managedAutonomy = resolveManagedAutonomyProjection(
    flow as AutonomyShowResult["latestFlow"] | null | undefined,
  );
  if (managedAutonomy?.primaryWorkspaceDir?.trim()) {
    return managedAutonomy.primaryWorkspaceDir.trim();
  }
  const autonomy = resolveAutonomyFlowState(flow);
  if (!autonomy || typeof autonomy.primaryWorkspaceDir !== "string") {
    return null;
  }
  const primaryWorkspaceDir = autonomy.primaryWorkspaceDir.trim();
  return primaryWorkspaceDir.length > 0 ? primaryWorkspaceDir : null;
}

function resolveAutonomyWorkspaceScopePlaceholder(params: {
  agentId: string;
  result: AutonomyShowResult | null;
  overviewResult: AutonomyOverviewResult | null;
  capabilitiesResult: AutonomyCapabilityInventoryResult | null;
  genesisResult: AutonomyGenesisPlanResult | null;
  historyResult: AutonomyHistoryResult | null;
}): string {
  const overviewEntry = params.overviewResult?.overview.entries.find(
    (entry) => entry.agentId === params.agentId,
  );
  const candidates = [
    params.capabilitiesResult?.capabilities.workspaceDirs,
    params.genesisResult?.genesisPlan.workspaceDirs,
    params.result?.loopJob?.workspaceDirs,
    resolveFlowWorkspaceDirs(params.result?.latestFlow),
    overviewEntry?.workspaceDirs,
    params.historyResult?.history.events[0]?.workspaceDirs,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeWorkspaceScopeDirs(candidate);
    if (normalized.length > 0) {
      return formatAutonomyWorkspaceDirsDraft(normalized);
    }
  }
  return "One path per line or comma-separated";
}

function canCancelFlowStatus(status: string | undefined): boolean {
  return status === "queued" || status === "running" || status === "waiting" || status === "blocked";
}

function stripAutonomyLoopMarker(value: string | undefined): string {
  return (value ?? "").replace(/^\[\[autonomy-loop:[^\]]+\]\]\s*/i, "").trim();
}

function resolveLoopEveryMs(result: AutonomyShowResult | null): number | null {
  const schedule = result?.loopJob?.job.schedule;
  return schedule?.kind === "every" ? schedule.everyMs : null;
}

function formatFleetHealthLabel(
  health: NonNullable<AutonomyOverviewResult["overview"]["entries"][number]["health"]>,
): string {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "idle":
      return "Idle";
    case "drift":
      return "Drift";
    case "missing_loop":
      return "Missing Loop";
    default:
      return String(health);
  }
}

function formatSuggestedActionLabel(
  action: AutonomyOverviewResult["overview"]["entries"][number]["suggestedAction"],
): string {
  switch (action) {
    case "reconcile_loop":
      return "Reconcile Loop";
    case "start_flow":
      return "Start Flow";
    case "inspect_flow":
      return "Inspect Flow";
    default:
      return "Observe";
  }
}

function formatSuggestedActionButtonLabel(
  action: AutonomyOverviewResult["overview"]["entries"][number]["suggestedAction"],
): string | null {
  switch (action) {
    case "reconcile_loop":
      return "Fix Loop";
    case "start_flow":
      return "Start Flow";
    case "inspect_flow":
      return "Inspect Flow";
    default:
      return null;
  }
}

function resolveFleetLoopSummary(
  entry: AutonomyOverviewResult["overview"]["entries"][number],
): string {
  if (entry.actualLoopEveryMs == null) {
    return `missing (expected ${formatMs(entry.expectedLoopEveryMs)})`;
  }
  if (entry.actualLoopEveryMs === entry.expectedLoopEveryMs) {
    return formatMs(entry.actualLoopEveryMs);
  }
  return `${formatMs(entry.actualLoopEveryMs)} -> expected ${formatMs(entry.expectedLoopEveryMs)}`;
}

function formatHistoryModeLabel(
  mode: NonNullable<AutonomyHistoryResult["history"]["events"][number]["mode"]>,
): string {
  return mode === "heal" ? "Heal" : "Reconcile";
}

function formatHistorySourceLabel(
  source: NonNullable<AutonomyHistoryResult["history"]["events"][number]["source"]>,
): string {
  switch (source) {
    case "startup":
      return "Startup";
    case "supervisor":
      return "Supervisor";
    default:
      return "Manual";
  }
}

function formatGovernanceProposalStatusLabel(
  status: NonNullable<AutonomyGovernanceProposalsResult["results"][number]["status"]>,
): string {
  switch (status) {
    case "created":
      return "Created";
    case "existing":
      return "Existing";
    case "skipped":
      return "Skipped";
    default:
      return String(status);
  }
}

function formatGovernanceProposalLifecycleLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "applied":
      return "Applied";
    default:
      return status ?? "n/a";
  }
}

function formatGovernanceReconcileModeLabel(
  mode: import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode,
): string {
  return mode === "force_apply_all" ? "Force Apply All" : "Apply Safe";
}

function formatSupervisorGovernanceModeLabel(
  mode: AutonomySuperviseResult["supervised"]["governanceMode"],
): string {
  switch (mode) {
    case "none":
      return "None";
    case "force_apply_all":
      return "Force Apply All";
    default:
      return "Apply Safe";
  }
}

function formatCapabilityEntryStatusLabel(
  status: NonNullable<AutonomyCapabilityInventoryResult["capabilities"]["entries"][number]["status"]>,
): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "attention":
      return "Attention";
    case "blocked":
      return "Blocked";
    default:
      return String(status);
  }
}

function formatCapabilityGapSeverityLabel(
  severity: NonNullable<AutonomyCapabilityInventoryResult["capabilities"]["gaps"][number]["severity"]>,
): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Info";
  }
}

function formatGenesisModeLabel(
  mode: NonNullable<AutonomyGenesisPlanResult["genesisPlan"]["mode"]>,
): string {
  switch (mode) {
    case "repair":
      return "Repair";
    case "build":
      return "Build";
    default:
      return "Steady State";
  }
}

function formatGenesisStageStatusLabel(
  status: NonNullable<AutonomyGenesisPlanResult["genesisPlan"]["stages"][number]["status"]>,
): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "waiting":
      return "Waiting";
    case "blocked":
      return "Blocked";
    default:
      return String(status);
  }
}

function formatCapabilityRequestStatusLabel(
  status: NonNullable<ManagedExecutionProjection["capabilityRequest"]["status"]>,
): string {
  switch (status) {
    case "required":
      return "Required";
    case "recommended":
      return "Recommended";
    default:
      return "Not Needed";
  }
}

function formatSandboxControllerStageStatusLabel(
  status: NonNullable<SandboxControllerProjection["stages"][number]["status"]>,
): string {
  switch (status) {
    case "active":
      return "Active";
    case "blocked":
      return "Blocked";
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    default:
      return "Planned";
  }
}

function formatSandboxReplayStatusLabel(
  status: NonNullable<SandboxReplayRunnerProjection["status"]>,
): string {
  switch (status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    default:
      return "Ready";
  }
}

function formatSandboxArtifactSize(sizeBytes: number | undefined): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "n/a";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSandboxArtifactHash(sha256: string | undefined): string {
  return sha256?.slice(0, 12) ?? "n/a";
}

function renderGraphNodes(nodes: ManagedGraphNode[], emptyLabel = "No managed graph nodes.") {
  if (nodes.length === 0) {
    return html`<div class="callout info" style="margin-top: 12px;">${emptyLabel}</div>`;
  }
  return html`
    <div class="list" style="margin-top: 10px;">
      ${nodes.map(
        (node) => html`
          <div class="list-item">
            <div class="list-main">
              <div class="list-title">${node.title}</div>
              <div class="list-sub mono">${node.id}</div>
            </div>
            <div class="list-meta">
              <div>output=${node.output}</div>
              <div>deps=${node.dependsOn.length ? node.dependsOn.join(", ") : "none"}</div>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function renderManagedExecutionProjection(
  execution: ManagedExecutionProjection | null,
) {
  if (!execution) {
    return nothing;
  }
  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="card-title">Execution Runtime Projection</div>
      <div class="card-sub">Structured executor graph, governed capability request, and genesis handoff state.</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Goal Layer", execution.goalContract.layer ?? "n/a")}
        ${renderKv("Authority", execution.goalContract.authorityLevel ?? "n/a")}
        ${renderKv(
          "Capability Request",
          formatCapabilityRequestStatusLabel(execution.capabilityRequest.status),
        )}
        ${renderKv("Handoff Team", execution.capabilityRequest.handoffTeamId, true)}
        ${renderKv("Task Graph", execution.taskGraph.length)}
        ${renderKv("Execution Phases", execution.executionPlan.phases.length)}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Capability Request</div>
        <div class="callout ${execution.capabilityRequest.status === "required" ? "warn" : execution.capabilityRequest.status === "recommended" ? "info" : "info"}" style="margin-top: 8px;">
          ${execution.capabilityRequest.reason}
        </div>
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Focus Gap IDs</div>
        ${renderChipList(execution.capabilityRequest.focusGapIds, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Request Blockers</div>
        ${renderChipList(execution.capabilityRequest.blockers, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Runtime Hooks</div>
        ${renderChipList(execution.executionPlan.runtimeHooks, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Collaborators</div>
        ${renderChipList(execution.executionPlan.collaborators, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Observed Capability Gaps</div>
        ${renderChipList(execution.observedCapabilityGaps, "none")}
      </div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Genesis Team", execution.genesisPlan.teamId, true)}
        ${renderKv("Genesis Mode", formatGenesisModeLabel(execution.genesisPlan.mode))}
        ${renderKv("Genesis Gaps", execution.genesisPlan.focusGapIds.length)}
        ${renderKv("Genesis Blockers", execution.genesisPlan.blockers.length)}
      </div>
      <div style="margin-top: 14px;">
        <div class="label">Task Graph</div>
        ${renderGraphNodes(execution.taskGraph, "No managed execution graph nodes.")}
      </div>
      <div style="margin-top: 14px;">
        <div class="label">Execution Phases</div>
        ${renderGraphNodes(execution.executionPlan.phases, "No managed execution phases.")}
      </div>
    </section>
  `;
}

function renderManagedAlgorithmProjection(project: ManagedProjectProjection | null) {
  if (!project || project.kind !== "algorithm_research") {
    return nothing;
  }
  const algorithm = project as ManagedAlgorithmProjection;
  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="card-title">Algorithm Research Projection</div>
      <div class="card-sub">Governed benchmark pressure, research phases, and promotion evidence for decision-engine evolution.</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Focus Gaps", algorithm.focusGapIds.length)}
        ${renderKv("Gap Count", algorithm.inventorySummary.gapCount)}
        ${renderKv("Critical Gaps", algorithm.inventorySummary.criticalGapCount)}
        ${renderKv("Algorithms", algorithm.inventorySummary.algorithmCount)}
        ${renderKv("Ready", algorithm.inventorySummary.algorithmReady)}
        ${renderKv("Attention", algorithm.inventorySummary.algorithmAttention)}
        ${renderKv("Blocked", algorithm.inventorySummary.algorithmBlocked)}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Target Domains</div>
        ${renderChipList(algorithm.researchPlan.targetDomains, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Collaborators</div>
        ${renderChipList(algorithm.researchPlan.collaborators, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Runtime Hooks</div>
        ${renderChipList(algorithm.researchPlan.runtimeHooks, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Observed Algorithm Gaps</div>
        ${renderChipList(algorithm.observedAlgorithmGaps, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Required Evidence</div>
        ${renderChipList(algorithm.promotionPolicy.requiredEvidence, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Promotion Blockers</div>
        ${renderChipList(algorithm.promotionPolicy.blockers, "none")}
      </div>
      <div style="margin-top: 14px;">
        <div class="label">Research Phases</div>
        ${renderGraphNodes(algorithm.researchPlan.phases, "No managed algorithm research phases.")}
      </div>
    </section>
  `;
}

function renderManagedGenesisProjection(project: ManagedProjectProjection | null) {
  if (!project || project.kind !== "genesis_stage") {
    return nothing;
  }
  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="card-title">Genesis Runtime Projection</div>
      <div class="card-sub">Assigned genesis stage, dependency graph, and governed handoff state for this agent.</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Team", project.teamTitle ?? project.teamId)}
        ${renderKv("Mode", formatGenesisModeLabel(project.mode))}
        ${renderKv("Stage", project.stage.title)}
        ${renderKv("Owner", project.stage.ownerAgentId, true)}
        ${renderKv("Status", formatGenesisStageStatusLabel(project.stage.status))}
        ${renderKv("Stage Graph", project.stageGraph.length)}
      </div>
      <div class="callout info" style="margin-top: 12px;">${project.stage.goal}</div>
      <div style="margin-top: 12px;">
        <div class="label">Stage Actions</div>
        ${renderChipList(project.stage.actions, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Focus Gap IDs</div>
        ${renderChipList(project.focusGapIds, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Blockers</div>
        ${renderChipList(project.blockers, "none")}
      </div>
      <div style="margin-top: 14px;">
        <div class="label">Stage Dependency Graph</div>
        <div class="list" style="margin-top: 10px;">
          ${project.stageGraph.map(
            (stage) => html`
              <div class="list-item">
                <div class="list-main">
                  <div class="list-title">${stage.title}</div>
                  <div class="list-sub mono">${stage.id}</div>
                </div>
                <div class="list-meta">
                  <div>${formatGenesisStageStatusLabel(stage.status)}</div>
                  <div>deps=${stage.dependsOn.length ? stage.dependsOn.join(", ") : "none"}</div>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}

function renderManagedSovereigntyProjection(project: ManagedProjectProjection | null) {
  if (!project || project.kind !== "sovereignty_watch") {
    return nothing;
  }
  const sovereignty = project as ManagedSovereigntyProjection;
  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="card-title">Sovereignty Watch Projection</div>
      <div class="card-sub">Governance integrity snapshot, boundary triage plan, and automatic enforcement posture.</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Discovered", sovereignty.governanceOverview.discovered ? "yes" : "no")}
        ${renderKv("Missing Artifacts", sovereignty.governanceOverview.missingArtifactCount)}
        ${renderKv("Findings", sovereignty.governanceOverview.findingCount)}
        ${renderKv("Pending Proposals", sovereignty.governanceOverview.proposalPendingCount)}
        ${renderKv("Enforcement", sovereignty.governanceOverview.enforcementActive ? "active" : "clear")}
        ${renderKv("Freeze Reason", sovereignty.governanceOverview.freezeReasonCode ?? "n/a")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Reserved Authorities</div>
        ${renderChipList(sovereignty.watchPlan.reservedAuthorities, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Freeze Targets</div>
        ${renderChipList(sovereignty.watchPlan.freezeTargets, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Automatic Enforcement</div>
        ${renderChipList(sovereignty.incidentPolicy.automaticEnforcementActions, "none")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Critical Findings</div>
        ${renderChipList(sovereignty.incidentPolicy.criticalFindings, "none")}
      </div>
      <div style="margin-top: 14px;">
        <div class="label">Watch Phases</div>
        ${renderGraphNodes(sovereignty.watchPlan.phases, "No managed sovereignty watch phases.")}
      </div>
    </section>
  `;
}

function renderSandboxUniverseProjection(project: ManagedProjectProjection | null) {
  const sandboxProject = resolveSandboxManagedProjectProjection(project);
  if (!sandboxProject) {
    return nothing;
  }
  const sandboxUniverse = sandboxProject.sandboxUniverse ?? null;
  const sandboxController = sandboxProject.sandboxController ?? null;
  const sandboxReplayRunner = sandboxProject.sandboxReplayRunner ?? null;
  if (!sandboxUniverse && !sandboxController && !sandboxReplayRunner) {
    return nothing;
  }
  const collectedEvidence =
    sandboxController?.evidence.filter((entry) => entry.status === "collected").length ?? 0;
  const failedEvidence =
    sandboxController?.evidence.filter((entry) => entry.status === "failed").length ?? 0;
  const universeId =
    sandboxUniverse?.universeId ?? sandboxController?.universeId ?? sandboxReplayRunner?.universeId ?? "n/a";
  const targetLabel = sandboxUniverse
    ? `${sandboxUniverse.target.kind}:${sandboxUniverse.target.id}`
    : sandboxController
      ? `${sandboxController.target.kind}:${sandboxController.target.id}`
      : "n/a";
  const targetTeamId = sandboxUniverse?.target.teamId ?? sandboxController?.target.teamId ?? "n/a";
  const focusGapIds = sandboxUniverse?.target.focusGapIds ?? sandboxController?.target.focusGapIds ?? [];
  const stageCount = sandboxUniverse?.stages.length ?? sandboxController?.stages.length ?? 0;
  const persistedEvidenceCount =
    sandboxController?.evidence.filter((entry) => Boolean(entry.storagePath)).length ?? 0;
  const statePath = sandboxController?.statePath ?? sandboxReplayRunner?.statePath ?? null;
  const artifactDir = sandboxController?.artifactDir ?? sandboxReplayRunner?.artifactDir ?? null;

  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="card-title">Sandbox Universe</div>
      <div class="card-sub">Promotion-gated experiment envelope, replay pressure, and rollback readiness.</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Universe", universeId, true)}
        ${renderKv("Target", targetLabel)}
        ${renderKv("Target Team", targetTeamId, true)}
        ${renderKv("Stages", stageCount)}
        ${renderKv("Replay Status", sandboxReplayRunner ? formatSandboxReplayStatusLabel(sandboxReplayRunner.status) : "n/a")}
        ${renderKv("Active Stage", sandboxController?.activeStageId ?? "n/a")}
        ${renderKv("Persisted Evidence", sandboxController ? `${persistedEvidenceCount}/${sandboxController.evidence.length}` : "n/a")}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Target Focus Gaps</div>
        ${renderChipList(focusGapIds, "none")}
      </div>
      ${statePath || artifactDir
        ? html`
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("State Ledger", statePath ?? "n/a", true)}
              ${renderKv("Artifact Dir", artifactDir ?? "n/a", true)}
            </div>
          `
        : nothing}
      ${sandboxUniverse
        ? html`
            <div style="margin-top: 12px;">
              <div class="label">Promotion Gate Evidence</div>
              ${renderChipList(sandboxUniverse.promotionGate.requiredEvidence, "none")}
            </div>
            <div style="margin-top: 12px;">
              <div class="label">Promotion Gate Blockers</div>
              ${renderChipList(sandboxUniverse.promotionGate.blockers, "none")}
            </div>
            <div style="display: grid; gap: 10px; margin-top: 14px;">
              ${sandboxUniverse.stages.map(
                (stage) => html`
                  <div
                    style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                  >
                    <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                      <span class="chip">${stage.id}</span>
                      <span class="chip">${stage.status}</span>
                      <span>${stage.title}</span>
                    </div>
                    <div class="muted" style="margin-top: 6px;">
                      evidence=${stage.requiredEvidence.length} blockers=${stage.blockers.length}
                    </div>
                  </div>
                `,
              )}
            </div>
          `
        : nothing}
      ${sandboxController
        ? html`
            <section class="card" style="padding: 14px; margin-top: 14px;">
              <div class="card-title">Sandbox Controller</div>
              <div class="agents-overview-grid" style="margin-top: 12px;">
                ${renderKv("Collected Evidence", collectedEvidence)}
                ${renderKv("Failed Evidence", failedEvidence)}
                ${renderKv("Controller Blockers", sandboxController.blockers.length)}
                ${renderKv("Controller Stages", sandboxController.stages.length)}
              </div>
              ${sandboxController.statePath || sandboxController.artifactDir
                ? html`
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("State Ledger", sandboxController.statePath ?? "n/a", true)}
                      ${renderKv("Artifact Dir", sandboxController.artifactDir ?? "n/a", true)}
                    </div>
                  `
                : nothing}
              <div style="display: grid; gap: 10px; margin-top: 12px;">
                ${sandboxController.stages.map(
                  (stage) => html`
                    <div
                      style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                    >
                      <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                        <span class="chip">${stage.id}</span>
                        <span class="chip">${formatSandboxControllerStageStatusLabel(stage.status)}</span>
                        <span>${stage.title}</span>
                      </div>
                      <div class="muted" style="margin-top: 6px;">
                        evidence=${stage.requiredEvidence.length} blockers=${stage.blockers.length}
                      </div>
                    </div>
                  `,
                )}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Evidence Ledger</div>
                <div style="display: grid; gap: 10px; margin-top: 12px;">
                  ${sandboxController.evidence.map(
                    (entry) => html`
                      <div
                        style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                      >
                        <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                          <span class="chip">${entry.id}</span>
                          <span class="chip">${entry.status}</span>
                          ${entry.mediaType ? html`<span class="chip">${entry.mediaType}</span>` : nothing}
                        </div>
                        <div class="muted" style="margin-top: 6px;">
                          ${entry.note ?? "no artifact note"}
                        </div>
                        <div class="mono muted" style="margin-top: 6px; word-break: break-all;">
                          ${entry.storagePath ?? "not persisted"}${entry.storagePath || entry.sizeBytes || entry.sha256
                            ? ` · ${formatSandboxArtifactSize(entry.sizeBytes)} · sha=${formatSandboxArtifactHash(entry.sha256)}`
                            : ""}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              </div>
            </section>
          `
        : nothing}
      ${sandboxReplayRunner
        ? html`
            <section class="card" style="padding: 14px; margin-top: 14px;">
              <div class="card-title">Replay Runner</div>
              <div class="agents-overview-grid" style="margin-top: 12px;">
                ${renderKv("Status", formatSandboxReplayStatusLabel(sandboxReplayRunner.status))}
                ${renderKv("Scenarios", sandboxReplayRunner.scenarios.length)}
                ${renderKv("Required Outputs", sandboxReplayRunner.requiredOutputs.length)}
                ${renderKv("Replay Blockers", sandboxReplayRunner.blockers.length)}
              </div>
              ${sandboxReplayRunner.statePath || sandboxReplayRunner.artifactDir
                ? html`
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("State Ledger", sandboxReplayRunner.statePath ?? "n/a", true)}
                      ${renderKv("Artifact Dir", sandboxReplayRunner.artifactDir ?? "n/a", true)}
                    </div>
                  `
                : nothing}
              <div style="margin-top: 12px;">
                <div class="label">Scenarios</div>
                ${renderChipList(sandboxReplayRunner.scenarios, "none")}
              </div>
              <div style="margin-top: 12px;">
                <div class="label">Required Outputs</div>
                ${renderChipList(sandboxReplayRunner.requiredOutputs, "none")}
              </div>
              ${sandboxReplayRunner.lastRun
                ? html`
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("Replay", sandboxReplayRunner.lastRun.replayPassed ? "pass" : "fail")}
                      ${renderKv("QA", sandboxReplayRunner.lastRun.qaPassed ? "pass" : "fail")}
                      ${renderKv("Audit", sandboxReplayRunner.lastRun.auditPassed ? "pass" : "fail")}
                      ${renderKv("Promote", sandboxReplayRunner.lastRun.canPromote ? "yes" : "no")}
                    </div>
                  `
                : nothing}
            </section>
          `
        : nothing}
    </section>
  `;
}

function renderSandboxReplayGate(params: {
  latestFlow: AutonomyShowResult["latestFlow"] | null;
  replayBusy: boolean;
  replayError: string | null;
  replayResult: AutonomyReplaySubmitResult | null;
  replayVerdict: AutonomyReplayVerdictDraft;
  replayQaVerdict: AutonomyReplayVerdictDraft;
  replayAuditVerdict: AutonomyReplayVerdictDraft;
  onReplaySubmit: () => void;
  onReplayVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
  onReplayQaVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
  onReplayAuditVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
}) {
  const replayRunner = resolveFlowSandboxReplayRunner(params.latestFlow);
  const currentFlowId = params.latestFlow?.id ?? null;
  const submitted = params.replayResult?.submitted ?? null;
  const submittedFlowId = submitted?.targetFlowId ?? submitted?.requestedFlowId ?? null;
  const submissionMatchesCurrentFlow = Boolean(currentFlowId && submittedFlowId === currentFlowId);
  const decision = submissionMatchesCurrentFlow ? submitted?.outcome.decision ?? null : null;
  const effectiveRunner =
    (submissionMatchesCurrentFlow ? submitted?.outcome.sandboxReplayRunner : null) ?? replayRunner;
  const lastRun = effectiveRunner?.lastRun ?? null;
  const blockers = decision?.blockers ?? effectiveRunner?.blockers ?? [];
  const requiredEvidence = decision?.requiredEvidence ?? [];
  const canPromote = decision?.canPromote ?? lastRun?.canPromote ?? false;
  const reason = submissionMatchesCurrentFlow ? submitted?.outcome.reason ?? null : null;
  const calloutTone = canPromote ? "info" : blockers.length > 0 ? "warn" : "info";

  return html`
    <section class="card" style="padding: 14px; margin-top: 16px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Sandbox Replay Gate</div>
          <div class="card-sub">Manual verdict channel for replay, QA, and audit promotion pressure on the latest governed flow.</div>
        </div>
        <button
          class="btn btn--sm primary"
          type="button"
          ?disabled=${params.replayBusy || !params.latestFlow || !effectiveRunner}
          @click=${params.onReplaySubmit}
        >
          ${params.replayBusy ? "Submitting..." : "Submit Replay Verdict"}
        </button>
      </div>
      ${params.replayError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.replayError}</div>`
        : nothing}
      ${params.latestFlow
        ? html`
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("Flow ID", params.latestFlow.id, true)}
              ${renderKv("Runner", effectiveRunner ? formatSandboxReplayStatusLabel(effectiveRunner.status) : "missing")}
              ${renderKv("Replay", lastRun ? (lastRun.replayPassed ? "pass" : "fail") : "n/a")}
              ${renderKv("QA", lastRun ? (lastRun.qaPassed ? "pass" : "fail") : "n/a")}
              ${renderKv("Audit", lastRun ? (lastRun.auditPassed ? "pass" : "fail") : "n/a")}
              ${renderKv("Promote", lastRun ? (lastRun.canPromote ? "ready" : "blocked") : "n/a")}
            </div>
          `
        : html`<div class="callout info" style="margin-top: 12px;">Start a managed flow before submitting replay verdicts.</div>`}
      ${effectiveRunner
        ? html`
            <div class="grid grid-cols-3" style="gap: 12px; margin-top: 14px;">
              <label class="field">
                <span>Replay Verdict</span>
                <select
                  .value=${params.replayVerdict}
                  @change=${(e: Event) =>
                    params.onReplayVerdictChange(
                      (e.target as HTMLSelectElement).value as AutonomyReplayVerdictDraft,
                    )}
                >
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                </select>
              </label>
              <label class="field">
                <span>QA Verdict</span>
                <select
                  .value=${params.replayQaVerdict}
                  @change=${(e: Event) =>
                    params.onReplayQaVerdictChange(
                      (e.target as HTMLSelectElement).value as AutonomyReplayVerdictDraft,
                    )}
                >
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                </select>
              </label>
              <label class="field">
                <span>Audit Verdict</span>
                <select
                  .value=${params.replayAuditVerdict}
                  @change=${(e: Event) =>
                    params.onReplayAuditVerdictChange(
                      (e.target as HTMLSelectElement).value as AutonomyReplayVerdictDraft,
                    )}
                >
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                </select>
              </label>
            </div>
          `
        : html`
            <div class="callout info" style="margin-top: 14px;">
              Latest flow does not expose a sandbox replay runner yet.
            </div>
          `}
      ${submissionMatchesCurrentFlow && decision
        ? html`
            <div class="callout ${calloutTone}" style="margin-top: 14px;">
              ${canPromote
                ? "Promotion gate satisfied for the current sandbox candidate."
                : decision.freezeActive
                  ? "Promotion is currently frozen by governance enforcement."
                  : "Promotion remains blocked for the current sandbox candidate."}
            </div>
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("Gate Observed", formatRelativeTimestamp(decision.observedAt))}
              ${renderKv("Gate Charter", decision.charterDir, true)}
              ${renderKv("Universe", decision.universeId, true)}
              ${renderKv("Requested Flow", submittedFlowId ?? "n/a", true)}
            </div>
          `
        : nothing}
      ${reason
        ? html`<div class="callout warn" style="margin-top: 12px;">${reason}</div>`
        : nothing}
      ${decision
        ? html`
            <div style="margin-top: 12px;">
              <div class="label">Required Evidence</div>
              ${renderChipList(requiredEvidence, "none")}
            </div>
          `
        : nothing}
      <div style="margin-top: 12px;">
        <div class="label">Promotion Blockers</div>
        ${renderChipList(blockers, "none")}
      </div>
    </section>
  `;
}

export function renderAgentAutonomy(params: {
  agentId: string;
  loading: boolean;
  error: string | null;
  result: AutonomyShowResult | null;
  overviewLoading: boolean;
  overviewError: string | null;
  overviewResult: AutonomyOverviewResult | null;
  capabilitiesLoading: boolean;
  capabilitiesError: string | null;
  capabilitiesResult: AutonomyCapabilityInventoryResult | null;
  genesisLoading: boolean;
  genesisError: string | null;
  genesisResult: AutonomyGenesisPlanResult | null;
  historyLoading: boolean;
  historyError: string | null;
  historyResult: AutonomyHistoryResult | null;
  startBusy: boolean;
  startError: string | null;
  replayBusy: boolean;
  replayError: string | null;
  replayResult: AutonomyReplaySubmitResult | null;
  cancelBusy: boolean;
  cancelError: string | null;
  loopBusy: boolean;
  loopError: string | null;
  healBusy: boolean;
  healError: string | null;
  superviseBusy: boolean;
  superviseError: string | null;
  superviseResult: AutonomySuperviseResult | null;
  governanceBusy: boolean;
  governanceError: string | null;
  governanceResult: AutonomyGovernanceProposalsResult | null;
  governanceReconcileBusy: boolean;
  governanceReconcileError: string | null;
  governanceReconcileResult: AutonomyGovernanceReconcileResult | null;
  reconcileBusy: boolean;
  reconcileError: string | null;
  historyMode: AutonomyHistoryModeFilter;
  historySource: AutonomyHistorySourceFilter;
  historyLimit: string;
  goal: string;
  controllerId: string;
  currentStep: string;
  notifyPolicy: AutonomyNotifyPolicy;
  flowStatus: AutonomyFlowStatus;
  seedTaskEnabled: boolean;
  seedTaskRuntime: AutonomySeedTaskRuntime;
  seedTaskStatus: AutonomySeedTaskStatus;
  seedTaskLabel: string;
  seedTaskTask: string;
  replayVerdict: AutonomyReplayVerdictDraft;
  replayQaVerdict: AutonomyReplayVerdictDraft;
  replayAuditVerdict: AutonomyReplayVerdictDraft;
  loopEveryMinutes: string;
  workspaceScope: string;
  governanceReconcileMode: import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode;
  governanceReconcileNote: string;
  onRefresh: () => void;
  onOverviewRefresh: () => void;
  onCapabilitiesRefresh: () => void;
  onGenesisRefresh: () => void;
  onHistoryRefresh: () => void;
  onStart: () => void;
  onReplaySubmit: () => void;
  onCancel: () => void;
  onLoopUpsert: () => void;
  onLoopRemove: () => void;
  onHeal: () => void;
  onSupervise: () => void;
  onGovernanceProposals: () => void;
  onGovernanceReconcile: () => void;
  onReconcile: () => void;
  onRunSuggestedAction: (
    entry: AutonomyOverviewResult["overview"]["entries"][number],
  ) => void;
  onRunSuggestedActionBatch: (
    action: AutonomyOverviewResult["overview"]["entries"][number]["suggestedAction"],
  ) => void;
  onInspectOverviewAgent: (agentId: string) => void;
  onResetDraft: () => void;
  onGoalChange: (value: string) => void;
  onControllerIdChange: (value: string) => void;
  onCurrentStepChange: (value: string) => void;
  onNotifyPolicyChange: (value: AutonomyNotifyPolicy) => void;
  onFlowStatusChange: (value: AutonomyFlowStatus) => void;
  onSeedTaskEnabledChange: (value: boolean) => void;
  onSeedTaskRuntimeChange: (value: AutonomySeedTaskRuntime) => void;
  onSeedTaskStatusChange: (value: AutonomySeedTaskStatus) => void;
  onSeedTaskLabelChange: (value: string) => void;
  onSeedTaskTaskChange: (value: string) => void;
  onReplayVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
  onReplayQaVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
  onReplayAuditVerdictChange: (value: AutonomyReplayVerdictDraft) => void;
  onLoopEveryMinutesChange: (value: string) => void;
  onWorkspaceScopeChange: (value: string) => void;
  onGovernanceReconcileModeChange: (
    value: import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode,
  ) => void;
  onGovernanceReconcileNoteChange: (value: string) => void;
  onHistoryModeChange: (value: AutonomyHistoryModeFilter) => void;
  onHistorySourceChange: (value: AutonomyHistorySourceFilter) => void;
  onHistoryLimitChange: (value: string) => void;
  onUseRecommendedGoal: (value: string) => void;
}) {
  const profile = params.result?.profile ?? null;
  const latestFlow = params.result?.latestFlow ?? null;
  const latestSeedTask = params.result?.latestSeedTask ?? null;
  const loopSnapshot = params.result?.loopJob ?? null;
  const loopJob = loopSnapshot?.job ?? null;
  const latestControllerId = resolveFlowControllerId(params.result);
  const loopEveryMs = resolveLoopEveryMs(params.result);
  const defaultLoopEveryMs = profile?.bootstrap.loop.schedule.everyMs ?? null;
  const effectiveLoopEveryMs = loopEveryMs ?? defaultLoopEveryMs;
  const loopDirective =
    loopJob?.payload.kind === "agentTurn" && typeof loopJob.payload.message === "string"
      ? stripAutonomyLoopMarker(loopJob.payload.message)
      : profile?.bootstrap.loop.message ?? "";
  const latestFlowWorkspaceDirs = resolveFlowWorkspaceDirs(latestFlow);
  const latestFlowPrimaryWorkspaceDir = resolveFlowPrimaryWorkspaceDir(latestFlow);
  const latestManagedAutonomy = resolveManagedAutonomyProjection(latestFlow);
  const latestManagedExecution = resolveManagedExecutionProjection(latestFlow);
  const latestManagedProject = resolveManagedProjectProjection(latestFlow);
  const canCancelLatestFlow = canCancelFlowStatus(latestFlow?.status);
  const unsupportedProfile =
    !profile && params.error?.includes(`Unknown autonomy profile "${params.agentId}"`);
  const fleetEntries = params.overviewResult?.overview.entries ?? [];
  const fleetTotals = params.overviewResult?.overview.totals;
  const historyEvents = params.historyResult?.history.events ?? [];
  const historyMeta = params.historyResult?.history;
  const capabilities = params.capabilitiesResult?.capabilities;
  const capabilityEntries = capabilities?.entries ?? [];
  const capabilityGaps = capabilities?.gaps ?? [];
  const capabilitySummary = capabilities?.summary;
  const capabilityAttentionEntries = capabilityEntries.filter((entry) => entry.status !== "ready");
  const genesisPlan = params.genesisResult?.genesisPlan;
  const governanceResult = params.governanceResult;
  const governanceEntries = governanceResult?.results ?? [];
  const governanceReconcileResult = params.governanceReconcileResult;
  const governanceReconcileEntries = governanceReconcileResult?.entries ?? [];
  const superviseResult = params.superviseResult?.supervised ?? null;
  const superviseSummary = superviseResult?.summary ?? null;
  const superviseHealedTotals = superviseResult?.healed.totals ?? null;
  const superviseCapabilityGaps = superviseResult?.capabilityInventory?.gaps ?? [];
  const superviseGenesisPlan = superviseResult?.genesisPlan ?? null;
  const superviseBlockedStages = superviseGenesisPlan?.stages.filter(
    (stage) => stage.status === "blocked",
  ) ?? [];
  const workspaceScopeDraft = parseAutonomyWorkspaceDirsDraft(params.workspaceScope);
  const historyFiltersActive =
    params.historyMode !== "" || params.historySource !== "" || params.historyLimit.trim() !== "";
  const workspaceScopePlaceholder = resolveAutonomyWorkspaceScopePlaceholder({
    agentId: params.agentId,
    result: params.result,
    overviewResult: params.overviewResult,
    capabilitiesResult: params.capabilitiesResult,
    genesisResult: params.genesisResult,
    historyResult: params.historyResult,
  });
  const reconcileLoopEntries = fleetEntries.filter(
    (entry) => entry.suggestedAction === "reconcile_loop",
  );
  const startFlowEntries = fleetEntries.filter((entry) => entry.suggestedAction === "start_flow");
  const fleetControlBusy =
    params.superviseBusy ||
    params.healBusy ||
    params.reconcileBusy ||
    params.governanceBusy ||
    params.governanceReconcileBusy ||
    params.loopBusy;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Autonomy Fleet</div>
          <div class="card-sub">Global loop convergence and managed flow posture across core autonomous agents.</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${params.overviewLoading} @click=${params.onOverviewRefresh}>
            ${params.overviewLoading ? "Refreshing..." : "Refresh Fleet"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${fleetControlBusy}
            @click=${params.onHeal}
          >
            ${params.healBusy ? "Healing..." : "Heal Fleet"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${fleetControlBusy}
            @click=${params.onReconcile}
          >
            ${params.reconcileBusy ? "Reconciling..." : "Reconcile Core Loops"}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${fleetControlBusy}
            @click=${params.onSupervise}
          >
            ${params.superviseBusy ? "Supervising..." : "Supervise Fleet"}
          </button>
        </div>
      </div>
      ${params.overviewError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.overviewError}</div>`
        : nothing}
      ${params.healError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.healError}</div>`
        : nothing}
      ${params.superviseError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.superviseError}</div>`
        : nothing}
      ${params.reconcileError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.reconcileError}</div>`
        : nothing}
      ${fleetTotals
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Profiles", fleetTotals.totalProfiles)}
              ${renderKv("Healthy", fleetTotals.healthy)}
              ${renderKv("Idle", fleetTotals.idle)}
              ${renderKv("Drift", fleetTotals.drift)}
              ${renderKv("Missing Loop", fleetTotals.missingLoop)}
              ${renderKv("Active Flows", fleetTotals.activeFlows)}
            </div>
            <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 14px;">
              <button
                class="btn btn--sm"
                type="button"
                ?disabled=${params.reconcileBusy || params.superviseBusy || reconcileLoopEntries.length === 0}
                @click=${() => params.onRunSuggestedActionBatch("reconcile_loop")}
              >
                ${params.reconcileBusy
                  ? "Fixing..."
                  : `Fix ${reconcileLoopEntries.length} Drifted Loop${reconcileLoopEntries.length === 1 ? "" : "s"}`}
              </button>
              <button
                class="btn btn--sm primary"
                type="button"
                ?disabled=${params.startBusy || params.superviseBusy || startFlowEntries.length === 0}
                @click=${() => params.onRunSuggestedActionBatch("start_flow")}
              >
                ${params.startBusy
                  ? "Starting..."
                  : `Start ${startFlowEntries.length} Missing Flow${startFlowEntries.length === 1 ? "" : "s"}`}
              </button>
            </div>
          `
        : nothing}
      <div class="grid grid-cols-2" style="gap: 12px; margin-top: 16px;">
        <label class="field">
          <span>Workspace Scope</span>
          <textarea
            .value=${params.workspaceScope}
            placeholder=${workspaceScopePlaceholder}
            @input=${(e: Event) =>
              params.onWorkspaceScopeChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <div style="margin-top: 4px;">
          <div class="label">Resolved Scope</div>
          ${renderChipList(
            workspaceScopeDraft,
            workspaceScopePlaceholder === "One path per line or comma-separated"
              ? "panel default"
              : "visible scope",
          )}
        </div>
      </div>
      ${fleetEntries.length > 0
        ? html`
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              ${fleetEntries.map((entry) => {
                const suggestedActionLabel = formatSuggestedActionButtonLabel(entry.suggestedAction);
                const suggestedActionBusy =
                  (entry.suggestedAction === "reconcile_loop" && params.reconcileBusy) ||
                  (entry.suggestedAction === "start_flow" && params.startBusy) ||
                  (entry.suggestedAction === "inspect_flow" && params.loading);
                const entryReplayRunner = resolveFlowSandboxReplayRunner(entry.latestFlow);
                return html`
                  <section
                    class="card"
                    style=${entry.agentId === params.agentId
                      ? "padding: 14px; border-color: var(--border-accent, currentColor);"
                      : "padding: 14px;"}
                  >
                    <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                      <div>
                        <div class="row" style="gap: 8px; align-items: center;">
                          <div class="card-title">${entry.profile.name ?? entry.agentId}</div>
                          <span class="chip">${formatFleetHealthLabel(entry.health)}</span>
                          <span class="chip">${formatSuggestedActionLabel(entry.suggestedAction)}</span>
                        </div>
                        <div class="card-sub">
                          flow ${entry.latestFlow?.status ?? "none"} • loop ${resolveFleetLoopSummary(entry)}
                        </div>
                      </div>
                      <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                        ${suggestedActionLabel
                          ? html`
                              <button
                                class="btn btn--sm primary"
                                type="button"
                                ?disabled=${suggestedActionBusy}
                                @click=${() => params.onRunSuggestedAction(entry)}
                              >
                                ${suggestedActionBusy
                                  ? entry.suggestedAction === "reconcile_loop"
                                    ? "Fixing..."
                                    : entry.suggestedAction === "start_flow"
                                      ? "Starting..."
                                      : "Inspecting..."
                                  : suggestedActionLabel}
                              </button>
                            `
                          : nothing}
                        <button
                          class="btn btn--sm"
                          type="button"
                          @click=${() => params.onInspectOverviewAgent(entry.agentId)}
                        >
                          ${entry.agentId === params.agentId ? "Selected" : "Inspect"}
                        </button>
                      </div>
                    </div>
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("Agent", entry.agentId, true)}
                      ${renderKv("Layer", entry.profile.layer ?? "n/a")}
                      ${renderKv("Flow Updated", entry.latestFlow ? formatRelativeTimestamp(entry.latestFlow.updatedAt) : "n/a")}
                      ${renderKv("Loop Drift", entry.loopCadenceAligned ? "aligned" : "drift")}
                      ${renderKv("Replay", entryReplayRunner ? formatSandboxReplayStatusLabel(entryReplayRunner.status) : "n/a")}
                      ${renderKv("Promote", entryReplayRunner?.lastRun ? (entryReplayRunner.lastRun.canPromote ? "ready" : "blocked") : "n/a")}
                      ${renderKv("Primary Workspace", entry.primaryWorkspaceDir ?? "n/a", true)}
                    </div>
                    ${renderWorkspaceScope(
                      "Workspace Scope",
                      entry.workspaceDirs,
                      entry.primaryWorkspaceDir,
                    )}
                    ${entry.driftReasons.length > 0
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="label">Signals</div>
                            ${renderChipList(entry.driftReasons)}
                          </div>
                        `
                      : nothing}
                  </section>
                `;
              })}
            </div>
          `
        : params.overviewLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading autonomy fleet posture...</div>`
          : html`<div class="callout info" style="margin-top: 12px;">No governed autonomy profiles are visible yet.</div>`}
    </section>

    ${superviseResult
      ? html`
          <section class="card">
            <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
              <div>
                <div class="card-title">Fleet Supervisor</div>
                <div class="card-sub">One-shot autonomy control pass across healing, governance, capability gap review, and genesis routing.</div>
              </div>
              <div class="muted">${formatRelativeTimestamp(superviseResult.observedAt)}</div>
            </div>
            ${superviseSummary
              ? html`
                  <div class="agents-overview-grid" style="margin-top: 16px;">
                    ${renderKv("Governance", formatSupervisorGovernanceModeLabel(superviseResult.governanceMode))}
                    ${renderKv("Profiles", superviseSummary.totalProfiles)}
                    ${renderKv("Changed", superviseSummary.changedProfiles)}
                    ${renderKv("Healthy", superviseSummary.healthyProfiles)}
                    ${renderKv("Drift", superviseSummary.driftProfiles)}
                    ${renderKv("Missing Loop", superviseSummary.missingLoopProfiles)}
                    ${renderKv("Active Flows", superviseSummary.activeFlows)}
                    ${renderKv("Capability Gaps", superviseSummary.capabilityGapCount)}
                    ${renderKv("Critical Gaps", superviseSummary.criticalCapabilityGapCount)}
                    ${renderKv("Governance Created", superviseSummary.governanceCreatedCount)}
                    ${renderKv("Governance Applied", superviseSummary.governanceAppliedCount)}
                    ${renderKv("Governance Pending", superviseSummary.governancePendingCount)}
                    ${renderKv("Genesis Stages", superviseSummary.genesisStageCount)}
                    ${renderKv("Genesis Blocked", superviseSummary.genesisBlockedStageCount)}
                  </div>
                `
              : nothing}
            ${superviseHealedTotals
              ? html`
                  <div class="agents-overview-grid" style="margin-top: 16px;">
                    ${renderKv("Loop Created", superviseHealedTotals.loopCreated)}
                    ${renderKv("Loop Updated", superviseHealedTotals.loopUpdated)}
                    ${renderKv("Flow Started", superviseHealedTotals.flowStarted)}
                    ${renderKv("Flow Restarted", superviseHealedTotals.flowRestarted)}
                  </div>
                `
              : nothing}
            <div style="margin-top: 14px;">
              <div class="label">Recommended Next Actions</div>
              ${renderChipList(superviseSummary?.recommendedNextActions ?? [], "none")}
            </div>
            ${superviseCapabilityGaps.length > 0
              ? html`
                  <div style="margin-top: 16px;">
                    <div class="label">Supervisor Gap Focus</div>
                    <div class="list" style="margin-top: 10px;">
                      ${superviseCapabilityGaps.slice(0, 5).map(
                        (gap) => html`
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">
                                ${formatCapabilityGapSeverityLabel(gap.severity)}: ${gap.title}
                              </div>
                              <div class="list-sub">${gap.detail}</div>
                            </div>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
              : nothing}
            ${superviseGenesisPlan
              ? html`
                  <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px; margin-top: 16px;">
                    <div>
                      <div class="label">Genesis Mode</div>
                      <div>${formatGenesisModeLabel(superviseGenesisPlan.mode)}</div>
                    </div>
                    <div>
                      <div class="label">Genesis Team</div>
                      <div class="mono">${superviseGenesisPlan.teamId}</div>
                    </div>
                  </div>
                  <div style="margin-top: 14px;">
                    <div class="label">Genesis Blockers</div>
                    ${renderChipList(superviseGenesisPlan.blockers, "none")}
                  </div>
                  ${superviseBlockedStages.length > 0
                    ? html`
                        <div style="margin-top: 14px;">
                          <div class="label">Blocked Stages</div>
                          <div class="list" style="margin-top: 10px;">
                            ${superviseBlockedStages.slice(0, 4).map(
                              (stage) => html`
                                <div class="list-item">
                                  <div class="list-main">
                                    <div class="list-title">
                                      ${stage.title} (${formatGenesisStageStatusLabel(stage.status)})
                                    </div>
                                    <div class="list-sub">${stage.goal}</div>
                                  </div>
                                </div>
                              `,
                            )}
                          </div>
                        </div>
                      `
                    : nothing}
                `
              : nothing}
          </section>
        `
      : params.superviseBusy
        ? html`
            <section class="card">
              <div class="card-title">Fleet Supervisor</div>
              <div class="callout info" style="margin-top: 12px;">
                Running an end-to-end autonomy supervision pass across the visible fleet.
              </div>
            </section>
          `
        : nothing}

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Capability Inventory</div>
          <div class="card-sub">Deterministic registry view across skills, plugins, blueprints, and capability gaps.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.capabilitiesLoading} @click=${params.onCapabilitiesRefresh}>
          ${params.capabilitiesLoading ? "Refreshing..." : "Refresh Inventory"}
        </button>
      </div>
      ${params.capabilitiesError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.capabilitiesError}</div>`
        : nothing}
      ${capabilitySummary
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Entries", capabilitySummary.totalEntries)}
              ${renderKv("Skills", capabilitySummary.skillCount)}
              ${renderKv("Plugins", capabilitySummary.pluginCount)}
              ${renderKv("Memory", capabilitySummary.memoryCount ?? 0)}
              ${renderKv("Strategy", capabilitySummary.strategyCount ?? 0)}
              ${renderKv("Algorithm", capabilitySummary.algorithmCount ?? 0)}
              ${renderKv("Blueprints", capabilitySummary.agentBlueprintCount + capabilitySummary.teamBlueprintCount)}
              ${renderKv("Autonomy Core", capabilitySummary.autonomyProfileCount)}
              ${renderKv("Genesis Team", capabilitySummary.genesisMemberCount)}
              ${renderKv("Gaps", capabilitySummary.gapCount)}
            </div>
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("Memory Ready", capabilitySummary.memoryReady ?? 0)}
              ${renderKv("Memory Attention", capabilitySummary.memoryAttention ?? 0)}
              ${renderKv("Strategy Ready", capabilitySummary.strategyReady ?? 0)}
              ${renderKv("Strategy Attention", capabilitySummary.strategyAttention ?? 0)}
              ${renderKv("Algorithm Ready", capabilitySummary.algorithmReady ?? 0)}
              ${renderKv("Algorithm Attention", capabilitySummary.algorithmAttention ?? 0)}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Workspaces</div>
              ${renderChipList(capabilities?.workspaceDirs ?? [], "none")}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Requested Agents</div>
              ${renderChipList(capabilities?.requestedAgentIds ?? [], "fleet default")}
            </div>
            ${capabilityGaps.length > 0
              ? html`
                  <div style="display: grid; gap: 12px; margin-top: 16px;">
                    ${capabilityGaps.slice(0, 4).map(
                      (gap) => html`
                        <section class="card" style="padding: 14px;">
                          <div class="row" style="gap: 8px; align-items: center;">
                            <div class="card-title">${gap.title}</div>
                            <span class="chip">${formatCapabilityGapSeverityLabel(gap.severity)}</span>
                          </div>
                          <div class="card-sub">${gap.detail}</div>
                          ${gap.ownerAgentId
                            ? html`<div class="mono muted" style="margin-top: 8px;">owner ${gap.ownerAgentId}</div>`
                            : nothing}
                          <div style="margin-top: 12px;">
                            <div class="label">Suggested Actions</div>
                            ${renderChipList(gap.suggestedActions, "none")}
                          </div>
                          <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                            <button
                              class="btn btn--sm"
                              type="button"
                              ?disabled=${params.genesisLoading}
                              @click=${params.onGenesisRefresh}
                            >
                              ${params.genesisLoading ? "Refreshing..." : "Refresh Genesis"}
                            </button>
                            <button
                              class="btn btn--sm"
                              type="button"
                              ?disabled=${params.governanceBusy || params.governanceReconcileBusy}
                              @click=${params.onGovernanceProposals}
                            >
                              ${params.governanceBusy ? "Synthesizing..." : "Queue Proposal"}
                            </button>
                            <button
                              class="btn btn--sm primary"
                              type="button"
                              ?disabled=${params.governanceBusy || params.governanceReconcileBusy}
                              @click=${params.onGovernanceReconcile}
                            >
                              ${params.governanceReconcileBusy ? "Reconciling..." : "Apply Governance"}
                            </button>
                          </div>
                        </section>
                      `,
                    )}
                  </div>
                `
              : html`
                  <div class="callout info" style="margin-top: 16px;">
                    No governed capability gaps are currently flagged by the registry.
                  </div>
                `}
            ${capabilityAttentionEntries.length > 0
              ? html`
                  <div style="margin-top: 16px;">
                    <div class="label">Attention Entries</div>
                    <div style="display: grid; gap: 8px; margin-top: 8px;">
                      ${capabilityAttentionEntries.slice(0, 5).map(
                        (entry) => html`
                          <div
                            style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                          >
                            <div class="row" style="gap: 8px; align-items: center;">
                              <span class="chip">${entry.kind}</span>
                              <span class="chip">${formatCapabilityEntryStatusLabel(entry.status)}</span>
                              <span class="mono">${entry.title}</span>
                            </div>
                            ${entry.issues.length > 0
                              ? html`<div class="muted" style="margin-top: 8px;">${entry.issues.join(" • ")}</div>`
                              : nothing}
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
              : nothing}
          `
        : params.capabilitiesLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading capability registry...</div>`
          : html`<div class="callout info" style="margin-top: 12px;">Capability registry has not been loaded yet.</div>`}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Genesis Plan</div>
          <div class="card-sub">Deterministic handoff plan for the governed capability factory.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.genesisLoading} @click=${params.onGenesisRefresh}>
          ${params.genesisLoading ? "Refreshing..." : "Refresh Plan"}
        </button>
      </div>
      ${params.genesisError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.genesisError}</div>`
        : nothing}
      ${genesisPlan
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Mode", formatGenesisModeLabel(genesisPlan.mode))}
              ${renderKv("Team", genesisPlan.teamTitle ?? genesisPlan.teamId)}
              ${renderKv("Stages", genesisPlan.stages.length)}
              ${renderKv("Blockers", genesisPlan.blockers.length)}
              ${renderKv("Focus Gaps", genesisPlan.focusGapIds.length)}
              ${renderKv("Observed", formatRelativeTimestamp(genesisPlan.observedAt))}
            </div>
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("Primary Workspace", genesisPlan.primaryWorkspaceDir ?? "n/a", true)}
            </div>
            ${renderWorkspaceScope(
              "Workspace Scope",
              genesisPlan.workspaceDirs,
              genesisPlan.primaryWorkspaceDir ?? null,
            )}
            ${genesisPlan.blockers.length > 0
              ? html`
                  <div class="callout warn" style="margin-top: 14px;">
                    ${genesisPlan.blockers.join(" | ")}
                  </div>
                `
              : nothing}
            <div style="margin-top: 14px;">
              <div class="label">Focus Gap IDs</div>
              ${renderChipList(genesisPlan.focusGapIds, "none")}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              ${genesisPlan.stages.map(
                (stage) => html`
                  <section class="card" style="padding: 14px;">
                    <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                      <div>
                        <div class="row" style="gap: 8px; align-items: center;">
                          <div class="card-title">${stage.title}</div>
                          <span class="chip">${formatGenesisStageStatusLabel(stage.status)}</span>
                        </div>
                        <div class="card-sub">${stage.goal}</div>
                      </div>
                      <div class="mono muted">${stage.ownerAgentId}</div>
                    </div>
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("Depends On", stage.dependsOn.length ? stage.dependsOn.join(", ") : "none", true)}
                      ${renderKv("Inputs", stage.inputRefs.length ? stage.inputRefs.join(", ") : "none", true)}
                      ${renderKv("Outputs", stage.outputRefs.length ? stage.outputRefs.join(", ") : "none", true)}
                    </div>
                    ${stage.rationale
                      ? html`<div class="callout info" style="margin-top: 12px;">${stage.rationale}</div>`
                      : nothing}
                    <div style="margin-top: 12px;">
                      <div class="label">Actions</div>
                      ${renderChipList(stage.actions, "none")}
                    </div>
                  </section>
                `,
              )}
            </div>
          `
        : params.genesisLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Planning Genesis handoffs...</div>`
          : html`<div class="callout info" style="margin-top: 12px;">No Genesis handoff plan has been synthesized yet.</div>`}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Governance Proposals</div>
          <div class="card-sub">Autonomy-generated charter repair proposals synthesized for eligible governance agents.</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button
            class="btn btn--sm primary"
            ?disabled=${params.governanceReconcileBusy || params.governanceBusy || params.healBusy || params.reconcileBusy}
            @click=${params.onGovernanceReconcile}
          >
            ${params.governanceReconcileBusy ? "Reconciling..." : "Reconcile Proposals"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${params.governanceBusy || params.governanceReconcileBusy || params.healBusy || params.reconcileBusy}
            @click=${params.onGovernanceProposals}
          >
            ${params.governanceBusy ? "Synthesizing..." : "Synthesize Proposals"}
          </button>
        </div>
      </div>
      ${params.governanceError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.governanceError}</div>`
        : nothing}
      ${params.governanceReconcileError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.governanceReconcileError}</div>`
        : nothing}
      <div class="grid grid-cols-2" style="gap: 12px; margin-top: 16px;">
        <label class="field">
          <span>Reconcile Mode</span>
          <select
            .value=${params.governanceReconcileMode}
            @change=${(e: Event) =>
              params.onGovernanceReconcileModeChange(
                (e.target as HTMLSelectElement)
                  .value as import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode,
              )}
          >
            <option value="apply_safe">apply_safe</option>
            <option value="force_apply_all">force_apply_all</option>
          </select>
        </label>
        <label class="field">
          <span>Reconcile Note</span>
          <textarea
            .value=${params.governanceReconcileNote}
            placeholder="optional reconcile note"
            @input=${(e: Event) =>
              params.onGovernanceReconcileNoteChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
      </div>
      ${governanceResult
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Created", governanceResult.createdCount)}
              ${renderKv("Existing", governanceResult.existingCount)}
              ${renderKv("Skipped", governanceResult.skippedCount)}
              ${renderKv("Eligible Agents", governanceResult.eligibleAgentIds.length)}
              ${renderKv("Findings", governanceResult.findingIds.length)}
              ${renderKv("Observed", formatRelativeTimestamp(governanceResult.observedAt))}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Charter Directory</div>
              <div class="mono" style="margin-top: 6px;">${governanceResult.charterDir}</div>
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Requested Agents</div>
              ${renderChipList(governanceResult.requestedAgentIds, "fleet default")}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Eligible Agents</div>
              ${renderChipList(governanceResult.eligibleAgentIds, "none")}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Finding IDs</div>
              ${renderChipList(governanceResult.findingIds, "none")}
            </div>
            ${governanceEntries.length > 0
              ? html`
                  <div style="display: grid; gap: 12px; margin-top: 16px;">
                    ${governanceEntries.map(
                      (entry) => html`
                        <section class="card" style="padding: 14px;">
                          <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                            <div>
                              <div class="row" style="gap: 8px; align-items: center;">
                                <div class="card-title">${entry.title}</div>
                                <span class="chip">${formatGovernanceProposalStatusLabel(entry.status)}</span>
                                ${entry.proposalStatus
                                  ? html`<span class="chip">${formatGovernanceProposalLifecycleLabel(entry.proposalStatus)}</span>`
                                  : nothing}
                              </div>
                              <div class="card-sub">${entry.proposalId ?? "proposal not created yet"}</div>
                            </div>
                            <div class="mono muted">${entry.dedupeKey}</div>
                          </div>
                          <div class="agents-overview-grid" style="margin-top: 12px;">
                            ${renderKv("Rule", entry.ruleId, true)}
                            ${renderKv("Proposal", entry.proposalId ?? "n/a", true)}
                            ${renderKv("Finding Count", entry.findingIds.length)}
                            ${renderKv("Operations", entry.operations.length)}
                          </div>
                          ${entry.rationale
                            ? html`<div class="callout info" style="margin-top: 12px;">${entry.rationale}</div>`
                            : nothing}
                          ${entry.reason
                            ? html`<div class="callout warn" style="margin-top: 12px;">${entry.reason}</div>`
                            : nothing}
                          <div style="margin-top: 12px;">
                            <div class="label">Finding IDs</div>
                            ${renderChipList(entry.findingIds, "none")}
                          </div>
                          <div style="margin-top: 12px;">
                            <div class="label">Operations</div>
                            <div style="display: grid; gap: 8px; margin-top: 8px;">
                              ${entry.operations.map(
                                (operation) => html`
                                  <div
                                    style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                                  >
                                    <div class="row" style="gap: 8px; align-items: center;">
                                      <span class="chip">${operation.kind}</span>
                                      <span class="mono">${operation.path}</span>
                                    </div>
                                  </div>
                                `,
                              )}
                            </div>
                          </div>
                        </section>
                      `,
                    )}
                  </div>
                `
              : html`
                  <div class="callout info" style="margin-top: 16px;">
                    No governance proposals were synthesized for the current scope.
                  </div>
                `}
          `
        : params.governanceBusy
          ? html`<div class="callout info" style="margin-top: 12px;">Synthesizing charter repair proposals...</div>`
          : html`<div class="callout info" style="margin-top: 12px;">No synthesized governance proposals yet.</div>`}
      ${governanceReconcileResult
        ? html`
            <section class="card" style="padding: 14px; margin-top: 16px;">
              <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div>
                  <div class="card-title">Latest Governance Reconcile</div>
                  <div class="card-sub">Autonomy-triggered proposal execution against the governance ledger.</div>
                </div>
                <div class="muted">${formatRelativeTimestamp(governanceReconcileResult.observedAt)}</div>
              </div>
              <div class="agents-overview-grid" style="margin-top: 16px;">
                ${renderKv("Mode", formatGovernanceReconcileModeLabel(governanceReconcileResult.mode))}
                ${renderKv("Reviewed", governanceReconcileResult.reviewedCount)}
                ${renderKv("Applied", governanceReconcileResult.appliedCount)}
                ${renderKv("Skipped", governanceReconcileResult.skippedCount)}
                ${renderKv("Eligible Agents", governanceReconcileResult.eligibleAgentIds.length)}
                ${renderKv("Findings", governanceReconcileResult.findingIds.length)}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Requested Agents</div>
                ${renderChipList(governanceReconcileResult.requestedAgentIds, "fleet default")}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Eligible Agents</div>
                ${renderChipList(governanceReconcileResult.eligibleAgentIds, "none")}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Finding IDs</div>
                ${renderChipList(governanceReconcileResult.findingIds, "none")}
              </div>
              ${governanceReconcileEntries.length > 0
                ? html`
                    <div style="display: grid; gap: 12px; margin-top: 16px;">
                      ${governanceReconcileEntries.map(
                        (entry) => html`
                          <section class="card" style="padding: 14px;">
                            <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                              <div>
                                <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                                  <div class="card-title">${entry.title}</div>
                                  <span class="chip">${formatGovernanceProposalStatusLabel(entry.synthesisStatus)}</span>
                                  <span class="chip">${entry.safe ? "safe" : "unsafe"}</span>
                                  <span class="chip">${entry.autoApproved ? "auto-approved" : "manual-review"}</span>
                                  <span class="chip">${entry.autoApplied ? "auto-applied" : "not-applied"}</span>
                                </div>
                                <div class="card-sub">${entry.proposalId ?? "proposal not created yet"}</div>
                              </div>
                              <div class="mono muted">${entry.ruleId}</div>
                            </div>
                            <div class="agents-overview-grid" style="margin-top: 12px;">
                              ${renderKv("Before", formatGovernanceProposalLifecycleLabel(entry.proposalStatusBefore))}
                              ${renderKv("After", formatGovernanceProposalLifecycleLabel(entry.proposalStatusAfter))}
                              ${renderKv("Finding Count", entry.findingIds.length)}
                              ${renderKv("Operations", entry.operations.length)}
                            </div>
                            ${entry.reason
                              ? html`<div class="callout info" style="margin-top: 12px;">${entry.reason}</div>`
                              : nothing}
                            <div style="margin-top: 12px;">
                              <div class="label">Finding IDs</div>
                              ${renderChipList(entry.findingIds, "none")}
                            </div>
                            <div style="margin-top: 12px;">
                              <div class="label">Operations</div>
                              <div style="display: grid; gap: 8px; margin-top: 8px;">
                                ${entry.operations.map(
                                  (operation) => html`
                                    <div
                                      style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                                    >
                                      <div class="row" style="gap: 8px; align-items: center;">
                                        <span class="chip">${operation.kind}</span>
                                        <span class="mono">${operation.path}</span>
                                      </div>
                                    </div>
                                  `,
                                )}
                              </div>
                            </div>
                          </section>
                        `,
                      )}
                    </div>
                  `
                : html`
                    <div class="callout info" style="margin-top: 16px;">
                      No synthesized governance mutations were eligible for reconcile execution.
                    </div>
                  `}
            </section>
          `
        : params.governanceReconcileBusy
          ? html`<div class="callout info" style="margin-top: 12px;">Reconciling synthesized governance proposals...</div>`
          : nothing}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Autonomy History</div>
          <div class="card-sub">Persistent maintenance events recorded from manual heals, startup recovery, and the supervisor.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.historyLoading} @click=${params.onHistoryRefresh}>
          ${params.historyLoading ? "Refreshing..." : "Refresh History"}
        </button>
      </div>
      ${params.historyError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.historyError}</div>`
        : nothing}
      <div class="grid grid-cols-3" style="gap: 12px; margin-top: 16px;">
        <label class="field">
          <span>History Mode</span>
          <select
            .value=${params.historyMode}
            @change=${(e: Event) =>
              params.onHistoryModeChange(
                (e.target as HTMLSelectElement).value as AutonomyHistoryModeFilter,
              )}
          >
            <option value="">all</option>
            <option value="heal">heal</option>
            <option value="reconcile">reconcile</option>
          </select>
        </label>
        <label class="field">
          <span>History Source</span>
          <select
            .value=${params.historySource}
            @change=${(e: Event) =>
              params.onHistorySourceChange(
                (e.target as HTMLSelectElement).value as AutonomyHistorySourceFilter,
              )}
          >
            <option value="">all</option>
            <option value="manual">manual</option>
            <option value="startup">startup</option>
            <option value="supervisor">supervisor</option>
          </select>
        </label>
        <label class="field">
          <span>Result Limit</span>
          <input
            .value=${params.historyLimit}
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="Use default"
            @input=${(e: Event) =>
              params.onHistoryLimitChange((e.target as HTMLInputElement).value)}
          />
        </label>
      </div>
      ${historyMeta
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Events", historyMeta.total)}
              ${renderKv("Visible", historyEvents.length)}
              ${renderKv("Truncated", historyMeta.truncated ? "yes" : "no")}
              ${renderKv("Current Agent", params.agentId, true)}
              ${renderKv("Mode Filter", params.historyMode || "all")}
              ${renderKv("Source Filter", params.historySource || "all")}
              ${renderKv("Limit", params.historyLimit.trim() || "default")}
            </div>
          `
        : nothing}
      ${historyEvents.length > 0
        ? html`
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              ${historyEvents.map(
                (event) => html`
                  <section class="card" style="padding: 14px;">
                    <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                      <div>
                        <div class="row" style="gap: 8px; align-items: center;">
                          <div class="card-title">${formatHistoryModeLabel(event.mode)}</div>
                          <span class="chip">${formatHistorySourceLabel(event.source)}</span>
                          <span class="chip">${event.changed ? "Changed" : "No Change"}</span>
                        </div>
                        <div class="card-sub">${formatRelativeTimestamp(event.ts)} / ${event.sessionKey}</div>
                      </div>
                      <div class="mono muted">${event.eventId}</div>
                    </div>
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("Profiles", event.totals.totalProfiles)}
                      ${renderKv("Changed", event.totals.changed)}
                      ${renderKv("Loop Created", event.totals.loopCreated)}
                      ${renderKv("Loop Updated", event.totals.loopUpdated)}
                      ${renderKv("Flow Started", event.totals.flowStarted)}
                      ${renderKv("Flow Restarted", event.totals.flowRestarted)}
                      ${renderKv("Primary Workspace", event.primaryWorkspaceDir ?? "n/a", true)}
                    </div>
                    ${renderWorkspaceScope(
                      "Workspace Scope",
                      event.workspaceDirs,
                      event.primaryWorkspaceDir,
                    )}
                    <div style="display: grid; gap: 8px; margin-top: 14px;">
                      ${event.entries.map(
                        (entry) => html`
                          <div
                            style=${entry.agentId === params.agentId
                              ? "padding: 10px 12px; border: 1px solid var(--border-accent, currentColor); border-radius: 12px;"
                              : "padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"}
                          >
                            <div class="row" style="justify-content: space-between; gap: 12px;">
                              <div class="mono">${entry.agentId}</div>
                              <div class="muted">
                                health ${entry.healthBefore ?? "n/a"} -> ${entry.healthAfter ?? "n/a"}
                              </div>
                            </div>
                            <div class="row muted" style="gap: 12px; margin-top: 6px;">
                              <span>loop=${entry.loopAction ?? "n/a"}</span>
                              <span>flow=${entry.flowAction ?? "n/a"}</span>
                              <span>latest=${entry.latestFlowStatusAfter ?? entry.latestFlowStatusBefore ?? "n/a"}</span>
                            </div>
                            ${renderWorkspaceScope(
                              "Workspace Scope",
                              entry.workspaceDirs,
                              entry.primaryWorkspaceDir,
                            )}
                            ${entry.reasons.length > 0
                              ? html`
                                  <div style="margin-top: 10px;">
                                    ${renderChipList(entry.reasons)}
                                  </div>
                                `
                              : nothing}
                          </div>
                        `,
                      )}
                    </div>
                  </section>
                `,
              )}
            </div>
          `
        : params.historyLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading autonomy history...</div>`
          : html`
              <div class="callout info" style="margin-top: 12px;">
                ${historyFiltersActive
                  ? "No autonomy maintenance history matched the current filters."
                  : "No autonomy maintenance history recorded yet."}
              </div>
            `}
    </section>

    <section class="grid grid-cols-2">
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Autonomy Profile</div>
            <div class="card-sub">Governance contract, mission, and runtime lane.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        ${params.error
          ? html`
              <div class="callout ${unsupportedProfile ? "info" : "danger"}" style="margin-top: 12px;">
                ${unsupportedProfile
                  ? "This agent does not have a governed autonomy profile yet."
                  : params.error}
              </div>
            `
          : nothing}
        ${!profile && !params.loading && !params.error
          ? html`
              <div class="callout info" style="margin-top: 12px;">
                Load the profile to inspect its governed autonomy contract.
              </div>
            `
          : nothing}
        ${profile
          ? html`
              <div class="agents-overview-grid" style="margin-top: 16px;">
                ${renderKv("Session", params.result?.sessionKey ?? "n/a", true)}
                ${renderKv("Layer", profile.layer ?? "n/a")}
                ${renderKv("Authority", profile.authorityLevel ?? "n/a")}
                ${renderKv("Controller", latestControllerId ?? profile.bootstrap.controllerId, true)}
                ${renderKv("Mission", profile.missionPrimary ?? "n/a")}
                ${renderKv(
                  "Resource Budget",
                  profile.resourceBudget
                    ? [
                        profile.resourceBudget.tokens,
                        profile.resourceBudget.parallelism,
                        profile.resourceBudget.runtime,
                      ]
                        .filter(Boolean)
                        .join(" / ")
                    : "n/a",
                )}
              </div>
              <div style="margin-top: 18px;">
                <div class="label">Collaborators</div>
                ${renderChipList(profile.collaborators)}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Reports To</div>
                ${renderChipList(profile.reportsTo)}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Runtime Hooks</div>
                ${renderChipList(profile.runtimeHooks)}
              </div>
            `
          : nothing}
      </section>

      <section class="card">
        <div class="card-title">Start Managed Flow</div>
        <div class="card-sub">Launch a governed autonomy run for this agent.</div>
        ${params.startError
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.startError}</div>`
          : nothing}
        <div class="field" style="margin-top: 16px;">
          <span>Goal</span>
          <textarea
            .value=${params.goal}
            placeholder=${profile?.bootstrap.defaultGoal ?? "Use the profile default goal"}
            @input=${(e: Event) => params.onGoalChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
        <div class="grid grid-cols-2" style="gap: 12px; margin-top: 12px;">
          <label class="field">
            <span>Controller ID</span>
            <input
              .value=${params.controllerId}
              placeholder=${profile?.bootstrap.controllerId ?? "Use profile default"}
              @input=${(e: Event) =>
                params.onControllerIdChange((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Current Step</span>
            <input
              .value=${params.currentStep}
              placeholder=${profile?.bootstrap.defaultCurrentStep ?? "Use profile default"}
              @input=${(e: Event) =>
                params.onCurrentStepChange((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Notify Policy</span>
            <select
              .value=${params.notifyPolicy}
              @change=${(e: Event) =>
                params.onNotifyPolicyChange(
                  (e.target as HTMLSelectElement).value as AutonomyNotifyPolicy,
                )}
            >
              <option value="">Use default</option>
              <option value="done_only">done_only</option>
              <option value="state_changes">state_changes</option>
              <option value="silent">silent</option>
            </select>
          </label>
          <label class="field">
            <span>Flow Status</span>
            <select
              .value=${params.flowStatus}
              @change=${(e: Event) =>
                params.onFlowStatusChange(
                  (e.target as HTMLSelectElement).value as AutonomyFlowStatus,
                )}
            >
              <option value="">Use default</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top: 14px;">
          <span style="display: flex; gap: 8px; align-items: center;">
            <input
              type="checkbox"
              .checked=${params.seedTaskEnabled}
              @change=${(e: Event) =>
                params.onSeedTaskEnabledChange((e.target as HTMLInputElement).checked)}
            />
            Seed Task Enabled
          </span>
        </label>
        ${params.seedTaskEnabled
          ? html`
              <div class="grid grid-cols-2" style="gap: 12px; margin-top: 10px;">
                <label class="field">
                  <span>Seed Runtime</span>
                  <select
                    .value=${params.seedTaskRuntime}
                    @change=${(e: Event) =>
                      params.onSeedTaskRuntimeChange(
                        (e.target as HTMLSelectElement).value as AutonomySeedTaskRuntime,
                      )}
                  >
                    <option value="">Use default</option>
                    <option value="subagent">subagent</option>
                    <option value="acp">acp</option>
                    <option value="cli">cli</option>
                    <option value="cron">cron</option>
                  </select>
                </label>
                <label class="field">
                  <span>Seed Status</span>
                  <select
                    .value=${params.seedTaskStatus}
                    @change=${(e: Event) =>
                      params.onSeedTaskStatusChange(
                        (e.target as HTMLSelectElement).value as AutonomySeedTaskStatus,
                      )}
                  >
                    <option value="">Use default</option>
                    <option value="queued">queued</option>
                    <option value="running">running</option>
                  </select>
                </label>
              </div>
              <div class="grid grid-cols-2" style="gap: 12px; margin-top: 10px;">
                <label class="field">
                  <span>Seed Label</span>
                  <input
                    .value=${params.seedTaskLabel}
                    placeholder=${profile?.bootstrap.seedTask.label ?? "Use profile default"}
                    @input=${(e: Event) =>
                      params.onSeedTaskLabelChange((e.target as HTMLInputElement).value)}
                  />
                </label>
                <label class="field">
                  <span>Seed Summary</span>
                  <textarea
                    .value=${params.seedTaskTask}
                    placeholder=${profile?.bootstrap.seedTask.task ?? "Use profile default"}
                    @input=${(e: Event) =>
                      params.onSeedTaskTaskChange((e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </label>
              </div>
            `
          : nothing}
        <div class="row" style="justify-content: space-between; margin-top: 16px;">
          <button class="btn btn--sm" type="button" @click=${params.onResetDraft}>
            Reset Overrides
          </button>
          <button
            class="btn btn--sm primary"
            type="button"
            ?disabled=${params.startBusy || params.cancelBusy || !profile}
            @click=${params.onStart}
          >
            ${params.startBusy ? "Starting..." : "Start Managed Flow"}
          </button>
        </div>
      </section>
    </section>

    ${profile
      ? html`
          <section class="card">
            <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
              <div>
                <div class="card-title">Autonomy Loop</div>
                <div class="card-sub">Scheduled control loop that keeps this profile running without manual intervention.</div>
              </div>
              <div class="row" style="gap: 8px;">
                <button
                  class="btn btn--sm"
                  type="button"
                  ?disabled=${params.loopBusy || !loopJob}
                  @click=${params.onLoopRemove}
                >
                  ${params.loopBusy ? "Updating..." : "Disable Loop"}
                </button>
                <button
                  class="btn btn--sm primary"
                  type="button"
                  ?disabled=${params.loopBusy || params.startBusy || params.cancelBusy}
                  @click=${params.onLoopUpsert}
                >
                  ${params.loopBusy
                    ? "Updating..."
                    : loopJob
                      ? "Update Loop"
                      : "Enable Loop"}
                </button>
              </div>
            </div>
            ${params.loopError
              ? html`<div class="callout warn" style="margin-top: 12px;">${params.loopError}</div>`
              : nothing}
            <div class="stat-grid" style="margin-top: 16px;">
              <div class="stat">
                <div class="stat-label">Status</div>
                <div class="stat-value">${loopJob ? (loopJob.enabled ? "enabled" : "disabled") : "absent"}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Interval</div>
                <div class="stat-value">
                  ${effectiveLoopEveryMs ? formatDurationHuman(effectiveLoopEveryMs) : "n/a"}
                </div>
              </div>
              <div class="stat">
                <div class="stat-label">Next Run</div>
                <div class="stat-value">
                  ${loopJob?.state?.nextRunAtMs
                    ? formatRelativeTimestamp(loopJob.state.nextRunAtMs)
                    : "n/a"}
                </div>
              </div>
              <div class="stat">
                <div class="stat-label">Last Run</div>
                <div class="stat-value">
                  ${loopJob?.state?.lastRunAtMs
                    ? formatRelativeTimestamp(loopJob.state.lastRunAtMs)
                    : "n/a"}
                </div>
              </div>
            </div>
            <div class="agents-overview-grid" style="margin-top: 18px;">
              ${renderKv("Job ID", loopJob?.id ?? "not scheduled", true)}
              ${renderKv("Control Session", loopJob?.sessionKey ?? "agent main", true)}
              ${renderKv(
                "Schedule",
                loopJob
                  ? formatCronSchedule(loopJob as never)
                  : `Default ${formatDurationHuman(profile.bootstrap.loop.schedule.everyMs)}`,
              )}
              ${renderKv("State", loopJob ? formatCronState(loopJob as never) : "not scheduled")}
              ${renderKv("Primary Workspace", loopSnapshot?.primaryWorkspaceDir ?? "n/a", true)}
            </div>
            ${renderWorkspaceScope(
              "Workspace Scope",
              loopSnapshot?.workspaceDirs,
              loopSnapshot?.primaryWorkspaceDir,
            )}
            <div class="grid grid-cols-2" style="gap: 12px; margin-top: 14px;">
              <label class="field">
                <span>Loop Interval (minutes)</span>
                <input
                  .value=${params.loopEveryMinutes}
                  placeholder=${String(Math.max(1, Math.floor(profile.bootstrap.loop.schedule.everyMs / 60_000)))}
                  @input=${(e: Event) =>
                    params.onLoopEveryMinutesChange((e.target as HTMLInputElement).value)}
                />
              </label>
              <div class="field">
                <span>Governed Session Target</span>
                <input .value=${`${profile.bootstrap.loop.sessionTarget} / ${profile.bootstrap.loop.wakeMode}`} disabled />
              </div>
            </div>
            ${!loopJob
              ? html`
                  <div class="callout info" style="margin-top: 14px;">
                    No loop job is scheduled yet. Enabling it will install a governed recurring control cycle for this profile.
                  </div>
                `
              : nothing}
            <label class="field" style="margin-top: 14px;">
              <span>Loop Directive</span>
              <textarea .value=${loopDirective} disabled></textarea>
            </label>
          </section>
        `
      : nothing}

    ${profile
      ? html`
          <section class="card">
            <div class="card-title">Governance Envelope</div>
            <div class="card-sub">Mutation boundaries, network rules, and recommended goals.</div>
            <div class="grid grid-cols-2" style="gap: 20px; margin-top: 16px;">
              <div>
                <div class="label">Recommended Goals</div>
                <div class="list" style="margin-top: 10px;">
                  ${profile.bootstrap.recommendedGoals.map(
                    (goal) => html`
                      <div class="list-item">
                        <div class="list-main">
                          <div class="list-title">${goal}</div>
                        </div>
                        <div class="list-meta">
                          <button
                            class="btn btn--sm btn--ghost"
                            type="button"
                            @click=${() => params.onUseRecommendedGoal(goal)}
                          >
                            Use Goal
                          </button>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              </div>
              <div>
                <div class="label">Mutation Allow</div>
                ${renderChipList(profile.mutationAllow)}
                <div class="label" style="margin-top: 14px;">Mutation Deny</div>
                ${renderChipList(profile.mutationDeny)}
                <div class="label" style="margin-top: 14px;">Network Conditions</div>
                ${renderChipList(
                  [
                    ...(profile.networkDefault ? [`default:${profile.networkDefault}`] : []),
                    ...profile.networkConditions,
                  ],
                  "no explicit conditions",
                )}
              </div>
            </div>
          </section>
        `
      : nothing}

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Latest Managed Flow</div>
          <div class="card-sub">Most recent governed autonomy flow bound to this session lane.</div>
        </div>
        <button
          class="btn btn--sm danger"
          type="button"
          ?disabled=${params.cancelBusy || !canCancelLatestFlow}
          @click=${params.onCancel}
        >
          ${params.cancelBusy ? "Cancelling..." : "Cancel Latest Flow"}
        </button>
      </div>
      ${params.cancelError
        ? html`<div class="callout warn" style="margin-top: 12px;">${params.cancelError}</div>`
        : nothing}
      ${latestFlow
        ? html`
            <div class="stat-grid" style="margin-top: 16px;">
              <div class="stat">
                <div class="stat-label">Status</div>
                <div class="stat-value">${latestFlow.status}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Updated</div>
                <div class="stat-value">${formatRelativeTimestamp(latestFlow.updatedAt)}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Tasks</div>
                <div class="stat-value">${latestFlow.taskSummary.total}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Failures</div>
                <div class="stat-value">${latestFlow.taskSummary.failures}</div>
              </div>
            </div>
            <div class="agents-overview-grid" style="margin-top: 18px;">
              ${renderKv("Flow ID", latestFlow.id, true)}
              ${renderKv("Goal", latestFlow.goal)}
              ${renderKv("Current Step", latestFlow.currentStep ?? "n/a")}
              ${renderKv("Controller", latestControllerId ?? "n/a", true)}
              ${renderKv("Managed Agent", latestManagedAutonomy?.agentId ?? "n/a", true)}
              ${renderKv("Projection", latestManagedProject?.kind ?? "legacy")}
              ${renderKv("Owner Session", latestFlow.ownerKey, true)}
              ${renderKv("Notify Policy", latestFlow.notifyPolicy)}
              ${renderKv("Updated At", formatMs(latestFlow.updatedAt))}
              ${renderKv("Primary Workspace", latestFlowPrimaryWorkspaceDir ?? "n/a", true)}
            </div>
            ${renderWorkspaceScope(
              "Workspace Scope",
              latestFlowWorkspaceDirs,
              latestFlowPrimaryWorkspaceDir,
            )}
            ${latestFlow.blocked?.summary
              ? html`
                  <div class="callout warn" style="margin-top: 14px;">
                    Blocked: ${latestFlow.blocked.summary}
                  </div>
                `
              : nothing}
            ${renderSandboxReplayGate({
              latestFlow,
              replayBusy: params.replayBusy,
              replayError: params.replayError,
              replayResult: params.replayResult,
              replayVerdict: params.replayVerdict,
              replayQaVerdict: params.replayQaVerdict,
              replayAuditVerdict: params.replayAuditVerdict,
              onReplaySubmit: params.onReplaySubmit,
              onReplayVerdictChange: params.onReplayVerdictChange,
              onReplayQaVerdictChange: params.onReplayQaVerdictChange,
              onReplayAuditVerdictChange: params.onReplayAuditVerdictChange,
            })}
            ${renderManagedExecutionProjection(latestManagedExecution)}
            ${renderManagedAlgorithmProjection(latestManagedProject)}
            ${renderManagedGenesisProjection(latestManagedProject)}
            ${renderManagedSovereigntyProjection(latestManagedProject)}
            ${renderSandboxUniverseProjection(latestManagedProject)}
            ${latestSeedTask
              ? html`
                  <div class="list" style="margin-top: 18px;">
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${latestSeedTask.label ?? latestSeedTask.title}</div>
                        <div class="list-sub mono">${latestSeedTask.id}</div>
                      </div>
                      <div class="list-meta">
                        <div>${latestSeedTask.status}</div>
                        <div>${latestSeedTask.runtime}</div>
                        <div>
                          ${formatRelativeTimestamp(
                            latestSeedTask.lastEventAt ?? latestSeedTask.createdAt,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                `
              : nothing}
            ${latestFlow.tasks.length > 0
              ? html`
                  <div style="margin-top: 16px;">
                    <div class="label">Recent Tasks</div>
                    <div class="list" style="margin-top: 10px;">
                      ${latestFlow.tasks.slice(0, 5).map(
                        (task) => html`
                          <div class="list-item">
                            <div class="list-main">
                              <div class="list-title">${task.label ?? task.title}</div>
                              <div class="list-sub">${task.title}</div>
                            </div>
                            <div class="list-meta">
                              <div>${task.status}</div>
                              <div>${task.runtime}</div>
                              <div>${formatRelativeTimestamp(task.lastEventAt ?? task.createdAt)}</div>
                            </div>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
              : nothing}
          `
        : html`
            <div class="callout info" style="margin-top: 12px;">
              No managed autonomy flow has been recorded for this session lane yet.
            </div>
          `}
    </section>
  `;
}
