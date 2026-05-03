import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { getRuntimeConfigSnapshot, loadConfig } from "../config/config.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { collectGovernanceCharterFindings, type SecurityAuditFinding } from "../security/audit.js";
import { isRecord } from "../utils.js";
import {
  CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH,
  planGovernanceCapabilityAssetRegistrySync,
} from "./capability-asset-registry.js";
import { getGovernanceCapabilityInventory } from "./capability-registry.js";
import { loadGovernanceCharter } from "./charter-runtime.js";
import {
  createGovernanceProposal,
  listGovernanceProposals,
  type GovernanceProposalOperation,
  type GovernanceProposalRecord,
} from "./proposals.js";

const AUTONOMY_GOVERNANCE_AGENT_IDS = [
  "founder",
  "strategist",
  "librarian",
  "sentinel",
  "archaeologist",
  "tdd_developer",
  "qa",
  "publisher",
  "executor",
  "algorithmist",
  "sovereignty_auditor",
] as const;
const GOVERNANCE_CHARTER_PREFIX = "governance/charter/";
const SOVEREIGNTY_AUDITOR_ARTIFACT_PATH =
  "governance/charter/agents/sovereignty-auditor.yaml";

type GovernanceProposalDraft = {
  ruleId: string;
  findingIds: string[];
  title: string;
  rationale: string;
  operations: GovernanceProposalOperation[];
};

export type GovernanceAutonomyProposalStatus = "created" | "existing" | "skipped";

export type GovernanceAutonomyProposalItem = {
  ruleId: string;
  findingIds: string[];
  title: string;
  status: GovernanceAutonomyProposalStatus;
  rationale?: string;
  operations: GovernanceProposalOperation[];
  dedupeKey: string;
  proposalId?: string;
  proposalStatus?: GovernanceProposalRecord["status"];
  reason?: string;
};

export type GovernanceAutonomyProposalSynthesisResult = {
  observedAt: number;
  charterDir: string;
  requestedAgentIds: string[];
  eligibleAgentIds: string[];
  findingIds: string[];
  results: GovernanceAutonomyProposalItem[];
  createdCount: number;
  existingCount: number;
  skippedCount: number;
};

function resolveRuntimeConfig(cfg?: ZhushouConfig): ZhushouConfig {
  return cfg ?? getRuntimeConfigSnapshot() ?? loadConfig();
}

function normalizeRequestedAgentIds(agentIds: string[] | undefined): string[] {
  if (!agentIds?.length) {
    return [...AUTONOMY_GOVERNANCE_AGENT_IDS];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of agentIds) {
    const agentId = normalizeAgentId(entry);
    if (seen.has(agentId)) {
      continue;
    }
    seen.add(agentId);
    normalized.push(agentId);
  }
  return normalized;
}

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function resolveEligibleGovernanceAgentIds(agentIds: string[]): string[] {
  const allowed = new Set<string>(AUTONOMY_GOVERNANCE_AGENT_IDS);
  return agentIds.filter((entry) => allowed.has(entry));
}

