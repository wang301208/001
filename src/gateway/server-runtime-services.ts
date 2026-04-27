import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveMainSessionKey } from "../config/sessions/main-session.js";
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
  if (process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL === "1") {
    const reconciled = await autonomy.reconcileLoopJobs({
      telemetrySource: params.source,
    });
    return {
      mode: "reconcile",
      reconciled,
      changedCount: reconciled.createdCount + reconciled.updatedCount,
    };
  }

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
  logAutonomy.info(
    `${prefix}healed ${params.result.healed.totals.totalProfiles} managed autonomy profile(s) (changed ${params.result.healed.totals.changed}, loopCreated ${params.result.healed.totals.loopCreated}, loopUpdated ${params.result.healed.totals.loopUpdated}, flowStarted ${params.result.healed.totals.flowStarted}, flowRestarted ${params.result.healed.totals.flowRestarted})`,
  );
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
      !params.minimalTestGateway && process.env.VITEST !== "1"
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
  if (params.minimalTestGateway) {
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
