import { describe, expect, it, vi } from "vitest";
import {
  applyGovernanceProposalEntry,
  applyGovernanceProposalEntries,
  buildGovernanceProposalOperationsDraftTemplate,
  createGovernanceProposalEntry,
  formatGovernanceAgentIdsDraft,
  formatGovernanceWorkspaceDirsDraft,
  loadGovernanceCapabilityAssetRegistry,
  loadGovernanceCapabilityInventory,
  loadGovernanceGenesisPlan,
  loadGovernanceProposals,
  loadGovernanceTeam,
  parseGovernanceAgentIdsDraft,
  parseGovernanceListLimitDraft,
  parseGovernanceProposalOperationsDraft,
  parseGovernanceWorkspaceDirsDraft,
  reconcileGovernanceProposals,
  revertGovernanceProposalEntries,
  revertGovernanceProposalEntry,
  reviewGovernanceProposalEntries,
  reviewGovernanceProposalEntry,
  synthesizeGovernanceProposals,
  type GovernanceState,
} from "./governance.ts";
import { GatewayRequestError } from "../gateway.ts";

function createProposal(status: "pending" | "approved" | "rejected" | "applied") {
  return {
    id: "proposal-1",
    createdAt: 1,
    updatedAt: 2,
    createdByAgentId: "founder",
    createdBySessionKey: "agent:founder:main",
    title: "Bootstrap charter constitution",
    rationale: "Recover missing constitution artifact",
    status,
    operations: [
      {
        kind: "write",
        path: "governance/charter/constitution.yaml",
        content: "version: 1",
      },
    ],
  };
}

function createProposalList(status: "pending" | "approved" | "rejected" | "applied") {
  const proposal = createProposal(status);
  return {
    storageDir: "/tmp/state/governance/proposals",
    summary: {
      total: 1,
      pending: status === "pending" ? 1 : 0,
      approved: status === "approved" ? 1 : 0,
      rejected: status === "rejected" ? 1 : 0,
      applied: status === "applied" ? 1 : 0,
      latestCreatedAt: 1,
      latestUpdatedAt: 2,
    },
    proposals: [proposal],
  };
}

function createCapabilityInventory() {
  return {
    observedAt: 2,
    charterDir: "/tmp/governance/charter",
    workspaceDirs: ["/tmp/workspace-a"],
    requestedAgentIds: ["founder"],
    summary: {
      totalEntries: 2,
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
        title: "Demo gap",
        detail: "Need governed capability coverage.",
        ownerAgentId: "founder",
        relatedEntryIds: [],
        suggestedActions: ["bootstrap governed capability"],
      },
    ],
  };
}

function createAssetRegistryResult() {
  return {
    observedAt: 2,
    charterDir: "/tmp/governance/charter",
    workspaceDirs: ["/tmp/workspace-a"],
    requestedAgentIds: ["founder"],
    currentAssetCount: 1,
    snapshot: {
      charterDir: "/tmp/governance/charter",
      relativePath: "capability/asset-registry.yaml",
      filePath: "/tmp/governance/charter/capability/asset-registry.yaml",
      exists: true,
    },
    desiredRegistry: {
      version: 1 as const,
      registry: {
        id: "capability_asset_registry" as const,
        title: "Governed Capability Asset Registry",
        status: "active" as const,
        observedAt: 2,
      },
      assets: [
        {
          id: "skill:/tmp/workspace-a:demo-skill",
          kind: "skill" as const,
          status: "ready" as const,
          title: "demo-skill",
          coverage: ["skill_key:demo-skill"],
          dependencies: [],
          issues: [],
          installOptions: [],
        },
      ],
    },
    assetCount: 1,
    missingAssetIds: [],
    staleAssetIds: [],
    driftedAssetIds: ["skill:/tmp/workspace-a:demo-skill"],
    hasChanges: true,
  };
}