function resolveProposalAuthor(agentIds: string[], explicitAgentId?: string): string | undefined {
  const normalizedExplicit = normalizeOptionalString(explicitAgentId);
  if (normalizedExplicit) {
    return normalizeAgentId(normalizedExplicit);
  }
  if (agentIds.includes("founder")) {
    return "founder";
  }
  if (agentIds.includes("strategist")) {
    return "strategist";
  }
  if (agentIds.includes("librarian")) {
    return "librarian";
  }
  if (agentIds.includes("executor")) {
    return "executor";
  }
  return agentIds[0];
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringifyYaml(value: unknown): string {
  return `${YAML.stringify(value).trimEnd()}\n`;
}

function normalizeProposalWriteContentForDedupe(pathValue: string, content: string): string {
  const normalizedPath = pathValue.replace(/\\/gu, "/");
  if (normalizedPath !== CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH || !content.trim()) {
    return content;
  }
  try {
    const parsed = YAML.parse(content);
    if (!isRecord(parsed) || !isRecord(parsed.registry)) {
      return content;
    }
    const normalized = cloneRecord(parsed);
    if (isRecord(normalized.registry)) {
      normalized.registry.observedAt = 0;
    }
    return stringifyYaml(normalized);
  } catch {
    return content;
  }
}

function titleCaseId(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((entry) => entry.slice(0, 1).toUpperCase() + entry.slice(1))
    .join(" ");
}

function listExistingYamlArtifacts(params: {
  charterDir: string;
  subdir: string;
}): string[] {
  const dir = path.join(params.charterDir, params.subdir);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) =>
      path.posix.join("governance", "charter", params.subdir.replace(/\\/gu, "/"), entry.name),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

function buildConstitutionStub(params: {
  charterDir: string;
}): string {
  const policies = listExistingYamlArtifacts({
    charterDir: params.charterDir,
    subdir: "policies",
  });
  const coreAgents = listExistingYamlArtifacts({
    charterDir: params.charterDir,
    subdir: "agents",
  });
  const teams = listExistingYamlArtifacts({
    charterDir: params.charterDir,
    subdir: "evolution",
  });
  return stringifyYaml({
    version: 1,
    charter_id: "zhushou-constitution",
    title: "助手 Sovereign Constitution",
    status: "draft",
    sovereign_boundaries: {
      human_reserved_powers: [
        "charter_amendment",
        "root_privilege_expansion",
        "external_high_risk_network_opening",
      ],
    },
    charter_artifacts: {
      policies,
      core_agents: coreAgents,
      teams,
    },
  });
}

function buildSovereigntyPolicyStub(): string {
  return stringifyYaml({
    version: 1,
    reserved_authorities: {
      human_sovereign_only: [
        "charter_amendment",
        "root_privilege_expansion",
        "external_high_risk_network_opening",
      ],
    },
    automatic_enforcement: {
      on_high_or_critical_breach: [
        "freeze_mutating_subsystems",
        "raise_sovereignty_incident",
      ],
    },
  });
}

function buildEvolutionPolicyStub(): string {
  return stringifyYaml({
    version: 1,
    promotion_pipeline: {
      required_stages: [
        "proposal",
        "sandbox_validation",
        "qa_validation",
        "promotion_decision",
      ],
    },
  });
}

function buildAgentArtifactStub(agentId: string): string {
  const layer =
    agentId === "sovereignty-auditor"
      ? "governance"
      : agentId === "librarian"
        ? "capability"
        : agentId === "executor"
          ? "execution"
          : "evolution";
  return stringifyYaml({
    version: 1,
    agent: {
      id: agentId,
      title: titleCaseId(agentId),
      layer,
      status: "draft",
    },
    mission: {
      primary:
        agentId === "sovereignty-auditor"
          ? "Audit sovereign boundaries, mutation approvals, and automatic freeze posture."
          : `Define the governed operating contract for ${titleCaseId(agentId)}.`,
    },
  });
}

function buildTeamArtifactStub(teamId: string): string {
  return stringifyYaml({
    version: 1,
    team: {
      id: teamId.replace(/-/gu, "_"),
      title: titleCaseId(teamId),
      layer: "evolution",
      status: "draft",
    },
    members: [],
  });
}

function buildGenericCharterArtifactStub(relativePath: string): string {
  const normalized = relativePath.replace(/\\/gu, "/");
  if (normalized.startsWith("agents/")) {
    return buildAgentArtifactStub(path.posix.basename(normalized, ".yaml"));
  }
  if (normalized.startsWith("policies/")) {
    const policyId = path.posix.basename(normalized, ".yaml");
    if (policyId === "sovereignty") {
      return buildSovereigntyPolicyStub();
    }
    if (policyId === "evolution-policy") {
      return buildEvolutionPolicyStub();
    }
    return stringifyYaml({
      version: 1,
      policy: {
        id: policyId,
        status: "draft",
      },
    });
  }
  if (normalized.startsWith("evolution/")) {
    return buildTeamArtifactStub(path.posix.basename(normalized, ".yaml"));
  }
  if (normalized.endsWith(".yaml")) {
    return stringifyYaml({
      version: 1,
      status: "draft",
    });
  }
  return `# ${titleCaseId(path.posix.basename(normalized, path.posix.extname(normalized)))}\n\nDraft governed artifact.\n`;
}

function buildProposalDedupeKey(
  title: string,
  operations: GovernanceProposalOperation[],
): string {
  const normalizedOperations = [...operations]
    .map((operation) => ({
      kind: operation.kind,
      path: operation.path.replace(/\\/gu, "/"),
      ...(operation.kind === "write"
        ? {
            content: normalizeProposalWriteContentForDedupe(
              operation.path,
              operation.content ?? "",
            ),
          }
        : {}),
    }))
    .toSorted((left, right) => {
      const pathCompare = left.path.localeCompare(right.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      const kindCompare = left.kind.localeCompare(right.kind);
      if (kindCompare !== 0) {
        return kindCompare;
      }
      return (left.content ?? "").localeCompare(right.content ?? "");
    });
  return JSON.stringify({
    title: title.trim(),
    operations: normalizedOperations,
  });
}

function normalizeCharterRelativePath(artifactPath: string): string | undefined {
  const normalized = artifactPath.replace(/\\/gu, "/");
  if (!normalized.startsWith(GOVERNANCE_CHARTER_PREFIX)) {
    return undefined;
  }
  return normalized.slice(GOVERNANCE_CHARTER_PREFIX.length);
}

function ensureArtifactArray(
  charterArtifacts: Record<string, unknown>,
  group: string,
): string[] {
  const current = charterArtifacts[group];
  if (!Array.isArray(current)) {
    charterArtifacts[group] = [];
    return charterArtifacts[group] as string[];
  }
  const normalized = current
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  charterArtifacts[group] = normalized;
  return normalized;
}

function rewriteConstitutionArtifacts(params: {
  charterDir: string;
  mutate: (constitution: Record<string, unknown>) => boolean;
}): string | undefined {
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  const constitution = snapshot.constitution.data;
  if (!snapshot.constitution.exists || snapshot.constitution.parseError || !constitution) {
    return undefined;
  }
  const next = cloneRecord(constitution);
  const changed = params.mutate(next);
  if (!changed) {
    return undefined;
  }
  return stringifyYaml(next);
}

function buildRestoreMissingArtifactsDraft(
  missingArtifactPaths: string[],
): GovernanceProposalDraft | undefined {
  const charterMissing = missingArtifactPaths
    .map((entry) => normalizeCharterRelativePath(entry))
    .filter((entry): entry is string => Boolean(entry))
    .toSorted((left, right) => left.localeCompare(right));
  if (charterMissing.length === 0) {
    return undefined;
  }
  return {
    ruleId: "restore_missing_charter_artifacts",
    findingIds: ["governance.charter.artifact_missing"],
    title: "Restore missing governed charter artifacts",
    rationale:
      "The constitution references charter artifacts that are missing from governance/charter. Restore deterministic draft stubs so governance state is machine-readable again.",
    operations: charterMissing.map((relativePath) => ({
      kind: "write",
      path: relativePath,
      content: buildGenericCharterArtifactStub(relativePath),
    })),
  };
}

function buildConstitutionArtifactRegistryDraft(params: {
  charterDir: string;
  missingArtifactPaths: string[];
  pruneStaleArtifacts: boolean;
  attachSovereigntyAuditor: boolean;
}): GovernanceProposalDraft | undefined {
  const staleExternalArtifacts = params.missingArtifactPaths
    .filter((entry) => normalizeCharterRelativePath(entry) === undefined)
    .toSorted((left, right) => left.localeCompare(right));
  const constitutionContent = rewriteConstitutionArtifacts({
    charterDir: params.charterDir,
    mutate: (constitution) => {
      if (!isRecord(constitution.charter_artifacts)) {
        constitution.charter_artifacts = {};
      }
      if (!isRecord(constitution.charter_artifacts)) {
        return false;
      }
      let changed = false;
      if (params.pruneStaleArtifacts && staleExternalArtifacts.length > 0) {
        for (const [group, rawValue] of Object.entries(constitution.charter_artifacts)) {
          if (!Array.isArray(rawValue)) {
            continue;
          }
          const filtered = rawValue.filter(
            (entry): entry is string =>
              typeof entry === "string" && !staleExternalArtifacts.includes(entry),
          );
          if (filtered.length !== rawValue.length) {
            changed = true;
          }
          constitution.charter_artifacts[group] = filtered;
        }
      }
      if (params.attachSovereigntyAuditor) {
        const coreAgents = ensureArtifactArray(constitution.charter_artifacts, "core_agents");
        if (!coreAgents.includes(SOVEREIGNTY_AUDITOR_ARTIFACT_PATH)) {
          coreAgents.push(SOVEREIGNTY_AUDITOR_ARTIFACT_PATH);
          changed = true;
        }
      }
      return changed;
    },
  });
  if (!constitutionContent) {
    return undefined;
  }
  const operations: GovernanceProposalOperation[] = [
    {
      kind: "write",
      path: "constitution.yaml",
      content: constitutionContent,
    },
  ];
  if (
    params.attachSovereigntyAuditor &&
    (params.missingArtifactPaths.includes(SOVEREIGNTY_AUDITOR_ARTIFACT_PATH) ||
      !fs.existsSync(path.join(params.charterDir, "agents", "sovereignty-auditor.yaml")))
  ) {
    operations.push({
      kind: "write",
      path: "agents/sovereignty-auditor.yaml",
      content: buildAgentArtifactStub("sovereignty-auditor"),
    });
  }
  const findingIds: string[] = [];
  if (params.pruneStaleArtifacts && staleExternalArtifacts.length > 0) {
    findingIds.push("governance.charter.artifact_missing");
  }
  if (params.attachSovereigntyAuditor) {
    findingIds.push("governance.charter.freeze_without_auditor");
  }
  const title =
    params.attachSovereigntyAuditor && staleExternalArtifacts.length > 0
      ? "Repair constitution artifact registry and attach the sovereignty auditor"
      : params.attachSovereigntyAuditor
        ? "Attach sovereignty auditor artifact to the constitution"
        : "Prune stale charter artifact references outside governance/charter";
  const rationale =
    params.attachSovereigntyAuditor && staleExternalArtifacts.length > 0
      ? "The constitution both references missing external artifacts and lacks a bound sovereignty auditor. Repair the artifact registry in one pending governance amendment so later apply operations do not overwrite each other."
      : params.attachSovereigntyAuditor
        ? "Automatic freeze targets are active, but the constitution does not bind a sovereignty auditor artifact. Queue a governance amendment before autonomous freeze enforcement is trusted."
        : "The constitution references missing artifacts outside governance/charter. Remove stale references so the charter only tracks governed, resolvable assets.";
  return {
    ruleId:
      params.attachSovereigntyAuditor && staleExternalArtifacts.length > 0
        ? "repair_constitution_artifact_registry"
        : params.attachSovereigntyAuditor
          ? "attach_sovereignty_auditor"
          : "prune_stale_artifact_references",
    findingIds,
    title,
    rationale,
    operations,
  };
}

function buildDrafts(params: {
  charterDir: string;
  findings: SecurityAuditFinding[];
  missingArtifactPaths: string[];
}): {
  drafts: GovernanceProposalDraft[];
  skipped: GovernanceAutonomyProposalItem[];
} {
  const findingIds = new Set(params.findings.map((entry) => entry.checkId));
  const drafts: GovernanceProposalDraft[] = [];
  const skipped: GovernanceAutonomyProposalItem[] = [];
  const constitutionBlocked =
    findingIds.has("governance.charter.constitution_missing") ||
    findingIds.has("governance.charter.constitution_invalid");

  if (findingIds.has("governance.charter.constitution_missing")) {
    drafts.push({
      ruleId: "restore_constitution_missing",
      findingIds: ["governance.charter.constitution_missing"],
      title: "Restore missing governance constitution",
      rationale:
        "The governance/charter directory exists but the constitution is missing. Restore a deterministic draft constitution so the governance layer is machine-readable again.",
      operations: [
        {
          kind: "write",
          path: "constitution.yaml",
          content: buildConstitutionStub({
            charterDir: params.charterDir,
          }),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.constitution_invalid")) {
    drafts.push({
      ruleId: "restore_constitution_invalid",
      findingIds: ["governance.charter.constitution_invalid"],
      title: "Rewrite invalid governance constitution with a valid draft",
      rationale:
        "The constitution exists but is not parseable. Replace it with a valid draft so governance enforcement can recover.",
      operations: [
        {
          kind: "write",
          path: "constitution.yaml",
          content: buildConstitutionStub({
            charterDir: params.charterDir,
          }),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.sovereignty_policy_missing")) {
    drafts.push({
      ruleId: "restore_sovereignty_policy_missing",
      findingIds: ["governance.charter.sovereignty_policy_missing"],
      title: "Restore missing sovereignty policy",
      rationale:
        "The sovereignty policy is missing. Restore a deterministic draft so reserved powers remain machine-readable.",
      operations: [
        {
          kind: "write",
          path: "policies/sovereignty.yaml",
          content: buildSovereigntyPolicyStub(),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.sovereignty_policy_invalid")) {
    drafts.push({
      ruleId: "restore_sovereignty_policy_invalid",
      findingIds: ["governance.charter.sovereignty_policy_invalid"],
      title: "Rewrite invalid sovereignty policy with a valid draft",
      rationale:
        "The sovereignty policy is invalid. Replace it with a valid draft so sovereign boundaries can be enforced.",
      operations: [
        {
          kind: "write",
          path: "policies/sovereignty.yaml",
          content: buildSovereigntyPolicyStub(),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.evolution_policy_missing")) {
    drafts.push({
      ruleId: "restore_evolution_policy_missing",
      findingIds: ["governance.charter.evolution_policy_missing"],
      title: "Restore missing evolution policy",
      rationale:
        "The evolution policy is missing. Restore a deterministic draft so autonomous promotion remains policy-gated.",
      operations: [
        {
          kind: "write",
          path: "policies/evolution-policy.yaml",
          content: buildEvolutionPolicyStub(),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.evolution_policy_invalid")) {
    drafts.push({
      ruleId: "restore_evolution_policy_invalid",
      findingIds: ["governance.charter.evolution_policy_invalid"],
      title: "Rewrite invalid evolution policy with a valid draft",
      rationale:
        "The evolution policy is invalid. Replace it with a valid draft so autonomous evolution can recover its promotion contract.",
      operations: [
        {
          kind: "write",
          path: "policies/evolution-policy.yaml",
          content: buildEvolutionPolicyStub(),
        },
      ],
    });
  }

  if (findingIds.has("governance.charter.artifact_missing")) {
    if (constitutionBlocked) {
      skipped.push({
        ruleId: "artifact_missing_blocked_by_constitution",
        findingIds: ["governance.charter.artifact_missing"],
        title: "Defer artifact repair until the constitution is readable",
        status: "skipped",
        operations: [],
        dedupeKey: buildProposalDedupeKey(
          "Defer artifact repair until the constitution is readable",
          [],
        ),
        reason:
          "Artifact references are encoded in the constitution. Restore or rewrite the constitution first, then resynthesize artifact repair proposals.",
      });
    } else {
      const restoreDraft = buildRestoreMissingArtifactsDraft(params.missingArtifactPaths);
      if (restoreDraft) {
        drafts.push(restoreDraft);
      }
      const constitutionRegistryDraft = buildConstitutionArtifactRegistryDraft({
        charterDir: params.charterDir,
        missingArtifactPaths: params.missingArtifactPaths,
        pruneStaleArtifacts: true,
        attachSovereigntyAuditor: findingIds.has("governance.charter.freeze_without_auditor"),
      });
      if (constitutionRegistryDraft) {
        drafts.push(constitutionRegistryDraft);
      }
    }
  }

  if (findingIds.has("governance.charter.freeze_without_auditor")) {
    if (constitutionBlocked) {
      skipped.push({
        ruleId: "freeze_without_auditor_blocked_by_constitution",
        findingIds: ["governance.charter.freeze_without_auditor"],
        title: "Defer sovereignty auditor attachment until the constitution is readable",
        status: "skipped",
        operations: [],
        dedupeKey: buildProposalDedupeKey(
          "Defer sovereignty auditor attachment until the constitution is readable",
          [],
        ),
        reason:
          "The sovereignty auditor artifact must be attached by rewriting the constitution. Restore or rewrite the constitution first.",
      });
    } else if (!findingIds.has("governance.charter.artifact_missing")) {
      const attachDraft = buildConstitutionArtifactRegistryDraft({
        charterDir: params.charterDir,
        missingArtifactPaths: params.missingArtifactPaths,
        pruneStaleArtifacts: false,
        attachSovereigntyAuditor: true,
      });
      if (attachDraft) {
        drafts.push(attachDraft);
      }
    }
  }

  for (const finding of params.findings) {
    if (
      finding.checkId === "governance.sovereignty.network_boundary_opened" ||
      finding.checkId === "governance.sovereignty.exec_boundary_opened"
    ) {
      skipped.push({
        ruleId: `${finding.checkId}.manual_config_remediation`,
        findingIds: [finding.checkId],
        title: finding.title,
        status: "skipped",
        operations: [],
        dedupeKey: buildProposalDedupeKey(finding.title, []),
        reason:
          "This finding is caused by runtime configuration outside governance/charter. Queue a config remediation separately; the governance proposal synthesizer only mutates charter artifacts.",
      });
    }
  }

  return { drafts, skipped };
}

function buildCapabilityAssetRegistryDraft(params: {
  capabilityRegistrySync: ReturnType<typeof planGovernanceCapabilityAssetRegistrySync>;
  workspaceDirs?: string[];
}): GovernanceProposalDraft | undefined {
  const sync = params.capabilityRegistrySync;
  const hasExplicitWorkspaceScope =
    params.workspaceDirs?.some((entry) => entry.trim().length > 0) ?? false;
  if (!sync.snapshot.parseError && !hasExplicitWorkspaceScope) {
    return undefined;
  }
  if (!sync.hasChanges) {
    return undefined;
  }
  const findingIds = collectUniqueStrings([
    ...(sync.snapshot.parseError ? ["capability_inventory.asset_registry_invalid"] : []),
    ...(!sync.snapshot.exists && sync.assetCount > 0
      ? ["capability_inventory.asset_registry_missing"]
      : []),
    ...(sync.missingAssetIds.length > 0 ||
    sync.staleAssetIds.length > 0 ||
    sync.driftedAssetIds.length > 0
      ? ["capability_inventory.asset_registry_sync_required"]
      : []),
  ]);
  if (findingIds.length === 0) {
    return undefined;
  }
  const title = sync.snapshot.parseError
    ? "Rewrite invalid governed capability asset registry"
    : !sync.snapshot.exists
      ? "Bootstrap governed capability asset registry"
      : "Synchronize governed capability asset registry";
  const rationale = sync.snapshot.parseError
    ? "The governed capability asset registry exists but no longer parses. Rewrite it from the observed governed asset inventory so librarian registration remains machine-readable."
    : !sync.snapshot.exists
      ? "Governed capability assets were discovered without a charter registry. Bootstrap the librarian-owned registry before autonomous promotion, strategy recall, and algorithm rollback drift further."
      : "The governed capability asset registry drifted from the observed asset inventory. Rebuild the registry so promotion, indexing, strategy recall, and rollback reference the same asset set.";
  return {
    ruleId: sync.snapshot.parseError
      ? "rewrite_invalid_capability_asset_registry"
      : !sync.snapshot.exists
        ? "bootstrap_capability_asset_registry"
        : "synchronize_capability_asset_registry",
    findingIds,
    title,
    rationale,
    operations: [
      {
        kind: "write",
        path: CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH,
        content: stringifyYaml(sync.desiredRegistry),
      },
    ],
  };
}

function findExistingProposal(
  proposals: GovernanceProposalRecord[],
  dedupeKey: string,
): GovernanceProposalRecord | undefined {
  return proposals.find(
    (proposal) =>
      proposal.status !== "rejected" &&
      buildProposalDedupeKey(proposal.title, proposal.operations) === dedupeKey,
  );
}

export async function synthesizeGovernanceAutonomyProposals(params: {
  cfg?: ZhushouConfig;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
  agentIds?: string[];
  workspaceDirs?: string[];
  createdByAgentId?: string;
  createdBySessionKey?: string;
  now?: number;
} = {}): Promise<GovernanceAutonomyProposalSynthesisResult> {
  const cfg = resolveRuntimeConfig(params.cfg);
  const observedAt = params.now ?? Date.now();
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  const requestedAgentIds = normalizeRequestedAgentIds(params.agentIds);
  const eligibleAgentIds = resolveEligibleGovernanceAgentIds(requestedAgentIds);
  const findings = collectGovernanceCharterFindings({
    cfg,
    charterDir: params.charterDir,
  });

  if (!snapshot.discovered) {
    return {
      observedAt,
      charterDir: snapshot.charterDir,
      requestedAgentIds,
      eligibleAgentIds,
      findingIds: [],
      results: [],
      createdCount: 0,
      existingCount: 0,
      skippedCount: 0,
    };
  }

  const authorAgentId = resolveProposalAuthor(eligibleAgentIds, params.createdByAgentId);
  const existingProposalLedger = await listGovernanceProposals({
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const existingProposals = [...existingProposalLedger.proposals];
  const { drafts, skipped } = buildDrafts({
    charterDir: snapshot.charterDir,
    findings,
    missingArtifactPaths: [...snapshot.missingArtifactPaths],
  });
  const capabilityInventory = getGovernanceCapabilityInventory({
    cfg,
    charterDir: snapshot.charterDir,
    ...(params.workspaceDirs ? { workspaceDirs: params.workspaceDirs } : {}),
    observedAt,
  });
  const capabilityRegistryDraft = buildCapabilityAssetRegistryDraft({
    capabilityRegistrySync: planGovernanceCapabilityAssetRegistrySync({
      charterDir: snapshot.charterDir,
      observedAt,
      entries: capabilityInventory.entries,
    }),
    workspaceDirs: params.workspaceDirs,
  });
  if (capabilityRegistryDraft) {
    drafts.push(capabilityRegistryDraft);
  }

  const results: GovernanceAutonomyProposalItem[] = [...skipped];
  let createOffset = 0;
  for (const draft of drafts) {
    const dedupeKey = buildProposalDedupeKey(draft.title, draft.operations);
    const existing = findExistingProposal(existingProposals, dedupeKey);
    if (existing) {
      results.push({
        ruleId: draft.ruleId,
        findingIds: [...draft.findingIds],
        title: draft.title,
        status: "existing",
        rationale: draft.rationale,
        operations: draft.operations,
        dedupeKey,
        proposalId: existing.id,
        proposalStatus: existing.status,
        reason: `Existing ${existing.status} proposal already covers this governance mutation.`,
      });
      continue;
    }

    const created = await createGovernanceProposal({
      title: draft.title,
      rationale: draft.rationale,
      operations: draft.operations,
      ...(authorAgentId ? { createdByAgentId: authorAgentId } : {}),
      ...(params.createdBySessionKey ? { createdBySessionKey: params.createdBySessionKey } : {}),
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
      charterDir: snapshot.charterDir,
      ...(params.now !== undefined ? { now: params.now + createOffset } : {}),
    });
    createOffset += 1;
    existingProposals.push(created.proposal);
    results.push({
      ruleId: draft.ruleId,
      findingIds: [...draft.findingIds],
      title: draft.title,
      status: "created",
      rationale: draft.rationale,
      operations: draft.operations,
      dedupeKey,
      proposalId: created.proposal.id,
      proposalStatus: created.proposal.status,
    });
  }

  return {
    observedAt,
    charterDir: snapshot.charterDir,
    requestedAgentIds,
    eligibleAgentIds,
    findingIds: collectUniqueStrings([
      ...findings.map((entry) => entry.checkId),
      ...results.flatMap((entry) => entry.findingIds),
    ]),
    results,
    createdCount: results.filter((entry) => entry.status === "created").length,
    existingCount: results.filter((entry) => entry.status === "existing").length,
    skippedCount: results.filter((entry) => entry.status === "skipped").length,
  };
}
