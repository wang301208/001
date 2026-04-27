import type { RenderTableOptions } from "../../terminal/table.js";
import type { AgentToolGovernanceSummary } from "../../governance/tool-governance-summary.js";
import { formatTimeAgo } from "./format.js";
import type { StatusReportSection } from "./text-report.js";

type AgentStatusLike = {
  agents: Array<{
    id: string;
    name?: string | null;
    bootstrapPending?: boolean | null;
    sessionsCount: number;
    lastActiveAgeMs?: number | null;
    governance?: AgentToolGovernanceSummary;
    sessionsPath: string;
  }>;
};

type ChannelDetailLike = {
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
};

export const statusOverviewTableColumns = [
  { key: "Item", header: "Item", minWidth: 10 },
  { key: "Value", header: "Value", flex: true, minWidth: 24 },
] as const;

export const statusAgentsTableColumns = [
  { key: "Agent", header: "Agent", minWidth: 12 },
  { key: "BootstrapFile", header: "Bootstrap file", minWidth: 14 },
  { key: "Sessions", header: "Sessions", align: "right", minWidth: 8 },
  { key: "Active", header: "Active", minWidth: 10 },
  { key: "Governance", header: "Governance", flex: true, minWidth: 28 },
  { key: "Store", header: "Store", minWidth: 24 },
] as const;

function formatGovernanceCell(governance?: AgentToolGovernanceSummary): string {
  if (!governance || (!governance.charterDeclared && !governance.freezeActive)) {
    return "none";
  }

  const parts: string[] = [];
  if (governance.charterDeclared) {
    const charterLabel = [governance.charterLayer, governance.charterTitle]
      .filter((value): value is string => Boolean(value))
      .join("/");
    if (charterLabel) {
      parts.push(charterLabel);
    }
    if (governance.charterToolDeny.length > 0) {
      parts.push(`deny ${governance.charterToolDeny.join(", ")}`);
    }
    if (governance.charterRequireAgentId) {
      parts.push("explicit ids");
    }
    if (governance.charterExecutionContract) {
      parts.push(`execution=${governance.charterExecutionContract}`);
    }
    if (governance.charterElevatedLocked) {
      parts.push("elevated locked");
    }
  }
  if (governance.freezeActive) {
    parts.push(
      `freeze${governance.freezeReasonCode ? ` (${governance.freezeReasonCode})` : ""}`,
    );
    if (governance.freezeDeny.length > 0) {
      parts.push(`freeze deny ${governance.freezeDeny.join(", ")}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : "charter";
}

export function buildStatusAgentTableRows(params: {
  agentStatus: AgentStatusLike;
  ok: (text: string) => string;
  warn: (text: string) => string;
}) {
  return params.agentStatus.agents.map((agent) => ({
    Agent: agent.name?.trim() ? `${agent.id} (${agent.name.trim()})` : agent.id,
    BootstrapFile:
      agent.bootstrapPending === true
        ? params.warn("PRESENT")
        : agent.bootstrapPending === false
          ? params.ok("ABSENT")
          : "unknown",
    Sessions: String(agent.sessionsCount),
    Active: agent.lastActiveAgeMs != null ? formatTimeAgo(agent.lastActiveAgeMs) : "unknown",
    Governance: formatGovernanceCell(agent.governance),
    Store: agent.sessionsPath,
  }));
}

export function buildStatusChannelDetailSections(params: {
  details: ChannelDetailLike[];
  width: number;
  renderTable: (input: RenderTableOptions) => string;
  ok: (text: string) => string;
  warn: (text: string) => string;
}): StatusReportSection[] {
  return params.details.map((detail) => ({
    kind: "table" as const,
    title: detail.title,
    width: params.width,
    renderTable: params.renderTable,
    columns: detail.columns.map((column) => ({
      key: column,
      header: column,
      flex: column === "Notes",
      minWidth: column === "Notes" ? 28 : 10,
    })),
    rows: detail.rows.map((row) => ({
      ...row,
      ...(row.Status === "OK"
        ? { Status: params.ok("OK") }
        : row.Status === "WARN"
          ? { Status: params.warn("WARN") }
          : {}),
    })),
  }));
}
