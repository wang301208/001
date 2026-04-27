import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { AgentContextLimitsConfig } from "../config/types.agent-defaults.js";
import type { IdentityConfig } from "../config/types.base.js";
import type { AgentToolsConfig } from "../config/types.tools.js";
import { normalizeAgentId } from "../routing/session-key.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";

type GovernanceYamlRecord = Record<string, unknown>;

export type GovernanceCharterAgentBlueprint = {
  id: string;
  title?: string;
  layer?: string;
  class?: string;
  status?: string;
  role?: string;
  missionPrimary?: string;
  successMetrics: string[];
  canObserve: string[];
  canDecide: string[];
  cannotDecide: string[];
  authorityLevel?: string;
  mutationAllow: string[];
  mutationDeny: string[];
  networkDefault?: string;
  networkConditions: string[];
  allowedSubagents: string[];
  allowedTools: string[];
  memoryScope: string[];
  qaRequirements: string[];
  writeScope: string[];
  networkAllowedDomains: string[];
  networkRequiresCitation: boolean;
  escalationPolicy: {
    boundaryConflict?: string;
    criticalChange?: string;
    blockedPromotion?: string;
  };
  promotionGates: string[];
  contractValid: boolean;
  contractIssues: string[];
  resourceBudget?: {
    tokens?: string;
    parallelism?: string;
    runtime?: string;
  };
  worksWith: string[];
  reportsTo: string[];
  promotionRequirements: string[];
  runtimeHooks: string[];
  sourcePath: string;
};

export type GovernanceCharterTeamBlueprint = {
  id: string;
  title?: string;
  layer?: string;
  class?: string;
  status?: string;
  members: string[];
  sourcePath: string;
};

export type GovernanceCharterOrganization = {
  charterDir: string;
  discovered: boolean;
  agents: GovernanceCharterAgentBlueprint[];
  teams: GovernanceCharterTeamBlueprint[];
  agentById: Map<string, GovernanceCharterAgentBlueprint>;
  teamById: Map<string, GovernanceCharterTeamBlueprint>;
};

export type GovernanceCharterCollaborationPolicy = {
  requesterAgentId: string;
  charterDeclared: boolean;
  collaboratorAgentIds: string[];
  allowedAgentIds: string[];
};

export type GovernanceCharterAgentRuntimeProfile = {
  name?: string;
  identity?: IdentityConfig;
  subagents?: {
    allowAgents?: string[];
    requireAgentId?: boolean;
  };
  embeddedPi?: {
    executionContract?: "default" | "strict-agentic";
  };
  contextLimits?: AgentContextLimitsConfig;
  tools?: AgentToolsConfig;
};

const organizationCache = new Map<string, GovernanceCharterOrganization>();

function moduleRepoRoot(): string {
  return path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
}

function defaultCharterDir(): string {
  return path.join(moduleRepoRoot(), "governance", "charter");
}

function parseYamlRecord(raw: string): GovernanceYamlRecord | null {
  const parsed = YAML.parse(raw, { schema: "core" }) as unknown;
  return isRecord(parsed) ? parsed : null;
}

