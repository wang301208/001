import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const businessTasks: unknown[] = [];
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
    loadModelCatalog: vi.fn(async () => [{ id: "model-1" }]),
    listAgentIds: vi.fn(() => ["main", "ops"]),
    resolveAgentWorkspaceDir: vi.fn((_cfg: unknown, agentId: string) => `/workspace/${agentId}`),
    buildWorkspaceSkillStatus: vi.fn((workspaceDir: string) => ({
      workspaceDir,
      managedSkillsDir: `${workspaceDir}/.zhushou/skills`,
      skills: [{ eligible: true }, { eligible: false }],
    })),
    sweepTaskRegistry: vi.fn(async () => ({
      reconciled: 2,
      governanceStamped: 1,
      cleanupStamped: 1,
      pruned: 0,
    })),
    primeRemoteSkillsCache: vi.fn(async () => undefined),
    refreshRemoteBinsForConnectedNodes: vi.fn(async () => undefined),
    buildToolsCatalogResult: vi.fn(() => ({
      groups: [
        { id: "core", tools: [{ id: "shell" }, { id: "files" }] },
        { id: "plugin:test", tools: [{ id: "plugin_echo" }] },
      ],
    })),
    getGovernanceOverview: vi.fn(() => ({
      findings: [{ id: "finding_1" }],
      organization: { agentCount: 2 },
    })),
    getGovernanceCapabilityInventory: vi.fn(() => ({
      entries: [{ id: "capability_1" }, { id: "capability_2" }],
      workspaceDirs: ["/workspace/main"],
      requestedAgentIds: ["main"],
    })),
    getGovernanceCapabilityAssetRegistry: vi.fn(() => ({
      currentAssetCount: 1,
      planned: [],
    })),
    getGovernanceGenesisPlan: vi.fn(() => ({
      stages: [{ id: "stage_1" }],
    })),
    repairDreamingArtifacts: vi.fn(async () => ({ changed: true, warnings: [] })),
    dedupeDreamDiaryEntries: vi.fn(async () => ({ removed: 2, kept: 5 })),
    summarizeExperience: vi.fn(() => ({
      counts: { events: 3, skillCandidates: 2, selfModelFacts: 1 },
      recentEvents: [],
      recentSkillCandidates: [],
      selfModel: {
        strengths: [],
        weaknesses: [],
        preferences: [],
        learnedPatterns: [],
        nextGrowthAreas: [],
        evidenceEventIds: [],
        updatedAt: 0,
      },
    })),
    listDueStrategicPushes: vi.fn(() => [
      {
        id: "strategy_1",
        title: "Strategy push",
        prompt: "Strategic push: improve self loops",
        cadence: "daily",
        nextPushAt: 1,
        evidenceEventIds: [],
        tags: ["self"],
      },
    ]),
    advanceStrategicMemoryPush: vi.fn(() => ({
      id: "strategy_1",
      title: "Strategy push",
      objective: "improve self loops",
      cadence: "daily",
      nextPushAt: 86_401_000,
      lastPushedAt: 1_000,
      evidenceEventIds: [],
      tags: ["self"],
      createdAt: 1,
      updatedAt: 1_000,
    })),
    listSkillCandidates: vi.fn(() => [{ id: "skill_candidate_1" }, { id: "skill_candidate_2" }]),
    getSelfModel: vi.fn(() => ({
      strengths: [],
      weaknesses: [],
      preferences: [],
      learnedPatterns: [],
      nextGrowthAreas: [],
      evidenceEventIds: [],
      updatedAt: 0,
    })),
    updateSelfModel: vi.fn((params: Record<string, unknown>) => ({
      strengths: [],
      weaknesses: [],
      preferences: [],
      learnedPatterns: params.learnedPatterns ?? [],
      nextGrowthAreas: params.nextGrowthAreas ?? [],
      evidenceEventIds: [],
      updatedAt: 1,
    })),
    advanceSelfRoadmap: vi.fn(() => ({ createdStrategicMemories: 1, advancedGoalIds: ["skill_reuse"] })),
    getSelfRoadmap: vi.fn(() => ({
      observedAt: 1,
      metrics: {
        complexTaskCount: 1,
        skillCandidateCount: 1,
        implementedSkillCount: 0,
        selfImprovedSkillCount: 0,
        selfModelFactCount: 1,
        strategicMemoryCount: 0,
        dueStrategicPushCount: 0,
        skillReuseReadiness: 25,
      },
      goals: [
        {
          id: "skill_reuse",
          title: "Self roadmap: reusable skill adoption",
          objective: "Turn repeated fixes into reusable skills and apply them before starting new work.",
          status: "active",
          priority: "high",
          nextPushAt: 1,
          evidenceEventIds: ["exp_1"],
          blockers: [],
        },
        {
          id: "self_upgrade_loop",
          title: "Self roadmap: code-level upgrade loop",
          objective: "Close the loop from detected capability gaps to implementation, verification, and release handoff.",
          status: "active",
          priority: "high",
          nextPushAt: 1,
          evidenceEventIds: ["exp_2"],
          blockers: ["Requires guarded code-change orchestration and release policy integration"],
        },
      ],
    })),
    businessTasks,
    listBusinessTasks: vi.fn(((params?: { status?: string }) =>
      params?.status
        ? businessTasks.filter((task) =>
            task && typeof task === "object" && (task as { status?: unknown }).status === params.status
          )
        : businessTasks) as (
      params?: { status?: string },
    ) => unknown[]),
    createBusinessTask: vi.fn((params: {
      agentId: string;
      name: string;
      goal: string;
      duration: string;
      priority: string;
      group: string;
      business: { payload?: Record<string, unknown> };
    }) => {
      const task = {
        id: "bt_self_1",
        status: "running",
        progress: 0,
        createdAt: 1,
        updatedAt: 1,
        ...params,
      };
      businessTasks.unshift(task);
      return task;
    }),
    updateBusinessTask: vi.fn(),
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
    startManagedFlow: vi.fn(() => ({
      flow: { id: "flow_1" },
      seedTask: { id: "seed_1" },
    })),
    bindAutonomySession: vi.fn(),
    createRuntimeAutonomy: vi.fn(),
    createRuntimeTaskFlow: vi.fn(() => ({ kind: "taskflow-runtime" })),
    startAutonomousMonitoring: vi.fn(),
    startAutonomousHealthMonitoring: vi.fn(),
    startTaskProcessing: vi.fn(),
    startCreativeProblemSolving: vi.fn(),
    stopAutonomousMonitoring: vi.fn(),
    stopAutonomousHealthMonitoring: vi.fn(),
    stopTaskProcessing: vi.fn(),
    stopCreativeProblemSolving: vi.fn(),
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

vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: hoisted.loadModelCatalog,
}));

vi.mock("../agents/agent-scope.js", () => ({
  listAgentIds: hoisted.listAgentIds,
  resolveAgentWorkspaceDir: hoisted.resolveAgentWorkspaceDir,
}));

vi.mock("../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: hoisted.buildWorkspaceSkillStatus,
}));

vi.mock("../tasks/task-registry.maintenance.js", () => ({
  sweepTaskRegistry: hoisted.sweepTaskRegistry,
}));

vi.mock("../infra/skills-remote.js", () => ({
  primeRemoteSkillsCache: hoisted.primeRemoteSkillsCache,
  refreshRemoteBinsForConnectedNodes: hoisted.refreshRemoteBinsForConnectedNodes,
}));

vi.mock("./server-methods/tools-catalog.js", () => ({
  buildToolsCatalogResult: hoisted.buildToolsCatalogResult,
}));

vi.mock("../governance/control-plane.js", () => ({
  getGovernanceOverview: hoisted.getGovernanceOverview,
  getGovernanceCapabilityInventory: hoisted.getGovernanceCapabilityInventory,
  getGovernanceCapabilityAssetRegistry: hoisted.getGovernanceCapabilityAssetRegistry,
  getGovernanceGenesisPlan: hoisted.getGovernanceGenesisPlan,
}));

