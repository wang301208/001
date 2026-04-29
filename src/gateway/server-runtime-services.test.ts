import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const heartbeatRunner = {
    stop: vi.fn(),
    updateConfig: vi.fn(),
  };
  return {
    heartbeatRunner,
    startHeartbeatRunner: vi.fn(() => heartbeatRunner),
    startChannelHealthMonitor: vi.fn(() => ({ stop: vi.fn() })),
    startGatewayModelPricingRefresh: vi.fn(() => vi.fn()),
    recoverPendingDeliveries: vi.fn(async () => undefined),
    deliverOutboundPayloads: vi.fn(),
    reconcileLoopJobs: vi.fn(async () => ({
      reconciled: [],
      createdCount: 0,
      updatedCount: 0,
    })),
    healFleet: vi.fn(async () => ({
      entries: [],
      totals: {
        totalProfiles: 0,
        changed: 0,
        unchanged: 0,
        loopCreated: 0,
        loopUpdated: 0,
        flowStarted: 0,
        flowRestarted: 0,
      },
    })),
    superviseFleet: vi.fn(async () => ({
      observedAt: 1,
      governanceMode: "apply_safe",
      overviewBefore: {
        entries: [],
        totals: {
          totalProfiles: 0,
          healthy: 0,
          idle: 0,
          drift: 0,
          missingLoop: 0,
          activeFlows: 0,
        },
      },
      healed: {
        entries: [],
        totals: {
          totalProfiles: 0,
          changed: 0,
          unchanged: 0,
          loopCreated: 0,
          loopUpdated: 0,
          flowStarted: 0,
          flowRestarted: 0,
        },
      },
      overviewAfter: {
        entries: [],
        totals: {
          totalProfiles: 0,
          healthy: 0,
          idle: 0,
          drift: 0,
          missingLoop: 0,
          activeFlows: 0,
        },
      },
      summary: {
        totalProfiles: 0,
        changedProfiles: 0,
        healthyProfiles: 0,
        driftProfiles: 0,
        missingLoopProfiles: 0,
        activeFlows: 0,
        governanceCreatedCount: 0,
        governanceAppliedCount: 0,
        governancePendingCount: 0,
        capabilityGapCount: 0,
        criticalCapabilityGapCount: 0,
        genesisStageCount: 0,
        genesisBlockedStageCount: 0,
        recommendedNextActions: [],
      },
    })),
    bindAutonomySession: vi.fn(),
    createRuntimeAutonomy: vi.fn(),
    createRuntimeTaskFlow: vi.fn(() => ({ kind: "taskflow-runtime" })),
  };
});

vi.mock("../infra/heartbeat-runner.js", () => ({
  startHeartbeatRunner: hoisted.startHeartbeatRunner,
}));

vi.mock("../infra/outbound/deliver.js", () => ({
  deliverOutboundPayloads: hoisted.deliverOutboundPayloads,
}));

vi.mock("../infra/outbound/delivery-queue.js", () => ({
  recoverPendingDeliveries: hoisted.recoverPendingDeliveries,
}));

vi.mock("./channel-health-monitor.js", () => ({
  startChannelHealthMonitor: hoisted.startChannelHealthMonitor,
}));

vi.mock("./model-pricing-cache.js", () => ({
  startGatewayModelPricingRefresh: hoisted.startGatewayModelPricingRefresh,
}));

vi.mock("../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: hoisted.createRuntimeTaskFlow,
}));

vi.mock("../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: hoisted.createRuntimeAutonomy,
}));

const { activateGatewayScheduledServices, startGatewayRuntimeServices } =
  await import("./server-runtime-services.js");

