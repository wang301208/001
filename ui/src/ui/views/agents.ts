import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AutonomyCapabilityInventoryResult,
  AutonomyGovernanceReconcileResult,
  AutonomyGenesisPlanResult,
  GovernanceAgentResult,
  GovernanceCapabilityAssetRegistryResult,
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
  GovernanceOverviewResult,
  GovernanceProposalsCreateResult,
  GovernanceProposalsListResult,
  GovernanceProposalsReconcileResult,
  GovernanceProposalsSynthesizeResult,
  GovernanceTeamResult,
  AutonomyGovernanceProposalsResult,
  AutonomyHistoryResult,
  AutonomyOverviewResult,
  AutonomyReplaySubmitResult,
  AgentsListResult,
  AutonomyShowResult,
  AutonomySuperviseResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  ModelCatalogEntry,
  SkillStatusReport,
  ToolsCatalogResult,
  ToolsEffectiveResult,
} from "../types.ts";
import { renderAgentOverview } from "./agents-panels-overview.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
export type { AgentsPanel } from "./agents.types.ts";
import { renderAgentAutonomy } from "./agents-panels-autonomy.ts";
import { renderAgentGovernance } from "./agents-panels-governance.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import { agentBadgeText, buildAgentContext, normalizeAgentLabel } from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";

export type ConfigState = {
  form: Record<string, unknown> | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
};

export type ChannelsState = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
};

export type CronState = {
  status: CronStatus | null;
  jobs: CronJob[];
  loading: boolean;
  error: string | null;
};

export type AgentFilesState = {
  list: AgentsFilesListResult | null;
  loading: boolean;
  error: string | null;
  active: string | null;
  contents: Record<string, string>;
  drafts: Record<string, string>;
  saving: boolean;
};

export type AgentSkillsState = {
  report: SkillStatusReport | null;
  loading: boolean;
  error: string | null;
  agentId: string | null;
  filter: string;
};

export type ToolsCatalogState = {
  loading: boolean;
  error: string | null;
  result: ToolsCatalogResult | null;
};

export type ToolsEffectiveState = {
  loading: boolean;
  error: string | null;
  result: ToolsEffectiveResult | null;
};

export type AutonomyState = {
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
};

export type GovernanceState = {
  overviewLoading: boolean;
  overviewError: string | null;
  overviewResult: GovernanceOverviewResult | null;
  assetRegistryLoading: boolean;
  assetRegistryError: string | null;
  assetRegistryResult: GovernanceCapabilityAssetRegistryResult | null;
  capabilitiesLoading: boolean;
  capabilitiesError: string | null;
  capabilitiesResult: GovernanceCapabilityInventoryResult | null;
  genesisLoading: boolean;
  genesisError: string | null;
  genesisResult: GovernanceGenesisPlanResult | null;
  agentLoading: boolean;
  agentError: string | null;
  agentResult: GovernanceAgentResult | null;
  teamLoading: boolean;
  teamError: string | null;
  teamResult: GovernanceTeamResult | null;
  proposalsLoading: boolean;
  proposalsError: string | null;
  proposalsResult: GovernanceProposalsListResult | null;
  proposalSynthesizeBusy: boolean;
  proposalSynthesizeError: string | null;
  proposalSynthesizeResult: GovernanceProposalsSynthesizeResult | null;
  proposalReconcileBusy: boolean;
  proposalReconcileError: string | null;
  proposalReconcileResult: GovernanceProposalsReconcileResult | null;
  proposalCreateBusy: boolean;
  proposalCreateError: string | null;
  proposalCreateResult: GovernanceProposalsCreateResult | null;
  proposalActionBusyId: string | null;
  proposalActionError: string | null;
};

