import type { HeartbeatEventPayload } from "../infra/heartbeat-events.js";
import type { Tone } from "../memory-host-sdk/status.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import type { TableColumn } from "../terminal/table.js";
import type { HealthSummary } from "./health.js";
import { summarizeStatusAgents } from "./status-overview-values.ts";
import type { AgentLocalStatus } from "./status.agent-local.js";
import type { MemoryStatusSnapshot, MemoryPluginStatus } from "./status.scan.shared.js";
import type {
  SessionStatus,
  StatusAutonomySnapshot,
  StatusGovernanceSnapshot,
  StatusSummary,
} from "./status.types.js";

type AgentStatusLike = {
  defaultId?: string | null;
  bootstrapPendingCount: number;
  totalSessions: number;
  agents: Array<Pick<AgentLocalStatus, "id" | "lastActiveAgeMs" | "governance">>;
};

type SummaryLike = Pick<StatusSummary, "tasks" | "taskAudit" | "heartbeat" | "sessions">;
type MemoryLike = MemoryStatusSnapshot | null;
type MemoryPluginLike = MemoryPluginStatus;
type SessionsRecentLike = SessionStatus;

type PluginCompatibilityNoticeLike = {
  severity?: "warn" | "info" | null;
};

type PairingRecoveryLike = {
  requestId?: string | null;
};

const STATUS_SEPARATOR = " | ";

function formatInlineList(values: string[], empty = "none"): string {
  return values.length > 0 ? values.join(", ") : empty;
}

function formatStageCounts(stageCounts: {
  ready: number;
  waiting: number;
  blocked: number;
}): string {
  return `ready ${stageCounts.ready}${STATUS_SEPARATOR}waiting ${stageCounts.waiting}${STATUS_SEPARATOR}blocked ${stageCounts.blocked}`;
}

export const statusHealthColumns: TableColumn[] = [
  { key: "Item", header: "Item", minWidth: 10 },
  { key: "Status", header: "Status", minWidth: 8 },
  { key: "Detail", header: "Detail", flex: true, minWidth: 28 },
];

export function buildStatusAgentsValue(params: {
  agentStatus: AgentStatusLike;
  formatTimeAgo: (ageMs: number) => string;
}) {
  const summary = summarizeStatusAgents({
    agentStatus: params.agentStatus,
  });
  const pending =
    params.agentStatus.bootstrapPendingCount > 0
      ? `${params.agentStatus.bootstrapPendingCount} bootstrap file${params.agentStatus.bootstrapPendingCount === 1 ? "" : "s"} present`
      : "no bootstrap files";
  const def = params.agentStatus.agents.find((a) => a.id === params.agentStatus.defaultId);
  const defActive =
    def?.lastActiveAgeMs != null ? params.formatTimeAgo(def.lastActiveAgeMs) : "unknown";
  const defSuffix = def ? `${STATUS_SEPARATOR}default ${def.id} active ${defActive}` : "";
  return [
    `${summary.totalAgents} total`,
    `${summary.charteredAgents} chartered`,
    `${summary.frozenAgents} frozen`,
    pending,
    `${summary.totalSessions} sessions`,
  ].join(STATUS_SEPARATOR) + defSuffix;
}