function createGenesisPlan() {
  return {
    observedAt: 2,
    charterDir: "/tmp/governance/charter",
    workspaceDirs: ["/tmp/workspace-a"],
    primaryWorkspaceDir: "/tmp/workspace-a",
    requestedAgentIds: ["founder"],
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
        goal: "Rank the governed gaps.",
        dependsOn: [],
        inputRefs: [],
        outputRefs: ["gap_signal"],
        actions: ["detect and rank the demo gap"],
      },
    ],
  };
}

function createTeamResult() {
  return {
    observedAt: 2,
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
        agentId: "founder",
        contract: {
          charterDeclared: true,
          authorityLevel: "founder",
          freezeActive: false,
          collaborators: ["strategist"],
          mutationAllow: ["agents"],
          mutationDeny: ["constitution"],
          effectiveToolDeny: ["shell.rm"],
          runtimeHooks: ["policy"],
        },
      },
    ],
    declaredMemberIds: ["founder", "strategist"],
    missingMemberIds: ["strategist"],
    runtimeHookCoverage: {
      coveredHookIds: ["policy"],
      missingHookIds: ["autonomy"],
      coveredCount: 1,
      totalCount: 2,
      ratio: 0.5,
    },
    effectiveToolDeny: ["shell.rm"],
    mutationAllow: ["agents"],
    mutationDeny: ["constitution"],
    freezeActiveMemberIds: [],
  };
}

function createProposalSynthesisResult() {
  return {
    observedAt: 6,
    charterDir: "/tmp/governance/charter",
    requestedAgentIds: ["founder", "strategist"],
    eligibleAgentIds: ["founder", "strategist"],
    findingIds: ["governance.charter.freeze_without_auditor"],
    results: [
      {
        ruleId: "attach_sovereignty_auditor",
        findingIds: ["governance.charter.freeze_without_auditor"],
        title: "Attach sovereignty auditor artifact to the constitution",
        status: "created" as const,
        dedupeKey: "dedupe-1",
        proposalId: "proposal-2",
        proposalStatus: "pending" as const,
        operations: [
          {
            kind: "write" as const,
            path: "constitution.yaml",
            content: "version: 1",
          },
        ],
      },
    ],
    createdCount: 1,
    existingCount: 0,
    skippedCount: 0,
  };
}

