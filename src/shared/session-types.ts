import type { AgentToolGovernanceSummary } from "../governance/tool-governance-summary.js";
import type { AgentGovernanceRuntimeContract } from "../governance/runtime-contract.js";

export type GatewayAgentIdentity = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
};

export type GatewayAgentModel = {
  primary?: string;
  fallbacks?: string[];
};

export type GatewayAgentGovernance = AgentToolGovernanceSummary;
export type GatewayAgentGovernanceContract = AgentGovernanceRuntimeContract;

export type GatewayAgentRow = {
  id: string;
  name?: string;
  identity?: GatewayAgentIdentity;
  workspace?: string;
  model?: GatewayAgentModel;
  configured?: boolean;
  charterDeclared?: boolean;
  charterTitle?: string;
  charterLayer?: string;
  governance?: GatewayAgentGovernance;
  governanceContract?: GatewayAgentGovernanceContract;
};

export type SessionsListResultBase<TDefaults, TRow> = {
  ts: number;
  path: string;
  count: number;
  defaults: TDefaults;
  sessions: TRow[];
};

export type SessionsPatchResultBase<TEntry> = {
  ok: true;
  path: string;
  key: string;
  entry: TEntry;
};
