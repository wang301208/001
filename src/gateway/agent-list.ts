import fs from "node:fs";
import path from "node:path";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveStateDir } from "../config/paths.js";
import type { SessionScope } from "../config/sessions.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { listGovernanceCharterAgentBlueprints } from "../governance/charter-agents.js";
import { resolveAgentGovernanceRuntimeContract } from "../governance/runtime-contract.js";
import { resolveAgentToolGovernanceSummary } from "../governance/tool-governance-summary.js";
import { normalizeAgentId, normalizeMainKey } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import type {
  GatewayAgentGovernance,
  GatewayAgentGovernanceContract,
} from "../shared/session-types.js";

export type GatewayAgentListRow = {
  id: string;
  name?: string;
  configured: boolean;
  charterDeclared: boolean;
  charterTitle?: string;
  charterLayer?: string;
  governance: GatewayAgentGovernance;
  governanceContract: GatewayAgentGovernanceContract;
};

function listExistingAgentIdsFromDisk(): string[] {
  const root = resolveStateDir();
  const agentsDir = path.join(root, "agents");
  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalizeAgentId(entry.name))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listConfiguredAgentIds(cfg: ZhushouConfig): string[] {
  const ids = new Set<string>();
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  ids.add(defaultId);

  for (const entry of cfg.agents?.list ?? []) {
    if (entry?.id) {
      ids.add(normalizeAgentId(entry.id));
    }
  }

  for (const id of listExistingAgentIdsFromDisk()) {
    ids.add(id);
  }

  const sorted = Array.from(ids).filter(Boolean);
  sorted.sort((a, b) => a.localeCompare(b));
  return sorted.includes(defaultId)
    ? [defaultId, ...sorted.filter((id) => id !== defaultId)]
    : sorted;
}

export function listGatewayAgentsBasic(cfg: ZhushouConfig): {
  defaultId: string;
  mainKey: string;
  scope: SessionScope;
  agents: GatewayAgentListRow[];
} {
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const scope = cfg.session?.scope ?? "per-sender";
  const configuredById = new Map<string, { name?: string }>();
  for (const entry of cfg.agents?.list ?? []) {
    if (!entry?.id) {
      continue;
    }
    configuredById.set(normalizeAgentId(entry.id), {
      name: normalizeOptionalString(entry.name),
    });
  }
  const explicitIds = new Set(
    (cfg.agents?.list ?? [])
      .map((entry) => (entry?.id ? normalizeAgentId(entry.id) : ""))
      .filter(Boolean),
  );
  const charterAgents = explicitIds.size > 0 ? listGovernanceCharterAgentBlueprints() : [];
  const charterById = new Map(charterAgents.map((agent) => [agent.id, agent] as const));
  const allowedIds = explicitIds.size > 0 ? new Set([...explicitIds, defaultId]) : null;
  let agentIds = listConfiguredAgentIds(cfg).filter((id) =>
    allowedIds ? allowedIds.has(id) : true,
  );
  for (const charterAgent of charterAgents) {
    if (!agentIds.includes(charterAgent.id)) {
      agentIds.push(charterAgent.id);
    }
  }
  if (mainKey && !agentIds.includes(mainKey) && (!allowedIds || allowedIds.has(mainKey))) {
    agentIds.push(mainKey);
  }
  const agents = agentIds.map((id) => {
    const meta = configuredById.get(id);
    const charterAgent = charterById.get(id);
    const governanceContract = resolveAgentGovernanceRuntimeContract({ cfg, agentId: id });
    const governance = resolveAgentToolGovernanceSummary({ cfg, agentId: id });
    return {
      id,
      name: meta?.name ?? charterAgent?.title,
      configured: explicitIds.has(id),
      charterDeclared: governance.charterDeclared,
      charterTitle: governance.charterTitle,
      charterLayer: governance.charterLayer,
      governance,
      governanceContract,
    };
  });
  return { defaultId, mainKey, scope, agents };
}
