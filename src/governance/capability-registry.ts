import path from "node:path";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { listAgentWorkspaceDirs } from "../agents/workspace-dirs.js";
import { getRuntimeConfigSnapshot, loadConfig } from "../config/config.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  createPluginActivationSource,
  normalizePluginsConfig,
  resolvePluginActivationState,
} from "../plugins/config-state.js";
import {
  loadPluginManifestRegistry,
  type PluginManifestRecord,
} from "../plugins/manifest-registry.js";
import { normalizeAgentId } from "../routing/session-key.js";
import {
  planGovernanceCapabilityAssetRegistrySync,
  type GovernanceCapabilityAssetRecord,
  type GovernanceCapabilityAssetRegistrySyncResult,
} from "./capability-asset-registry.js";
import {
  loadGovernanceCharterOrganization,
  type GovernanceCharterAgentBlueprint,
  type GovernanceCharterTeamBlueprint,
} from "./charter-agents.js";
import {
  loadGovernanceCharter,
  resolveGovernanceEnforcementState,
  type GovernanceEnforcementState,
} from "./charter-runtime.js";
import {
  resolveAgentGovernanceRuntimeContract,
  type AgentGovernanceRuntimeContract,
} from "./runtime-contract.js";

export type GovernanceCapabilityInventoryEntryKind =
  | "skill"
  | "plugin"
  | "memory"
  | "strategy"
  | "algorithm"
  | "agent_blueprint"
  | "team_blueprint";

export type GovernanceCapabilityInventoryEntryStatus = "ready" | "attention" | "blocked";

export type GovernanceCapabilityGapSeverity = "critical" | "warning" | "info";

export type GovernanceCapabilityInventoryEntryActivation = {
  enabled: boolean;
  activated: boolean;
  explicitlyEnabled: boolean;
  source: "disabled" | "explicit" | "auto" | "default";
  reason?: string;
};

export type GovernanceCapabilityInventoryEntry = {
  id: string;
  kind: GovernanceCapabilityInventoryEntryKind;
  status: GovernanceCapabilityInventoryEntryStatus;
  title: string;
  description?: string;
  layer?: string;
  ownerAgentId?: string;
  sourcePath?: string;
  workspaceDir?: string;
  origin?: string;
  activation?: GovernanceCapabilityInventoryEntryActivation;
  coverage: string[];
  dependencies: string[];
  issues: string[];
  installOptions: string[];
};

export type GovernanceCapabilityGap = {
  id: string;
  severity: GovernanceCapabilityGapSeverity;
  title: string;
  detail: string;
  ownerAgentId?: string;
  relatedEntryIds: string[];
  suggestedActions: string[];
};

export type GovernanceCapabilityInventorySummary = {
  totalEntries: number;
  skillCount: number;
  skillReady: number;
  skillAttention: number;
  skillBlocked: number;
  pluginCount: number;
  pluginActivated: number;
  pluginAttention: number;
  pluginBlocked: number;
  memoryCount?: number;
  memoryReady?: number;
  memoryAttention?: number;
  memoryBlocked?: number;
  strategyCount?: number;
  strategyReady?: number;
  strategyAttention?: number;
  strategyBlocked?: number;
  algorithmCount?: number;
  algorithmReady?: number;
  algorithmAttention?: number;
  algorithmBlocked?: number;
  agentBlueprintCount: number;
  teamBlueprintCount: number;
  autonomyProfileCount: number;
  genesisMemberCount: number;
  gapCount: number;
  criticalGapCount: number;
  warningGapCount: number;
  infoGapCount: number;
};

export type GovernanceCapabilityInventoryResult = {
  observedAt: number;
  charterDir: string;
  workspaceDirs: string[];
  requestedAgentIds: string[];
  summary: GovernanceCapabilityInventorySummary;
  entries: GovernanceCapabilityInventoryEntry[];
  gaps: GovernanceCapabilityGap[];
};

export type GovernanceGenesisPlanStageStatus = "ready" | "waiting" | "blocked";

export type GovernanceGenesisPlanMode = "repair" | "build" | "steady_state";

export type GovernanceGenesisPlanStage = {
  id: string;
  title: string;
  ownerAgentId: string;
  status: GovernanceGenesisPlanStageStatus;
  goal: string;
  dependsOn: string[];
  inputRefs: string[];
  outputRefs: string[];
  actions: string[];
  rationale?: string;
};

export type GovernanceGenesisProjectBlueprint = {
  projectId: string;
  ownerTeamId: string;
  mode: GovernanceGenesisPlanMode;
  targetMetric: string;
  candidateKinds: string[];
  requiredArtifacts: string[];
  qaGates: string[];
  promotionAuthorities: string[];
  rollbackPlan: string[];
};

export type GovernanceGenesisPlanResult = {
  observedAt: number;
  charterDir: string;
  workspaceDirs: string[];
  primaryWorkspaceDir?: string;
  requestedAgentIds: string[];
  teamId: string;
  teamTitle?: string;
  mode: GovernanceGenesisPlanMode;
  blockers: string[];
  focusGapIds: string[];
  stages: GovernanceGenesisPlanStage[];
  projectBlueprint?: GovernanceGenesisProjectBlueprint;
};

type PluginInventoryRecord = {
  plugin: PluginManifestRecord;
  activation: GovernanceCapabilityInventoryEntryActivation;
};

type PluginDiagnosticRecord = {
  level: "warn" | "error";
  pluginId?: string;
  source: string;
  message: string;
};

const AUTONOMY_CORE_AGENT_IDS = [
  "founder",
  "strategist",
  "algorithmist",
  "librarian",
  "sentinel",
  "archaeologist",
  "tdd_developer",
  "qa",
  "publisher",
  "executor",
  "sovereignty_auditor",
] as const;
const DEFAULT_GENESIS_TEAM_ID = "genesis_team";
const GENESIS_STAGE_ORDER = [
  "gap_detection",
  "root_cause_analysis",
  "implementation",
  "qa_and_replay",
  "promotion_or_rollback",
  "registration",
] as const;
const GENESIS_REQUIRED_ROLES = [
  "sentinel",
  "archaeologist",
  "tdd_developer",
  "qa",
  "publisher",
  "librarian",
] as const;

function resolveRuntimeConfig(cfg?: OpenClawConfig): OpenClawConfig {
  return cfg ?? getRuntimeConfigSnapshot() ?? loadConfig();
}

