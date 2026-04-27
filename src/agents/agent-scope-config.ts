import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type {
  AgentContextLimitsConfig,
  AgentDefaultsConfig,
} from "../config/types.agent-defaults.js";
import type { OpenClawConfig } from "../config/types.js";
import {
  listGovernanceCharterAgentBlueprints,
  resolveGovernanceCharterAgentBlueprint,
  resolveGovernanceCharterAgentRuntimeProfile,
} from "../governance/charter-agents.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../routing/session-key.js";
import { readStringValue } from "../shared/string-coerce.js";
import { resolveUserPath } from "../utils.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

type AgentEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

export type ResolvedAgentConfig = {
  name?: string;
  workspace?: string;
  agentDir?: string;
  systemPromptOverride?: AgentEntry["systemPromptOverride"];
  model?: AgentEntry["model"];
  thinkingDefault?: AgentEntry["thinkingDefault"];
  verboseDefault?: AgentDefaultsConfig["verboseDefault"];
  reasoningDefault?: AgentEntry["reasoningDefault"];
  fastModeDefault?: AgentEntry["fastModeDefault"];
  skills?: AgentEntry["skills"];
  memorySearch?: AgentEntry["memorySearch"];
  humanDelay?: AgentEntry["humanDelay"];
  contextLimits?: AgentContextLimitsConfig;
  heartbeat?: AgentEntry["heartbeat"];
  identity?: AgentEntry["identity"];
  groupChat?: AgentEntry["groupChat"];
  subagents?: AgentEntry["subagents"];
  embeddedPi?: AgentEntry["embeddedPi"];
  sandbox?: AgentEntry["sandbox"];
  tools?: AgentEntry["tools"];
};

let log: ReturnType<typeof createSubsystemLogger> | null = null;
let defaultAgentWarned = false;

function getLog(): ReturnType<typeof createSubsystemLogger> {
  log ??= createSubsystemLogger("agent-scope");
  return log;
}

/** Strip null bytes from paths to prevent ENOTDIR errors. */
function stripNullBytes(s: string): string {
  return s.replaceAll("\0", "");
}

export function listAgentEntries(cfg: OpenClawConfig): AgentEntry[] {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry): entry is AgentEntry => entry !== null && typeof entry === "object");
}