function normalizeText(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.replace(/\s+/g, " ").trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    const normalized = normalizeText(entry);
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function readRecord(value: unknown): GovernanceYamlRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function readNormalizedAgentRefs(value: unknown): string[] {
  return readStringArray(value).map((entry) => normalizeAgentId(entry));
}

function hasOwn(record: GovernanceYamlRecord | undefined, key: string): boolean {
  return Boolean(record) && Object.prototype.hasOwnProperty.call(record, key);
}

function expandAgentRefsToDeclaredAgents(
  refs: string[],
  organization: GovernanceCharterOrganization,
  excludeAgentId?: string,
): string[] {
  const visitedRefs = new Set<string>();
  const resolved = new Set<string>();

  const visit = (candidate: string) => {
    const normalized = normalizeAgentId(candidate);
    if (!normalized || visitedRefs.has(normalized)) {
      return;
    }
    visitedRefs.add(normalized);
    const team = organization.teamById.get(normalized);
    if (team) {
      for (const member of team.members) {
        visit(member);
      }
      return;
    }
    if (organization.agentById.has(normalized) && normalized !== excludeAgentId) {
      resolved.add(normalized);
    }
  };

  for (const ref of refs) {
    visit(ref);
  }

  return Array.from(resolved).toSorted((left, right) => left.localeCompare(right));
}

function validateAgentContract(params: {
  contract: GovernanceYamlRecord | undefined;
  networkPolicy: GovernanceYamlRecord | undefined;
  escalationPolicy: GovernanceYamlRecord | undefined;
}): string[] {
  const issues: string[] = [];
  const contract = params.contract;
  const networkPolicy = params.networkPolicy;
  const escalationPolicy = params.escalationPolicy;

  if (!normalizeText(contract?.role)) {
    issues.push("missing contract.role");
  }
  if (!hasOwn(contract, "allowed_subagents") || !Array.isArray(contract?.allowed_subagents)) {
    issues.push("missing contract.allowed_subagents");
  }
  if (!hasOwn(contract, "allowed_tools") || !Array.isArray(contract?.allowed_tools)) {
    issues.push("missing contract.allowed_tools");
  }
  if (!hasOwn(contract, "memory_scope") || !Array.isArray(contract?.memory_scope)) {
    issues.push("missing contract.memory_scope");
  }
  if (!hasOwn(contract, "qa_requirements") || !Array.isArray(contract?.qa_requirements)) {
    issues.push("missing contract.qa_requirements");
  }
  if (!hasOwn(contract, "write_scope") || !Array.isArray(contract?.write_scope)) {
    issues.push("missing contract.write_scope");
  }
  if (!hasOwn(contract, "promotion_gates") || !Array.isArray(contract?.promotion_gates)) {
    issues.push("missing contract.promotion_gates");
  }
  if (!networkPolicy) {
    issues.push("missing contract.network_policy");
  } else {
    if (!normalizeText(networkPolicy.default)) {
      issues.push("missing contract.network_policy.default");
    }
    if (!hasOwn(networkPolicy, "allowed_domains") || !Array.isArray(networkPolicy.allowed_domains)) {
      issues.push("missing contract.network_policy.allowed_domains");
    }
  }
  if (!escalationPolicy) {
    issues.push("missing contract.escalation_policy");
  } else {
    if (!normalizeText(escalationPolicy.boundary_conflict)) {
      issues.push("missing contract.escalation_policy.boundary_conflict");
    }
    if (!normalizeText(escalationPolicy.critical_change)) {
      issues.push("missing contract.escalation_policy.critical_change");
    }
  }

  return issues;
}

function readAgentBlueprint(filePath: string, charterDir: string): GovernanceCharterAgentBlueprint | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseYamlRecord(raw);
    if (!parsed) {
      return null;
    }
    const agent = readRecord(parsed.agent);
    const mission = readRecord(parsed.mission);
    const jurisdiction = readRecord(parsed.jurisdiction);
    const authority = readRecord(parsed.authority);
    const mutationScope = readRecord(authority?.mutation_scope);
    const networkScope = readRecord(authority?.network_scope);
    const resourceBudget = readRecord(authority?.resource_budget);
    const requiredCounterparties = readRecord(parsed.required_counterparties);
    const promotionPolicy = readRecord(parsed.promotion_policy);
    const runtimeMapping = readRecord(parsed.runtime_mapping);
    const contract = readRecord(parsed.contract);
    const contractNetworkPolicy = readRecord(contract?.network_policy);
    const contractEscalationPolicy = readRecord(contract?.escalation_policy);
    const id = normalizeOptionalLowercaseString(agent?.id);
    if (!id) {
      return null;
    }
    const contractIssues = validateAgentContract({
      contract,
      networkPolicy: contractNetworkPolicy,
      escalationPolicy: contractEscalationPolicy,
    });
    return {
      id: normalizeAgentId(id),
      title: normalizeText(agent?.title),
      layer: normalizeText(agent?.layer),
      class: normalizeText(agent?.class),
      status: normalizeText(agent?.status),
      role: normalizeText(contract?.role),
      missionPrimary: normalizeText(mission?.primary),
      successMetrics: readStringArray(mission?.success_metrics),
      canObserve: readStringArray(jurisdiction?.can_observe),
      canDecide: readStringArray(jurisdiction?.can_decide),
      cannotDecide: readStringArray(jurisdiction?.cannot_decide),
      authorityLevel: normalizeText(authority?.level),
      mutationAllow: readStringArray(mutationScope?.allow),
      mutationDeny: readStringArray(mutationScope?.deny),
      networkDefault: normalizeText(networkScope?.default),
      networkConditions: readStringArray(networkScope?.conditions),
      allowedSubagents: readNormalizedAgentRefs(contract?.allowed_subagents),
      allowedTools: readStringArray(contract?.allowed_tools),
      memoryScope: readStringArray(contract?.memory_scope),
      qaRequirements: readStringArray(contract?.qa_requirements),
      writeScope: readStringArray(contract?.write_scope),
      networkAllowedDomains: readStringArray(contractNetworkPolicy?.allowed_domains),
      networkRequiresCitation: contractNetworkPolicy?.requires_citation === true,
      escalationPolicy: {
        boundaryConflict: normalizeText(contractEscalationPolicy?.boundary_conflict),
        criticalChange: normalizeText(contractEscalationPolicy?.critical_change),
        blockedPromotion: normalizeText(contractEscalationPolicy?.blocked_promotion),
      },
      promotionGates: readStringArray(contract?.promotion_gates),
      contractValid: contractIssues.length === 0,
      contractIssues,
      resourceBudget:
        resourceBudget && Object.keys(resourceBudget).length > 0
          ? {
              tokens: normalizeText(resourceBudget.tokens),
              parallelism: normalizeText(resourceBudget.parallelism),
              runtime: normalizeText(resourceBudget.runtime),
            }
          : undefined,
      worksWith: readNormalizedAgentRefs(requiredCounterparties?.works_with),
      reportsTo: readNormalizedAgentRefs(requiredCounterparties?.reports_to),
      promotionRequirements: Array.from(
        new Set(
          Object.values(promotionPolicy ?? {})
            .flatMap((value) => readStringArray(value))
            .filter(Boolean),
        ),
      ),
      runtimeHooks: readStringArray(runtimeMapping?.intended_project_hooks),
      sourcePath: path.relative(charterDir, filePath).split(path.sep).join("/"),
    };
  } catch {
    return null;
  }
}

