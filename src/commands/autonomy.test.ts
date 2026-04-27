import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  buildAgentMainSessionKey: vi.fn(({ agentId }: { agentId?: string }) => `agent:${agentId ?? "main"}:main`),
  createRuntimeAutonomy: vi.fn(),
  createRuntimeTaskFlow: vi.fn(() => ({ kind: "taskflow-runtime" })),
  normalizeAgentId: vi.fn((value?: string) => (value ?? "main").trim().toLowerCase()),
  bindSession: vi.fn(),
  getProfile: vi.fn(),
  getLatestManagedFlowSnapshot: vi.fn(),
  getLoopJob: vi.fn(),
  getFleetStatus: vi.fn(),
  getCapabilityInventory: vi.fn(),
  planGenesisWork: vi.fn(),
  getFleetHistory: vi.fn(),
  reconcileGovernanceProposals: vi.fn(),
  superviseFleet: vi.fn(),
  startManagedFlow: vi.fn(),
  submitSandboxReplay: vi.fn(),
}));

vi.mock("../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: mocks.createRuntimeTaskFlow,
}));

vi.mock("../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: mocks.createRuntimeAutonomy,
}));

vi.mock("../routing/session-key.js", () => ({
  buildAgentMainSessionKey: mocks.buildAgentMainSessionKey,
  normalizeAgentId: mocks.normalizeAgentId,
}));

vi.mock("../terminal/theme.js", () => ({
  theme: {
    info: (value: string) => value,
  },
}));

import {
  autonomyCapabilityInventoryCommand,
  autonomyGovernanceReconcileCommand,
  autonomyGenesisPlanCommand,
  autonomyHistoryCommand,
  autonomyOverviewCommand,
  autonomyReplaySubmitCommand,
  autonomyShowCommand,
  autonomySuperviseCommand,
  autonomyStartCommand,
} from "./autonomy.js";

function createRuntime(): { runtime: RuntimeEnv; logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    runtime: {
      log: (value: unknown) => logs.push(String(value)),
      error: (value: unknown) => errors.push(String(value)),
      exit: vi.fn(),
    } as RuntimeEnv,
    logs,
    errors,
  };
}

