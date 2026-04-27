import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderAgents, type AgentsProps } from "./agents.ts";

function createSkill() {
  return {
    name: "Repo Skill",
    description: "Skill description",
    source: "workspace",
    filePath: "/tmp/skill",
    baseDir: "/tmp",
    skillKey: "repo-skill",
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: true,
    requirements: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    missing: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    configChecks: [],
    install: [],
  };
}

function createProps(overrides: Partial<AgentsProps> = {}): AgentsProps {
  return {
    basePath: "",
    loading: false,
    error: null,
    agentsList: {
      defaultId: "alpha",
      mainKey: "main",
      scope: "workspace",
      agents: [{ id: "alpha", name: "Alpha" } as never, { id: "beta", name: "Beta" } as never],
    },
    selectedAgentId: "beta",
    activePanel: "overview",
    config: {
      form: null,
      loading: false,
      saving: false,
      dirty: false,
    },
    channels: {
      snapshot: null,
      loading: false,
      error: null,
      lastSuccess: null,
    },
    cron: {
      status: null,
      jobs: [],
      loading: false,
      error: null,
    },
    agentFiles: {
      list: null,
      loading: false,
      error: null,
      active: null,
      contents: {},
      drafts: {},
      saving: false,
    },
    agentIdentityLoading: false,
    agentIdentityError: null,
    agentIdentityById: {},
    agentSkills: {
      report: null,
      loading: false,
      error: null,
      agentId: null,
      filter: "",
    },
    governance: {
      overviewLoading: false,
      overviewError: null,
      overviewResult: null,
      assetRegistryLoading: false,
      assetRegistryError: null,
      assetRegistryResult: null,
      capabilitiesLoading: false,
      capabilitiesError: null,
      capabilitiesResult: null,
      genesisLoading: false,
      genesisError: null,
      genesisResult: null,
      agentLoading: false,
      agentError: null,
      agentResult: null,
      teamLoading: false,
      teamError: null,
      teamResult: null,
      proposalsLoading: false,
      proposalsError: null,
      proposalsResult: null,
      proposalSynthesizeBusy: false,
      proposalSynthesizeError: null,
      proposalSynthesizeResult: null,
      proposalReconcileBusy: false,
      proposalReconcileError: null,
      proposalReconcileResult: null,
      proposalCreateBusy: false,
      proposalCreateError: null,
      proposalCreateResult: null,
      proposalActionBusyId: null,
      proposalActionError: null,
    },
    autonomy: {
      loading: false,
      error: null,
      result: null,
      overviewLoading: false,
      overviewError: null,
      overviewResult: null,
      capabilitiesLoading: false,
      capabilitiesError: null,
      capabilitiesResult: null,
      genesisLoading: false,
      genesisError: null,
      genesisResult: null,
      historyLoading: false,
      historyError: null,
      historyResult: null,
      startBusy: false,
      startError: null,
      replayBusy: false,
      replayError: null,
      replayResult: null,
      cancelBusy: false,
      cancelError: null,
      loopBusy: false,
      loopError: null,
      healBusy: false,
      healError: null,
      superviseBusy: false,
      superviseError: null,
      superviseResult: null,
      governanceBusy: false,
      governanceError: null,
      governanceResult: null,
      governanceReconcileBusy: false,
      governanceReconcileError: null,
      governanceReconcileResult: null,
      reconcileBusy: false,
      reconcileError: null,
    },
    toolsCatalog: {
      loading: false,
      error: null,
      result: null,
    },
    toolsEffective: {
      loading: false,
      error: null,
      result: null,
    },
    runtimeSessionKey: "main",
    runtimeSessionMatchesSelectedAgent: false,
    modelCatalog: [],
    onRefresh: () => undefined,
    onSelectAgent: () => undefined,
    onSelectPanel: () => undefined,
    onLoadFiles: () => undefined,
    onSelectFile: () => undefined,
    onFileDraftChange: () => undefined,
    onFileReset: () => undefined,
    onFileSave: () => undefined,
    onToolsProfileChange: () => undefined,
    onToolsOverridesChange: () => undefined,
    onConfigReload: () => undefined,
    onConfigSave: () => undefined,
    onModelChange: () => undefined,
    onModelFallbacksChange: () => undefined,
    onChannelsRefresh: () => undefined,
    onCronRefresh: () => undefined,
    onCronRunNow: () => undefined,
    onGovernanceOverviewRefresh: () => undefined,
    onGovernanceAssetRegistryRefresh: () => undefined,
    onGovernanceCapabilitiesRefresh: () => undefined,
    onGovernanceScopeUseCapabilities: () => undefined,
    onGovernanceScopeUseGenesis: () => undefined,
    onGovernanceWorkbenchScopeReset: () => undefined,
    onGovernanceGenesisRefresh: () => undefined,
    onGovernanceAgentRefresh: () => undefined,
    onGovernanceTeamRefresh: () => undefined,
    onGovernanceProposalsRefresh: () => undefined,
    onGovernanceProposalSynthesize: () => undefined,
    onGovernanceProposalReconcile: () => undefined,
    onGovernanceProposalCreate: () => undefined,
    onGovernanceProposalCreateReset: () => undefined,
    onGovernanceProposalReview: () => undefined,
    onGovernanceProposalApply: () => undefined,
    onGovernanceProposalRevert: () => undefined,
    onGovernanceProposalApproveVisible: () => undefined,
    onGovernanceProposalApplyVisible: () => undefined,
    onGovernanceProposalRevertVisible: () => undefined,
    onGovernanceProposalLoadSynthesisDraft: () => undefined,
    onGovernanceProposalLoadReconcileDraft: () => undefined,
    onAutonomyRefresh: () => undefined,
    onAutonomyOverviewRefresh: () => undefined,
    onAutonomyCapabilitiesRefresh: () => undefined,
    onAutonomyGenesisRefresh: () => undefined,
    onAutonomyHistoryRefresh: () => undefined,
    onAutonomyStart: () => undefined,
    onAutonomyReplaySubmit: () => undefined,
    onAutonomyCancel: () => undefined,
    onAutonomyLoopUpsert: () => undefined,
    onAutonomyLoopRemove: () => undefined,
    onAutonomyHeal: () => undefined,
    onAutonomySupervise: () => undefined,
    onAutonomyGovernanceProposals: () => undefined,
    onAutonomyGovernanceReconcile: () => undefined,
    onAutonomyReconcile: () => undefined,
    onAutonomyRunSuggestedAction: () => undefined,
    onAutonomyRunSuggestedActionBatch: () => undefined,
    onAutonomyInspectOverviewAgent: () => undefined,
    onAutonomyResetDraft: () => undefined,
    autonomyDraft: {
      historyMode: "",
      historySource: "",
      historyLimit: "",
      goal: "",
      controllerId: "",
      currentStep: "",
      notifyPolicy: "",
      flowStatus: "",
      seedTaskEnabled: true,
      seedTaskRuntime: "",
      seedTaskStatus: "",
      seedTaskLabel: "",
      seedTaskTask: "",
      replayVerdict: "pass",
      replayQaVerdict: "pass",
      replayAuditVerdict: "pass",
      loopEveryMinutes: "",
      workspaceScope: "",
      governanceReconcileMode: "apply_safe",
      governanceReconcileNote: "",
    },
    onAutonomyGoalChange: () => undefined,
    onAutonomyControllerIdChange: () => undefined,
    onAutonomyCurrentStepChange: () => undefined,
    onAutonomyNotifyPolicyChange: () => undefined,
    onAutonomyFlowStatusChange: () => undefined,
    onAutonomySeedTaskEnabledChange: () => undefined,
    onAutonomySeedTaskRuntimeChange: () => undefined,
    onAutonomySeedTaskStatusChange: () => undefined,
    onAutonomySeedTaskLabelChange: () => undefined,
    onAutonomySeedTaskTaskChange: () => undefined,
    onAutonomyReplayVerdictChange: () => undefined,
    onAutonomyReplayQaVerdictChange: () => undefined,
    onAutonomyReplayAuditVerdictChange: () => undefined,
    onAutonomyLoopEveryMinutesChange: () => undefined,
    onAutonomyWorkspaceScopeChange: () => undefined,
    onAutonomyGovernanceReconcileModeChange: () => undefined,
    onAutonomyGovernanceReconcileNoteChange: () => undefined,
    onAutonomyHistoryModeChange: () => undefined,
    onAutonomyHistorySourceChange: () => undefined,
    onAutonomyHistoryLimitChange: () => undefined,
    onAutonomyUseRecommendedGoal: () => undefined,
    governanceDraft: {
      scopeAgentIds: "",
      scopeWorkspaceDirs: "",
      scopeTeamId: "",
      proposalLimit: "",
      operator: "human-architect",
      decisionNote: "",
      statusFilter: "pending",
      reconcileMode: "apply_safe",
      createTitle: "",
      createRationale: "",
      createAgentId: "beta",
      createSessionKey: "agent:beta:main",
      createOperationsJson:
        '[\n  {\n    "kind": "write",\n    "path": "agents/beta.yaml",\n    "content": "version: 1"\n  }\n]',
    },
    onGovernanceOperatorChange: () => undefined,
    onGovernanceDecisionNoteChange: () => undefined,
    onGovernanceStatusFilterChange: () => undefined,
    onGovernanceReconcileModeChange: () => undefined,
    onGovernanceCreateTitleChange: () => undefined,
    onGovernanceCreateRationaleChange: () => undefined,
    onGovernanceCreateAgentIdChange: () => undefined,
    onGovernanceCreateSessionKeyChange: () => undefined,
    onGovernanceCreateOperationsJsonChange: () => undefined,
    onGovernanceScopeAgentIdsChange: () => undefined,
    onGovernanceScopeWorkspaceDirsChange: () => undefined,
    onGovernanceScopeTeamIdChange: () => undefined,
    onGovernanceProposalLimitChange: () => undefined,
    onSkillsFilterChange: () => undefined,
    onSkillsRefresh: () => undefined,
    onAgentSkillToggle: () => undefined,
    onAgentSkillsClear: () => undefined,
    onAgentSkillsDisableAll: () => undefined,
    onSetDefault: () => undefined,
    ...overrides,
  };
}

