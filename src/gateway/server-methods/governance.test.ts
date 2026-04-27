import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { governanceHandlers } from "./governance.js";

const mocks = vi.hoisted(() => ({
  getGovernanceOverview: vi.fn(),
  getGovernanceAgent: vi.fn(),
  getGovernanceTeam: vi.fn(),
  getGovernanceCapabilityInventory: vi.fn(),
  getGovernanceCapabilityAssetRegistry: vi.fn(),
  getGovernanceGenesisPlan: vi.fn(),
  reconcileGovernanceProposals: vi.fn(),
  synthesizeGovernanceProposals: vi.fn(),
  listGovernanceProposals: vi.fn(),
  createGovernanceProposal: vi.fn(),
  reviewGovernanceProposal: vi.fn(),
  reviewGovernanceProposals: vi.fn(),
  applyGovernanceProposal: vi.fn(),
  applyGovernanceProposals: vi.fn(),
  revertGovernanceProposalApply: vi.fn(),
  revertGovernanceProposalApplies: vi.fn(),
}));

vi.mock("../../governance/control-plane.js", () => ({
  getGovernanceOverview: mocks.getGovernanceOverview,
  getGovernanceAgent: mocks.getGovernanceAgent,
  getGovernanceTeam: mocks.getGovernanceTeam,
  getGovernanceCapabilityInventory: mocks.getGovernanceCapabilityInventory,
  getGovernanceCapabilityAssetRegistry: mocks.getGovernanceCapabilityAssetRegistry,
  getGovernanceGenesisPlan: mocks.getGovernanceGenesisPlan,
  reconcileGovernanceProposals: mocks.reconcileGovernanceProposals,
  synthesizeGovernanceProposals: mocks.synthesizeGovernanceProposals,
}));

vi.mock("../../governance/proposals.js", () => ({
  listGovernanceProposals: mocks.listGovernanceProposals,
  createGovernanceProposal: mocks.createGovernanceProposal,
  reviewGovernanceProposal: mocks.reviewGovernanceProposal,
  reviewGovernanceProposals: mocks.reviewGovernanceProposals,
  applyGovernanceProposal: mocks.applyGovernanceProposal,
  applyGovernanceProposals: mocks.applyGovernanceProposals,
  revertGovernanceProposalApply: mocks.revertGovernanceProposalApply,
  revertGovernanceProposalApplies: mocks.revertGovernanceProposalApplies,
}));

