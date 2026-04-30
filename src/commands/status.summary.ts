import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { hasPotentialConfiguredChannels } from "../channels/config-presence.js";
import { resolveMainSessionKey } from "../config/sessions/main-session.js";
import { resolveStorePath } from "../config/sessions/paths.js";
import { readSessionStoreReadOnly } from "../config/sessions/store-read.js";
import { resolveFreshSessionTotalTokens, type SessionEntry } from "../config/sessions/types.js";
import type { OpenClawConfig } from "../config/types.js";
import { listGatewayAgentsBasic } from "../gateway/agent-list.js";
import { resolveHeartbeatSummaryForAgent } from "../infra/heartbeat-summary.js";
import { peekSystemEvents } from "../infra/system-events.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { createLazyRuntimeSurface } from "../shared/lazy-runtime.js";
import { resolveRuntimeServiceVersion } from "../version.js";
import type {
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
  GovernanceOverviewResult,
  GovernanceTeamResult,
} from "../governance/control-plane.js";
import type {
  AutonomyCapabilityInventoryResult,
  AutonomyFleetHistoryEvent,
  AutonomyFleetStatusResult,
  AutonomyGenesisPlanResult,
} from "../plugins/runtime/runtime-autonomy.types.js";
import type { TaskFlowDetail } from "../plugins/runtime/task-domain-types.js";
import type {
  ManagedTaskFlowAutonomyProjectRuntime,
  ManagedTaskFlowSovereigntyWatchRuntime,
} from "../plugins/runtime/runtime-taskflow.types.js";
import type {
  HeartbeatStatus,
  SessionStatus,
  StatusAutonomySnapshot,
  StatusCapabilitySummary,
  StatusGenesisSummary,
  StatusGovernanceSnapshot,
  StatusGovernanceTeamSummary,
  StatusSummary,
} from "./status.types.js";

let channelSummaryModulePromise: Promise<typeof import("../infra/channel-summary.js")> | undefined;
let linkChannelModulePromise: Promise<typeof import("./status.link-channel.js")> | undefined;
let configIoModulePromise: Promise<typeof import("../config/io.js")> | undefined;
let taskRegistryMaintenanceModulePromise:
  | Promise<typeof import("../tasks/task-registry.maintenance.js")>
  | undefined;
let governanceControlPlaneModulePromise:
  | Promise<typeof import("../governance/control-plane.js")>
  | undefined;
let runtimeAutonomyModulePromise:
  | Promise<typeof import("../plugins/runtime/runtime-autonomy.js")>
  | undefined;
let runtimeTaskFlowModulePromise:
  | Promise<typeof import("../plugins/runtime/runtime-taskflow.js")>
  | undefined;

function loadChannelSummaryModule() {
  channelSummaryModulePromise ??= import("../infra/channel-summary.js");
  return channelSummaryModulePromise;
}

function loadLinkChannelModule() {
  linkChannelModulePromise ??= import("./status.link-channel.js");
  return linkChannelModulePromise;
}

const loadStatusSummaryRuntimeModule = createLazyRuntimeSurface(
  () => import("./status.summary.runtime.js"),
  ({ statusSummaryRuntime }) => statusSummaryRuntime,
);

function loadConfigIoModule() {
  configIoModulePromise ??= import("../config/io.js");
  return configIoModulePromise;
}

function loadTaskRegistryMaintenanceModule() {
  taskRegistryMaintenanceModulePromise ??= import("../tasks/task-registry.maintenance.js");
  return taskRegistryMaintenanceModulePromise;
}

function loadGovernanceControlPlaneModule() {
  governanceControlPlaneModulePromise ??= import("../governance/control-plane.js");
  return governanceControlPlaneModulePromise;
}

function loadRuntimeAutonomyModule() {
  runtimeAutonomyModulePromise ??= import("../plugins/runtime/runtime-autonomy.js");
  return runtimeAutonomyModulePromise;
}

function loadRuntimeTaskFlowModule() {
  runtimeTaskFlowModulePromise ??= import("../plugins/runtime/runtime-taskflow.js");
  return runtimeTaskFlowModulePromise;
}

