import { describe, expect, it, vi } from "vitest";
import { createEmptyAgentGovernanceRuntimeContract } from "../../../../src/governance/runtime-contract.js";
import { GatewayRequestError } from "../gateway.ts";
import type { AutonomyAgentProfile, AutonomyLoopJobSnapshot, TaskFlowDetail } from "../types.ts";
import {
  buildAutonomyRequestKey,
  cancelAutonomyFlow,
  formatAutonomyWorkspaceDirsDraft,
  healAutonomyFleet,
  loadAutonomyCapabilityInventory,
  loadAutonomyGenesisPlan,
  loadAutonomyHistory,
  loadAutonomyOverview,
  loadAutonomyProfile,
  parseAutonomyHistoryLimitDraft,
  parseAutonomyWorkspaceDirsDraft,
  reconcileAutonomyGovernanceProposals,
  reconcileAutonomyLoops,
  removeAutonomyLoop,
  resolveAutonomySessionKey,
  submitAutonomySandboxReplay,
  superviseAutonomyFleet,
  synthesizeAutonomyGovernanceProposals,
  startAutonomyFlow,
  upsertAutonomyLoop,
  type AutonomyState,
} from "./autonomy.ts";

function createGovernanceProposalResult() {
  return {
    observedAt: 5,
    charterDir: "/tmp/governance/charter",
    requestedAgentIds: ["founder"],
    eligibleAgentIds: ["founder"],
    findingIds: ["governance.charter.constitution_missing"],
    results: [
      {
        ruleId: "constitution-bootstrap",
        findingIds: ["governance.charter.constitution_missing"],
        title: "Bootstrap charter constitution",
        status: "created" as const,
        rationale: "Recover missing constitution artifact",
        operations: [
          {
            kind: "write" as const,
            path: "governance/charter/constitution.yaml",
            content: "version: 1",
          },
        ],
        dedupeKey: "constitution-bootstrap:write",
        proposalId: "proposal-1",
        proposalStatus: "pending" as const,
      },
    ],
    createdCount: 1,
    existingCount: 0,
    skippedCount: 0,
  };
}

function createGovernanceReconcileResult() {
  return {
    observedAt: 6,
    charterDir: "/tmp/governance/charter",
    requestedAgentIds: ["founder"],
    eligibleAgentIds: ["founder"],
    findingIds: ["governance.charter.constitution_missing"],
    mode: "apply_safe" as const,
    synthesized: createGovernanceProposalResult(),
    entries: [
      {
        ruleId: "constitution-bootstrap",
        title: "Bootstrap charter constitution",
        findingIds: ["governance.charter.constitution_missing"],
        operations: [
          {
            kind: "write" as const,
            path: "governance/charter/constitution.yaml",
            content: "version: 1",
          },
        ],
        synthesisStatus: "created" as const,
        proposalId: "proposal-1",
        proposalStatusBefore: "pending" as const,
        proposalStatusAfter: "applied" as const,
        safe: true,
        autoApproved: true,
        autoApplied: true,
      },
    ],
    reviewedCount: 1,
    appliedCount: 1,
    skippedCount: 0,
  };
}

function createAutonomySupervisePayload() {
  return {
    observedAt: 7,
    governanceMode: "apply_safe" as const,
    overviewBefore: {
      entries: [],
      totals: {
        totalProfiles: 3,
        healthy: 1,
        idle: 1,
        drift: 1,
        missingLoop: 1,
        activeFlows: 1,
      },
    },
    healed: {
      entries: [],
      totals: {
        totalProfiles: 3,
        changed: 2,
        unchanged: 1,
        loopCreated: 1,
        loopUpdated: 0,
        flowStarted: 1,
        flowRestarted: 1,
      },
      governanceProposals: createGovernanceProposalResult(),
    },
    governanceReconciled: createGovernanceReconcileResult(),
    capabilityInventory: {
      observedAt: 8,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/workspace"],
      requestedAgentIds: ["founder"],
      summary: {
        totalEntries: 3,
        skillCount: 1,
        skillReady: 1,
        skillAttention: 0,
        skillBlocked: 0,
        pluginCount: 0,
        pluginActivated: 0,
        pluginAttention: 0,
        pluginBlocked: 0,
        agentBlueprintCount: 1,
        teamBlueprintCount: 1,
        autonomyProfileCount: 1,
        genesisMemberCount: 4,
        gapCount: 1,
        criticalGapCount: 1,
        warningGapCount: 0,
        infoGapCount: 0,
      },
      entries: [],
      gaps: [
        {
          id: "capability_inventory.demo_gap",
          severity: "critical" as const,
          title: "Demo gap",
          detail: "Governed capability coverage is incomplete.",
          relatedEntryIds: [],
          suggestedActions: ["bootstrap governed asset"],
        },
      ],
    },
    genesisPlan: {
      observedAt: 9,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/workspace"],
      primaryWorkspaceDir: "/tmp/workspace",
      requestedAgentIds: ["founder"],
      teamId: "genesis_team",
      teamTitle: "Genesis Team",
      mode: "repair" as const,
      blockers: ["missing genesis role: qa"],
      focusGapIds: ["capability_inventory.demo_gap"],
      stages: [
        {
          id: "genesis.qa",
          title: "Genesis QA",
          ownerAgentId: "qa",
          status: "blocked" as const,
          goal: "Validate governed capability repairs.",
          dependsOn: [],
          inputRefs: [],
          outputRefs: [],
          actions: ["assign qa role"],
        },
      ],
    },
    overviewAfter: {
      entries: [],
      totals: {
        totalProfiles: 3,
        healthy: 3,
        idle: 0,
        drift: 0,
        missingLoop: 0,
        activeFlows: 3,
      },
    },
    summary: {
      totalProfiles: 3,
      changedProfiles: 2,
      healthyProfiles: 3,
      driftProfiles: 0,
      missingLoopProfiles: 0,
      activeFlows: 3,
      governanceCreatedCount: 1,
      governanceAppliedCount: 1,
      governancePendingCount: 0,
      capabilityGapCount: 1,
      criticalCapabilityGapCount: 1,
      genesisStageCount: 1,
      genesisBlockedStageCount: 1,
      recommendedNextActions: ["assign genesis qa"],
    },
  };
}

