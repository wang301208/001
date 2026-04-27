import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { resolveAgentToolGovernanceSummary } from "./tool-governance-summary.js";

function formatLimitedList(items: string[], limit = 6): string {
  if (items.length <= limit) {
    return items.join(", ");
  }
  return `${items.slice(0, limit).join(", ")} (+${items.length - limit} more)`;
}

function resolveConfiguredAgentIds(cfg: OpenClawConfig): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of cfg.agents?.list ?? []) {
    const id = normalizeOptionalString(entry?.id);
    if (!id) {
      continue;
    }
    const normalized = normalizeAgentId(id);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function buildUnknownAgentIdMessage(params: {
  cfg: OpenClawConfig;
  rawAgentId: string;
  inspectHint?: string;
}): string {
  const rawAgentId = normalizeOptionalString(params.rawAgentId) ?? params.rawAgentId.trim();
  const knownAgents = Array.from(new Set(listAgentIds(params.cfg).map((id) => normalizeAgentId(id))));
  const configured = new Set(resolveConfiguredAgentIds(params.cfg));
  const defaultId = normalizeAgentId(resolveDefaultAgentId(params.cfg));
  const charterOnlyAgents = knownAgents.filter((id) => id !== defaultId && !configured.has(id));

  const parts = [
    `Unknown agent id "${rawAgentId}".`,
    `Known agents: ${knownAgents.length > 0 ? formatLimitedList(knownAgents) : "none"}.`,
    `Default: ${defaultId}.`,
  ];
  if (charterOnlyAgents.length > 0) {
    parts.push(`Charter-only: ${formatLimitedList(charterOnlyAgents, 4)}.`);
  }
  if (params.inspectHint) {
    parts.push(params.inspectHint);
  }
  return parts.join(" ");
}

export function buildAgentGovernanceSelectionHint(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): string | undefined {
  const governance = resolveAgentToolGovernanceSummary({
    cfg: params.cfg,
    agentId: params.agentId,
  });
  if (!governance.charterDeclared && !governance.freezeActive) {
    return undefined;
  }

  const details: string[] = [];
  if (governance.charterDeclared) {
    const charterLabel = [governance.charterLayer, governance.charterTitle]
      .filter((value): value is string => Boolean(value))
      .join(" / ");
    if (charterLabel) {
      details.push(`charter ${charterLabel}`);
    }
    const restrictions: string[] = [];
    if (governance.charterToolDeny.length > 0) {
      restrictions.push(`deny ${formatLimitedList(governance.charterToolDeny, 4)}`);
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
      details.push(restrictions.join(", "));
    }
  }
  if (governance.freezeActive) {
    const freezeParts = [
      `freeze active${governance.freezeReasonCode ? ` (${governance.freezeReasonCode})` : ""}`,
    ];
    if (governance.freezeDeny.length > 0) {
      freezeParts.push(`deny ${formatLimitedList(governance.freezeDeny, 4)}`);
    }
    details.push(freezeParts.join(", "));
  }
  return details.length > 0
    ? `Governance for "${params.agentId}": ${details.join("; ")}`
    : undefined;
}
