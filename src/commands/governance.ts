import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GovernanceCapabilityAssetRecord } from "../governance/capability-asset-registry.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  getGovernanceAgent,
  getGovernanceCapabilityAssetRegistry,
  getGovernanceCapabilityInventory,
  getGovernanceGenesisPlan,
  getGovernanceOverview,
  getGovernanceTeam,
  reconcileGovernanceProposals,
  synthesizeGovernanceProposals,
  type GovernanceProposalsReconcileMode,
} from "../governance/control-plane.js";
import {
  applyGovernanceProposal,
  applyGovernanceProposals,
  createGovernanceProposal,
  listGovernanceProposals,
  revertGovernanceProposalApply,
  revertGovernanceProposalApplies,
  reviewGovernanceProposal,
  reviewGovernanceProposals,
  type GovernanceProposalDecision,
  type GovernanceProposalOperation,
  type GovernanceProposalStatus,
} from "../governance/proposals.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { theme } from "../terminal/theme.js";
import { isRecord } from "../utils.js";

const info = theme.info;

type GovernanceOverviewOptions = {
  json?: boolean;
};

type GovernanceAgentOptions = {
  agentId: string;
  json?: boolean;
};

type GovernanceTeamOptions = {
  teamId: string;
  json?: boolean;
};

type GovernanceCapabilityInventoryOptions = {
  agentIds?: string[];
  workspaceDirs?: string[];
  json?: boolean;
};

type GovernanceCapabilityAssetRegistryOptions = {
  agentIds?: string[];
  workspaceDirs?: string[];
  json?: boolean;
};

type GovernanceGenesisPlanOptions = {
  agentIds?: string[];
  teamId?: string;
  workspaceDirs?: string[];
  json?: boolean;
};

type GovernanceProposalsListOptions = {
  status?: string;
  limit?: number;
  json?: boolean;
};

type GovernanceProposalsSynthesizeOptions = {
  agentIds?: string[];
  workspaceDirs?: string[];
  json?: boolean;
};

type GovernanceProposalsReconcileOptions = {
  agentIds?: string[];
  workspaceDirs?: string[];
  mode?: string;
  createdByAgentId?: string;
  createdBySessionKey?: string;
  decidedBy?: string;
  decisionNote?: string;
  appliedBy?: string;
  json?: boolean;
};

type GovernanceProposalsCreateOptions = {
  title: string;
  rationale?: string;
  createdByAgentId?: string;
  createdBySessionKey?: string;
  operationsJson?: string;
  operationsFile?: string;
  json?: boolean;
};

type GovernanceProposalsReviewOptions = {
  proposalId: string;
  decision: string;
  decidedBy?: string;
  decisionNote?: string;
  json?: boolean;
};

type GovernanceProposalsReviewManyOptions = {
  proposalIds?: string[];
  status?: string;
  limit?: number;
  decision: string;
  decidedBy?: string;
  decisionNote?: string;
  continueOnError?: boolean;
  json?: boolean;
};

type GovernanceProposalsApplyOptions = {
  proposalId: string;
  appliedBy?: string;
  json?: boolean;
};

type GovernanceProposalsApplyManyOptions = {
  proposalIds?: string[];
  status?: string;
  limit?: number;
  appliedBy?: string;
  continueOnError?: boolean;
  json?: boolean;
};

type GovernanceProposalsRevertOptions = {
  proposalId: string;
  revertedBy?: string;
  json?: boolean;
};

type GovernanceProposalsRevertManyOptions = {
  proposalIds?: string[];
  status?: string;
  limit?: number;
  revertedBy?: string;
  continueOnError?: boolean;
  json?: boolean;
};

function formatDocumentStatus(params: {
  label: string;
  doc: {
    path: string;
    exists: boolean;
    parseError?: string;
  };
}): string {
  if (!params.doc.exists) {
    return `${params.label}: missing`;
  }
  if (params.doc.parseError) {
    return `${params.label}: invalid (${params.doc.parseError})`;
  }
  return `${params.label}: ok`;
}

function formatList(values: string[], empty = "none"): string {
  return values.length > 0 ? values.join(", ") : empty;
}

function formatProposalOperations(operations: GovernanceProposalOperation[]): string {
  return operations
    .map((operation) =>
      `${operation.kind}:${operation.path}${operation.kind === "write" ? ` (${operation.content?.length ?? 0} chars)` : ""}`,
    )
    .join(", ");
}

function formatTimestamp(value?: number): string {
  return typeof value === "number" ? new Date(value).toISOString() : "n/a";
}