function createProposalReconcileResult() {
  return {
    observedAt: 7,
    charterDir: "/tmp/governance/charter",
    requestedAgentIds: ["founder", "strategist"],
    eligibleAgentIds: ["founder", "strategist"],
    findingIds: ["governance.charter.freeze_without_auditor"],
    mode: "apply_safe" as const,
    synthesized: createProposalSynthesisResult(),
    entries: [
      {
        ruleId: "attach_sovereignty_auditor",
        title: "Attach sovereignty auditor artifact to the constitution",
        findingIds: ["governance.charter.freeze_without_auditor"],
        operations: [
          {
            kind: "write" as const,
            path: "constitution.yaml",
            content: "version: 1",
          },
        ],
        synthesisStatus: "created" as const,
        proposalId: "proposal-2",
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

function createState(): { state: GovernanceState; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const state: GovernanceState = {
    client: {
      request,
    } as never,
    connected: true,
    governanceOverviewLoading: false,
    governanceOverviewError: null,
    governanceOverviewResult: null,
    governanceAssetRegistryLoading: false,
    governanceAssetRegistryLoadingKey: null,
    governanceAssetRegistryError: null,
    governanceAssetRegistryResult: null,
    governanceCapabilitiesLoading: false,
    governanceCapabilitiesLoadingKey: null,
    governanceCapabilitiesError: null,
    governanceCapabilitiesResult: null,
    governanceGenesisLoading: false,
    governanceGenesisLoadingKey: null,
    governanceGenesisError: null,
    governanceGenesisResult: null,
    governanceAgentLoading: false,
    governanceAgentLoadingId: null,
    governanceAgentError: null,
    governanceAgentResult: null,
    governanceTeamLoading: false,
    governanceTeamLoadingId: null,
    governanceTeamError: null,
    governanceTeamResult: null,
    governanceProposalsLoading: false,
    governanceProposalsLoadingKey: null,
    governanceProposalsResultKey: null,
    governanceProposalsError: null,
    governanceProposalsResult: null,
    governanceProposalSynthesizeBusy: false,
    governanceProposalSynthesizeError: null,
    governanceProposalSynthesizeResult: null,
    governanceProposalReconcileBusy: false,
    governanceProposalReconcileError: null,
    governanceProposalReconcileResult: null,
    governanceProposalCreateBusy: false,
    governanceProposalCreateError: null,
    governanceProposalCreateResult: null,
    governanceProposalActionBusyId: null,
    governanceProposalActionError: null,
    agentsSelectedId: "founder",
    agentsPanel: "governance",
  };
  return { state, request };
}

describe("governance controller", () => {
  it("parses proposal draft JSON and normalizes governance charter paths", () => {
    expect(
      parseGovernanceProposalOperationsDraft(
        JSON.stringify({
          operations: [
            {
              kind: "write",
              path: "governance/charter/agents/founder.yaml",
              content: "version: 1",
            },
            {
              kind: "delete",
              path: "policies/legacy.yaml",
            },
          ],
        }),
      ),
    ).toEqual([
      {
        kind: "write",
        path: "agents/founder.yaml",
        content: "version: 1",
      },
      {
        kind: "delete",
        path: "policies/legacy.yaml",
      },
    ]);

    expect(buildGovernanceProposalOperationsDraftTemplate("founder")).toContain(
      '"path": "agents/founder.yaml"',
    );
    expect(parseGovernanceAgentIdsDraft(" founder , strategist\nfounder ")).toEqual([
      "founder",
      "strategist",
    ]);
    expect(formatGovernanceAgentIdsDraft(["strategist", " founder "])).toBe(
      "founder\nstrategist",
    );
    expect(parseGovernanceWorkspaceDirsDraft(" /tmp/b \n/tmp/a,/tmp/b ")).toEqual([
      "/tmp/a",
      "/tmp/b",
    ]);
    expect(formatGovernanceWorkspaceDirsDraft(["/tmp/b", " /tmp/a "])).toBe("/tmp/a\n/tmp/b");
    expect(parseGovernanceListLimitDraft(" 25 ")).toBe(25);
    expect(parseGovernanceListLimitDraft("0")).toBeUndefined();
  });

  it("loads governance proposals with filters", async () => {
    const { state, request } = createState();
    request.mockResolvedValue(createProposalList("pending"));

    await loadGovernanceProposals(state, {
      status: "pending",
      limit: 20,
    });

    expect(request).toHaveBeenCalledWith("governance.proposals.list", {
      status: "pending",
      limit: 20,
    });
    expect(state.governanceProposalsResult?.summary.pending).toBe(1);
    expect(state.governanceProposalsError).toBeNull();
  });

  it("loads governance capability inventory for the selected scope", async () => {
    const { state, request } = createState();
    request.mockResolvedValue(createCapabilityInventory());

    await loadGovernanceCapabilityInventory(state, {
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace-a"],
    });

    expect(request).toHaveBeenCalledWith("governance.capability.inventory", {
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace-a"],
    });
    expect(state.governanceCapabilitiesResult?.summary.criticalGapCount).toBe(1);
    expect(state.governanceCapabilitiesError).toBeNull();
  });

  it("loads governance capability asset registry for the selected scope", async () => {
    const { state, request } = createState();
    request.mockResolvedValue(createAssetRegistryResult());

    await loadGovernanceCapabilityAssetRegistry(state, {
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace-a"],
    });

    expect(request).toHaveBeenCalledWith("governance.capability.assetRegistry", {
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/workspace-a"],
    });
    expect(state.governanceAssetRegistryResult?.assetCount).toBe(1);
    expect(state.governanceAssetRegistryError).toBeNull();
  });

  it("loads governance genesis plan for the selected scope", async () => {
    const { state, request } = createState();
    request.mockResolvedValue(createGenesisPlan());

    await loadGovernanceGenesisPlan(state, {
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a"],
    });

    expect(request).toHaveBeenCalledWith("governance.genesis.plan", {
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a"],
    });
    expect(state.governanceGenesisResult?.teamId).toBe("genesis_team");
    expect(state.governanceGenesisError).toBeNull();
  });

  it("loads governance team for the selected scope", async () => {
    const { state, request } = createState();
    request.mockResolvedValue(createTeamResult());

    await loadGovernanceTeam(state, {
      teamId: "genesis_team",
    });

    expect(request).toHaveBeenCalledWith("governance.team", {
      teamId: "genesis_team",
    });
    expect(state.governanceTeamResult?.teamId).toBe("genesis_team");
    expect(state.governanceTeamError).toBeNull();
  });

  it("ignores stale governance proposal responses when filters change mid-flight", async () => {
    const { state, request } = createState();
    let resolvePending: ((value: unknown) => void) | undefined;
    let resolveApproved: ((value: unknown) => void) | undefined;

    request
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePending = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveApproved = resolve;
          }),
      );

    const pendingLoad = loadGovernanceProposals(state, {
      status: "pending",
    });
    const approvedLoad = loadGovernanceProposals(state, {
      status: "approved",
    });

    resolveApproved?.(createProposalList("approved"));
    await approvedLoad;

    resolvePending?.(createProposalList("pending"));
    await pendingLoad;

    expect(state.governanceProposalsResult?.summary.approved).toBe(1);
    expect(state.governanceProposalsResult?.summary.pending).toBe(0);
    expect(state.governanceProposalsResultKey).toBe("approved:default");
    expect(state.governanceProposalsLoading).toBe(false);
  });

  it("ignores stale governance team responses when team scope changes mid-flight", async () => {
    const { state, request } = createState();
    let resolveGenesisTeam: ((value: unknown) => void) | undefined;
    let resolveOpsTeam: ((value: unknown) => void) | undefined;

    request
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGenesisTeam = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOpsTeam = resolve;
          }),
      );

    const firstLoad = loadGovernanceTeam(state, {
      teamId: "genesis_team",
    });
    const secondLoad = loadGovernanceTeam(state, {
      teamId: "ops_team",
    });

    resolveOpsTeam?.({
      ...createTeamResult(),
      teamId: "ops_team",
    });
    await secondLoad;

    resolveGenesisTeam?.(createTeamResult());
    await firstLoad;

    expect(state.governanceTeamResult?.teamId).toBe("ops_team");
    expect(state.governanceTeamLoading).toBe(false);
  });

  it("creates a proposal and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        proposal: createProposal("pending"),
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 3,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
        enforcement: {
          active: false,
          denyTools: [],
        },
        proposals: {
          storageDir: "/tmp/state/governance/proposals",
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          applied: 0,
          latestUpdatedAt: 3,
        },
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("pending"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 3,
      });

    await createGovernanceProposalEntry(state, {
      title: "Bootstrap charter constitution",
      rationale: "Recover missing constitution artifact",
      createdByAgentId: "founder",
      createdBySessionKey: "agent:founder:main",
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
      status: "pending",
      limit: 12,
      operations: [
        {
          kind: "write",
          path: "governance/charter/agents/founder.yaml",
          content: "version: 1",
        },
      ],
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.create", {
      title: "Bootstrap charter constitution",
      rationale: "Recover missing constitution artifact",
      createdByAgentId: "founder",
      createdBySessionKey: "agent:founder:main",
      operations: [
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: "version: 1",
        },
      ],
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "pending",
      limit: 12,
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalCreateResult?.proposal.id).toBe("proposal-1");
    expect(state.governanceProposalCreateError).toBeNull();
  });

  it("synthesizes proposals and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce(createProposalSynthesisResult())
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 6,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
        enforcement: {
          active: false,
          denyTools: [],
        },
        proposals: {
          storageDir: "/tmp/state/governance/proposals",
          total: 2,
          pending: 2,
          approved: 0,
          rejected: 0,
          applied: 0,
          latestUpdatedAt: 6,
        },
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("pending"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 6,
      });

    await synthesizeGovernanceProposals(state, {
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
      status: "pending",
      limit: 12,
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.synthesize", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "pending",
      limit: 12,
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalSynthesizeResult?.createdCount).toBe(1);
    expect(state.governanceProposalSynthesizeError).toBeNull();
  });

  it("reconciles synthesized proposals and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce(createProposalReconcileResult())
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 7,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
        enforcement: {
          active: false,
          denyTools: [],
        },
        proposals: {
          storageDir: "/tmp/state/governance/proposals",
          total: 2,
          pending: 0,
          approved: 0,
          rejected: 0,
          applied: 2,
          latestUpdatedAt: 7,
        },
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("applied"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 7,
      });

    await reconcileGovernanceProposals(state, {
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
      status: "applied",
      limit: 12,
      mode: "apply_safe",
      createdByAgentId: "human-architect",
      createdBySessionKey: "agent:human-architect:main",
      decidedBy: "human-architect",
      decisionNote: "safe auto-apply",
      appliedBy: "human-architect",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.reconcile", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
      mode: "apply_safe",
      createdByAgentId: "human-architect",
      createdBySessionKey: "agent:human-architect:main",
      decidedBy: "human-architect",
      decisionNote: "safe auto-apply",
      appliedBy: "human-architect",
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder", "strategist"],
      teamId: "genesis_team",
      workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "applied",
      limit: 12,
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalReconcileResult?.appliedCount).toBe(1);
    expect(state.governanceProposalReconcileError).toBeNull();
  });

  it("formats missing operator.control errors for governance control actions", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(
      new GatewayRequestError({
        code: "UNAVAILABLE",
        message: "missing scope: operator.control",
      }),
    );

    await createGovernanceProposalEntry(state, {
      title: "Create charter",
      operations: [
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: "version: 1",
        },
      ],
    });

    expect(state.governanceProposalCreateError).toBe(
      "This connection is missing operator.control, so governance control cannot be changed yet.",
    );
  });

  it("reviews a proposal and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        proposal: {
          ...createProposal("approved"),
          review: {
            decision: "approve",
            decidedAt: 3,
            decidedBy: "human-architect",
          },
        },
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 3,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("approved"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 3,
      });

    await reviewGovernanceProposalEntry(state, {
      proposalId: "proposal-1",
      decision: "approve",
      decidedBy: "human-architect",
      decisionNote: "looks safe",
      status: "approved",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.review", {
      proposalId: "proposal-1",
      decision: "approve",
      decidedBy: "human-architect",
      decisionNote: "looks safe",
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "approved",
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalActionError).toBeNull();
  });

  it("applies an approved proposal and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        charterDir: "/tmp/governance/charter",
        proposal: {
          ...createProposal("applied"),
          apply: {
            appliedAt: 4,
            appliedBy: "human-architect",
            writtenPaths: ["governance/charter/constitution.yaml"],
          },
        },
        writtenPaths: ["governance/charter/constitution.yaml"],
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 4,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("applied"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 4,
      });

    await applyGovernanceProposalEntry(state, {
      proposalId: "proposal-1",
      appliedBy: "human-architect",
      status: "applied",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.apply", {
      proposalId: "proposal-1",
      appliedBy: "human-architect",
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "applied",
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalActionError).toBeNull();
  });

  it("reviews visible proposals in one batch request and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        selection: {
          proposalIds: ["proposal-2", "proposal-1"],
          matchedProposalIds: ["proposal-2", "proposal-1"],
        },
        decision: "approve" as const,
        reviewedCount: 2,
        failedCount: 0,
        stoppedEarly: false,
        entries: [],
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 4,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("approved"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 4,
      });

    await reviewGovernanceProposalEntries(state, {
      proposalIds: [" proposal-2 ", "proposal-1", "proposal-2"],
      decision: "approve",
      decidedBy: "human-architect",
      decisionNote: "ship the safe batch",
      continueOnError: true,
      status: "approved",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.reviewMany", {
      proposalIds: ["proposal-2", "proposal-1"],
      decision: "approve",
      decidedBy: "human-architect",
      decisionNote: "ship the safe batch",
      continueOnError: true,
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "approved",
    });
    expect(state.governanceProposalActionError).toBeNull();
  });

  it("applies visible proposals in one batch request and reports partial failures", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        selection: {
          proposalIds: ["proposal-3", "proposal-4"],
          matchedProposalIds: ["proposal-3", "proposal-4"],
        },
        appliedCount: 1,
        failedCount: 1,
        stoppedEarly: false,
        entries: [],
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 5,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("applied"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 5,
      });

    await applyGovernanceProposalEntries(state, {
      proposalIds: ["proposal-3", "proposal-4"],
      appliedBy: "human-architect",
      continueOnError: true,
      status: "applied",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.applyMany", {
      proposalIds: ["proposal-3", "proposal-4"],
      appliedBy: "human-architect",
      continueOnError: true,
    });
    expect(state.governanceProposalActionError).toContain("1/2 failure");
  });

  it("reverts an applied proposal and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        charterDir: "/tmp/governance/charter",
        ledgerPath: "/tmp/state/governance/applies/proposal-1.json",
        proposal: {
          ...createProposal("approved"),
          apply: {
            appliedAt: 4,
            appliedBy: "human-architect",
            writtenPaths: ["governance/charter/constitution.yaml"],
            ledgerPath: "/tmp/state/governance/applies/proposal-1.json",
            revertedAt: 5,
            revertedBy: "human-architect",
            restoredPaths: ["governance/charter/constitution.yaml"],
          },
        },
        restoredPaths: ["governance/charter/constitution.yaml"],
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 5,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("approved"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 5,
      });

    await revertGovernanceProposalEntry(state, {
      proposalId: "proposal-1",
      revertedBy: "human-architect",
      status: "approved",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.revert", {
      proposalId: "proposal-1",
      revertedBy: "human-architect",
    });
    expect(request).toHaveBeenNthCalledWith(2, "governance.overview", {});
    expect(request).toHaveBeenNthCalledWith(3, "governance.capability.assetRegistry", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(4, "governance.capability.inventory", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(5, "governance.genesis.plan", {
      agentIds: ["founder"],
    });
    expect(request).toHaveBeenNthCalledWith(6, "governance.team", {
      teamId: "genesis_team",
    });
    expect(request).toHaveBeenNthCalledWith(7, "governance.proposals.list", {
      status: "approved",
    });
    expect(request).toHaveBeenNthCalledWith(8, "governance.agent", {
      agentId: "founder",
    });
    expect(state.governanceProposalActionError).toBeNull();
  });

  it("reverts visible proposals in one batch request and refreshes the governance workbench", async () => {
    const { state, request } = createState();
    request
      .mockResolvedValueOnce({
        storageDir: "/tmp/state/governance/proposals",
        selection: {
          proposalIds: ["proposal-7"],
          matchedProposalIds: ["proposal-7"],
        },
        revertedCount: 1,
        failedCount: 0,
        stoppedEarly: false,
        entries: [],
      })
      .mockResolvedValueOnce({
        discovered: true,
        observedAt: 6,
        organization: {
          agentCount: 2,
          teamCount: 1,
        },
        findings: [],
        missingArtifactPaths: [],
        documents: {
          constitution: { exists: true },
          sovereigntyPolicy: { exists: true },
          evolutionPolicy: { exists: true },
        },
        reservedAuthorities: [],
        freezeTargets: [],
      })
      .mockResolvedValueOnce(createAssetRegistryResult())
      .mockResolvedValueOnce(createCapabilityInventory())
      .mockResolvedValueOnce(createGenesisPlan())
      .mockResolvedValueOnce(createTeamResult())
      .mockResolvedValueOnce(createProposalList("approved"))
      .mockResolvedValueOnce({
        agentId: "founder",
        observedAt: 6,
      });

    await revertGovernanceProposalEntries(state, {
      proposalIds: ["proposal-7"],
      revertedBy: "human-architect",
      continueOnError: true,
      status: "approved",
    });

    expect(request).toHaveBeenNthCalledWith(1, "governance.proposals.revertMany", {
      proposalIds: ["proposal-7"],
      revertedBy: "human-architect",
      continueOnError: true,
    });
    expect(state.governanceProposalActionError).toBeNull();
  });
});
