import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import {
  resolveAgentToolGovernanceSummary,
  type AgentToolGovernanceSummary,
} from "./tool-governance-summary.js";

export type AgentGovernanceRuntimeSnapshot = {
  agentId: string;
  observedAt: number;
  summary: AgentToolGovernanceSummary;
};

export function createAgentGovernanceRuntimeSnapshot(params: {
  cfg?: OpenClawConfig;
  agentId?: string;
  observedAt?: number;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): AgentGovernanceRuntimeSnapshot | undefined {
  if (!params.cfg) {
    return undefined;
  }
  const rawAgentId = normalizeOptionalString(params.agentId);
  if (!rawAgentId) {
    return undefined;
  }
  const agentId = normalizeAgentId(rawAgentId);
  return {
    agentId,
    observedAt: params.observedAt ?? Date.now(),
    summary: resolveAgentToolGovernanceSummary({
      cfg: params.cfg,
      agentId,
      charterDir: params.charterDir,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
  };
}
