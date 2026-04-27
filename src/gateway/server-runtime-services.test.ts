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
    delete process.env.OPENCLAW_SKIP_AUTONOMY_FLOW_HEAL;
    delete process.env.OPENCLAW_SKIP_AUTONOMY_SUPERVISOR;
    delete process.env.OPENCLAW_AUTONOMY_SUPERVISOR_INTERVAL_MS;
    hoisted.heartbeatRunner.stop.mockClear();
    hoisted.heartbeatRunner.updateConfig.mockClear();
    hoisted.startHeartbeatRunner.mockClear();
    hoisted.startChannelHealthMonitor.mockClear();
    hoisted.startGatewayModelPricingRefresh.mockClear();
    hoisted.recoverPendingDeliveries.mockClear();
    hoisted.deliverOutboundPayloads.mockClear();
    hoisted.reconcileLoopJobs.mockClear();
    hoisted.healFleet.mockClear();
    hoisted.bindAutonomySession.mockClear();
    hoisted.createRuntimeAutonomy.mockReset();
    hoisted.createRuntimeTaskFlow.mockClear();
    hoisted.bindAutonomySession.mockReturnValue({
      reconcileLoopJobs: hoisted.reconcileLoopJobs,
      healFleet: hoisted.healFleet,
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
    expect(hoisted.healFleet).toHaveBeenCalledWith({
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });
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
    expect(hoisted.healFleet).toHaveBeenCalledTimes(1);
    expect(hoisted.healFleet).toHaveBeenNthCalledWith(1, {
      restartBlockedFlows: false,
      telemetrySource: "startup",
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.healFleet).toHaveBeenCalledTimes(2);
    expect(hoisted.healFleet).toHaveBeenNthCalledWith(2, {
      restartBlockedFlows: false,
      telemetrySource: "supervisor",
    });

    services.heartbeatRunner.stop();
    expect(hoisted.heartbeatRunner.stop).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.healFleet).toHaveBeenCalledTimes(2);
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