describe("renderAgents", () => {
  it("shows the skills count only for the selected agent's report", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          agentSkills: {
            report: {
              workspaceDir: "/tmp/workspace",
              managedSkillsDir: "/tmp/skills",
              skills: [createSkill()],
            },
            loading: false,
            error: null,
            agentId: "alpha",
            filter: "",
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    const skillsTab = Array.from(container.querySelectorAll<HTMLButtonElement>(".agent-tab")).find(
      (button) => button.textContent?.includes("Skills"),
    );

    expect(skillsTab?.textContent?.trim()).toBe("Skills");
  });

  it("shows the selected agent's skills count when the report matches", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          agentSkills: {
            report: {
              workspaceDir: "/tmp/workspace",
              managedSkillsDir: "/tmp/skills",
              skills: [createSkill()],
            },
            loading: false,
            error: null,
            agentId: "beta",
            filter: "",
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    const skillsTab = Array.from(container.querySelectorAll<HTMLButtonElement>(".agent-tab")).find(
      (button) => button.textContent?.includes("Skills"),
    );

    expect(skillsTab?.textContent?.trim()).toContain("1");
  });

  it("renders the autonomy panel and tab content", async () => {
    const container = document.createElement("div");
    const runSuggestedAction = vi.fn();
    const runSuggestedActionBatch = vi.fn();
    const superviseFleet = vi.fn();
    render(
      renderAgents(
        createProps({
          activePanel: "autonomy",
          onAutonomyRunSuggestedAction: runSuggestedAction,
          onAutonomyRunSuggestedActionBatch: runSuggestedActionBatch,
          onAutonomySupervise: superviseFleet,
          autonomyDraft: {
            historyMode: "heal",
            historySource: "manual",
            historyLimit: "5",
            goal: "",
            controllerId: "",
            currentStep: "",
            notifyPolicy: "",
            flowStatus: "",
            seedTaskEnabled: true,
            seedTaskRuntime: "",
            seedTaskStatus: "",
            seedTaskLabel: "",
            seedTaskTask: "",
            replayVerdict: "pass",
            replayQaVerdict: "pass",
            replayAuditVerdict: "pass",
            loopEveryMinutes: "",
            workspaceScope: "/tmp/requested-workspace\n/tmp/secondary-workspace",
            governanceReconcileMode: "apply_safe",
            governanceReconcileNote: "safe reconcile",
          },
          autonomy: {
            loading: false,
            error: null,
            result: {
              sessionKey: "agent:beta:main",
              profile: {
                id: "beta",
                name: "Beta",
                layer: "evolution",
                collaborators: ["alpha"],
                reportsTo: ["architect"],
                mutationAllow: ["skills"],
                mutationDeny: ["constitution"],
                networkConditions: ["approval-required"],
                runtimeHooks: ["taskflow"],
                contract: {
                  agentId: "beta",
                },
                bootstrap: {
                  controllerId: "runtime.autonomy/beta",
                  defaultGoal: "Scan evolution posture.",
                  defaultCurrentStep: "scan",
                  recommendedGoals: ["Scan evolution posture."],
                  seedTask: {
                    runtime: "cli",
                    label: "Scan",
                    task: "Review state",
                    status: "queued",
                  },
                  loop: {
                    mode: "managed-flow",
                    name: "Autonomy Loop: Beta",
                    description: "Governed loop",
                    schedule: { kind: "every", everyMs: 3_600_000 },
                    sessionTarget: "isolated",
                    wakeMode: "now",
                    message: "Run the loop",
                  },
                },
              } as never,
              latestFlow: {
                id: "flow-1",
                ownerKey: "agent:beta:main",
                status: "running",
                notifyPolicy: "state_changes",
                goal: "Scan evolution posture.",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                state: {
                  autonomy: {
                    workspaceDirs: ["/tmp/flow-workspace"],
                    primaryWorkspaceDir: "/tmp/flow-workspace",
                  },
                },
                managedAutonomy: {
                  agentId: "beta",
                  controllerId: "runtime.autonomy/beta",
                  goal: "Scan evolution posture.",
                  currentStep: "capability_selection",
                  workspaceDirs: ["/tmp/flow-workspace"],
                  primaryWorkspaceDir: "/tmp/flow-workspace",
                  project: {
                    kind: "execution_system",
                    goalContract: {
                      goal: "Scan evolution posture.",
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
                      {
                        id: "capability_selection",
                        title: "Capability Selection",
                        dependsOn: ["goal_intake"],
                        output: "execution_plan",
                      },
                    ],
                    executionPlan: {
                      phases: [
                        {
                          id: "goal_intake",
                          title: "Goal Intake",
                          dependsOn: [],
                          output: "goal_contract",
                        },
                        {
                          id: "capability_selection",
                          title: "Capability Selection",
                          dependsOn: ["goal_intake"],
                          output: "execution_plan",
                        },
                      ],
                      runtimeHooks: ["taskflow", "governance"],
                      collaborators: ["alpha", "librarian"],
                    },
                    capabilityRequest: {
                      status: "required",
                      focusGapIds: ["capability_inventory.demo_gap"],
                      handoffTeamId: "genesis_team",
                      reason: "critical capability gaps block governed execution",
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
                      observedAt: Date.now(),
                      charterDir: "/tmp/governance/charter",
                      workspaceDirs: ["/tmp/flow-workspace"],
                      universeId: "sandbox/beta/capability/demo-gap",
                      target: {
                        kind: "capability",
                        id: "capability_inventory.demo_gap",
                        title: "Demo capability gap",
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
                        {
                          id: "sandbox_validation",
                          title: "Sandbox Validation",
                          status: "planned",
                          requiredEvidence: ["sandbox_change_set"],
                          blockers: [],
                        },
                      ],
                      replayPlan: {
                        scenarios: ["replay:capability_inventory.demo_gap"],
                        workspaceDirs: ["/tmp/flow-workspace"],
                        requiredOutputs: ["replay_report"],
                      },
                      promotionGate: {
                        freezeActive: false,
                        blockers: [],
                        requiredEvidence: ["replay_report", "promotion_manifest"],
                      },
                    },
                    sandboxController: {
                      observedAt: Date.now(),
                      charterDir: "/tmp/governance/charter",
                      universeId: "sandbox/beta/capability/demo-gap",
                      target: {
                        kind: "capability",
                        id: "capability_inventory.demo_gap",
                        title: "Demo capability gap",
                        focusGapIds: ["capability_inventory.demo_gap"],
                        teamId: "genesis_team",
                      },
                      workspaceDirs: ["/tmp/flow-workspace"],
                      activeStageId: "sandbox_validation",
                      blockers: [],
                      evidence: [
                        {
                          id: "sandbox_change_set",
                          status: "collected",
                          note: "sandbox candidate assembled",
                          storagePath:
                            "/tmp/autonomy-state/governance/sandbox-universe/demo/artifacts/sandbox_change_set.json",
                          mediaType: "application/json",
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
                      observedAt: Date.now(),
                      charterDir: "/tmp/governance/charter",
                      universeId: "sandbox/beta/capability/demo-gap",
                      status: "ready",
                      scenarios: ["replay:capability_inventory.demo_gap"],
                      workspaceDirs: ["/tmp/flow-workspace"],
                      requiredOutputs: ["replay_report"],
                      blockers: [],
                      lastRun: {
                        observedAt: Date.now(),
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
                    goal: "Scan evolution posture.",
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
                    runtimeHooks: ["taskflow", "governance"],
                    collaborators: ["alpha", "librarian"],
                  },
                  capabilityRequest: {
                    status: "required",
                    focusGapIds: ["capability_inventory.demo_gap"],
                    handoffTeamId: "genesis_team",
                    reason: "critical capability gaps block governed execution",
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
              } as never,
              loopJob: {
                agentId: "beta",
                mode: "managed-flow",
                workspaceDirs: ["/tmp/loop-workspace"],
                primaryWorkspaceDir: "/tmp/loop-workspace",
                job: {
                  id: "loop-job-1",
                  agentId: "beta",
                  sessionKey: "agent:beta:main",
                  name: "Autonomy Loop: Beta",
                  enabled: true,
                  createdAtMs: Date.now(),
                  updatedAtMs: Date.now(),
                  schedule: { kind: "every", everyMs: 3_600_000 },
                  sessionTarget: "isolated",
                  wakeMode: "now",
                  payload: {
                    kind: "agentTurn",
                    message: "[[autonomy-loop:beta]] Run the loop",
                  },
                  state: {
                    nextRunAtMs: Date.now() + 60_000,
                  },
                },
              } as never,
            },
            overviewLoading: false,
            overviewError: null,
            overviewResult: {
              sessionKey: "agent:beta:main",
              overview: {
                entries: [
                  {
                    agentId: "beta",
                    profile: {
                      id: "beta",
                      collaborators: ["alpha"],
                      reportsTo: ["architect"],
                      mutationAllow: ["skills"],
                      mutationDeny: ["constitution"],
                      networkConditions: ["approval-required"],
                      runtimeHooks: ["taskflow"],
                      contract: { agentId: "beta" },
                      bootstrap: {
                        controllerId: "runtime.autonomy/beta",
                        defaultGoal: "Scan evolution posture.",
                        defaultCurrentStep: "scan",
                        recommendedGoals: ["Scan evolution posture."],
                        seedTask: {
                          runtime: "cli",
                          label: "Scan",
                          task: "Review state",
                          status: "queued",
                        },
                        loop: {
                          mode: "managed-flow",
                          name: "Autonomy Loop: Beta",
                          description: "Governed loop",
                          schedule: { kind: "every", everyMs: 3_600_000 },
                          sessionTarget: "isolated",
                          wakeMode: "now",
                          message: "Run the loop",
                        },
                      },
                    } as never,
                    duplicateLoopCount: 0,
                    workspaceDirs: ["/tmp/fleet-workspace"],
                    primaryWorkspaceDir: "/tmp/fleet-workspace",
                    expectedLoopEveryMs: 3_600_000,
                    actualLoopEveryMs: 3_600_000,
                    loopCadenceAligned: true,
                    hasActiveFlow: true,
                    driftReasons: [],
                    suggestedAction: "observe",
                    health: "healthy",
                  },
                  {
                    agentId: "founder",
                    profile: {
                      id: "founder",
                      name: "Founder",
                      layer: "evolution",
                      collaborators: ["strategist"],
                      reportsTo: ["architect"],
                      mutationAllow: ["agents", "skills"],
                      mutationDeny: ["constitution"],
                      networkConditions: ["approval-required"],
                      runtimeHooks: ["taskflow"],
                      contract: { agentId: "founder" },
                      bootstrap: {
                        controllerId: "runtime.autonomy/founder",
                        defaultGoal: "Advance fleet posture.",
                        defaultCurrentStep: "survey",
                        recommendedGoals: ["Advance fleet posture."],
                        seedTask: {
                          runtime: "cli",
                          label: "Survey",
                          task: "Inspect fleet posture",
                          status: "queued",
                        },
                        loop: {
                          mode: "managed-flow",
                          name: "Autonomy Loop: Founder",
                          description: "Governed loop",
                          schedule: { kind: "every", everyMs: 1_800_000 },
                          sessionTarget: "isolated",
                          wakeMode: "now",
                          message: "Run the loop",
                        },
                      },
                    } as never,
                    duplicateLoopCount: 0,
                    workspaceDirs: ["/tmp/fleet-founder"],
                    primaryWorkspaceDir: "/tmp/fleet-founder",
                    expectedLoopEveryMs: 1_800_000,
                    actualLoopEveryMs: undefined,
                    loopCadenceAligned: false,
                    hasActiveFlow: false,
                    driftReasons: ["loop missing"],
                    suggestedAction: "start_flow",
                    health: "missing_loop",
                  },
                ],
                totals: {
                  totalProfiles: 2,
                  healthy: 1,
                  idle: 0,
                  drift: 0,
                  missingLoop: 1,
                  activeFlows: 1,
                },
              },
            },
            capabilitiesLoading: false,
            capabilitiesError: null,
            capabilitiesResult: {
              sessionKey: "agent:beta:main",
              capabilities: {
                observedAt: Date.now(),
                charterDir: "/tmp/governance/charter",
                workspaceDirs: ["/tmp/capability-workspace"],
                requestedAgentIds: ["beta"],
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
                    id: "agent_blueprint:beta",
                    kind: "agent_blueprint",
                    status: "ready",
                    title: "Beta",
                    coverage: ["hook:taskflow"],
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
                    relatedEntryIds: [],
                    suggestedActions: ["register the first skill"],
                  },
                ],
              },
            },
            genesisLoading: false,
            genesisError: null,
            genesisResult: {
              sessionKey: "agent:beta:main",
              genesisPlan: {
                observedAt: Date.now(),
                charterDir: "/tmp/governance/charter",
                workspaceDirs: ["/tmp/requested-workspace", "/tmp/secondary-workspace"],
                primaryWorkspaceDir: "/tmp/requested-workspace",
                requestedAgentIds: ["beta"],
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
            },
            historyLoading: false,
            historyError: null,
            historyResult: {
              sessionKey: "agent:beta:main",
              history: {
                events: [
                  {
                    eventId: "history-1",
                    ts: Date.now(),
                    sessionKey: "agent:main:main",
                    mode: "heal",
                    source: "manual",
                    agentIds: ["beta"],
                    workspaceDirs: ["/tmp/history-workspace"],
                    primaryWorkspaceDir: "/tmp/history-workspace",
                    changed: true,
                    totals: {
                      totalProfiles: 1,
                      changed: 1,
                      unchanged: 0,
                      loopCreated: 0,
                      loopUpdated: 1,
                      flowStarted: 1,
                      flowRestarted: 0,
                    },
                    entries: [
                      {
                        agentId: "beta",
                        changed: true,
                        healthBefore: "idle",
                        healthAfter: "healthy",
                        loopAction: "updated",
                        flowAction: "started",
                        workspaceDirs: ["/tmp/history-entry-workspace"],
                        primaryWorkspaceDir: "/tmp/history-entry-workspace",
                        latestFlowStatusAfter: "running",
                        reasons: ["loop cadence corrected"],
                      },
                    ],
                  },
                ],
                total: 1,
                truncated: false,
              },
            },
            startBusy: false,
            startError: null,
            replayBusy: false,
            replayError: null,
            replayResult: null,
            cancelBusy: false,
            cancelError: null,
            loopBusy: false,
            loopError: null,
            healBusy: false,
            healError: null,
            superviseBusy: false,
            superviseError: null,
            superviseResult: {
              sessionKey: "agent:beta:main",
              supervised: {
                observedAt: Date.now(),
                governanceMode: "apply_safe",
                overviewBefore: {
                  entries: [],
                  totals: {
                    totalProfiles: 2,
                    healthy: 1,
                    idle: 0,
                    drift: 1,
                    missingLoop: 1,
                    activeFlows: 1,
                  },
                },
                healed: {
                  entries: [],
                  totals: {
                    totalProfiles: 2,
                    changed: 1,
                    unchanged: 1,
                    loopCreated: 1,
                    loopUpdated: 0,
                    flowStarted: 1,
                    flowRestarted: 0,
                  },
                },
                governanceReconciled: {
                  observedAt: Date.now(),
                  charterDir: "/tmp/governance/charter",
                  requestedAgentIds: ["founder"],
                  eligibleAgentIds: ["founder"],
                  findingIds: ["capability_inventory.demo_gap"],
                  mode: "apply_safe",
                  synthesized: {
                    observedAt: Date.now(),
                    charterDir: "/tmp/governance/charter",
                    requestedAgentIds: ["founder"],
                    eligibleAgentIds: ["founder"],
                    findingIds: ["capability_inventory.demo_gap"],
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
                capabilityInventory: {
                  observedAt: Date.now(),
                  charterDir: "/tmp/governance/charter",
                  workspaceDirs: ["/tmp/requested-workspace"],
                  requestedAgentIds: ["beta"],
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
                    criticalGapCount: 1,
                    warningGapCount: 0,
                    infoGapCount: 0,
                  },
                  entries: [],
                  gaps: [
                    {
                      id: "capability_inventory.demo_gap",
                      severity: "critical",
                      title: "Demo capability gap",
                      detail: "Governed capability coverage is incomplete.",
                      relatedEntryIds: [],
                      suggestedActions: ["bootstrap governed asset"],
                    },
                  ],
                },
                genesisPlan: {
                  observedAt: Date.now(),
                  charterDir: "/tmp/governance/charter",
                  workspaceDirs: ["/tmp/requested-workspace"],
                  primaryWorkspaceDir: "/tmp/requested-workspace",
                  requestedAgentIds: ["beta"],
                  teamId: "genesis_team",
                  teamTitle: "Genesis Team",
                  mode: "repair",
                  blockers: ["missing genesis role: qa"],
                  focusGapIds: ["capability_inventory.demo_gap"],
                  stages: [
                    {
                      id: "genesis.qa",
                      title: "Genesis QA",
                      ownerAgentId: "qa",
                      status: "blocked",
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
                  changedProfiles: 1,
                  healthyProfiles: 2,
                  driftProfiles: 0,
                  missingLoopProfiles: 0,
                  activeFlows: 2,
                  governanceCreatedCount: 1,
                  governanceAppliedCount: 1,
                  governancePendingCount: 0,
                  capabilityGapCount: 1,
                  criticalCapabilityGapCount: 1,
                  genesisStageCount: 1,
                  genesisBlockedStageCount: 1,
                  recommendedNextActions: ["assign genesis qa"],
                },
              } as never,
            },
            governanceBusy: false,
            governanceError: null,
            governanceResult: {
              observedAt: Date.now(),
              charterDir: "/tmp/governance/charter",
              requestedAgentIds: [],
              eligibleAgentIds: ["founder", "strategist"],
              findingIds: ["governance.charter.constitution_missing"],
              results: [
                {
                  ruleId: "constitution-bootstrap",
                  findingIds: ["governance.charter.constitution_missing"],
                  title: "Bootstrap charter constitution",
                  status: "created",
                  rationale: "Recover missing constitution artifact",
                  operations: [
                    {
                      kind: "write",
                      path: "governance/charter/constitution.yaml",
                      content: "version: 1",
                    },
                  ],
                  dedupeKey: "constitution-bootstrap:write",
                  proposalId: "proposal-1",
                  proposalStatus: "pending",
                },
              ],
              createdCount: 1,
              existingCount: 0,
              skippedCount: 0,
            },
            governanceReconcileBusy: false,
            governanceReconcileError: null,
            governanceReconcileResult: null,
            reconcileBusy: false,
            reconcileError: null,
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(container.textContent).toContain("Autonomy");
    expect(container.textContent).toContain("Autonomy Fleet");
    expect(container.textContent).toContain("Fleet Supervisor");
    expect(container.textContent).toContain("Recommended Next Actions");
    expect(container.textContent).toContain("assign genesis qa");
    expect(container.textContent).toContain("Workspace Scope");
    expect(container.textContent).toContain("Fix 0 Drifted Loops");
    expect(container.textContent).toContain("Start 1 Missing Flow");
    expect(container.textContent).toContain("Capability Inventory");
    expect(container.textContent).toContain("Memory");
    expect(container.textContent).toContain("Strategy");
    expect(container.textContent).toContain("Algorithm");
    expect(container.textContent).toContain("Genesis Plan");
    expect(container.textContent).toContain("Governance Proposals");
    expect(container.textContent).toContain("Autonomy History");
    expect(container.textContent).toContain("History Mode");
    expect(container.textContent).toContain("History Source");
    expect(container.textContent).toContain("Result Limit");
    expect(container.textContent).toContain("Mode Filter");
    expect(container.textContent).toContain("No governed skill assets were discovered");
    expect(container.textContent).toContain("Sentinel Detection");
    expect(container.textContent).toContain("Synthesize Proposals");
    expect(container.textContent).toContain("Bootstrap charter constitution");
    expect(container.textContent).toContain("Heal Fleet");
    expect(container.textContent).toContain("Reconcile Core Loops");
    expect(container.textContent).toContain("Autonomy Loop");
    expect(container.textContent).toContain("Latest Managed Flow");
    expect(container.textContent).toContain("Sandbox Replay Gate");
    expect(container.textContent).toContain("Submit Replay Verdict");
    expect(container.textContent).toContain("Execution Runtime Projection");
    expect(container.textContent).toContain("Sandbox Universe");
    expect(container.textContent).toContain("Persisted Evidence");
    expect(container.textContent).toContain("State Ledger");
    expect(container.textContent).toContain("Artifact Dir");
    expect(container.textContent).toContain("Evidence Ledger");
    expect(container.textContent).toContain("sandbox candidate assembled");
    expect(container.textContent).toContain("1234567890ab");
    expect(container.textContent).toContain("Replay Runner");
    expect(container.textContent).toContain("critical capability gaps block governed execution");
    expect(container.textContent).toContain("Scan evolution posture.");
    expect(container.textContent).toContain("Queue Proposal");
    expect(container.textContent).toContain("Apply Governance");
    expect(container.textContent).toContain("/tmp/fleet-workspace");
    expect(container.textContent).toContain("/tmp/fleet-founder");
    expect(container.textContent).toContain("/tmp/flow-workspace");
    expect(container.textContent).toContain("/tmp/autonomy-state/governance/sandbox-universe/demo/state.json");
    expect(container.textContent).toContain("/tmp/autonomy-state/governance/sandbox-universe/demo/artifacts");
    expect(container.textContent).toContain("/tmp/loop-workspace");
    expect(container.textContent).toContain("/tmp/history-workspace");
    expect(container.textContent).toContain("/tmp/history-entry-workspace");
    expect(container.textContent).toContain("/tmp/requested-workspace");
    expect(container.textContent).toContain("/tmp/secondary-workspace");
    const startFlowButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (entry) => entry.textContent?.trim() === "Start Flow",
    );
    startFlowButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runSuggestedAction).toHaveBeenCalledTimes(1);
    expect(runSuggestedAction.mock.calls[0]?.[0]).toMatchObject({
      agentId: "founder",
      suggestedAction: "start_flow",
    });
    const batchStartButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (entry) => entry.textContent?.trim() === "Start 1 Missing Flow",
    );
    batchStartButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runSuggestedActionBatch).toHaveBeenCalledTimes(1);
    expect(runSuggestedActionBatch).toHaveBeenCalledWith("start_flow");
    const superviseButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((entry) => entry.textContent?.trim() === "Supervise Fleet");
    superviseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(superviseFleet).toHaveBeenCalledTimes(1);
    const idleKv = Array.from(container.querySelectorAll<HTMLElement>(".agent-kv")).find(
      (entry) => entry.querySelector(".label")?.textContent?.trim() === "Idle",
    );
    expect(idleKv?.textContent).toContain("0");
    expect(idleKv?.textContent).not.toContain("n/a");
  });

  it("renders the governance panel proposal workflow", async () => {
    const container = document.createElement("div");
    const synthesizeGap = vi.fn();
    const useInventoryScope = vi.fn();
    const approveVisible = vi.fn();
    const loadSynthesisDraft = vi.fn();
    render(
      renderAgents(
        createProps({
          activePanel: "governance",
          onGovernanceProposalSynthesize: synthesizeGap,
          onGovernanceScopeUseCapabilities: useInventoryScope,
          onGovernanceProposalApproveVisible: approveVisible,
          onGovernanceProposalLoadSynthesisDraft: loadSynthesisDraft,
          governance: {
            overviewLoading: false,
            overviewError: null,
            overviewResult: {
              discovered: true,
              observedAt: Date.now(),
              organization: {
                agentCount: 2,
                teamCount: 1,
              },
              enforcement: {
                active: true,
                reasonCode: "freeze_without_auditor",
                message: "Freeze is active until reviewed.",
                denyTools: ["fs.write"],
              },
              documents: {
                constitution: { exists: true },
                sovereigntyPolicy: { exists: true },
                evolutionPolicy: { exists: true },
              },
              missingArtifactPaths: [],
              reservedAuthorities: ["human-architect"],
              freezeTargets: ["governance/charter"],
              findings: [
                {
                  severity: "warn",
                  checkId: "governance.charter.freeze_without_auditor",
                  title: "Freeze without auditor",
                  detail: "The sovereignty auditor role is missing.",
                },
              ],
              proposals: {
                storageDir: "/tmp/state/governance/proposals",
                total: 2,
                pending: 1,
                approved: 1,
                rejected: 0,
                applied: 0,
                latestUpdatedAt: Date.now(),
              },
            } as never,
            assetRegistryLoading: false,
            assetRegistryError: null,
            assetRegistryResult: {
              observedAt: Date.now(),
              charterDir: "/tmp/governance/charter",
              workspaceDirs: ["/tmp/governance-workspace"],
              requestedAgentIds: ["beta"],
              currentAssetCount: 1,
              snapshot: {
                charterDir: "/tmp/governance/charter",
                relativePath: "capability/asset-registry.yaml",
                filePath: "/tmp/governance/charter/capability/asset-registry.yaml",
                exists: true,
              },
              desiredRegistry: {
                version: 1,
                registry: {
                  id: "capability_asset_registry",
                  title: "Governed Capability Asset Registry",
                  status: "active",
                  observedAt: Date.now(),
                },
                assets: [
                  {
                    id: "skill:/tmp/governance-workspace:demo-skill",
                    kind: "skill",
                    status: "ready",
                    title: "demo-skill",
                    coverage: ["skill_key:demo-skill"],
                    dependencies: [],
                    issues: [],
                    installOptions: [],
                  },
                  {
                    id: "memory:organizational_charter",
                    kind: "memory",
                    status: "attention",
                    title: "Organizational Charter",
                    coverage: ["memory:organizational_charter"],
                    dependencies: [],
                    issues: ["refresh index"],
                    installOptions: [],
                  },
                  {
                    id: "strategy:evolution_policy",
                    kind: "strategy",
                    status: "ready",
                    title: "Evolution Policy",
                    coverage: ["strategy:evolution_policy"],
                    dependencies: [],
                    issues: [],
                    installOptions: [],
                  },
                  {
                    id: "algorithm:sandbox_controller",
                    kind: "algorithm",
                    status: "blocked",
                    title: "Sandbox Controller",
                    coverage: ["algorithm:sandbox_controller"],
                    dependencies: [],
                    issues: ["await replay evidence"],
                    installOptions: [],
                  },
                ],
              },
              assetCount: 4,
              missingAssetIds: [],
              staleAssetIds: [],
              driftedAssetIds: ["skill:/tmp/governance-workspace:demo-skill"],
              hasChanges: true,
            } as never,
            capabilitiesLoading: false,
            capabilitiesError: null,
            capabilitiesResult: {
              observedAt: Date.now(),
              charterDir: "/tmp/governance/charter",
              workspaceDirs: ["/tmp/governance-workspace"],
              requestedAgentIds: ["beta"],
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
                memoryCount: 1,
                memoryReady: 0,
                memoryAttention: 1,
                memoryBlocked: 0,
                strategyCount: 1,
                strategyReady: 1,
                strategyAttention: 0,
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
                criticalGapCount: 1,
                warningGapCount: 0,
                infoGapCount: 0,
              },
              entries: [
                {
                  id: "agent_blueprint:beta",
                  kind: "agent_blueprint",
                  status: "ready",
                  title: "Beta Blueprint",
                  ownerAgentId: "beta",
                  coverage: ["governance"],
                  dependencies: [],
                  issues: [],
                  installOptions: [],
                },
              ],
              gaps: [
                {
                  id: "capability_inventory.demo_gap",
                  severity: "critical",
                  title: "Demo capability gap",
                  detail: "Governed capability coverage is incomplete.",
                  ownerAgentId: "beta",
                  relatedEntryIds: ["agent_blueprint:beta"],
                  suggestedActions: ["bootstrap governed asset"],
                },
              ],
            } as never,
            genesisLoading: false,
            genesisError: null,
            genesisResult: {
              observedAt: Date.now(),
              charterDir: "/tmp/governance/charter",
              workspaceDirs: ["/tmp/governance-workspace"],
              primaryWorkspaceDir: "/tmp/governance-workspace",
              requestedAgentIds: ["beta"],
              teamId: "genesis_team",
              teamTitle: "Genesis Team",
              mode: "repair",
              blockers: ["missing genesis roles: qa"],
              focusGapIds: ["capability_inventory.demo_gap"],
              stages: [
                {
                  id: "genesis.gap_detection",
                  title: "Sentinel Detection",
                  ownerAgentId: "sentinel",
                  status: "ready",
                  goal: "Detect governed gaps.",
                  dependsOn: [],
                  inputRefs: [],
                  outputRefs: ["gap_signal"],
                  actions: ["detect and rank the demo capability gap"],
                },
              ],
            } as never,
            agentLoading: false,
            agentError: null,
            agentResult: {
              agentId: "beta",
              observedAt: Date.now(),
              contract: {
                charterDeclared: true,
                authorityLevel: "strategic",
                freezeActive: true,
                collaborators: ["founder"],
                mutationAllow: ["skills"],
                mutationDeny: ["governance/charter"],
                effectiveToolDeny: ["fs.write"],
                runtimeHooks: ["autonomy"],
              },
              runtimeProfile: {
                executionContract: "governed",
                requireAgentId: true,
              },
              blueprint: {
                title: "Beta",
                missionPrimary: "Protect governance posture.",
                layer: "governance",
                status: "active",
                sourcePath: "governance/charter/agents/beta.yaml",
                canDecide: ["proposal review"],
                cannotDecide: ["constitution rewrite"],
              },
            } as never,
            teamLoading: false,
            teamError: null,
            teamResult: {
              observedAt: Date.now(),
              teamId: "genesis_team",
              declared: true,
              blueprint: {
                title: "Genesis Team",
                missionPrimary: "Coordinate governed delivery.",
                status: "active",
                sourcePath: "governance/charter/teams/genesis_team.yaml",
              },
              members: [
                {
                  agentId: "beta",
                  blueprint: {
                    title: "Beta",
                    missionPrimary: "Protect governance posture.",
                  },
                  contract: {
                    charterDeclared: true,
                    authorityLevel: "strategic",
                    freezeActive: true,
                    collaborators: ["founder"],
                    mutationAllow: ["skills"],
                    mutationDeny: ["governance/charter"],
                    effectiveToolDeny: ["fs.write"],
                    runtimeHooks: ["autonomy"],
                  },
                  runtimeSnapshot: {
                    executionContract: "governed",
                    requireAgentId: true,
                  },
                },
                {
                  agentId: "founder",
                  contract: {
                    charterDeclared: true,
                    authorityLevel: "founder",
                    freezeActive: false,
                    collaborators: ["beta"],
                    mutationAllow: ["agents", "skills"],
                    mutationDeny: [],
                    effectiveToolDeny: ["shell.rm"],
                    runtimeHooks: ["autonomy", "policy"],
                  },
                },
              ],
              declaredMemberIds: ["beta", "founder", "sentinel"],
              missingMemberIds: ["sentinel"],
              runtimeHookCoverage: {
                coveredHookIds: ["autonomy"],
                missingHookIds: ["policy"],
                uncoveredMemberIds: ["founder"],
                coveredCount: 1,
                totalCount: 2,
                ratio: 0.5,
              },
              effectiveToolDeny: ["fs.write", "shell.rm"],
              mutationAllow: ["agents", "skills"],
              mutationDeny: ["governance/charter"],
              freezeActiveMemberIds: ["beta"],
            } as never,
            proposalsLoading: false,
            proposalsError: null,
            proposalsResult: {
              storageDir: "/tmp/state/governance/proposals",
              summary: {
                total: 3,
                pending: 1,
                approved: 1,
                rejected: 0,
                applied: 1,
                latestCreatedAt: Date.now(),
                latestUpdatedAt: Date.now(),
              },
              proposals: [
                {
                  id: "proposal-pending",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  createdByAgentId: "founder",
                  title: "Bootstrap charter constitution",
                  rationale: "Recover missing constitution artifact",
                  status: "pending",
                  operations: [
                    {
                      kind: "write",
                      path: "governance/charter/constitution.yaml",
                      content: "version: 1",
                    },
                  ],
                },
                {
                  id: "proposal-approved",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  createdByAgentId: "strategist",
                  title: "Restore sovereignty auditor",
                  status: "approved",
                  operations: [
                    {
                      kind: "write",
                      path: "governance/charter/agents/sovereignty-auditor.yaml",
                      content: "id: sovereignty-auditor",
                    },
                  ],
                  review: {
                    decision: "approve",
                    decidedAt: Date.now(),
                    decidedBy: "human-architect",
                  },
                },
                {
                  id: "proposal-applied",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  createdByAgentId: "founder",
                  title: "Update founder charter",
                  status: "applied",
                  operations: [
                    {
                      kind: "write",
                      path: "governance/charter/agents/founder.yaml",
                      content: "id: founder",
                    },
                  ],
                  apply: {
                    appliedAt: Date.now(),
                    appliedBy: "human-architect",
                    writtenPaths: ["governance/charter/agents/founder.yaml"],
                    ledgerPath: "/tmp/state/governance/applies/proposal-applied.json",
                  },
                },
              ],
            } as never,
            proposalSynthesizeBusy: false,
            proposalSynthesizeError: null,
            proposalSynthesizeResult: {
              observedAt: Date.now(),
              charterDir: "/tmp/governance/charter",
              requestedAgentIds: ["beta", "founder"],
              eligibleAgentIds: ["beta", "founder"],
              findingIds: ["capability_inventory.demo_gap"],
              results: [
                {
                  ruleId: "bootstrap-governed-asset-registry",
                  findingIds: ["capability_inventory.demo_gap"],
                  title: "Bootstrap governed asset registry",
                  status: "created",
                  rationale: "Close the governed capability gap.",
                  operations: [
                    {
                      kind: "write",
                      path: "governance/charter/capability/asset-registry.yaml",
                      content: "version: 1",
                    },
                  ],
                  dedupeKey: "bootstrap-governed-asset-registry:write",
                  proposalId: "proposal-synthesized",
                  proposalStatus: "pending",
                },
              ],
              createdCount: 1,
              existingCount: 0,
              skippedCount: 0,
            } as never,
            proposalReconcileBusy: false,
            proposalReconcileError: null,
            proposalReconcileResult: null,
            proposalCreateBusy: false,
            proposalCreateError: null,
            proposalCreateResult: {
              storageDir: "/tmp/state/governance/proposals",
              proposal: {
                id: "proposal-created",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdByAgentId: "beta",
                createdBySessionKey: "agent:beta:main",
                title: "Create beta charter",
                rationale: "Seed a controlled charter mutation.",
                status: "pending",
                operations: [
                  {
                    kind: "write",
                    path: "agents/beta.yaml",
                    content: "version: 1",
                  },
                ],
              },
            } as never,
            proposalActionBusyId: null,
            proposalActionError: null,
          },
          governanceDraft: {
            scopeAgentIds: "beta\nfounder",
            scopeWorkspaceDirs: "/tmp/governance-workspace\n/tmp/governance-workspace-b",
            scopeTeamId: "genesis_team",
            proposalLimit: "15",
            operator: "human-architect",
            decisionNote: "safe change",
            statusFilter: "pending",
            reconcileMode: "apply_safe",
            createTitle: "Create beta charter",
            createRationale: "Seed a controlled charter mutation.",
            createAgentId: "beta",
            createSessionKey: "agent:beta:main",
            createOperationsJson:
              '[\n  {\n    "kind": "write",\n    "path": "governance/charter/agents/beta.yaml",\n    "content": "version: 1"\n  }\n]',
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(container.textContent).toContain("Governance Control Plane");
    expect(container.textContent).toContain("Team Charter");
    expect(container.textContent).toContain("Team Profile");
    expect(container.textContent).toContain("Capability Inventory");
    expect(container.textContent).toContain("Governed Knowledge Assets");
    expect(container.textContent).toContain("Organizational Charter");
    expect(container.textContent).toContain("Sandbox Controller");
    expect(container.textContent).toContain("Genesis Plan");
    expect(container.textContent).toContain("Missing Members");
    expect(container.textContent).toContain("Runtime Hook Coverage");
    expect(container.textContent).toContain("genesis_team");
    expect(container.textContent).toContain("sentinel");
    expect(container.textContent).toContain("Demo capability gap");
    expect(container.textContent).toContain("Sentinel Detection");
    expect(container.textContent).toContain("Governance Proposals");
    expect(container.textContent).toContain("Synthesize Gap");
    expect(container.textContent).toContain("Reconcile Gap");
    expect(container.textContent).toContain("Governance Workbench Scope");
    expect(container.textContent).toContain("Use Inventory Scope");
    expect(container.textContent).toContain("Use Genesis Scope");
    expect(container.textContent).toContain("Clear Scope");
    expect(container.textContent).toContain("Approve Visible (1)");
    expect(container.textContent).toContain("Apply Visible (1)");
    expect(container.textContent).toContain("Revert Visible (1)");
    expect(container.textContent).toContain("Agent Scope");
    expect(container.textContent).toContain("Workspace Scope");
    expect(container.textContent).toContain("Genesis Team ID");
    expect(container.textContent).toContain("Result Limit");
    expect(container.textContent).toContain("Proposal Workbench");
    expect(container.textContent).toContain("Create Proposal");
    expect(container.textContent).toContain("Draft Preview");
    expect(container.textContent).toContain("Refresh Proposals");
    expect(container.textContent).toContain("Synthesize All Gaps (1)");
    expect(container.textContent).toContain("Reconcile All Gaps");
    expect(container.textContent).toContain("Load Draft");
    expect(container.textContent).toContain("Bootstrap charter constitution");
    expect(container.textContent).toContain("Restore sovereignty auditor");
    expect(container.textContent).toContain("Update founder charter");
    expect(container.textContent).toContain("Created proposal proposal-created");
    expect(container.textContent).toContain("agents/beta.yaml");
    expect(container.textContent).toContain("Approve");
    expect(container.textContent).toContain("Apply");
    expect(container.textContent).toContain("Revert");
    expect(container.textContent).toContain("Agent Charter");
    const synthesizeGapButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((entry) => entry.textContent?.trim() === "Synthesize Gap");
    synthesizeGapButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(synthesizeGap).toHaveBeenCalledTimes(1);
    const useInventoryScopeButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((entry) => entry.textContent?.trim() === "Use Inventory Scope");
    useInventoryScopeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(useInventoryScope).toHaveBeenCalledTimes(1);
    const approveVisibleButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((entry) => entry.textContent?.trim() === "Approve Visible (1)");
    approveVisibleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(approveVisible).toHaveBeenCalledTimes(1);
    const loadDraftButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((entry) => entry.textContent?.trim() === "Load Draft");
    loadDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(loadSynthesisDraft).toHaveBeenCalledTimes(1);
  });
});
