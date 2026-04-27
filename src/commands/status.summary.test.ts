import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const statusSummaryMocks = vi.hoisted(() => ({
  hasPotentialConfiguredChannels: vi.fn(() => true),
  buildChannelSummary: vi.fn(async () => ["ok"]),
  getGovernanceOverview: vi.fn(() => ({
    observedAt: 1,
    discovered: true,
    proposals: {
      total: 3,
      pending: 1,
      approved: 1,
      rejected: 0,
      applied: 1,
    },
    enforcement: {
      active: false,
      denyTools: [],
    },
    findings: [
      {
        severity: "warn",
      },
      {
        severity: "info",
      },
    ],
  })),
  getGovernanceCapabilityInventory: vi.fn(() => ({
    requestedAgentIds: ["founder", "librarian"],
    summary: {
      totalEntries: 6,
      gapCount: 2,
      criticalGapCount: 1,
      warningGapCount: 1,
      infoGapCount: 0,
    },
    gaps: [{ id: "missing-plugin" }, { id: "stale-skill" }],
  })),
  getGovernanceGenesisPlan: vi.fn(() => ({
    teamId: "genesis",
    teamTitle: "Genesis Team",
    mode: "repair",
    blockers: ["missing-plugin"],
    focusGapIds: ["missing-plugin"],
    stages: [{ status: "ready" }, { status: "blocked" }],
  })),
  getGovernanceTeam: vi.fn(() => ({
    observedAt: 1,
    teamId: "genesis",
    declared: true,
    members: [{ agentId: "founder" }, { agentId: "strategist" }, { agentId: "qa" }],
    declaredMemberIds: ["founder", "strategist", "qa"],
    missingMemberIds: ["qa"],
    runtimeHookCoverage: [
      "autonomy.genesis.plan",
      "autonomy.history",
      "governance.proposals.*",
    ],
    effectiveToolDeny: ["apply_patch", "web_fetch"],
    mutationAllow: ["charter_agents"],
    mutationDeny: ["constitution"],
    freezeActiveMemberIds: ["founder"],
  })),
  createRuntimeAutonomy: vi.fn(),
  createRuntimeTaskFlow: vi.fn(() => ({ kind: "taskflow-runtime" })),
  bindAutonomySession: vi.fn(),
  getFleetStatus: vi.fn(async () => ({
    totals: {
      totalProfiles: 3,
      healthy: 1,
      idle: 1,
      drift: 1,
      missingLoop: 0,
      activeFlows: 2,
    },
    entries: [
      { agentId: "founder", health: "healthy" },
      { agentId: "strategist", health: "drift" },
      { agentId: "librarian", health: "idle" },
    ],
  })),
  getFleetHistory: vi.fn(async () => ({
    total: 1,
    truncated: false,
    events: [
      {
        eventId: "evt-1",
        ts: 11,
        sessionKey: "agent:main:main",
        mode: "heal",
        source: "supervisor",
        agentIds: ["founder", "strategist"],
        changed: true,
        totals: {
          totalProfiles: 3,
          changed: 2,
          unchanged: 1,
          loopCreated: 1,
          loopUpdated: 1,
          flowStarted: 1,
          flowRestarted: 0,
        },
        entries: [
          {
            agentId: "founder",
            changed: true,
            reasons: ["loop created"],
          },
          {
            agentId: "strategist",
            changed: true,
            reasons: ["flow started"],
          },
          {
            agentId: "librarian",
            changed: false,
            reasons: [],
          },
        ],
      },
    ],
  })),
  getAutonomyCapabilityInventory: vi.fn(async () => ({
    observedAt: 10,
    requestedAgentIds: ["founder", "strategist", "librarian"],
    summary: {
      totalEntries: 7,
      gapCount: 1,
      criticalGapCount: 0,
      warningGapCount: 1,
      infoGapCount: 0,
    },
    gaps: [{ id: "stale-index" }],
  })),
  planAutonomyGenesisWork: vi.fn(async () => ({
    observedAt: 12,
    teamId: "genesis",
    teamTitle: "Genesis Team",
    mode: "build",
    blockers: ["stale-index"],
    focusGapIds: ["stale-index"],
    stages: [{ status: "ready" }, { status: "waiting" }],
  })),
}));

vi.mock("../channels/config-presence.js", () => ({
  hasPotentialConfiguredChannels: statusSummaryMocks.hasPotentialConfiguredChannels,
}));

