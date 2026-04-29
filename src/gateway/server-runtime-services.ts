import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveMainSessionKey } from "../config/sessions/main-session.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { startHeartbeatRunner, type HeartbeatRunner } from "../infra/heartbeat-runner.js";
import type { ChannelHealthMonitor } from "./channel-health-monitor.js";
import { startChannelHealthMonitor } from "./channel-health-monitor.js";
import { startGatewayModelPricingRefresh } from "./model-pricing-cache.js";

type GatewayRuntimeServiceLogger = {
  child: (name: string) => {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  error: (message: string) => void;
};

export type GatewayChannelManager = Parameters<
  typeof startChannelHealthMonitor
>[0]["channelManager"];

type GatewayAutonomyMaintenanceResult =
  | {
      mode: "reconcile";
      reconciled: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["reconcileLoopJobs"]>
      >;
      changedCount: number;
    }
  | {
      mode: "heal";
      healed: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["healFleet"]>
      >;
      changedCount: number;
    }
  | {
      mode: "supervise";
      supervised: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["superviseFleet"]>
      >;
      changedCount: number;
    };

type GatewayAutonomySupervisor = {
  start: () => void;
  stop: () => void;
  updateConfig: (cfg: OpenClawConfig) => void;
};

function createNoopHeartbeatRunner(): HeartbeatRunner {
  return {
    stop: () => {},
    updateConfig: (_cfg: OpenClawConfig) => {},
  };
}

export function startGatewayChannelHealthMonitor(params: {
  cfg: OpenClawConfig;
  channelManager: GatewayChannelManager;
}): ChannelHealthMonitor | null {
  const healthCheckMinutes = params.cfg.gateway?.channelHealthCheckMinutes;
  if (healthCheckMinutes === 0) {
    return null;
  }
  const staleEventThresholdMinutes = params.cfg.gateway?.channelStaleEventThresholdMinutes;
  const maxRestartsPerHour = params.cfg.gateway?.channelMaxRestartsPerHour;
  return startChannelHealthMonitor({
    channelManager: params.channelManager,
    checkIntervalMs: (healthCheckMinutes ?? 5) * 60_000,
    ...(staleEventThresholdMinutes != null && {
      staleEventThresholdMs: staleEventThresholdMinutes * 60_000,
    }),
    ...(maxRestartsPerHour != null && { maxRestartsPerHour }),
  });
}

export function startGatewayCronWithLogging(params: {
  cron: { start: () => Promise<void> };
  logCron: { error: (message: string) => void };
  onStarted?: () => Promise<void> | void;
}): void {
  void params.cron
    .start()
    .then(async () => {
      if (!params.onStarted) {
        return;
      }
      try {
        await params.onStarted();
      } catch (err) {
        params.logCron.error(`post-start hook failed: ${String(err)}`);
      }
    })
    .catch((err) => params.logCron.error(`failed to start: ${String(err)}`));
}

async function runGatewayAutonomyMaintenance(params: {
  minimalTestGateway: boolean;
  cfgAtStart: OpenClawConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  source: "startup" | "supervisor";
}): Promise<GatewayAutonomyMaintenanceResult | undefined> {
  if (params.minimalTestGateway) {
    return undefined;
  }
  if (process.env.OPENCLAW_SKIP_AUTONOMY_RECONCILE === "1") {
    return undefined;
  }
  if (process.env.OPENCLAW_SKIP_CRON === "1" || params.cfgAtStart.cron?.enabled === false) {
    return undefined;
  }
  if (
    typeof params.cron.list !== "function" ||
    typeof params.cron.add !== "function" ||
    typeof params.cron.update !== "function" ||
    typeof params.cron.remove !== "function"
  ) {
    return undefined;
  }

  const [{ createRuntimeAutonomy }, { createRuntimeTaskFlow }] = await Promise.all([
    import("../plugins/runtime/runtime-autonomy.js"),
    import("../plugins/runtime/runtime-taskflow.js"),
  ]);
  const autonomy = createRuntimeAutonomy({
    legacyTaskFlow: createRuntimeTaskFlow(),
    cronService: params.cron as import("../cron/service-contract.js").CronServiceContract,
  }).bindSession({
    sessionKey: resolveMainSessionKey(params.cfgAtStart),
  });
  const mode = resolveGatewayAutonomyMaintenanceMode();
  if (mode === "reconcile") {
    const reconciled = await autonomy.reconcileLoopJobs({
      telemetrySource: params.source,
    });
    return {
      mode: "reconcile",
      reconciled,
      changedCount: reconciled.createdCount + reconciled.updatedCount,
    };
  }

  if (mode === "heal") {
    const healed = await autonomy.healFleet({
      restartBlockedFlows: false,
      telemetrySource: params.source,
    });
    return {
      mode: "heal",
      healed,
      changedCount: healed.totals.changed,
    };
  }

  const supervised = await autonomy.superviseFleet({
    governanceMode: resolveAutonomySupervisorGovernanceMode(),
    includeCapabilityInventory: resolveAutonomySupervisorIncludeCapabilityInventory(),
    includeGenesisPlan: resolveAutonomySupervisorIncludeGenesisPlan(),
    recordHistory: true,
    restartBlockedFlows: false,
    telemetrySource: params.source,
  });
  return {
    mode: "supervise",
    supervised,
    changedCount:
      supervised.summary.changedProfiles +
      supervised.summary.governanceCreatedCount +
      supervised.summary.governanceAppliedCount,
  };
}

function logGatewayAutonomyMaintenanceSummary(params: {
  log: GatewayRuntimeServiceLogger;
  result: GatewayAutonomyMaintenanceResult;
  prefix?: string;
}): void {
  const logAutonomy = params.log.child("autonomy");
  const prefix = params.prefix ? `${params.prefix} ` : "";
  if (params.result.mode === "reconcile") {
    logAutonomy.info(
      `${prefix}reconciled ${params.result.reconciled.reconciled.length} managed autonomy loop(s) (created ${params.result.reconciled.createdCount}, updated ${params.result.reconciled.updatedCount})`,
    );
    return;
  }
  if (params.result.mode === "supervise") {
    logAutonomy.info(
      `${prefix}supervised ${params.result.supervised.summary.totalProfiles} managed autonomy profile(s) (changed ${params.result.supervised.summary.changedProfiles}, healthy ${params.result.supervised.summary.healthyProfiles}, drift ${params.result.supervised.summary.driftProfiles}, missingLoop ${params.result.supervised.summary.missingLoopProfiles}, activeFlows ${params.result.supervised.summary.activeFlows}, governanceCreated ${params.result.supervised.summary.governanceCreatedCount}, governanceApplied ${params.result.supervised.summary.governanceAppliedCount}, governancePending ${params.result.supervised.summary.governancePendingCount}, capabilityGaps ${params.result.supervised.summary.capabilityGapCount}, criticalCapabilityGaps ${params.result.supervised.summary.criticalCapabilityGapCount}, genesisStages ${params.result.supervised.summary.genesisStageCount}, genesisBlocked ${params.result.supervised.summary.genesisBlockedStageCount})`,
    );
    return;
  }
  logAutonomy.info(
    `${prefix}healed ${params.result.healed.totals.totalProfiles} managed autonomy profile(s) (changed ${params.result.healed.totals.changed}, loopCreated ${params.result.healed.totals.loopCreated}, loopUpdated ${params.result.healed.totals.loopUpdated}, flowStarted ${params.result.healed.totals.flowStarted}, flowRestarted ${params.result.healed.totals.flowRestarted})`,
  );
}

function resolveBooleanEnvFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return undefined;
}