vi.mock("./server-methods/doctor.memory-core-runtime.js", () => ({
  repairDreamingArtifacts: hoisted.repairDreamingArtifacts,
  dedupeDreamDiaryEntries: hoisted.dedupeDreamDiaryEntries,
}));

vi.mock("../experience/experience-store.js", () => ({
  summarizeExperience: hoisted.summarizeExperience,
  listDueStrategicPushes: hoisted.listDueStrategicPushes,
  advanceStrategicMemoryPush: hoisted.advanceStrategicMemoryPush,
  listSkillCandidates: hoisted.listSkillCandidates,
  getSelfModel: hoisted.getSelfModel,
  updateSelfModel: hoisted.updateSelfModel,
  advanceSelfRoadmap: hoisted.advanceSelfRoadmap,
  getSelfRoadmap: hoisted.getSelfRoadmap,
}));

vi.mock("../tasks/business-task-store.js", () => ({
  createBusinessTask: hoisted.createBusinessTask,
  listBusinessTasks: hoisted.listBusinessTasks,
  updateBusinessTask: hoisted.updateBusinessTask,
}));

vi.mock("../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: hoisted.createRuntimeTaskFlow,
}));

vi.mock("../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: hoisted.createRuntimeAutonomy,
}));

vi.mock("../governance/level5-autonomy.js", () => ({
  autonomousStrategyAdjuster: {
    startAutonomousMonitoring: hoisted.startAutonomousMonitoring,
    stopAutonomousMonitoring: hoisted.stopAutonomousMonitoring,
  },
  enhancedSelfHealingEngine: {
    startAutonomousHealthMonitoring: hoisted.startAutonomousHealthMonitoring,
    stopAutonomousHealthMonitoring: hoisted.stopAutonomousHealthMonitoring,
  },
  crossSystemCoordinator: {
    startTaskProcessing: hoisted.startTaskProcessing,
    stopTaskProcessing: hoisted.stopTaskProcessing,
  },
  creativeProblemSolver: {
    startCreativeProblemSolving: hoisted.startCreativeProblemSolving,
    stopCreativeProblemSolving: hoisted.stopCreativeProblemSolving,
  },
}));

const {
  activateGatewayScheduledServices,
  getGatewayAutomationRuntimeState,
  getGatewayBackendAutomationHistory,
  resetGatewayAutomationRuntimeState,
  startGatewayRuntimeServices,
} =
  await import("./server-runtime-services.js");