async function invoke(
  method: keyof typeof governanceHandlers,
  params: Record<string, unknown>,
) {
  const respond = vi.fn();
  await governanceHandlers[method]({
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    req: { type: "req", id: "req-1", method },
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("governance handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGovernanceOverview.mockReturnValue({
      observedAt: 1,
      charterDir: "/repo/governance/charter",
      discovered: true,
      proposals: {
        storageDir: "/state/governance/proposals",
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        applied: 0,
      },
      documents: {
        constitution: { path: "/repo/governance/charter/constitution.yaml", exists: true },
        sovereigntyPolicy: {
          path: "/repo/governance/charter/policies/sovereignty.yaml",
          exists: true,
        },
        evolutionPolicy: {
          path: "/repo/governance/charter/policies/evolution-policy.yaml",
          exists: true,
        },
      },
      artifactPaths: [],
      missingArtifactPaths: [],
      reservedAuthorities: [],
      automaticEnforcementActions: [],
      freezeTargets: [],
      enforcement: {
        active: false,
        details: [],
        denyTools: [],
      },
      organization: {
        charterDir: "/repo/governance/charter",
        discovered: true,
        agentCount: 1,
        teamCount: 0,
        agents: [],
        teams: [],
      },
      findings: [],
    });
    mocks.getGovernanceAgent.mockReturnValue({
      observedAt: 1,
      agentId: "founder",
      collaborationPolicy: {
        requesterAgentId: "founder",
        charterDeclared: true,
        collaboratorAgentIds: ["strategist"],
        allowedAgentIds: ["founder", "strategist"],
      },
      contract: {
        agentId: "founder",
        charterDeclared: true,
        collaborators: ["strategist"],
        reportsTo: [],
        mutationAllow: [],
        mutationDeny: [],
        networkConditions: [],
        runtimeHooks: [],
        charterToolDeny: [],
        charterRequireAgentId: true,
        charterElevatedLocked: true,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        effectiveToolDeny: [],
      },
    });
    mocks.getGovernanceTeam.mockReturnValue({
      observedAt: 2,
      teamId: "genesis_team",
      declared: true,
      blueprint: {
        id: "genesis_team",
        title: "Genesis Team",
        layer: "evolution",
        class: "autonomous_build_team",
        status: "active",
        members: ["founder", "strategist"],
        sourcePath: "evolution/genesis-team.yaml",
      },
      members: [
        {
          agentId: "founder",
          blueprint: {
            id: "founder",
            title: "Founder",
            successMetrics: [],
            canObserve: [],
            canDecide: [],
            cannotDecide: [],
            mutationAllow: ["charter_agents"],
            mutationDeny: ["constitution"],
            networkConditions: [],
            worksWith: [],
            reportsTo: [],
            promotionRequirements: [],
            runtimeHooks: ["governance.proposals.*"],
            sourcePath: "agents/founder.yaml",
            declaredCollaborators: [],
          },
          contract: {
            agentId: "founder",
            charterDeclared: true,
            collaborators: [],
            reportsTo: [],
            mutationAllow: ["charter_agents"],
            mutationDeny: ["constitution"],
            networkConditions: [],
            runtimeHooks: ["governance.proposals.*"],
            charterToolDeny: [],
            charterRequireAgentId: true,
            charterElevatedLocked: true,
            freezeActive: false,
            freezeDeny: [],
            freezeDetails: [],
            effectiveToolDeny: [],
          },
        },
      ],
      declaredMemberIds: ["founder", "strategist"],
      missingMemberIds: ["strategist"],
      runtimeHookCoverage: ["governance.proposals.*"],
      effectiveToolDeny: [],
      mutationAllow: ["charter_agents"],
      mutationDeny: ["constitution"],
      freezeActiveMemberIds: [],
    });
    mocks.getGovernanceCapabilityInventory.mockReturnValue({
      observedAt: 2,
      charterDir: "/repo/governance/charter",
      workspaceDirs: ["/repo/workspace-a"],
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
          detail: "Need governed skill coverage.",
          ownerAgentId: "founder",
          relatedEntryIds: [],
          suggestedActions: ["bootstrap demo skill"],
        },
      ],
    });
    mocks.getGovernanceCapabilityAssetRegistry.mockReturnValue({
      observedAt: 2,
      charterDir: "/repo/governance/charter",
      workspaceDirs: ["/repo/workspace-a"],
      requestedAgentIds: ["librarian"],
      currentAssetCount: 1,
      snapshot: {
        charterDir: "/repo/governance/charter",
        relativePath: "capability/asset-registry.yaml",
        filePath: "/repo/governance/charter/capability/asset-registry.yaml",
        exists: true,
      },
      desiredRegistry: {
        version: 1,
        registry: {
          id: "capability_asset_registry",
          title: "Governed Capability Asset Registry",
          status: "active",
          observedAt: 2,
        },
        assets: [
          {
            id: "skill:/repo/workspace-a:demo-skill",
            kind: "skill",
            status: "ready",
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
      driftedAssetIds: ["skill:/repo/workspace-a:demo-skill"],
      hasChanges: true,
    });
    mocks.getGovernanceGenesisPlan.mockReturnValue({
      observedAt: 3,
      charterDir: "/repo/governance/charter",
      workspaceDirs: ["/repo/workspace-a"],
      primaryWorkspaceDir: "/repo/workspace-a",
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
          goal: "Rank governed gaps.",
          dependsOn: [],
          inputRefs: [],
          outputRefs: ["gap_signal"],
          actions: ["detect and rank demo gap"],
        },
      ],
    });
    mocks.listGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      summary: {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        applied: 0,
      },
      proposals: [
        {
          id: "gpr-1",
          createdAt: 1,
          updatedAt: 1,
          title: "Create founder charter",
          status: "pending",
          operations: [
            {
              kind: "write",
              path: "agents/founder.yaml",
              content: "version: 1\n",
            },
          ],
        },
      ],
    });
    mocks.synthesizeGovernanceProposals.mockResolvedValue({
      observedAt: 5,
      charterDir: "/repo/governance/charter",
      requestedAgentIds: ["founder", "strategist"],
      eligibleAgentIds: ["founder", "strategist"],
      findingIds: ["governance.charter.freeze_without_auditor"],
      results: [
        {
          ruleId: "attach_sovereignty_auditor",
          findingIds: ["governance.charter.freeze_without_auditor"],
          title: "Attach sovereignty auditor artifact to the constitution",
          status: "created",
          dedupeKey: "dedupe-1",
          proposalId: "gpr-2",
          proposalStatus: "pending",
          operations: [
            {
              kind: "write",
              path: "constitution.yaml",
              content: "version: 1\n",
            },
          ],
        },
      ],
      createdCount: 1,
      existingCount: 0,
      skippedCount: 0,
    });
    mocks.reconcileGovernanceProposals.mockResolvedValue({
      observedAt: 6,
      charterDir: "/repo/governance/charter",
      requestedAgentIds: ["founder", "librarian"],
      eligibleAgentIds: ["founder", "librarian"],
      findingIds: ["capability_inventory.registry_missing"],
      mode: "apply_safe",
      synthesized: {
        observedAt: 5,
        charterDir: "/repo/governance/charter",
        requestedAgentIds: ["founder", "librarian"],
        eligibleAgentIds: ["founder", "librarian"],
        findingIds: ["capability_inventory.registry_missing"],
        results: [
          {
            ruleId: "bootstrap_capability_asset_registry",
            findingIds: ["capability_inventory.registry_missing"],
            title: "Bootstrap capability asset registry",
            status: "created",
            dedupeKey: "dedupe-2",
            proposalId: "gpr-3",
            proposalStatus: "pending",
            operations: [
              {
                kind: "write",
                path: "capability/asset-registry.yaml",
                content: "version: 1\n",
              },
            ],
          },
        ],
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
    mocks.createGovernanceProposal.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      proposal: {
        id: "gpr-1",
        createdAt: 1,
        updatedAt: 1,
        title: "Create founder charter",
        status: "pending",
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: "version: 1\n",
          },
        ],
      },
    });
    mocks.reviewGovernanceProposal.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      proposal: {
        id: "gpr-1",
        createdAt: 1,
        updatedAt: 2,
        title: "Create founder charter",
        status: "approved",
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: "version: 1\n",
          },
        ],
      },
    });
    mocks.reviewGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        status: "pending",
        matchedProposalIds: ["gpr-1"],
      },
      decision: "approve",
      reviewedCount: 1,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          title: "Create founder charter",
          statusBefore: "pending",
          statusAfter: "approved",
        },
      ],
    });
    mocks.applyGovernanceProposal.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      charterDir: "/repo/governance/charter",
      ledgerPath: "/state/governance/applies/gpr-1.json",
      writtenPaths: ["governance/charter/agents/founder.yaml"],
      proposal: {
        id: "gpr-1",
        createdAt: 1,
        updatedAt: 3,
        title: "Create founder charter",
        status: "applied",
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: "version: 1\n",
          },
        ],
      },
    });
    mocks.applyGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        status: "approved",
        matchedProposalIds: ["gpr-1"],
      },
      appliedCount: 1,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          title: "Create founder charter",
          statusBefore: "approved",
          statusAfter: "applied",
          ledgerPath: "/state/governance/applies/gpr-1.json",
          writtenPaths: ["governance/charter/agents/founder.yaml"],
        },
      ],
    });
    mocks.revertGovernanceProposalApply.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      charterDir: "/repo/governance/charter",
      ledgerPath: "/state/governance/applies/gpr-1.json",
      restoredPaths: ["governance/charter/agents/founder.yaml"],
      proposal: {
        id: "gpr-1",
        createdAt: 1,
        updatedAt: 4,
        title: "Create founder charter",
        status: "approved",
        operations: [
          {
            kind: "write",
            path: "agents/founder.yaml",
            content: "version: 1\n",
          },
        ],
      },
    });
    mocks.revertGovernanceProposalApplies.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        status: "applied",
        matchedProposalIds: ["gpr-1"],
      },
      revertedCount: 1,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          title: "Create founder charter",
          statusBefore: "applied",
          statusAfter: "approved",
          ledgerPath: "/state/governance/applies/gpr-1.json",
          restoredPaths: ["governance/charter/agents/founder.yaml"],
        },
      ],
    });
  });

  it("returns governance overview", async () => {
    const respond = await invoke("governance.overview", {});

    expect(mocks.getGovernanceOverview).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        discovered: true,
        organization: expect.objectContaining({
          agentCount: 1,
        }),
      }),
      undefined,
    );
  });

  it("returns governance agent detail", async () => {
    const respond = await invoke("governance.agent", {
      agentId: "founder",
    });

    expect(mocks.getGovernanceAgent).toHaveBeenCalledWith({
      agentId: "founder",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        agentId: "founder",
      }),
      undefined,
    );
  });

  it("returns governance team detail", async () => {
    const respond = await invoke("governance.team", {
      teamId: "genesis_team",
    });

    expect(mocks.getGovernanceTeam).toHaveBeenCalledWith({
      teamId: "genesis_team",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        teamId: "genesis_team",
        declared: true,
      }),
      undefined,
    );
  });

  it("returns governance capability inventory", async () => {
    const respond = await invoke("governance.capability.inventory", {
      agentIds: ["founder"],
      workspaceDirs: ["/repo/workspace-a"],
    });

    expect(mocks.getGovernanceCapabilityInventory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/repo/workspace-a"],
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        requestedAgentIds: ["founder"],
        summary: expect.objectContaining({
          criticalGapCount: 1,
        }),
      }),
      undefined,
    );
  });

  it("returns governance capability asset registry", async () => {
    const respond = await invoke("governance.capability.assetRegistry", {
      agentIds: ["librarian"],
      workspaceDirs: ["/repo/workspace-a"],
    });

    expect(mocks.getGovernanceCapabilityAssetRegistry).toHaveBeenCalledWith({
      agentIds: ["librarian"],
      workspaceDirs: ["/repo/workspace-a"],
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        requestedAgentIds: ["librarian"],
        assetCount: 1,
        hasChanges: true,
      }),
      undefined,
    );
  });

  it("returns governance genesis plan", async () => {
    const respond = await invoke("governance.genesis.plan", {
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["/repo/workspace-a"],
    });

    expect(mocks.getGovernanceGenesisPlan).toHaveBeenCalledWith({
      agentIds: ["founder"],
      teamId: "genesis_team",
      workspaceDirs: ["/repo/workspace-a"],
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        teamId: "genesis_team",
        mode: "repair",
      }),
      undefined,
    );
  });

  it("lists governance proposals", async () => {
    const respond = await invoke("governance.proposals.list", {
      status: "pending",
      limit: 5,
    });

    expect(mocks.listGovernanceProposals).toHaveBeenCalledWith({
      status: "pending",
      limit: 5,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        summary: expect.objectContaining({
          pending: 1,
        }),
      }),
      undefined,
    );
  });

  it("synthesizes governance proposals", async () => {
    const respond = await invoke("governance.proposals.synthesize", {
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/repo/workspace-a"],
    });

    expect(mocks.synthesizeGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/repo/workspace-a"],
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        requestedAgentIds: ["founder", "strategist"],
        createdCount: 1,
      }),
      undefined,
    );
  });

  it("reconciles governance proposals", async () => {
    const respond = await invoke("governance.proposals.reconcile", {
      agentIds: ["founder", "librarian"],
      workspaceDirs: ["/repo/workspace-a"],
      mode: "apply_safe",
      createdByAgentId: "founder",
      createdBySessionKey: "agent:founder:main",
      decidedBy: "founder",
      decisionNote: "Auto-apply safe governance repairs.",
      appliedBy: "founder",
    });

    expect(mocks.reconcileGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder", "librarian"],
      workspaceDirs: ["/repo/workspace-a"],
      mode: "apply_safe",
      createdByAgentId: "founder",
      createdBySessionKey: "agent:founder:main",
      decidedBy: "founder",
      decisionNote: "Auto-apply safe governance repairs.",
      appliedBy: "founder",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        mode: "apply_safe",
        reviewedCount: 1,
        appliedCount: 1,
        entries: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            autoApplied: true,
          }),
        ],
      }),
      undefined,
    );
  });

  it("creates a governance proposal", async () => {
    const respond = await invoke("governance.proposals.create", {
      title: "Create founder charter",
      createdByAgentId: "founder",
      operations: [
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: "version: 1\n",
        },
      ],
    });

    expect(mocks.createGovernanceProposal).toHaveBeenCalledWith({
      title: "Create founder charter",
      rationale: undefined,
      createdByAgentId: "founder",
      createdBySessionKey: undefined,
      operations: [
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: "version: 1\n",
        },
      ],
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        proposal: expect.objectContaining({
          id: "gpr-1",
        }),
      }),
      undefined,
    );
  });

  it("reviews a governance proposal", async () => {
    const respond = await invoke("governance.proposals.review", {
      proposalId: "gpr-1",
      decision: "approve",
      decidedBy: "architect",
    });

    expect(mocks.reviewGovernanceProposal).toHaveBeenCalledWith({
      proposalId: "gpr-1",
      decision: "approve",
      decidedBy: "architect",
      decisionNote: undefined,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        proposal: expect.objectContaining({
          status: "approved",
        }),
      }),
      undefined,
    );
  });

  it("reviews governance proposals in batch", async () => {
    const respond = await invoke("governance.proposals.reviewMany", {
      status: "pending",
      limit: 3,
      decision: "approve",
      decidedBy: "architect",
      continueOnError: false,
    });

    expect(mocks.reviewGovernanceProposals).toHaveBeenCalledWith({
      status: "pending",
      limit: 3,
      decision: "approve",
      decidedBy: "architect",
      continueOnError: false,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        decision: "approve",
        reviewedCount: 1,
        entries: [
          expect.objectContaining({
            proposalId: "gpr-1",
            statusAfter: "approved",
          }),
        ],
      }),
      undefined,
    );
  });

  it("applies a governance proposal", async () => {
    const respond = await invoke("governance.proposals.apply", {
      proposalId: "gpr-1",
      appliedBy: "architect",
    });

    expect(mocks.applyGovernanceProposal).toHaveBeenCalledWith({
      proposalId: "gpr-1",
      appliedBy: "architect",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        writtenPaths: ["governance/charter/agents/founder.yaml"],
      }),
      undefined,
    );
  });

  it("applies governance proposals in batch", async () => {
    const respond = await invoke("governance.proposals.applyMany", {
      proposalIds: ["gpr-1"],
      appliedBy: "architect",
      continueOnError: false,
    });

    expect(mocks.applyGovernanceProposals).toHaveBeenCalledWith({
      proposalIds: ["gpr-1"],
      appliedBy: "architect",
      continueOnError: false,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        appliedCount: 1,
        entries: [
          expect.objectContaining({
            proposalId: "gpr-1",
            writtenPaths: ["governance/charter/agents/founder.yaml"],
          }),
        ],
      }),
      undefined,
    );
  });

  it("reverts an applied governance proposal", async () => {
    const respond = await invoke("governance.proposals.revert", {
      proposalId: "gpr-1",
      revertedBy: "architect",
    });

    expect(mocks.revertGovernanceProposalApply).toHaveBeenCalledWith({
      proposalId: "gpr-1",
      revertedBy: "architect",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        restoredPaths: ["governance/charter/agents/founder.yaml"],
        ledgerPath: "/state/governance/applies/gpr-1.json",
      }),
      undefined,
    );
  });

  it("reverts applied governance proposals in batch", async () => {
    const respond = await invoke("governance.proposals.revertMany", {
      status: "applied",
      revertedBy: "architect",
      limit: 2,
    });

    expect(mocks.revertGovernanceProposalApplies).toHaveBeenCalledWith({
      status: "applied",
      revertedBy: "architect",
      limit: 2,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        revertedCount: 1,
        entries: [
          expect.objectContaining({
            proposalId: "gpr-1",
            restoredPaths: ["governance/charter/agents/founder.yaml"],
          }),
        ],
      }),
      undefined,
    );
  });

  it("rejects invalid governance.agent params", async () => {
    const respond = await invoke("governance.agent", {});
    const [, , error] = respond.mock.calls[0];

    expect(error?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(mocks.getGovernanceAgent).not.toHaveBeenCalled();
  });

  it("returns invalid request when a governance proposal apply fails on a user error", async () => {
    mocks.applyGovernanceProposal.mockRejectedValueOnce(new Error("proposal must be approved"));

    const respond = await invoke("governance.proposals.apply", {
      proposalId: "gpr-1",
      appliedBy: "architect",
    });
    const [, , error] = respond.mock.calls[0];

    expect(error?.code).toBe(ErrorCodes.INVALID_REQUEST);
  });
});