const buildFlags = (entry?: SessionEntry): string[] => {
  if (!entry) {
    return [];
  }
  const flags: string[] = [];
  const think = entry?.thinkingLevel;
  if (typeof think === "string" && think.length > 0) {
    flags.push(`think:${think}`);
  }
  const verbose = entry?.verboseLevel;
  if (typeof verbose === "string" && verbose.length > 0) {
    flags.push(`verbose:${verbose}`);
  }
  if (typeof entry?.fastMode === "boolean") {
    flags.push(entry.fastMode ? "fast" : "fast:off");
  }
  const reasoning = entry?.reasoningLevel;
  if (typeof reasoning === "string" && reasoning.length > 0) {
    flags.push(`reasoning:${reasoning}`);
  }
  const elevated = entry?.elevatedLevel;
  if (typeof elevated === "string" && elevated.length > 0) {
    flags.push(`elevated:${elevated}`);
  }
  if (entry?.systemSent) {
    flags.push("system");
  }
  if (entry?.abortedLastRun) {
    flags.push("aborted");
  }
  const sessionId = entry?.sessionId as unknown;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    flags.push(`id:${sessionId}`);
  }
  return flags;
};

function countGovernanceFindings(
  findings: GovernanceOverviewResult["findings"],
): StatusGovernanceSnapshot["findingSummary"] {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    {
      critical: 0,
      warn: 0,
      info: 0,
    },
  );
}

function buildStatusCapabilitySummary(
  result: Pick<
    GovernanceCapabilityInventoryResult,
    "requestedAgentIds" | "summary" | "gaps"
  >,
): StatusCapabilitySummary {
  return {
    requestedAgentIds: [...result.requestedAgentIds],
    totalEntries: result.summary.totalEntries,
    gapCount: result.summary.gapCount,
    criticalGapCount: result.summary.criticalGapCount,
    warningGapCount: result.summary.warningGapCount,
    infoGapCount: result.summary.infoGapCount,
    topGapIds: result.gaps.slice(0, 5).map((gap) => gap.id),
  };
}

function buildStatusGenesisSummary(
  result: Pick<
    GovernanceGenesisPlanResult,
    "teamId" | "teamTitle" | "mode" | "blockers" | "focusGapIds" | "stages"
  >,
): StatusGenesisSummary {
  const stageCounts = result.stages.reduce(
    (acc, stage) => {
      acc[stage.status] += 1;
      return acc;
    },
    {
      ready: 0,
      waiting: 0,
      blocked: 0,
    },
  );
  return {
    teamId: result.teamId,
    ...(result.teamTitle ? { teamTitle: result.teamTitle } : {}),
    mode: result.mode,
    blockerCount: result.blockers.length,
    blockers: [...result.blockers],
    focusGapIds: [...result.focusGapIds],
    stageCounts,
  };
}

function buildStatusGovernanceSnapshot(params: {
  overview: GovernanceOverviewResult;
  capabilityInventory: GovernanceCapabilityInventoryResult;
  genesisPlan: GovernanceGenesisPlanResult;
  team: GovernanceTeamResult;
}): StatusGovernanceSnapshot {
  return {
    observedAt: params.overview.observedAt,
    discovered: params.overview.discovered,
    freezeActive: params.overview.enforcement.active,
    ...(params.overview.enforcement.reasonCode
      ? { freezeReasonCode: params.overview.enforcement.reasonCode }
      : {}),
    proposalSummary: {
      total: params.overview.proposals.total,
      pending: params.overview.proposals.pending,
      approved: params.overview.proposals.approved,
      rejected: params.overview.proposals.rejected,
      applied: params.overview.proposals.applied,
    },
    findingSummary: countGovernanceFindings(params.overview.findings),
    capabilitySummary: buildStatusCapabilitySummary(params.capabilityInventory),
    genesisSummary: buildStatusGenesisSummary(params.genesisPlan),
    teamSummary: buildStatusGovernanceTeamSummary(params.team),
  };
}

function buildStatusGovernanceTeamSummary(
  result: Pick<
    GovernanceTeamResult,
    | "teamId"
    | "declared"
    | "members"
    | "missingMemberIds"
    | "freezeActiveMemberIds"
    | "runtimeHookCoverage"
    | "effectiveToolDeny"
  >,
): StatusGovernanceTeamSummary {
  return {
    teamId: result.teamId,
    declared: result.declared,
    memberCount: result.members.length,
    missingMemberCount: result.missingMemberIds.length,
    missingMemberIds: [...result.missingMemberIds],
    freezeActiveMemberCount: result.freezeActiveMemberIds.length,
    freezeActiveMemberIds: [...result.freezeActiveMemberIds],
    runtimeHookCount: result.runtimeHookCoverage.length,
    effectiveToolDenyCount: result.effectiveToolDeny.length,
  };
}

function resolveAutonomyFlowProject(
  flow?: TaskFlowDetail,
): ManagedTaskFlowAutonomyProjectRuntime | undefined {
  return flow?.managedAutonomy?.project;
}