describe("autonomy commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bindSession.mockReturnValue({
      getProfile: mocks.getProfile,
      getLatestManagedFlowSnapshot: mocks.getLatestManagedFlowSnapshot,
      getLoopJob: mocks.getLoopJob,
      getFleetStatus: mocks.getFleetStatus,
      getCapabilityInventory: mocks.getCapabilityInventory,
      planGenesisWork: mocks.planGenesisWork,
      getFleetHistory: mocks.getFleetHistory,
      reconcileGovernanceProposals: mocks.reconcileGovernanceProposals,
      superviseFleet: mocks.superviseFleet,
      startManagedFlow: mocks.startManagedFlow,
      submitSandboxReplay: mocks.submitSandboxReplay,
    });
    mocks.createRuntimeAutonomy.mockReturnValue({
      bindSession: mocks.bindSession,
    });
  });

  it("normalizes workspace scope for overview queries and prints scoped totals", async () => {
    mocks.getFleetStatus.mockResolvedValue({
      entries: [
        {
          agentId: "founder",
          profile: { id: "founder" },
          workspaceDirs: ["/tmp/a", "/tmp/b"],
          primaryWorkspaceDir: "/tmp/a",
          duplicateLoopCount: 0,
          expectedLoopEveryMs: 3_600_000,
          actualLoopEveryMs: 3_600_000,
          loopCadenceAligned: true,
          hasActiveFlow: true,
          driftReasons: [],
          suggestedAction: "observe",
          health: "healthy",
          latestFlow: { status: "running" },
        },
      ],
      totals: {
        totalProfiles: 1,
        healthy: 1,
        idle: 0,
        drift: 0,
        missingLoop: 0,
        activeFlows: 1,
      },
    });

    const { runtime, logs } = createRuntime();
    await autonomyOverviewCommand(
      {
        agentIds: ["founder"],
        sessionKey: "agent:control:main",
        workspaceDirs: [" /tmp/b ", "/tmp/a", "/tmp/b"],
      },
      runtime,
    );

    expect(mocks.getFleetStatus).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
    expect(logs.join("\n")).toContain("scope=/tmp/a, /tmp/b");
  });

  it("normalizes workspace scope for capability inventory and renders returned scope", async () => {
    mocks.getCapabilityInventory.mockResolvedValue({
      observedAt: 1,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      requestedAgentIds: ["founder"],
      summary: {
        totalEntries: 1,
        skillCount: 1,
        skillReady: 1,
        skillAttention: 0,
        skillBlocked: 0,
        pluginCount: 0,
        pluginActivated: 0,
        pluginAttention: 0,
        pluginBlocked: 0,
        memoryCount: 1,
        memoryReady: 1,
        memoryAttention: 0,
        memoryBlocked: 0,
        strategyCount: 1,
        strategyReady: 0,
        strategyAttention: 1,
        strategyBlocked: 0,
        algorithmCount: 1,
        algorithmReady: 0,
        algorithmAttention: 0,
        algorithmBlocked: 1,
        agentBlueprintCount: 1,
        teamBlueprintCount: 1,
        autonomyProfileCount: 1,
        genesisMemberCount: 1,
        gapCount: 1,
        criticalGapCount: 0,
        warningGapCount: 1,
        infoGapCount: 0,
      },
      entries: [
        {
          id: "skill:demo",
          kind: "skill",
          status: "ready",
          title: "Demo Skill",
          workspaceDir: "/tmp/b",
          coverage: ["inventory"],
          dependencies: [],
          issues: [],
          installOptions: [],
        },
      ],
      gaps: [
        {
          id: "gap-1",
          severity: "warning",
          title: "Need more skills",
          detail: "Gap detail",
          relatedEntryIds: ["skill:demo"],
          suggestedActions: ["add skill"],
        },
      ],
    });

    const { runtime, logs } = createRuntime();
    await autonomyCapabilityInventoryCommand(
      {
        agentIds: ["founder"],
        sessionKey: "agent:control:main",
        workspaceDirs: [" /tmp/b ", "/tmp/a", "/tmp/b"],
      },
      runtime,
    );

    expect(mocks.getCapabilityInventory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
    expect(logs.join("\n")).toContain("Need more skills");
    expect(logs.join("\n")).toContain("memory=1");
    expect(logs.join("\n")).toContain("strategy=1");
    expect(logs.join("\n")).toContain("algorithm=1");
    expect(logs.join("\n")).toContain("algorithmBlocked=1");
  });

  it("renders effective genesis workspace scope from the returned plan", async () => {
    mocks.planGenesisWork.mockResolvedValue({
      observedAt: 1,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/inferred"],
      primaryWorkspaceDir: "/tmp/inferred",
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
    });

    const { runtime, logs } = createRuntime();
    await autonomyGenesisPlanCommand(
      {
        agentIds: ["founder"],
        sessionKey: "agent:control:main",
        teamId: "genesis_team",
      },
      runtime,
    );

    expect(mocks.planGenesisWork).toHaveBeenCalledWith({
      agentIds: ["founder"],
      teamId: "genesis_team",
    });
    expect(logs.join("\n")).toContain("primaryWorkspaceDir: /tmp/inferred");
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/inferred");
  });

  it("runs the autonomy supervisor with normalized scope and prints the combined summary", async () => {
    mocks.superviseFleet.mockResolvedValue({
      observedAt: 1,
      governanceMode: "force_apply_all",
      overviewBefore: {
        entries: [],
        totals: {
          totalProfiles: 2,
          healthy: 0,
          idle: 2,
          drift: 0,
          missingLoop: 0,
          activeFlows: 0,
        },
      },
      healed: {
        entries: [],
        totals: {
          totalProfiles: 2,
          changed: 2,
          unchanged: 0,
          loopCreated: 2,
          loopUpdated: 0,
          flowStarted: 2,
          flowRestarted: 0,
        },
      },
      overviewAfter: {
        entries: [],
        totals: {
          totalProfiles: 2,
          healthy: 2,
          idle: 0,
          drift: 0,
          missingLoop: 0,
          activeFlows: 2,
        },
      },
      summary: {
        totalProfiles: 2,
        changedProfiles: 2,
        healthyProfiles: 2,
        driftProfiles: 0,
        missingLoopProfiles: 0,
        activeFlows: 2,
        governanceCreatedCount: 1,
        governanceAppliedCount: 1,
        governancePendingCount: 0,
        capabilityGapCount: 1,
        criticalCapabilityGapCount: 0,
        genesisStageCount: 2,
        genesisBlockedStageCount: 1,
        recommendedNextActions: ["Execute the genesis plan stages to close the remaining governed capability gaps."],
      },
      capabilityInventory: {
        observedAt: 2,
        charterDir: "/tmp/governance/charter",
        workspaceDirs: ["/tmp/a", "/tmp/b"],
        requestedAgentIds: ["founder", "strategist"],
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
          agentBlueprintCount: 2,
          teamBlueprintCount: 1,
          autonomyProfileCount: 2,
          genesisMemberCount: 0,
          gapCount: 1,
          criticalGapCount: 0,
          warningGapCount: 1,
          infoGapCount: 0,
        },
        entries: [],
        gaps: [],
      },
      genesisPlan: {
        observedAt: 3,
        charterDir: "/tmp/governance/charter",
        workspaceDirs: ["/tmp/a", "/tmp/b"],
        primaryWorkspaceDir: "/tmp/a",
        requestedAgentIds: ["founder", "strategist"],
        teamId: "genesis_team",
        teamTitle: "Genesis Team",
        mode: "repair",
        blockers: [],
        focusGapIds: ["gap-1"],
        stages: [],
      },
      governanceReconciled: {
        observedAt: 4,
        charterDir: "/tmp/governance/charter",
        requestedAgentIds: ["founder", "strategist"],
        eligibleAgentIds: ["founder", "strategist"],
        findingIds: ["gap-1"],
        mode: "force_apply_all",
        synthesized: {
          observedAt: 4,
          charterDir: "/tmp/governance/charter",
          requestedAgentIds: ["founder", "strategist"],
          eligibleAgentIds: ["founder", "strategist"],
          findingIds: ["gap-1"],
          results: [],
          createdCount: 1,
          existingCount: 0,
          skippedCount: 0,
        },
        entries: [],
        reviewedCount: 1,
        appliedCount: 1,
        skippedCount: 0,
      },
    });

    const { runtime, logs } = createRuntime();
    await autonomySuperviseCommand(
      {
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        workspaceDirs: [" /tmp/b ", "/tmp/a", "/tmp/b"],
        teamId: "genesis_team",
        governanceMode: "force_apply_all",
        decisionNote: "Escalate the supervisor pass.",
        restartBlockedFlows: false,
        includeCapabilityInventory: true,
        includeGenesisPlan: true,
        recordHistory: false,
      },
      runtime,
    );

    expect(mocks.superviseFleet).toHaveBeenCalledWith({
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      teamId: "genesis_team",
      governanceMode: "force_apply_all",
      decisionNote: "Escalate the supervisor pass.",
      restartBlockedFlows: false,
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
    expect(logs.join("\n")).toContain("governanceMode: force_apply_all");
    expect(logs.join("\n")).toContain("profiles: changed=2/2 healthy=2 drift=0 missingLoop=0 activeFlows=2");
    expect(logs.join("\n")).toContain("governance: created=1 applied=1 pending=0");
    expect(logs.join("\n")).toContain("nextActions:");
  });

  it("renders managed execution and sandbox projections in autonomy show output", async () => {
    mocks.getProfile.mockReturnValue({
      id: "executor",
      name: "Executor",
      layer: "execution",
      missionPrimary: "Execute governed work.",
      authorityLevel: "governed",
      collaborators: ["founder", "librarian"],
      reportsTo: ["founder"],
      runtimeHooks: ["taskflow"],
      bootstrap: {
        controllerId: "runtime.autonomy/executor",
        defaultGoal: "Deliver governed outcomes.",
        defaultCurrentStep: "goal_intake",
        loop: {
          name: "Executor Loop",
          schedule: { everyMs: 3_600_000 },
        },
      },
    });
    mocks.getLatestManagedFlowSnapshot.mockReturnValue({
      flow: {
        id: "flow-1",
        ownerKey: "agent:executor:main",
        status: "running",
        notifyPolicy: "state_changes",
        goal: "Deliver governed outcomes.",
        currentStep: "capability_selection",
        updatedAt: 123,
        tasks: [],
        taskSummary: {
          total: 0,
        },
        managedAutonomy: {
          agentId: "executor",
          controllerId: "runtime.autonomy/executor",
          goal: "Deliver governed outcomes.",
          currentStep: "capability_selection",
          workspaceDirs: ["/tmp/autonomy"],
          primaryWorkspaceDir: "/tmp/autonomy",
          project: {
            kind: "execution_system",
            goalContract: {
              goal: "Deliver governed outcomes.",
              layer: "execution",
              authorityLevel: "governed",
            },
            taskGraph: [
              {
                id: "goal_intake",
                title: "Goal Intake",
                dependsOn: [],
                output: "goal_contract",
              },
            ],
            executionPlan: {
              phases: [
                {
                  id: "capability_selection",
                  title: "Capability Selection",
                  dependsOn: ["goal_intake"],
                  output: "execution_plan",
                },
              ],
              runtimeHooks: ["taskflow"],
              collaborators: ["founder", "librarian"],
            },
            capabilityRequest: {
              status: "required",
              focusGapIds: ["capability_inventory.demo_gap"],
              handoffTeamId: "genesis_team",
              reason: "critical capability gaps block safe execution",
              blockers: ["missing genesis role: qa"],
            },
            observedCapabilityGaps: ["capability_inventory.demo_gap"],
            genesisPlan: {
              teamId: "genesis_team",
              mode: "repair",
              focusGapIds: ["capability_inventory.demo_gap"],
              blockers: ["missing genesis role: qa"],
            },
            sandboxUniverse: {
              universeId: "sandbox/executor/capability/demo-gap",
              target: {
                kind: "capability",
                id: "capability_inventory.demo_gap",
                title: "Demo gap",
                focusGapIds: ["capability_inventory.demo_gap"],
                teamId: "genesis_team",
              },
              stages: [
                {
                  id: "proposal",
                  title: "Proposal",
                  status: "planned",
                  requiredEvidence: ["problem_statement"],
                  blockers: [],
                },
              ],
              promotionGate: {
                freezeActive: false,
                blockers: [],
                requiredEvidence: ["promotion_manifest"],
              },
            },
            sandboxController: {
              observedAt: 1,
              charterDir: "/tmp/governance/charter",
              universeId: "sandbox/executor/capability/demo-gap",
              target: {
                kind: "capability",
                id: "capability_inventory.demo_gap",
                title: "Demo gap",
                focusGapIds: ["capability_inventory.demo_gap"],
                teamId: "genesis_team",
              },
              workspaceDirs: ["/tmp/autonomy"],
              activeStageId: "sandbox_validation",
              blockers: [],
              evidence: [
                {
                  id: "sandbox_change_set",
                  status: "collected",
                  storagePath: "/tmp/autonomy-state/governance/sandbox-universe/demo/artifacts/sandbox_change_set.json",
                  sizeBytes: 512,
                  sha256: "1234567890abcdef1234567890abcdef",
                },
              ],
              stages: [
                {
                  id: "sandbox_validation",
                  title: "Sandbox Validation",
                  status: "active",
                  requiredEvidence: ["sandbox_change_set"],
                  blockers: [],
                },
              ],
              statePath: "/tmp/autonomy-state/governance/sandbox-universe/demo/state.json",
              artifactDir: "/tmp/autonomy-state/governance/sandbox-universe/demo/artifacts",
            },
            sandboxReplayRunner: {
              observedAt: 1,
              charterDir: "/tmp/governance/charter",
              universeId: "sandbox/executor/capability/demo-gap",
              status: "ready",
              scenarios: ["replay:capability_inventory.demo_gap"],
              workspaceDirs: ["/tmp/autonomy"],
              requiredOutputs: ["replay_report"],
              blockers: [],
              lastRun: {
                observedAt: 1,
                replayPassed: true,
                qaPassed: true,
                auditPassed: true,
                canPromote: true,
              },
              statePath: "/tmp/autonomy-state/governance/sandbox-universe/demo/state.json",
              artifactDir: "/tmp/autonomy-state/governance/sandbox-universe/demo/artifacts",
            },
          },
        },
        managedExecution: {
          kind: "execution_system",
          goalContract: {
            goal: "Deliver governed outcomes.",
            layer: "execution",
            authorityLevel: "governed",
          },
          taskGraph: [
            {
              id: "goal_intake",
              title: "Goal Intake",
              dependsOn: [],
              output: "goal_contract",
            },
          ],
          executionPlan: {
            phases: [
              {
                id: "capability_selection",
                title: "Capability Selection",
                dependsOn: ["goal_intake"],
                output: "execution_plan",
              },
            ],
            runtimeHooks: ["taskflow"],
            collaborators: ["founder", "librarian"],
          },
          capabilityRequest: {
            status: "required",
            focusGapIds: ["capability_inventory.demo_gap"],
            handoffTeamId: "genesis_team",
            reason: "critical capability gaps block safe execution",
            blockers: ["missing genesis role: qa"],
          },
          observedCapabilityGaps: ["capability_inventory.demo_gap"],
          genesisPlan: {
            teamId: "genesis_team",
            mode: "repair",
            focusGapIds: ["capability_inventory.demo_gap"],
            blockers: ["missing genesis role: qa"],
          },
        },
      },
    });
    mocks.getLoopJob.mockResolvedValue(undefined);

    const { runtime, logs } = createRuntime();
    await autonomyShowCommand(
      {
        agentId: "executor",
        sessionKey: "agent:executor:main",
      },
      runtime,
    );

    expect(logs.join("\n")).toContain("latestFlowProjectKind: execution_system");
    expect(logs.join("\n")).toContain("latestFlowExecutionCapabilityRequest: required");
    expect(logs.join("\n")).toContain("latestFlowExecutionTaskGraph: goal_intake:goal_contract");
    expect(logs.join("\n")).toContain("sandboxController: activeStage=sandbox_validation");
    expect(logs.join("\n")).toContain(
      "sandboxPersistence: state=/tmp/autonomy-state/governance/sandbox-universe/demo/state.json",
    );
    expect(logs.join("\n")).toContain("sandboxEvidenceLedger: sandbox_change_set:collected");
    expect(logs.join("\n")).toContain("sha=1234567890ab");
    expect(logs.join("\n")).toContain("sandboxReplayRunner: status=ready");
    expect(logs.join("\n")).toContain("sandboxPromotionDecision: replay=pass qa=pass audit=pass promote=yes");
  });

  it("normalizes workspace scope for history queries and prints scoped events", async () => {
    mocks.getFleetHistory.mockResolvedValue({
      events: [
        {
          eventId: "history-1",
          ts: 1,
          sessionKey: "agent:control:main",
          mode: "heal",
          source: "manual",
          agentIds: ["founder"],
          workspaceDirs: ["/tmp/a", "/tmp/b"],
          primaryWorkspaceDir: "/tmp/a",
          changed: true,
          totals: {
            changed: 1,
            totalProfiles: 1,
            loopCreated: 1,
            loopUpdated: 0,
            flowStarted: 1,
            flowRestarted: 0,
          },
          entries: [
            {
              agentId: "founder",
              changed: true,
              healthBefore: "missing_loop",
              healthAfter: "healthy",
              loopAction: "created",
              flowAction: "started",
              workspaceDirs: ["/tmp/a", "/tmp/b"],
              primaryWorkspaceDir: "/tmp/a",
              reasons: ["managed loop missing"],
            },
          ],
        },
      ],
      total: 1,
      truncated: false,
    });

    const { runtime, logs } = createRuntime();
    await autonomyHistoryCommand(
      {
        agentIds: ["founder"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/b", " /tmp/a ", "/tmp/b"],
        limit: 5,
        mode: "heal",
        source: "manual",
      },
      runtime,
    );

    expect(mocks.getFleetHistory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      limit: 5,
      mode: "heal",
      source: "manual",
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
    expect(logs.join("\n")).toContain("scope=/tmp/a, /tmp/b");
  });

  it("normalizes start workspace scope and reports the started flow scope", async () => {
    mocks.startManagedFlow.mockReturnValue({
      profile: { id: "strategist" },
      flow: {
        id: "flow-1",
        status: "queued",
        goal: "Review strategy failures",
        state: {
          autonomy: {
            controllerId: "runtime.autonomy/strategist/manual",
            workspaceDirs: ["/tmp/a", "/tmp/b"],
            primaryWorkspaceDir: "/tmp/a",
          },
        },
      },
      seedTask: {
        id: "task-1",
        status: "queued",
      },
    });

    const { runtime, logs } = createRuntime();
    await autonomyStartCommand(
      {
        agentId: "strategist",
        sessionKey: "agent:strategist:main",
        goal: "Review strategy failures",
        controllerId: "runtime.autonomy/strategist/manual",
        currentStep: "review-history",
        workspaceDirs: ["/tmp/b", "/tmp/a", "/tmp/b"],
        notifyPolicy: "silent",
        status: "queued",
      },
      runtime,
    );

    expect(mocks.startManagedFlow).toHaveBeenCalledWith({
      agentId: "strategist",
      goal: "Review strategy failures",
      controllerId: "runtime.autonomy/strategist/manual",
      currentStep: "review-history",
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      notifyPolicy: "silent",
      status: "queued",
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
  });

  it("submits sandbox replay evidence and prints the promotion verdict", async () => {
    mocks.submitSandboxReplay.mockResolvedValue({
      profile: { id: "librarian" },
      requestedFlowId: "flow-123",
      targetFlowId: "flow-123",
      outcome: {
        found: true,
        applied: true,
        decision: {
          replayPassed: true,
          qaPassed: true,
          auditPassed: false,
          canPromote: false,
        },
        flow: {
          id: "flow-123",
          status: "running",
          updatedAt: 42,
        },
        seedTask: {
          id: "task-123",
          status: "done",
        },
      },
    });

    const { runtime, logs } = createRuntime();
    await autonomyReplaySubmitCommand(
      {
        agentId: "librarian",
        sessionKey: "agent:librarian:main",
        flowId: "flow-123",
        replayPassed: true,
        qaPassed: true,
        auditPassed: false,
      },
      runtime,
    );

    expect(mocks.submitSandboxReplay).toHaveBeenCalledWith({
      agentId: "librarian",
      flowId: "flow-123",
      replayPassed: true,
      qaPassed: true,
      auditPassed: false,
    });
    expect(logs.join("\n")).toContain("Autonomy sandbox replay submission:");
    expect(logs.join("\n")).toContain("targetFlowId: flow-123");
    expect(logs.join("\n")).toContain(
      "promotionDecision: replay=pass qa=pass audit=fail promote=no",
    );
    expect(logs.join("\n")).toContain("seedTaskId: task-123");
  });

  it("normalizes governance reconcile workspace scope and prints reconcile totals", async () => {
    mocks.reconcileGovernanceProposals.mockResolvedValue({
      observedAt: 1,
      charterDir: "/tmp/governance/charter",
      requestedAgentIds: ["founder"],
      eligibleAgentIds: ["founder"],
      findingIds: ["capability_inventory.registry_missing"],
      mode: "apply_safe",
      synthesized: {
        observedAt: 1,
        charterDir: "/tmp/governance/charter",
        requestedAgentIds: ["founder"],
        eligibleAgentIds: ["founder"],
        findingIds: ["capability_inventory.registry_missing"],
        results: [],
        createdCount: 1,
        existingCount: 0,
        skippedCount: 0,
      },
      entries: [
        {
          ruleId: "bootstrap_capability_asset_registry",
          title: "Bootstrap capability asset registry",
          findingIds: ["capability_inventory.registry_missing"],
          operations: [
            {
              kind: "write",
              path: "capability/asset-registry.yaml",
              content: "version: 1\n",
            },
          ],
          synthesisStatus: "created",
          proposalId: "gpr-3",
          proposalStatusBefore: "pending",
          proposalStatusAfter: "applied",
          safe: true,
          autoApproved: true,
          autoApplied: true,
        },
      ],
      reviewedCount: 1,
      appliedCount: 1,
      skippedCount: 0,
    });

    const { runtime, logs } = createRuntime();
    await autonomyGovernanceReconcileCommand(
      {
        agentIds: ["founder"],
        sessionKey: "agent:control:main",
        workspaceDirs: [" /tmp/b ", "/tmp/a", "/tmp/b"],
        mode: "apply_safe",
        decisionNote: "Auto-apply safe governance repairs.",
      },
      runtime,
    );

    expect(mocks.reconcileGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      mode: "apply_safe",
      decisionNote: "Auto-apply safe governance repairs.",
    });
    expect(logs.join("\n")).toContain("workspaceScope: /tmp/a, /tmp/b");
    expect(logs.join("\n")).toContain("mode: apply_safe");
    expect(logs.join("\n")).toContain("reviewed: 1");
    expect(logs.join("\n")).toContain("applied: 1");
  });
});