vi.mock("./status.summary.runtime.js", () => ({
  statusSummaryRuntime: {
    classifySessionKey: vi.fn(() => "direct"),
    resolveConfiguredStatusModelRef: vi.fn(() => ({
      provider: "openai",
      model: "gpt-5.4",
    })),
    resolveSessionModelRef: vi.fn(() => ({
      provider: "openai",
      model: "gpt-5.4",
    })),
    resolveContextTokensForModel: vi.fn(() => 200_000),
  },
}));

vi.mock("../agents/defaults.js", () => ({
  DEFAULT_CONTEXT_TOKENS: 200_000,
  DEFAULT_MODEL: "gpt-5.4",
  DEFAULT_PROVIDER: "openai",
}));

vi.mock("../config/io.js", () => ({
  loadConfig: vi.fn(() => ({})),
}));

vi.mock("../gateway/agent-list.js", () => ({
  listGatewayAgentsBasic: vi.fn(() => ({
    defaultId: "main",
    agents: [
      {
        id: "main",
        name: "Primary",
        configured: true,
        governance: {
          charterDeclared: true,
          charterTitle: "Founder",
          charterLayer: "evolution",
          charterToolDeny: ["web_fetch"],
          charterRequireAgentId: true,
          charterExecutionContract: "strict-agentic",
          charterElevatedLocked: true,
          freezeActive: false,
          freezeDeny: [],
          freezeDetails: [],
        },
      },
    ],
  })),
}));

vi.mock("../infra/channel-summary.js", () => ({
  buildChannelSummary: statusSummaryMocks.buildChannelSummary,
}));

vi.mock("../governance/control-plane.js", () => ({
  getGovernanceOverview: statusSummaryMocks.getGovernanceOverview,
  getGovernanceCapabilityInventory: statusSummaryMocks.getGovernanceCapabilityInventory,
  getGovernanceGenesisPlan: statusSummaryMocks.getGovernanceGenesisPlan,
  getGovernanceTeam: statusSummaryMocks.getGovernanceTeam,
}));

vi.mock("../infra/heartbeat-summary.js", () => ({
  resolveHeartbeatSummaryForAgent: vi.fn(() => ({
    enabled: true,
    every: "5m",
    everyMs: 300_000,
  })),
}));

vi.mock("../infra/system-events.js", () => ({
  peekSystemEvents: vi.fn(() => []),
}));

vi.mock("../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: statusSummaryMocks.createRuntimeTaskFlow,
}));

vi.mock("../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: statusSummaryMocks.createRuntimeAutonomy,
}));

vi.mock("../tasks/task-registry.maintenance.js", () => ({
  getInspectableTaskRegistrySummary: vi.fn(() => ({
    total: 0,
    active: 0,
    terminal: 0,
    failures: 0,
    byStatus: {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      timed_out: 0,
      cancelled: 0,
      lost: 0,
    },
    byRuntime: {
      subagent: 0,
      acp: 0,
      cli: 0,
      cron: 0,
    },
  })),
  getInspectableTaskAuditSummary: vi.fn(() => ({
    total: 1,
    warnings: 1,
    errors: 0,
    byCode: {
      stale_queued: 0,
      stale_running: 0,
      lost: 0,
      delivery_failed: 1,
      missing_governance_runtime: 0,
      missing_cleanup: 0,
      inconsistent_timestamps: 0,
    },
  })),
}));

vi.mock("../routing/session-key.js", () => ({
  normalizeAgentId: vi.fn((value: string) => value),
  normalizeMainKey: vi.fn((value?: string) => value ?? "main"),
  parseAgentSessionKey: vi.fn(() => null),
}));

vi.mock("../version.js", async () => {
  const actual = await vi.importActual<typeof import("../version.js")>("../version.js");
  return {
    ...actual,
    resolveRuntimeServiceVersion: vi.fn(() => "2026.3.8"),
  };
});

vi.mock("./status.link-channel.js", () => ({
  resolveLinkChannelContext: vi.fn(async () => undefined),
}));

const { buildChannelSummary } = await import("../infra/channel-summary.js");
const { resolveLinkChannelContext } = await import("./status.link-channel.js");
let getStatusSummary: typeof import("./status.summary.js").getStatusSummary;
let statusSummaryRuntime: typeof import("./status.summary.runtime.js").statusSummaryRuntime;