export function listAgentIds(cfg: OpenClawConfig): string[] {
  const agents = listAgentEntries(cfg);
  if (agents.length === 0) {
    return [DEFAULT_AGENT_ID];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of agents) {
    const id = normalizeAgentId(entry?.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  for (const blueprint of listGovernanceCharterAgentBlueprints()) {
    const id = normalizeAgentId(blueprint.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [DEFAULT_AGENT_ID];
}

export function listWorkspaceScopedAgentIds(cfg: OpenClawConfig): string[] {
  const agents = listAgentEntries(cfg);
  if (agents.length === 0) {
    return [DEFAULT_AGENT_ID];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of agents) {
    const id = normalizeAgentId(entry?.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [DEFAULT_AGENT_ID];
}

export function resolveDefaultAgentId(cfg: OpenClawConfig): string {
  const agents = listAgentEntries(cfg);
  if (agents.length === 0) {
    return DEFAULT_AGENT_ID;
  }
  const defaults = agents.filter((agent) => agent?.default);
  if (defaults.length > 1 && !defaultAgentWarned) {
    defaultAgentWarned = true;
    getLog().warn("Multiple agents marked default=true; using the first entry as default.");
  }
  const chosen = (defaults[0] ?? agents[0])?.id?.trim();
  return normalizeAgentId(chosen || DEFAULT_AGENT_ID);
}

function resolveAgentEntry(cfg: OpenClawConfig, agentId: string): AgentEntry | undefined {
  const id = normalizeAgentId(agentId);
  return listAgentEntries(cfg).find((entry) => normalizeAgentId(entry.id) === id);
}

function mergeContextLimitsWithCharterHints(
  base: AgentContextLimitsConfig | undefined,
  charter: AgentContextLimitsConfig | undefined,
): AgentContextLimitsConfig | undefined {
  if (!base) {
    return charter;
  }
  if (!charter) {
    return base;
  }
  return {
    memoryGetMaxChars: Math.max(base.memoryGetMaxChars ?? 0, charter.memoryGetMaxChars ?? 0) || undefined,
    memoryGetDefaultLines:
      Math.max(base.memoryGetDefaultLines ?? 0, charter.memoryGetDefaultLines ?? 0) || undefined,
    toolResultMaxChars:
      Math.max(base.toolResultMaxChars ?? 0, charter.toolResultMaxChars ?? 0) || undefined,
    postCompactionMaxChars:
      Math.max(base.postCompactionMaxChars ?? 0, charter.postCompactionMaxChars ?? 0) || undefined,
  };
}

function mergeAllowAgentsWithCharter(
  configuredAllowAgents: string[] | undefined,
  charterAllowAgents: string[] | undefined,
): string[] | undefined {
  if (!charterAllowAgents || charterAllowAgents.length === 0) {
    return configuredAllowAgents;
  }
  if (!configuredAllowAgents || configuredAllowAgents.length === 0) {
    return charterAllowAgents;
  }
  if (configuredAllowAgents.some((value) => value.trim() === "*")) {
    return charterAllowAgents;
  }
  const configuredSet = new Set(configuredAllowAgents.map((value) => normalizeAgentId(value)));
  const narrowed = charterAllowAgents.filter((value) => configuredSet.has(normalizeAgentId(value)));
  return narrowed;
}

function mergeIdentityWithCharter(
  configuredIdentity: ResolvedAgentConfig["identity"],
  charterIdentity: ResolvedAgentConfig["identity"],
): ResolvedAgentConfig["identity"] {
  if (!configuredIdentity) {
    return charterIdentity;
  }
  if (!charterIdentity) {
    return configuredIdentity;
  }
  return {
    ...charterIdentity,
    ...configuredIdentity,
  };
}

function mergeSubagentsWithCharter(
  configuredSubagents: ResolvedAgentConfig["subagents"],
  charterSubagents: ResolvedAgentConfig["subagents"],
): ResolvedAgentConfig["subagents"] {
  if (!configuredSubagents) {
    return charterSubagents;
  }
  if (!charterSubagents) {
    return configuredSubagents;
  }
  return {
    ...charterSubagents,
    ...configuredSubagents,
    allowAgents: mergeAllowAgentsWithCharter(
      configuredSubagents.allowAgents,
      charterSubagents.allowAgents,
    ),
    requireAgentId: configuredSubagents.requireAgentId ?? charterSubagents.requireAgentId,
  };
}

function mergeEmbeddedPiWithCharter(
  configuredEmbeddedPi: ResolvedAgentConfig["embeddedPi"],
  charterEmbeddedPi: ResolvedAgentConfig["embeddedPi"],
): ResolvedAgentConfig["embeddedPi"] {
  if (!configuredEmbeddedPi) {
    return charterEmbeddedPi;
  }
  if (!charterEmbeddedPi) {
    return configuredEmbeddedPi;
  }
  return {
    ...charterEmbeddedPi,
    ...configuredEmbeddedPi,
    executionContract:
      configuredEmbeddedPi.executionContract ?? charterEmbeddedPi.executionContract,
  };
}

function mergeToolsWithCharter(
  configuredTools: ResolvedAgentConfig["tools"],
  charterTools: ResolvedAgentConfig["tools"],
): ResolvedAgentConfig["tools"] {
  if (!configuredTools) {
    return charterTools;
  }
  if (!charterTools) {
    return configuredTools;
  }
  const charterDeny = Array.isArray(charterTools.deny) ? charterTools.deny : [];
  const configuredDeny = Array.isArray(configuredTools.deny) ? configuredTools.deny : [];
  const deny = Array.from(
    new Set([...charterDeny, ...configuredDeny].map((value) => value.trim()).filter(Boolean)),
  );
  const charterElevated = charterTools.elevated;
  const configuredElevated = configuredTools.elevated;
  return {
    ...charterTools,
    ...configuredTools,
    ...(deny.length > 0 ? { deny } : {}),
    elevated:
      charterElevated || configuredElevated
        ? {
            ...charterElevated,
            ...configuredElevated,
            enabled:
              charterElevated?.enabled === false
                ? false
                : configuredElevated?.enabled ?? charterElevated?.enabled,
          }
        : undefined,
  };
}

function buildResolvedConfiguredAgentConfig(
  cfg: OpenClawConfig,
  entry: AgentEntry,
): ResolvedAgentConfig {
  const agentDefaults = cfg.agents?.defaults;
  return {
    name: readStringValue(entry.name),
    workspace: readStringValue(entry.workspace),
    agentDir: readStringValue(entry.agentDir),
    systemPromptOverride: readStringValue(entry.systemPromptOverride),
    model:
      typeof entry.model === "string" || (entry.model && typeof entry.model === "object")
        ? entry.model
        : undefined,
    thinkingDefault: entry.thinkingDefault,
    verboseDefault: entry.verboseDefault ?? agentDefaults?.verboseDefault,
    reasoningDefault: entry.reasoningDefault,
    fastModeDefault: entry.fastModeDefault,
    skills: Array.isArray(entry.skills) ? entry.skills : undefined,
    memorySearch: entry.memorySearch,
    humanDelay: entry.humanDelay,
    contextLimits:
      typeof entry.contextLimits === "object" && entry.contextLimits
        ? { ...agentDefaults?.contextLimits, ...entry.contextLimits }
        : agentDefaults?.contextLimits,
    heartbeat: entry.heartbeat,
    identity: entry.identity,
    groupChat: entry.groupChat,
    subagents: typeof entry.subagents === "object" && entry.subagents ? entry.subagents : undefined,
    embeddedPi:
      typeof entry.embeddedPi === "object" && entry.embeddedPi ? entry.embeddedPi : undefined,
    sandbox: entry.sandbox,
    tools: entry.tools,
  };
}

export function resolveAgentConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedAgentConfig | undefined {
  const id = normalizeAgentId(agentId);
  const entry = resolveAgentEntry(cfg, id);
  const charterRuntimeProfile =
    listAgentEntries(cfg).length > 0 ? resolveGovernanceCharterAgentRuntimeProfile(id) : undefined;
  const configured = entry ? buildResolvedConfiguredAgentConfig(cfg, entry) : undefined;
  if (!configured && !charterRuntimeProfile) {
    return undefined;
  }
  const agentDefaults = cfg.agents?.defaults;
  const charterContextLimits = mergeContextLimitsWithCharterHints(
    agentDefaults?.contextLimits,
    charterRuntimeProfile?.contextLimits,
  );
  if (!configured) {
    return {
      name: charterRuntimeProfile?.name,
      verboseDefault: agentDefaults?.verboseDefault,
      contextLimits: charterContextLimits,
      identity: charterRuntimeProfile?.identity,
      subagents: charterRuntimeProfile?.subagents,
      embeddedPi: charterRuntimeProfile?.embeddedPi,
      tools: charterRuntimeProfile?.tools,
    };
  }
  return {
    ...configured,
    name: configured.name ?? charterRuntimeProfile?.name,
    contextLimits: mergeContextLimitsWithCharterHints(
      configured.contextLimits,
      charterRuntimeProfile?.contextLimits,
    ),
    identity: mergeIdentityWithCharter(configured.identity, charterRuntimeProfile?.identity),
    subagents: mergeSubagentsWithCharter(configured.subagents, charterRuntimeProfile?.subagents),
    embeddedPi: mergeEmbeddedPiWithCharter(
      configured.embeddedPi,
      charterRuntimeProfile?.embeddedPi,
    ),
    tools: mergeToolsWithCharter(configured.tools, charterRuntimeProfile?.tools),
  };
}

export function resolveAgentContextLimits(
  cfg: OpenClawConfig | undefined,
  agentId?: string | null,
): AgentContextLimitsConfig | undefined {
  const defaults = cfg?.agents?.defaults?.contextLimits;
  if (!cfg || !agentId) {
    return defaults;
  }
  return resolveAgentConfig(cfg, agentId)?.contextLimits ?? defaults;
}

export function resolveAgentWorkspaceDir(cfg: OpenClawConfig, agentId: string): string {
  const id = normalizeAgentId(agentId);
  const configured = resolveAgentConfig(cfg, id)?.workspace?.trim();
  if (configured) {
    return stripNullBytes(resolveUserPath(configured));
  }
  if (
    listAgentEntries(cfg).length > 0 &&
    !resolveAgentEntry(cfg, id) &&
    resolveGovernanceCharterAgentBlueprint(id)
  ) {
    const defaultAgentWorkspace: string = resolveAgentWorkspaceDir(
      cfg,
      resolveDefaultAgentId(cfg),
    );
    return stripNullBytes(defaultAgentWorkspace);
  }
  const defaultAgentId = resolveDefaultAgentId(cfg);
  const fallback = cfg.agents?.defaults?.workspace?.trim();
  if (id === defaultAgentId) {
    if (fallback) {
      return stripNullBytes(resolveUserPath(fallback));
    }
    return stripNullBytes(resolveDefaultAgentWorkspaceDir(process.env));
  }
  if (fallback) {
    return stripNullBytes(path.join(resolveUserPath(fallback), id));
  }
  const stateDir = resolveStateDir(process.env);
  return stripNullBytes(path.join(stateDir, `workspace-${id}`));
}

export function resolveAgentDir(
  cfg: OpenClawConfig,
  agentId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const id = normalizeAgentId(agentId);
  const configured = resolveAgentConfig(cfg, id)?.agentDir?.trim();
  if (configured) {
    return resolveUserPath(configured, env);
  }
  const root = resolveStateDir(env);
  return path.join(root, "agents", id, "agent");
}