function normalizeRequestedAgentIds(agentIds?: string[]): string[] {
  return Array.from(
    new Set((agentIds ?? []).map((entry) => normalizeAgentId(entry)).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function normalizeWorkspaceDirs(workspaceDirs?: string[]): string[] {
  return Array.from(
    new Set((workspaceDirs ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function normalizeRequestedProposalIds(proposalIds?: string[]): string[] {
  return Array.from(
    new Set((proposalIds ?? []).map((entry) => entry.trim()).filter(Boolean)),
  );
}

function formatWorkspaceScope(workspaceDirs?: string[]): string {
  const normalized = normalizeWorkspaceDirs(workspaceDirs);
  return normalized.length > 0 ? normalized.join(", ") : "n/a";
}

function normalizeProposalStatus(value: string | undefined): GovernanceProposalStatus | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized === "pending" || normalized === "approved" || normalized === "rejected" || normalized === "applied") {
    return normalized;
  }
  throw new Error(`Unsupported governance proposal status: ${value}`);
}

function normalizeProposalDecision(value: string | undefined): GovernanceProposalDecision {
  const normalized = normalizeOptionalString(value);
  if (normalized === "approve" || normalized === "reject") {
    return normalized;
  }
  throw new Error(`Unsupported governance proposal decision: ${value}`);
}

function normalizeGovernanceProposalReconcileMode(
  value: string | undefined,
): GovernanceProposalsReconcileMode | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized === "apply_safe" || normalized === "force_apply_all") {
    return normalized;
  }
  throw new Error(`Unsupported governance proposal reconcile mode: ${value}`);
}

function formatProposalBatchSelection(params: {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
}): string {
  if (params.proposalIds && params.proposalIds.length > 0) {
    return `proposalIds=${params.proposalIds.join(", ")}`;
  }
  const parts = [`status=${params.status ?? "n/a"}`];
  if (typeof params.limit === "number") {
    parts.push(`limit=${params.limit}`);
  }
  return parts.join(", ");
}

async function loadGovernanceProposalOperationsInput(
  opts: Pick<GovernanceProposalsCreateOptions, "operationsJson" | "operationsFile">,
): Promise<GovernanceProposalOperation[]> {
  const operationsJson = normalizeOptionalString(opts.operationsJson);
  const operationsFile = normalizeOptionalString(opts.operationsFile);
  if ((operationsJson ? 1 : 0) + (operationsFile ? 1 : 0) !== 1) {
    throw new Error("Provide exactly one of --ops-json or --ops-file.");
  }
  const raw = operationsFile
    ? await readFile(path.resolve(operationsFile), "utf8")
    : operationsJson ?? "[]";
  const parsed = JSON.parse(raw) as unknown;
  const entries =
    isRecord(parsed) && Array.isArray(parsed.operations) ? parsed.operations : Array.isArray(parsed) ? parsed : null;
  if (!entries || entries.length === 0) {
    throw new Error("Governance proposal operations must be a non-empty array.");
  }
  return entries.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.kind !== "string" || typeof entry.path !== "string") {
      throw new Error(`Invalid governance proposal operation at index ${index}.`);
    }
    if (entry.kind !== "write" && entry.kind !== "delete") {
      throw new Error(`Unsupported governance proposal operation kind at index ${index}.`);
    }
    return {
      kind: entry.kind,
      path: entry.path,
      ...(typeof entry.content === "string" ? { content: entry.content } : {}),
    };
  });
}

function countFindings(findings: Array<{ severity: "info" | "warn" | "critical" }>) {
  return findings.reduce(
    (acc, entry) => {
      acc[entry.severity] += 1;
      return acc;
    },
    { critical: 0, warn: 0, info: 0 },
  );
}

function countCapabilityAssetKinds(assets: GovernanceCapabilityAssetRecord[]) {
  return {
    skill: assets.filter((entry) => entry.kind === "skill").length,
    plugin: assets.filter((entry) => entry.kind === "plugin").length,
    memory: assets.filter((entry) => entry.kind === "memory").length,
    strategy: assets.filter((entry) => entry.kind === "strategy").length,
    algorithm: assets.filter((entry) => entry.kind === "algorithm").length,
  };
}

function countCapabilityAssetStatuses(assets: GovernanceCapabilityAssetRecord[]) {
  return {
    ready: assets.filter((entry) => entry.status === "ready").length,
    attention: assets.filter((entry) => entry.status === "attention").length,
    blocked: assets.filter((entry) => entry.status === "blocked").length,
  };
}

