import type { StatusAutonomySnapshot, StatusGovernanceSnapshot } from "./status.types.js";

type AgentStatusLike = {
  bootstrapPendingCount: number;
  totalSessions: number;
  agents: Array<{
    id: string;
    lastActiveAgeMs?: number | null;
    governance?: {
      charterDeclared?: boolean;
      freezeActive?: boolean;
    };
  }>;
};

type PluginCompatibilityNoticeLike = {
  pluginId?: string | null;
  plugin?: string | null;
};

type SummarySessionsLike = {
  count: number;
  paths: string[];
  defaults: {
    model?: string | null;
    contextTokens?: number | null;
  };
};

const STATUS_SEPARATOR = " | ";

export function countActiveStatusAgents(params: {
  agentStatus: AgentStatusLike;
  activeThresholdMs?: number;
}) {
  const activeThresholdMs = params.activeThresholdMs ?? 10 * 60_000;
  return params.agentStatus.agents.filter(
    (agent) => agent.lastActiveAgeMs != null && agent.lastActiveAgeMs <= activeThresholdMs,
  ).length;
}

export function summarizeStatusAgents(params: {
  agentStatus: AgentStatusLike;
  activeThresholdMs?: number;
}) {
  const activeAgents = countActiveStatusAgents(params);
  const charteredAgents = params.agentStatus.agents.filter(
    (agent) => agent.governance?.charterDeclared === true,
  ).length;
  const frozenAgents = params.agentStatus.agents.filter(
    (agent) => agent.governance?.freezeActive === true,
  ).length;
  return {
    totalAgents: params.agentStatus.agents.length,
    activeAgents,
    charteredAgents,
    frozenAgents,
    bootstrapPendingCount: params.agentStatus.bootstrapPendingCount,
    totalSessions: params.agentStatus.totalSessions,
  };
}

export function buildStatusAllAgentsValue(params: {
  agentStatus: AgentStatusLike;
  activeThresholdMs?: number;
}) {
  const summary = summarizeStatusAgents(params);
  return [
    `${summary.totalAgents} total`,
    `${summary.bootstrapPendingCount} bootstrapping`,
    `${summary.activeAgents} active`,
    `${summary.totalSessions} sessions`,
    `${summary.charteredAgents} chartered`,
    `${summary.frozenAgents} frozen`,
  ].join(STATUS_SEPARATOR);
}

export function buildStatusSecretsValue(count: number) {
  return count > 0 ? `${count} diagnostic${count === 1 ? "" : "s"}` : "none";
}

export function buildStatusEventsValue(params: { queuedSystemEvents: string[] }) {
  return params.queuedSystemEvents.length > 0
    ? `${params.queuedSystemEvents.length} queued`
    : "none";
}

export function buildStatusProbesValue(params: {
  health?: unknown;
  ok: (value: string) => string;
  muted: (value: string) => string;
}) {
  return params.health ? params.ok("enabled") : params.muted("skipped (use --deep)");
}

export function buildStatusPluginCompatibilityValue(params: {
  notices: PluginCompatibilityNoticeLike[];
  ok: (value: string) => string;
  warn: (value: string) => string;
}) {
  if (params.notices.length === 0) {
    return params.ok("none");
  }
  const pluginCount = new Set(
    params.notices.map((notice) => notice.pluginId ?? notice.plugin ?? ""),
  ).size;
  return params.warn(
    `${params.notices.length} notice${params.notices.length === 1 ? "" : "s"}${STATUS_SEPARATOR}${pluginCount} plugin${pluginCount === 1 ? "" : "s"}`,
  );
}

export function buildStatusSessionsOverviewValue(params: {
  sessions: SummarySessionsLike;
  formatKTokens: (value: number) => string;
}) {
  const defaultCtx = params.sessions.defaults.contextTokens
    ? ` (${params.formatKTokens(params.sessions.defaults.contextTokens)} ctx)`
    : "";
  const storeLabel =
    params.sessions.paths.length > 1
      ? `${params.sessions.paths.length} stores`
      : (params.sessions.paths[0] ?? "unknown");
  return `${params.sessions.count} active${STATUS_SEPARATOR}default ${params.sessions.defaults.model ?? "unknown"}${defaultCtx}${STATUS_SEPARATOR}${storeLabel}`;
}