describe("server-runtime-services", () => {
  beforeEach(() => {
    vi.useRealTimers();
    delete process.env.OPENCLAW_SKIP_CRON;
    delete process.env.OPENCLAW_SKIP_AUTONOMY_RECONCILE;
    delete process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL;
    delete process.env.OPENCLAW_SKIP_AUTONOMY_SUPERVISOR;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INTERVAL_MS;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_MODE;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN;
    hoisted.heartbeatRunner.stop.mockClear();
    hoisted.heartbeatRunner.updateConfig.mockClear();
    hoisted.startHeartbeatRunner.mockClear();
    hoisted.startChannelHealthMonitor.mockClear();
    hoisted.startGatewayModelPricingRefresh.mockClear();
    hoisted.recoverPendingDeliveries.mockClear();
    hoisted.deliverOutboundPayloads.mockClear();
    hoisted.reconcileLoopJobs.mockClear();
    hoisted.healFleet.mockClear();
    hoisted.superviseFleet.mockClear();
    hoisted.bindAutonomySession.mockClear();
    hoisted.createRuntimeAutonomy.mockReset();
    hoisted.createRuntimeTaskFlow.mockClear();
    hoisted.bindAutonomySession.mockReturnValue({
      reconcileLoopJobs: hoisted.reconcileLoopJobs,
      healFleet: hoisted.healFleet,
      superviseFleet: hoisted.superviseFleet,
    });
    hoisted.createRuntimeAutonomy.mockReturnValue({
      bindSession: hoisted.bindAutonomySession,
    });
  });

  it("keeps scheduled services inert during initial runtime setup", () => {
    const services = startGatewayRuntimeServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      channelManager: {
        getRuntimeSnapshot: vi.fn(),
        isHealthMonitorEnabled: vi.fn(),
        isManuallyStopped: vi.fn(),
      } as never,
      log: createLog(),
    });

    expect(hoisted.startChannelHealthMonitor).toHaveBeenCalledTimes(1);
    expect(hoisted.startHeartbeatRunner).not.toHaveBeenCalled();
    expect(hoisted.recoverPendingDeliveries).not.toHaveBeenCalled();

    services.heartbeatRunner.stop();
    expect(hoisted.heartbeatRunner.stop).not.toHaveBeenCalled();
  });

  it("activates heartbeat, cron, and delivery recovery after sidecars are ready", async () => {
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const log = createLog();

    const services = activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log,
    });

    expect(hoisted.startHeartbeatRunner).toHaveBeenCalledTimes(1);
    expect(cron.start).toHaveBeenCalledTimes(1);
    await vi.dynamicImportSettled();
    expect(hoisted.createRuntimeAutonomy).toHaveBeenCalledWith(
      expect.objectContaining({
        legacyTaskFlow: { kind: "taskflow-runtime" },
        cronService: cron,
      }),
    );
    expect(hoisted.bindAutonomySession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
      }),
    );
    expect(hoisted.superviseFleet).toHaveBeenCalledWith({
      governanceMode: "apply_safe",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });
    expect(hoisted.healFleet).not.toHaveBeenCalled();
    expect(hoisted.reconcileLoopJobs).not.toHaveBeenCalled();
    services.heartbeatRunner.updateConfig({ gateway: { channelHealthCheckMinutes: 9 } } as never);
    expect(hoisted.heartbeatRunner.updateConfig).toHaveBeenCalledWith({
      gateway: { channelHealthCheckMinutes: 9 },
    });
    expect(hoisted.recoverPendingDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({
        deliver: hoisted.deliverOutboundPayloads,
        cfg: {},
      }),
    );
  });

  it("falls back to loop reconcile when startup flow heal is disabled", async () => {
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const log = createLog();
    process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL = "1";

    try {
      activateGatewayScheduledServices({
        minimalTestGateway: false,
        cfgAtStart: {} as never,
        cron,
        logCron: { error: vi.fn() },
        log,
      });

      await vi.dynamicImportSettled();
      expect(hoisted.reconcileLoopJobs).toHaveBeenCalledWith({
        telemetrySource: "startup",
      });
      expect(hoisted.healFleet).not.toHaveBeenCalled();
      expect(hoisted.superviseFleet).not.toHaveBeenCalled();
    } finally {
      delete process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL;
    }
  });

  it("keeps supervising autonomy continuity on an interval until stopped", async () => {
    vi.useFakeTimers();
    process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INTERVAL_MS = "1000";
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const log = createLog();

    const services = activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log,
    });

    await vi.dynamicImportSettled();
    expect(hoisted.superviseFleet).toHaveBeenCalledTimes(1);
    expect(hoisted.superviseFleet).toHaveBeenNthCalledWith(1, {
      governanceMode: "apply_safe",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.superviseFleet).toHaveBeenCalledTimes(2);
    expect(hoisted.superviseFleet).toHaveBeenNthCalledWith(2, {
      governanceMode: "apply_safe",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
      restartBlockedFlows: false,
      telemetrySource: "supervisor",
    });

    services.heartbeatRunner.stop();
    expect(hoisted.heartbeatRunner.stop).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.superviseFleet).toHaveBeenCalledTimes(2);
  });

  it("supports explicit heal mode override for gateway autonomy maintenance", async () => {
    process.env.OPENCLAW_AUTONOMY_SUPERVISOR_MODE = "heal";
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log: createLog(),
    });

    await vi.dynamicImportSettled();
    expect(hoisted.healFleet).toHaveBeenCalledWith({
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });
    expect(hoisted.superviseFleet).not.toHaveBeenCalled();
  });

  it("supports supervise env overrides for governance and inventory planning", async () => {
    process.env.OPENCLAW_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE = "force_apply_all";
    process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY = "0";
    process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN = "false";
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log: createLog(),
    });

    await vi.dynamicImportSettled();
    expect(hoisted.superviseFleet).toHaveBeenCalledWith({
      governanceMode: "force_apply_all",
      includeCapabilityInventory: false,
      includeGenesisPlan: false,
      recordHistory: true,
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });
  });

  it("skips autonomy reconcile when cron lacks management capabilities", async () => {
    const cron = { start: vi.fn(async () => undefined) };
    const log = createLog();

    activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log,
    });

    await vi.dynamicImportSettled();
    expect(hoisted.createRuntimeAutonomy).not.toHaveBeenCalled();
    expect(hoisted.recoverPendingDeliveries).toHaveBeenCalledTimes(1);
  });

  it("keeps scheduled services disabled for minimal test gateways", () => {
    const cron = { start: vi.fn(async () => undefined) };

    const services = activateGatewayScheduledServices({
      minimalTestGateway: true,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log: createLog(),
    });

    expect(hoisted.startHeartbeatRunner).not.toHaveBeenCalled();
    expect(cron.start).not.toHaveBeenCalled();
    expect(hoisted.recoverPendingDeliveries).not.toHaveBeenCalled();

    services.heartbeatRunner.stop();
    expect(hoisted.heartbeatRunner.stop).not.toHaveBeenCalled();
  });
});

function createLog() {
  return {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    error: vi.fn(),
  };
}