export async function governanceOverviewCommand(
  opts: GovernanceOverviewOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const overview = getGovernanceOverview();

  if (opts.json) {
    runtime.log(JSON.stringify(overview, null, 2));
    return;
  }

  const findingCounts = countFindings(overview.findings);
  runtime.log(info("Governance overview"));
  runtime.log(`observedAt: ${new Date(overview.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${overview.charterDir}`);
  runtime.log(`discovered: ${overview.discovered ? "yes" : "no"}`);
  runtime.log(
    `freeze: ${overview.enforcement.active ? "active" : "inactive"}${overview.enforcement.reasonCode ? ` (${overview.enforcement.reasonCode})` : ""}`,
  );
  if (overview.enforcement.message) {
    runtime.log(`freezeMessage: ${overview.enforcement.message}`);
  }
  runtime.log(formatDocumentStatus({ label: "constitution", doc: overview.documents.constitution }));
  runtime.log(
    formatDocumentStatus({
      label: "sovereigntyPolicy",
      doc: overview.documents.sovereigntyPolicy,
    }),
  );
  runtime.log(
    formatDocumentStatus({
      label: "evolutionPolicy",
      doc: overview.documents.evolutionPolicy,
    }),
  );
  runtime.log(`agents: ${overview.organization.agentCount}`);
  runtime.log(`teams: ${overview.organization.teamCount}`);
  runtime.log(`missingArtifacts: ${overview.missingArtifactPaths.length}`);
  runtime.log(
    `proposals: total=${overview.proposals.total}, pending=${overview.proposals.pending}, approved=${overview.proposals.approved}, rejected=${overview.proposals.rejected}, applied=${overview.proposals.applied}`,
  );
  runtime.log(
    `findings: critical=${findingCounts.critical}, warn=${findingCounts.warn}, info=${findingCounts.info}`,
  );
  runtime.log(`proposalStorage: ${overview.proposals.storageDir}`);
  runtime.log(
    `audit: total=${overview.audit.summary.total}, latest=${formatTimestamp(overview.audit.summary.latestTs)}, domains=${formatList(overview.audit.summary.domains)}`,
  );
  runtime.log(`reservedAuthorities: ${formatList(overview.reservedAuthorities)}`);
  runtime.log(`freezeTargets: ${formatList(overview.freezeTargets)}`);
  runtime.log(`denyTools: ${formatList(overview.enforcement.denyTools)}`);
  if (overview.audit.recentGovernanceFacts.length > 0) {
    runtime.log("recentGovernanceFacts:");
    for (const fact of overview.audit.recentGovernanceFacts.slice(0, 5)) {
      runtime.log(
        `  - ${fact.action} by ${fact.actor.type}:${fact.actor.id} at ${formatTimestamp(fact.ts)}${fact.refs?.proposalId ? ` proposal=${fact.refs.proposalId}` : ""}`,
      );
    }
  }
  if (overview.organization.agents.length > 0) {
    runtime.log("charterAgents:");
    for (const agent of overview.organization.agents) {
      runtime.log(
        `  - ${agent.id}${agent.layer ? ` [${agent.layer}]` : ""} collaborators=${agent.declaredCollaborators.length}`,
      );
    }
  }
}

export async function governanceAgentCommand(
  opts: GovernanceAgentOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const result = getGovernanceAgent({
    agentId: opts.agentId,
  });

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  const runtimeProfile = result.runtimeProfile;
  runtime.log(info(`Governance agent: ${normalizeAgentId(opts.agentId)}`));
  runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
  runtime.log(`charterDeclared: ${result.contract.charterDeclared ? "yes" : "no"}`);
  runtime.log(`title: ${result.blueprint?.title ?? "n/a"}`);
  runtime.log(`layer: ${result.blueprint?.layer ?? "n/a"}`);
  runtime.log(`status: ${result.blueprint?.status ?? "n/a"}`);
  runtime.log(`authority: ${result.contract.authorityLevel ?? "n/a"}`);
  runtime.log(`mission: ${result.blueprint?.missionPrimary ?? "n/a"}`);
  runtime.log(`sourcePath: ${result.blueprint?.sourcePath ?? "n/a"}`);
  runtime.log(`collaborators: ${formatList(result.contract.collaborators)}`);
  runtime.log(`reportsTo: ${formatList(result.contract.reportsTo)}`);
  runtime.log(`mutationAllow: ${formatList(result.contract.mutationAllow)}`);
  runtime.log(`mutationDeny: ${formatList(result.contract.mutationDeny)}`);
  runtime.log(`toolDeny: ${formatList(result.contract.effectiveToolDeny)}`);
  runtime.log(
    `freeze: ${result.contract.freezeActive ? "active" : "inactive"}${result.contract.freezeReasonCode ? ` (${result.contract.freezeReasonCode})` : ""}`,
  );
  runtime.log(
    `subagents: ${runtimeProfile ? formatList(runtimeProfile.subagentAllowAgents) : "n/a"}`,
  );
  runtime.log(`requireAgentId: ${runtimeProfile?.requireAgentId ? "yes" : "no"}`);
  runtime.log(`executionContract: ${runtimeProfile?.executionContract ?? "n/a"}`);
  runtime.log(`runtimeToolDeny: ${formatList(runtimeProfile?.toolDeny ?? [])}`);
  if (result.prompt) {
    runtime.log("prompt:");
    runtime.log(result.prompt);
  }
}

