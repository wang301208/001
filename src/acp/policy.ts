import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  formatGovernanceEnforcementMessage,
  resolveGovernanceEnforcementState,
} from "../governance/charter-runtime.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { AcpRuntimeError } from "./runtime/errors.js";

const ACP_DISABLED_MESSAGE = "ACP is disabled by policy (`acp.enabled=false`).";
const ACP_DISPATCH_DISABLED_MESSAGE =
  "ACP dispatch is disabled by policy (`acp.dispatch.enabled=false`).";

export type AcpDispatchPolicyState =
  | "enabled"
  | "acp_disabled"
  | "dispatch_disabled"
  | "governance_frozen";

export function isAcpEnabledByPolicy(cfg: OpenClawConfig): boolean {
  return cfg.acp?.enabled !== false;
}

export function resolveAcpDispatchPolicyState(
  cfg: OpenClawConfig,
  options: { charterDir?: string } = {},
): AcpDispatchPolicyState {
  if (!isAcpEnabledByPolicy(cfg)) {
    return "acp_disabled";
  }
  // ACP dispatch is enabled unless explicitly disabled.
  if (cfg.acp?.dispatch?.enabled === false) {
    return "dispatch_disabled";
  }
  const governance = resolveGovernanceEnforcementState(cfg, options);
  if (governance.active) {
    return "governance_frozen";
  }
  return "enabled";
}

export function isAcpDispatchEnabledByPolicy(
  cfg: OpenClawConfig,
  options: { charterDir?: string } = {},
): boolean {
  return resolveAcpDispatchPolicyState(cfg, options) === "enabled";
}

export function resolveAcpDispatchPolicyMessage(
  cfg: OpenClawConfig,
  options: { charterDir?: string } = {},
): string | null {
  const state = resolveAcpDispatchPolicyState(cfg, options);
  if (state === "acp_disabled") {
    return ACP_DISABLED_MESSAGE;
  }
  if (state === "dispatch_disabled") {
    return ACP_DISPATCH_DISABLED_MESSAGE;
  }
  if (state === "governance_frozen") {
    const governance = resolveGovernanceEnforcementState(cfg, options);
    return formatGovernanceEnforcementMessage({
      subject: "ACP dispatch",
      enforcement: governance,
    });
  }
  return null;
}

export function resolveAcpDispatchPolicyError(
  cfg: OpenClawConfig,
  options: { charterDir?: string } = {},
): AcpRuntimeError | null {
  const message = resolveAcpDispatchPolicyMessage(cfg, options);
  if (!message) {
    return null;
  }
  return new AcpRuntimeError("ACP_DISPATCH_DISABLED", message);
}

export function isAcpAgentAllowedByPolicy(cfg: OpenClawConfig, agentId: string): boolean {
  const allowed = (cfg.acp?.allowedAgents ?? [])
    .map((entry) => normalizeAgentId(entry))
    .filter(Boolean);
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(normalizeAgentId(agentId));
}

export function resolveAcpAgentPolicyError(
  cfg: OpenClawConfig,
  agentId: string,
): AcpRuntimeError | null {
  if (isAcpAgentAllowedByPolicy(cfg, agentId)) {
    return null;
  }
  return new AcpRuntimeError(
    "ACP_SESSION_INIT_FAILED",
    `ACP agent "${normalizeAgentId(agentId)}" is not allowed by policy.`,
  );
}