export function buildStatusTasksValue(params: {
  summary: Pick<SummaryLike, "tasks" | "taskAudit">;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (params.summary.tasks.total <= 0) {
    return params.muted("none");
  }
  return [
    `${params.summary.tasks.active} active`,
    `${params.summary.tasks.byStatus.queued} queued`,
    `${params.summary.tasks.byStatus.running} running`,
    params.summary.tasks.failures > 0
      ? params.warn(
          `${params.summary.tasks.failures} issue${params.summary.tasks.failures === 1 ? "" : "s"}`,
        )
      : params.muted("no issues"),
    params.summary.taskAudit.errors > 0
      ? params.warn(
          `audit ${params.summary.taskAudit.errors} error${params.summary.taskAudit.errors === 1 ? "" : "s"}${STATUS_SEPARATOR}${params.summary.taskAudit.warnings} warn`,
        )
      : params.summary.taskAudit.warnings > 0
        ? params.muted(`audit ${params.summary.taskAudit.warnings} warn`)
        : params.muted("audit clean"),
    `${params.summary.tasks.total} tracked`,
  ].join(STATUS_SEPARATOR);
}

export function buildStatusHeartbeatValue(params: { summary: Pick<SummaryLike, "heartbeat"> }) {
  const parts = params.summary.heartbeat.agents
    .map((agent) => {
      if (!agent.enabled || !agent.everyMs) {
        return `disabled (${agent.agentId})`;
      }
      return `${agent.every} (${agent.agentId})`;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "disabled";
}

export function buildStatusLastHeartbeatValue(params: {
  deep?: boolean;
  gatewayReachable: boolean;
  lastHeartbeat: HeartbeatEventPayload | null;
  warn: (value: string) => string;
  muted: (value: string) => string;
  formatTimeAgo: (ageMs: number) => string;
}) {
  if (!params.deep) {
    return null;
  }
  if (!params.gatewayReachable) {
    return params.warn("unavailable");
  }
  if (!params.lastHeartbeat) {
    return params.muted("none");
  }
  const age = params.formatTimeAgo(Date.now() - params.lastHeartbeat.ts);
  const channel = params.lastHeartbeat.channel ?? "unknown";
  const accountLabel = params.lastHeartbeat.accountId
    ? `account ${params.lastHeartbeat.accountId}`
    : null;
  return [params.lastHeartbeat.status, `${age} ago`, channel, accountLabel]
    .filter(Boolean)
    .join(STATUS_SEPARATOR);
}

export function buildStatusMemoryValue(params: {
  memory: MemoryLike;
  memoryPlugin: MemoryPluginLike;
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
  resolveMemoryVectorState: (value: NonNullable<MemoryStatusSnapshot["vector"]>) => {
    state: string;
    tone: Tone;
  };
  resolveMemoryFtsState: (value: NonNullable<MemoryStatusSnapshot["fts"]>) => {
    state: string;
    tone: Tone;
  };
  resolveMemoryCacheSummary: (value: NonNullable<MemoryStatusSnapshot["cache"]>) => {
    text: string;
    tone: Tone;
  };
}) {
  if (!params.memoryPlugin.enabled) {
    const suffix = params.memoryPlugin.reason ? ` (${params.memoryPlugin.reason})` : "";
    return params.muted(`disabled${suffix}`);
  }
  if (!params.memory) {
    const slot = params.memoryPlugin.slot ? `plugin ${params.memoryPlugin.slot}` : "plugin";
    return params.muted(`enabled (${slot})${STATUS_SEPARATOR}unavailable`);
  }
  const parts: string[] = [];
  const dirtySuffix = params.memory.dirty ? `${STATUS_SEPARATOR}${params.warn("dirty")}` : "";
  parts.push(`${params.memory.files} files${STATUS_SEPARATOR}${params.memory.chunks} chunks${dirtySuffix}`);
  if (params.memory.sources?.length) {
    parts.push(`sources ${params.memory.sources.join(", ")}`);
  }
  if (params.memoryPlugin.slot) {
    parts.push(`plugin ${params.memoryPlugin.slot}`);
  }
  const colorByTone = (tone: Tone, text: string) =>
    tone === "ok" ? params.ok(text) : tone === "warn" ? params.warn(text) : params.muted(text);
  if (params.memory.vector) {
    const state = params.resolveMemoryVectorState(params.memory.vector);
    const label = state.state === "disabled" ? "vector off" : `vector ${state.state}`;
    parts.push(colorByTone(state.tone, label));
  }
  if (params.memory.fts) {
    const state = params.resolveMemoryFtsState(params.memory.fts);
    const label = state.state === "disabled" ? "fts off" : `fts ${state.state}`;
    parts.push(colorByTone(state.tone, label));
  }
  if (params.memory.cache) {
    const summary = params.resolveMemoryCacheSummary(params.memory.cache);
    parts.push(colorByTone(summary.tone, summary.text));
  }
  return parts.join(STATUS_SEPARATOR);
}

export function buildStatusSecurityAuditLines(params: {
  securityAudit: {
    summary: { critical: number; warn: number; info: number };
    findings: Array<{
      severity: "critical" | "warn" | "info";
      title: string;
      detail: string;
      remediation?: string | null;
    }>;
  };
  theme: {
    error: (value: string) => string;
    warn: (value: string) => string;
    muted: (value: string) => string;
  };
  shortenText: (value: string, maxLen: number) => string;
  formatCliCommand: (value: string) => string;
}) {
  const fmtSummary = (value: { critical: number; warn: number; info: number }) => {
    return [
      params.theme.error(`${value.critical} critical`),
      params.theme.warn(`${value.warn} warn`),
      params.theme.muted(`${value.info} info`),
    ].join(STATUS_SEPARATOR);
  };
  const lines = [params.theme.muted(`Summary: ${fmtSummary(params.securityAudit.summary)}`)];
  const importantFindings = params.securityAudit.findings.filter(
    (f) => f.severity === "critical" || f.severity === "warn",
  );
  if (importantFindings.length === 0) {
    lines.push(params.theme.muted("No critical or warn findings detected."));
  } else {
    const severityLabel = (sev: "critical" | "warn" | "info") =>
      sev === "critical"
        ? params.theme.error("CRITICAL")
        : sev === "warn"
          ? params.theme.warn("WARN")
          : params.theme.muted("INFO");
    const sevRank = (sev: "critical" | "warn" | "info") =>
      sev === "critical" ? 0 : sev === "warn" ? 1 : 2;
    const shown = [...importantFindings]
      .toSorted((a, b) => sevRank(a.severity) - sevRank(b.severity))
      .slice(0, 6);
    for (const finding of shown) {
      lines.push(`  ${severityLabel(finding.severity)} ${finding.title}`);
      lines.push(`    ${params.shortenText(finding.detail.replaceAll("\n", " "), 160)}`);
      if (finding.remediation?.trim()) {
        lines.push(`    ${params.theme.muted(`Fix: ${finding.remediation.trim()}`)}`);
      }
    }
    if (importantFindings.length > shown.length) {
      lines.push(params.theme.muted(`... +${importantFindings.length - shown.length} more`));
    }
  }
  lines.push(
    params.theme.muted(`Full report: ${params.formatCliCommand("zhushou security audit")}`),
  );
  lines.push(
    params.theme.muted(`Deep probe: ${params.formatCliCommand("zhushou security audit --deep")}`),
  );
  return lines;
}

export function buildStatusHealthRows(params: {
  health: HealthSummary;
  formatHealthChannelLines: (summary: HealthSummary, opts: { accountMode: "all" }) => string[];
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  const rows: Array<Record<string, string>> = [
    {
      Item: "Gateway",
      Status: params.ok("reachable"),
      Detail: `${params.health.durationMs}ms`,
    },
  ];
  for (const line of params.formatHealthChannelLines(params.health, { accountMode: "all" })) {
    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }
    const item = line.slice(0, colon).trim();
    const detail = line.slice(colon + 1).trim();
    const normalized = normalizeLowercaseStringOrEmpty(detail);
    const status = normalized.startsWith("ok")
      ? params.ok("OK")
      : normalized.startsWith("failed")
        ? params.warn("WARN")
        : normalized.startsWith("not configured")
          ? params.muted("OFF")
          : normalized.startsWith("configured")
            ? params.ok("OK")
            : normalized.startsWith("linked")
              ? params.ok("LINKED")
              : normalized.startsWith("not linked")
                ? params.warn("UNLINKED")
                : params.warn("WARN");
    rows.push({ Item: item, Status: status, Detail: detail });
  }
  return rows;
}

export function buildStatusSessionsRows(params: {
  recent: SessionsRecentLike[];
  verbose?: boolean;
  shortenText: (value: string, maxLen: number) => string;
  formatTimeAgo: (ageMs: number) => string;
  formatTokensCompact: (value: SessionsRecentLike) => string;
  formatPromptCacheCompact: (value: SessionsRecentLike) => string | null;
  muted: (value: string) => string;
}) {
  if (params.recent.length === 0) {
    return [
      {
        Key: params.muted("no sessions yet"),
        Kind: "",
        Age: "",
        Model: "",
        Tokens: "",
        ...(params.verbose ? { Cache: "" } : {}),
      },
    ];
  }
  return params.recent.map((sess) => ({
    Key: params.shortenText(sess.key, 32),
    Kind: sess.kind,
    Age: sess.updatedAt && sess.age != null ? params.formatTimeAgo(sess.age) : "no activity",
    Model: sess.model ?? "unknown",
    Tokens: params.formatTokensCompact(sess),
    ...(params.verbose
      ? { Cache: params.formatPromptCacheCompact(sess) || params.muted("-") }
      : {}),
  }));
}

export function buildStatusGovernanceLines(params: {
  governance?: StatusGovernanceSnapshot;
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (!params.governance) {
    return [];
  }

  const lines: string[] = [];
  lines.push(
    [
      `Summary: ${params.governance.discovered ? params.ok("charter present") : params.warn("charter missing")}`,
      params.governance.freezeActive
        ? params.warn(`freeze ${params.governance.freezeReasonCode ?? "active"}`)
        : params.ok("freeze open"),
      `proposals ${params.governance.proposalSummary.pending}/${params.governance.proposalSummary.total} pending/total`,
    ].join(STATUS_SEPARATOR),
  );
  lines.push(
    params.muted(
      [
        "Findings:",
        `${params.governance.findingSummary.critical} critical`,
        `${params.governance.findingSummary.warn} warn`,
        `${params.governance.findingSummary.info} info`,
      ].join(` ${STATUS_SEPARATOR} `),
    ),
  );
  lines.push(
    params.muted(
      [
        `Capability inventory: ${params.governance.capabilitySummary.totalEntries} entries`,
        `${params.governance.capabilitySummary.gapCount} gaps`,
        `${params.governance.capabilitySummary.criticalGapCount} critical`,
        `${params.governance.capabilitySummary.warningGapCount} warn`,
        `${params.governance.capabilitySummary.infoGapCount} info`,
      ].join(STATUS_SEPARATOR),
    ),
  );
  if (params.governance.capabilitySummary.topGapIds.length > 0) {
    lines.push(
      params.muted(
        `  Top gaps: ${formatInlineList(params.governance.capabilitySummary.topGapIds)}`,
      ),
    );
  }
  lines.push(
    params.muted(
      [
        `Genesis: team ${params.governance.genesisSummary.teamId}`,
        params.governance.genesisSummary.teamTitle ?? "untitled",
        `mode ${params.governance.genesisSummary.mode}`,
        `${params.governance.genesisSummary.blockerCount} blockers`,
        formatStageCounts(params.governance.genesisSummary.stageCounts),
      ].join(STATUS_SEPARATOR),
    ),
  );
  if (params.governance.genesisSummary.blockers.length > 0) {
    lines.push(
      params.muted(`  Blockers: ${formatInlineList(params.governance.genesisSummary.blockers)}`),
    );
  }
  if (params.governance.genesisSummary.focusGapIds.length > 0) {
    lines.push(
      params.muted(
        `  Focus gaps: ${formatInlineList(params.governance.genesisSummary.focusGapIds)}`,
      ),
    );
  }
  if (params.governance.teamSummary) {
    lines.push(
      params.muted(
        [
          `Team: ${params.governance.teamSummary.declared ? "declared" : "undeclared"}`,
          `${params.governance.teamSummary.memberCount} members`,
          `${params.governance.teamSummary.missingMemberCount} missing`,
          `${params.governance.teamSummary.freezeActiveMemberCount} frozen`,
          `${params.governance.teamSummary.runtimeHookCount} hooks`,
          `${params.governance.teamSummary.effectiveToolDenyCount} denies`,
        ].join(STATUS_SEPARATOR),
      ),
    );
    if (params.governance.teamSummary.missingMemberIds.length > 0) {
      lines.push(
        params.muted(
          `  Missing members: ${formatInlineList(params.governance.teamSummary.missingMemberIds)}`,
        ),
      );
    }
    if (params.governance.teamSummary.freezeActiveMemberIds.length > 0) {
      lines.push(
        params.muted(
          `  Frozen members: ${formatInlineList(params.governance.teamSummary.freezeActiveMemberIds)}`,
        ),
      );
    }
  }
  return lines;
}

export function buildStatusAutonomyLines(params: {
  autonomy?: StatusAutonomySnapshot;
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (!params.autonomy) {
    return [];
  }

  const lines: string[] = [];
  lines.push(
    params.muted(
      [
        `Fleet: ${params.autonomy.fleetSummary.totalProfiles} profiles`,
        `${params.autonomy.fleetSummary.healthy} healthy`,
        `${params.autonomy.fleetSummary.idle} idle`,
        `${params.autonomy.fleetSummary.drift} drift`,
        `${params.autonomy.fleetSummary.missingLoop} missing loops`,
        `${params.autonomy.fleetSummary.activeFlows} active flows`,
      ].join(STATUS_SEPARATOR),
    ),
  );
  if (params.autonomy.fleetSummary.driftAgentIds.length > 0) {
    lines.push(
      params.warn(
        `  Drift agents: ${formatInlineList(params.autonomy.fleetSummary.driftAgentIds)}`,
      ),
    );
  }
  if (params.autonomy.fleetSummary.missingLoopAgentIds.length > 0) {
    lines.push(
      params.warn(
        `  Missing loops: ${formatInlineList(params.autonomy.fleetSummary.missingLoopAgentIds)}`,
      ),
    );
  }
  if (params.autonomy.replaySummary && params.autonomy.replaySummary.totalRunners > 0) {
    lines.push(
      params.muted(
        [
          `Replay: ${params.autonomy.replaySummary.totalRunners} scoped`,
          `${params.autonomy.replaySummary.ready} ready`,
          `${params.autonomy.replaySummary.passed} passed`,
          `${params.autonomy.replaySummary.failed} failed`,
          `${params.autonomy.replaySummary.promotable} promotable`,
          `${params.autonomy.replaySummary.blocked} blocked`,
        ].join(STATUS_SEPARATOR),
      ),
    );
    if (params.autonomy.replaySummary.readyAgentIds.length > 0) {
      lines.push(
        params.warn(
          `  Replay ready: ${formatInlineList(params.autonomy.replaySummary.readyAgentIds)}`,
        ),
      );
    }
    if (params.autonomy.replaySummary.blockedAgentIds.length > 0) {
      lines.push(
        params.warn(
          `  Blocked replay: ${formatInlineList(params.autonomy.replaySummary.blockedAgentIds)}`,
        ),
      );
    }
    if (params.autonomy.replaySummary.promotableAgentIds.length > 0) {
      lines.push(
        params.ok(
          `  Promotable agents: ${formatInlineList(params.autonomy.replaySummary.promotableAgentIds)}`,
        ),
      );
    }
  }
  lines.push(
    params.muted(
      [
        `Capability inventory: ${params.autonomy.capabilitySummary.totalEntries} entries`,
        `${params.autonomy.capabilitySummary.gapCount} gaps`,
        `${params.autonomy.capabilitySummary.criticalGapCount} critical`,
        `${params.autonomy.capabilitySummary.warningGapCount} warn`,
        `${params.autonomy.capabilitySummary.infoGapCount} info`,
      ].join(STATUS_SEPARATOR),
    ),
  );
  if (params.autonomy.capabilitySummary.topGapIds.length > 0) {
    lines.push(
      params.muted(`  Top gaps: ${formatInlineList(params.autonomy.capabilitySummary.topGapIds)}`),
    );
  }
  lines.push(
    params.muted(
      [
        `Genesis: team ${params.autonomy.genesisSummary.teamId}`,
        params.autonomy.genesisSummary.teamTitle ?? "untitled",
        `mode ${params.autonomy.genesisSummary.mode}`,
        `${params.autonomy.genesisSummary.blockerCount} blockers`,
        formatStageCounts(params.autonomy.genesisSummary.stageCounts),
      ].join(STATUS_SEPARATOR),
    ),
  );
  if (params.autonomy.genesisSummary.blockers.length > 0) {
    lines.push(
      params.muted(`  Blockers: ${formatInlineList(params.autonomy.genesisSummary.blockers)}`),
    );
  }
  if (params.autonomy.genesisSummary.focusGapIds.length > 0) {
    lines.push(
      params.muted(`  Focus gaps: ${formatInlineList(params.autonomy.genesisSummary.focusGapIds)}`),
    );
  }
  if (params.autonomy.lastSupervisorRun) {
    lines.push(
      [
        `Latest supervisor: ${params.autonomy.lastSupervisorRun.mode}`,
        params.autonomy.lastSupervisorRun.changed
          ? params.warn(
              `${params.autonomy.lastSupervisorRun.totals.changed}/${params.autonomy.lastSupervisorRun.totals.totalProfiles} changed`,
            )
          : params.ok("no changes"),
        `loops +${params.autonomy.lastSupervisorRun.totals.loopCreated}/~${params.autonomy.lastSupervisorRun.totals.loopUpdated}`,
        `flows +${params.autonomy.lastSupervisorRun.totals.flowStarted}/~${params.autonomy.lastSupervisorRun.totals.flowRestarted}`,
      ].join(STATUS_SEPARATOR),
    );
    lines.push(
      params.muted(
        `  Supervisor scope: ${formatInlineList(params.autonomy.lastSupervisorRun.agentIds)}`,
      ),
    );
    if (params.autonomy.lastSupervisorRun.changedAgentIds.length > 0) {
      lines.push(
        params.muted(
          `  Changed agents: ${formatInlineList(params.autonomy.lastSupervisorRun.changedAgentIds)}`,
        ),
      );
    }
  } else {
    lines.push(params.muted("Latest supervisor: none recorded"));
  }
  return lines;
}

export function buildStatusFooterLines(params: {
  updateHint: string | null;
  warn: (value: string) => string;
  formatCliCommand: (value: string) => string;
  nodeOnlyGateway: unknown;
  gatewayReachable: boolean;
}) {
  return [
    "FAQ: https://docs.zhushou.ai/faq",
    "Troubleshooting: https://docs.zhushou.ai/troubleshooting",
    ...(params.updateHint ? ["", params.warn(params.updateHint)] : []),
    "Next steps:",
    `  Need to share?      ${params.formatCliCommand("zhushou status --all")}`,
    `  Need to debug live? ${params.formatCliCommand("zhushou logs --follow")}`,
    params.nodeOnlyGateway
      ? `  Need node service?  ${params.formatCliCommand("zhushou node status")}`
      : params.gatewayReachable
        ? `  Need to test channels? ${params.formatCliCommand("zhushou status --deep")}`
        : `  Fix reachability first: ${params.formatCliCommand("openclaw gateway probe")}`,
  ];
}

export function buildStatusPluginCompatibilityLines<
  TNotice extends PluginCompatibilityNoticeLike,
>(params: {
  notices: TNotice[];
  limit?: number;
  formatNotice: (notice: TNotice) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (params.notices.length === 0) {
    return [];
  }
  const limit = params.limit ?? 8;
  return [
    ...params.notices.slice(0, limit).map((notice) => {
      const label = notice.severity === "warn" ? params.warn("WARN") : params.muted("INFO");
      return `  ${label} ${params.formatNotice(notice)}`;
    }),
    ...(params.notices.length > limit
      ? [params.muted(`  ... +${params.notices.length - limit} more`)]
      : []),
  ];
}

export function buildStatusPairingRecoveryLines(params: {
  pairingRecovery: PairingRecoveryLike | null;
  warn: (value: string) => string;
  muted: (value: string) => string;
  formatCliCommand: (value: string) => string;
}) {
  if (!params.pairingRecovery) {
    return [];
  }
  return [
    params.warn("Gateway pairing approval required."),
    ...(params.pairingRecovery.requestId
      ? [
          params.muted(
            `Recovery: ${params.formatCliCommand(`zhushou devices approve ${params.pairingRecovery.requestId}`)}`,
          ),
        ]
      : []),
    params.muted(`Fallback: ${params.formatCliCommand("zhushou devices approve --latest")}`),
    params.muted(`Inspect: ${params.formatCliCommand("zhushou devices list")}`),
  ];
}

export function buildStatusSystemEventsRows(params: {
  queuedSystemEvents: string[];
  limit?: number;
}) {
  const limit = params.limit ?? 5;
  if (params.queuedSystemEvents.length === 0) {
    return undefined;
  }
  return params.queuedSystemEvents.slice(0, limit).map((event) => ({ Event: event }));
}

export function buildStatusSystemEventsTrailer(params: {
  queuedSystemEvents: string[];
  limit?: number;
  muted: (value: string) => string;
}) {
  const limit = params.limit ?? 5;
  return params.queuedSystemEvents.length > limit
    ? params.muted(`... +${params.queuedSystemEvents.length - limit} more`)
    : null;
}