type SandboxManagedTaskFlowProjectRuntime = Exclude<
  ManagedTaskFlowAutonomyProjectRuntime,
  ManagedTaskFlowSovereigntyWatchRuntime
>;

function resolveSandboxReplayRunner(
  flow?: TaskFlowDetail,
): SandboxManagedTaskFlowProjectRuntime["sandboxReplayRunner"] | undefined {
  const project = resolveAutonomyFlowProject(flow);
  if (!project || project.kind === "sovereignty_watch") {
    return undefined;
  }
  return project.sandboxReplayRunner;
}

function buildStatusAutonomyReplaySummary(
  fleetStatus: AutonomyFleetStatusResult,
): NonNullable<StatusAutonomySnapshot["replaySummary"]> {
  const readyAgentIds: string[] = [];
  const promotableAgentIds: string[] = [];
  const blockedAgentIds: string[] = [];
  let totalRunners = 0;
  let ready = 0;
  let passed = 0;
  let failed = 0;
  let promotable = 0;
  let blocked = 0;

  for (const entry of fleetStatus.entries) {
    const replayRunner = resolveSandboxReplayRunner(entry.latestFlow);
    if (!replayRunner) {
      continue;
    }
    totalRunners += 1;
    if (replayRunner.status === "ready") {
      ready += 1;
      readyAgentIds.push(entry.agentId);
    } else if (replayRunner.status === "passed") {
      passed += 1;
    } else if (replayRunner.status === "failed") {
      failed += 1;
    }
    if (replayRunner.lastRun?.canPromote) {
      promotable += 1;
      promotableAgentIds.push(entry.agentId);
    }
    if (replayRunner.blockers.length > 0) {
      blocked += 1;
      blockedAgentIds.push(entry.agentId);
    }
  }

  return {
    totalRunners,
    ready,
    passed,
    failed,
    promotable,
    blocked,
    readyAgentIds,
    promotableAgentIds,
    blockedAgentIds,
  };
}

function buildStatusAutonomySnapshot(params: {
  fleetStatus: AutonomyFleetStatusResult;
  capabilityInventory: AutonomyCapabilityInventoryResult;
  genesisPlan: AutonomyGenesisPlanResult;
  lastSupervisorEvent?: AutonomyFleetHistoryEvent;
}): StatusAutonomySnapshot {
  return {
    observedAt: Math.max(params.capabilityInventory.observedAt, params.genesisPlan.observedAt),
    fleetSummary: {
      totalProfiles: params.fleetStatus.totals.totalProfiles,
      healthy: params.fleetStatus.totals.healthy,
      idle: params.fleetStatus.totals.idle,
      drift: params.fleetStatus.totals.drift,
      missingLoop: params.fleetStatus.totals.missingLoop,
      activeFlows: params.fleetStatus.totals.activeFlows,
      driftAgentIds: params.fleetStatus.entries
        .filter((entry) => entry.health === "drift")
        .map((entry) => entry.agentId),
      missingLoopAgentIds: params.fleetStatus.entries
        .filter((entry) => entry.health === "missing_loop")
        .map((entry) => entry.agentId),
    },
    replaySummary: buildStatusAutonomyReplaySummary(params.fleetStatus),
    capabilitySummary: buildStatusCapabilitySummary(params.capabilityInventory),
    genesisSummary: buildStatusGenesisSummary(params.genesisPlan),
    ...(params.lastSupervisorEvent
      ? {
          lastSupervisorRun: {
            observedAt: params.lastSupervisorEvent.ts,
            mode: params.lastSupervisorEvent.mode,
            changed: params.lastSupervisorEvent.changed,
            agentIds: [...params.lastSupervisorEvent.agentIds],
            changedAgentIds: params.lastSupervisorEvent.entries
              .filter((entry) => entry.changed)
              .map((entry) => entry.agentId),
            totals: {
              totalProfiles: params.lastSupervisorEvent.totals.totalProfiles,
              changed: params.lastSupervisorEvent.totals.changed,
              unchanged: params.lastSupervisorEvent.totals.unchanged,
              loopCreated: params.lastSupervisorEvent.totals.loopCreated,
              loopUpdated: params.lastSupervisorEvent.totals.loopUpdated,
              flowStarted: params.lastSupervisorEvent.totals.flowStarted,
              flowRestarted: params.lastSupervisorEvent.totals.flowRestarted,
            },
          },
        }
      : {}),
  };
}

