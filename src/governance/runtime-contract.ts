import type { ZhushouConfig } from "../config/types.zhushou.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import {
  resolveGovernanceCharterAgentBlueprint,
  resolveGovernanceCharterAgentRuntimeProfile,
  resolveGovernanceCharterDeclaredCollaborators,
} from "./charter-agents.js";
import {
  resolveGovernanceEnforcementState,
  type GovernanceEnforcementState,
} from "./charter-runtime.js";

const INVALID_CHARTER_CONTRACT_TOOL_DENY = [
  "apply_patch",
  "write",
  "edit",
  "exec",
  "process",
  "gateway",
  "cron",
  "subagents",
  "sessions_spawn",
  "nodes",
  "web_fetch",
  "web_search",
] as const;

export type AgentGovernanceRuntimeContract = {
  agentId: string;
  charterDeclared: boolean;
  charterTitle?: string;
  charterLayer?: string;
  charterClass?: string;
  charterStatus?: string;
  charterRole?: string;
  charterContractValid?: boolean;
  charterContractIssues?: string[];
  missionPrimary?: string;
  authorityLevel?: string;
  collaborators: string[];
  reportsTo: string[];
  mutationAllow: string[];
  mutationDeny: string[];
  allowedTools?: string[];
  memoryScope?: string[];
  qaRequirements?: string[];
  writeScope?: string[];
  promotionGates?: string[];
  networkDefault?: string;
  networkConditions: string[];
  runtimeHooks: string[];
  resourceBudget?: {
    tokens?: string;
    parallelism?: string;
    runtime?: string;
  };
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
  effectiveToolDeny: string[];
};

export type AgentGovernanceToolDenialExplanation = {
  toolName: string;
  deniedByCharter: boolean;
  deniedByFreeze: boolean;
  message: string;
};

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((a, b) => a.localeCompare(b));
}

function normalizeGovernanceToolName(value: string | undefined): string {
  return normalizeOptionalString(value)?.toLowerCase() ?? "";
}

function formatGovernanceAgentLabel(contract: AgentGovernanceRuntimeContract): string {
  const charterLabel = [contract.charterLayer, contract.charterTitle]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
  return charterLabel
    ? `agent "${contract.agentId}" (${charterLabel})`
    : `agent "${contract.agentId}"`;
}

export function createEmptyAgentGovernanceRuntimeContract(
  agentId = "main",
): AgentGovernanceRuntimeContract {
  return {
    agentId: normalizeAgentId(agentId),
    charterDeclared: false,
    charterContractValid: true,
    charterContractIssues: [],
    collaborators: [],
    reportsTo: [],
    mutationAllow: [],
    mutationDeny: [],
    allowedTools: [],
    memoryScope: [],
    qaRequirements: [],
    writeScope: [],
    promotionGates: [],
    networkConditions: [],
    runtimeHooks: [],
    charterToolDeny: [],
    charterRequireAgentId: false,
    charterElevatedLocked: false,
    freezeActive: false,
    freezeDeny: [],
    freezeDetails: [],
    activeSovereigntyIncidentCount: 0,
    activeSovereigntyIncidentIds: [],
    activeSovereigntyFreezeIncidentIds: [],
    effectiveToolDeny: [],
  };
}