export async function governanceTeamCommand(
  opts: GovernanceTeamOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const result = getGovernanceTeam({
    teamId: opts.teamId,
  });

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  runtime.log(info(`Governance team: ${normalizeAgentId(opts.teamId)}`));
  runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
  runtime.log(`declared: ${result.declared ? "yes" : "no"}`);
  runtime.log(`title: ${result.blueprint?.title ?? "n/a"}`);
  runtime.log(`layer: ${result.blueprint?.layer ?? "n/a"}`);
  runtime.log(`status: ${result.blueprint?.status ?? "n/a"}`);
  runtime.log(`sourcePath: ${result.blueprint?.sourcePath ?? "n/a"}`);
  runtime.log(`members: ${result.members.length}`);
  runtime.log(`declaredMemberIds: ${formatList(result.declaredMemberIds)}`);
  runtime.log(`missingMemberIds: ${formatList(result.missingMemberIds)}`);
  runtime.log(`runtimeHookCoverage: ${formatList(result.runtimeHookCoverage)}`);
  runtime.log(`mutationAllow: ${formatList(result.mutationAllow)}`);
  runtime.log(`mutationDeny: ${formatList(result.mutationDeny)}`);
  runtime.log(`toolDeny: ${formatList(result.effectiveToolDeny)}`);
  runtime.log(`freezeActiveMembers: ${formatList(result.freezeActiveMemberIds)}`);
  if (result.members.length > 0) {
    runtime.log("teamMembers:");
    for (const member of result.members) {
      runtime.log(
        `  - ${member.agentId}${member.blueprint?.layer ? ` [${member.blueprint.layer}]` : ""} declared=${member.contract.charterDeclared ? "yes" : "no"}`,
      );
      runtime.log(
        `    hooks=${formatList(member.contract.runtimeHooks)} toolDeny=${formatList(member.contract.effectiveToolDeny)}`,
      );
    }
  }
}

