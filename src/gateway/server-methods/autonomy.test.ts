import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { autonomyHandlers } from "./autonomy.js";

const mocks = vi.hoisted(() => ({
  createRuntimeTaskFlow: vi.fn(() => ({ kind: "taskflow-runtime" })),
  createRuntimeAutonomy: vi.fn(),
  bindSession: vi.fn(),
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
  getLatestManagedFlowSnapshot: vi.fn(),
  getLoopJob: vi.fn(),
  startManagedFlow: vi.fn(),
  submitSandboxReplay: vi.fn(),
  cancelManagedFlow: vi.fn(),
  showLoopJob: vi.fn(),
  upsertLoopJob: vi.fn(),
  reconcileLoopJobs: vi.fn(),
  getFleetStatus: vi.fn(),
  getFleetHistory: vi.fn(),
  getCapabilityInventory: vi.fn(),
  planGenesisWork: vi.fn(),
  synthesizeGovernanceProposals: vi.fn(),
  reconcileGovernanceProposals: vi.fn(),
  getArchitectureReadiness: vi.fn(),
  healFleet: vi.fn(),
  superviseFleet: vi.fn(),
  removeLoopJob: vi.fn(),
}));

vi.mock("../../plugins/runtime/runtime-taskflow.js", () => ({
  createRuntimeTaskFlow: mocks.createRuntimeTaskFlow,
}));

vi.mock("../../plugins/runtime/runtime-autonomy.js", () => ({
  createRuntimeAutonomy: mocks.createRuntimeAutonomy,
}));

type RespondCall = [boolean, unknown?, { code: number; message: string }?];