function readTeamBlueprint(filePath: string, charterDir: string): GovernanceCharterTeamBlueprint | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseYamlRecord(raw);
    if (!parsed) {
      return null;
    }
    const team = readRecord(parsed.team);
    const id = normalizeOptionalLowercaseString(team?.id);
    if (!id) {
      return null;
    }
    return {
      id: normalizeAgentId(id),
      title: normalizeText(team?.title),
      layer: normalizeText(team?.layer),
      class: normalizeText(team?.class),
      status: normalizeText(team?.status),
      members: readNormalizedAgentRefs(parsed.members),
      sourcePath: path.relative(charterDir, filePath).split(path.sep).join("/"),
    };
  } catch {
    return null;
  }
}

export function loadGovernanceCharterOrganization(
  options: { charterDir?: string } = {},
): GovernanceCharterOrganization {
  const charterDir = path.resolve(options.charterDir ?? defaultCharterDir());
  const cached = organizationCache.get(charterDir);
  if (cached) {
    return cached;
  }

  const agentsDir = path.join(charterDir, "agents");
  const evolutionDir = path.join(charterDir, "evolution");
  const discovered = fs.existsSync(charterDir);
  const agents = fs.existsSync(agentsDir)
    ? fs
        .readdirSync(agentsDir)
        .filter((entry) => entry.toLowerCase().endsWith(".yaml"))
        .map((entry) => readAgentBlueprint(path.join(agentsDir, entry), charterDir))
        .filter((entry): entry is GovernanceCharterAgentBlueprint => Boolean(entry))
        .toSorted((a, b) => a.id.localeCompare(b.id))
    : [];
  const teams = fs.existsSync(evolutionDir)
    ? fs
        .readdirSync(evolutionDir)
        .filter((entry) => entry.toLowerCase().endsWith(".yaml"))
        .map((entry) => readTeamBlueprint(path.join(evolutionDir, entry), charterDir))
        .filter((entry): entry is GovernanceCharterTeamBlueprint => Boolean(entry))
        .toSorted((a, b) => a.id.localeCompare(b.id))
    : [];
  const organization: GovernanceCharterOrganization = {
    charterDir,
    discovered,
    agents,
    teams,
    agentById: new Map(agents.map((entry) => [entry.id, entry])),
    teamById: new Map(teams.map((entry) => [entry.id, entry])),
  };
  organizationCache.set(charterDir, organization);
  return organization;
}

export function listGovernanceCharterAgentBlueprints(
  options: { charterDir?: string } = {},
): GovernanceCharterAgentBlueprint[] {
  return loadGovernanceCharterOrganization(options).agents;
}

export function resolveGovernanceCharterAgentBlueprint(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): GovernanceCharterAgentBlueprint | undefined {
  const normalized = normalizeOptionalLowercaseString(agentId);
  if (!normalized) {
    return undefined;
  }
  return loadGovernanceCharterOrganization(options).agentById.get(normalizeAgentId(normalized));
}