function normalizeRequestedAgentIds(agentIds?: string[]): string[] {
  return Array.from(
    new Set((agentIds ?? []).map((entry) => normalizeAgentId(entry)).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function sortEntry(
  left: GovernanceCapabilityInventoryEntry,
  right: GovernanceCapabilityInventoryEntry,
): number {
  const kindOrder: GovernanceCapabilityInventoryEntryKind[] = [
    "skill",
    "plugin",
    "memory",
    "strategy",
    "algorithm",
    "agent_blueprint",
    "team_blueprint",
  ];
  const statusOrder: GovernanceCapabilityInventoryEntryStatus[] = ["blocked", "attention", "ready"];
  const kindDelta = kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind);
  if (kindDelta !== 0) {
    return kindDelta;
  }
  const statusDelta = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }
  return left.id.localeCompare(right.id);
}

function sortGapSeverity(
  left: GovernanceCapabilityGapSeverity,
  right: GovernanceCapabilityGapSeverity,
) {
  const order: GovernanceCapabilityGapSeverity[] = ["critical", "warning", "info"];
  return order.indexOf(left) - order.indexOf(right);
}

function listObservedWorkspaceDirs(cfg: OpenClawConfig, explicit?: string[]): string[] {
  const candidates = explicit?.length ? explicit : listAgentWorkspaceDirs(cfg);
  return Array.from(new Set(candidates.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function resolveRepoRootFromCharterDir(charterDir: string): string {
  return path.resolve(charterDir, "..", "..");
}

function listCapabilitySkillWorkspaceDirs(params: {
  cfg: OpenClawConfig;
  charterDir: string;
  explicit?: string[];
}): string[] {
  const workspaceDirs = listObservedWorkspaceDirs(params.cfg, params.explicit);
  if (params.explicit?.length) {
    return workspaceDirs;
  }
  const repoRoot = resolveRepoRootFromCharterDir(params.charterDir);
  return Array.from(new Set([repoRoot, ...workspaceDirs].filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function createSkillEntryId(workspaceDir: string, skillKey: string): string {
  return `skill:${workspaceDir}:${skillKey}`;
}

function createPluginEntryId(plugin: PluginManifestRecord): string {
  return ["plugin", plugin.origin, plugin.id, plugin.workspaceDir ?? "", plugin.rootDir].join(":");
}

function createMemoryEntryId(memoryId: string): string {
  return `memory:${normalizeAgentId(memoryId)}`;
}

function createStrategyEntryId(strategyId: string): string {
  return `strategy:${normalizeAgentId(strategyId)}`;
}

function createAlgorithmEntryId(algorithmId: string): string {
  return `algorithm:${normalizeAgentId(algorithmId)}`;
}

function createAgentBlueprintEntryId(agentId: string): string {
  return `agent_blueprint:${normalizeAgentId(agentId)}`;
}

function createTeamBlueprintEntryId(teamId: string): string {
  return `team_blueprint:${normalizeAgentId(teamId)}`;
}

function collectEntryScopeAgentIds(entry: GovernanceCapabilityInventoryEntry): string[] {
  if (entry.kind === "agent_blueprint") {
    return collectUniqueStrings([entry.ownerAgentId ? normalizeAgentId(entry.ownerAgentId) : ""]);
  }
  if (entry.kind === "team_blueprint") {
    return collectUniqueStrings([
      entry.ownerAgentId ? normalizeAgentId(entry.ownerAgentId) : "",
      ...entry.coverage.map((value) =>
        value.startsWith("member:") ? normalizeAgentId(value.slice("member:".length)) : "",
      ),
    ]);
  }
  return collectUniqueStrings([entry.ownerAgentId ? normalizeAgentId(entry.ownerAgentId) : ""]);
}

function filterInventoryEntriesByRequestedAgents(params: {
  entries: GovernanceCapabilityInventoryEntry[];
  requestedAgentIds: string[];
}): GovernanceCapabilityInventoryEntry[] {
  if (params.requestedAgentIds.length === 0) {
    return params.entries;
  }
  const requestedAgentIds = new Set(params.requestedAgentIds);
  return params.entries.filter((entry) => {
    if (entry.kind === "skill" || entry.kind === "plugin") {
      return true;
    }
    return collectEntryScopeAgentIds(entry).some((agentId) => requestedAgentIds.has(agentId));
  });
}

function resolveGenesisMissingRoles(params: {
  genesisTeam?: GovernanceCharterTeamBlueprint;
  knownAgentIds: Set<string>;
}): {
  missingBlueprintRoles: string[];
  missingTeamRoles: string[];
  missingRoles: string[];
} {
  const teamMembers = new Set(
    (params.genesisTeam?.members ?? []).map((entry) => normalizeAgentId(entry)),
  );
  const missingBlueprintRoles = Array.from(new Set(GENESIS_REQUIRED_ROLES)).filter(
    (entry) => !params.knownAgentIds.has(entry),
  );
  const missingTeamRoles = params.genesisTeam
    ? Array.from(new Set(GENESIS_REQUIRED_ROLES)).filter((entry) => !teamMembers.has(entry))
    : [];
  return {
    missingBlueprintRoles,
    missingTeamRoles,
    missingRoles: collectUniqueStrings([...missingBlueprintRoles, ...missingTeamRoles]),
  };
}

function prioritizeGapsForRequestedAgents(params: {
  gaps: GovernanceCapabilityGap[];
  entries: GovernanceCapabilityInventoryEntry[];
  requestedAgentIds: string[];
}): GovernanceCapabilityGap[] {
  if (params.requestedAgentIds.length === 0) {
    return params.gaps;
  }
  const requestedAgentIds = new Set(params.requestedAgentIds);
  const visibleEntryIds = new Set(params.entries.map((entry) => entry.id));
  const scoreGap = (gap: GovernanceCapabilityGap) => {
    if (gap.relatedEntryIds.some((entryId) => visibleEntryIds.has(entryId))) {
      return 0;
    }
    if (gap.ownerAgentId && requestedAgentIds.has(normalizeAgentId(gap.ownerAgentId))) {
      return 1;
    }
    if (gap.relatedEntryIds.length === 0) {
      return 2;
    }
    return 3;
  };
  return params.gaps.toSorted((left, right) => {
    const scoreDelta = scoreGap(left) - scoreGap(right);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    const severityDelta = sortGapSeverity(left.severity, right.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return left.id.localeCompare(right.id);
  });
}

function mapSkillEntry(params: {
  workspaceDir: string;
  skill: ReturnType<typeof buildWorkspaceSkillStatus>["skills"][number];
}): GovernanceCapabilityInventoryEntry {
  const issues = collectUniqueStrings([
    ...(params.skill.disabled ? ["disabled in config"] : []),
    ...(params.skill.blockedByAllowlist ? ["blocked by allowlist"] : []),
    ...params.skill.missing.bins.map((entry) => `missing binary: ${entry}`),
    ...params.skill.missing.env.map((entry) => `missing env: ${entry}`),
    ...params.skill.missing.config.map((entry) => `missing config: ${entry}`),
    ...params.skill.missing.os.map((entry) => `unsupported os: ${entry}`),
  ]);
  const status: GovernanceCapabilityInventoryEntryStatus = params.skill.eligible
    ? "ready"
    : params.skill.disabled || params.skill.blockedByAllowlist
      ? "blocked"
      : "attention";

  return {
    id: createSkillEntryId(params.workspaceDir, params.skill.skillKey),
    kind: "skill",
    status,
    title: params.skill.name,
    description: params.skill.description,
    ownerAgentId: "librarian",
    sourcePath: params.skill.filePath,
    workspaceDir: params.workspaceDir,
    coverage: collectUniqueStrings([
      `skill_key:${params.skill.skillKey}`,
      `source:${params.skill.source}`,
      ...(params.skill.bundled ? ["bundled"] : []),
      ...(params.skill.primaryEnv ? [`primary_env:${params.skill.primaryEnv}`] : []),
    ]),
    dependencies: collectUniqueStrings([
      ...params.skill.requirements.bins.map((entry) => `bin:${entry}`),
      ...params.skill.requirements.env.map((entry) => `env:${entry}`),
      ...params.skill.requirements.config.map((entry) => `config:${entry}`),
      ...params.skill.requirements.os.map((entry) => `os:${entry}`),
    ]),
    issues,
    installOptions: params.skill.install.map((entry) => entry.label),
  };
}

function toActivationRecord(
  plugin: PluginManifestRecord,
  contract: ReturnType<typeof resolvePluginActivationState>,
): GovernanceCapabilityInventoryEntryActivation {
  return {
    enabled: contract.enabled,
    activated: contract.activated,
    explicitlyEnabled: contract.explicitlyEnabled,
    source: contract.source,
    ...(contract.reason ? { reason: contract.reason } : {}),
  };
}

function collectPluginCoverage(plugin: PluginManifestRecord): string[] {
  return collectUniqueStrings([
    ...plugin.skills.map((entry) => `skill:${entry}`),
    ...plugin.channels.map((entry) => `channel:${entry}`),
    ...plugin.providers.map((entry) => `provider:${entry}`),
    ...plugin.cliBackends.map((entry) => `backend:${entry}`),
    ...(plugin.contracts?.tools ?? []).map((entry) => `tool:${entry}`),
    ...(plugin.contracts?.speechProviders ?? []).map((entry) => `speech:${entry}`),
    ...(plugin.contracts?.webFetchProviders ?? []).map((entry) => `web_fetch:${entry}`),
    ...(plugin.contracts?.webSearchProviders ?? []).map((entry) => `web_search:${entry}`),
    ...(plugin.contracts?.imageGenerationProviders ?? []).map((entry) => `image:${entry}`),
    ...(plugin.contracts?.videoGenerationProviders ?? []).map((entry) => `video:${entry}`),
    ...(plugin.contracts?.musicGenerationProviders ?? []).map((entry) => `music:${entry}`),
    ...(plugin.contracts?.memoryEmbeddingProviders ?? []).map((entry) => `memory:${entry}`),
    ...(plugin.contracts?.mediaUnderstandingProviders ?? []).map((entry) => `media:${entry}`),
    ...(plugin.contracts?.realtimeVoiceProviders ?? []).map((entry) => `rt_voice:${entry}`),
    ...(plugin.contracts?.realtimeTranscriptionProviders ?? []).map(
      (entry) => `rt_transcription:${entry}`,
    ),
  ]);
}

function collectPluginDependencies(plugin: PluginManifestRecord): string[] {
  return collectUniqueStrings([
    ...(plugin.activation?.onProviders ?? []).map((entry) => `provider:${entry}`),
    ...(plugin.activation?.onCommands ?? []).map((entry) => `command:${entry}`),
    ...(plugin.activation?.onChannels ?? []).map((entry) => `channel:${entry}`),
    ...(plugin.activation?.onRoutes ?? []).map((entry) => `route:${entry}`),
    ...(plugin.activation?.onAgentHarnesses ?? []).map((entry) => `harness:${entry}`),
    ...(plugin.activation?.onCapabilities ?? []).map((entry) => `capability:${entry}`),
  ]);
}

function mapPluginEntry(record: PluginInventoryRecord): GovernanceCapabilityInventoryEntry {
  const issues = collectUniqueStrings(
    !record.activation.activated && record.activation.reason ? [record.activation.reason] : [],
  );
  const status: GovernanceCapabilityInventoryEntryStatus = record.activation.activated
    ? "ready"
    : record.activation.source === "disabled"
      ? "blocked"
      : "attention";

  return {
    id: createPluginEntryId(record.plugin),
    kind: "plugin",
    status,
    title: record.plugin.name ?? record.plugin.id,
    ...(record.plugin.description ? { description: record.plugin.description } : {}),
    ownerAgentId: "librarian",
    sourcePath: record.plugin.manifestPath,
    ...(record.plugin.workspaceDir ? { workspaceDir: record.plugin.workspaceDir } : {}),
    origin: record.plugin.origin,
    activation: record.activation,
    coverage: collectPluginCoverage(record.plugin),
    dependencies: collectPluginDependencies(record.plugin),
    issues,
    installOptions: [],
  };
}

function mapAgentBlueprintEntry(params: {
  blueprint: GovernanceCharterAgentBlueprint;
  contract: AgentGovernanceRuntimeContract;
}): GovernanceCapabilityInventoryEntry {
  const issues = collectUniqueStrings([
    ...(params.blueprint.status?.toLowerCase() === "draft" ? ["charter status: draft"] : []),
    ...(params.blueprint.runtimeHooks.length === 0 ? ["no runtime hooks declared"] : []),
    ...(!params.blueprint.contractValid ? params.blueprint.contractIssues : []),
  ]);
  const status: GovernanceCapabilityInventoryEntryStatus = !params.blueprint.contractValid
    ? "blocked"
    : issues.length === 0
      ? "ready"
      : "attention";
  return {
    id: createAgentBlueprintEntryId(params.blueprint.id),
    kind: "agent_blueprint",
    status,
    title: params.blueprint.title ?? params.blueprint.id,
    ...(params.blueprint.missionPrimary ? { description: params.blueprint.missionPrimary } : {}),
    ...(params.blueprint.layer ? { layer: params.blueprint.layer } : {}),
    ownerAgentId: params.blueprint.id,
    sourcePath: params.blueprint.sourcePath,
    coverage: collectUniqueStrings([
      ...params.blueprint.runtimeHooks.map((entry) => `hook:${entry}`),
      ...params.contract.collaborators.map((entry) => `collaborator:${entry}`),
      ...params.contract.mutationAllow.map((entry) => `allow:${entry}`),
      ...(params.contract.writeScope ?? []).map((entry) => `write:${entry}`),
    ]),
    dependencies: collectUniqueStrings([
      ...params.contract.reportsTo.map((entry) => `reports_to:${entry}`),
      ...params.blueprint.worksWith.map((entry) => `works_with:${entry}`),
    ]),
    issues,
    installOptions: [],
  };
}

function mapTeamBlueprintEntry(params: {
  blueprint: GovernanceCharterTeamBlueprint;
  knownAgentIds: Set<string>;
}): GovernanceCapabilityInventoryEntry {
  const missingMembers = params.blueprint.members.filter(
    (entry) => !params.knownAgentIds.has(entry),
  );
  const issues = collectUniqueStrings([
    ...(params.blueprint.status?.toLowerCase() === "draft" ? ["team status: draft"] : []),
    ...missingMembers.map((entry) => `missing member blueprint: ${entry}`),
  ]);
  const status: GovernanceCapabilityInventoryEntryStatus =
    missingMembers.length > 0 ? "blocked" : issues.length > 0 ? "attention" : "ready";

  return {
    id: createTeamBlueprintEntryId(params.blueprint.id),
    kind: "team_blueprint",
    status,
    title: params.blueprint.title ?? params.blueprint.id,
    ...(params.blueprint.layer ? { layer: params.blueprint.layer } : {}),
    ownerAgentId: "founder",
    sourcePath: params.blueprint.sourcePath,
    coverage: collectUniqueStrings(params.blueprint.members.map((entry) => `member:${entry}`)),
    dependencies: [],
    issues,
    installOptions: [],
  };
}

function mapMemoryEntry(params: {
  id: string;
  title: string;
  status: GovernanceCapabilityInventoryEntryStatus;
  ownerAgentId: string;
  sourcePath: string;
  description?: string;
  layer?: string;
  coverage?: string[];
  dependencies?: string[];
  issues?: string[];
}): GovernanceCapabilityInventoryEntry {
  return {
    id: createMemoryEntryId(params.id),
    kind: "memory",
    status: params.status,
    title: params.title,
    ...(params.description ? { description: params.description } : {}),
    ...(params.layer ? { layer: params.layer } : {}),
    ownerAgentId: params.ownerAgentId,
    sourcePath: params.sourcePath,
    coverage: collectUniqueStrings(params.coverage ?? []),
    dependencies: collectUniqueStrings(params.dependencies ?? []),
    issues: collectUniqueStrings(params.issues ?? []),
    installOptions: [],
  };
}

function mapStrategyEntry(params: {
  id: string;
  title: string;
  status: GovernanceCapabilityInventoryEntryStatus;
  ownerAgentId: string;
  sourcePath: string;
  description?: string;
  layer?: string;
  coverage?: string[];
  dependencies?: string[];
  issues?: string[];
}): GovernanceCapabilityInventoryEntry {
  return {
    id: createStrategyEntryId(params.id),
    kind: "strategy",
    status: params.status,
    title: params.title,
    ...(params.description ? { description: params.description } : {}),
    ...(params.layer ? { layer: params.layer } : {}),
    ownerAgentId: params.ownerAgentId,
    sourcePath: params.sourcePath,
    coverage: collectUniqueStrings(params.coverage ?? []),
    dependencies: collectUniqueStrings(params.dependencies ?? []),
    issues: collectUniqueStrings(params.issues ?? []),
    installOptions: [],
  };
}

function mapAlgorithmEntry(params: {
  id: string;
  title: string;
  status: GovernanceCapabilityInventoryEntryStatus;
  ownerAgentId: string;
  sourcePath: string;
  description?: string;
  layer?: string;
  coverage?: string[];
  dependencies?: string[];
  issues?: string[];
}): GovernanceCapabilityInventoryEntry {
  return {
    id: createAlgorithmEntryId(params.id),
    kind: "algorithm",
    status: params.status,
    title: params.title,
    ...(params.description ? { description: params.description } : {}),
    ...(params.layer ? { layer: params.layer } : {}),
    ownerAgentId: params.ownerAgentId,
    sourcePath: params.sourcePath,
    coverage: collectUniqueStrings(params.coverage ?? []),
    dependencies: collectUniqueStrings(params.dependencies ?? []),
    issues: collectUniqueStrings(params.issues ?? []),
    installOptions: [],
  };
}

function isSupplementalRegisteredAsset(
  asset: GovernanceCapabilityAssetRecord,
): asset is GovernanceCapabilityAssetRecord & {
  kind: "memory" | "strategy" | "algorithm";
} {
  return asset.kind === "memory" || asset.kind === "strategy" || asset.kind === "algorithm";
}

function mapRegisteredGovernedAssetEntry(
  asset: GovernanceCapabilityAssetRecord,
): GovernanceCapabilityInventoryEntry | undefined {
  if (!isSupplementalRegisteredAsset(asset)) {
    return undefined;
  }
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    title: asset.title,
    ...(asset.description ? { description: asset.description } : {}),
    ...(asset.layer ? { layer: asset.layer } : {}),
    ...(asset.ownerAgentId ? { ownerAgentId: asset.ownerAgentId } : {}),
    ...(asset.sourcePath ? { sourcePath: asset.sourcePath } : {}),
    ...(asset.workspaceDir ? { workspaceDir: asset.workspaceDir } : {}),
    ...(asset.origin ? { origin: asset.origin } : {}),
    ...(asset.activation ? { activation: asset.activation } : {}),
    coverage: collectUniqueStrings(asset.coverage),
    dependencies: collectUniqueStrings(asset.dependencies),
    issues: collectUniqueStrings(asset.issues),
    installOptions: collectUniqueStrings(asset.installOptions),
  };
}

function buildRegisteredGovernedAssetEntries(params: {
  assetRegistrySync: GovernanceCapabilityAssetRegistrySyncResult;
  existingEntryIds: Set<string>;
}): GovernanceCapabilityInventoryEntry[] {
  return (params.assetRegistrySync.snapshot.registry?.assets ?? [])
    .map((asset) => mapRegisteredGovernedAssetEntry(asset))
    .filter((entry): entry is GovernanceCapabilityInventoryEntry =>
      Boolean(entry && !params.existingEntryIds.has(entry.id)),
    );
}

function buildDerivedGovernedAssetEntries(params: {
  charterDir: string;
  knownAgentIds: Set<string>;
  genesisTeam?: GovernanceCharterTeamBlueprint;
  assetRegistrySync: GovernanceCapabilityAssetRegistrySyncResult;
  enforcement: GovernanceEnforcementState;
}): GovernanceCapabilityInventoryEntry[] {
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  if (!snapshot.discovered) {
    return [];
  }
  const { missingRoles, missingBlueprintRoles, missingTeamRoles } = resolveGenesisMissingRoles({
    genesisTeam: params.genesisTeam,
    knownAgentIds: params.knownAgentIds,
  });
  const assetRegistryIssues = collectUniqueStrings(
    params.assetRegistrySync.snapshot.parseError
      ? [params.assetRegistrySync.snapshot.parseError]
      : [],
  );
  const assetRegistryStatus: GovernanceCapabilityInventoryEntryStatus = params.assetRegistrySync
    .snapshot.parseError
    ? "blocked"
    : "ready";
  const evolutionPolicyStatus: GovernanceCapabilityInventoryEntryStatus = !snapshot.evolutionPolicy
    .exists
    ? "blocked"
    : snapshot.evolutionPolicy.parseError
      ? "attention"
      : "ready";
  const genesisStrategyIssues = collectUniqueStrings([
    ...(missingBlueprintRoles.length > 0
      ? [`missing charter blueprints: ${missingBlueprintRoles.join(", ")}`]
      : []),
    ...(missingTeamRoles.length > 0
      ? [`missing genesis team members: ${missingTeamRoles.join(", ")}`]
      : []),
  ]);
  const genesisStrategyStatus: GovernanceCapabilityInventoryEntryStatus = !params.genesisTeam
    ? "blocked"
    : missingRoles.length > 0
      ? "attention"
      : params.genesisTeam.status?.toLowerCase() === "draft"
        ? "attention"
        : "ready";
  const sandboxAlgorithmIssues = collectUniqueStrings(
    params.enforcement.active
      ? [params.enforcement.message ?? "governance freeze blocks sandbox promotion"]
      : [],
  );
  const sandboxAlgorithmStatus: GovernanceCapabilityInventoryEntryStatus = params.enforcement.active
    ? "attention"
    : "ready";
  const executorAlgorithmStatus: GovernanceCapabilityInventoryEntryStatus =
    params.knownAgentIds.has("executor") ? "ready" : "blocked";

  return [
    mapMemoryEntry({
      id: "organizational_charter",
      title: "Organizational Charter Memory",
      status:
        !snapshot.constitution.exists || snapshot.constitution.parseError ? "blocked" : "ready",
      ownerAgentId: "founder",
      sourcePath: "constitution.yaml",
      description:
        "Persistent institutional memory for sovereign boundaries, charter artifacts, and role blueprints.",
      layer: "governance",
      coverage: ["memory:charter", "memory:sovereign_boundaries", "memory:artifact_registry"],
      dependencies: ["policy:sovereignty", "policy:evolution"],
      issues: collectUniqueStrings([
        ...(snapshot.constitution.exists ? [] : ["constitution missing"]),
        ...(snapshot.constitution.parseError ? [snapshot.constitution.parseError] : []),
      ]),
    }),
    mapMemoryEntry({
      id: "capability_asset_registry",
      title: "Capability Asset Registry Memory",
      status: assetRegistryStatus,
      ownerAgentId: "librarian",
      sourcePath: "capability/asset-registry.yaml",
      description:
        "Persistent governed memory for capability assets, coverage metadata, and rollback references.",
      layer: "capability",
      coverage: ["memory:capability_assets", "memory:coverage", "memory:rollback_reference"],
      dependencies: ["librarian", "governance/charter/capability"],
      issues: assetRegistryIssues,
    }),
    mapStrategyEntry({
      id: "evolution_policy",
      title: "Evolution Promotion Strategy",
      status: evolutionPolicyStatus,
      ownerAgentId: "strategist",
      sourcePath: "policies/evolution-policy.yaml",
      description:
        "Governed strategy contract for promotion stages, validation order, and evolution pacing.",
      layer: "evolution",
      coverage: [
        "strategy:promotion_pipeline",
        "strategy:sandbox_validation",
        "strategy:promotion_decision",
      ],
      dependencies: ["founder", "strategist", "genesis_team"],
      issues: collectUniqueStrings([
        ...(snapshot.evolutionPolicy.exists ? [] : ["evolution policy missing"]),
        ...(snapshot.evolutionPolicy.parseError ? [snapshot.evolutionPolicy.parseError] : []),
      ]),
    }),
    mapStrategyEntry({
      id: "genesis_handoff",
      title: "Genesis Team Handoff Strategy",
      status: genesisStrategyStatus,
      ownerAgentId: "strategist",
      sourcePath: params.genesisTeam?.sourcePath ?? "evolution/genesis-team.yaml",
      description:
        "Stage-by-stage handoff strategy for governed capability creation, validation, promotion, and registration.",
      layer: "evolution",
      coverage: [
        "strategy:genesis_handoffs",
        "strategy:gap_detection",
        "strategy:promotion_or_rollback",
      ],
      dependencies: collectUniqueStrings([
        "team:genesis_team",
        ...GENESIS_REQUIRED_ROLES.map((role) => `agent:${role}`),
      ]),
      issues: genesisStrategyIssues,
    }),
    mapAlgorithmEntry({
      id: "executor_dispatch_runtime",
      title: "Executor Dispatch Algorithm",
      status: executorAlgorithmStatus,
      ownerAgentId: "executor",
      sourcePath: "src/plugins/runtime/runtime-autonomy.ts",
      description:
        "Structured execution algorithm for goal intake, task decomposition, capability selection, escalation, and delivery.",
      layer: "execution",
      coverage: [
        "algorithm:task_graph",
        "algorithm:execution_plan",
        "algorithm:capability_request",
      ],
      dependencies: ["agent:executor", "team:genesis_team", "memory:capability_asset_registry"],
      issues: collectUniqueStrings(
        executorAlgorithmStatus === "blocked" ? ["executor blueprint missing"] : [],
      ),
    }),
    mapAlgorithmEntry({
      id: "sandbox_universe_control",
      title: "Sandbox Universe Control Algorithm",
      status: sandboxAlgorithmStatus,
      ownerAgentId: "publisher",
      sourcePath: "src/governance/sandbox-universe.ts",
      description:
        "Governed sandbox algorithm for replay planning, promotion gating, and rollback-aware experiment control.",
      layer: "governance",
      coverage: [
        "algorithm:sandbox_controller",
        "algorithm:replay_runner",
        "algorithm:promotion_gate",
      ],
      dependencies: [
        "strategy:evolution_policy",
        "memory:organizational_charter",
        "memory:capability_asset_registry",
      ],
      issues: sandboxAlgorithmIssues,
    }),
  ];
}

function collectPluginInventory(params: { cfg: OpenClawConfig; workspaceDirs: string[] }): {
  plugins: PluginInventoryRecord[];
  diagnostics: PluginDiagnosticRecord[];
} {
  const normalizedPlugins = normalizePluginsConfig(params.cfg.plugins);
  const activationSource = createPluginActivationSource({
    config: params.cfg,
    plugins: normalizedPlugins,
  });
  const registryKeys = params.workspaceDirs.length > 0 ? params.workspaceDirs : [undefined];
  const records = new Map<string, PluginInventoryRecord>();
  const diagnostics = new Map<string, PluginDiagnosticRecord>();

  for (const workspaceDir of registryKeys) {
    const registry = loadPluginManifestRegistry({
      config: params.cfg,
      ...(workspaceDir ? { workspaceDir } : {}),
    });
    for (const diagnostic of registry.diagnostics) {
      const level =
        diagnostic.level === "error" || diagnostic.level === "warn" ? diagnostic.level : "warn";
      const source = diagnostic.source ?? workspaceDir ?? "plugin-registry";
      const key = [level, diagnostic.pluginId ?? "", source, diagnostic.message].join(":");
      if (!diagnostics.has(key)) {
        diagnostics.set(key, {
          level,
          ...(diagnostic.pluginId ? { pluginId: diagnostic.pluginId } : {}),
          source,
          message: diagnostic.message,
        });
      }
    }
    for (const plugin of registry.plugins) {
      const key = [plugin.id, plugin.origin, plugin.rootDir, plugin.workspaceDir ?? ""].join(":");
      if (records.has(key)) {
        continue;
      }
      const activation = toActivationRecord(
        plugin,
        resolvePluginActivationState({
          id: plugin.id,
          origin: plugin.origin,
          config: normalizedPlugins,
          rootConfig: params.cfg,
          enabledByDefault: plugin.enabledByDefault,
          activationSource,
        }),
      );
      records.set(key, {
        plugin,
        activation,
      });
    }
  }

  return {
    plugins: Array.from(records.values()).toSorted((left, right) =>
      left.plugin.id.localeCompare(right.plugin.id),
    ),
    diagnostics: Array.from(diagnostics.values()).toSorted((left, right) =>
      `${left.pluginId ?? ""}:${left.source}`.localeCompare(
        `${right.pluginId ?? ""}:${right.source}`,
      ),
    ),
  };
}

function buildInventoryGaps(params: {
  requestedAgentIds: string[];
  entries: GovernanceCapabilityInventoryEntry[];
  enforcement: GovernanceEnforcementState;
  pluginDiagnostics: PluginDiagnosticRecord[];
  autonomyProfileCount: number;
  genesisTeam?: GovernanceCharterTeamBlueprint;
  knownAgentIds: Set<string>;
  assetRegistrySync: GovernanceCapabilityAssetRegistrySyncResult;
}): GovernanceCapabilityGap[] {
  const gaps: GovernanceCapabilityGap[] = [];
  const visibleEntryIds = new Set(params.entries.map((entry) => entry.id));
  const entryIdsByKind = (
    kind: GovernanceCapabilityInventoryEntryKind,
    predicate?: (entry: GovernanceCapabilityInventoryEntry) => boolean,
  ) =>
    params.entries
      .filter((entry) => entry.kind === kind && (!predicate || predicate(entry)))
      .map((entry) => entry.id);
  const scopeRelatedEntryIds = (entryIds: string[]) =>
    entryIds.filter((entryId) => visibleEntryIds.has(entryId));

  const unknownRequestedAgentIds = params.requestedAgentIds.filter(
    (entry) => !params.knownAgentIds.has(entry),
  );
  if (unknownRequestedAgentIds.length > 0) {
    gaps.push({
      id: "capability_inventory.unknown_requested_agents",
      severity: "warning",
      title: "Requested autonomy focus includes unknown agent blueprints",
      detail: `Unknown charter agents: ${unknownRequestedAgentIds.join(", ")}.`,
      ownerAgentId: "founder",
      relatedEntryIds: scopeRelatedEntryIds([]),
      suggestedActions: ["restore or add the missing charter blueprints before narrowing scope"],
    });
  }

  if (params.enforcement.active) {
    gaps.push({
      id: `capability_inventory.governance_freeze.${params.enforcement.reasonCode ?? "active"}`,
      severity: "critical",
      title: "Governed capability mutation is frozen",
      detail:
        params.enforcement.message ??
        "The governance layer currently freezes high-risk capability mutations.",
      ownerAgentId: "founder",
      relatedEntryIds: scopeRelatedEntryIds([]),
      suggestedActions: [
        "repair the missing or invalid governance artifacts",
        "clear sovereign boundary violations before autonomous mutation resumes",
      ],
    });
  }

  if (!params.genesisTeam) {
    gaps.push({
      id: "capability_inventory.genesis_team_missing",
      severity: "critical",
      title: "Genesis Team blueprint is missing",
      detail:
        "No governed evolution team blueprint was discovered for deterministic capability development handoffs.",
      ownerAgentId: "founder",
      relatedEntryIds: scopeRelatedEntryIds([]),
      suggestedActions: [
        "restore governance/charter/evolution/genesis-team.yaml",
        "re-establish the governed capability factory before autonomous development expands",
      ],
    });
  } else {
    const { missingBlueprintRoles, missingTeamRoles, missingRoles } = resolveGenesisMissingRoles({
      genesisTeam: params.genesisTeam,
      knownAgentIds: params.knownAgentIds,
    });
    if (missingRoles.length > 0) {
      const detailParts = [
        missingBlueprintRoles.length > 0
          ? `Missing charter blueprints for: ${missingBlueprintRoles.join(", ")}.`
          : "",
        missingTeamRoles.length > 0
          ? `Missing genesis team members for: ${missingTeamRoles.join(", ")}.`
          : "",
      ].filter(Boolean);
      gaps.push({
        id: "capability_inventory.genesis_roles_missing",
        severity: "critical",
        title: "Genesis Team handoff roles are incomplete",
        detail: detailParts.join(" "),
        ownerAgentId: "founder",
        relatedEntryIds: scopeRelatedEntryIds([createTeamBlueprintEntryId(params.genesisTeam.id)]),
        suggestedActions: [
          ...(missingBlueprintRoles.length > 0 ? ["restore the missing agent blueprints"] : []),
          ...(missingTeamRoles.length > 0
            ? ["add the missing governed members to genesis_team"]
            : []),
          "do not publish autonomous capability changes until the full handoff chain exists",
        ],
      });
    }
  }

  const missingAutonomyCore = AUTONOMY_CORE_AGENT_IDS.filter(
    (entry) => !params.knownAgentIds.has(entry),
  );
  if (
    missingAutonomyCore.length > 0 ||
    params.autonomyProfileCount < AUTONOMY_CORE_AGENT_IDS.length
  ) {
    gaps.push({
      id: "capability_inventory.autonomy_core_missing",
      severity: "warning",
      title: "Core autonomy governance profiles are incomplete",
      detail:
        missingAutonomyCore.length > 0
          ? `Missing core profiles: ${missingAutonomyCore.join(", ")}.`
          : "Not all core autonomy profiles resolved into the governed inventory.",
      ownerAgentId: "founder",
      relatedEntryIds: scopeRelatedEntryIds(entryIdsByKind("agent_blueprint")),
      suggestedActions: [
        "restore founder, strategist, and librarian blueprints",
        "keep evolution planning tied to governed role contracts",
      ],
    });
  }

  const blockedSkills = params.entries.filter(
    (entry) => entry.kind === "skill" && entry.status !== "ready",
  );
  const allSkills = params.entries.filter((entry) => entry.kind === "skill");
  if (allSkills.length === 0) {
    gaps.push({
      id: "capability_inventory.skills_missing",
      severity: "warning",
      title: "No governed skill assets were discovered",
      detail: "The capability inventory found no reusable skill assets in the observed workspaces.",
      ownerAgentId: "librarian",
      relatedEntryIds: scopeRelatedEntryIds([]),
      suggestedActions: [
        "restore existing skill assets or register the first governed skill workflow",
        "treat missing skill inventory as a capability library bootstrap task",
      ],
    });
  }
  if (blockedSkills.length > 0) {
    gaps.push({
      id: "capability_inventory.skills_require_attention",
      severity: "warning",
      title: "Some capability skills are not executable",
      detail: `${blockedSkills.length} skill entries require repair or configuration.`,
      ownerAgentId: "librarian",
      relatedEntryIds: scopeRelatedEntryIds(blockedSkills.map((entry) => entry.id)),
      suggestedActions: [
        "repair missing binaries, env vars, and config requirements",
        "re-enable blocked skills only after dependency checks pass",
      ],
    });
  }

  const pluginEntries = params.entries.filter((entry) => entry.kind === "plugin");
  if (pluginEntries.length === 0) {
    gaps.push({
      id: "capability_inventory.plugins_missing",
      severity: "warning",
      title: "No plugin assets were discovered",
      detail:
        "The capability inventory found no plugin manifests to bridge external tooling or runtime surfaces.",
      ownerAgentId: "tdd_developer",
      relatedEntryIds: scopeRelatedEntryIds([]),
      suggestedActions: [
        "restore plugin manifests or plugin discovery roots",
        "rebuild the plugin library before expanding autonomous execution",
      ],
    });
  }

  if (params.pluginDiagnostics.length > 0) {
    gaps.push({
      id: "capability_inventory.plugin_registry_diagnostics",
      severity: params.pluginDiagnostics.some((entry) => entry.level === "error")
        ? "warning"
        : "info",
      title: "Plugin registry reported discovery or manifest diagnostics",
      detail: `${params.pluginDiagnostics.length} plugin diagnostics were observed during inventory.`,
      ownerAgentId: "librarian",
      relatedEntryIds: scopeRelatedEntryIds(
        pluginEntries
          .filter((entry) =>
            params.pluginDiagnostics.some(
              (diagnostic) => diagnostic.pluginId && entry.id.includes(`:${diagnostic.pluginId}:`),
            ),
          )
          .map((entry) => entry.id),
      ),
      suggestedActions: [
        "repair invalid plugin manifests and duplicate plugin ids",
        "clear loader diagnostics before relying on autonomous plugin evolution",
      ],
    });
  }

  const capabilityAssetEntryIds = scopeRelatedEntryIds(
    params.entries
      .filter(
        (entry) =>
          entry.kind === "skill" ||
          entry.kind === "plugin" ||
          entry.kind === "memory" ||
          entry.kind === "strategy" ||
          entry.kind === "algorithm",
      )
      .map((entry) => entry.id),
  );
  if (params.assetRegistrySync.snapshot.parseError) {
    gaps.push({
      id: "capability_inventory.asset_registry_invalid",
      severity: "warning",
      title: "Governed capability asset registry is invalid",
      detail: params.assetRegistrySync.snapshot.parseError,
      ownerAgentId: "librarian",
      relatedEntryIds: capabilityAssetEntryIds,
      suggestedActions: [
        "rewrite the governed capability asset registry from the observed inventory",
        "do not trust stale registry metadata until the charter registry parses cleanly again",
      ],
    });
  } else if (!params.assetRegistrySync.snapshot.exists && params.assetRegistrySync.assetCount > 0) {
    gaps.push({
      id: "capability_inventory.asset_registry_missing",
      severity: "warning",
      title: "Governed capability asset registry is missing",
      detail: `Discovered ${params.assetRegistrySync.assetCount} governed capability assets, but no charter registry file exists for librarian registration.`,
      ownerAgentId: "librarian",
      relatedEntryIds: capabilityAssetEntryIds,
      suggestedActions: [
        "bootstrap governance/charter/capability/asset-registry.yaml",
        "register discovered skills and plugins before autonomous promotion expands",
      ],
    });
  } else if (params.assetRegistrySync.hasChanges) {
    gaps.push({
      id: "capability_inventory.asset_registry_sync_required",
      severity: "warning",
      title: "Governed capability asset registry is out of sync",
      detail: [
        params.assetRegistrySync.missingAssetIds.length > 0
          ? `${params.assetRegistrySync.missingAssetIds.length} missing`
          : "",
        params.assetRegistrySync.staleAssetIds.length > 0
          ? `${params.assetRegistrySync.staleAssetIds.length} stale`
          : "",
        params.assetRegistrySync.driftedAssetIds.length > 0
          ? `${params.assetRegistrySync.driftedAssetIds.length} drifted`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      ownerAgentId: "librarian",
      relatedEntryIds: capabilityAssetEntryIds,
      suggestedActions: [
        "queue a governed registry sync proposal",
        "refresh dependency and coverage metadata before librarian registration completes",
      ],
    });
  }

  return gaps.toSorted((left, right) => {
    const severityDelta = sortGapSeverity(left.severity, right.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildInventorySummary(params: {
  entries: GovernanceCapabilityInventoryEntry[];
  gaps: GovernanceCapabilityGap[];
  autonomyProfileCount: number;
  genesisMemberCount: number;
}): GovernanceCapabilityInventorySummary {
  const countEntries = (
    kind: GovernanceCapabilityInventoryEntryKind,
    status?: GovernanceCapabilityInventoryEntryStatus,
  ) =>
    params.entries.filter((entry) => entry.kind === kind && (!status || entry.status === status))
      .length;

  const pluginActivated = params.entries.filter(
    (entry) => entry.kind === "plugin" && entry.activation?.activated,
  ).length;

  return {
    totalEntries: params.entries.length,
    skillCount: countEntries("skill"),
    skillReady: countEntries("skill", "ready"),
    skillAttention: countEntries("skill", "attention"),
    skillBlocked: countEntries("skill", "blocked"),
    pluginCount: countEntries("plugin"),
    pluginActivated,
    pluginAttention: countEntries("plugin", "attention"),
    pluginBlocked: countEntries("plugin", "blocked"),
    memoryCount: countEntries("memory"),
    memoryReady: countEntries("memory", "ready"),
    memoryAttention: countEntries("memory", "attention"),
    memoryBlocked: countEntries("memory", "blocked"),
    strategyCount: countEntries("strategy"),
    strategyReady: countEntries("strategy", "ready"),
    strategyAttention: countEntries("strategy", "attention"),
    strategyBlocked: countEntries("strategy", "blocked"),
    algorithmCount: countEntries("algorithm"),
    algorithmReady: countEntries("algorithm", "ready"),
    algorithmAttention: countEntries("algorithm", "attention"),
    algorithmBlocked: countEntries("algorithm", "blocked"),
    agentBlueprintCount: countEntries("agent_blueprint"),
    teamBlueprintCount: countEntries("team_blueprint"),
    autonomyProfileCount: params.autonomyProfileCount,
    genesisMemberCount: params.genesisMemberCount,
    gapCount: params.gaps.length,
    criticalGapCount: params.gaps.filter((entry) => entry.severity === "critical").length,
    warningGapCount: params.gaps.filter((entry) => entry.severity === "warning").length,
    infoGapCount: params.gaps.filter((entry) => entry.severity === "info").length,
  };
}

export function getGovernanceCapabilityInventory(
  params: {
    cfg?: OpenClawConfig;
    charterDir?: string;
    workspaceDirs?: string[];
    observedAt?: number;
    agentIds?: string[];
  } = {},
): GovernanceCapabilityInventoryResult {
  const cfg = resolveRuntimeConfig(params.cfg);
  const observedAt = params.observedAt ?? Date.now();
  const requestedAgentIds = normalizeRequestedAgentIds(params.agentIds);
  const organization = loadGovernanceCharterOrganization({
    charterDir: params.charterDir,
  });
  const workspaceDirs = listCapabilitySkillWorkspaceDirs({
    cfg,
    charterDir: organization.charterDir,
    explicit: params.workspaceDirs,
  });
  const enforcement = resolveGovernanceEnforcementState(cfg, {
    charterDir: params.charterDir,
  });

  const entries: GovernanceCapabilityInventoryEntry[] = [];
  for (const workspaceDir of workspaceDirs) {
    const report = buildWorkspaceSkillStatus(workspaceDir, {
      config: cfg,
    });
    entries.push(...report.skills.map((skill) => mapSkillEntry({ workspaceDir, skill })));
  }

  const pluginInventory = collectPluginInventory({
    cfg,
    workspaceDirs,
  });
  entries.push(...pluginInventory.plugins.map((entry) => mapPluginEntry(entry)));

  for (const blueprint of organization.agents) {
    entries.push(
      mapAgentBlueprintEntry({
        blueprint,
        contract: resolveAgentGovernanceRuntimeContract({
          cfg,
          agentId: blueprint.id,
          charterDir: params.charterDir,
        }),
      }),
    );
  }

  const knownAgentIds = new Set(organization.agents.map((entry) => entry.id));
  for (const team of organization.teams) {
    entries.push(
      mapTeamBlueprintEntry({
        blueprint: team,
        knownAgentIds,
      }),
    );
  }

  const genesisTeam = organization.teamById.get(DEFAULT_GENESIS_TEAM_ID);
  const assetRegistrySync = planGovernanceCapabilityAssetRegistrySync({
    charterDir: organization.charterDir,
    observedAt,
    entries,
  });
  entries.push(
    ...buildDerivedGovernedAssetEntries({
      charterDir: organization.charterDir,
      knownAgentIds,
      genesisTeam,
      assetRegistrySync,
      enforcement,
    }),
  );
  entries.push(
    ...buildRegisteredGovernedAssetEntries({
      assetRegistrySync,
      existingEntryIds: new Set(entries.map((entry) => entry.id)),
    }),
  );
  const autonomyProfileCount = AUTONOMY_CORE_AGENT_IDS.filter((entry) =>
    knownAgentIds.has(entry),
  ).length;
  const scopedEntries = filterInventoryEntriesByRequestedAgents({
    entries,
    requestedAgentIds,
  });
  const scopedAssetRegistrySync = planGovernanceCapabilityAssetRegistrySync({
    charterDir: organization.charterDir,
    observedAt,
    entries,
  });
  const genesisMemberCount = collectUniqueStrings(
    (genesisTeam?.members ?? []).map((entry) => normalizeAgentId(entry)),
  ).length;
  const gaps = buildInventoryGaps({
    requestedAgentIds,
    entries: scopedEntries,
    enforcement,
    pluginDiagnostics: pluginInventory.diagnostics,
    autonomyProfileCount,
    genesisTeam,
    knownAgentIds,
    assetRegistrySync: scopedAssetRegistrySync,
  });

  return {
    observedAt,
    charterDir: organization.charterDir,
    workspaceDirs,
    requestedAgentIds,
    summary: buildInventorySummary({
      entries: scopedEntries,
      gaps,
      autonomyProfileCount,
      genesisMemberCount,
    }),
    entries: scopedEntries.toSorted(sortEntry),
    gaps,
  };
}

function buildGenesisPlanActions(params: {
  stageId: (typeof GENESIS_STAGE_ORDER)[number];
  gaps: GovernanceCapabilityGap[];
  inventory: GovernanceCapabilityInventoryResult;
  freezeActive: boolean;
}): string[] {
  const topGapTitles = params.gaps.slice(0, 3).map((entry) => entry.title);
  switch (params.stageId) {
    case "gap_detection":
      return topGapTitles.length > 0
        ? topGapTitles.map((entry) => `detect and rank: ${entry}`)
        : ["scan the capability layer for stale or missing governed assets"];
    case "root_cause_analysis":
      return topGapTitles.length > 0
        ? topGapTitles.map((entry) => `trace root cause and mutation boundary for: ${entry}`)
        : ["map dependency edges across skills, plugins, and charter blueprints"];
    case "implementation":
      return collectUniqueStrings([
        ...(params.inventory.summary.skillAttention > 0
          ? ["repair blocked skill prerequisites and normalize installers"]
          : []),
        ...(params.inventory.summary.pluginCount === 0
          ? ["prototype the missing plugin surface and register its manifest"]
          : []),
        ...(params.gaps.some((entry) => entry.id.includes("genesis"))
          ? ["restore missing blueprints through governed proposal creation"]
          : []),
        ...(params.freezeActive
          ? ["prepare implementation deltas, but hold mutation until governance freeze clears"]
          : ["implement the smallest governed asset change that closes the top gap"]),
      ]);
    case "qa_and_replay":
      return [
        "replay targeted tests for changed runtime hooks and manifests",
        "validate rollback paths, proposal traces, and first-pass asset behavior",
      ];
    case "promotion_or_rollback":
      return params.freezeActive
        ? [
            "stage promotion metadata only; publishing remains blocked while governance freeze is active",
          ]
        : [
            "promote the candidate asset when qa passes",
            "rollback immediately when replay, audit, or registry integrity fails",
          ];
    case "registration":
      return params.freezeActive
        ? ["prepare registry updates and dependency links for post-freeze publication"]
        : [
            "write asset manifests, dependency indexes, and retirement records",
            "deduplicate superseded assets and refresh retrieval coverage",
          ];
    default:
      return [];
  }
}

function resolveGenesisStageOwner(stageId: (typeof GENESIS_STAGE_ORDER)[number]): string {
  switch (stageId) {
    case "gap_detection":
      return "sentinel";
    case "root_cause_analysis":
      return "archaeologist";
    case "implementation":
      return "tdd_developer";
    case "qa_and_replay":
      return "qa";
    case "promotion_or_rollback":
      return "publisher";
    case "registration":
      return "librarian";
    default:
      return "librarian";
  }
}

function resolveGenesisStageTitle(stageId: (typeof GENESIS_STAGE_ORDER)[number]): string {
  switch (stageId) {
    case "gap_detection":
      return "Sentinel Detection";
    case "root_cause_analysis":
      return "Archaeologist Analysis";
    case "implementation":
      return "TDD Implementation";
    case "qa_and_replay":
      return "QA Replay";
    case "promotion_or_rollback":
      return "Publisher Decision";
    case "registration":
      return "Librarian Registration";
    default:
      return stageId;
  }
}

function resolveGenesisStageGoal(stageId: (typeof GENESIS_STAGE_ORDER)[number]): string {
  switch (stageId) {
    case "gap_detection":
      return "Turn inventory drift into ranked governed gap signals.";
    case "root_cause_analysis":
      return "Explain the root cause, mutation boundary, and smallest viable fix.";
    case "implementation":
      return "Build the governed capability delta with tests and rollback hooks.";
    case "qa_and_replay":
      return "Validate the candidate asset under replay and regression pressure.";
    case "promotion_or_rollback":
      return "Promote only assets with clean QA and rollback certainty.";
    case "registration":
      return "Register, index, and deduplicate the promoted capability asset.";
    default:
      return stageId;
  }
}

function resolveGenesisStageOutputs(stageId: (typeof GENESIS_STAGE_ORDER)[number]): string[] {
  switch (stageId) {
    case "gap_detection":
      return ["gap_signal", "risk_summary"];
    case "root_cause_analysis":
      return ["root_cause_map", "change_plan"];
    case "implementation":
      return ["candidate_asset", "test_delta"];
    case "qa_and_replay":
      return ["qa_report", "replay_report"];
    case "promotion_or_rollback":
      return ["promotion_record", "rollback_decision"];
    case "registration":
      return ["asset_manifest", "registry_update", "dependency_index"];
    default:
      return [];
  }
}

function resolveGenesisMode(
  inventory: GovernanceCapabilityInventoryResult,
): GovernanceGenesisPlanMode {
  if (inventory.gaps.some((entry) => entry.severity === "critical")) {
    return "repair";
  }
  if (
    inventory.gaps.length > 0 ||
    inventory.summary.skillAttention > 0 ||
    inventory.summary.pluginAttention > 0
  ) {
    return "build";
  }
  return "steady_state";
}

function buildGenesisProjectBlueprint(params: {
  teamId: string;
  mode: GovernanceGenesisPlanMode;
  focusGapIds: string[];
  prioritizedGaps: GovernanceCapabilityGap[];
  blockers: string[];
}): GovernanceGenesisProjectBlueprint {
  const candidateKinds = collectUniqueStrings(
    params.prioritizedGaps.flatMap((entry) => {
      if (entry.relatedEntryIds.some((id) => id.startsWith("skill:"))) {
        return ["skill"];
      }
      if (entry.relatedEntryIds.some((id) => id.startsWith("plugin:"))) {
        return ["plugin"];
      }
      if (entry.relatedEntryIds.some((id) => id.startsWith("agent_blueprint:"))) {
        return ["agent_blueprint"];
      }
      if (entry.relatedEntryIds.some((id) => id.startsWith("team_blueprint:"))) {
        return ["team_blueprint"];
      }
      if (entry.relatedEntryIds.some((id) => id.startsWith("algorithm:"))) {
        return ["algorithm"];
      }
      return ["strategy"];
    }),
  );
  const projectId = ["genesis", params.mode, params.focusGapIds[0] ?? "steady-state"]
    .join(".")
    .replace(/[^A-Za-z0-9._-]+/gu, "-");
  return {
    projectId,
    ownerTeamId: params.teamId,
    mode: params.mode,
    targetMetric:
      params.mode === "repair"
        ? "reduce critical capability gaps and unblock governed execution"
        : params.mode === "build"
          ? "increase governed capability coverage and reuse rate"
          : "preserve capability readiness while minimizing drift",
    candidateKinds,
    requiredArtifacts: collectUniqueStrings([
      "problem_statement",
      "change_plan",
      "candidate_asset",
      "qa_report",
      "replay_report",
      "rollback_reference",
      "promotion_record",
      ...(params.focusGapIds.length > 0 ? params.focusGapIds.map((entry) => `gap:${entry}`) : []),
    ]),
    qaGates: [
      "functional_pass",
      "replay_pass",
      "audit_trace_present",
      "rollback_reference_present",
    ],
    promotionAuthorities: ["qa", "publisher", "librarian", "sovereignty_auditor"],
    rollbackPlan:
      params.blockers.length > 0
        ? [
            "preserve staged artifacts only while blockers remain active",
            "revert candidate changes immediately if governance, replay, or registry evidence fails",
          ]
        : [
            "revert promoted assets if replay, audit, or post-promotion observation regresses",
            "restore the previous governed asset manifest and dependency index",
          ],
  };
}

export function planGovernanceGenesisWork(
  params: {
    cfg?: OpenClawConfig;
    charterDir?: string;
    workspaceDirs?: string[];
    observedAt?: number;
    teamId?: string;
    agentIds?: string[];
    inventory?: GovernanceCapabilityInventoryResult;
  } = {},
): GovernanceGenesisPlanResult {
  const inventory =
    params.inventory ??
    getGovernanceCapabilityInventory({
      cfg: params.cfg,
      charterDir: params.charterDir,
      workspaceDirs: params.workspaceDirs,
      observedAt: params.observedAt,
      agentIds: params.agentIds,
    });
  const cfg = resolveRuntimeConfig(params.cfg);
  const organization = loadGovernanceCharterOrganization({
    charterDir: params.charterDir,
  });
  const enforcement = resolveGovernanceEnforcementState(cfg, {
    charterDir: params.charterDir,
  });
  const teamId = normalizeAgentId(params.teamId ?? DEFAULT_GENESIS_TEAM_ID);
  const team = organization.teamById.get(teamId);
  const knownAgentIds = new Set(organization.agents.map((entry) => entry.id));
  const { missingBlueprintRoles, missingTeamRoles } = resolveGenesisMissingRoles({
    genesisTeam: team,
    knownAgentIds,
  });
  const blockers = collectUniqueStrings([
    ...(team ? [] : [`missing team blueprint: ${teamId}`]),
    ...(missingBlueprintRoles.length > 0
      ? [`missing genesis roles: ${missingBlueprintRoles.join(", ")}`]
      : []),
    ...(missingTeamRoles.length > 0
      ? [`genesis team missing members: ${missingTeamRoles.join(", ")}`]
      : []),
    ...(enforcement.active
      ? [enforcement.message ?? "governed mutation is frozen until governance issues are cleared"]
      : []),
  ]);
  const prioritizedGaps = prioritizeGapsForRequestedAgents({
    gaps: inventory.gaps,
    entries: inventory.entries,
    requestedAgentIds: inventory.requestedAgentIds,
  });
  const focusGapIds = prioritizedGaps.slice(0, 5).map((entry) => entry.id);
  const mode = resolveGenesisMode(inventory);

  const stages: GovernanceGenesisPlanStage[] = [];
  const statusByStageId = new Map<string, GovernanceGenesisPlanStageStatus>();

  for (const stageId of GENESIS_STAGE_ORDER) {
    const ownerAgentId = resolveGenesisStageOwner(stageId);
    const dependsOn =
      stageId === "gap_detection"
        ? []
        : [stages[stages.length - 1]?.id].filter((entry): entry is string => Boolean(entry));
    let status: GovernanceGenesisPlanStageStatus = "ready";
    if (!knownAgentIds.has(ownerAgentId)) {
      status = "blocked";
    } else if (
      (stageId === "implementation" ||
        stageId === "promotion_or_rollback" ||
        stageId === "registration") &&
      enforcement.active
    ) {
      status = "blocked";
    } else if (
      dependsOn.some((entry) => {
        const dependency = statusByStageId.get(entry);
        return dependency === "blocked" || dependency === "waiting";
      })
    ) {
      status = "waiting";
    }

    const id = `genesis.${stageId}`;
    const stage: GovernanceGenesisPlanStage = {
      id,
      title: resolveGenesisStageTitle(stageId),
      ownerAgentId,
      status,
      goal: resolveGenesisStageGoal(stageId),
      dependsOn,
      inputRefs: stageId === "gap_detection" ? focusGapIds : dependsOn,
      outputRefs: resolveGenesisStageOutputs(stageId),
      actions: buildGenesisPlanActions({
        stageId,
        gaps: prioritizedGaps,
        inventory,
        freezeActive: enforcement.active,
      }),
      rationale:
        stageId === "implementation" && enforcement.active
          ? "Implementation is planned, but governed mutation remains blocked until the active governance freeze clears."
          : blockers.length > 0 && status === "blocked"
            ? blockers[0]
            : undefined,
    };
    stages.push(stage);
    statusByStageId.set(id, status);
  }

  return {
    observedAt: inventory.observedAt,
    charterDir: inventory.charterDir,
    workspaceDirs: inventory.workspaceDirs,
    ...(inventory.workspaceDirs[0] ? { primaryWorkspaceDir: inventory.workspaceDirs[0] } : {}),
    requestedAgentIds: inventory.requestedAgentIds,
    teamId,
    ...(team?.title ? { teamTitle: team.title } : {}),
    mode,
    blockers,
    focusGapIds,
    stages,
    projectBlueprint: buildGenesisProjectBlueprint({
      teamId,
      mode,
      focusGapIds,
      prioritizedGaps,
      blockers,
    }),
  };
}