async function invoke(
  method: keyof typeof autonomyHandlers,
  params: Record<string, unknown>,
) {
  const respond = vi.fn();
  await autonomyHandlers[method]({
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    req: { type: "req", id: "req-1", method },
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("autonomy handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const workspaceDir = "C:/workspace";
    const founderProfile = {
      id: "founder",
      collaborators: ["strategist"],
      reportsTo: ["architect"],
      mutationAllow: ["skills"],
      mutationDeny: ["constitution"],
      networkConditions: ["approval-required"],
      runtimeHooks: ["taskflow"],
      contract: {
        agentId: "founder",
        charterDeclared: true,
        collaborators: ["strategist"],
        reportsTo: ["architect"],
        mutationAllow: ["skills"],
        mutationDeny: ["constitution"],
        networkConditions: ["approval-required"],
        runtimeHooks: ["taskflow"],
        charterToolDeny: [],
        charterRequireAgentId: true,
        charterElevatedLocked: true,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        effectiveToolDeny: [],
      },
      bootstrap: {
        controllerId: "runtime.autonomy/founder",
        defaultGoal: "Scan organization performance.",
        defaultCurrentStep: "scan-organization",
        recommendedGoals: ["Scan organization performance."],
        seedTask: {
          runtime: "cli",
          label: "Organization evolution scan",
          task: "Queue evolution work.",
          status: "queued",
        },
        loop: {
          mode: "managed-flow",
          name: "Autonomy Loop: Founder",
          description: "Governed loop for founder.",
          schedule: { kind: "every", everyMs: 21_600_000 },
          sessionTarget: "isolated",
          wakeMode: "now",
          message: "Run the founder loop.",
        },
      },
    };
    const founderLoopJob = {
      agentId: "founder",
      mode: "managed-flow",
      workspaceDirs: [workspaceDir],
      primaryWorkspaceDir: workspaceDir,
      job: {
        id: "loop-job-1",
        agentId: "founder",
        sessionKey: "agent:founder:main",
        name: "Autonomy Loop: Founder",
        description: "[[autonomy-loop:founder]] Governed loop for founder.",
        enabled: true,
        createdAtMs: 1,
        updatedAtMs: 2,
        schedule: { kind: "every", everyMs: 21_600_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: {
          kind: "agentTurn",
          message: "[[autonomy-loop:founder]] Run the founder loop.",
        },
        state: {
          nextRunAtMs: 3,
        },
      },
    };
    mocks.createRuntimeAutonomy.mockReturnValue({
      bindSession: mocks.bindSession,
    });
    mocks.bindSession.mockReturnValue({
      listProfiles: mocks.listProfiles,
      getProfile: mocks.getProfile,
      getLatestManagedFlowSnapshot: mocks.getLatestManagedFlowSnapshot,
      getLoopJob: mocks.getLoopJob,
      startManagedFlow: mocks.startManagedFlow,
      submitSandboxReplay: mocks.submitSandboxReplay,
      cancelManagedFlow: mocks.cancelManagedFlow,
      showLoopJob: mocks.showLoopJob,
      upsertLoopJob: mocks.upsertLoopJob,
      reconcileLoopJobs: mocks.reconcileLoopJobs,
      getFleetStatus: mocks.getFleetStatus,
      getFleetHistory: mocks.getFleetHistory,
      getCapabilityInventory: mocks.getCapabilityInventory,
      planGenesisWork: mocks.planGenesisWork,
      synthesizeGovernanceProposals: mocks.synthesizeGovernanceProposals,
      reconcileGovernanceProposals: mocks.reconcileGovernanceProposals,
      getArchitectureReadiness: mocks.getArchitectureReadiness,
      healFleet: mocks.healFleet,
      superviseFleet: mocks.superviseFleet,
      removeLoopJob: mocks.removeLoopJob,
    });
    mocks.listProfiles.mockReturnValue([founderProfile]);
    mocks.getProfile.mockImplementation((agentId: string) =>
      agentId === "founder" ? founderProfile : undefined,
    );
    mocks.startManagedFlow.mockReturnValue({
      profile: { id: "founder" },
      flow: { id: "flow-1", ownerKey: "agent:founder:main", status: "running" },
      seedTask: { id: "task-1", status: "queued" },
    });
    mocks.submitSandboxReplay.mockResolvedValue({
      profile: { id: "founder" },
      targetFlowId: "flow-1",
      outcome: {
        found: true,
        applied: true,
        decision: {
          observedAt: 10,
          charterDir: "C:/charter",
          universeId: "sandbox-1",
          target: {
            kind: "capability",
            id: "demo-gap",
            title: "Demo gap",
            focusGapIds: ["demo-gap"],
            teamId: "genesis_team",
          },
          replayPassed: true,
          qaPassed: true,
          auditPassed: true,
          freezeActive: false,
          blockers: [],
          requiredEvidence: ["replay_report"],
          canPromote: true,
        },
        sandboxReplayRunner: {
          observedAt: 10,
          charterDir: "C:/charter",
          universeId: "sandbox-1",
          status: "passed",
          scenarios: ["demo"],
          workspaceDirs: [workspaceDir],
          requiredOutputs: ["promotion_manifest"],
          blockers: [],
          lastRun: {
            observedAt: 10,
            replayPassed: true,
            qaPassed: true,
            auditPassed: true,
            canPromote: true,
          },
        },
        flow: {
          id: "flow-1",
          ownerKey: "agent:founder:main",
          status: "succeeded",
        },
      },
    });
    mocks.cancelManagedFlow.mockResolvedValue({
      profile: { id: "founder" },
      targetFlowId: "flow-latest",
      outcome: {
        found: true,
        cancelled: true,
        flow: { id: "flow-latest", ownerKey: "agent:founder:main", status: "cancelled" },
        seedTask: { id: "task-latest", status: "cancelled" },
      },
    });
    mocks.getLoopJob.mockResolvedValue(founderLoopJob);
    mocks.getLatestManagedFlowSnapshot.mockReturnValue({
      flow: { id: "flow-latest", ownerKey: "agent:founder:main", status: "running" },
      seedTask: { id: "task-latest", status: "running" },
    });
    mocks.showLoopJob.mockResolvedValue({
      profile: founderProfile,
      loop: founderLoopJob,
    });
    mocks.upsertLoopJob.mockResolvedValue({
      profile: founderProfile,
      created: true,
      updated: false,
      loop: {
        agentId: "founder",
        mode: "managed-flow",
        workspaceDirs: [workspaceDir],
        primaryWorkspaceDir: workspaceDir,
        job: {
          id: "loop-job-1",
          agentId: "founder",
          sessionKey: "agent:founder:main",
          name: "Autonomy Loop: Founder",
          description: "[[autonomy-loop:founder]] Governed loop for founder.",
          enabled: true,
          createdAtMs: 1,
          updatedAtMs: 2,
          schedule: { kind: "every", everyMs: 3_600_000 },
          sessionTarget: "isolated",
          wakeMode: "now",
          payload: {
            kind: "agentTurn",
            message: "[[autonomy-loop:founder]] Run the founder loop.",
          },
        },
      },
    });
    mocks.removeLoopJob.mockResolvedValue({
      profile: founderProfile,
      targetJobId: "loop-job-1",
      removed: true,
      removedJobIds: ["loop-job-1"],
    });
    mocks.reconcileLoopJobs.mockResolvedValue({
      reconciled: [
        {
          profile: founderProfile,
          created: false,
          updated: true,
          loop: {
            agentId: "founder",
            mode: "managed-flow",
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
            job: {
              id: "loop-job-1",
              agentId: "founder",
              sessionKey: "agent:founder:main",
              name: "Autonomy Loop: Founder",
              description: "[[autonomy-loop:founder]] Governed loop for founder.",
              enabled: true,
              createdAtMs: 1,
              updatedAtMs: 2,
              schedule: { kind: "every", everyMs: 21_600_000 },
              sessionTarget: "isolated",
              wakeMode: "now",
              payload: {
                kind: "agentTurn",
                message: "[[autonomy-loop:founder]] Run the founder loop.",
              },
            },
          },
        },
      ],
      createdCount: 0,
      updatedCount: 1,
    });
    mocks.getFleetStatus.mockResolvedValue({
      entries: [
        {
          agentId: "founder",
          profile: founderProfile,
          latestFlow: { id: "flow-latest", ownerKey: "agent:founder:main", status: "running" },
          latestSeedTask: { id: "task-latest", status: "running" },
          loopJob: founderLoopJob,
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          duplicateLoopCount: 0,
          expectedLoopEveryMs: 21_600_000,
          actualLoopEveryMs: 21_600_000,
          loopCadenceAligned: true,
          hasActiveFlow: true,
          driftReasons: [],
          suggestedAction: "observe",
          health: "healthy",
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
    mocks.getCapabilityInventory.mockResolvedValue({
      observedAt: 1,
      charterDir: "C:/charter",
      workspaceDirs: [workspaceDir],
      requestedAgentIds: ["founder"],
      summary: {
        totalEntries: 4,
        skillCount: 1,
        skillReady: 1,
        skillAttention: 0,
        skillBlocked: 0,
        pluginCount: 1,
        pluginActivated: 1,
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
      entries: [
        {
          id: "agent_blueprint:founder",
          kind: "agent_blueprint",
          status: "ready",
          title: "Founder",
          coverage: ["hook:skills"],
          dependencies: [],
          issues: [],
          installOptions: [],
        },
      ],
      gaps: [
        {
          id: "capability_inventory.skills_missing",
          severity: "warning",
          title: "No governed skill assets were discovered",
          detail: "Skill library is empty.",
          ownerAgentId: "librarian",
          relatedEntryIds: [],
          suggestedActions: ["register the first skill"],
        },
      ],
    });
    mocks.planGenesisWork.mockResolvedValue({
      observedAt: 1,
      charterDir: "C:/charter",
      workspaceDirs: [workspaceDir],
      primaryWorkspaceDir: workspaceDir,
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
          goal: "Turn inventory drift into ranked governed gap signals.",
          dependsOn: [],
          inputRefs: ["capability_inventory.genesis_roles_missing"],
          outputRefs: ["gap_signal", "risk_summary"],
          actions: ["detect and rank: Genesis Team handoff roles are incomplete"],
        },
      ],
    });
    mocks.healFleet.mockResolvedValue({
      entries: [
        {
          agentId: "founder",
          profile: founderProfile,
          healthBefore: "idle",
          healthAfter: "healthy",
          loopAction: "none",
          flowAction: "started",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          reasons: ["latest managed flow is cancelled"],
        },
      ],
      totals: {
        totalProfiles: 1,
        changed: 1,
        unchanged: 0,
        loopCreated: 0,
        loopUpdated: 0,
        flowStarted: 1,
        flowRestarted: 0,
      },
    });
    mocks.superviseFleet.mockResolvedValue({
      observedAt: 1,
      governanceMode: "apply_safe",
      overviewBefore: {
        entries: [],
        totals: {
          totalProfiles: 1,
          healthy: 0,
          idle: 1,
          drift: 0,
          missingLoop: 0,
          activeFlows: 0,
        },
      },
      healed: {
        entries: [],
        totals: {
          totalProfiles: 1,
          changed: 1,
          unchanged: 0,
          loopCreated: 1,
          loopUpdated: 0,
          flowStarted: 1,
          flowRestarted: 0,
        },
      },
      capabilityInventory: {
        observedAt: 2,
        charterDir: "C:/charter",
        workspaceDirs: [workspaceDir],
        requestedAgentIds: ["founder"],
        summary: {
          totalEntries: 1,
          skillCount: 0,
          skillReady: 0,
          skillAttention: 0,
          skillBlocked: 0,
          pluginCount: 0,
          pluginActivated: 0,
          pluginAttention: 0,
          pluginBlocked: 0,
          agentBlueprintCount: 1,
          teamBlueprintCount: 0,
          autonomyProfileCount: 1,
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
        charterDir: "C:/charter",
        workspaceDirs: [workspaceDir],
        primaryWorkspaceDir: workspaceDir,
        requestedAgentIds: ["founder"],
        teamId: "genesis_team",
        teamTitle: "Genesis Team",
        mode: "repair",
        blockers: [],
        focusGapIds: ["gap-1"],
        stages: [],
      },
      overviewAfter: {
        entries: [],
        totals: {
          totalProfiles: 1,
          healthy: 1,
          idle: 0,
          drift: 0,
          missingLoop: 0,
          activeFlows: 1,
        },
      },
      summary: {
        totalProfiles: 1,
        changedProfiles: 1,
        healthyProfiles: 1,
        driftProfiles: 0,
        missingLoopProfiles: 0,
        activeFlows: 1,
        governanceCreatedCount: 0,
        governanceAppliedCount: 0,
        governancePendingCount: 0,
        capabilityGapCount: 1,
        criticalCapabilityGapCount: 0,
        genesisStageCount: 0,
        genesisBlockedStageCount: 0,
        recommendedNextActions: ["Execute the genesis plan stages to close the remaining governed capability gaps."],
      },
    });
    mocks.getFleetHistory.mockResolvedValue({
      events: [
        {
          eventId: "history-1",
          ts: 1,
          sessionKey: "agent:main:main",
          mode: "heal",
          source: "manual",
          agentIds: ["founder"],
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
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
              healthBefore: "idle",
              healthAfter: "healthy",
              loopAction: "none",
              flowAction: "started",
              workspaceDirs: [workspaceDir],
              primaryWorkspaceDir: workspaceDir,
              reasons: ["latest managed flow is cancelled"],
            },
          ],
        },
      ],
      total: 1,
      truncated: false,
    });
    mocks.synthesizeGovernanceProposals.mockResolvedValue({
      observedAt: 1,
      charterDir: "C:/charter",
      requestedAgentIds: ["founder"],
      eligibleAgentIds: ["founder"],
      findingIds: ["governance.charter.freeze_without_auditor"],
      results: [
        {
          ruleId: "attach_sovereignty_auditor",
          findingIds: ["governance.charter.freeze_without_auditor"],
          title: "Attach sovereignty auditor artifact to the constitution",
          status: "created",
          operations: [
            {
              kind: "write",
              path: "constitution.yaml",
              content: "version: 1\n",
            },
          ],
          dedupeKey: "dedupe-1",
          proposalId: "proposal-1",
          proposalStatus: "pending",
        },
      ],
      createdCount: 1,
      existingCount: 0,
      skippedCount: 0,
    });
    mocks.reconcileGovernanceProposals.mockResolvedValue({
      observedAt: 2,
      charterDir: "C:/charter",
      requestedAgentIds: ["founder"],
      eligibleAgentIds: ["founder"],
      findingIds: ["governance.charter.freeze_without_auditor"],
      mode: "apply_safe",
      synthesized: {
        observedAt: 1,
        charterDir: "C:/charter",
        requestedAgentIds: ["founder"],
        eligibleAgentIds: ["founder"],
        findingIds: ["governance.charter.freeze_without_auditor"],
        results: [
          {
            ruleId: "attach_sovereignty_auditor",
            findingIds: ["governance.charter.freeze_without_auditor"],
            title: "Attach sovereignty auditor artifact to the constitution",
            status: "created",
            operations: [
              {
                kind: "write",
                path: "constitution.yaml",
                content: "version: 1\n",
              },
            ],
            dedupeKey: "dedupe-1",
            proposalId: "proposal-1",
            proposalStatus: "pending",
          },
        ],
        createdCount: 1,
        existingCount: 0,
        skippedCount: 0,
      },
      entries: [
        {
          ruleId: "attach_sovereignty_auditor",
          title: "Attach sovereignty auditor artifact to the constitution",
          findingIds: ["governance.charter.freeze_without_auditor"],
          operations: [
            {
              kind: "write",
              path: "constitution.yaml",
              content: "version: 1\n",
            },
          ],
          synthesisStatus: "created",
          proposalId: "proposal-1",
          proposalStatusBefore: "pending",
          proposalStatusAfter: "applied",
          safe: false,
          autoApproved: true,
          autoApplied: true,
        },
      ],
      reviewedCount: 1,
      appliedCount: 1,
      skippedCount: 0,
    });
    mocks.getArchitectureReadiness.mockResolvedValue({
      observedAt: 4,
      sessionKey: "agent:main:main",
      charterDir: "C:/charter",
      workspaceDirs: [workspaceDir],
      summary: {
        ready: true,
        status: "ready",
        readyChecks: 13,
        attentionChecks: 0,
        blockedChecks: 0,
        totalChecks: 13,
        blockers: [],
      },
      layers: [
        {
          id: "governance",
          title: "Governance Layer",
          status: "ready",
          evidence: ["charter loaded"],
          blockers: [],
        },
      ],
      loops: [
        {
          id: "evolution",
          title: "Evolution Loop",
          status: "ready",
          evidence: ["founder loop is healthy"],
          blockers: [],
        },
      ],
      sandboxUniverse: {
        id: "sandbox_universe",
        title: "Sandbox Universe",
        status: "ready",
        evidence: ["sandbox universe control algorithm registered"],
        blockers: [],
      },
      algorithmEvolutionProtocol: {
        id: "algorithm_evolution_protocol",
        title: "Algorithm Evolution Protocol",
        status: "ready",
        evidence: ["algorithmReady=1"],
        blockers: [],
      },
      autonomousDevelopment: {
        id: "autonomous_development",
        title: "Autonomous Development",
        status: "ready",
        evidence: ["Genesis Team staged plan is available"],
        blockers: [],
      },
      continuousRuntime: {
        id: "continuous_runtime",
        title: "Continuous Runtime",
        status: "ready",
        evidence: ["healthyProfiles=1/1"],
        blockers: [],
      },
      bootstrapped: {
        observedAt: 4,
        sessionKey: "agent:main:main",
        supervised: {
          observedAt: 4,
          governanceMode: "apply_safe",
          overviewBefore: {
            entries: [],
            totals: {
              totalProfiles: 1,
              healthy: 0,
              idle: 1,
              drift: 0,
              missingLoop: 0,
              activeFlows: 0,
            },
          },
          healed: {
            entries: [],
            totals: {
              totalProfiles: 1,
              changed: 1,
              unchanged: 0,
              loopCreated: 1,
              loopUpdated: 0,
              flowStarted: 1,
              flowRestarted: 0,
            },
          },
          overviewAfter: {
            entries: [],
            totals: {
              totalProfiles: 1,
              healthy: 1,
              idle: 0,
              drift: 0,
              missingLoop: 0,
              activeFlows: 1,
            },
          },
          summary: {
            totalProfiles: 1,
            changedProfiles: 1,
            healthyProfiles: 1,
            driftProfiles: 0,
            missingLoopProfiles: 0,
            activeFlows: 1,
            governanceCreatedCount: 0,
            governanceAppliedCount: 0,
            governancePendingCount: 0,
            capabilityGapCount: 0,
            criticalCapabilityGapCount: 0,
            genesisStageCount: 6,
            genesisBlockedStageCount: 0,
            recommendedNextActions: [],
          },
        },
        readiness: {
          ready: true,
          profileReadyCount: 1,
          profileNotReadyCount: 0,
          missingLoopProfiles: 0,
          driftProfiles: 0,
          idleProfiles: 0,
          activeFlows: 1,
          capabilityGapCount: 0,
          criticalCapabilityGapCount: 0,
          genesisBlockedStageCount: 0,
          blockers: [],
        },
      },
    });
  });

  it("lists autonomy profiles with the default control session key", async () => {
    const respond = await invoke("autonomy.list", {});
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.bindSession).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      profiles: expect.any(Array),
    });
  });

  it("rejects invalid autonomy.list params", async () => {
    const respond = await invoke("autonomy.list", { extra: true });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("invalid autonomy.list params");
  });

  it("returns one autonomy profile", async () => {
    const respond = await invoke("autonomy.show", { agentId: "founder" });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.bindSession).toHaveBeenCalledWith({
      sessionKey: "agent:founder:main",
    });
    expect(mocks.getProfile).toHaveBeenCalledWith("founder");
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      profile: expect.objectContaining({ id: "founder" }),
      latestFlow: expect.objectContaining({ id: "flow-latest" }),
      latestSeedTask: expect.objectContaining({ id: "task-latest" }),
      loopJob: expect.objectContaining({
        agentId: "founder",
        job: expect.objectContaining({ id: "loop-job-1" }),
      }),
    });
  });

  it("returns fleet-wide autonomy convergence status", async () => {
    const respond = await invoke("autonomy.overview", {
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.bindSession).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
    });
    expect(mocks.getFleetStatus).toHaveBeenCalledWith({
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      overview: expect.objectContaining({
        totals: expect.objectContaining({
          totalProfiles: 1,
          healthy: 1,
        }),
      }),
    });
  });

  it("returns governed capability inventory", async () => {
    const respond = await invoke("autonomy.capability.inventory", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.getCapabilityInventory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      capabilities: expect.objectContaining({
        charterDir: "C:/charter",
        requestedAgentIds: ["founder"],
        gaps: [
          expect.objectContaining({
            id: "capability_inventory.skills_missing",
          }),
        ],
      }),
    });
  });

  it("returns a deterministic genesis plan", async () => {
    const respond = await invoke("autonomy.genesis.plan", {
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.planGenesisWork).toHaveBeenCalledWith({
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      genesisPlan: expect.objectContaining({
        workspaceDirs: ["C:/workspace"],
        primaryWorkspaceDir: "C:/workspace",
        teamId: "genesis_team",
        mode: "repair",
        focusGapIds: ["capability_inventory.genesis_roles_missing"],
      }),
    });
  });

  it("returns fleet-wide autonomy heal results", async () => {
    const respond = await invoke("autonomy.heal", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.bindSession).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
    });
    expect(mocks.healFleet).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      healed: expect.objectContaining({
        totals: expect.objectContaining({
          changed: 1,
          flowStarted: 1,
        }),
      }),
    });
  });

  it("returns a combined autonomy supervisor result", async () => {
    const respond = await invoke("autonomy.supervise", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      teamId: "genesis_team",
      restartBlockedFlows: false,
      governanceMode: "force_apply_all",
      decisionNote: "Escalate the supervisor pass.",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.superviseFleet).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      teamId: "genesis_team",
      restartBlockedFlows: false,
      governanceMode: "force_apply_all",
      decisionNote: "Escalate the supervisor pass.",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
      telemetrySource: "manual",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      supervised: expect.objectContaining({
        governanceMode: "apply_safe",
        summary: expect.objectContaining({
          totalProfiles: 1,
          changedProfiles: 1,
          healthyProfiles: 1,
        }),
      }),
    });
  });

  it("returns persistent autonomy history", async () => {
    const respond = await invoke("autonomy.history", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      limit: 5,
      mode: "heal",
      source: "manual",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.getFleetHistory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      limit: 5,
      mode: "heal",
      source: "manual",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      history: expect.objectContaining({
        total: 1,
        events: [
          expect.objectContaining({
            eventId: "history-1",
            mode: "heal",
            workspaceDirs: ["C:/workspace"],
            primaryWorkspaceDir: "C:/workspace",
          }),
        ],
      }),
    });
  });

  it("returns synthesized governance proposals", async () => {
    const respond = await invoke("autonomy.governance.proposals", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.synthesizeGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      governance: expect.objectContaining({
        createdCount: 1,
        results: [
          expect.objectContaining({
            ruleId: "attach_sovereignty_auditor",
            proposalId: "proposal-1",
          }),
        ],
      }),
    });
  });

  it("returns reconciled governance proposals", async () => {
    const respond = await invoke("autonomy.governance.reconcile", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      mode: "apply_safe",
      decisionNote: "Auto-apply safe governance repairs.",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.reconcileGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      mode: "apply_safe",
      decisionNote: "Auto-apply safe governance repairs.",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      governanceReconciled: expect.objectContaining({
        mode: "apply_safe",
        reviewedCount: 1,
        appliedCount: 1,
        entries: [
          expect.objectContaining({
            ruleId: "attach_sovereignty_auditor",
            autoApplied: true,
          }),
        ],
      }),
    });
  });

  it("activates governed maximum autonomy through architecture readiness defaults", async () => {
    const respond = await invoke("autonomy.activate", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      teamId: "genesis_team",
      decisionNote: "Activate governed maximum autonomy.",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.getArchitectureReadiness).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
      teamId: "genesis_team",
      restartBlockedFlows: true,
      governanceMode: "apply_safe",
      decisionNote: "Activate governed maximum autonomy.",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: true,
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      activated: expect.objectContaining({
        summary: expect.objectContaining({
          ready: true,
          status: "ready",
        }),
        bootstrapped: expect.objectContaining({
          readiness: expect.objectContaining({
            ready: true,
          }),
        }),
      }),
    });
  });

  it("rejects unknown autonomy profiles", async () => {
    const respond = await invoke("autonomy.show", { agentId: "unknown" });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain('Unknown autonomy profile "unknown"');
  });

  it("starts a managed autonomy flow and forwards seed task overrides", async () => {
    const respond = await invoke("autonomy.start", {
      agentId: "founder",
      goal: "Scan the horizon.",
      controllerId: "runtime.autonomy/founder/manual",
      currentStep: "scan-horizon",
      workspaceDirs: ["C:/workspace"],
      notifyPolicy: "silent",
      status: "queued",
      seedTaskRuntime: "cli",
      seedTaskStatus: "running",
      seedTaskLabel: "Manual seed",
      seedTaskTask: "Execute manual seed task.",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.startManagedFlow).toHaveBeenCalledWith({
      agentId: "founder",
      goal: "Scan the horizon.",
      controllerId: "runtime.autonomy/founder/manual",
      currentStep: "scan-horizon",
      workspaceDirs: ["C:/workspace"],
      notifyPolicy: "silent",
      status: "queued",
      seedTask: {
        runtime: "cli",
        status: "running",
        label: "Manual seed",
        task: "Execute manual seed task.",
      },
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      started: expect.objectContaining({
        flow: expect.objectContaining({ id: "flow-1" }),
      }),
    });
  });

  it("disables seed task creation when explicitly requested", async () => {
    await invoke("autonomy.start", {
      agentId: "founder",
      seedTaskEnabled: false,
    });

    expect(mocks.startManagedFlow).toHaveBeenCalledWith({
      agentId: "founder",
      seedTask: false,
    });
  });

  it("maps runtime failures to gateway errors", async () => {
    mocks.startManagedFlow.mockImplementation(() => {
      throw new Error('Autonomy profile not found for "missing".');
    });

    const respond = await invoke("autonomy.start", { agentId: "missing" });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain('Autonomy profile not found for "missing".');
  });

  it("submits sandbox replay results through the autonomy runtime", async () => {
    const respond = await invoke("autonomy.replay.submit", {
      agentId: "founder",
      flowId: "flow-1",
      replayPassed: true,
      qaPassed: true,
      auditPassed: true,
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.submitSandboxReplay).toHaveBeenCalledWith({
      agentId: "founder",
      flowId: "flow-1",
      replayPassed: true,
      qaPassed: true,
      auditPassed: true,
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      submitted: expect.objectContaining({
        targetFlowId: "flow-1",
        outcome: expect.objectContaining({
          found: true,
          applied: true,
          flow: expect.objectContaining({
            status: "succeeded",
          }),
          sandboxReplayRunner: expect.objectContaining({
            status: "passed",
          }),
        }),
      }),
    });
  });

  it("cancels the requested managed autonomy flow", async () => {
    const respond = await invoke("autonomy.cancel", {
      agentId: "founder",
      flowId: "flow-latest",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.cancelManagedFlow).toHaveBeenCalledWith({
      agentId: "founder",
      flowId: "flow-latest",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      cancelled: expect.objectContaining({
        targetFlowId: "flow-latest",
        outcome: expect.objectContaining({
          found: true,
          cancelled: true,
        }),
      }),
    });
  });

  it("shows the managed autonomy loop for one profile", async () => {
    const respond = await invoke("autonomy.loop.show", { agentId: "founder" });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.showLoopJob).toHaveBeenCalledWith({
      agentId: "founder",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      loop: expect.objectContaining({
        profile: expect.objectContaining({ id: "founder" }),
      }),
    });
  });

  it("upserts the managed autonomy loop for one profile", async () => {
    const respond = await invoke("autonomy.loop.upsert", {
      agentId: "founder",
      everyMs: 3_600_000,
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.upsertLoopJob).toHaveBeenCalledWith({
      agentId: "founder",
      everyMs: 3_600_000,
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      upserted: expect.objectContaining({
        loop: expect.objectContaining({
          workspaceDirs: ["C:/workspace"],
          primaryWorkspaceDir: "C:/workspace",
          job: expect.objectContaining({
            id: "loop-job-1",
            schedule: { kind: "every", everyMs: 3_600_000 },
          }),
        }),
      }),
    });
  });

  it("removes the managed autonomy loop for one profile", async () => {
    const respond = await invoke("autonomy.loop.remove", {
      agentId: "founder",
      jobId: "loop-job-1",
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.removeLoopJob).toHaveBeenCalledWith({
      agentId: "founder",
      jobId: "loop-job-1",
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:founder:main",
      removed: expect.objectContaining({
        removed: true,
        removedJobIds: ["loop-job-1"],
      }),
    });
  });

  it("reconciles managed autonomy loops for the requested profiles", async () => {
    const respond = await invoke("autonomy.loop.reconcile", {
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    const call = respond.mock.calls[0] as RespondCall | undefined;

    expect(mocks.reconcileLoopJobs).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["C:/workspace"],
    });
    expect(call?.[0]).toBe(true);
    expect(call?.[1]).toEqual({
      sessionKey: "agent:main:main",
      reconciled: expect.objectContaining({
        createdCount: 0,
        updatedCount: 1,
        reconciled: [
          expect.objectContaining({
            loop: expect.objectContaining({
              workspaceDirs: ["C:/workspace"],
              primaryWorkspaceDir: "C:/workspace",
            }),
          }),
        ],
      }),
    });
  });
});