function resolveGatewayAutonomyMaintenanceMode(): "reconcile" | "heal" | "supervise" {
  if (process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL === "1") {
    return "reconcile";
  }
  const explicit = process.env.OPENCLAW_AUTONOMY_SUPERVISOR_MODE?.trim().toLowerCase();
  if (explicit === "reconcile" || explicit === "heal" || explicit === "supervise") {
    return explicit;
  }
  return "supervise";
}

function resolveAutonomySupervisorGovernanceMode(): "none" | "apply_safe" | "force_apply_all" {
  const explicit = process.env.OPENCLAW_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE?.trim();
  if (explicit === "none" || explicit === "apply_safe" || explicit === "force_apply_all") {
    return explicit;
  }
  return "apply_safe";
}

function resolveAutonomySupervisorIncludeCapabilityInventory(): boolean {
  return resolveBooleanEnvFlag("OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY") ?? true;
}

function resolveAutonomySupervisorIncludeGenesisPlan(): boolean {
  return resolveBooleanEnvFlag("OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN") ?? true;
}

function resolveAutonomySupervisorIntervalMs(): number | undefined {
  if (process.env.OPENCLAW_SKIP_AUTONOMY_SUPERVISOR === "1") {
    return undefined;
  }
  const explicit = process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INTERVAL_MS?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    if (parsed === 0) {
      return undefined;
    }
  }
  return 15 * 60_000;
}

function createGatewayAutonomySupervisor(params: {
  minimalTestGateway: boolean;
  cfgAtStart: OpenClawConfig;
  getCron: () => Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): GatewayAutonomySupervisor {
  const logSupervisor = params.log.child("autonomy-supervisor");
  const state = {
    cfg: params.cfgAtStart,
    timer: null as NodeJS.Timeout | null,
    started: false,
    stopped: false,
    running: false,
  };

  const clearTimer = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };

  const scheduleNext = () => {
    clearTimer();
    if (!state.started || state.stopped) {
      return;
    }
    const intervalMs = resolveAutonomySupervisorIntervalMs();
    if (!intervalMs) {
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      void runSweep();
    }, intervalMs);
    state.timer.unref?.();
  };

  const runSweep = async () => {
    if (state.stopped || state.running) {
      return;
    }
    state.running = true;
    try {
      const result = await runGatewayAutonomyMaintenance({
        minimalTestGateway: params.minimalTestGateway,
        cfgAtStart: state.cfg,
        cron: params.getCron(),
        source: "supervisor",
      });
      if (result && result.changedCount > 0) {
        logGatewayAutonomyMaintenanceSummary({
          log: params.log,
          result,
          prefix: "supervisor",
        });
      }
    } catch (err) {
      logSupervisor.error(`sweep failed: ${String(err)}`);
    } finally {
      state.running = false;
      scheduleNext();
    }
  };

  return {
    start: () => {
      if (state.started || state.stopped) {
        return;
      }
      state.started = true;
      const intervalMs = resolveAutonomySupervisorIntervalMs();
      if (intervalMs) {
        logSupervisor.info(`scheduled managed autonomy sweep every ${intervalMs}ms`);
      }
      scheduleNext();
    },
    stop: () => {
      state.stopped = true;
      clearTimer();
    },
    updateConfig: (cfg) => {
      state.cfg = cfg;
      if (state.started && !state.stopped) {
        scheduleNext();
      }
    },
  };
}