function buildGovernanceTeamState(params: {
  governance: StatusGovernanceSnapshot;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  const team = params.governance.teamSummary;
  if (!team) {
    return null;
  }
  if (!team.declared) {
    return params.warn(`team ${team.teamId} undeclared`);
  }
  if (team.missingMemberCount > 0) {
    return params.warn(
      `team missing ${team.missingMemberCount} member${team.missingMemberCount === 1 ? "" : "s"}`,
    );
  }
  if (team.freezeActiveMemberCount > 0) {
    return params.warn(`team freeze ${team.freezeActiveMemberCount}/${team.memberCount}`);
  }
  return params.muted(
    [
      `team ${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`,
      `${team.runtimeHookCount} hook${team.runtimeHookCount === 1 ? "" : "s"}`,
      ...(team.effectiveToolDenyCount > 0
        ? [`${team.effectiveToolDenyCount} ${team.effectiveToolDenyCount === 1 ? "deny" : "denies"}`]
        : []),
    ].join(", "),
  );
}

export function buildStatusGovernanceValue(params: {
  governance?: StatusGovernanceSnapshot;
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (!params.governance) {
    return params.muted("unavailable");
  }

  const findings =
    params.governance.findingSummary.critical + params.governance.findingSummary.warn;
  const charterState = !params.governance.discovered
    ? params.warn("charter missing")
    : params.governance.freezeActive
      ? params.warn(`freeze ${params.governance.freezeReasonCode ?? "active"}`)
      : params.ok("freeze open");
  const pendingProposals = `${params.governance.proposalSummary.pending} pending`;
  const findingsState =
    findings > 0
      ? params.warn(`${findings} finding${findings === 1 ? "" : "s"}`)
      : params.muted("findings clean");
  const gapsState =
    params.governance.capabilitySummary.gapCount > 0
      ? params.warn(
          `${params.governance.capabilitySummary.gapCount} gap${params.governance.capabilitySummary.gapCount === 1 ? "" : "s"}`,
        )
      : params.ok("gaps clear");
  const teamState = buildGovernanceTeamState({
    governance: params.governance,
    warn: params.warn,
    muted: params.muted,
  });
  const genesisState =
    params.governance.genesisSummary.blockerCount > 0
      ? params.warn(
          `${params.governance.genesisSummary.blockerCount} blocker${params.governance.genesisSummary.blockerCount === 1 ? "" : "s"}`,
        )
      : params.muted(`mode ${params.governance.genesisSummary.mode}`);

  return [charterState, pendingProposals, findingsState, gapsState, teamState, genesisState]
    .filter((value): value is string => value != null)
    .join(STATUS_SEPARATOR);
}

export function buildStatusAutonomyValue(params: {
  autonomy?: StatusAutonomySnapshot;
  ok: (value: string) => string;
  warn: (value: string) => string;
  muted: (value: string) => string;
}) {
  if (!params.autonomy) {
    return params.muted("unavailable");
  }

  const fleet = params.autonomy.fleetSummary;
  const driftState =
    fleet.drift > 0 ? params.warn(`${fleet.drift} drift`) : params.ok("drift clear");
  const loopState =
    fleet.missingLoop > 0
      ? params.warn(
          `${fleet.missingLoop} missing loop${fleet.missingLoop === 1 ? "" : "s"}`,
        )
      : params.ok("loops ok");
  const gapState =
    params.autonomy.capabilitySummary.gapCount > 0
      ? params.warn(
          `${params.autonomy.capabilitySummary.gapCount} gap${params.autonomy.capabilitySummary.gapCount === 1 ? "" : "s"}`,
        )
      : params.ok("gaps clear");
  const genesisState =
    params.autonomy.genesisSummary.blockerCount > 0
      ? params.warn(
          `${params.autonomy.genesisSummary.blockerCount} blocker${params.autonomy.genesisSummary.blockerCount === 1 ? "" : "s"}`,
        )
      : params.muted(`mode ${params.autonomy.genesisSummary.mode}`);
  const replaySummary = params.autonomy.replaySummary;
  const replayState =
    replaySummary && replaySummary.totalRunners > 0
      ? replaySummary.ready > 0
        ? params.warn(`${replaySummary.ready} replay ready`)
        : replaySummary.blocked > 0
          ? params.warn(`${replaySummary.blocked} replay blocked`)
          : replaySummary.promotable > 0
            ? params.ok(`${replaySummary.promotable} promotable`)
            : replaySummary.failed > 0
              ? params.warn(`${replaySummary.failed} replay failed`)
              : params.muted(`${replaySummary.passed} replay passed`)
      : null;

  return [
    `${fleet.totalProfiles} profiles`,
    driftState,
    loopState,
    `${fleet.activeFlows} active`,
    gapState,
    replayState,
    genesisState,
  ]
    .filter((value): value is string => Boolean(value))
    .join(STATUS_SEPARATOR);
}