export async function governanceCapabilityInventoryCommand(
  opts: GovernanceCapabilityInventoryOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const agentIds = normalizeRequestedAgentIds(opts.agentIds);
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const inventory = getGovernanceCapabilityInventory({
    ...(agentIds.length > 0 ? { agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(JSON.stringify(inventory, null, 2));
    return;
  }

  runtime.log(info("Governance capability inventory"));
  runtime.log(`observedAt: ${new Date(inventory.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${inventory.charterDir}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(inventory.workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(inventory.requestedAgentIds)}`);
  runtime.log(
    `summary: total=${inventory.summary.totalEntries}, skills=${inventory.summary.skillCount}, plugins=${inventory.summary.pluginCount}, memory=${inventory.summary.memoryCount ?? 0}, strategy=${inventory.summary.strategyCount ?? 0}, algorithm=${inventory.summary.algorithmCount ?? 0}, blueprints=${inventory.summary.agentBlueprintCount}, teams=${inventory.summary.teamBlueprintCount}, autonomyProfiles=${inventory.summary.autonomyProfileCount}, genesisMembers=${inventory.summary.genesisMemberCount}`,
  );
  runtime.log(
    `readiness: skillReady=${inventory.summary.skillReady}, skillAttention=${inventory.summary.skillAttention}, skillBlocked=${inventory.summary.skillBlocked}, pluginActivated=${inventory.summary.pluginActivated}, pluginAttention=${inventory.summary.pluginAttention}, pluginBlocked=${inventory.summary.pluginBlocked}`,
  );
  runtime.log(
    `knowledgeAssets: memoryReady=${inventory.summary.memoryReady ?? 0}, memoryAttention=${inventory.summary.memoryAttention ?? 0}, memoryBlocked=${inventory.summary.memoryBlocked ?? 0}, strategyReady=${inventory.summary.strategyReady ?? 0}, strategyAttention=${inventory.summary.strategyAttention ?? 0}, strategyBlocked=${inventory.summary.strategyBlocked ?? 0}, algorithmReady=${inventory.summary.algorithmReady ?? 0}, algorithmAttention=${inventory.summary.algorithmAttention ?? 0}, algorithmBlocked=${inventory.summary.algorithmBlocked ?? 0}`,
  );
  runtime.log(
    `gaps: total=${inventory.summary.gapCount}, critical=${inventory.summary.criticalGapCount}, warning=${inventory.summary.warningGapCount}, info=${inventory.summary.infoGapCount}`,
  );
  if (inventory.gaps.length > 0) {
    runtime.log("topGaps:");
    for (const gap of inventory.gaps.slice(0, 8)) {
      runtime.log(`  - ${gap.id} [${gap.severity}] ${gap.title}`);
      runtime.log(`    owner=${gap.ownerAgentId ?? "n/a"} related=${formatList(gap.relatedEntryIds)}`);
    }
  }
  if (inventory.entries.length > 0) {
    runtime.log("topEntries:");
    for (const entry of inventory.entries.slice(0, 10)) {
      runtime.log(`  - ${entry.id} [${entry.kind}/${entry.status}] ${entry.title}`);
      runtime.log(
        `    owner=${entry.ownerAgentId ?? "n/a"} workspace=${entry.workspaceDir ?? "n/a"} coverage=${entry.coverage.length} issues=${entry.issues.length}`,
      );
    }
    if (inventory.entries.length > 10) {
      runtime.log(`entriesRemaining: ${inventory.entries.length - 10}`);
    }
  }
}

export async function governanceCapabilityAssetRegistryCommand(
  opts: GovernanceCapabilityAssetRegistryOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const agentIds = normalizeRequestedAgentIds(opts.agentIds);
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const result = getGovernanceCapabilityAssetRegistry({
    ...(agentIds.length > 0 ? { agentIds } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  const assetKinds = countCapabilityAssetKinds(result.desiredRegistry.assets);
  const assetStatuses = countCapabilityAssetStatuses(result.desiredRegistry.assets);
  runtime.log(info("Governance capability asset registry"));
  runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${result.charterDir}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(result.workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(result.requestedAgentIds)}`);
  runtime.log(`registryFile: ${result.snapshot.filePath}`);
  runtime.log(`registryExists: ${result.snapshot.exists ? "yes" : "no"}`);
  runtime.log(`registryCurrentAssets: ${result.currentAssetCount}`);
  runtime.log(`registryDesiredAssets: ${result.assetCount}`);
  runtime.log(`registryChangesRequired: ${result.hasChanges ? "yes" : "no"}`);
  runtime.log(
    `assetKinds: skills=${assetKinds.skill}, plugins=${assetKinds.plugin}, memory=${assetKinds.memory}, strategy=${assetKinds.strategy}, algorithm=${assetKinds.algorithm}`,
  );
  runtime.log(
    `assetStatuses: ready=${assetStatuses.ready}, attention=${assetStatuses.attention}, blocked=${assetStatuses.blocked}`,
  );
  runtime.log(
    `drift: missing=${result.missingAssetIds.length}, stale=${result.staleAssetIds.length}, drifted=${result.driftedAssetIds.length}`,
  );
  if (result.snapshot.parseError) {
    runtime.log(`parseError: ${result.snapshot.parseError}`);
  }
  runtime.log(`missingAssetIds: ${formatList(result.missingAssetIds)}`);
  runtime.log(`staleAssetIds: ${formatList(result.staleAssetIds)}`);
  runtime.log(`driftedAssetIds: ${formatList(result.driftedAssetIds)}`);
}

export async function governanceGenesisPlanCommand(
  opts: GovernanceGenesisPlanOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const agentIds = normalizeRequestedAgentIds(opts.agentIds);
  const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
  const result = getGovernanceGenesisPlan({
    ...(agentIds.length > 0 ? { agentIds } : {}),
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
  });

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  runtime.log(info("Governance genesis plan"));
  runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
  runtime.log(`charterDir: ${result.charterDir}`);
  runtime.log(`workspaceScope: ${formatWorkspaceScope(result.workspaceDirs)}`);
  runtime.log(`requestedAgentIds: ${formatList(result.requestedAgentIds)}`);
  runtime.log(`teamId: ${result.teamId}`);
  runtime.log(`teamTitle: ${result.teamTitle ?? "n/a"}`);
  runtime.log(`mode: ${result.mode}`);
  runtime.log(`blockers: ${formatList(result.blockers)}`);
  runtime.log(`focusGapIds: ${formatList(result.focusGapIds)}`);
  for (const stage of result.stages) {
    runtime.log(`${stage.id} [${stage.status}] ${stage.title}`);
    runtime.log(`  owner: ${stage.ownerAgentId}`);
    runtime.log(`  goal: ${stage.goal}`);
    runtime.log(`  dependsOn: ${formatList(stage.dependsOn)}`);
    runtime.log(`  actions: ${formatList(stage.actions)}`);
  }
}

export async function governanceProposalsListCommand(
  opts: GovernanceProposalsListOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const status = normalizeProposalStatus(opts.status);
    const result = await listGovernanceProposals({
      ...(status ? { status } : {}),
      ...(typeof opts.limit === "number" ? { limit: opts.limit } : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposals"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(
      `summary: total=${result.summary.total}, pending=${result.summary.pending}, approved=${result.summary.approved}, rejected=${result.summary.rejected}, applied=${result.summary.applied}`,
    );
    runtime.log(`latestCreatedAt: ${formatTimestamp(result.summary.latestCreatedAt)}`);
    runtime.log(`latestUpdatedAt: ${formatTimestamp(result.summary.latestUpdatedAt)}`);
    if (result.proposals.length === 0) {
      runtime.log("No governance proposals recorded.");
      return;
    }
    for (const proposal of result.proposals) {
      runtime.log(`${proposal.id} [${proposal.status}] ${proposal.title}`);
      runtime.log(`  updatedAt: ${formatTimestamp(proposal.updatedAt)}`);
      runtime.log(
        `  risk: ${proposal.classification.level} humanSovereignApproval=${proposal.classification.requiresHumanSovereignApproval ? "yes" : "no"}`,
      );
      runtime.log(`  ops: ${formatProposalOperations(proposal.operations)}`);
      runtime.log(
        `  createdBy: agent=${proposal.createdByAgentId ?? "n/a"} session=${proposal.createdBySessionKey ?? "n/a"}`,
      );
      if (proposal.review) {
        runtime.log(
          `  review: ${proposal.review.decision} by ${proposal.review.decidedByType}:${proposal.review.decidedBy} at ${formatTimestamp(proposal.review.decidedAt)}`,
        );
      }
      if (proposal.apply) {
        runtime.log(
          `  apply: ${proposal.apply.appliedByType}:${proposal.apply.appliedBy} at ${formatTimestamp(proposal.apply.appliedAt)} -> ${formatList(proposal.apply.writtenPaths)}`,
        );
      }
    }
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to list governance proposals.");
    runtime.exit(1);
  }
}

export async function governanceProposalsSynthesizeCommand(
  opts: GovernanceProposalsSynthesizeOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const agentIds = normalizeRequestedAgentIds(opts.agentIds);
    const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
    const result = await synthesizeGovernanceProposals({
      ...(agentIds.length > 0 ? { agentIds } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal synthesis"));
    runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
    runtime.log(`charterDir: ${result.charterDir}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
    runtime.log(`requestedAgentIds: ${formatList(result.requestedAgentIds)}`);
    runtime.log(`eligibleAgentIds: ${formatList(result.eligibleAgentIds)}`);
    runtime.log(`findings: ${formatList(result.findingIds)}`);
    runtime.log(`created: ${result.createdCount}`);
    runtime.log(`existing: ${result.existingCount}`);
    runtime.log(`skipped: ${result.skippedCount}`);
    if (result.results.length === 0) {
      runtime.log("No governance proposal work was synthesized.");
      return;
    }
    for (const entry of result.results) {
      runtime.log(
        `${entry.ruleId} [${entry.status}] ${entry.title}${entry.proposalId ? ` -> ${entry.proposalId}` : ""}`,
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
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to synthesize governance proposals.",
    );
    runtime.exit(1);
  }
}

export async function governanceProposalsReconcileCommand(
  opts: GovernanceProposalsReconcileOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const agentIds = normalizeRequestedAgentIds(opts.agentIds);
    const workspaceDirs = normalizeWorkspaceDirs(opts.workspaceDirs);
    const mode = normalizeGovernanceProposalReconcileMode(opts.mode);
    const result = await reconcileGovernanceProposals({
      ...(agentIds.length > 0 ? { agentIds } : {}),
      ...(workspaceDirs.length > 0 ? { workspaceDirs } : {}),
      ...(mode ? { mode } : {}),
      ...(opts.createdByAgentId ? { createdByAgentId: opts.createdByAgentId } : {}),
      ...(opts.createdBySessionKey ? { createdBySessionKey: opts.createdBySessionKey } : {}),
      ...(opts.decidedBy ? { decidedBy: opts.decidedBy } : {}),
      ...(opts.decisionNote ? { decisionNote: opts.decisionNote } : {}),
      ...(opts.appliedBy ? { appliedBy: opts.appliedBy } : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal reconcile"));
    runtime.log(`observedAt: ${new Date(result.observedAt).toISOString()}`);
    runtime.log(`charterDir: ${result.charterDir}`);
    runtime.log(`workspaceScope: ${formatWorkspaceScope(workspaceDirs)}`);
    runtime.log(`requestedAgentIds: ${formatList(result.requestedAgentIds)}`);
    runtime.log(`eligibleAgentIds: ${formatList(result.eligibleAgentIds)}`);
    runtime.log(`findings: ${formatList(result.findingIds)}`);
    runtime.log(`mode: ${result.mode}`);
    runtime.log(
      `synthesized: created=${result.synthesized.createdCount}, existing=${result.synthesized.existingCount}, skipped=${result.synthesized.skippedCount}`,
    );
    runtime.log(`reviewed: ${result.reviewedCount}`);
    runtime.log(`applied: ${result.appliedCount}`);
    runtime.log(`skipped: ${result.skippedCount}`);
    if (result.entries.length === 0) {
      runtime.log("No governance proposal work was reconciled.");
      return;
    }
    for (const entry of result.entries) {
      runtime.log(
        `${entry.ruleId} [${entry.synthesisStatus}] risk=${entry.risk} safe=${entry.safe ? "yes" : "no"} humanSovereign=${entry.requiresHumanSovereignApproval ? "yes" : "no"} autoApproved=${entry.autoApproved ? "yes" : "no"} autoApplied=${entry.autoApplied ? "yes" : "no"}${entry.proposalId ? ` -> ${entry.proposalId}` : ""}`,
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
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to reconcile governance proposals.",
    );
    runtime.exit(1);
  }
}

export async function governanceProposalsCreateCommand(
  opts: GovernanceProposalsCreateOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const result = await createGovernanceProposal({
      title: opts.title,
      rationale: opts.rationale,
      createdByAgentId: opts.createdByAgentId,
      createdBySessionKey: opts.createdBySessionKey,
      operations: await loadGovernanceProposalOperationsInput(opts),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal created"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`proposalId: ${result.proposal.id}`);
    runtime.log(`status: ${result.proposal.status}`);
    runtime.log(`title: ${result.proposal.title}`);
    runtime.log(`operations: ${formatProposalOperations(result.proposal.operations)}`);
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to create governance proposal.");
    runtime.exit(1);
  }
}

export async function governanceProposalsReviewCommand(
  opts: GovernanceProposalsReviewOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const result = await reviewGovernanceProposal({
      proposalId: opts.proposalId,
      decision: normalizeProposalDecision(opts.decision),
      decidedBy: opts.decidedBy ?? "cli",
      decisionNote: opts.decisionNote,
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal reviewed"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`proposalId: ${result.proposal.id}`);
    runtime.log(`status: ${result.proposal.status}`);
    runtime.log(`decision: ${result.proposal.review?.decision ?? "n/a"}`);
    runtime.log(`decidedBy: ${result.proposal.review?.decidedBy ?? "n/a"}`);
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to review governance proposal.");
    runtime.exit(1);
  }
}

export async function governanceProposalsReviewManyCommand(
  opts: GovernanceProposalsReviewManyOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const proposalIds = normalizeRequestedProposalIds(opts.proposalIds);
    const status = normalizeProposalStatus(
      proposalIds.length === 0 ? (opts.status ?? "pending") : opts.status,
    );
    const result = await reviewGovernanceProposals({
      ...(proposalIds.length > 0 ? { proposalIds } : status ? { status } : {}),
      ...(typeof opts.limit === "number" ? { limit: opts.limit } : {}),
      decision: normalizeProposalDecision(opts.decision),
      decidedBy: opts.decidedBy ?? "cli",
      decisionNote: opts.decisionNote,
      ...(typeof opts.continueOnError === "boolean"
        ? { continueOnError: opts.continueOnError }
        : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposals reviewed"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`selection: ${formatProposalBatchSelection(result.selection)}`);
    runtime.log(`matched: ${formatList(result.selection.matchedProposalIds)}`);
    runtime.log(`decision: ${result.decision}`);
    runtime.log(`reviewed: ${result.reviewedCount}`);
    runtime.log(`failed: ${result.failedCount}`);
    runtime.log(`stoppedEarly: ${result.stoppedEarly ? "yes" : "no"}`);
    if (result.entries.length === 0) {
      runtime.log("No governance proposals matched the requested batch selection.");
      return;
    }
    for (const entry of result.entries) {
      runtime.log(
        `${entry.proposalId} [${entry.ok ? "ok" : "failed"}] ${entry.title ?? "untitled"}`,
      );
      runtime.log(
        `  status: before=${entry.statusBefore ?? "n/a"} after=${entry.statusAfter ?? "n/a"}`,
      );
      if (entry.reason) {
        runtime.log(`  reason: ${entry.reason}`);
      }
    }
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to review governance proposals.",
    );
    runtime.exit(1);
  }
}

export async function governanceProposalsApplyCommand(
  opts: GovernanceProposalsApplyOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const result = await applyGovernanceProposal({
      proposalId: opts.proposalId,
      appliedBy: opts.appliedBy ?? "cli",
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal applied"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`proposalId: ${result.proposal.id}`);
    runtime.log(`charterDir: ${result.charterDir}`);
    runtime.log(`writtenPaths: ${formatList(result.writtenPaths)}`);
  } catch (error) {
    runtime.error(error instanceof Error ? error.message : "Failed to apply governance proposal.");
    runtime.exit(1);
  }
}

export async function governanceProposalsApplyManyCommand(
  opts: GovernanceProposalsApplyManyOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const proposalIds = normalizeRequestedProposalIds(opts.proposalIds);
    const status = normalizeProposalStatus(
      proposalIds.length === 0 ? (opts.status ?? "approved") : opts.status,
    );
    const result = await applyGovernanceProposals({
      ...(proposalIds.length > 0 ? { proposalIds } : status ? { status } : {}),
      ...(typeof opts.limit === "number" ? { limit: opts.limit } : {}),
      appliedBy: opts.appliedBy ?? "cli",
      ...(typeof opts.continueOnError === "boolean"
        ? { continueOnError: opts.continueOnError }
        : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposals applied"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`selection: ${formatProposalBatchSelection(result.selection)}`);
    runtime.log(`matched: ${formatList(result.selection.matchedProposalIds)}`);
    runtime.log(`applied: ${result.appliedCount}`);
    runtime.log(`failed: ${result.failedCount}`);
    runtime.log(`stoppedEarly: ${result.stoppedEarly ? "yes" : "no"}`);
    if (result.entries.length === 0) {
      runtime.log("No governance proposals matched the requested batch selection.");
      return;
    }
    for (const entry of result.entries) {
      runtime.log(
        `${entry.proposalId} [${entry.ok ? "ok" : "failed"}] ${entry.title ?? "untitled"}`,
      );
      runtime.log(
        `  status: before=${entry.statusBefore ?? "n/a"} after=${entry.statusAfter ?? "n/a"}`,
      );
      if (entry.writtenPaths?.length) {
        runtime.log(`  writtenPaths: ${formatList(entry.writtenPaths)}`);
      }
      if (entry.reason) {
        runtime.log(`  reason: ${entry.reason}`);
      }
    }
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to apply governance proposals.",
    );
    runtime.exit(1);
  }
}

export async function governanceProposalsRevertCommand(
  opts: GovernanceProposalsRevertOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const result = await revertGovernanceProposalApply({
      proposalId: opts.proposalId,
      revertedBy: opts.revertedBy ?? "cli",
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposal reverted"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`proposalId: ${result.proposal.id}`);
    runtime.log(`charterDir: ${result.charterDir}`);
    runtime.log(`restoredPaths: ${formatList(result.restoredPaths)}`);
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to revert governance proposal.",
    );
    runtime.exit(1);
  }
}

export async function governanceProposalsRevertManyCommand(
  opts: GovernanceProposalsRevertManyOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const proposalIds = normalizeRequestedProposalIds(opts.proposalIds);
    const status = normalizeProposalStatus(
      proposalIds.length === 0 ? (opts.status ?? "applied") : opts.status,
    );
    const result = await revertGovernanceProposalApplies({
      ...(proposalIds.length > 0 ? { proposalIds } : status ? { status } : {}),
      ...(typeof opts.limit === "number" ? { limit: opts.limit } : {}),
      revertedBy: opts.revertedBy ?? "cli",
      ...(typeof opts.continueOnError === "boolean"
        ? { continueOnError: opts.continueOnError }
        : {}),
    });

    if (opts.json) {
      runtime.log(JSON.stringify(result, null, 2));
      return;
    }

    runtime.log(info("Governance proposals reverted"));
    runtime.log(`storageDir: ${result.storageDir}`);
    runtime.log(`selection: ${formatProposalBatchSelection(result.selection)}`);
    runtime.log(`matched: ${formatList(result.selection.matchedProposalIds)}`);
    runtime.log(`reverted: ${result.revertedCount}`);
    runtime.log(`failed: ${result.failedCount}`);
    runtime.log(`stoppedEarly: ${result.stoppedEarly ? "yes" : "no"}`);
    if (result.entries.length === 0) {
      runtime.log("No governance proposals matched the requested batch selection.");
      return;
    }
    for (const entry of result.entries) {
      runtime.log(
        `${entry.proposalId} [${entry.ok ? "ok" : "failed"}] ${entry.title ?? "untitled"}`,
      );
      runtime.log(
        `  status: before=${entry.statusBefore ?? "n/a"} after=${entry.statusAfter ?? "n/a"}`,
      );
      if (entry.restoredPaths?.length) {
        runtime.log(`  restoredPaths: ${formatList(entry.restoredPaths)}`);
      }
      if (entry.reason) {
        runtime.log(`  reason: ${entry.reason}`);
      }
    }
  } catch (error) {
    runtime.error(
      error instanceof Error ? error.message : "Failed to revert governance proposals.",
    );
    runtime.exit(1);
  }
}