export function resolveAgentGovernanceRuntimeContract(params: {
  cfg: ZhushouConfig;
  agentId: string;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): AgentGovernanceRuntimeContract {
  const agentId = normalizeAgentId(params.agentId);
  const blueprint = resolveGovernanceCharterAgentBlueprint(agentId, {
    charterDir: params.charterDir,
  });
  const runtimeProfile = resolveGovernanceCharterAgentRuntimeProfile(agentId, {
    charterDir: params.charterDir,
  });
  const enforcement = resolveGovernanceEnforcementState(params.cfg, {
    charterDir: params.charterDir,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const charterToolDeny = Array.isArray(runtimeProfile?.tools?.deny)
    ? collectUniqueStrings(runtimeProfile.tools.deny)
    : [];
  const freezeDeny = collectUniqueStrings(enforcement.denyTools);

  return {
    ...createEmptyAgentGovernanceRuntimeContract(agentId),
    charterDeclared: Boolean(blueprint),
    charterTitle: blueprint?.title,
    charterLayer: blueprint?.layer,
    charterClass: blueprint?.class,
    charterStatus: blueprint?.status,
    charterRole: blueprint?.role,
    charterContractValid: blueprint?.contractValid !== false,
    charterContractIssues: blueprint?.contractIssues ? [...blueprint.contractIssues] : [],
    missionPrimary: blueprint?.missionPrimary,
    authorityLevel: blueprint?.authorityLevel,
    collaborators: blueprint
      ? resolveGovernanceCharterDeclaredCollaborators(agentId, { charterDir: params.charterDir })
      : [],
    reportsTo: blueprint?.reportsTo ? [...blueprint.reportsTo] : [],
    mutationAllow: blueprint?.mutationAllow ? [...blueprint.mutationAllow] : [],
    mutationDeny: blueprint?.mutationDeny ? [...blueprint.mutationDeny] : [],
    allowedTools: blueprint?.allowedTools ? [...blueprint.allowedTools] : [],
    memoryScope: blueprint?.memoryScope ? [...blueprint.memoryScope] : [],
    qaRequirements: blueprint?.qaRequirements ? [...blueprint.qaRequirements] : [],
    writeScope: blueprint?.writeScope ? [...blueprint.writeScope] : [],
    promotionGates: blueprint?.promotionGates ? [...blueprint.promotionGates] : [],
    networkDefault: blueprint?.networkDefault,
    networkConditions: blueprint?.networkConditions ? [...blueprint.networkConditions] : [],
    runtimeHooks: blueprint?.runtimeHooks ? [...blueprint.runtimeHooks] : [],
    resourceBudget: blueprint?.resourceBudget ? { ...blueprint.resourceBudget } : undefined,
    charterToolDeny: collectUniqueStrings([
      ...charterToolDeny,
      ...(blueprint && !blueprint.contractValid ? [...INVALID_CHARTER_CONTRACT_TOOL_DENY] : []),
    ]),
    charterRequireAgentId: runtimeProfile?.subagents?.requireAgentId === true,
    charterExecutionContract: runtimeProfile?.embeddedPi?.executionContract,
    charterElevatedLocked: runtimeProfile?.tools?.elevated?.enabled === false,
    freezeActive: enforcement.active,
    freezeReasonCode: enforcement.reasonCode,
    freezeDeny,
    freezeDetails: [...enforcement.details],
    activeSovereigntyIncidentCount: enforcement.activeSovereigntyIncidentIds.length,
    activeSovereigntyIncidentIds: [...enforcement.activeSovereigntyIncidentIds],
    activeSovereigntyFreezeIncidentIds: [...enforcement.activeSovereigntyFreezeIncidentIds],
    effectiveToolDeny: collectUniqueStrings([...charterToolDeny, ...freezeDeny]),
  };
}

export function resolveAgentGovernanceToolPolicy(params: {
  cfg: ZhushouConfig;
  agentId?: string;
  charterDir?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): { deny: string[] } | undefined {
  const fallbackEnforcement = resolveGovernanceEnforcementState(params.cfg, {
    charterDir: params.charterDir,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  if (!params.agentId) {
    return fallbackEnforcement.active && fallbackEnforcement.denyTools.length > 0
      ? { deny: collectUniqueStrings(fallbackEnforcement.denyTools) }
      : undefined;
  }
  const contract = resolveAgentGovernanceRuntimeContract({
    cfg: params.cfg,
    agentId: params.agentId,
    charterDir: params.charterDir,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  return contract.effectiveToolDeny.length > 0 ? { deny: contract.effectiveToolDeny } : undefined;
}

export function explainAgentGovernanceToolDenial(params: {
  contract: AgentGovernanceRuntimeContract;
  toolName: string;
}): AgentGovernanceToolDenialExplanation | undefined {
  const toolName = normalizeGovernanceToolName(params.toolName) || "tool";
  const deniedByCharter = params.contract.charterToolDeny.some(
    (entry) => normalizeGovernanceToolName(entry) === toolName,
  );
  const deniedByFreeze = params.contract.freezeDeny.some(
    (entry) => normalizeGovernanceToolName(entry) === toolName,
  );
  if (!deniedByCharter && !deniedByFreeze) {
    return undefined;
  }

  const agentLabel = formatGovernanceAgentLabel(params.contract);
  const reasonSuffix =
    deniedByFreeze && params.contract.freezeReasonCode
      ? ` (${params.contract.freezeReasonCode})`
      : "";
  const lines: string[] = [];

  if (deniedByCharter && deniedByFreeze) {
    lines.push(
      `Tool "${toolName}" is denied by governance contract for ${agentLabel} and is also blocked by an active governance freeze${reasonSuffix}.`,
    );
  } else if (deniedByFreeze) {
    lines.push(
      `Tool "${toolName}" is blocked by an active governance freeze for ${agentLabel}${reasonSuffix}.`,
    );
  } else {
    lines.push(`Tool "${toolName}" is denied by governance contract for ${agentLabel}.`);
  }

  if (deniedByCharter) {
    const charterRestrictions: string[] = [];
    if (params.contract.charterExecutionContract) {
      charterRestrictions.push(`execution=${params.contract.charterExecutionContract}`);
    }
    if (params.contract.charterRequireAgentId) {
      charterRestrictions.push("explicit subagent ids");
    }
    if (params.contract.charterElevatedLocked) {
      charterRestrictions.push("elevated locked");
    }
    if (
      params.contract.charterContractValid === false &&
      (params.contract.charterContractIssues?.length ?? 0) > 0
    ) {
      charterRestrictions.push(`contract invalid: ${params.contract.charterContractIssues?.join("; ")}`);
    }
    if (charterRestrictions.length > 0) {
      lines.push(`Charter runtime: ${charterRestrictions.join("; ")}`);
    }
  }

  if (deniedByFreeze && params.contract.activeSovereigntyFreezeIncidentIds.length > 0) {
    lines.push(
      `Open sovereignty incidents: ${params.contract.activeSovereigntyFreezeIncidentIds.join(", ")}`,
    );
  }

  if (deniedByFreeze && params.contract.freezeDetails.length > 0) {
    lines.push(`details:\n${params.contract.freezeDetails.map((entry) => `- ${entry}`).join("\n")}`);
  }

  return {
    toolName,
    deniedByCharter,
    deniedByFreeze,
    message: lines.join("\n"),
  };
}
