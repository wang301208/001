import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type {
  GovernanceAgentResult,
  GovernanceCapabilityAssetRegistryResult,
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
  GovernanceOverviewResult,
  GovernanceProposalOperation,
  GovernanceProposalsCreateResult,
  GovernanceProposalsListResult,
  GovernanceProposalsReconcileResult,
  GovernanceProposalsSynthesizeResult,
  GovernanceTeamResult,
} from "../types.ts";
import {
  formatGovernanceAgentIdsDraft,
  formatGovernanceWorkspaceDirsDraft,
  parseGovernanceAgentIdsDraft,
  parseGovernanceProposalOperationsDraft,
  parseGovernanceWorkspaceDirsDraft,
} from "../controllers/governance.ts";

type GovernanceRegistryAsset =
  GovernanceCapabilityAssetRegistryResult["desiredRegistry"]["assets"][number];

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

function renderKv(label: string, value: unknown, mono = false) {
  return html`
    <div class="agent-kv">
      <div class="label">${label}</div>
      <div class=${mono ? "mono" : ""}>${String(value || "n/a")}</div>
    </div>
  `;
}

function coerceStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function renderRuntimeHookCoverage(
  coverage: GovernanceTeamResult["runtimeHookCoverage"] | unknown,
) {
  const hookIds = Array.isArray(coverage)
    ? coerceStringList(coverage)
    : isObjectRecord(coverage)
      ? coerceStringList(coverage.coveredHookIds ?? coverage.coveredHooks ?? coverage.covered)
      : [];

  return html`
    <section class="card" style="padding: 14px;">
      <div class="card-title">Runtime Hook Coverage</div>
      <div class="agents-overview-grid" style="margin-top: 12px;">
        ${renderKv("Covered Hooks", hookIds.length)}
      </div>
      <div style="margin-top: 12px;">
        <div class="label">Hooks</div>
        ${renderChipList(hookIds)}
      </div>
    </section>
  `;
}

function countFindings(findings: GovernanceOverviewResult["findings"]) {
  return findings.reduce(
    (acc, entry) => {
      acc[entry.severity] += 1;
      return acc;
    },
    { critical: 0, warn: 0, info: 0 },
  );
}

function countRegistryAssetKinds(assets: GovernanceRegistryAsset[]) {
  return {
    skill: assets.filter((entry) => entry.kind === "skill").length,
    plugin: assets.filter((entry) => entry.kind === "plugin").length,
    memory: assets.filter((entry) => entry.kind === "memory").length,
    strategy: assets.filter((entry) => entry.kind === "strategy").length,
    algorithm: assets.filter((entry) => entry.kind === "algorithm").length,
  };
}

function countRegistryAssetStatuses(assets: GovernanceRegistryAsset[]) {
  return {
    ready: assets.filter((entry) => entry.status === "ready").length,
    attention: assets.filter((entry) => entry.status === "attention").length,
    blocked: assets.filter((entry) => entry.status === "blocked").length,
  };
}

function renderProposalDraftPreview(operations: GovernanceProposalOperation[]) {
  return html`
    <div style="display: grid; gap: 8px; margin-top: 10px;">
      ${operations.map(
        (operation) => html`
          <div
            style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
          >
            <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="chip">${operation.kind}</span>
              <span class="mono">${operation.path}</span>
            </div>
            ${operation.kind === "write"
              ? html`
                  <div class="muted" style="margin-top: 6px;">
                    ${(operation.content?.length ?? 0).toString()} chars
                  </div>
                `
              : nothing}
          </div>
        `,
      )}
    </div>
  `;
}

function formatProposalLifecycleStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "applied":
      return "Applied";
    default:
      return value || "n/a";
  }
}

function formatProposalReconcileModeLabel(
  value: import("../controllers/governance.ts").GovernanceProposalReconcileMode,
): string {
  return value === "force_apply_all" ? "Force Apply All" : "Apply Safe";
}

function resolveGovernanceScopeAgentIds(params: {
  agentId: string;
  scopeAgentIds: string;
  capabilitiesResult: GovernanceCapabilityInventoryResult | null;
  genesisResult: GovernanceGenesisPlanResult | null;
}): string[] {
  const requested = parseGovernanceAgentIdsDraft(params.scopeAgentIds);
  if (requested.length > 0) {
    return requested;
  }
  const capabilitiesAgentIds = params.capabilitiesResult?.requestedAgentIds ?? [];
  if (capabilitiesAgentIds.length > 0) {
    return capabilitiesAgentIds;
  }
  const genesisAgentIds = params.genesisResult?.requestedAgentIds ?? [];
  if (genesisAgentIds.length > 0) {
    return genesisAgentIds;
  }
  return params.agentId.trim() ? [params.agentId.trim()] : [];
}

function resolveGovernanceScopeAgentPlaceholder(params: {
  agentId: string;
  capabilitiesResult: GovernanceCapabilityInventoryResult | null;
  genesisResult: GovernanceGenesisPlanResult | null;
}): string {
  const capabilitiesAgentIds = params.capabilitiesResult?.requestedAgentIds ?? [];
  if (capabilitiesAgentIds.length > 0) {
    return formatGovernanceAgentIdsDraft(capabilitiesAgentIds);
  }
  const genesisAgentIds = params.genesisResult?.requestedAgentIds ?? [];
  if (genesisAgentIds.length > 0) {
    return formatGovernanceAgentIdsDraft(genesisAgentIds);
  }
  return params.agentId.trim() || "One agent per line or comma-separated";
}

function resolveGovernanceWorkspaceScopePlaceholder(params: {
  capabilitiesResult: GovernanceCapabilityInventoryResult | null;
  genesisResult: GovernanceGenesisPlanResult | null;
}): string {
  const capabilitiesWorkspaceDirs = params.capabilitiesResult?.workspaceDirs ?? [];
  if (capabilitiesWorkspaceDirs.length > 0) {
    return formatGovernanceWorkspaceDirsDraft(capabilitiesWorkspaceDirs);
  }
  const genesisWorkspaceDirs = params.genesisResult?.workspaceDirs ?? [];
  if (genesisWorkspaceDirs.length > 0) {
    return formatGovernanceWorkspaceDirsDraft(genesisWorkspaceDirs);
  }
  return "One path per line or comma-separated";
}