export function resolveGovernanceCharterDeclaredCollaborators(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): string[] {
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, options);
  if (!blueprint) {
    return [];
  }
  const organization = loadGovernanceCharterOrganization(options);
  return expandAgentRefsToDeclaredAgents(
    [...blueprint.worksWith, ...blueprint.reportsTo],
    organization,
    blueprint.id,
  );
}

export function resolveGovernanceCharterAllowedSubagents(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): string[] {
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, options);
  if (!blueprint) {
    return [];
  }
  const organization = loadGovernanceCharterOrganization(options);
  const explicit = expandAgentRefsToDeclaredAgents(blueprint.allowedSubagents, organization, blueprint.id);
  if (explicit.length > 0) {
    return explicit;
  }
  return resolveGovernanceCharterDeclaredCollaborators(blueprint.id, options);
}

export function resolveGovernanceCharterCollaborationPolicy(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): GovernanceCharterCollaborationPolicy {
  const normalizedAgentId = normalizeAgentId(agentId);
  const blueprint = resolveGovernanceCharterAgentBlueprint(normalizedAgentId, options);
  const collaboratorAgentIds = blueprint
    ? resolveGovernanceCharterDeclaredCollaborators(normalizedAgentId, options)
    : [];
  return {
    requesterAgentId: normalizedAgentId,
    charterDeclared: Boolean(blueprint),
    collaboratorAgentIds,
    allowedAgentIds: [normalizedAgentId, ...collaboratorAgentIds],
  };
}

function resolveGovernanceCharterExecutionContract(
  blueprint: GovernanceCharterAgentBlueprint,
): "default" | "strict-agentic" | undefined {
  const runtimeBudget = normalizeLowercaseStringOrEmpty(blueprint.resourceBudget?.runtime ?? "");
  const layer = normalizeLowercaseStringOrEmpty(blueprint.layer ?? "");
  if (
    runtimeBudget === "continuous" ||
    runtimeBudget === "long-running" ||
    layer === "execution" ||
    layer === "evolution"
  ) {
    return "strict-agentic";
  }
  return undefined;
}

function resolveGovernanceCharterContextLimits(
  blueprint: GovernanceCharterAgentBlueprint,
): AgentContextLimitsConfig | undefined {
  const tokenBudget = normalizeLowercaseStringOrEmpty(blueprint.resourceBudget?.tokens ?? "");
  if (tokenBudget === "very_high") {
    return {
      memoryGetMaxChars: 32_000,
      memoryGetDefaultLines: 220,
      toolResultMaxChars: 24_000,
      postCompactionMaxChars: 3_600,
    };
  }
  if (tokenBudget === "high") {
    return {
      memoryGetMaxChars: 24_000,
      memoryGetDefaultLines: 180,
      toolResultMaxChars: 20_000,
      postCompactionMaxChars: 2_800,
    };
  }
  if (tokenBudget === "medium") {
    return {
      memoryGetMaxChars: 18_000,
      memoryGetDefaultLines: 140,
      toolResultMaxChars: 18_000,
      postCompactionMaxChars: 2_200,
    };
  }
  return undefined;
}

function resolveGovernanceCharterTools(
  blueprint: GovernanceCharterAgentBlueprint,
): AgentToolsConfig | undefined {
  const deny = new Set<string>();
  if (normalizeLowercaseStringOrEmpty(blueprint.networkDefault ?? "") === "internal_only") {
    deny.add("web_search");
    deny.add("web_fetch");
  }
  return {
    ...(deny.size > 0 ? { deny: Array.from(deny).toSorted((a, b) => a.localeCompare(b)) } : {}),
    elevated: {
      enabled: false,
    },
  };
}

export function resolveGovernanceCharterAgentRuntimeProfile(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): GovernanceCharterAgentRuntimeProfile | undefined {
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, options);
  if (!blueprint) {
    return undefined;
  }
  const collaborators = resolveGovernanceCharterAllowedSubagents(blueprint.id, options);
  const executionContract = resolveGovernanceCharterExecutionContract(blueprint);
  const contextLimits = resolveGovernanceCharterContextLimits(blueprint);
  const tools = resolveGovernanceCharterTools(blueprint);
  return {
    name: blueprint.title ?? blueprint.id,
    identity: blueprint.title ? { name: blueprint.title } : undefined,
    subagents: {
      ...(collaborators.length > 0 ? { allowAgents: collaborators } : {}),
      requireAgentId: true,
    },
    embeddedPi: executionContract ? { executionContract } : undefined,
    contextLimits,
    tools,
  };
}

