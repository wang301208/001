import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { type GovernanceEnforcementState } from "./charter-runtime.js";
import { resolveAgentGovernanceRuntimeContract } from "./runtime-contract.js";

export type AgentToolGovernanceSummary = {
  charterDeclared: boolean;
  charterTitle?: string;
  charterLayer?: string;
  charterRole?: string;
  charterContractValid?: boolean;
  charterContractIssues?: string[];
  charterToolDeny: string[];
  charterRequireAgentId: boolean;
  charterExecutionContract?: "default" | "strict-agentic";
  charterElevatedLocked: boolean;
  freezeActive: boolean;
  freezeReasonCode?: GovernanceEnforcementState["reasonCode"];
  freezeDeny: string[];
  freezeDetails: string[];
  activeSovereigntyIncidentCount: number;
  activeSovereigntyIncidentIds: string[];
  activeSovereigntyFreezeIncidentIds: string[];
};

export function createEmptyAgentToolGovernanceSummary(): AgentToolGovernanceSummary {
  return {
    charterDeclared: false,
    charterContractValid: true,
    charterContractIssues: [],
    charterToolDeny: [],
    charterRequireAgentId: false,
    charterElevatedLocked: false,
    freezeActive: false,
    freezeDeny: [],
    freezeDetails: [],
    activeSovereigntyIncidentCount: 0,
    activeSovereigntyIncidentIds: [],
    activeSovereigntyFreezeIncidentIds: [],
  };
}

export function resolveAgentToolGovernanceSummary(params: {
  cfg: OpenClawConfig;
  agentId: string;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): AgentToolGovernanceSummary {
  const contract = resolveAgentGovernanceRuntimeContract({
    cfg: params.cfg,
    agentId: normalizeAgentId(params.agentId),
    charterDir: params.charterDir,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });

  return {
    charterDeclared: contract.charterDeclared,
    charterTitle: contract.charterTitle,
    charterLayer: contract.charterLayer,
    charterRole: contract.charterRole,
    charterContractValid: contract.charterContractValid,
    charterContractIssues: [...(contract.charterContractIssues ?? [])],
    charterToolDeny: [...contract.charterToolDeny],
    charterRequireAgentId: contract.charterRequireAgentId,
    charterExecutionContract: contract.charterExecutionContract,
    charterElevatedLocked: contract.charterElevatedLocked,
    freezeActive: contract.freezeActive,
    freezeReasonCode: contract.freezeReasonCode,
    freezeDeny: [...contract.freezeDeny],
    freezeDetails: [...contract.freezeDetails],
    activeSovereigntyIncidentCount: contract.activeSovereigntyIncidentCount,
    activeSovereigntyIncidentIds: [...contract.activeSovereigntyIncidentIds],
    activeSovereigntyFreezeIncidentIds: [...contract.activeSovereigntyFreezeIncidentIds],
  };
}

export function buildAgentToolGovernancePrompt(params: {
  cfg: OpenClawConfig;
  agentId: string;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): string | undefined {
  const governance = resolveAgentToolGovernanceSummary(params);
  if (!governance.charterDeclared && !governance.freezeActive) {
    return undefined;
  }

  const lines = ["## Governance Runtime State"];
  if (governance.charterDeclared) {
    const charterLabel = [governance.charterLayer, governance.charterTitle]
      .filter((value): value is string => Boolean(value))
      .join(" / ");
    if (charterLabel) {
      lines.push(`Charter runtime: ${charterLabel}`);
    }
    if (governance.charterRole) {
      lines.push(`Charter role id: ${governance.charterRole}`);
    }
    const restrictions: string[] = [];
    if (governance.charterToolDeny.length > 0) {
      restrictions.push(`deny ${governance.charterToolDeny.join(", ")}`);
    }
    if (governance.charterRequireAgentId) {
      restrictions.push("explicit subagent ids");
    }
    if (governance.charterExecutionContract) {
      restrictions.push(`execution=${governance.charterExecutionContract}`);
    }
    if (governance.charterElevatedLocked) {
      restrictions.push("elevated locked");
    }
    if (restrictions.length > 0) {
      lines.push(`Charter restrictions: ${restrictions.join("; ")}`);
    }
    if (governance.charterContractValid === false && (governance.charterContractIssues?.length ?? 0) > 0) {
      lines.push(`Charter contract issues: ${governance.charterContractIssues?.join(" | ")}`);
    }
  }
  if (governance.freezeActive) {
    lines.push(
      `Governance freeze: active${governance.freezeReasonCode ? ` (${governance.freezeReasonCode})` : ""}`,
    );
    if (governance.freezeDeny.length > 0) {
      lines.push(`Freeze deny: ${governance.freezeDeny.join(", ")}`);
    }
    if (governance.freezeDetails.length > 0) {
      lines.push(`Freeze details: ${governance.freezeDetails.join(" | ")}`);
    }
    if (governance.activeSovereigntyFreezeIncidentIds.length > 0) {
      lines.push(`Open sovereignty incidents: ${governance.activeSovereigntyFreezeIncidentIds.join(", ")}`);
    }
    lines.push(
      "During a governance freeze, operate read-only and avoid denied tools even if they appear elsewhere.",
    );
  }
  return lines.join("\n");
}