function composeGatewayHeartbeatRunner(
  heartbeatRunner: HeartbeatRunner,
  autonomySupervisor: GatewayAutonomySupervisor,
): HeartbeatRunner {
  return {
    stop: () => {
      autonomySupervisor.stop();
      heartbeatRunner.stop();
    },
    updateConfig: (cfg) => {
      heartbeatRunner.updateConfig(cfg);
      autonomySupervisor.updateConfig(cfg);
    },
  };
}

export async function reconcileGatewayAutonomyLoops(params: {
  minimalTestGateway: boolean;
  cfgAtStart: OpenClawConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): Promise<void> {
  const result = await runGatewayAutonomyMaintenance({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    cron: params.cron,
    source: "startup",
  });
  if (!result) {
    return;
  }
  logGatewayAutonomyMaintenanceSummary({
    log: params.log,
    result,
  });
}

function recoverPendingOutboundDeliveries(params: {
  cfg: OpenClawConfig;
  log: GatewayRuntimeServiceLogger;
}): void {
  void (async () => {
    const { recoverPendingDeliveries } = await import("../infra/outbound/delivery-queue.js");
    const { deliverOutboundPayloads } = await import("../infra/outbound/deliver.js");
    const logRecovery = params.log.child("delivery-recovery");
    await recoverPendingDeliveries({
      deliver: deliverOutboundPayloads,
      log: logRecovery,
      cfg: params.cfg,
    });
  })().catch((err) => params.log.error(`Delivery recovery failed: ${String(err)}`));
}

export function startGatewayRuntimeServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: OpenClawConfig;
  channelManager: GatewayChannelManager;
  log: GatewayRuntimeServiceLogger;
}): {
  heartbeatRunner: HeartbeatRunner;
  channelHealthMonitor: ChannelHealthMonitor | null;
  stopModelPricingRefresh: () => void;
} {
  // Keep scheduled work inert until post-attach sidecars finish.
  const channelHealthMonitor = startGatewayChannelHealthMonitor({
    cfg: params.cfgAtStart,
    channelManager: params.channelManager,
  });

  return {
    heartbeatRunner: createNoopHeartbeatRunner(),
    channelHealthMonitor,
    stopModelPricingRefresh:
      !params.minimalTestGateway && !isTruthyEnvValue(process.env.VITEST)
        ? startGatewayModelPricingRefresh({ config: params.cfgAtStart })
        : () => {},
  };
}

/**
 * Activate cron scheduler, heartbeat runner, and pending delivery recovery
 * after gateway sidecars are fully started and chat.history is available.
 */
export function activateGatewayScheduledServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: OpenClawConfig;
  cron: { start: () => Promise<void> };
  getCron?: () => Partial<import("../cron/service-contract.js").CronServiceContract>;
  logCron: { error: (message: string) => void };
  log: GatewayRuntimeServiceLogger;
}): { heartbeatRunner: HeartbeatRunner } {
  if (
    params.minimalTestGateway &&
    process.env.OPENCLAW_TEST_MINIMAL_GATEWAY_ALLOW_SCHEDULED_SERVICES !== "1"
  ) {
    return { heartbeatRunner: createNoopHeartbeatRunner() };
  }
  const heartbeatRunner = startHeartbeatRunner({ cfg: params.cfgAtStart });
  const autonomySupervisor = createGatewayAutonomySupervisor({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    getCron: params.getCron ?? (() => params.cron),
    log: params.log,
  });
  startGatewayCronWithLogging({
    cron: params.cron,
    logCron: params.logCron,
    onStarted: async () => {
      try {
        await reconcileGatewayAutonomyLoops({
          minimalTestGateway: params.minimalTestGateway,
          cfgAtStart: params.cfgAtStart,
          cron: params.cron,
          log: params.log,
        });
      } finally {
        autonomySupervisor.start();
      }
    },
  });
  recoverPendingOutboundDeliveries({
    cfg: params.cfgAtStart,
    log: params.log,
  });
  return {
    heartbeatRunner: composeGatewayHeartbeatRunner(heartbeatRunner, autonomySupervisor),
  };
}
