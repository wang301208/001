import path from "node:path";
import { getRuntimeConfigSnapshot, loadConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { collectGovernanceCharterFindings, type SecurityAuditFinding } from "../security/audit.js";
import {
  listAuditFactsSync,
  summarizeAuditStreamSync,
  type AuditFactRecord,
  type AuditStreamSummary,
} from "../infra/audit-stream.js";
import {
  buildGovernanceCharterAgentPrompt,
  loadGovernanceCharterOrganization,
  resolveGovernanceCharterAgentBlueprint,
  resolveGovernanceCharterAgentRuntimeProfile,
  resolveGovernanceCharterCollaborationPolicy,
  resolveGovernanceCharterDeclaredCollaborators,
  type GovernanceCharterAgentBlueprint,
  type GovernanceCharterCollaborationPolicy,
  type GovernanceCharterTeamBlueprint,
} from "./charter-agents.js";
import {
  loadGovernanceCharter,
  resolveGovernanceEnforcementState,
  type GovernanceEnforcementState,
} from "./charter-runtime.js";
import {
  reconcileGovernanceSovereigntyAuditSync,
} from "./sovereignty-auditor.js";
import {
  getGovernanceCapabilityInventory as getGovernanceCapabilityInventoryInternal,
  planGovernanceGenesisWork,
  type GovernanceCapabilityInventoryResult,
  type GovernanceGenesisPlanResult,
} from "./capability-registry.js";
import {
  planGovernanceCapabilityAssetRegistrySync,
  type GovernanceCapabilityAssetRegistrySyncResult,
} from "./capability-asset-registry.js";
import {
  synthesizeGovernanceAutonomyProposals,
  type GovernanceAutonomyProposalSynthesisResult,
} from "./autonomy-proposals.js";
import {
  createAgentGovernanceRuntimeSnapshot,
  type AgentGovernanceRuntimeSnapshot,
} from "./runtime-snapshot.js";
import {
  resolveAgentGovernanceRuntimeContract,
  type AgentGovernanceRuntimeContract,
} from "./runtime-contract.js";
import {
  applyGovernanceProposal,
  classifyGovernanceProposalOperations,
  proposalRequiresHumanSovereignApproval,
  reviewGovernanceProposal,
  summarizeGovernanceProposalLedger,
  type GovernanceProposalRiskLevel,
  type GovernanceProposalLedger,
  type GovernanceProposalStatus,
} from "./proposals.js";

export type GovernanceCharterDocumentStatus = {
  path: string;
  exists: boolean;
  parseError?: string;
};

export type GovernanceEnforcementSummary = {
  active: boolean;
  reasonCode?: GovernanceEnforcementState["reasonCode"];
  message?: string;
  details: string[];
  denyTools: string[];
  activeSovereigntyIncidentIds: string[];
  activeSovereigntyFreezeIncidentIds: string[];
};

export type GovernanceCharterAgentRecord = GovernanceCharterAgentBlueprint & {
  declaredCollaborators: string[];
};

export type GovernanceCharterTeamRecord = GovernanceCharterTeamBlueprint;

export type GovernanceCharterRuntimeProfileRecord = {
  name?: string;
  identityName?: string;
  subagentAllowAgents: string[];
  requireAgentId: boolean;
  executionContract?: "default" | "strict-agentic";
  contextLimits?: {
    memoryGetMaxChars?: number;
    memoryGetDefaultLines?: number;
    toolResultMaxChars?: number;
    postCompactionMaxChars?: number;
  };
  toolDeny: string[];
  elevatedEnabled?: boolean;
};

export type GovernanceOrganizationRecord = {
  charterDir: string;
  discovered: boolean;
  agentCount: number;
  teamCount: number;
  agents: GovernanceCharterAgentRecord[];
  teams: GovernanceCharterTeamRecord[];
};

export type GovernanceOverviewResult = {
  observedAt: number;
  charterDir: string;
  discovered: boolean;
  proposals: GovernanceProposalLedger;
  audit: {
    summary: AuditStreamSummary;
    recentFacts: AuditFactRecord[];
    recentGovernanceFacts: AuditFactRecord[];
  };
  documents: {
    constitution: GovernanceCharterDocumentStatus;
    sovereigntyPolicy: GovernanceCharterDocumentStatus;
    evolutionPolicy: GovernanceCharterDocumentStatus;
  };
  artifactPaths: string[];
  missingArtifactPaths: string[];
  reservedAuthorities: string[];
  automaticEnforcementActions: string[];
  freezeTargets: string[];
  sovereignty: ReturnType<typeof reconcileGovernanceSovereigntyAuditSync>;
  enforcement: GovernanceEnforcementSummary;
  organization: GovernanceOrganizationRecord;
  findings: SecurityAuditFinding[];
};

export type GovernanceAgentResult = {
  observedAt: number;
  agentId: string;
  blueprint?: GovernanceCharterAgentRecord;
  runtimeProfile?: GovernanceCharterRuntimeProfileRecord;
  collaborationPolicy: GovernanceCharterCollaborationPolicy;
  contract: AgentGovernanceRuntimeContract;
  runtimeSnapshot?: AgentGovernanceRuntimeSnapshot;
  prompt?: string;
};

export type GovernanceTeamMemberRecord = {
  agentId: string;
  blueprint?: GovernanceCharterAgentRecord;
  contract: AgentGovernanceRuntimeContract;
  runtimeSnapshot?: AgentGovernanceRuntimeSnapshot;
};

export type GovernanceTeamResult = {
  observedAt: number;
  teamId: string;
  declared: boolean;
  blueprint?: GovernanceCharterTeamRecord;
  members: GovernanceTeamMemberRecord[];
  declaredMemberIds: string[];
  missingMemberIds: string[];
  runtimeHookCoverage: string[];
  effectiveToolDeny: string[];
  mutationAllow: string[];
  mutationDeny: string[];
  freezeActiveMemberIds: string[];
};

export type GovernanceCapabilityAssetRegistryResult =
  GovernanceCapabilityAssetRegistrySyncResult & {
    observedAt: number;
    charterDir: string;
    workspaceDirs: string[];
    requestedAgentIds: string[];
    currentAssetCount: number;
  };

export type {
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
  GovernanceCapabilityAssetRegistrySyncResult,
  GovernanceAutonomyProposalSynthesisResult as GovernanceProposalsSynthesizeResult,
};

export type GovernanceProposalsReconcileMode = "apply_safe" | "force_apply_all";

export type GovernanceProposalReconcileEntry = {
  ruleId: string;
  title: string;
  findingIds: string[];
  operations: GovernanceAutonomyProposalSynthesisResult["results"][number]["operations"];
  synthesisStatus: GovernanceAutonomyProposalSynthesisResult["results"][number]["status"];
  risk: GovernanceProposalRiskLevel;
  requiresHumanSovereignApproval: boolean;
  proposalId?: string;
  proposalStatusBefore?: GovernanceProposalStatus;
  proposalStatusAfter?: GovernanceProposalStatus;
  safe: boolean;
  autoApproved: boolean;
  autoApplied: boolean;
  reason?: string;
};

export type GovernanceProposalsReconcileResult = {
  observedAt: number;
  charterDir: string;
  requestedAgentIds: string[];
  eligibleAgentIds: string[];
  findingIds: string[];
  mode: GovernanceProposalsReconcileMode;
  synthesized: GovernanceAutonomyProposalSynthesisResult;
  entries: GovernanceProposalReconcileEntry[];
  reviewedCount: number;
  appliedCount: number;
  skippedCount: number;
};

const GOVERNANCE_RECONCILE_SAFE_RULE_IDS = new Set<string>([
  "restore_constitution_missing",
  "restore_constitution_invalid",
  "restore_sovereignty_policy_missing",
  "restore_sovereignty_policy_invalid",
  "restore_evolution_policy_missing",
  "restore_evolution_policy_invalid",
  "restore_missing_charter_artifacts",
  "rewrite_invalid_capability_asset_registry",
  "bootstrap_capability_asset_registry",
  "synchronize_capability_asset_registry",
]);

function resolveRuntimeConfig(cfg?: OpenClawConfig): OpenClawConfig {
  return cfg ?? getRuntimeConfigSnapshot() ?? loadConfig();
}

function mapDocumentStatus(doc: {
  path: string;
  exists: boolean;
  parseError: string | null;
}): GovernanceCharterDocumentStatus {
  return {
    path: doc.path,
    exists: doc.exists,
    ...(doc.parseError ? { parseError: doc.parseError } : {}),
  };
}

function mapEnforcementSummary(
  enforcement: GovernanceEnforcementState,
): GovernanceEnforcementSummary {
  return {
    active: enforcement.active,
    reasonCode: enforcement.reasonCode,
    message: enforcement.message,
    details: [...enforcement.details],
    denyTools: [...enforcement.denyTools],
    activeSovereigntyIncidentIds: [...enforcement.activeSovereigntyIncidentIds],
    activeSovereigntyFreezeIncidentIds: [...enforcement.activeSovereigntyFreezeIncidentIds],
  };
}

function mapAgentBlueprint(
  blueprint: GovernanceCharterAgentBlueprint,
  options: { charterDir?: string } = {},
): GovernanceCharterAgentRecord {
  return {
    ...blueprint,
    declaredCollaborators: resolveGovernanceCharterDeclaredCollaborators(blueprint.id, options),
  };
}

function mapRuntimeProfile(
  profile:
    | ReturnType<typeof resolveGovernanceCharterAgentRuntimeProfile>
    | undefined,
): GovernanceCharterRuntimeProfileRecord | undefined {
  if (!profile) {
    return undefined;
  }
  return {
    name: profile.name,
    identityName: profile.identity?.name,
    subagentAllowAgents: [...(profile.subagents?.allowAgents ?? [])],
    requireAgentId: profile.subagents?.requireAgentId === true,
    executionContract: profile.embeddedPi?.executionContract,
    contextLimits: profile.contextLimits
      ? {
          memoryGetMaxChars: profile.contextLimits.memoryGetMaxChars,
          memoryGetDefaultLines: profile.contextLimits.memoryGetDefaultLines,
          toolResultMaxChars: profile.contextLimits.toolResultMaxChars,
          postCompactionMaxChars: profile.contextLimits.postCompactionMaxChars,
        }
      : undefined,
    toolDeny: [...(profile.tools?.deny ?? [])],
    elevatedEnabled: profile.tools?.elevated?.enabled,
  };
}

function mapTeamBlueprint(blueprint: GovernanceCharterTeamBlueprint): GovernanceCharterTeamRecord {
  return {
    ...blueprint,
    members: [...blueprint.members],
  };
}

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function getGovernanceAuditSnapshot(params: {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): GovernanceOverviewResult["audit"] {
  const filePath = path.join(params.stateDir ?? resolveStateDir(params.env), "audit", "facts.jsonl");
  return {
    summary: summarizeAuditStreamSync({ filePath }),
    recentFacts: listAuditFactsSync({
      filePath,
      limit: 10,
    }),
    recentGovernanceFacts: listAuditFactsSync({
      filePath,
      limit: 10,
      domain: "governance",
    }),
  };
}

function mapOrganization(options: {
  charterDir?: string;
}): GovernanceOrganizationRecord {
  const organization = loadGovernanceCharterOrganization({
    charterDir: options.charterDir,
  });
  return {
    charterDir: organization.charterDir,
    discovered: organization.discovered,
    agentCount: organization.agents.length,
    teamCount: organization.teams.length,
    agents: organization.agents.map((entry) => mapAgentBlueprint(entry, options)),
    teams: organization.teams.map((entry) => mapTeamBlueprint(entry)),
  };
}

export function getGovernanceOverview(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
} = {}): GovernanceOverviewResult {
  const cfg = resolveRuntimeConfig(params.cfg);
  const observedAt = params.observedAt ?? Date.now();
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  const findings = collectGovernanceCharterFindings({
    cfg,
    charterDir: params.charterDir,
  });
  const sovereignty = reconcileGovernanceSovereigntyAuditSync({
    cfg,
    charterDir: params.charterDir,
    observedAt,
    findings,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const enforcement = resolveGovernanceEnforcementState(cfg, {
    charterDir: params.charterDir,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });

  return {
    observedAt,
    charterDir: snapshot.charterDir,
    discovered: snapshot.discovered,
    proposals: summarizeGovernanceProposalLedger({
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
    audit: getGovernanceAuditSnapshot({
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
    documents: {
      constitution: mapDocumentStatus(snapshot.constitution),
      sovereigntyPolicy: mapDocumentStatus(snapshot.sovereigntyPolicy),
      evolutionPolicy: mapDocumentStatus(snapshot.evolutionPolicy),
    },
    artifactPaths: [...snapshot.artifactPaths],
    missingArtifactPaths: [...snapshot.missingArtifactPaths],
    reservedAuthorities: [...snapshot.reservedAuthorities],
    automaticEnforcementActions: [...snapshot.automaticEnforcementActions],
    freezeTargets: [...snapshot.freezeTargets],
    sovereignty,
    enforcement: mapEnforcementSummary(enforcement),
    organization: mapOrganization({
      charterDir: params.charterDir,
    }),
    findings,
  };
}

export function getGovernanceAgent(params: {
  agentId: string;
  cfg?: OpenClawConfig;
  charterDir?: string;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): GovernanceAgentResult {
  const cfg = resolveRuntimeConfig(params.cfg);
  const observedAt = params.observedAt ?? Date.now();
  const agentId = normalizeAgentId(params.agentId);
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, {
    charterDir: params.charterDir,
  });

  return {
    observedAt,
    agentId,
    ...(blueprint ? { blueprint: mapAgentBlueprint(blueprint, params) } : {}),
    ...(mapRuntimeProfile(
      resolveGovernanceCharterAgentRuntimeProfile(agentId, {
        charterDir: params.charterDir,
      }),
    )
      ? {
          runtimeProfile: mapRuntimeProfile(
            resolveGovernanceCharterAgentRuntimeProfile(agentId, {
              charterDir: params.charterDir,
            }),
          ),
        }
      : {}),
    collaborationPolicy: resolveGovernanceCharterCollaborationPolicy(agentId, {
      charterDir: params.charterDir,
    }),
    contract: resolveAgentGovernanceRuntimeContract({
      cfg,
      agentId,
      charterDir: params.charterDir,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
    runtimeSnapshot: createAgentGovernanceRuntimeSnapshot({
      cfg,
      agentId,
      observedAt,
      charterDir: params.charterDir,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
    prompt: buildGovernanceCharterAgentPrompt(agentId, {
      charterDir: params.charterDir,
    }),
  };
}

export function getGovernanceTeam(params: {
  teamId: string;
  cfg?: OpenClawConfig;
  charterDir?: string;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): GovernanceTeamResult {
  const cfg = resolveRuntimeConfig(params.cfg);
  const observedAt = params.observedAt ?? Date.now();
  const teamId = normalizeAgentId(params.teamId);
  const organization = loadGovernanceCharterOrganization({
    charterDir: params.charterDir,
  });
  const blueprint = organization.teamById.get(teamId);
  const declaredMemberIds = blueprint ? [...blueprint.members] : [];
  const members = declaredMemberIds.map((agentId) => {
    const agentBlueprint = organization.agentById.get(agentId);
    const runtimeSnapshot = createAgentGovernanceRuntimeSnapshot({
      cfg,
      agentId,
      observedAt,
      charterDir: params.charterDir,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    });
    return {
      agentId,
      ...(agentBlueprint ? { blueprint: mapAgentBlueprint(agentBlueprint, params) } : {}),
      contract: resolveAgentGovernanceRuntimeContract({
        cfg,
        agentId,
        charterDir: params.charterDir,
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
        ...(params.env ? { env: params.env } : {}),
      }),
      ...(runtimeSnapshot ? { runtimeSnapshot } : {}),
    };
  });
  const missingMemberIds = declaredMemberIds.filter((agentId) => !organization.agentById.has(agentId));

  return {
    observedAt,
    teamId,
    declared: Boolean(blueprint),
    ...(blueprint ? { blueprint: mapTeamBlueprint(blueprint) } : {}),
    members,
    declaredMemberIds,
    missingMemberIds,
    runtimeHookCoverage: collectUniqueStrings(
      members.flatMap((member) => member.contract.runtimeHooks),
    ),
    effectiveToolDeny: collectUniqueStrings(
      members.flatMap((member) => member.contract.effectiveToolDeny),
    ),
    mutationAllow: collectUniqueStrings(
      members.flatMap((member) => member.contract.mutationAllow),
    ),
    mutationDeny: collectUniqueStrings(
      members.flatMap((member) => member.contract.mutationDeny),
    ),
    freezeActiveMemberIds: members
      .filter((member) => member.contract.freezeActive)
      .map((member) => member.agentId)
      .toSorted((left, right) => left.localeCompare(right)),
  };
}

export function getGovernanceCapabilityInventory(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  workspaceDirs?: string[];
  observedAt?: number;
  agentIds?: string[];
} = {}): GovernanceCapabilityInventoryResult {
  return getGovernanceCapabilityInventoryInternal(params);
}

export function getGovernanceCapabilityAssetRegistry(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  workspaceDirs?: string[];
  observedAt?: number;
  agentIds?: string[];
} = {}): GovernanceCapabilityAssetRegistryResult {
  const inventory = getGovernanceCapabilityInventory(params);
  const sync = planGovernanceCapabilityAssetRegistrySync({
    charterDir: inventory.charterDir,
    observedAt: inventory.observedAt,
    entries: inventory.entries,
  });

  return {
    observedAt: inventory.observedAt,
    charterDir: inventory.charterDir,
    workspaceDirs: inventory.workspaceDirs,
    requestedAgentIds: inventory.requestedAgentIds,
    currentAssetCount: sync.snapshot.registry?.assets.length ?? 0,
    ...sync,
  };
}

export function getGovernanceGenesisPlan(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  workspaceDirs?: string[];
  observedAt?: number;
  teamId?: string;
  agentIds?: string[];
  inventory?: GovernanceCapabilityInventoryResult;
} = {}): GovernanceGenesisPlanResult {
  return planGovernanceGenesisWork(params);
}

export async function synthesizeGovernanceProposals(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  agentIds?: string[];
  workspaceDirs?: string[];
  createdByAgentId?: string;
  createdBySessionKey?: string;
  now?: number;
} = {}): Promise<GovernanceAutonomyProposalSynthesisResult> {
  return await synthesizeGovernanceAutonomyProposals(params);
}

function resolveGovernanceReconcileMode(
  mode: GovernanceProposalsReconcileMode | undefined,
): GovernanceProposalsReconcileMode {
  return mode ?? "apply_safe";
}

function isGovernanceProposalReconcileSafe(ruleId: string): boolean {
  return GOVERNANCE_RECONCILE_SAFE_RULE_IDS.has(ruleId);
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function reconcileGovernanceProposals(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  agentIds?: string[];
  workspaceDirs?: string[];
  createdByAgentId?: string;
  createdBySessionKey?: string;
  decidedBy?: string;
  decisionNote?: string;
  appliedBy?: string;
  mode?: GovernanceProposalsReconcileMode;
  now?: number;
} = {}): Promise<GovernanceProposalsReconcileResult> {
  const mode = resolveGovernanceReconcileMode(params.mode);
  const decidedBy =
    normalizeAgentId(params.decidedBy ?? params.createdByAgentId ?? "governance-reconcile");
  const appliedBy =
    normalizeAgentId(params.appliedBy ?? params.createdByAgentId ?? decidedBy);
  const synthesized = await synthesizeGovernanceAutonomyProposals(params);
  const entries: GovernanceProposalReconcileEntry[] = [];
  let reviewedCount = 0;
  let appliedCount = 0;
  let skippedCount = 0;
  let mutationOffset = 1;

  for (const item of synthesized.results) {
    const classification = classifyGovernanceProposalOperations(item.operations);
    const safe = isGovernanceProposalReconcileSafe(item.ruleId) && classification.level === "safe";
    const entry: GovernanceProposalReconcileEntry = {
      ruleId: item.ruleId,
      title: item.title,
      findingIds: [...item.findingIds],
      operations: item.operations.map((operation) => ({ ...operation })),
      synthesisStatus: item.status,
      risk: classification.level,
      requiresHumanSovereignApproval: classification.requiresHumanSovereignApproval,
      ...(item.proposalId ? { proposalId: item.proposalId } : {}),
      ...(item.proposalStatus ? { proposalStatusBefore: item.proposalStatus } : {}),
      safe,
      autoApproved: false,
      autoApplied: false,
    };

    if (item.status === "skipped") {
      entry.reason =
        item.reason ??
        "Proposal synthesis marked this mutation as skipped and it will not be auto-executed.";
      entries.push(entry);
      skippedCount += 1;
      continue;
    }

    if (!item.proposalId || !item.proposalStatus) {
      entry.reason = "Proposal synthesis did not return a mutable proposal record.";
      entries.push(entry);
      skippedCount += 1;
      continue;
    }

    if (proposalRequiresHumanSovereignApproval({ classification, operations: item.operations })) {
      entry.reason =
        item.reason ??
        "Proposal touches sovereign governance boundaries and requires explicit human sovereign approval.";
      entries.push(entry);
      skippedCount += 1;
      continue;
    }

    if (mode !== "force_apply_all" && !safe) {
      entry.reason =
        item.reason ??
        `Rule "${item.ruleId}" is outside the apply_safe policy and remains pending for elevated review.`;
      entries.push(entry);
      skippedCount += 1;
      continue;
    }

    try {
      let currentStatus: GovernanceProposalStatus = item.proposalStatus;
      if (currentStatus === "pending") {
        const reviewed = await reviewGovernanceProposal({
          proposalId: item.proposalId,
          decision: "approve",
          decidedBy,
          decidedByType: "agent",
          ...(params.decisionNote ? { decisionNote: params.decisionNote } : {}),
          ...(params.now !== undefined ? { now: params.now + mutationOffset } : {}),
          ...(params.stateDir ? { stateDir: params.stateDir } : {}),
          ...(params.env ? { env: params.env } : {}),
        });
        mutationOffset += 1;
        currentStatus = reviewed.proposal.status;
        entry.autoApproved = true;
        reviewedCount += 1;
      }

      if (currentStatus === "approved") {
        const applied = await applyGovernanceProposal({
          proposalId: item.proposalId,
          appliedBy,
          appliedByType: "agent",
          ...(params.now !== undefined ? { now: params.now + mutationOffset } : {}),
          ...(params.stateDir ? { stateDir: params.stateDir } : {}),
          ...(params.env ? { env: params.env } : {}),
          ...(params.charterDir ? { charterDir: params.charterDir } : {}),
        });
        mutationOffset += 1;
        currentStatus = applied.proposal.status;
        entry.autoApplied = true;
        appliedCount += 1;
      } else if (currentStatus === "applied") {
        entry.reason = "Proposal was already applied before reconciliation.";
      } else if (currentStatus === "rejected") {
        entry.reason = "Proposal is rejected and cannot be auto-applied.";
      }

      entry.proposalStatusAfter = currentStatus;
      if (!entry.autoApproved && !entry.autoApplied && !entry.reason) {
        entry.reason = `Proposal remained ${currentStatus} after reconciliation.`;
      }
    } catch (error) {
      entry.proposalStatusAfter = entry.proposalStatusBefore;
      entry.reason = formatUnknownError(error);
      skippedCount += 1;
      entries.push(entry);
      continue;
    }

    if (!entry.autoApproved && !entry.autoApplied) {
      skippedCount += 1;
    }
    entries.push(entry);
  }

  return {
    observedAt: synthesized.observedAt,
    charterDir: synthesized.charterDir,
    requestedAgentIds: [...synthesized.requestedAgentIds],
    eligibleAgentIds: [...synthesized.eligibleAgentIds],
    findingIds: [...synthesized.findingIds],
    mode,
    synthesized,
    entries,
    reviewedCount,
    appliedCount,
    skippedCount,
  };
}