export function redactSensitiveStatusSummary(summary: StatusSummary): StatusSummary {
  return {
    ...summary,
    sessions: {
      ...summary.sessions,
      paths: [],
      defaults: {
        model: null,
        contextTokens: null,
      },
      recent: [],
      byAgent: summary.sessions.byAgent.map((entry) => ({
        ...entry,
        path: "[redacted]",
        recent: [],
      })),
    },
  };
}

export async function getStatusSummary(
  options: {
    includeSensitive?: boolean;
    config?: OpenClawConfig;
    sourceConfig?: OpenClawConfig;
  } = {},
): Promise<StatusSummary> {
  const { includeSensitive = true } = options;
  const {
    classifySessionKey,
    resolveConfiguredStatusModelRef,
    resolveContextTokensForModel,
    resolveSessionModelRef,
  } = await loadStatusSummaryRuntimeModule();
  const cfg = options.config ?? (await loadConfigIoModule()).loadConfig();
  const needsChannelPlugins = hasPotentialConfiguredChannels(cfg);
  const linkContext = needsChannelPlugins
    ? await loadLinkChannelModule().then(({ resolveLinkChannelContext }) =>
        resolveLinkChannelContext(cfg),
      )
    : null;
  const agentList = listGatewayAgentsBasic(cfg);
  const heartbeatAgents: HeartbeatStatus[] = agentList.agents.map((agent) => {
    const summary = resolveHeartbeatSummaryForAgent(cfg, agent.id);
    return {
      agentId: agent.id,
      name: agent.name,
      configured: agent.configured,
      governance: agent.governance,
      enabled: summary.enabled,
      every: summary.every,
      everyMs: summary.everyMs,
    } satisfies HeartbeatStatus;
  });
  const channelSummary = needsChannelPlugins
    ? await loadChannelSummaryModule().then(({ buildChannelSummary }) =>
        buildChannelSummary(cfg, {
          colorize: true,
          includeAllowFrom: true,
          sourceConfig: options.sourceConfig,
        }),
      )
    : [];
  const mainSessionKey = resolveMainSessionKey(cfg);
  const queuedSystemEvents = peekSystemEvents(mainSessionKey);
  const taskMaintenanceModule = await loadTaskRegistryMaintenanceModule();
  const tasks = taskMaintenanceModule.getInspectableTaskRegistrySummary();
  const taskAudit = taskMaintenanceModule.getInspectableTaskAuditSummary();
  const [governance, autonomy] = await Promise.all([
    (async (): Promise<StatusGovernanceSnapshot> => {
      const {
        getGovernanceCapabilityInventory,
        getGovernanceGenesisPlan,
        getGovernanceOverview,
        getGovernanceTeam,
      } = await loadGovernanceControlPlaneModule();
      const overview = getGovernanceOverview({ cfg });
      const capabilityInventory = getGovernanceCapabilityInventory({ cfg });
      const genesisPlan = getGovernanceGenesisPlan({
        cfg,
        inventory: capabilityInventory,
      });
      const team = getGovernanceTeam({
        cfg,
        teamId: genesisPlan.teamId,
        observedAt: overview.observedAt,
      });
      return buildStatusGovernanceSnapshot({
        overview,
        capabilityInventory,
        genesisPlan,
        team,
      });
    })(),
    (async (): Promise<StatusAutonomySnapshot> => {
      const [{ createRuntimeAutonomy }, { createRuntimeTaskFlow }] = await Promise.all([
        loadRuntimeAutonomyModule(),
        loadRuntimeTaskFlowModule(),
      ]);
      const runtime = createRuntimeAutonomy({
        legacyTaskFlow: createRuntimeTaskFlow(),
      }).bindSession({
        sessionKey: mainSessionKey,
      });
      const [fleetStatus, capabilityInventory, genesisPlan, fleetHistory] = await Promise.all([
        runtime.getFleetStatus({}),
        runtime.getCapabilityInventory({}),
        runtime.planGenesisWork({}),
        runtime.getFleetHistory({
          limit: 1,
          source: "supervisor",
        }),
      ]);
      return buildStatusAutonomySnapshot({
        fleetStatus,
        capabilityInventory,
        genesisPlan,
        lastSupervisorEvent: fleetHistory.events[0],
      });
    })(),
  ]);

  const resolved = resolveConfiguredStatusModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const configModel = resolved.model ?? DEFAULT_MODEL;
  const configContextTokens =
    resolveContextTokensForModel({
      cfg,
      provider: resolved.provider ?? DEFAULT_PROVIDER,
      model: configModel,
      contextTokensOverride: cfg.agents?.defaults?.contextTokens,
      fallbackContextTokens: DEFAULT_CONTEXT_TOKENS,
      // Keep `status`/`status --json` startup read-only. These summary lookups
      // should not kick off background provider discovery or plugin scans.
      allowAsyncLoad: false,
    }) ?? DEFAULT_CONTEXT_TOKENS;

  const now = Date.now();
  const storeCache = new Map<string, Record<string, SessionEntry | undefined>>();
  const loadStore = (storePath: string) => {
    const cached = storeCache.get(storePath);
    if (cached) {
      return cached;
    }
    const store = readSessionStoreReadOnly(storePath);
    storeCache.set(storePath, store);
    return store;
  };
  const buildSessionRows = (
    store: Record<string, SessionEntry | undefined>,
    opts: { agentIdOverride?: string } = {},
  ) =>
    Object.entries(store)
      .filter(([key]) => key !== "global" && key !== "unknown")
      .map(([key, entry]) => {
        const updatedAt = entry?.updatedAt ?? null;
        const age = updatedAt ? now - updatedAt : null;
        const resolvedModel = resolveSessionModelRef(cfg, entry, opts.agentIdOverride);
        const model = resolvedModel.model ?? configModel ?? null;
        const contextTokens =
          resolveContextTokensForModel({
            cfg,
            provider: resolvedModel.provider,
            model,
            contextTokensOverride: entry?.contextTokens,
            fallbackContextTokens: configContextTokens ?? undefined,
            allowAsyncLoad: false,
          }) ?? null;
        const total = resolveFreshSessionTotalTokens(entry);
        const totalTokensFresh =
          typeof entry?.totalTokens === "number" ? entry?.totalTokensFresh !== false : false;
        const remaining =
          contextTokens != null && total !== undefined ? Math.max(0, contextTokens - total) : null;
        const pct =
          contextTokens && contextTokens > 0 && total !== undefined
            ? Math.min(999, Math.round((total / contextTokens) * 100))
            : null;
        const parsedAgentId = parseAgentSessionKey(key)?.agentId;
        const agentId = opts.agentIdOverride ?? parsedAgentId;

        return {
          agentId,
          key,
          kind: classifySessionKey(key, entry),
          sessionId: entry?.sessionId,
          updatedAt,
          age,
          thinkingLevel: entry?.thinkingLevel,
          fastMode: entry?.fastMode,
          verboseLevel: entry?.verboseLevel,
          traceLevel: entry?.traceLevel,
          reasoningLevel: entry?.reasoningLevel,
          elevatedLevel: entry?.elevatedLevel,
          systemSent: entry?.systemSent,
          abortedLastRun: entry?.abortedLastRun,
          inputTokens: entry?.inputTokens,
          outputTokens: entry?.outputTokens,
          cacheRead: entry?.cacheRead,
          cacheWrite: entry?.cacheWrite,
          totalTokens: total ?? null,
          totalTokensFresh,
          remainingTokens: remaining,
          percentUsed: pct,
          model,
          contextTokens,
          flags: buildFlags(entry),
        } satisfies SessionStatus;
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const paths = new Set<string>();
  const byAgent = agentList.agents.map((agent) => {
    const storePath = resolveStorePath(cfg.session?.store, { agentId: agent.id });
    paths.add(storePath);
    const store = loadStore(storePath);
    const sessions = buildSessionRows(store, { agentIdOverride: agent.id });
    return {
      agentId: agent.id,
      name: agent.name,
      configured: agent.configured,
      governance: agent.governance,
      path: storePath,
      count: sessions.length,
      recent: sessions.slice(0, 10),
    };
  });

  const allSessions = Array.from(paths)
    .flatMap((storePath) => buildSessionRows(loadStore(storePath)))
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const recent = allSessions.slice(0, 10);
  const totalSessions = allSessions.length;

  const summary: StatusSummary = {
    runtimeVersion: resolveRuntimeServiceVersion(process.env),
    linkChannel: linkContext
      ? {
          id: linkContext.plugin.id,
          label: linkContext.plugin.meta.label ?? "Channel",
          linked: linkContext.linked,
          authAgeMs: linkContext.authAgeMs,
        }
      : undefined,
    heartbeat: {
      defaultAgentId: agentList.defaultId,
      agents: heartbeatAgents,
    },
    channelSummary,
    queuedSystemEvents,
    governance,
    autonomy,
    tasks,
    taskAudit,
    sessions: {
      paths: Array.from(paths),
      count: totalSessions,
      defaults: {
        model: configModel ?? null,
        contextTokens: configContextTokens ?? null,
      },
      recent,
      byAgent,
    },
  };
  return includeSensitive ? summary : redactSensitiveStatusSummary(summary);
}