describe("server-runtime-services", () => {
  beforeEach(() => {
    vi.useRealTimers();
    delete process.env.ZHUSHOU_SKIP_CRON;
    delete process.env.ZHUSHOU_SKIP_AUTONOMY_RECONCILE;
    delete process.env.ZHUSHOU_SKIP_AUTONOMY_FLOW_HEAL;
    delete process.env.ZHUSHOU_SKIP_AUTONOMY_SUPERVISOR;
    delete process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INTERVAL_MS;
    delete process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_MODE;
    delete process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE;
    delete process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY;
    delete process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN;
    delete process.env.ZHUSHOU_SKIP_BACKEND_AUTOMATION;
    delete process.env.ZHUSHOU_BACKEND_AUTOMATION_INTERVAL_MS;
    resetGatewayAutomationRuntimeState();
    hoisted.heartbeatRunner.stop.mockClear();
    hoisted.heartbeatRunner.updateConfig.mockClear();
    hoisted.startHeartbeatRunner.mockClear();
    hoisted.startChannelHealthMonitor.mockClear();
    hoisted.startGatewayModelPricingRefresh.mockClear();
    hoisted.recoverPendingDeliveries.mockClear();
    hoisted.deliverOutboundPayloads.mockClear();
    hoisted.loadModelCatalog.mockClear();
    hoisted.listAgentIds.mockClear();
    hoisted.resolveAgentWorkspaceDir.mockClear();
    hoisted.buildWorkspaceSkillStatus.mockClear();
    hoisted.sweepTaskRegistry.mockClear();
    hoisted.primeRemoteSkillsCache.mockClear();
    hoisted.refreshRemoteBinsForConnectedNodes.mockClear();
    hoisted.buildToolsCatalogResult.mockClear();
    hoisted.getGovernanceOverview.mockClear();
    hoisted.getGovernanceCapabilityInventory.mockClear();
    hoisted.getGovernanceCapabilityAssetRegistry.mockClear();
    hoisted.getGovernanceGenesisPlan.mockClear();
    hoisted.repairDreamingArtifacts.mockClear();
    hoisted.dedupeDreamDiaryEntries.mockClear();
    hoisted.summarizeExperience.mockClear();
    hoisted.listDueStrategicPushes.mockClear();
    hoisted.advanceStrategicMemoryPush.mockClear();
    hoisted.listSkillCandidates.mockClear();
    hoisted.getSelfModel.mockClear();
    hoisted.updateSelfModel.mockClear();
    hoisted.advanceSelfRoadmap.mockClear();
    hoisted.getSelfRoadmap.mockClear();
    hoisted.businessTasks.length = 0;
    hoisted.listBusinessTasks.mockReset().mockImplementation((params?: { status?: string }) =>
      params?.status
        ? hoisted.businessTasks.filter((task) =>
            task && typeof task === "object" && (task as { status?: unknown }).status === params.status
          )
        : hoisted.businessTasks
    );
    hoisted.createBusinessTask.mockClear();
    hoisted.updateBusinessTask.mockClear();
    hoisted.reconcileLoopJobs.mockClear();
    hoisted.healFleet.mockClear();
    hoisted.superviseFleet.mockClear();
    hoisted.startManagedFlow.mockClear();
    hoisted.bindAutonomySession.mockClear();
    hoisted.createRuntimeAutonomy.mockReset();
    hoisted.createRuntimeTaskFlow.mockClear();
    hoisted.startAutonomousMonitoring.mockClear();
    hoisted.startAutonomousHealthMonitoring.mockClear();
    hoisted.startTaskProcessing.mockClear();
    hoisted.startCreativeProblemSolving.mockClear();
    hoisted.stopAutonomousMonitoring.mockClear();
    hoisted.stopAutonomousHealthMonitoring.mockClear();
    hoisted.stopTaskProcessing.mockClear();
    hoisted.stopCreativeProblemSolving.mockClear();
    hoisted.bindAutonomySession.mockReturnValue({
      reconcileLoopJobs: hoisted.reconcileLoopJobs,
      healFleet: hoisted.healFleet,
      superviseFleet: hoisted.superviseFleet,
      startManagedFlow: hoisted.startManagedFlow,
    });
    hoisted.createRuntimeAutonomy.mockReturnValue({
      bindSession: hoisted.bindAutonomySession,
    });
  });

  it("starts level 5 self-autonomy loops with scheduled services", async () => {
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

    expect(hoisted.startAutonomousMonitoring).toHaveBeenCalledTimes(1);
    expect(hoisted.startAutonomousHealthMonitoring).toHaveBeenCalledTimes(1);
    expect(hoisted.startTaskProcessing).toHaveBeenCalledTimes(1);
    expect(hoisted.startCreativeProblemSolving).toHaveBeenCalledTimes(1);
    expect(getGatewayAutomationRuntimeState().units).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "self.level5.strategy-monitor", started: true }),
      expect.objectContaining({ id: "self.level5.health-monitor", started: true }),
      expect.objectContaining({ id: "self.level5.cross-system", started: true }),
      expect.objectContaining({ id: "self.level5.creative-solver", started: true }),
    ]));
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
    expect(hoisted.loadModelCatalog).toHaveBeenCalledWith({ config: {} });
    expect(hoisted.buildWorkspaceSkillStatus).toHaveBeenCalledTimes(2);
    expect(hoisted.buildWorkspaceSkillStatus).toHaveBeenNthCalledWith(1, "/workspace/main", {
      config: {},
    });
    expect(hoisted.buildWorkspaceSkillStatus).toHaveBeenNthCalledWith(2, "/workspace/ops", {
      config: {},
    });
    expect(hoisted.sweepTaskRegistry).toHaveBeenCalledTimes(1);
    expect(hoisted.primeRemoteSkillsCache).toHaveBeenCalledTimes(1);
    expect(hoisted.refreshRemoteBinsForConnectedNodes).toHaveBeenCalledWith({});
    expect(hoisted.buildToolsCatalogResult).toHaveBeenCalledTimes(2);
    expect(hoisted.buildToolsCatalogResult).toHaveBeenNthCalledWith(1, {
      cfg: {},
      agentId: "main",
      includePlugins: true,
    });
    expect(hoisted.buildToolsCatalogResult).toHaveBeenNthCalledWith(2, {
      cfg: {},
      agentId: "ops",
      includePlugins: true,
    });
    expect(hoisted.getGovernanceOverview).toHaveBeenCalledWith({ cfg: {} });
    expect(hoisted.getGovernanceCapabilityInventory).toHaveBeenCalledWith({ cfg: {} });
    expect(hoisted.getGovernanceCapabilityAssetRegistry).toHaveBeenCalledWith({
      cfg: {},
    });
    expect(hoisted.getGovernanceGenesisPlan).toHaveBeenCalledWith({
      cfg: {},
      inventory: expect.any(Object),
    });
    expect(hoisted.repairDreamingArtifacts).toHaveBeenCalledTimes(2);
    expect(hoisted.repairDreamingArtifacts).toHaveBeenNthCalledWith(1, {
      workspaceDir: "/workspace/main",
    });
    expect(hoisted.repairDreamingArtifacts).toHaveBeenNthCalledWith(2, {
      workspaceDir: "/workspace/ops",
    });
    expect(hoisted.dedupeDreamDiaryEntries).toHaveBeenCalledTimes(2);
    expect(hoisted.summarizeExperience).toHaveBeenCalledWith({ limit: 20 });
    expect(hoisted.listDueStrategicPushes).toHaveBeenCalledWith({ limit: 20 });
    expect(hoisted.advanceStrategicMemoryPush).toHaveBeenCalledWith({ id: "strategy_1" });
    expect(hoisted.listSkillCandidates).toHaveBeenCalledWith({ limit: 100 });
    expect(hoisted.getSelfModel).toHaveBeenCalledTimes(1);
    expect(hoisted.updateSelfModel).toHaveBeenCalledWith(expect.objectContaining({
      learnedPatterns: expect.arrayContaining([
        expect.stringContaining("Startup automation continuously reconciles"),
      ]),
      nextGrowthAreas: expect.arrayContaining([
        expect.stringContaining("unified automation runtime state"),
      ]),
    }));
    expect(hoisted.advanceSelfRoadmap).toHaveBeenCalledTimes(1);
  });

  it("exposes every startup self-automation unit through the runtime state", async () => {
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

    const runtime = getGatewayAutomationRuntimeState();
    expect(runtime.summary.enabled).toBeGreaterThanOrEqual(14);
    expect(runtime.units).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "core.heartbeat", status: "idle", started: true }),
      expect.objectContaining({ id: "core.cron", status: "idle", started: true }),
      expect.objectContaining({ id: "autonomy.supervisor", started: true }),
      expect.objectContaining({ id: "backend.supervisor", started: true }),
      expect.objectContaining({ id: "autonomy.startup-maintenance", lastOk: true }),
      expect.objectContaining({ id: "backend.startup-automation", lastOk: true }),
      expect.objectContaining({ id: "self.experience-summary", lastOk: true }),
      expect.objectContaining({ id: "self.strategic-pushes", lastOk: true }),
      expect.objectContaining({ id: "self.skill-candidate-scan", lastOk: true }),
      expect.objectContaining({ id: "self.self-model-calibration", lastOk: true }),
      expect.objectContaining({ id: "self.roadmap", lastOk: true }),
      expect.objectContaining({ id: "self.roadmap-tasks", lastOk: true }),
      expect.objectContaining({ id: "autonomy.business-task-recovery", lastOk: true }),
    ]));
  });

  it("starts persistent supervisors before slow startup automation finishes", async () => {
    let releaseCatalog!: () => void;
    hoisted.loadModelCatalog.mockReturnValueOnce(new Promise((resolve) => {
      releaseCatalog = () => resolve([{ id: "model-1" }]);
    }));
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

    await Promise.resolve();
    await Promise.resolve();

    expect(getGatewayAutomationRuntimeState().units).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "autonomy.supervisor", started: true }),
      expect.objectContaining({ id: "backend.supervisor", started: true }),
      expect.objectContaining({ id: "backend.startup-automation", running: true }),
    ]));

    releaseCatalog();
    await vi.dynamicImportSettled();
  });

  it("recovers active business tasks through backend automation on startup", async () => {
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    hoisted.listBusinessTasks.mockImplementation((params?: { status?: string }) =>
      params?.status === "running"
        ? [
            {
              id: "bt_1",
              agentId: "main",
              name: "恢复业务接入",
              goal: "继续完成业务接入",
              status: "running",
              progress: 5,
              duration: "long",
              priority: "high",
              group: "ai",
              business: { domain: "general", accessMode: "automatic" },
              createdAt: 1,
              updatedAt: 1,
            },
          ]
        : [],
    );

    activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log: createLog(),
    });

    await vi.dynamicImportSettled();
    expect(hoisted.startManagedFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "main",
        goal: expect.stringContaining("继续完成业务接入"),
        status: "running",
      }),
    );
    expect(hoisted.updateBusinessTask).toHaveBeenCalledWith(
      "bt_1",
      expect.objectContaining({
        progress: 15,
        autonomy: expect.objectContaining({
          flowId: "flow_1",
        }),
      }),
    );
  });

  it("materializes active self-roadmap goals as autonomous business tasks on startup", async () => {
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

    expect(hoisted.getSelfRoadmap).toHaveBeenCalledTimes(1);
    expect(hoisted.createBusinessTask).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "main",
      name: "Self roadmap: reusable skill adoption",
      goal: expect.stringContaining("Turn repeated fixes into reusable skills"),
      duration: "long",
      priority: "high",
      group: "self-roadmap",
      business: expect.objectContaining({
        domain: "self",
        accessMode: "autonomous",
        payload: expect.objectContaining({
          selfRoadmapGoalId: "skill_reuse",
        }),
      }),
    }));
    expect(hoisted.createBusinessTask).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "main",
      name: "Self roadmap: code-level upgrade loop",
      group: "self-code-upgrade",
      business: expect.objectContaining({
        domain: "self-code",
        accessMode: "autonomous-code-change",
        payload: expect.objectContaining({
          selfRoadmapGoalId: "self_upgrade_loop",
          codeChangeContract: expect.objectContaining({
            strategy: "test-first",
            verificationCommands: expect.arrayContaining(["pnpm tsgo"]),
            allowedPaths: expect.arrayContaining(["src/"]),
            deliverables: expect.arrayContaining([
              "implementation patch",
              "fresh verification output",
              "experience memory update",
            ]),
          }),
        }),
      }),
    }));
    expect(hoisted.startManagedFlow).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "main",
      goal: expect.stringContaining("[backend-automation:business-task-recovery]"),
      status: "running",
    }));
    expect(hoisted.updateBusinessTask).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        progress: 15,
        autonomy: expect.objectContaining({
          flowId: "flow_1",
        }),
      }),
    );
  });

  it("does not duplicate already materialized self-roadmap business tasks", async () => {
    hoisted.businessTasks.push({
      id: "bt_existing",
      agentId: "main",
      name: "Existing self roadmap task",
      goal: "Already materialized",
      status: "running",
      progress: 15,
      duration: "long",
      priority: "high",
      group: "self-roadmap",
      business: {
        domain: "self",
        accessMode: "autonomous",
        payload: { selfRoadmapGoalId: "skill_reuse" },
      },
      autonomy: { flowId: "existing-flow" },
      createdAt: 1,
      updatedAt: 1,
    });
    hoisted.businessTasks.push({
      id: "bt_existing_code",
      agentId: "main",
      name: "Existing self code upgrade task",
      goal: "Already materialized",
      status: "running",
      progress: 15,
      duration: "long",
      priority: "high",
      group: "self-code-upgrade",
      business: {
        domain: "self-code",
        accessMode: "autonomous-code-change",
        payload: { selfRoadmapGoalId: "self_upgrade_loop" },
      },
      autonomy: { flowId: "existing-code-flow" },
      createdAt: 1,
      updatedAt: 1,
    });
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

    expect(hoisted.getSelfRoadmap).toHaveBeenCalledTimes(1);
    expect(hoisted.createBusinessTask).not.toHaveBeenCalled();
  });

  it("keeps backend automation running on an interval until stopped", async () => {
    vi.useFakeTimers();
    process.env.ZHUSHOU_BACKEND_AUTOMATION_INTERVAL_MS = "1000";
    const cron = {
      start: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const services = activateGatewayScheduledServices({
      minimalTestGateway: false,
      cfgAtStart: {} as never,
      cron,
      logCron: { error: vi.fn() },
      log: createLog(),
    });

    await vi.dynamicImportSettled();
    expect(hoisted.loadModelCatalog).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.loadModelCatalog).toHaveBeenCalledTimes(2);

    services.heartbeatRunner.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(hoisted.loadModelCatalog).toHaveBeenCalledTimes(2);
  });

  it("isolates backend automation step failures so the remaining startup automation still runs", async () => {
    hoisted.loadModelCatalog.mockRejectedValueOnce(new Error("catalog down"));
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
    expect(hoisted.buildWorkspaceSkillStatus).toHaveBeenCalledTimes(2);
    expect(hoisted.sweepTaskRegistry).toHaveBeenCalledTimes(1);
    expect(hoisted.refreshRemoteBinsForConnectedNodes).toHaveBeenCalledTimes(1);
    expect(hoisted.buildToolsCatalogResult).toHaveBeenCalledTimes(2);
    expect(hoisted.getGovernanceOverview).toHaveBeenCalledTimes(1);
    expect(hoisted.repairDreamingArtifacts).toHaveBeenCalledTimes(2);
  });

  it("persists backend automation run history for self status inspection", async () => {
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

    const history = getGatewayBackendAutomationHistory({ limit: 1 });
    expect(history).toEqual([
      expect.objectContaining({
        source: "startup",
        changedCount: expect.any(Number),
        ok: true,
        steps: expect.arrayContaining([
          expect.objectContaining({ name: "model-catalog", ok: true }),
          expect.objectContaining({ name: "memory-artifacts", ok: true }),
          expect.objectContaining({ name: "self-roadmap", ok: true }),
        ]),
      }),
    ]);
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
    process.env.ZHUSHOU_SKIP_AUTONOMY_FLOW_HEAL = "1";

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
      delete process.env.ZHUSHOU_SKIP_AUTONOMY_FLOW_HEAL;
    }
  });

  it("keeps supervising autonomy continuity on an interval until stopped", async () => {
    vi.useFakeTimers();
    process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INTERVAL_MS = "1000";
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
    process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_MODE = "heal";
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
    process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE = "force_apply_all";
    process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY = "0";
    process.env.ZHUSHOU_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN = "false";
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