export type AgentsProps = {
  basePath: string;
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  config: ConfigState;
  channels: ChannelsState;
  cron: CronState;
  agentFiles: AgentFilesState;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkills: AgentSkillsState;
  governance: GovernanceState;
  autonomy: AutonomyState;
  toolsCatalog: ToolsCatalogState;
  toolsEffective: ToolsEffectiveState;
  runtimeSessionKey: string;
  runtimeSessionMatchesSelectedAgent: boolean;
  modelCatalog: ModelCatalogEntry[];
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onCronRunNow: (jobId: string) => void;
  onGovernanceOverviewRefresh: () => void;
  onGovernanceAssetRegistryRefresh: () => void;
  onGovernanceCapabilitiesRefresh: () => void;
  onGovernanceScopeUseCapabilities: () => void;
  onGovernanceScopeUseGenesis: () => void;
  onGovernanceWorkbenchScopeReset: () => void;
  onGovernanceGenesisRefresh: () => void;
  onGovernanceAgentRefresh: () => void;
  onGovernanceTeamRefresh: () => void;
  onGovernanceProposalsRefresh: () => void;
  onGovernanceProposalSynthesize: () => void;
  onGovernanceProposalReconcile: () => void;
  onGovernanceProposalCreate: () => void;
  onGovernanceProposalCreateReset: () => void;
  onGovernanceProposalReview: (
    proposalId: string,
    decision: import("../controllers/governance.ts").GovernanceProposalDecision,
  ) => void;
  onGovernanceProposalApply: (proposalId: string) => void;
  onGovernanceProposalRevert: (proposalId: string) => void;
  onGovernanceProposalApproveVisible: () => void;
  onGovernanceProposalApplyVisible: () => void;
  onGovernanceProposalRevertVisible: () => void;
  onGovernanceProposalLoadSynthesisDraft: (
    entry: GovernanceProposalsSynthesizeResult["results"][number],
  ) => void;
  onGovernanceProposalLoadReconcileDraft: (
    entry: GovernanceProposalsReconcileResult["entries"][number],
  ) => void;
  onAutonomyRefresh: () => void;
  onAutonomyOverviewRefresh: () => void;
  onAutonomyCapabilitiesRefresh: () => void;
  onAutonomyGenesisRefresh: () => void;
  onAutonomyHistoryRefresh: () => void;
  onAutonomyStart: () => void;
  onAutonomyReplaySubmit: () => void;
  onAutonomyCancel: () => void;
  onAutonomyLoopUpsert: () => void;
  onAutonomyLoopRemove: () => void;
  onAutonomyHeal: () => void;
  onAutonomySupervise: () => void;
  onAutonomyGovernanceProposals: () => void;
  onAutonomyGovernanceReconcile: () => void;
  onAutonomyReconcile: () => void;
  onAutonomyRunSuggestedAction: (
    entry: AutonomyOverviewResult["overview"]["entries"][number],
  ) => void;
  onAutonomyRunSuggestedActionBatch: (
    action: AutonomyOverviewResult["overview"]["entries"][number]["suggestedAction"],
  ) => void;
  onAutonomyInspectOverviewAgent: (agentId: string) => void;
  onAutonomyResetDraft: () => void;
  autonomyDraft: {
    historyMode: import("../controllers/autonomy.ts").AutonomyHistoryModeFilter;
    historySource: import("../controllers/autonomy.ts").AutonomyHistorySourceFilter;
    historyLimit: string;
    goal: string;
    controllerId: string;
    currentStep: string;
    notifyPolicy: import("../controllers/autonomy.ts").AutonomyNotifyPolicy;
    flowStatus: import("../controllers/autonomy.ts").AutonomyFlowStatus;
    seedTaskEnabled: boolean;
    seedTaskRuntime: import("../controllers/autonomy.ts").AutonomySeedTaskRuntime;
    seedTaskStatus: import("../controllers/autonomy.ts").AutonomySeedTaskStatus;
    seedTaskLabel: string;
    seedTaskTask: string;
    replayVerdict: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft;
    replayQaVerdict: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft;
    replayAuditVerdict: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft;
    loopEveryMinutes: string;
    workspaceScope: string;
    governanceReconcileMode: import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode;
    governanceReconcileNote: string;
  };
  onAutonomyGoalChange: (value: string) => void;
  onAutonomyControllerIdChange: (value: string) => void;
  onAutonomyCurrentStepChange: (value: string) => void;
  onAutonomyNotifyPolicyChange: (
    value: import("../controllers/autonomy.ts").AutonomyNotifyPolicy,
  ) => void;
  onAutonomyFlowStatusChange: (
    value: import("../controllers/autonomy.ts").AutonomyFlowStatus,
  ) => void;
  onAutonomySeedTaskEnabledChange: (value: boolean) => void;
  onAutonomySeedTaskRuntimeChange: (
    value: import("../controllers/autonomy.ts").AutonomySeedTaskRuntime,
  ) => void;
  onAutonomySeedTaskStatusChange: (
    value: import("../controllers/autonomy.ts").AutonomySeedTaskStatus,
  ) => void;
  onAutonomySeedTaskLabelChange: (value: string) => void;
  onAutonomySeedTaskTaskChange: (value: string) => void;
  onAutonomyReplayVerdictChange: (
    value: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft,
  ) => void;
  onAutonomyReplayQaVerdictChange: (
    value: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft,
  ) => void;
  onAutonomyReplayAuditVerdictChange: (
    value: import("../controllers/autonomy.ts").AutonomyReplayVerdictDraft,
  ) => void;
  onAutonomyLoopEveryMinutesChange: (value: string) => void;
  onAutonomyWorkspaceScopeChange: (value: string) => void;
  onAutonomyGovernanceReconcileModeChange: (
    value: import("../controllers/autonomy.ts").AutonomyGovernanceReconcileMode,
  ) => void;
  onAutonomyGovernanceReconcileNoteChange: (value: string) => void;
  onAutonomyHistoryModeChange: (
    value: import("../controllers/autonomy.ts").AutonomyHistoryModeFilter,
  ) => void;
  onAutonomyHistorySourceChange: (
    value: import("../controllers/autonomy.ts").AutonomyHistorySourceFilter,
  ) => void;
  onAutonomyHistoryLimitChange: (value: string) => void;
  onAutonomyUseRecommendedGoal: (value: string) => void;
  governanceDraft: {
    scopeAgentIds: string;
    scopeWorkspaceDirs: string;
    scopeTeamId: string;
    proposalLimit: string;
    operator: string;
    decisionNote: string;
    statusFilter: import("../controllers/governance.ts").GovernanceProposalStatusFilter;
    reconcileMode: import("../controllers/governance.ts").GovernanceProposalReconcileMode;
    createTitle: string;
    createRationale: string;
    createAgentId: string;
    createSessionKey: string;
    createOperationsJson: string;
  };
  onGovernanceOperatorChange: (value: string) => void;
  onGovernanceDecisionNoteChange: (value: string) => void;
  onGovernanceStatusFilterChange: (
    value: import("../controllers/governance.ts").GovernanceProposalStatusFilter,
  ) => void;
  onGovernanceReconcileModeChange: (
    value: import("../controllers/governance.ts").GovernanceProposalReconcileMode,
  ) => void;
  onGovernanceCreateTitleChange: (value: string) => void;
  onGovernanceCreateRationaleChange: (value: string) => void;
  onGovernanceCreateAgentIdChange: (value: string) => void;
  onGovernanceCreateSessionKeyChange: (value: string) => void;
  onGovernanceCreateOperationsJsonChange: (value: string) => void;
  onGovernanceScopeAgentIdsChange: (value: string) => void;
  onGovernanceScopeWorkspaceDirsChange: (value: string) => void;
  onGovernanceScopeTeamIdChange: (value: string) => void;
  onGovernanceProposalLimitChange: (value: string) => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
  onSetDefault: (agentId: string) => void;
};

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const selectedSkillCount =
    selectedId && props.agentSkills.agentId === selectedId
      ? (props.agentSkills.report?.skills?.length ?? null)
      : null;

  const channelEntryCount = props.channels.snapshot
    ? Object.keys(props.channels.snapshot.channelAccounts ?? {}).length
    : null;
  const cronJobCount = selectedId
    ? props.cron.jobs.filter((j) => j.agentId === selectedId).length
    : null;
  const tabCounts: Record<string, number | null> = {
    files: props.agentFiles.list?.files?.length ?? null,
    skills: selectedSkillCount,
    channels: channelEntryCount,
    cron: cronJobCount || null,
    governance:
      props.governance.capabilitiesResult?.summary.criticalGapCount ??
      props.governance.proposalsResult?.summary.pending ??
      props.governance.overviewResult?.proposals?.pending ??
      props.governance.overviewResult?.findings.length ??
      null,
  };

  return html`
    <div class="agents-layout">
      <section class="agents-toolbar">
        <div class="agents-toolbar-row">
          <div class="agents-control-select">
            <select
              class="agents-select"
              .value=${selectedId ?? ""}
              ?disabled=${props.loading || agents.length === 0}
              @change=${(e: Event) => props.onSelectAgent((e.target as HTMLSelectElement).value)}
            >
              ${agents.length === 0
                ? html` <option value="">No agents</option> `
                : agents.map(
                    (agent) => html`
                      <option value=${agent.id} ?selected=${agent.id === selectedId}>
                        ${normalizeAgentLabel(agent)}${agentBadgeText(agent.id, defaultId)
                          ? ` (${agentBadgeText(agent.id, defaultId)})`
                          : ""}
                      </option>
                    `,
                  )}
            </select>
          </div>
          <div class="agents-toolbar-actions">
            ${selectedAgent
              ? html`
                  <button
                    type="button"
                    class="btn btn--sm btn--ghost"
                    @click=${() => void navigator.clipboard.writeText(selectedAgent.id)}
                    title="Copy agent ID to clipboard"
                  >
                    Copy ID
                  </button>
                  <button
                    type="button"
                    class="btn btn--sm btn--ghost"
                    ?disabled=${Boolean(defaultId && selectedAgent.id === defaultId)}
                    @click=${() => props.onSetDefault(selectedAgent.id)}
                    title=${defaultId && selectedAgent.id === defaultId
                      ? "Already the default agent"
                      : "Set as the default agent"}
                  >
                    ${defaultId && selectedAgent.id === defaultId ? "Default" : "Set Default"}
                  </button>
                `
              : nothing}
            <button
              class="btn btn--sm agents-refresh-btn"
              ?disabled=${props.loading}
              @click=${props.onRefresh}
            >
              ${props.loading ? t("common.loading") : t("common.refresh")}
            </button>
          </div>
        </div>
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 8px;">${props.error}</div>`
          : nothing}
      </section>
      <section class="agents-main">
        ${!selectedAgent
          ? html`
              <div class="card">
                <div class="card-title">Select an agent</div>
                <div class="card-sub">Pick an agent to inspect its workspace and tools.</div>
              </div>
            `
          : html`
              ${renderAgentTabs(
                props.activePanel,
                (panel) => props.onSelectPanel(panel),
                tabCounts,
              )}
              ${props.activePanel === "overview"
                ? renderAgentOverview({
                    agent: selectedAgent,
                    basePath: props.basePath,
                    defaultId,
                    configForm: props.config.form,
                    agentFilesList: props.agentFiles.list,
                    agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                    agentIdentityError: props.agentIdentityError,
                    agentIdentityLoading: props.agentIdentityLoading,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    modelCatalog: props.modelCatalog,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                    onModelChange: props.onModelChange,
                    onModelFallbacksChange: props.onModelFallbacksChange,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
              ${props.activePanel === "files"
                ? renderAgentFiles({
                    agentId: selectedAgent.id,
                    agentFilesList: props.agentFiles.list,
                    agentFilesLoading: props.agentFiles.loading,
                    agentFilesError: props.agentFiles.error,
                    agentFileActive: props.agentFiles.active,
                    agentFileContents: props.agentFiles.contents,
                    agentFileDrafts: props.agentFiles.drafts,
                    agentFileSaving: props.agentFiles.saving,
                    onLoadFiles: props.onLoadFiles,
                    onSelectFile: props.onSelectFile,
                    onFileDraftChange: props.onFileDraftChange,
                    onFileReset: props.onFileReset,
                    onFileSave: props.onFileSave,
                  })
                : nothing}
              ${props.activePanel === "tools"
                ? renderAgentTools({
                    agentId: selectedAgent.id,
                    configForm: props.config.form,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    toolsCatalogLoading: props.toolsCatalog.loading,
                    toolsCatalogError: props.toolsCatalog.error,
                    toolsCatalogResult: props.toolsCatalog.result,
                    toolsEffectiveLoading: props.toolsEffective.loading,
                    toolsEffectiveError: props.toolsEffective.error,
                    toolsEffectiveResult: props.toolsEffective.result,
                    runtimeSessionKey: props.runtimeSessionKey,
                    runtimeSessionMatchesSelectedAgent: props.runtimeSessionMatchesSelectedAgent,
                    onProfileChange: props.onToolsProfileChange,
                    onOverridesChange: props.onToolsOverridesChange,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                  })
                : nothing}
              ${props.activePanel === "skills"
                ? renderAgentSkills({
                    agentId: selectedAgent.id,
                    report: props.agentSkills.report,
                    loading: props.agentSkills.loading,
                    error: props.agentSkills.error,
                    activeAgentId: props.agentSkills.agentId,
                    configForm: props.config.form,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    filter: props.agentSkills.filter,
                    onFilterChange: props.onSkillsFilterChange,
                    onRefresh: props.onSkillsRefresh,
                    onToggle: props.onAgentSkillToggle,
                    onClear: props.onAgentSkillsClear,
                    onDisableAll: props.onAgentSkillsDisableAll,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                  })
                : nothing}
              ${props.activePanel === "channels"
                ? renderAgentChannels({
                    context: buildAgentContext(
                      selectedAgent,
                      props.config.form,
                      props.agentFiles.list,
                      defaultId,
                      props.agentIdentityById[selectedAgent.id] ?? null,
                    ),
                    configForm: props.config.form,
                    snapshot: props.channels.snapshot,
                    loading: props.channels.loading,
                    error: props.channels.error,
                    lastSuccess: props.channels.lastSuccess,
                    onRefresh: props.onChannelsRefresh,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
              ${props.activePanel === "cron"
                ? renderAgentCron({
                    context: buildAgentContext(
                      selectedAgent,
                      props.config.form,
                      props.agentFiles.list,
                      defaultId,
                      props.agentIdentityById[selectedAgent.id] ?? null,
                    ),
                    agentId: selectedAgent.id,
                    jobs: props.cron.jobs,
                    status: props.cron.status,
                    loading: props.cron.loading,
                    error: props.cron.error,
                    onRefresh: props.onCronRefresh,
                    onRunNow: props.onCronRunNow,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
              ${props.activePanel === "governance"
                ? renderAgentGovernance({
                    agentId: selectedAgent.id,
                    overviewLoading: props.governance.overviewLoading,
                    overviewError: props.governance.overviewError,
                    overviewResult: props.governance.overviewResult,
                    assetRegistryLoading: props.governance.assetRegistryLoading,
                    assetRegistryError: props.governance.assetRegistryError,
                    assetRegistryResult: props.governance.assetRegistryResult,
                    capabilitiesLoading: props.governance.capabilitiesLoading,
                    capabilitiesError: props.governance.capabilitiesError,
                    capabilitiesResult: props.governance.capabilitiesResult,
                    genesisLoading: props.governance.genesisLoading,
                    genesisError: props.governance.genesisError,
                    genesisResult: props.governance.genesisResult,
                    agentLoading: props.governance.agentLoading,
                    agentError: props.governance.agentError,
                    agentResult: props.governance.agentResult,
                    teamLoading: props.governance.teamLoading,
                    teamError: props.governance.teamError,
                    teamResult: props.governance.teamResult,
                    proposalsLoading: props.governance.proposalsLoading,
                    proposalsError: props.governance.proposalsError,
                    proposalsResult: props.governance.proposalsResult,
                    proposalSynthesizeBusy: props.governance.proposalSynthesizeBusy,
                    proposalSynthesizeError: props.governance.proposalSynthesizeError,
                    proposalSynthesizeResult: props.governance.proposalSynthesizeResult,
                    proposalReconcileBusy: props.governance.proposalReconcileBusy,
                    proposalReconcileError: props.governance.proposalReconcileError,
                    proposalReconcileResult: props.governance.proposalReconcileResult,
                    proposalCreateBusy: props.governance.proposalCreateBusy,
                    proposalCreateError: props.governance.proposalCreateError,
                    proposalCreateResult: props.governance.proposalCreateResult,
                    proposalActionBusyId: props.governance.proposalActionBusyId,
                    proposalActionError: props.governance.proposalActionError,
                    proposalOperator: props.governanceDraft.operator,
                    proposalDecisionNote: props.governanceDraft.decisionNote,
                    proposalStatusFilter: props.governanceDraft.statusFilter,
                    proposalReconcileMode: props.governanceDraft.reconcileMode,
                    proposalLimit: props.governanceDraft.proposalLimit,
                    scopeAgentIds: props.governanceDraft.scopeAgentIds,
                    scopeWorkspaceDirs: props.governanceDraft.scopeWorkspaceDirs,
                    scopeTeamId: props.governanceDraft.scopeTeamId,
                    proposalCreateTitle: props.governanceDraft.createTitle,
                    proposalCreateRationale: props.governanceDraft.createRationale,
                    proposalCreateAgentId: props.governanceDraft.createAgentId,
                    proposalCreateSessionKey: props.governanceDraft.createSessionKey,
                    proposalCreateOperationsJson: props.governanceDraft.createOperationsJson,
                    onOverviewRefresh: props.onGovernanceOverviewRefresh,
                    onAssetRegistryRefresh: props.onGovernanceAssetRegistryRefresh,
                    onCapabilitiesRefresh: props.onGovernanceCapabilitiesRefresh,
                    onScopeUseCapabilities: props.onGovernanceScopeUseCapabilities,
                    onScopeUseGenesis: props.onGovernanceScopeUseGenesis,
                    onWorkbenchScopeReset: props.onGovernanceWorkbenchScopeReset,
                    onGenesisRefresh: props.onGovernanceGenesisRefresh,
                    onAgentRefresh: props.onGovernanceAgentRefresh,
                    onTeamRefresh: props.onGovernanceTeamRefresh,
                    onProposalsRefresh: props.onGovernanceProposalsRefresh,
                    onProposalSynthesize: props.onGovernanceProposalSynthesize,
                    onProposalReconcile: props.onGovernanceProposalReconcile,
                    onProposalCreate: props.onGovernanceProposalCreate,
                    onProposalCreateReset: props.onGovernanceProposalCreateReset,
                    onProposalReview: props.onGovernanceProposalReview,
                    onProposalApply: props.onGovernanceProposalApply,
                    onProposalRevert: props.onGovernanceProposalRevert,
                    onProposalApproveVisible: props.onGovernanceProposalApproveVisible,
                    onProposalApplyVisible: props.onGovernanceProposalApplyVisible,
                    onProposalRevertVisible: props.onGovernanceProposalRevertVisible,
                    onProposalLoadSynthesisDraft:
                      props.onGovernanceProposalLoadSynthesisDraft,
                    onProposalLoadReconcileDraft:
                      props.onGovernanceProposalLoadReconcileDraft,
                    onProposalOperatorChange: props.onGovernanceOperatorChange,
                    onProposalDecisionNoteChange: props.onGovernanceDecisionNoteChange,
                    onProposalStatusFilterChange: props.onGovernanceStatusFilterChange,
                    onProposalReconcileModeChange: props.onGovernanceReconcileModeChange,
                    onProposalLimitChange: props.onGovernanceProposalLimitChange,
                    onProposalCreateTitleChange: props.onGovernanceCreateTitleChange,
                    onProposalCreateRationaleChange: props.onGovernanceCreateRationaleChange,
                    onProposalCreateAgentIdChange: props.onGovernanceCreateAgentIdChange,
                    onProposalCreateSessionKeyChange: props.onGovernanceCreateSessionKeyChange,
                    onProposalCreateOperationsJsonChange:
                      props.onGovernanceCreateOperationsJsonChange,
                    onScopeAgentIdsChange: props.onGovernanceScopeAgentIdsChange,
                    onScopeWorkspaceDirsChange: props.onGovernanceScopeWorkspaceDirsChange,
                    onScopeTeamIdChange: props.onGovernanceScopeTeamIdChange,
                  })
                : nothing}
              ${props.activePanel === "autonomy"
                ? renderAgentAutonomy({
                    agentId: selectedAgent.id,
                    loading: props.autonomy.loading,
                    error: props.autonomy.error,
                    result: props.autonomy.result,
                    overviewLoading: props.autonomy.overviewLoading,
                    overviewError: props.autonomy.overviewError,
                    overviewResult: props.autonomy.overviewResult,
                    capabilitiesLoading: props.autonomy.capabilitiesLoading,
                    capabilitiesError: props.autonomy.capabilitiesError,
                    capabilitiesResult: props.autonomy.capabilitiesResult,
                    genesisLoading: props.autonomy.genesisLoading,
                    genesisError: props.autonomy.genesisError,
                    genesisResult: props.autonomy.genesisResult,
                    historyLoading: props.autonomy.historyLoading,
                    historyError: props.autonomy.historyError,
                    historyResult: props.autonomy.historyResult,
                    startBusy: props.autonomy.startBusy,
                    startError: props.autonomy.startError,
                    replayBusy: props.autonomy.replayBusy,
                    replayError: props.autonomy.replayError,
                    replayResult: props.autonomy.replayResult,
                    cancelBusy: props.autonomy.cancelBusy,
                    cancelError: props.autonomy.cancelError,
                    loopBusy: props.autonomy.loopBusy,
                    loopError: props.autonomy.loopError,
                    healBusy: props.autonomy.healBusy,
                    healError: props.autonomy.healError,
                    superviseBusy: props.autonomy.superviseBusy,
                    superviseError: props.autonomy.superviseError,
                    superviseResult: props.autonomy.superviseResult,
                    governanceBusy: props.autonomy.governanceBusy,
                    governanceError: props.autonomy.governanceError,
                    governanceResult: props.autonomy.governanceResult,
                    governanceReconcileBusy: props.autonomy.governanceReconcileBusy,
                    governanceReconcileError: props.autonomy.governanceReconcileError,
                    governanceReconcileResult: props.autonomy.governanceReconcileResult,
                    reconcileBusy: props.autonomy.reconcileBusy,
                    reconcileError: props.autonomy.reconcileError,
                    historyMode: props.autonomyDraft.historyMode,
                    historySource: props.autonomyDraft.historySource,
                    historyLimit: props.autonomyDraft.historyLimit,
                    goal: props.autonomyDraft.goal,
                    controllerId: props.autonomyDraft.controllerId,
                    currentStep: props.autonomyDraft.currentStep,
                    notifyPolicy: props.autonomyDraft.notifyPolicy,
                    flowStatus: props.autonomyDraft.flowStatus,
                    seedTaskEnabled: props.autonomyDraft.seedTaskEnabled,
                    seedTaskRuntime: props.autonomyDraft.seedTaskRuntime,
                    seedTaskStatus: props.autonomyDraft.seedTaskStatus,
                    seedTaskLabel: props.autonomyDraft.seedTaskLabel,
                    seedTaskTask: props.autonomyDraft.seedTaskTask,
                    replayVerdict: props.autonomyDraft.replayVerdict,
                    replayQaVerdict: props.autonomyDraft.replayQaVerdict,
                    replayAuditVerdict: props.autonomyDraft.replayAuditVerdict,
                    loopEveryMinutes: props.autonomyDraft.loopEveryMinutes,
                    workspaceScope: props.autonomyDraft.workspaceScope,
                    governanceReconcileMode: props.autonomyDraft.governanceReconcileMode,
                    governanceReconcileNote: props.autonomyDraft.governanceReconcileNote,
                    onRefresh: props.onAutonomyRefresh,
                    onOverviewRefresh: props.onAutonomyOverviewRefresh,
                    onCapabilitiesRefresh: props.onAutonomyCapabilitiesRefresh,
                    onGenesisRefresh: props.onAutonomyGenesisRefresh,
                    onHistoryRefresh: props.onAutonomyHistoryRefresh,
                    onStart: props.onAutonomyStart,
                    onReplaySubmit: props.onAutonomyReplaySubmit,
                    onCancel: props.onAutonomyCancel,
                    onLoopUpsert: props.onAutonomyLoopUpsert,
                    onLoopRemove: props.onAutonomyLoopRemove,
                    onHeal: props.onAutonomyHeal,
                    onSupervise: props.onAutonomySupervise,
                    onGovernanceProposals: props.onAutonomyGovernanceProposals,
                    onGovernanceReconcile: props.onAutonomyGovernanceReconcile,
                    onReconcile: props.onAutonomyReconcile,
                    onRunSuggestedAction: props.onAutonomyRunSuggestedAction,
                    onRunSuggestedActionBatch: props.onAutonomyRunSuggestedActionBatch,
                    onInspectOverviewAgent: props.onAutonomyInspectOverviewAgent,
                    onResetDraft: props.onAutonomyResetDraft,
                    onGoalChange: props.onAutonomyGoalChange,
                    onControllerIdChange: props.onAutonomyControllerIdChange,
                    onCurrentStepChange: props.onAutonomyCurrentStepChange,
                    onNotifyPolicyChange: props.onAutonomyNotifyPolicyChange,
                    onFlowStatusChange: props.onAutonomyFlowStatusChange,
                    onSeedTaskEnabledChange: props.onAutonomySeedTaskEnabledChange,
                    onSeedTaskRuntimeChange: props.onAutonomySeedTaskRuntimeChange,
                    onSeedTaskStatusChange: props.onAutonomySeedTaskStatusChange,
                    onSeedTaskLabelChange: props.onAutonomySeedTaskLabelChange,
                    onSeedTaskTaskChange: props.onAutonomySeedTaskTaskChange,
                    onReplayVerdictChange: props.onAutonomyReplayVerdictChange,
                    onReplayQaVerdictChange: props.onAutonomyReplayQaVerdictChange,
                    onReplayAuditVerdictChange: props.onAutonomyReplayAuditVerdictChange,
                    onLoopEveryMinutesChange: props.onAutonomyLoopEveryMinutesChange,
                    onWorkspaceScopeChange: props.onAutonomyWorkspaceScopeChange,
                    onGovernanceReconcileModeChange:
                      props.onAutonomyGovernanceReconcileModeChange,
                    onGovernanceReconcileNoteChange:
                      props.onAutonomyGovernanceReconcileNoteChange,
                    onHistoryModeChange: props.onAutonomyHistoryModeChange,
                    onHistorySourceChange: props.onAutonomyHistorySourceChange,
                    onHistoryLimitChange: props.onAutonomyHistoryLimitChange,
                    onUseRecommendedGoal: props.onAutonomyUseRecommendedGoal,
                  })
                : nothing}
            `}
      </section>
    </div>
  `;
}

function renderAgentTabs(
  active: AgentsPanel,
  onSelect: (panel: AgentsPanel) => void,
  counts: Record<string, number | null>,
) {
  const tabs: Array<{ id: AgentsPanel; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "files", label: "Files" },
    { id: "tools", label: "Tools" },
    { id: "skills", label: "Skills" },
    { id: "channels", label: "Channels" },
    { id: "cron", label: "Cron Jobs" },
    { id: "governance", label: "Governance" },
    { id: "autonomy", label: "Autonomy" },
  ];
  return html`
    <div class="agent-tabs">
      ${tabs.map(
        (tab) => html`
          <button
            class="agent-tab ${active === tab.id ? "active" : ""}"
            type="button"
            @click=${() => onSelect(tab.id)}
          >
            ${tab.label}${counts[tab.id] != null
              ? html`<span class="agent-tab-count">${counts[tab.id]}</span>`
              : nothing}
          </button>
        `,
      )}
    </div>
  `;
}