describe("getStatusSummary", () => {
  beforeAll(async () => {
    ({ getStatusSummary } = await import("./status.summary.js"));
    ({ statusSummaryRuntime } = await import("./status.summary.runtime.js"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    statusSummaryMocks.hasPotentialConfiguredChannels.mockReturnValue(true);
    statusSummaryMocks.buildChannelSummary.mockResolvedValue(["ok"]);
    statusSummaryMocks.createRuntimeAutonomy.mockReturnValue({
      bindSession: statusSummaryMocks.bindAutonomySession,
    });
    statusSummaryMocks.bindAutonomySession.mockReturnValue({
      getFleetStatus: statusSummaryMocks.getFleetStatus,
      getFleetHistory: statusSummaryMocks.getFleetHistory,
      getCapabilityInventory: statusSummaryMocks.getAutonomyCapabilityInventory,
      planGenesisWork: statusSummaryMocks.planAutonomyGenesisWork,
    });
  });

  it("includes runtimeVersion in the status payload", async () => {
    const summary = await getStatusSummary();

    expect(summary.runtimeVersion).toBe("2026.3.8");
    expect(summary.heartbeat.defaultAgentId).toBe("main");
    expect(summary.heartbeat.agents[0]).toMatchObject({
      agentId: "main",
      name: "Primary",
      configured: true,
      governance: {
        charterDeclared: true,
        charterLayer: "evolution",
        charterTitle: "Founder",
        charterExecutionContract: "strict-agentic",
      },
    });
    expect(summary.channelSummary).toEqual(["ok"]);
    expect(summary.tasks.active).toBe(0);
    expect(summary.taskAudit.warnings).toBe(1);
    expect(summary.governance).toMatchObject({
      discovered: true,
      freezeActive: false,
      proposalSummary: {
        pending: 1,
      },
      findingSummary: {
        warn: 1,
        info: 1,
      },
      capabilitySummary: {
        totalEntries: 6,
        gapCount: 2,
        topGapIds: ["missing-plugin", "stale-skill"],
      },
      genesisSummary: {
        teamId: "genesis",
        mode: "repair",
        blockerCount: 1,
        stageCounts: {
          ready: 1,
          blocked: 1,
        },
      },
      teamSummary: {
        teamId: "genesis",
        declared: true,
        memberCount: 3,
        missingMemberCount: 1,
        missingMemberIds: ["qa"],
        freezeActiveMemberCount: 1,
        freezeActiveMemberIds: ["founder"],
        runtimeHookCount: 3,
        effectiveToolDenyCount: 2,
      },
    });
    expect(summary.autonomy).toMatchObject({
      observedAt: 12,
      fleetSummary: {
        totalProfiles: 3,
        drift: 1,
        activeFlows: 2,
        driftAgentIds: ["strategist"],
      },
      capabilitySummary: {
        totalEntries: 7,
        gapCount: 1,
        topGapIds: ["stale-index"],
      },
      genesisSummary: {
        teamId: "genesis",
        mode: "build",
        blockerCount: 1,
        stageCounts: {
          ready: 1,
          waiting: 1,
        },
      },
      lastSupervisorRun: {
        observedAt: 11,
        mode: "heal",
        changed: true,
        agentIds: ["founder", "strategist"],
        changedAgentIds: ["founder", "strategist"],
        totals: {
          totalProfiles: 3,
          changed: 2,
          unchanged: 1,
          loopCreated: 1,
          loopUpdated: 1,
          flowStarted: 1,
          flowRestarted: 0,
        },
      },
    });
    expect(summary.sessions.byAgent[0]).toMatchObject({
      agentId: "main",
      name: "Primary",
      configured: true,
      governance: {
        charterDeclared: true,
        charterLayer: "evolution",
      },
    });
  });

  it("skips channel summary imports when no channels are configured", async () => {
    statusSummaryMocks.hasPotentialConfiguredChannels.mockReturnValue(false);

    const summary = await getStatusSummary();

    expect(summary.channelSummary).toEqual([]);
    expect(summary.linkChannel).toBeUndefined();
    expect(buildChannelSummary).not.toHaveBeenCalled();
    expect(resolveLinkChannelContext).not.toHaveBeenCalled();
  });

  it("does not trigger async context warmup while building status summaries", async () => {
    await getStatusSummary();

    expect(vi.mocked(statusSummaryRuntime.resolveContextTokensForModel)).toHaveBeenCalledWith(
      expect.objectContaining({ allowAsyncLoad: false }),
    );
  });

  it("binds autonomy summary collection to the main session key", async () => {
    await getStatusSummary();

    expect(statusSummaryMocks.createRuntimeTaskFlow).toHaveBeenCalledTimes(1);
    expect(statusSummaryMocks.createRuntimeAutonomy).toHaveBeenCalledWith({
      legacyTaskFlow: { kind: "taskflow-runtime" },
    });
    expect(statusSummaryMocks.bindAutonomySession).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
    });
    expect(statusSummaryMocks.getFleetHistory).toHaveBeenCalledWith({
      limit: 1,
      source: "supervisor",
    });
  });
});