export function renderAgentGovernance(params: {
  agentId: string;
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
  proposalOperator: string;
  proposalDecisionNote: string;
  proposalStatusFilter: import("../controllers/governance.ts").GovernanceProposalStatusFilter;
  proposalReconcileMode: import("../controllers/governance.ts").GovernanceProposalReconcileMode;
  proposalLimit: string;
  scopeAgentIds: string;
  scopeWorkspaceDirs: string;
  scopeTeamId: string;
  proposalCreateTitle: string;
  proposalCreateRationale: string;
  proposalCreateAgentId: string;
  proposalCreateSessionKey: string;
  proposalCreateOperationsJson: string;
  onOverviewRefresh: () => void;
  onAssetRegistryRefresh: () => void;
  onCapabilitiesRefresh: () => void;
  onScopeUseCapabilities: () => void;
  onScopeUseGenesis: () => void;
  onWorkbenchScopeReset: () => void;
  onGenesisRefresh: () => void;
  onAgentRefresh: () => void;
  onTeamRefresh: () => void;
  onProposalsRefresh: () => void;
  onProposalSynthesize: () => void;
  onProposalReconcile: () => void;
  onProposalCreate: () => void;
  onProposalCreateReset: () => void;
  onProposalReview: (
    proposalId: string,
    decision: import("../controllers/governance.ts").GovernanceProposalDecision,
  ) => void;
  onProposalApply: (proposalId: string) => void;
  onProposalRevert: (proposalId: string) => void;
  onProposalApproveVisible: () => void;
  onProposalApplyVisible: () => void;
  onProposalRevertVisible: () => void;
  onProposalLoadSynthesisDraft: (
    entry: GovernanceProposalsSynthesizeResult["results"][number],
  ) => void;
  onProposalLoadReconcileDraft: (
    entry: GovernanceProposalsReconcileResult["entries"][number],
  ) => void;
  onProposalOperatorChange: (value: string) => void;
  onProposalDecisionNoteChange: (value: string) => void;
  onProposalStatusFilterChange: (
    value: import("../controllers/governance.ts").GovernanceProposalStatusFilter,
  ) => void;
  onProposalReconcileModeChange: (
    value: import("../controllers/governance.ts").GovernanceProposalReconcileMode,
  ) => void;
  onProposalLimitChange: (value: string) => void;
  onProposalCreateTitleChange: (value: string) => void;
  onProposalCreateRationaleChange: (value: string) => void;
  onProposalCreateAgentIdChange: (value: string) => void;
  onProposalCreateSessionKeyChange: (value: string) => void;
  onProposalCreateOperationsJsonChange: (value: string) => void;
  onScopeAgentIdsChange: (value: string) => void;
  onScopeWorkspaceDirsChange: (value: string) => void;
  onScopeTeamIdChange: (value: string) => void;
}) {
  const overview = params.overviewResult;
  const findings = overview?.findings ?? [];
  const findingCounts = countFindings(findings);
  const enforcement = overview?.enforcement;
  const sovereignty = overview?.sovereignty;
  const proposalLedger = overview?.proposals;
  const assetRegistry = params.assetRegistryResult;
  const registryAssets = assetRegistry?.desiredRegistry.assets ?? [];
  const registryAssetKinds = countRegistryAssetKinds(registryAssets);
  const registryAssetStatuses = countRegistryAssetStatuses(registryAssets);
  const capabilities = params.capabilitiesResult;
  const capabilitySummary = capabilities?.summary;
  const genesisPlan = params.genesisResult;
  const blueprint = params.agentResult?.blueprint;
  const runtimeProfile = params.agentResult?.runtimeProfile;
  const contract = params.agentResult?.contract;
  const team = params.teamResult;
  const teamBlueprint = team?.blueprint ?? null;
  const proposals = params.proposalsResult?.proposals ?? [];
  const proposalSummary = params.proposalsResult?.summary;
  const proposalStorageDir = params.proposalsResult?.storageDir;
  const proposalSynthesis = params.proposalSynthesizeResult;
  const proposalReconcile = params.proposalReconcileResult;
  const hasProposalActionBusy = Boolean(params.proposalActionBusyId);
  const proposalCreateTitle = params.proposalCreateTitle.trim();
  const scopeAgentIds = resolveGovernanceScopeAgentIds({
    agentId: params.agentId,
    scopeAgentIds: params.scopeAgentIds,
    capabilitiesResult: params.capabilitiesResult,
    genesisResult: params.genesisResult,
  });
  const scopeWorkspaceDirs = parseGovernanceWorkspaceDirsDraft(params.scopeWorkspaceDirs);
  const resolvedScopeWorkspaceDirs =
    scopeWorkspaceDirs.length > 0
      ? scopeWorkspaceDirs
      : params.capabilitiesResult?.workspaceDirs?.length
        ? params.capabilitiesResult.workspaceDirs
        : params.genesisResult?.workspaceDirs ?? [];
  const scopeAgentPlaceholder = resolveGovernanceScopeAgentPlaceholder({
    agentId: params.agentId,
    capabilitiesResult: params.capabilitiesResult,
    genesisResult: params.genesisResult,
  });
  const scopeWorkspacePlaceholder = resolveGovernanceWorkspaceScopePlaceholder({
    capabilitiesResult: params.capabilitiesResult,
    genesisResult: params.genesisResult,
  });
  const resolvedTeamIdCandidate = params.scopeTeamId.trim() || team?.teamId || genesisPlan?.teamId;
  const resolvedTeamId = resolvedTeamIdCandidate || "genesis_team";
  let proposalDraftOperations: GovernanceProposalOperation[] = [];
  let proposalDraftError: string | null = null;
  try {
    proposalDraftOperations = parseGovernanceProposalOperationsDraft(
      params.proposalCreateOperationsJson,
    );
  } catch (err) {
    proposalDraftError = err instanceof Error ? err.message : String(err);
  }
  const proposalCreateDisabled =
    params.proposalCreateBusy || proposalCreateTitle.length === 0 || proposalDraftError !== null;
  const proposalReconcileDisabled =
    params.proposalReconcileBusy || params.proposalSynthesizeBusy || hasProposalActionBusy;
  const capabilityGapCount = capabilities?.gaps.length ?? 0;
  const criticalGapCount = capabilitySummary?.criticalGapCount ?? 0;
  const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
  const approvedProposals = proposals.filter((proposal) => proposal.status === "approved");
  const revertibleProposals = proposals.filter(
    (proposal) => proposal.status === "applied" && !proposal.apply?.revertedAt,
  );

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Governance Control Plane</div>
          <div class="card-sub">Organizational charter health, freeze posture, and machine-readable governance findings.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.overviewLoading} @click=${params.onOverviewRefresh}>
          ${params.overviewLoading ? "Refreshing..." : "Refresh Governance"}
        </button>
      </div>
      ${params.overviewError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.overviewError}</div>`
        : nothing}
      ${overview
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Charter", overview.discovered ? "discovered" : "missing")}
              ${renderKv("Freeze", enforcement?.active ? "active" : "inactive")}
              ${renderKv("Agents", overview.organization.agentCount)}
              ${renderKv("Teams", overview.organization.teamCount)}
              ${renderKv("Pending Proposals", proposalLedger?.pending ?? 0)}
              ${renderKv("Critical Findings", findingCounts.critical)}
              ${renderKv("Open Incidents", sovereignty?.open ?? 0)}
              ${renderKv("Freeze Incidents", sovereignty?.freezeIncidentIds.length ?? 0)}
              ${renderKv("Missing Artifacts", overview.missingArtifactPaths.length)}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              <section class="card" style="padding: 14px;">
                <div class="card-title">Governance Freeze</div>
                <div class="card-sub">
                  ${enforcement?.active
                    ? `Active${enforcement.reasonCode ? ` (${enforcement.reasonCode})` : ""}`
                    : "Inactive"}
                </div>
                ${enforcement?.message
                  ? html`<div class="callout info" style="margin-top: 12px;">${enforcement.message}</div>`
                  : nothing}
                <div style="margin-top: 12px;">
                  <div class="label">Deny Tools</div>
                  ${renderChipList(enforcement?.denyTools ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Reserved Authorities</div>
                  ${renderChipList(overview.reservedAuthorities)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Freeze Targets</div>
                  ${renderChipList(overview.freezeTargets)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Active Sovereignty Incidents</div>
                  ${renderChipList(enforcement?.activeSovereigntyFreezeIncidentIds ?? [])}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Sovereignty Incidents</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Storage", sovereignty?.storagePath ?? "n/a", true)}
                  ${renderKv("Open", sovereignty?.open ?? 0)}
                  ${renderKv("Resolved", sovereignty?.resolved ?? 0)}
                  ${renderKv("Critical Open", sovereignty?.criticalOpen ?? 0)}
                  ${renderKv("Freeze Active", sovereignty?.freezeActive ? "yes" : "no")}
                  ${renderKv("Updated", formatRelativeTimestamp(sovereignty?.latestObservedAt ?? null))}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Open Incident IDs</div>
                  ${renderChipList(sovereignty?.activeIncidentIds ?? [])}
                </div>
                ${sovereignty && sovereignty.incidents.length > 0
                  ? html`
                      <div style="display: grid; gap: 10px; margin-top: 12px;">
                        ${sovereignty.incidents.slice(0, 6).map(
                          (incident) => html`
                            <div
                              style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                            >
                              <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span class="chip">${incident.status}</span>
                                <span class="chip">${incident.severity}</span>
                                <span class="chip">${incident.source}</span>
                                ${incident.freezeRequested ? html`<span class="chip">freeze</span>` : nothing}
                                <span class="mono">${incident.id}</span>
                              </div>
                              <div style="margin-top: 8px;"><strong>${incident.title}</strong></div>
                              <div class="muted" style="margin-top: 6px;">${incident.summary}</div>
                              ${incident.detailLines.length > 0
                                ? html`
                                    <div style="margin-top: 8px;">
                                      <div class="label">Details</div>
                                      ${renderChipList(incident.detailLines)}
                                    </div>
                                  `
                                : nothing}
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html`<div class="callout info" style="margin-top: 12px;">No persisted sovereignty incidents.</div>`}
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Documents</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv(
                    "Constitution",
                    overview.documents.constitution.parseError
                      ? "invalid"
                      : overview.documents.constitution.exists
                        ? "ok"
                        : "missing",
                  )}
                  ${renderKv(
                    "Sovereignty",
                    overview.documents.sovereigntyPolicy.parseError
                      ? "invalid"
                      : overview.documents.sovereigntyPolicy.exists
                        ? "ok"
                        : "missing",
                  )}
                  ${renderKv(
                    "Evolution",
                    overview.documents.evolutionPolicy.parseError
                      ? "invalid"
                      : overview.documents.evolutionPolicy.exists
                        ? "ok"
                        : "missing",
                  )}
                  ${renderKv("Observed", formatRelativeTimestamp(overview.observedAt))}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Proposal Ledger</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Storage", proposalLedger?.storageDir ?? "n/a", true)}
                  ${renderKv("Total", proposalLedger?.total ?? 0)}
                  ${renderKv("Approved", proposalLedger?.approved ?? 0)}
                  ${renderKv("Rejected", proposalLedger?.rejected ?? 0)}
                  ${renderKv("Applied", proposalLedger?.applied ?? 0)}
                  ${renderKv("Updated", formatRelativeTimestamp(proposalLedger?.latestUpdatedAt ?? null))}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Charter Findings</div>
                ${findings.length > 0
                  ? html`
                      <div style="display: grid; gap: 10px; margin-top: 12px;">
                        ${findings.map(
                          (entry) => html`
                            <div class="callout ${entry.severity === "critical" ? "danger" : entry.severity === "warn" ? "warn" : "info"}">
                              <div><strong>${entry.checkId}</strong> · ${entry.title}</div>
                              <div style="margin-top: 6px;">${entry.detail}</div>
                              ${entry.remediation
                                ? html`<div class="muted" style="margin-top: 6px;">${entry.remediation}</div>`
                                : nothing}
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html`<div class="callout info" style="margin-top: 12px;">No governance charter findings.</div>`}
              </section>
            </div>
          `
        : params.overviewLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance control plane...</div>`
          : nothing}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Asset Registry</div>
          <div class="card-sub">Librarian-controlled charter registry health for governed skills, plugins, memory, strategy, and algorithm assets.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.assetRegistryLoading} @click=${params.onAssetRegistryRefresh}>
          ${params.assetRegistryLoading ? "Refreshing..." : "Refresh Registry"}
        </button>
      </div>
      ${params.assetRegistryError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.assetRegistryError}</div>`
        : nothing}
      ${assetRegistry
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Observed", formatRelativeTimestamp(assetRegistry.observedAt))}
              ${renderKv(
                "Registry File",
                assetRegistry.snapshot.parseError
                  ? "invalid"
                  : assetRegistry.snapshot.exists
                    ? "present"
                    : "missing",
              )}
              ${renderKv("Current Assets", assetRegistry.currentAssetCount)}
              ${renderKv("Desired Assets", assetRegistry.assetCount)}
              ${renderKv("Missing", assetRegistry.missingAssetIds.length)}
              ${renderKv("Stale", assetRegistry.staleAssetIds.length)}
              ${renderKv("Drifted", assetRegistry.driftedAssetIds.length)}
              ${renderKv("Changes Required", assetRegistry.hasChanges ? "yes" : "no")}
            </div>
            <div class="agents-overview-grid" style="margin-top: 12px;">
              ${renderKv("Skills", registryAssetKinds.skill)}
              ${renderKv("Plugins", registryAssetKinds.plugin)}
              ${renderKv("Memory", registryAssetKinds.memory)}
              ${renderKv("Strategy", registryAssetKinds.strategy)}
              ${renderKv("Algorithm", registryAssetKinds.algorithm)}
              ${renderKv("Ready", registryAssetStatuses.ready)}
              ${renderKv("Attention", registryAssetStatuses.attention)}
              ${renderKv("Blocked", registryAssetStatuses.blocked)}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              <section class="card" style="padding: 14px;">
                <div class="card-title">Registry File</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Path", assetRegistry.snapshot.filePath, true)}
                  ${renderKv("Relative", assetRegistry.snapshot.relativePath, true)}
                </div>
                ${assetRegistry.snapshot.parseError
                  ? html`
                      <div class="callout danger" style="margin-top: 12px;">
                        ${assetRegistry.snapshot.parseError}
                      </div>
                    `
                  : nothing}
                <div style="margin-top: 12px;">
                  <div class="label">Requested Agents</div>
                  ${renderChipList(assetRegistry.requestedAgentIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Workspace Scope</div>
                  ${renderChipList(assetRegistry.workspaceDirs)}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Registry Drift</div>
                <div style="margin-top: 12px;">
                  <div class="label">Missing Asset IDs</div>
                  ${renderChipList(assetRegistry.missingAssetIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Stale Asset IDs</div>
                  ${renderChipList(assetRegistry.staleAssetIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Drifted Asset IDs</div>
                  ${renderChipList(assetRegistry.driftedAssetIds)}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Desired Registry Preview</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Skills", registryAssetKinds.skill)}
                  ${renderKv("Plugins", registryAssetKinds.plugin)}
                  ${renderKv("Memory", registryAssetKinds.memory)}
                  ${renderKv("Strategy", registryAssetKinds.strategy)}
                  ${renderKv("Algorithm", registryAssetKinds.algorithm)}
                </div>
                ${assetRegistry.desiredRegistry.assets.length > 0
                  ? html`
                      <div style="display: grid; gap: 10px; margin-top: 12px;">
                        ${assetRegistry.desiredRegistry.assets.slice(0, 8).map(
                          (asset) => html`
                            <div
                              style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                            >
                              <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span class="chip">${asset.kind}</span>
                                <span class="chip">${asset.status}</span>
                                <span>${asset.title}</span>
                              </div>
                              <div class="muted" style="margin-top: 6px;">
                                owner=${asset.ownerAgentId ?? "n/a"} workspace=${asset.workspaceDir ?? "n/a"} coverage=${asset.coverage.length}
                              </div>
                            </div>
                          `,
                        )}
                        ${assetRegistry.desiredRegistry.assets.length > 8
                          ? html`
                              <div class="callout info">
                                ${assetRegistry.desiredRegistry.assets.length - 8} more governed assets omitted from preview.
                              </div>
                            `
                          : nothing}
                      </div>
                    `
                  : html`<div class="callout info" style="margin-top: 12px;">No governed capability assets were derived for registry output.</div>`}
              </section>
            </div>
          `
        : params.assetRegistryLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance capability asset registry...</div>`
          : nothing}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Governance Workbench Scope</div>
          <div class="card-sub">Define the fleet slice used for capability inventory and genesis planning.</div>
        </div>
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${!params.capabilitiesResult}
            @click=${params.onScopeUseCapabilities}
          >
            Use Inventory Scope
          </button>
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${!params.genesisResult}
            @click=${params.onScopeUseGenesis}
          >
            Use Genesis Scope
          </button>
          <button
            class="btn btn--sm"
            type="button"
            @click=${params.onWorkbenchScopeReset}
          >
            Clear Scope
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2" style="gap: 12px; margin-top: 16px;">
        <label class="field">
          <span>Agent Scope</span>
          <textarea
            .value=${params.scopeAgentIds}
            placeholder=${scopeAgentPlaceholder}
            @input=${(e: Event) =>
              params.onScopeAgentIdsChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <label class="field">
          <span>Workspace Scope</span>
          <textarea
            .value=${params.scopeWorkspaceDirs}
            placeholder=${scopeWorkspacePlaceholder}
            @input=${(e: Event) =>
              params.onScopeWorkspaceDirsChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
      </div>
      <div class="grid grid-cols-2" style="gap: 12px; margin-top: 12px;">
        <label class="field">
          <span>Genesis Team ID</span>
          <input
            .value=${params.scopeTeamId}
            placeholder=${resolvedTeamId}
            @input=${(e: Event) =>
              params.onScopeTeamIdChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <div style="margin-top: 4px;">
          <div class="label">Resolved Agents</div>
          ${renderChipList(scopeAgentIds, "selected agent")}
          <div class="label" style="margin-top: 12px;">Resolved Team</div>
          <div class="mono" style="margin-top: 6px;">${resolvedTeamId}</div>
          <div class="label" style="margin-top: 12px;">Resolved Workspaces</div>
          ${renderChipList(resolvedScopeWorkspaceDirs, "all visible workspaces")}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Team Charter</div>
          <div class="card-sub">Team-level charter posture, enforcement surface, and runtime hook coverage for the resolved governance team.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.teamLoading} @click=${params.onTeamRefresh}>
          ${params.teamLoading ? "Refreshing..." : "Refresh Team"}
        </button>
      </div>
      ${params.teamError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.teamError}</div>`
        : nothing}
      ${team
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Team", team.teamId, true)}
              ${renderKv("Charter", team.declared ? "declared" : "not declared")}
              ${renderKv("Members", team.members.length)}
              ${renderKv("Declared Members", team.declaredMemberIds.length)}
              ${renderKv("Missing Members", team.missingMemberIds.length)}
              ${renderKv("Frozen Members", team.freezeActiveMemberIds.length)}
              ${renderKv("Observed", formatRelativeTimestamp(team.observedAt))}
              ${renderKv("Blueprint", teamBlueprint ? "available" : "n/a")}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              <section class="card" style="padding: 14px;">
                <div class="card-title">${readString(teamBlueprint?.title) ?? team.teamId}</div>
                <div class="card-sub">
                  ${team.declared
                    ? "Resolved charter blueprint for the selected governance team."
                    : "No team blueprint declared."}
                </div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Status", readString(teamBlueprint?.status) ?? "n/a")}
                  ${renderKv("Layer", readString(teamBlueprint?.layer) ?? "n/a")}
                  ${renderKv("Source", readString(teamBlueprint?.sourcePath) ?? "n/a", true)}
                  ${renderKv("Declared", team.declared ? "yes" : "no")}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Declared Members</div>
                  ${renderChipList(team.declaredMemberIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Missing Members</div>
                  ${renderChipList(team.missingMemberIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Freeze Active Members</div>
                  ${renderChipList(team.freezeActiveMemberIds)}
                </div>
              </section>
              ${renderRuntimeHookCoverage(team.runtimeHookCoverage)}
              <section class="card" style="padding: 14px;">
                <div class="card-title">Policy Surface</div>
                <div style="margin-top: 12px;">
                  <div class="label">Effective Tool Deny</div>
                  ${renderChipList(team.effectiveToolDeny)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Mutation Allow</div>
                  ${renderChipList(team.mutationAllow)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Mutation Deny</div>
                  ${renderChipList(team.mutationDeny)}
                </div>
              </section>
            </div>
          `
        : params.teamLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance team charter...</div>`
          : html`
              <div class="callout info" style="margin-top: 12px;">
                ${resolvedTeamIdCandidate
                  ? `No team governance snapshot loaded for ${resolvedTeamId}.`
                  : "Provide a team id or refresh genesis planning to inspect team governance."}
              </div>
            `}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Team Profile</div>
          <div class="card-sub">Member-level governance overview for the resolved team, including runtime and mutation posture.</div>
        </div>
      </div>
      ${team
        ? team.members.length > 0
          ? html`
              <div style="display: grid; gap: 12px; margin-top: 16px;">
                ${team.members.map((member) => {
                  const memberBlueprint = member.blueprint ?? null;
                  const runtimeSnapshot = member.runtimeSnapshot ?? null;
                  const runtimeSummary = runtimeSnapshot?.summary;
                  const memberContract = member.contract;
                  return html`
                    <section class="card" style="padding: 14px;">
                      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                        <div>
                          <div class="card-title">${readString(memberBlueprint?.title) ?? member.agentId}</div>
                          <div class="card-sub">${readString(memberBlueprint?.missionPrimary) ?? "No member mission declared."}</div>
                        </div>
                        <div class="row" style="gap: 8px; flex-wrap: wrap;">
                          <span class="chip">${member.agentId}</span>
                          ${readString(memberContract?.authorityLevel)
                            ? html`<span class="chip">${memberContract.authorityLevel}</span>`
                            : nothing}
                          ${readBoolean(memberContract?.freezeActive)
                            ? html`<span class="chip">freeze</span>`
                            : nothing}
                          ${(memberContract?.activeSovereigntyIncidentCount ?? 0) > 0
                            ? html`<span class="chip">incidents:${memberContract?.activeSovereigntyIncidentCount}</span>`
                            : nothing}
                        </div>
                      </div>
                      <div class="agents-overview-grid" style="margin-top: 12px;">
                        ${renderKv("Charter", readBoolean(memberContract?.charterDeclared) ? "declared" : "n/a")}
                        ${renderKv("Authority", readString(memberContract?.authorityLevel) ?? "n/a")}
                        ${renderKv("Blueprint", memberBlueprint ? "available" : "n/a")}
                        ${renderKv("Runtime Snapshot", runtimeSnapshot ? "captured" : "n/a")}
                        ${renderKv(
                          "Exec Contract",
                          readString(runtimeSummary?.charterExecutionContract) ?? "n/a",
                        )}
                        ${renderKv(
                          "Require Agent ID",
                          readBoolean(runtimeSummary?.charterRequireAgentId) === null
                            ? "n/a"
                            : readBoolean(runtimeSummary?.charterRequireAgentId)
                              ? "yes"
                              : "no",
                        )}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Collaborators</div>
                        ${renderChipList(coerceStringList(memberContract?.collaborators))}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Runtime Hooks</div>
                        ${renderChipList(coerceStringList(memberContract.runtimeHooks))}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Effective Tool Deny</div>
                        ${renderChipList(coerceStringList(memberContract?.effectiveToolDeny))}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Mutation Allow</div>
                        ${renderChipList(coerceStringList(memberContract?.mutationAllow))}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Mutation Deny</div>
                        ${renderChipList(coerceStringList(memberContract?.mutationDeny))}
                      </div>
                      <div style="margin-top: 12px;">
                        <div class="label">Open Sovereignty Incidents</div>
                        ${renderChipList(
                          coerceStringList(memberContract?.activeSovereigntyFreezeIncidentIds),
                        )}
                      </div>
                    </section>
                  `;
                })}
              </div>
            `
          : html`<div class="callout info" style="margin-top: 12px;">No governed team members returned.</div>`
        : html`<div class="callout info" style="margin-top: 12px;">Team member governance appears here after a team snapshot loads.</div>`}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Capability Inventory</div>
          <div class="card-sub">Governed skills, plugins, memory, strategy, algorithm assets, blueprints, and gap pressure for the selected governance scope.</div>
        </div>
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${params.genesisLoading || capabilityGapCount === 0}
            @click=${params.onGenesisRefresh}
          >
            ${params.genesisLoading
              ? "Refreshing..."
              : `Focus Genesis (${criticalGapCount || capabilityGapCount})`}
          </button>
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${params.proposalSynthesizeBusy || capabilityGapCount === 0 || proposalReconcileDisabled}
            @click=${params.onProposalSynthesize}
          >
            ${params.proposalSynthesizeBusy
              ? "Synthesizing..."
              : `Synthesize All Gaps (${capabilityGapCount})`}
          </button>
          <button
            class="btn btn--sm primary"
            type="button"
            ?disabled=${proposalReconcileDisabled || capabilityGapCount === 0}
            @click=${params.onProposalReconcile}
          >
            ${params.proposalReconcileBusy ? "Reconciling..." : "Reconcile All Gaps"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${params.capabilitiesLoading}
            @click=${params.onCapabilitiesRefresh}
          >
            ${params.capabilitiesLoading ? "Refreshing..." : "Refresh Inventory"}
          </button>
        </div>
      </div>
      ${params.capabilitiesError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.capabilitiesError}</div>`
        : nothing}
      ${capabilities
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Observed", formatRelativeTimestamp(capabilities.observedAt))}
              ${renderKv("Scope Agents", capabilities.requestedAgentIds.length)}
              ${renderKv("Workspaces", capabilities.workspaceDirs.length)}
              ${renderKv("Entries", capabilitySummary?.totalEntries ?? 0)}
              ${renderKv("Skills", capabilitySummary?.skillCount ?? 0)}
              ${renderKv("Plugins", capabilitySummary?.pluginCount ?? 0)}
              ${renderKv("Memory", capabilitySummary?.memoryCount ?? 0)}
              ${renderKv("Strategy", capabilitySummary?.strategyCount ?? 0)}
              ${renderKv("Algorithm", capabilitySummary?.algorithmCount ?? 0)}
              ${renderKv("Autonomy Core", capabilitySummary?.autonomyProfileCount ?? 0)}
              ${renderKv("Genesis Team", capabilitySummary?.genesisMemberCount ?? 0)}
              ${renderKv("Critical Gaps", capabilitySummary?.criticalGapCount ?? 0)}
              ${renderKv("Total Gaps", capabilitySummary?.gapCount ?? 0)}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              <section class="card" style="padding: 14px;">
                <div class="card-title">Scope</div>
                <div style="margin-top: 12px;">
                  <div class="label">Requested Agents</div>
                  ${renderChipList(capabilities.requestedAgentIds)}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Workspace Scope</div>
                  ${renderChipList(capabilities.workspaceDirs)}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Governed Knowledge Assets</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Memory Ready", capabilitySummary?.memoryReady ?? 0)}
                  ${renderKv("Memory Attention", capabilitySummary?.memoryAttention ?? 0)}
                  ${renderKv("Strategy Ready", capabilitySummary?.strategyReady ?? 0)}
                  ${renderKv("Strategy Attention", capabilitySummary?.strategyAttention ?? 0)}
                  ${renderKv("Algorithm Ready", capabilitySummary?.algorithmReady ?? 0)}
                  ${renderKv("Algorithm Attention", capabilitySummary?.algorithmAttention ?? 0)}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Priority Gaps</div>
                ${capabilities.gaps.length > 0
                  ? html`
                      <div style="display: grid; gap: 10px; margin-top: 12px;">
                        ${capabilities.gaps.slice(0, 6).map(
                          (gap) => html`
                            <div class="callout ${gap.severity === "critical" ? "danger" : gap.severity === "warning" ? "warn" : "info"}">
                              <div><strong>${gap.title}</strong></div>
                              <div style="margin-top: 6px;">${gap.detail}</div>
                              <div class="muted" style="margin-top: 6px;">
                                owner=${gap.ownerAgentId ?? "n/a"} related=${gap.relatedEntryIds.length}
                              </div>
                              <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                                <button
                                  class="btn btn--sm"
                                  type="button"
                                  ?disabled=${params.genesisLoading}
                                  @click=${params.onGenesisRefresh}
                                >
                                  ${params.genesisLoading ? "Refreshing..." : "Refresh Plan"}
                                </button>
                                <button
                                  class="btn btn--sm"
                                  type="button"
                                  ?disabled=${params.proposalSynthesizeBusy || proposalReconcileDisabled}
                                  @click=${params.onProposalSynthesize}
                                >
                                  ${params.proposalSynthesizeBusy ? "Synthesizing..." : "Synthesize Gap"}
                                </button>
                                <button
                                  class="btn btn--sm primary"
                                  type="button"
                                  ?disabled=${proposalReconcileDisabled}
                                  @click=${params.onProposalReconcile}
                                >
                                  ${params.proposalReconcileBusy ? "Reconciling..." : "Reconcile Gap"}
                                </button>
                              </div>
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html`<div class="callout info" style="margin-top: 12px;">No governed capability gaps.</div>`}
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Hot Entries</div>
                ${capabilities.entries.length > 0
                  ? html`
                      <div style="display: grid; gap: 10px; margin-top: 12px;">
                        ${capabilities.entries.slice(0, 8).map(
                          (entry) => html`
                            <div
                              style="padding: 10px 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                            >
                              <div class="row" style="gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span class="chip">${entry.kind}</span>
                                <span class="chip">${entry.status}</span>
                                <span>${entry.title}</span>
                              </div>
                              <div class="muted" style="margin-top: 6px;">
                                owner=${entry.ownerAgentId ?? "n/a"} workspace=${entry.workspaceDir ?? "n/a"} issues=${entry.issues.length}
                              </div>
                            </div>
                          `,
                        )}
                      </div>
                    `
                  : html`<div class="callout info" style="margin-top: 12px;">No governed capability entries visible.</div>`}
              </section>
            </div>
          `
        : params.capabilitiesLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance capability inventory...</div>`
          : nothing}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Genesis Plan</div>
          <div class="card-sub">Deterministic stage plan for the governed genesis team to close the highest-priority gaps.</div>
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
              ${renderKv("Observed", formatRelativeTimestamp(genesisPlan.observedAt))}
              ${renderKv("Mode", genesisPlan.mode)}
              ${renderKv("Team", genesisPlan.teamId)}
              ${renderKv("Stages", genesisPlan.stages.length)}
              ${renderKv("Blockers", genesisPlan.blockers.length)}
              ${renderKv("Focus Gaps", genesisPlan.focusGapIds.length)}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Workspace Scope</div>
              ${renderChipList(genesisPlan.workspaceDirs)}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Focus Gaps</div>
              ${renderChipList(genesisPlan.focusGapIds)}
            </div>
            <div style="margin-top: 14px;">
              <div class="label">Blockers</div>
              ${genesisPlan.blockers.length > 0
                ? html`
                    <div style="display: grid; gap: 8px; margin-top: 8px;">
                      ${genesisPlan.blockers.map(
                        (blocker) =>
                          html`<div class="callout warn">${blocker}</div>`,
                      )}
                    </div>
                  `
                : html`<div class="callout info" style="margin-top: 8px;">No active genesis blockers.</div>`}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              ${genesisPlan.stages.map(
                (stage) => html`
                  <section class="card" style="padding: 14px;">
                    <div class="row" style="justify-content: space-between; gap: 12px; align-items: center;">
                      <div>
                        <div class="card-title">${stage.title}</div>
                        <div class="card-sub mono">${stage.id}</div>
                      </div>
                      <div class="row" style="gap: 8px; flex-wrap: wrap;">
                        <span class="chip">${stage.status}</span>
                        <span class="chip">${stage.ownerAgentId}</span>
                      </div>
                    </div>
                    <div style="margin-top: 10px;">${stage.goal}</div>
                    <div style="margin-top: 12px;">
                      <div class="label">Dependencies</div>
                      ${renderChipList(stage.dependsOn)}
                    </div>
                    <div style="margin-top: 12px;">
                      <div class="label">Actions</div>
                      ${renderChipList(stage.actions)}
                    </div>
                  </section>
                `,
              )}
            </div>
          `
        : params.genesisLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance genesis plan...</div>`
          : nothing}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Governance Proposals</div>
          <div class="card-sub">Review, reject, and apply machine-generated charter mutations from the governance ledger.</div>
        </div>
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${hasProposalActionBusy || pendingProposals.length === 0}
            @click=${params.onProposalApproveVisible}
          >
            ${hasProposalActionBusy ? "Working..." : `Approve Visible (${pendingProposals.length})`}
          </button>
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${hasProposalActionBusy || approvedProposals.length === 0}
            @click=${params.onProposalApplyVisible}
          >
            ${hasProposalActionBusy ? "Working..." : `Apply Visible (${approvedProposals.length})`}
          </button>
          <button
            class="btn btn--sm"
            type="button"
            ?disabled=${hasProposalActionBusy || revertibleProposals.length === 0}
            @click=${params.onProposalRevertVisible}
          >
            ${hasProposalActionBusy ? "Working..." : `Revert Visible (${revertibleProposals.length})`}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${proposalReconcileDisabled}
            @click=${params.onProposalReconcile}
          >
            ${params.proposalReconcileBusy ? "Reconciling..." : "Reconcile Proposals"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${params.proposalSynthesizeBusy || params.proposalReconcileBusy}
            @click=${params.onProposalSynthesize}
          >
            ${params.proposalSynthesizeBusy ? "Synthesizing..." : "Synthesize Proposals"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${params.proposalsLoading || params.proposalReconcileBusy}
            @click=${params.onProposalsRefresh}
          >
            ${params.proposalsLoading ? "Refreshing..." : "Refresh Proposals"}
          </button>
        </div>
      </div>
      ${params.proposalsError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.proposalsError}</div>`
        : nothing}
      ${params.proposalReconcileError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.proposalReconcileError}</div>`
        : nothing}
      ${params.proposalSynthesizeError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.proposalSynthesizeError}</div>`
        : nothing}
      ${proposalReconcile
        ? html`
            <div class="callout info" style="margin-top: 12px;">
              Reconciled ${proposalReconcile.entries.length} governance mutations in
              ${formatProposalReconcileModeLabel(proposalReconcile.mode)} mode:
              reviewed=${proposalReconcile.reviewedCount}, applied=${proposalReconcile.appliedCount},
              skipped=${proposalReconcile.skippedCount}.
            </div>
          `
        : nothing}
      ${proposalSynthesis
        ? html`
            <div class="callout info" style="margin-top: 12px;">
              Synthesized ${proposalSynthesis.results.length} governance mutations:
              created=${proposalSynthesis.createdCount}, existing=${proposalSynthesis.existingCount},
              skipped=${proposalSynthesis.skippedCount}.
            </div>
          `
        : nothing}
      ${params.proposalCreateError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.proposalCreateError}</div>`
        : nothing}
      ${params.proposalCreateResult
        ? html`
            <div class="callout info" style="margin-top: 12px;">
              Created proposal <span class="mono">${params.proposalCreateResult.proposal.id}</span>
              with ${params.proposalCreateResult.proposal.operations.length} operation${params
                .proposalCreateResult.proposal.operations.length === 1
                ? ""
                : "s"}.
            </div>
          `
        : nothing}
      ${params.proposalActionError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.proposalActionError}</div>`
        : nothing}
      ${proposalSynthesis
        ? html`
            <section class="card" style="padding: 14px; margin-top: 16px;">
              <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div>
                  <div class="card-title">Latest Synthesis</div>
                  <div class="card-sub">Deterministic proposal generation against the current governance scope.</div>
                </div>
                <div class="muted">${formatRelativeTimestamp(proposalSynthesis.observedAt)}</div>
              </div>
              <div class="agents-overview-grid" style="margin-top: 16px;">
                ${renderKv("Created", proposalSynthesis.createdCount)}
                ${renderKv("Existing", proposalSynthesis.existingCount)}
                ${renderKv("Skipped", proposalSynthesis.skippedCount)}
                ${renderKv("Findings", proposalSynthesis.findingIds.length)}
              </div>
              <div class="grid grid-cols-2" style="gap: 12px; margin-top: 16px;">
                <div>
                  <div class="label">Resolved Agents</div>
                  ${renderChipList(
                    proposalSynthesis.requestedAgentIds.length > 0
                      ? proposalSynthesis.requestedAgentIds
                      : scopeAgentIds,
                    "selected agent",
                  )}
                </div>
                <div>
                  <div class="label">Workspace Scope</div>
                  ${renderChipList(resolvedScopeWorkspaceDirs, "all visible workspaces")}
                </div>
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Finding IDs</div>
                ${renderChipList(proposalSynthesis.findingIds)}
              </div>
              <div style="display: grid; gap: 10px; margin-top: 14px;">
                ${proposalSynthesis.results.map(
                  (entry) => html`
                    <div
                      style="padding: 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                    >
                      <div class="row" style="justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <div>
                          <div><strong>${entry.title}</strong></div>
                          <div class="mono muted" style="margin-top: 6px;">${entry.ruleId}</div>
                        </div>
                        <div class="row" style="gap: 8px; flex-wrap: wrap;">
                          <span class="chip">${entry.status}</span>
                          ${entry.proposalId
                            ? html`<span class="chip">${entry.proposalId}</span>`
                            : nothing}
                          ${entry.proposalStatus
                            ? html`<span class="chip">${entry.proposalStatus}</span>`
                            : nothing}
                        </div>
                      </div>
                      ${entry.reason
                        ? html`<div class="muted" style="margin-top: 8px;">${entry.reason}</div>`
                        : nothing}
                      <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                        <button
                          class="btn btn--sm"
                          type="button"
                          @click=${() => params.onProposalLoadSynthesisDraft(entry)}
                        >
                          Load Draft
                        </button>
                      </div>
                      ${entry.operations.length > 0
                        ? html`
                            <div style="margin-top: 10px;">
                              <div class="label">Operations</div>
                              ${renderProposalDraftPreview(entry.operations)}
                            </div>
                          `
                        : nothing}
                    </div>
                  `,
                )}
              </div>
            </section>
          `
        : nothing}
      ${proposalReconcile
        ? html`
            <section class="card" style="padding: 14px; margin-top: 16px;">
              <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div>
                  <div class="card-title">Latest Reconcile</div>
                  <div class="card-sub">Deterministic synthesis plus bounded auto-approval and auto-apply execution.</div>
                </div>
                <div class="muted">${formatRelativeTimestamp(proposalReconcile.observedAt)}</div>
              </div>
              <div class="agents-overview-grid" style="margin-top: 16px;">
                ${renderKv("Mode", formatProposalReconcileModeLabel(proposalReconcile.mode))}
                ${renderKv("Reviewed", proposalReconcile.reviewedCount)}
                ${renderKv("Applied", proposalReconcile.appliedCount)}
                ${renderKv("Skipped", proposalReconcile.skippedCount)}
                ${renderKv("Eligible Agents", proposalReconcile.eligibleAgentIds.length)}
                ${renderKv("Findings", proposalReconcile.findingIds.length)}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Requested Agents</div>
                ${renderChipList(
                  proposalReconcile.requestedAgentIds.length > 0
                    ? proposalReconcile.requestedAgentIds
                    : scopeAgentIds,
                  "selected agent",
                )}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Eligible Agents</div>
                ${renderChipList(proposalReconcile.eligibleAgentIds, "none")}
              </div>
              <div style="margin-top: 14px;">
                <div class="label">Finding IDs</div>
                ${renderChipList(proposalReconcile.findingIds, "none")}
              </div>
              <div style="display: grid; gap: 10px; margin-top: 14px;">
                ${proposalReconcile.entries.map(
                  (entry) => html`
                    <div
                      style="padding: 12px; border: 1px solid var(--panel-border, rgba(255,255,255,0.1)); border-radius: 12px;"
                    >
                      <div class="row" style="justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
                        <div>
                          <div><strong>${entry.title}</strong></div>
                          <div class="mono muted" style="margin-top: 6px;">${entry.ruleId}</div>
                        </div>
                        <div class="row" style="gap: 8px; flex-wrap: wrap;">
                          <span class="chip">${entry.synthesisStatus}</span>
                          <span class="chip">${entry.safe ? "safe" : "unsafe"}</span>
                          <span class="chip">${entry.autoApproved ? "auto-approved" : "manual-review"}</span>
                          <span class="chip">${entry.autoApplied ? "auto-applied" : "not-applied"}</span>
                        </div>
                      </div>
                      <div class="agents-overview-grid" style="margin-top: 12px;">
                        ${renderKv("Proposal", entry.proposalId ?? "n/a", true)}
                        ${renderKv(
                          "Before",
                          formatProposalLifecycleStatusLabel(entry.proposalStatusBefore),
                        )}
                        ${renderKv(
                          "After",
                          formatProposalLifecycleStatusLabel(entry.proposalStatusAfter),
                        )}
                        ${renderKv("Operations", entry.operations.length)}
                      </div>
                      ${entry.reason
                        ? html`<div class="callout info" style="margin-top: 12px;">${entry.reason}</div>`
                        : nothing}
                      <div class="row" style="gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                        <button
                          class="btn btn--sm"
                          type="button"
                          @click=${() => params.onProposalLoadReconcileDraft(entry)}
                        >
                          Load Draft
                        </button>
                      </div>
                      ${entry.operations.length > 0
                        ? html`
                            <div style="margin-top: 10px;">
                              <div class="label">Operations</div>
                              ${renderProposalDraftPreview(entry.operations)}
                            </div>
                          `
                        : nothing}
                    </div>
                  `,
                )}
              </div>
            </section>
          `
        : nothing}
      <section class="card" style="padding: 14px; margin-top: 16px;">
        <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <div class="card-title">Proposal Workbench</div>
            <div class="card-sub">Create governed charter mutations directly from the control plane.</div>
          </div>
          <div class="row" style="gap: 8px;">
            <button
              class="btn btn--sm"
              ?disabled=${params.proposalCreateBusy}
              @click=${params.onProposalCreateReset}
            >
              Reset Draft
            </button>
            <button
              class="btn btn--sm primary"
              ?disabled=${proposalCreateDisabled}
              @click=${params.onProposalCreate}
            >
              ${params.proposalCreateBusy ? "Creating..." : "Create Proposal"}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2" style="gap: 12px; margin-top: 16px;">
          <label class="field">
            <span>Title</span>
            <input
              .value=${params.proposalCreateTitle}
              placeholder="Bootstrap charter constitution"
              @input=${(e: Event) =>
                params.onProposalCreateTitleChange((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Created By Agent</span>
            <input
              .value=${params.proposalCreateAgentId}
              placeholder="founder"
              @input=${(e: Event) =>
                params.onProposalCreateAgentIdChange((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <label class="field" style="margin-top: 12px;">
          <span>Created By Session Key</span>
          <input
            .value=${params.proposalCreateSessionKey}
            placeholder="agent:founder:main"
            @input=${(e: Event) =>
              params.onProposalCreateSessionKeyChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field" style="margin-top: 12px;">
          <span>Rationale</span>
          <textarea
            .value=${params.proposalCreateRationale}
            placeholder="Explain why this governed mutation is necessary."
            @input=${(e: Event) =>
              params.onProposalCreateRationaleChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <label class="field" style="margin-top: 12px;">
          <span>Operations JSON</span>
          <textarea
            .value=${params.proposalCreateOperationsJson}
            style="min-height: 180px;"
            spellcheck="false"
            @input=${(e: Event) =>
              params.onProposalCreateOperationsJsonChange(
                (e.target as HTMLTextAreaElement).value,
              )}
          ></textarea>
        </label>
        ${proposalDraftError
          ? html`<div class="callout warn" style="margin-top: 12px;">${proposalDraftError}</div>`
          : html`
              <div style="margin-top: 12px;">
                <div class="label">Draft Preview</div>
                <div class="muted" style="margin-top: 6px;">
                  ${proposalDraftOperations.length} normalized operation${proposalDraftOperations
                    .length === 1
                    ? ""
                    : "s"} ready for governance review.
                </div>
                ${renderProposalDraftPreview(proposalDraftOperations)}
              </div>
            `}
      </section>
      <div class="grid grid-cols-4" style="gap: 12px; margin-top: 16px;">
        <label class="field">
          <span>Status Filter</span>
          <select
            .value=${params.proposalStatusFilter}
            @change=${(e: Event) =>
              params.onProposalStatusFilterChange(
                (e.target as HTMLSelectElement).value as import("../controllers/governance.ts").GovernanceProposalStatusFilter,
              )}
          >
            <option value="">all</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="applied">applied</option>
          </select>
        </label>
        <label class="field">
          <span>Result Limit</span>
          <input
            .value=${params.proposalLimit}
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="Use default"
            @input=${(e: Event) =>
              params.onProposalLimitChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>Operator</span>
          <input
            .value=${params.proposalOperator}
            placeholder="human-architect"
            @input=${(e: Event) =>
              params.onProposalOperatorChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>Reconcile Mode</span>
          <select
            .value=${params.proposalReconcileMode}
            @change=${(e: Event) =>
              params.onProposalReconcileModeChange(
                (e.target as HTMLSelectElement)
                  .value as import("../controllers/governance.ts").GovernanceProposalReconcileMode,
              )}
          >
            <option value="apply_safe">apply_safe</option>
            <option value="force_apply_all">force_apply_all</option>
          </select>
        </label>
      </div>
      <label class="field" style="margin-top: 12px;">
        <span>Decision / Reconcile Note</span>
        <textarea
          .value=${params.proposalDecisionNote}
          placeholder="optional approval, rejection, or reconcile note"
          @input=${(e: Event) =>
            params.onProposalDecisionNoteChange((e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </label>
      ${proposalSummary
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Visible", proposals.length)}
              ${renderKv("Pending", proposalSummary.pending)}
              ${renderKv("Approved", proposalSummary.approved)}
              ${renderKv("Rejected", proposalSummary.rejected)}
              ${renderKv("Applied", proposalSummary.applied)}
              ${renderKv("Updated", formatRelativeTimestamp(proposalSummary.latestUpdatedAt ?? null))}
            </div>
          `
        : nothing}
      ${proposalStorageDir
        ? html`
            <div style="margin-top: 14px;">
              <div class="label">Storage</div>
              <div class="mono" style="margin-top: 6px;">${proposalStorageDir}</div>
            </div>
          `
        : nothing}
      ${proposals.length > 0
        ? html`
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              ${proposals.map((proposal) => {
                const proposalBusy = params.proposalActionBusyId === proposal.id;
                return html`
                  <section class="card" style="padding: 14px;">
                    <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                      <div>
                        <div class="row" style="gap: 8px; align-items: center;">
                          <div class="card-title">${proposal.title}</div>
                          <span class="chip">${proposal.status}</span>
                        </div>
                        <div class="card-sub">${proposal.id}</div>
                      </div>
                      <div class="row" style="gap: 8px;">
                        ${proposal.status === "pending"
                          ? html`
                              <button
                                class="btn btn--sm"
                                ?disabled=${hasProposalActionBusy}
                                @click=${() => params.onProposalReview(proposal.id, "reject")}
                              >
                                ${proposalBusy ? "Working..." : "Reject"}
                              </button>
                              <button
                                class="btn btn--sm primary"
                                ?disabled=${hasProposalActionBusy}
                                @click=${() => params.onProposalReview(proposal.id, "approve")}
                              >
                                ${proposalBusy ? "Working..." : "Approve"}
                              </button>
                            `
                          : proposal.status === "approved"
                            ? html`
                              <button
                                class="btn btn--sm primary"
                                ?disabled=${hasProposalActionBusy}
                                @click=${() => params.onProposalApply(proposal.id)}
                              >
                                ${proposalBusy ? "Applying..." : "Apply"}
                              </button>
                            `
                            : proposal.status === "applied" && !proposal.apply?.revertedAt
                              ? html`
                                  <button
                                    class="btn btn--sm"
                                    ?disabled=${hasProposalActionBusy}
                                    @click=${() => params.onProposalRevert(proposal.id)}
                                  >
                                    ${proposalBusy ? "Reverting..." : "Revert"}
                                  </button>
                                `
                            : nothing}
                      </div>
                    </div>
                    <div class="agents-overview-grid" style="margin-top: 12px;">
                      ${renderKv("Created", formatRelativeTimestamp(proposal.createdAt))}
                      ${renderKv("Updated", formatRelativeTimestamp(proposal.updatedAt))}
                      ${renderKv("Created By", proposal.createdByAgentId ?? "n/a", true)}
                      ${renderKv("Operations", proposal.operations.length)}
                    </div>
                    ${proposal.rationale
                      ? html`<div class="callout info" style="margin-top: 12px;">${proposal.rationale}</div>`
                      : nothing}
                    <div style="margin-top: 12px;">
                      <div class="label">Operations</div>
                      <div style="display: grid; gap: 8px; margin-top: 8px;">
                        ${proposal.operations.map(
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
                    ${proposal.review
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="label">Review</div>
                            <div class="agents-overview-grid" style="margin-top: 8px;">
                              ${renderKv("Decision", proposal.review.decision)}
                              ${renderKv("Decided By", proposal.review.decidedBy, true)}
                              ${renderKv("Decided At", formatRelativeTimestamp(proposal.review.decidedAt))}
                              ${renderKv("Note", proposal.review.decisionNote ?? "n/a")}
                            </div>
                          </div>
                        `
                      : nothing}
                    ${proposal.apply
                      ? html`
                          <div style="margin-top: 12px;">
                            <div class="label">Apply Record</div>
                            <div class="agents-overview-grid" style="margin-top: 8px;">
                              ${renderKv("Applied By", proposal.apply.appliedBy, true)}
                              ${renderKv("Applied At", formatRelativeTimestamp(proposal.apply.appliedAt))}
                              ${renderKv("Written Paths", proposal.apply.writtenPaths.length)}
                              ${renderKv("Ledger", proposal.apply.ledgerPath ?? "n/a", true)}
                            </div>
                            <div style="margin-top: 10px;">
                              ${renderChipList(proposal.apply.writtenPaths, "none")}
                            </div>
                            ${proposal.apply.revertedAt
                              ? html`
                                  <div style="margin-top: 12px;">
                                    <div class="label">Revert Record</div>
                                    <div class="agents-overview-grid" style="margin-top: 8px;">
                                      ${renderKv("Reverted By", proposal.apply.revertedBy ?? "n/a", true)}
                                      ${renderKv(
                                        "Reverted At",
                                        formatRelativeTimestamp(proposal.apply.revertedAt),
                                      )}
                                      ${renderKv(
                                        "Restored Paths",
                                        proposal.apply.restoredPaths?.length ?? 0,
                                      )}
                                    </div>
                                    <div style="margin-top: 10px;">
                                      ${renderChipList(proposal.apply.restoredPaths ?? [], "none")}
                                    </div>
                                  </div>
                                `
                              : nothing}
                          </div>
                        `
                      : nothing}
                  </section>
                `;
              })}
            </div>
          `
        : params.proposalsLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading governance proposals...</div>`
          : html`
              <div class="callout info" style="margin-top: 12px;">
                No ${params.proposalStatusFilter || "visible"} governance proposals.
              </div>
            `}
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div class="card-title">Agent Charter</div>
          <div class="card-sub">Role blueprint, collaborator boundary, and effective runtime contract for ${params.agentId}.</div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.agentLoading} @click=${params.onAgentRefresh}>
          ${params.agentLoading ? "Refreshing..." : "Refresh Agent"}
        </button>
      </div>
      ${params.agentError
        ? html`<div class="callout danger" style="margin-top: 12px;">${params.agentError}</div>`
        : nothing}
      ${params.agentResult
        ? html`
            <div class="agents-overview-grid" style="margin-top: 16px;">
              ${renderKv("Agent", params.agentResult.agentId, true)}
              ${renderKv("Charter", contract?.charterDeclared ? "declared" : "not declared")}
              ${renderKv("Layer", blueprint?.layer ?? "n/a")}
              ${renderKv("Authority", contract?.authorityLevel ?? "n/a")}
              ${renderKv("Freeze", contract?.freezeActive ? "active" : "inactive")}
              ${renderKv("Observed", formatRelativeTimestamp(params.agentResult.observedAt))}
            </div>
            <div style="display: grid; gap: 12px; margin-top: 16px;">
              <section class="card" style="padding: 14px;">
                <div class="card-title">${blueprint?.title ?? params.agentResult.agentId}</div>
                <div class="card-sub">${blueprint?.missionPrimary ?? "No charter mission declared."}</div>
                <div class="agents-overview-grid" style="margin-top: 12px;">
                  ${renderKv("Status", blueprint?.status ?? "n/a")}
                  ${renderKv("Source", blueprint?.sourcePath ?? "n/a", true)}
                  ${renderKv("Exec Contract", runtimeProfile?.executionContract ?? "n/a")}
                  ${renderKv("Require Agent ID", runtimeProfile?.requireAgentId ? "yes" : "no")}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Collaborators</div>
                  ${renderChipList(contract?.collaborators ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">May Decide</div>
                  ${renderChipList(blueprint?.canDecide ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Must Not Decide</div>
                  ${renderChipList(blueprint?.cannotDecide ?? [])}
                </div>
              </section>
              <section class="card" style="padding: 14px;">
                <div class="card-title">Mutation and Runtime</div>
                <div style="margin-top: 12px;">
                  <div class="label">Mutation Allow</div>
                  ${renderChipList(contract?.mutationAllow ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Mutation Deny</div>
                  ${renderChipList(contract?.mutationDeny ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Effective Tool Deny</div>
                  ${renderChipList(contract?.effectiveToolDeny ?? [])}
                </div>
                <div style="margin-top: 12px;">
                  <div class="label">Runtime Hooks</div>
                  ${renderChipList(contract?.runtimeHooks ?? [])}
                </div>
              </section>
              ${params.agentResult.prompt
                ? html`
                    <section class="card" style="padding: 14px;">
                      <div class="card-title">Injected Charter Prompt</div>
                      <pre class="mono" style="white-space: pre-wrap; margin: 12px 0 0 0;">${params.agentResult.prompt}</pre>
                    </section>
                  `
                : nothing}
            </div>
          `
        : params.agentLoading
          ? html`<div class="callout info" style="margin-top: 12px;">Loading selected agent governance...</div>`
          : nothing}
    </section>
  `;
}