function createAutonomyProfile(agentId = "founder"): AutonomyAgentProfile {
  return {
    id: agentId,
    collaborators: [],
    reportsTo: [],
    mutationAllow: [],
    mutationDeny: [],
    networkConditions: [],
    runtimeHooks: [],
    contract: createEmptyAgentGovernanceRuntimeContract(agentId),
    bootstrap: {
      controllerId: `runtime.autonomy/${agentId}`,
      defaultGoal: "goal",
      defaultCurrentStep: "step",
      recommendedGoals: ["goal"],
      seedTask: {
        runtime: "cli",
        label: "seed",
        task: "task",
        status: "queued",
      },
      loop: {
        mode: "managed-flow",
        name: "Autonomy Loop: Founder",
        description: "Governed loop",
        schedule: { kind: "every", everyMs: 3_600_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        message: "Run the loop",
      },
    },
  };
}

function createTaskSummary(): TaskFlowDetail["taskSummary"] {
  return {
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
  };
}

function createAutonomyFlow(
  overrides: Partial<TaskFlowDetail> = {},
): TaskFlowDetail {
  return {
    id: "flow-1",
    ownerKey: "agent:founder:thread-1",
    status: "running",
    notifyPolicy: "state_changes",
    goal: "goal",
    createdAt: 1,
    updatedAt: 2,
    tasks: [],
    taskSummary: createTaskSummary(),
    ...overrides,
  };
}

function createLoopJob(
  overrides: Partial<AutonomyLoopJobSnapshot["job"]> = {},
): AutonomyLoopJobSnapshot {
  return {
    agentId: "founder",
    mode: "managed-flow",
    job: {
      id: "job-1",
      agentId: "founder",
      sessionKey: "agent:founder:main",
      name: "Autonomy Loop: Founder",
      enabled: true,
      createdAtMs: 1,
      updatedAtMs: 2,
      schedule: { kind: "every", everyMs: 3_600_000 },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message: "[[autonomy-loop:founder]] Run the loop",
      },
      state: {
        nextRunAtMs: 3,
      },
      ...overrides,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createState(): { state: AutonomyState; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const state: AutonomyState = {
    client: {
      request,
    } as never,
    connected: true,
    autonomyLoading: false,
    autonomyLoadingKey: null,
    autonomyResultKey: null,
    autonomyError: null,
    autonomyResult: null,
    autonomyOverviewLoading: false,
    autonomyOverviewLoadingKey: null,
    autonomyOverviewError: null,
    autonomyOverviewResult: null,
    autonomyCapabilitiesLoading: false,
    autonomyCapabilitiesLoadingKey: null,
    autonomyCapabilitiesError: null,
    autonomyCapabilitiesResult: null,
    autonomyGenesisLoading: false,
    autonomyGenesisLoadingKey: null,
    autonomyGenesisError: null,
    autonomyGenesisResult: null,
    autonomyHistoryLoading: false,
    autonomyHistoryLoadingKey: null,
    autonomyHistoryError: null,
    autonomyHistoryResult: null,
    autonomyStartBusy: false,
    autonomyStartBusyKey: null,
    autonomyStartError: null,
    autonomyStartResult: null,
    autonomyReplayBusy: false,
    autonomyReplayBusyKey: null,
    autonomyReplayError: null,
    autonomyReplayResult: null,
    autonomyCancelBusy: false,
    autonomyCancelBusyKey: null,
    autonomyCancelError: null,
    autonomyCancelResult: null,
    autonomyLoopBusy: false,
    autonomyLoopBusyKey: null,
    autonomyLoopError: null,
    autonomyLoopResult: null,
    autonomyHealBusy: false,
    autonomyHealError: null,
    autonomySuperviseBusy: false,
    autonomySuperviseError: null,
    autonomySuperviseResult: null,
    autonomyGovernanceBusy: false,
    autonomyGovernanceError: null,
    autonomyGovernanceResult: null,
    autonomyGovernanceReconcileBusy: false,
    autonomyGovernanceReconcileError: null,
    autonomyGovernanceReconcileResult: null,
    autonomyReconcileBusy: false,
    autonomyReconcileError: null,
    agentsSelectedId: "founder",
    agentsPanel: "autonomy",
    sessionKey: "agent:founder:thread-1",
  };
  return { state, request };
}

describe("autonomy controller", () => {
  it("parses and formats workspace scope drafts deterministically", () => {
    expect(
      parseAutonomyWorkspaceDirsDraft(" /tmp/beta \n/tmp/alpha,/tmp/beta\r\n/tmp/gamma "),
    ).toEqual(["/tmp/alpha", "/tmp/beta", "/tmp/gamma"]);
    expect(
      formatAutonomyWorkspaceDirsDraft(["/tmp/beta", " /tmp/alpha ", "/tmp/beta"]),
    ).toBe("/tmp/alpha\n/tmp/beta");
    expect(parseAutonomyHistoryLimitDraft(" 25 ")).toBe(25);
    expect(parseAutonomyHistoryLimitDraft("0")).toBeUndefined();
    expect(parseAutonomyHistoryLimitDraft("abc")).toBeUndefined();
  });

  it("reuses the active session when it matches the selected agent", () => {
    expect(
      resolveAutonomySessionKey({
        agentId: "founder",
        sessionKey: "agent:founder:thread-1",
      }),
    ).toBe("agent:founder:thread-1");
    expect(
      resolveAutonomySessionKey({
        agentId: "founder",
        sessionKey: "agent:strategist:thread-2",
      }),
    ).toBe("agent:founder:main");
  });

  it("loads the autonomy profile and stores the latest flow snapshot", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      profile: {
        id: "founder",
        collaborators: [],
        reportsTo: [],
        mutationAllow: [],
        mutationDeny: [],
        networkConditions: [],
        runtimeHooks: [],
        contract: { agentId: "founder" },
        bootstrap: {
          controllerId: "runtime.autonomy/founder",
          defaultGoal: "goal",
          defaultCurrentStep: "step",
          recommendedGoals: ["goal"],
          seedTask: {
            runtime: "cli",
            label: "seed",
            task: "task",
            status: "queued",
          },
          loop: {
            mode: "managed-flow",
            name: "Autonomy Loop: Founder",
            description: "Governed loop",
            schedule: { kind: "every", everyMs: 3_600_000 },
            sessionTarget: "isolated",
            wakeMode: "now",
            message: "Run the loop",
          },
        },
      },
      latestFlow: {
        id: "flow-1",
        ownerKey: "agent:founder:thread-1",
        status: "running",
        notifyPolicy: "state_changes",
        goal: "goal",
        createdAt: 1,
        updatedAt: 2,
        tasks: [],
        taskSummary: {
          total: 0,
          active: 0,
          terminal: 0,
          failures: 0,
          byStatus: {
            queued: 0,
            running: 0,
            succeeded: 0,
            failed: 0,
            cancelled: 0,
            lost: 0,
          },
          byRuntime: {
            subagent: 0,
            acp: 0,
            cli: 0,
            cron: 0,
          },
        },
      },
    });

    await loadAutonomyProfile(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });

    expect(request).toHaveBeenCalledWith("autonomy.show", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });
    expect(state.autonomyResult?.latestFlow?.id).toBe("flow-1");
    expect(state.autonomyResultKey).toBe(
      buildAutonomyRequestKey({
        agentId: "founder",
        sessionKey: "agent:founder:thread-1",
      }),
    );
  });

  it("loads fleet-wide autonomy overview state", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      overview: {
        entries: [
          {
            agentId: "founder",
            profile: { id: "founder", collaborators: [], reportsTo: [], mutationAllow: [], mutationDeny: [], networkConditions: [], runtimeHooks: [], contract: { agentId: "founder" }, bootstrap: { controllerId: "runtime.autonomy/founder", defaultGoal: "goal", defaultCurrentStep: "step", recommendedGoals: ["goal"], seedTask: { runtime: "cli", label: "seed", task: "task", status: "queued" }, loop: { mode: "managed-flow", name: "Autonomy Loop: Founder", description: "Governed loop", schedule: { kind: "every", everyMs: 3_600_000 }, sessionTarget: "isolated", wakeMode: "now", message: "Run the loop" } } },
            duplicateLoopCount: 0,
            expectedLoopEveryMs: 3_600_000,
            actualLoopEveryMs: 3_600_000,
            loopCadenceAligned: true,
            hasActiveFlow: false,
            driftReasons: ["no managed flow recorded yet"],
            suggestedAction: "start_flow",
            health: "idle",
          },
        ],
        totals: {
          totalProfiles: 1,
          healthy: 0,
          idle: 1,
          drift: 0,
          missingLoop: 0,
          activeFlows: 0,
        },
      },
    });

    await loadAutonomyOverview(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });

    expect(request).toHaveBeenCalledWith("autonomy.overview", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(state.autonomyOverviewResult?.overview.totals.idle).toBe(1);
  });

  it("loads capability inventory state", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      capabilities: {
        observedAt: 1,
        charterDir: "/tmp/governance/charter",
        workspaceDirs: ["/tmp/workspace"],
        requestedAgentIds: ["founder"],
        summary: {
          totalEntries: 2,
          skillCount: 0,
          skillReady: 0,
          skillAttention: 0,
          skillBlocked: 0,
          pluginCount: 0,
          pluginActivated: 0,
          pluginAttention: 0,
          pluginBlocked: 0,
          agentBlueprintCount: 1,
          teamBlueprintCount: 1,
          autonomyProfileCount: 1,
          genesisMemberCount: 6,
          gapCount: 1,
          criticalGapCount: 0,
          warningGapCount: 1,
          infoGapCount: 0,
        },
        entries: [],
        gaps: [
          {
            id: "capability_inventory.skills_missing",
            severity: "warning",
            title: "No governed skill assets were discovered",
            detail: "Skill library is empty.",
            relatedEntryIds: [],
            suggestedActions: ["register first skill"],
          },
        ],
      },
    });

    await loadAutonomyCapabilityInventory(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });

    expect(request).toHaveBeenCalledWith("autonomy.capability.inventory", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(state.autonomyCapabilitiesResult?.capabilities.summary.gapCount).toBe(1);
  });

  it("keeps the latest capability inventory response when requests overlap", async () => {
    const { state, request } = createState();
    const first = createDeferred<{
      sessionKey: string;
      capabilities: { summary: { gapCount: number } };
    }>();
    const second = createDeferred<{
      sessionKey: string;
      capabilities: { summary: { gapCount: number } };
    }>();
    request.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);

    const firstLoad = loadAutonomyCapabilityInventory(state, {
      sessionKey: "agent:founder:thread-1",
    });
    const secondLoad = loadAutonomyCapabilityInventory(state, {
      sessionKey: "agent:founder:thread-2",
    });

    second.resolve({
      sessionKey: "agent:founder:thread-2",
      capabilities: {
        summary: {
          gapCount: 2,
        },
      } as never,
    });
    await secondLoad;
    first.resolve({
      sessionKey: "agent:founder:thread-1",
      capabilities: {
        summary: {
          gapCount: 1,
        },
      } as never,
    });
    await firstLoad;

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.capability.inventory", {
      sessionKey: "agent:founder:thread-1",
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.capability.inventory", {
      sessionKey: "agent:founder:thread-2",
    });
    expect(state.autonomyCapabilitiesResult?.sessionKey).toBe("agent:founder:thread-2");
    expect(state.autonomyCapabilitiesResult?.capabilities.summary.gapCount).toBe(2);
    expect(state.autonomyCapabilitiesLoading).toBe(false);
    expect(state.autonomyCapabilitiesLoadingKey).toBeNull();
  });

  it("loads genesis plan state", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      genesisPlan: {
        observedAt: 1,
        charterDir: "/tmp/governance/charter",
        workspaceDirs: ["/tmp/workspace"],
        primaryWorkspaceDir: "/tmp/workspace",
        requestedAgentIds: ["founder"],
        teamId: "genesis_team",
        teamTitle: "Genesis Team",
        mode: "repair",
        blockers: ["missing genesis roles: publisher"],
        focusGapIds: ["capability_inventory.genesis_roles_missing"],
        stages: [
          {
            id: "genesis.gap_detection",
            title: "Sentinel Detection",
            ownerAgentId: "sentinel",
            status: "ready",
            goal: "Rank governed capability gaps.",
            dependsOn: [],
            inputRefs: ["capability_inventory.genesis_roles_missing"],
            outputRefs: ["gap_signal"],
            actions: ["detect missing roles"],
          },
        ],
      },
    });

    await loadAutonomyGenesisPlan(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });

    expect(request).toHaveBeenCalledWith("autonomy.genesis.plan", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(state.autonomyGenesisResult?.genesisPlan.mode).toBe("repair");
    expect(state.autonomyGenesisResult?.genesisPlan.workspaceDirs).toEqual(["/tmp/workspace"]);
  });

  it("keeps the latest genesis plan response when requests overlap", async () => {
    const { state, request } = createState();
    const first = createDeferred<{
      sessionKey: string;
      genesisPlan: { mode: "repair" | "build"; focusGapIds: string[] };
    }>();
    const second = createDeferred<{
      sessionKey: string;
      genesisPlan: { mode: "repair" | "build"; focusGapIds: string[] };
    }>();
    request.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);

    const firstLoad = loadAutonomyGenesisPlan(state, {
      sessionKey: "agent:founder:thread-1",
    });
    const secondLoad = loadAutonomyGenesisPlan(state, {
      sessionKey: "agent:founder:thread-2",
      teamId: "genesis_team",
    });

    second.resolve({
      sessionKey: "agent:founder:thread-2",
      genesisPlan: {
        mode: "build",
        focusGapIds: ["gap-2"],
      } as never,
    });
    await secondLoad;
    first.resolve({
      sessionKey: "agent:founder:thread-1",
      genesisPlan: {
        mode: "repair",
        focusGapIds: ["gap-1"],
      } as never,
    });
    await firstLoad;

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.genesis.plan", {
      sessionKey: "agent:founder:thread-1",
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.genesis.plan", {
      sessionKey: "agent:founder:thread-2",
      teamId: "genesis_team",
    });
    expect(state.autonomyGenesisResult?.sessionKey).toBe("agent:founder:thread-2");
    expect(state.autonomyGenesisResult?.genesisPlan.mode).toBe("build");
    expect(state.autonomyGenesisLoading).toBe(false);
    expect(state.autonomyGenesisLoadingKey).toBeNull();
  });

  it("loads persistent autonomy history state", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      history: {
        events: [
          {
            eventId: "history-1",
            ts: 1,
            sessionKey: "agent:main:main",
            mode: "heal",
            source: "manual",
            agentIds: ["founder"],
            workspaceDirs: ["/tmp/workspace"],
            primaryWorkspaceDir: "/tmp/workspace",
            changed: true,
            totals: {
              totalProfiles: 1,
              changed: 1,
              unchanged: 0,
              loopCreated: 0,
              loopUpdated: 0,
              flowStarted: 1,
              flowRestarted: 0,
            },
            entries: [
              {
                agentId: "founder",
                changed: true,
                loopAction: "none",
                flowAction: "started",
                workspaceDirs: ["/tmp/workspace"],
                primaryWorkspaceDir: "/tmp/workspace",
                reasons: ["latest managed flow is cancelled"],
              },
            ],
          },
        ],
        total: 1,
        truncated: false,
      },
    });

    await loadAutonomyHistory(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      limit: 5,
      mode: "heal",
      source: "manual",
    });

    expect(request).toHaveBeenCalledWith("autonomy.history", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      limit: 5,
      mode: "heal",
      source: "manual",
    });
    expect(state.autonomyHistoryResult?.history.total).toBe(1);
    expect(state.autonomyHistoryResult?.history.events[0]?.primaryWorkspaceDir).toBe(
      "/tmp/workspace",
    );
  });

  it("formats missing operator.read errors for the autonomy panel", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(
      new GatewayRequestError({
        code: "UNAVAILABLE",
        message: "missing scope: operator.read",
      }),
    );

    await loadAutonomyProfile(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });

    expect(state.autonomyError).toBe(
      "This connection is missing operator.read, so autonomy profile cannot be loaded yet.",
    );
  });

  it("formats missing operator.control errors for autonomy control actions", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(
      new GatewayRequestError({
        code: "UNAVAILABLE",
        message: "missing scope: operator.control",
      }),
    );

    await startAutonomyFlow(state, {
      agentId: "founder",
      sessionKey: "agent:founder:main",
      goal: "Repair autonomy fleet drift.",
    });

    expect(state.autonomyStartError).toBe(
      "This connection is missing operator.control, so autonomy control cannot be changed yet.",
    );
  });

  it("synthesizes governance proposals and stores the latest synthesis result", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      governance: createGovernanceProposalResult(),
    });

    await synthesizeAutonomyGovernanceProposals(state, {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
    });

    expect(request).toHaveBeenCalledWith("autonomy.governance.proposals", {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(state.autonomyGovernanceResult?.createdCount).toBe(1);
    expect(state.autonomyGovernanceResult?.results[0]?.proposalId).toBe("proposal-1");
    expect(state.autonomyGovernanceError).toBeNull();
  });

  it("reconciles governance proposals and refreshes overview, history, and profile", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        governanceReconciled: createGovernanceReconcileResult(),
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        overview: {
          entries: [],
          totals: {
            totalProfiles: 1,
            healthy: 1,
            idle: 0,
            drift: 0,
            missingLoop: 0,
            activeFlows: 0,
          },
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        history: {
          events: [],
          total: 0,
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        profile: createAutonomyProfile(),
        latestFlow: createAutonomyFlow(),
      });

    await reconcileAutonomyGovernanceProposals(state, {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
      mode: "apply_safe",
      decisionNote: "safe reconcile",
      historyLimit: 10,
      historyMode: "reconcile",
      historySource: "manual",
    });

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.governance.reconcile", {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
      mode: "apply_safe",
      decisionNote: "safe reconcile",
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.overview", {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(request).toHaveBeenNthCalledWith(3, "autonomy.history", {
      sessionKey: "agent:founder:thread-1",
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace"],
      limit: 10,
      mode: "reconcile",
      source: "manual",
    });
    expect(request).toHaveBeenNthCalledWith(4, "autonomy.show", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });
    expect(state.autonomyGovernanceReconcileResult?.appliedCount).toBe(1);
    expect(state.autonomyGovernanceReconcileError).toBeNull();
  });

  it("starts an autonomy flow and projects the start result into the panel snapshot", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      started: {
        profile: {
          id: "founder",
          collaborators: [],
          reportsTo: [],
          mutationAllow: [],
          mutationDeny: [],
          networkConditions: [],
          runtimeHooks: [],
          contract: { agentId: "founder" },
          bootstrap: {
            controllerId: "runtime.autonomy/founder",
            defaultGoal: "goal",
            defaultCurrentStep: "step",
            recommendedGoals: ["goal"],
            seedTask: {
              runtime: "cli",
              label: "seed",
              task: "task",
              status: "queued",
            },
            loop: {
              mode: "managed-flow",
              name: "Autonomy Loop: Founder",
              description: "Governed loop",
              schedule: { kind: "every", everyMs: 3_600_000 },
              sessionTarget: "isolated",
              wakeMode: "now",
              message: "Run the loop",
            },
          },
        },
        flow: {
          id: "flow-2",
          ownerKey: "agent:founder:thread-1",
          status: "running",
          notifyPolicy: "state_changes",
          goal: "goal",
          createdAt: 1,
          updatedAt: 3,
          tasks: [],
          taskSummary: {
            total: 0,
            active: 0,
            terminal: 0,
            failures: 0,
            byStatus: {
              queued: 0,
              running: 0,
              succeeded: 0,
              failed: 0,
              cancelled: 0,
              lost: 0,
            },
            byRuntime: {
              subagent: 0,
              acp: 0,
              cli: 0,
              cron: 0,
            },
          },
        },
        seedTask: {
          id: "task-1",
          runtime: "cli",
          sessionKey: "agent:founder:thread-1",
          ownerKey: "agent:founder:thread-1",
          scope: "session",
          title: "task",
          status: "queued",
          deliveryStatus: "not_requested",
          notifyPolicy: "done_only",
          createdAt: 1,
        },
      },
    });

    await startAutonomyFlow(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      goal: "goal",
      workspaceDirs: ["/tmp/workspace"],
      seedTaskEnabled: true,
    });

    expect(request).toHaveBeenCalledWith("autonomy.start", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      goal: "goal",
      workspaceDirs: ["/tmp/workspace"],
      seedTaskEnabled: true,
    });
    expect(state.autonomyResult?.latestFlow?.id).toBe("flow-2");
    expect(state.autonomyResult?.latestSeedTask?.id).toBe("task-1");
  });

  it("submits sandbox replay verdicts and stores the updated autonomy snapshot", async () => {
    const { state, request } = createState();
    const profile = createAutonomyProfile();
    state.agentsPanel = "overview";
    state.autonomyResult = {
      sessionKey: "agent:founder:thread-1",
      profile,
      latestFlow: createAutonomyFlow({
        id: "flow-3",
        ownerKey: "agent:founder:thread-1",
      }),
    };
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      submitted: {
        profile,
        requestedFlowId: "flow-3",
        targetFlowId: "flow-3",
        outcome: {
          found: true,
          applied: true,
          flow: createAutonomyFlow({
            id: "flow-3",
            ownerKey: "agent:founder:thread-1",
            updatedAt: 5,
          }),
        },
      },
    });

    await submitAutonomySandboxReplay(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      flowId: "flow-3",
      replayPassed: true,
      qaPassed: true,
      auditPassed: true,
    });

    expect(request).toHaveBeenCalledWith("autonomy.replay.submit", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      flowId: "flow-3",
      replayPassed: true,
      qaPassed: true,
      auditPassed: true,
    });
    expect(state.autonomyReplayResult?.submitted.outcome.applied).toBe(true);
    expect(state.autonomyResult?.latestFlow?.updatedAt).toBe(5);
    expect(state.autonomyReplayError).toBeNull();
  });

  it("cancels the latest autonomy flow and projects the updated flow snapshot", async () => {
    const { state, request } = createState();
    const profile = createAutonomyProfile();
    state.autonomyResult = {
      sessionKey: "agent:founder:thread-1",
      profile,
      latestFlow: createAutonomyFlow({
        id: "flow-9",
        ownerKey: "agent:founder:thread-1",
      }),
    };
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      cancelled: {
        profile,
        requestedFlowId: "flow-9",
        targetFlowId: "flow-9",
        outcome: {
          found: true,
          cancelled: true,
          flow: {
            id: "flow-9",
            ownerKey: "agent:founder:thread-1",
            status: "cancelled",
            notifyPolicy: "state_changes",
            goal: "goal",
            createdAt: 1,
            updatedAt: 4,
            endedAt: 4,
            tasks: [],
            taskSummary: {
              total: 0,
              active: 0,
              terminal: 0,
              failures: 0,
              byStatus: {
                queued: 0,
                running: 0,
                succeeded: 0,
                failed: 0,
                cancelled: 0,
                lost: 0,
              },
              byRuntime: {
                subagent: 0,
                acp: 0,
                cli: 0,
                cron: 0,
              },
            },
          },
        },
      },
    });

    await cancelAutonomyFlow(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      flowId: "flow-9",
    });

    expect(request).toHaveBeenCalledWith("autonomy.cancel", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      flowId: "flow-9",
    });
    expect(state.autonomyResult?.latestFlow?.status).toBe("cancelled");
    expect(state.autonomyCancelError).toBeNull();
  });

  it("upserts the autonomy loop and projects the loop snapshot into the panel state", async () => {
    const { state, request } = createState();
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      upserted: {
        profile: {
          id: "founder",
          collaborators: [],
          reportsTo: [],
          mutationAllow: [],
          mutationDeny: [],
          networkConditions: [],
          runtimeHooks: [],
          contract: { agentId: "founder" },
          bootstrap: {
            controllerId: "runtime.autonomy/founder",
            defaultGoal: "goal",
            defaultCurrentStep: "step",
            recommendedGoals: ["goal"],
            seedTask: {
              runtime: "cli",
              label: "seed",
              task: "task",
              status: "queued",
            },
            loop: {
              mode: "managed-flow",
              name: "Autonomy Loop: Founder",
              description: "Governed loop",
              schedule: { kind: "every", everyMs: 3_600_000 },
              sessionTarget: "isolated",
              wakeMode: "now",
              message: "Run the loop",
            },
          },
        },
        created: true,
        updated: false,
        loop: {
          agentId: "founder",
          mode: "managed-flow",
          workspaceDirs: ["/tmp/workspace"],
          primaryWorkspaceDir: "/tmp/workspace",
          job: {
            id: "job-1",
            agentId: "founder",
            sessionKey: "agent:founder:main",
            name: "Autonomy Loop: Founder",
            enabled: true,
            createdAtMs: 1,
            updatedAtMs: 2,
            schedule: { kind: "every", everyMs: 3_600_000 },
            sessionTarget: "isolated",
            wakeMode: "now",
            payload: {
              kind: "agentTurn",
              message: "[[autonomy-loop:founder]] Run the loop",
            },
            state: {
              nextRunAtMs: 3,
            },
          },
        },
      },
    });

    await upsertAutonomyLoop(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      everyMs: 3_600_000,
      workspaceDirs: ["/tmp/workspace"],
    });

    expect(request).toHaveBeenCalledWith("autonomy.loop.upsert", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      everyMs: 3_600_000,
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(state.autonomyResult?.loopJob?.job.id).toBe("job-1");
    expect(state.autonomyResult?.loopJob?.primaryWorkspaceDir).toBe("/tmp/workspace");
    expect(state.autonomyLoopError).toBeNull();
  });

  it("reconciles autonomy loops and refreshes overview plus selected profile", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        reconciled: {
          createdCount: 1,
          updatedCount: 0,
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        overview: {
          entries: [],
          totals: {
            totalProfiles: 3,
            healthy: 1,
            idle: 1,
            drift: 0,
            missingLoop: 1,
            activeFlows: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        history: {
          events: [],
          total: 0,
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        profile: {
          id: "founder",
          collaborators: [],
          reportsTo: [],
          mutationAllow: [],
          mutationDeny: [],
          networkConditions: [],
          runtimeHooks: [],
          contract: { agentId: "founder" },
          bootstrap: {
            controllerId: "runtime.autonomy/founder",
            defaultGoal: "goal",
            defaultCurrentStep: "step",
            recommendedGoals: ["goal"],
            seedTask: {
              runtime: "cli",
              label: "seed",
              task: "task",
              status: "queued",
            },
            loop: {
              mode: "managed-flow",
              name: "Autonomy Loop: Founder",
              description: "Governed loop",
              schedule: { kind: "every", everyMs: 3_600_000 },
              sessionTarget: "isolated",
              wakeMode: "now",
              message: "Run the loop",
            },
          },
        },
      });

    await reconcileAutonomyLoops(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      historyLimit: 10,
      historyMode: "reconcile",
      historySource: "supervisor",
    });

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.loop.reconcile", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.overview", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(request).toHaveBeenNthCalledWith(3, "autonomy.history", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      limit: 10,
      mode: "reconcile",
      source: "supervisor",
    });
    expect(request).toHaveBeenNthCalledWith(4, "autonomy.show", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });
    expect(state.autonomyOverviewResult?.overview.totals.totalProfiles).toBe(3);
    expect(state.autonomyReconcileError).toBeNull();
  });

  it("heals autonomy fleet and refreshes overview plus selected profile", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        healed: {
          entries: [],
          totals: {
            totalProfiles: 3,
            changed: 2,
            unchanged: 1,
            loopCreated: 1,
            loopUpdated: 0,
            flowStarted: 2,
            flowRestarted: 0,
          },
          governanceProposals: createGovernanceProposalResult(),
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        overview: {
          entries: [],
          totals: {
            totalProfiles: 3,
            healthy: 3,
            idle: 0,
            drift: 0,
            missingLoop: 0,
            activeFlows: 3,
          },
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        history: {
          events: [],
          total: 0,
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        profile: {
          id: "founder",
          collaborators: [],
          reportsTo: [],
          mutationAllow: [],
          mutationDeny: [],
          networkConditions: [],
          runtimeHooks: [],
          contract: { agentId: "founder" },
          bootstrap: {
            controllerId: "runtime.autonomy/founder",
            defaultGoal: "goal",
            defaultCurrentStep: "step",
            recommendedGoals: ["goal"],
            seedTask: {
              runtime: "cli",
              label: "seed",
              task: "task",
              status: "queued",
            },
            loop: {
              mode: "managed-flow",
              name: "Autonomy Loop: Founder",
              description: "Governed loop",
              schedule: { kind: "every", everyMs: 3_600_000 },
              sessionTarget: "isolated",
              wakeMode: "now",
              message: "Run the loop",
            },
          },
        },
      });

    await healAutonomyFleet(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      historyLimit: 8,
      historyMode: "heal",
      historySource: "manual",
    });

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.heal", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.overview", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
    });
    expect(request).toHaveBeenNthCalledWith(3, "autonomy.history", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      limit: 8,
      mode: "heal",
      source: "manual",
    });
    expect(request).toHaveBeenNthCalledWith(4, "autonomy.show", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });
    expect(state.autonomyOverviewResult?.overview.totals.healthy).toBe(3);
    expect(state.autonomyGovernanceResult?.createdCount).toBe(1);
    expect(state.autonomyHealError).toBeNull();
  });

  it("supervises autonomy fleet and projects the composite result into the panel state", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        supervised: createAutonomySupervisePayload(),
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        history: {
          events: [],
          total: 0,
          truncated: false,
        },
      })
      .mockResolvedValueOnce({
        sessionKey: "agent:founder:thread-1",
        profile: createAutonomyProfile(),
        latestFlow: createAutonomyFlow(),
      });

    await superviseAutonomyFleet(state, {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      governanceMode: "apply_safe",
      decisionNote: "apply safe governance repairs",
      restartBlockedFlows: true,
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
      historyLimit: 12,
      historyMode: "heal",
      historySource: "supervisor",
    });

    expect(request).toHaveBeenNthCalledWith(1, "autonomy.supervise", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      governanceMode: "apply_safe",
      decisionNote: "apply safe governance repairs",
      restartBlockedFlows: true,
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, "autonomy.history", {
      sessionKey: "agent:founder:thread-1",
      workspaceDirs: ["/tmp/workspace"],
      limit: 12,
      mode: "heal",
      source: "supervisor",
    });
    expect(request).toHaveBeenNthCalledWith(3, "autonomy.show", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
    });
    expect(state.autonomySuperviseResult?.supervised.summary.changedProfiles).toBe(2);
    expect(state.autonomyOverviewResult?.overview.totals.healthy).toBe(3);
    expect(state.autonomyCapabilitiesResult?.capabilities.summary.criticalGapCount).toBe(1);
    expect(state.autonomyGenesisResult?.genesisPlan.blockers).toEqual(["missing genesis role: qa"]);
    expect(state.autonomyGovernanceResult?.createdCount).toBe(1);
    expect(state.autonomyGovernanceReconcileResult?.appliedCount).toBe(1);
    expect(state.autonomySuperviseError).toBeNull();
  });

  it("removes the autonomy loop and clears the projected loop snapshot", async () => {
    const { state, request } = createState();
    const profile = createAutonomyProfile();
    state.autonomyResult = {
      sessionKey: "agent:founder:thread-1",
      profile,
      loopJob: createLoopJob() as never,
    };
    request.mockResolvedValue({
      sessionKey: "agent:founder:thread-1",
      removed: {
        profile,
        targetJobId: "job-1",
        removed: true,
        removedJobIds: ["job-1"],
      },
    });

    await removeAutonomyLoop(state, {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      jobId: "job-1",
    });

    expect(request).toHaveBeenCalledWith("autonomy.loop.remove", {
      agentId: "founder",
      sessionKey: "agent:founder:thread-1",
      jobId: "job-1",
    });
    expect(state.autonomyResult?.loopJob).toBeUndefined();
    expect(state.autonomyLoopError).toBeNull();
  });
});