function formatPromptList(items: string[], limit: number): string | undefined {
  if (items.length === 0) {
    return undefined;
  }
  const display = items.slice(0, limit);
  const suffix = items.length > limit ? ` (+${items.length - limit} more)` : "";
  return `${display.join(", ")}${suffix}`;
}

export function buildGovernanceCharterAgentPrompt(
  agentId: string | undefined | null,
  options: { charterDir?: string } = {},
): string | undefined {
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, options);
  if (!blueprint) {
    return undefined;
  }
  const collaborators = resolveGovernanceCharterDeclaredCollaborators(blueprint.id, options);
  const lines = [
    "## Organizational Charter",
    `Charter role: ${blueprint.title ?? blueprint.id} (${blueprint.id})`,
    blueprint.layer ? `Layer: ${blueprint.layer}` : undefined,
    blueprint.class ? `Class: ${blueprint.class}` : undefined,
    blueprint.role ? `Contract role: ${blueprint.role}` : undefined,
    blueprint.authorityLevel ? `Authority level: ${blueprint.authorityLevel}` : undefined,
    blueprint.missionPrimary ? `Mission: ${blueprint.missionPrimary}` : undefined,
    formatPromptList(blueprint.canDecide, 6)
      ? `You may decide: ${formatPromptList(blueprint.canDecide, 6)}`
      : undefined,
    formatPromptList(blueprint.cannotDecide, 6)
      ? `You must not decide: ${formatPromptList(blueprint.cannotDecide, 6)}`
      : undefined,
    formatPromptList(blueprint.mutationAllow, 6)
      ? `Allowed mutation scope: ${formatPromptList(blueprint.mutationAllow, 6)}`
      : undefined,
    formatPromptList(blueprint.mutationDeny, 6)
      ? `Never mutate: ${formatPromptList(blueprint.mutationDeny, 6)}`
      : undefined,
    blueprint.networkDefault ? `Network posture: ${blueprint.networkDefault}` : undefined,
    formatPromptList(blueprint.networkConditions, 4)
      ? `Network conditions: ${formatPromptList(blueprint.networkConditions, 4)}`
      : undefined,
    blueprint.resourceBudget
      ? `Resource budget: tokens=${blueprint.resourceBudget.tokens ?? "unspecified"}, parallelism=${blueprint.resourceBudget.parallelism ?? "unspecified"}, runtime=${blueprint.resourceBudget.runtime ?? "unspecified"}`
      : undefined,
    formatPromptList(blueprint.runtimeHooks, 4)
      ? `Project hooks: ${formatPromptList(blueprint.runtimeHooks, 4)}`
      : undefined,
    formatPromptList(blueprint.allowedTools, 8)
      ? `Allowed tools: ${formatPromptList(blueprint.allowedTools, 8)}`
      : undefined,
    formatPromptList(blueprint.memoryScope, 6)
      ? `Memory scope: ${formatPromptList(blueprint.memoryScope, 6)}`
      : undefined,
    formatPromptList(blueprint.qaRequirements, 6)
      ? `QA requirements: ${formatPromptList(blueprint.qaRequirements, 6)}`
      : undefined,
    formatPromptList(blueprint.writeScope, 6)
      ? `Write scope: ${formatPromptList(blueprint.writeScope, 6)}`
      : undefined,
    formatPromptList(blueprint.promotionGates, 6)
      ? `Promotion gates: ${formatPromptList(blueprint.promotionGates, 6)}`
      : undefined,
    blueprint.escalationPolicy.boundaryConflict
      ? `Escalate boundary conflicts to: ${blueprint.escalationPolicy.boundaryConflict}`
      : undefined,
    blueprint.escalationPolicy.criticalChange
      ? `Escalate critical changes to: ${blueprint.escalationPolicy.criticalChange}`
      : undefined,
    formatPromptList(collaborators, 8)
      ? `Declared collaborators: ${formatPromptList(collaborators, 8)}`
      : undefined,
    !blueprint.contractValid && blueprint.contractIssues.length > 0
      ? `Contract issues: ${formatPromptList(blueprint.contractIssues, 8)}`
      : undefined,
    collaborators.length > 0
      ? "Coordination boundary: use agents_list/sessions_spawn only within the declared collaborator graph unless higher-order governance changes the charter."
      : undefined,
    "Act inside this chartered role. Do not claim authority outside the declared jurisdiction.",
  ];
  return lines.filter(Boolean).join("\n");
}

export const __testing = {
  clearCache() {
    organizationCache.clear();
  },
};
