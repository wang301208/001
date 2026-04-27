import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGovernanceTool } from "./governance-tool.js";

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

describe("governance tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns governance overview", async () => {
    mocks.getGovernanceOverview.mockReturnValue({
      discovered: true,
      organization: { agentCount: 3 },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-1", {
      action: "overview",
    });

    expect(mocks.getGovernanceOverview).toHaveBeenCalledTimes(1);
    expect(result.details).toEqual({
      action: "overview",
      requesterAgentId: "founder",
      overview: {
        discovered: true,
        organization: { agentCount: 3 },
      },
    });
  });

  it("defaults governance agent lookup to the requester agent id", async () => {
    mocks.getGovernanceAgent.mockReturnValue({
      agentId: "founder",
      contract: {
        charterDeclared: true,
      },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-2", {
      action: "agent",
    });

    expect(mocks.getGovernanceAgent).toHaveBeenCalledWith({
      agentId: "founder",
    });
    expect(result.details).toEqual({
      action: "agent",
      requesterAgentId: "founder",
      agent: {
        agentId: "founder",
        contract: {
          charterDeclared: true,
        },
      },
    });
  });

  it("returns governance capability inventory and defaults workspace scope from the bound tool workspace", async () => {
    mocks.getGovernanceCapabilityInventory.mockReturnValue({
      requestedAgentIds: ["librarian"],
      summary: {
        totalEntries: 4,
        gapCount: 1,
      },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:librarian:main",
      workspaceDir: "/workspace/project",
    }).execute("call-capability", {
      action: "capability_inventory",
      agentIds: ["librarian"],
    });

    expect(mocks.getGovernanceCapabilityInventory).toHaveBeenCalledWith({
      agentIds: ["librarian"],
      workspaceDirs: ["/workspace/project"],
    });
    expect(result.details).toEqual({
      action: "capability_inventory",
      requesterAgentId: "librarian",
      capabilityInventory: {
        requestedAgentIds: ["librarian"],
        summary: {
          totalEntries: 4,
          gapCount: 1,
        },
      },
    });
  });

  it("returns governance capability asset registry and defaults workspace scope from the bound tool workspace", async () => {
    mocks.getGovernanceCapabilityAssetRegistry.mockReturnValue({
      assetCount: 2,
      hasChanges: true,
      driftedAssetIds: ["skill:/workspace/project:demo-skill"],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:librarian:main",
      workspaceDir: "/workspace/project",
    }).execute("call-asset-registry", {
      action: "asset_registry",
      agentIds: ["librarian"],
    });

    expect(mocks.getGovernanceCapabilityAssetRegistry).toHaveBeenCalledWith({
      agentIds: ["librarian"],
      workspaceDirs: ["/workspace/project"],
    });
    expect(result.details).toEqual({
      action: "asset_registry",
      requesterAgentId: "librarian",
      assetRegistry: {
        assetCount: 2,
        hasChanges: true,
        driftedAssetIds: ["skill:/workspace/project:demo-skill"],
      },
    });
  });

  it("returns governance genesis plans with explicit team and workspace scope", async () => {
    mocks.getGovernanceGenesisPlan.mockReturnValue({
      teamId: "genesis",
      mode: "repair",
      blockers: ["missing_skill"],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
      workspaceDir: "/workspace/default",
    }).execute("call-genesis", {
      action: "genesis_plan",
      agentIds: ["founder", "librarian"],
      teamId: "genesis",
      workspaceDirs: ["/workspace/a", "/workspace/b"],
    });

    expect(mocks.getGovernanceGenesisPlan).toHaveBeenCalledWith({
      agentIds: ["founder", "librarian"],
      teamId: "genesis",
      workspaceDirs: ["/workspace/a", "/workspace/b"],
    });
    expect(result.details).toEqual({
      action: "genesis_plan",
      requesterAgentId: "founder",
      genesisPlan: {
        teamId: "genesis",
        mode: "repair",
        blockers: ["missing_skill"],
      },
    });
  });

  it("returns governance team detail", async () => {
    mocks.getGovernanceTeam.mockReturnValue({
      teamId: "genesis_team",
      declared: true,
      members: [{ agentId: "founder" }],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-team", {
      action: "team",
      teamId: "genesis_team",
    });

    expect(mocks.getGovernanceTeam).toHaveBeenCalledWith({
      teamId: "genesis_team",
    });
    expect(result.details).toEqual({
      action: "team",
      requesterAgentId: "founder",
      team: {
        teamId: "genesis_team",
        declared: true,
        members: [{ agentId: "founder" }],
      },
    });
  });

  it("lists governance proposals", async () => {
    mocks.listGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      summary: {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        applied: 0,
      },
      proposals: [],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-3", {
      action: "proposals_list",
      status: "pending",
      limit: 5,
    });

    expect(mocks.listGovernanceProposals).toHaveBeenCalledWith({
      status: "pending",
      limit: 5,
    });
    expect(result.details).toEqual({
      action: "proposals_list",
      requesterAgentId: "founder",
      proposalLedger: {
        storageDir: "/state/governance/proposals",
        summary: {
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          applied: 0,
        },
        proposals: [],
      },
    });
  });

  it("synthesizes governance proposals with scoped agents and workspace defaults", async () => {
    mocks.synthesizeGovernanceProposals.mockResolvedValue({
      requestedAgentIds: ["founder", "strategist"],
      eligibleAgentIds: ["founder", "strategist"],
      createdCount: 1,
      existingCount: 0,
      skippedCount: 0,
      results: [
        {
          ruleId: "attach_sovereignty_auditor",
          status: "created",
          title: "Attach sovereignty auditor artifact to the constitution",
        },
      ],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
      workspaceDir: "/workspace/project",
    }).execute("call-synthesize", {
      action: "proposals_synthesize",
      agentIds: ["founder", "strategist"],
    });

    expect(mocks.synthesizeGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["founder", "strategist"],
      workspaceDirs: ["/workspace/project"],
    });
    expect(result.details).toEqual({
      action: "proposals_synthesize",
      requesterAgentId: "founder",
      proposalSynthesis: {
        requestedAgentIds: ["founder", "strategist"],
        eligibleAgentIds: ["founder", "strategist"],
        createdCount: 1,
        existingCount: 0,
        skippedCount: 0,
        results: [
          {
            ruleId: "attach_sovereignty_auditor",
            status: "created",
            title: "Attach sovereignty auditor artifact to the constitution",
          },
        ],
      },
    });
  });

  it("reconciles governance proposals with scoped agents and workspace defaults", async () => {
    mocks.reconcileGovernanceProposals.mockResolvedValue({
      requestedAgentIds: ["librarian"],
      eligibleAgentIds: ["librarian"],
      findingIds: ["capability_inventory.registry_missing"],
      mode: "apply_safe",
      synthesized: {
        createdCount: 1,
        existingCount: 0,
        skippedCount: 0,
      },
      entries: [
        {
          ruleId: "bootstrap_capability_asset_registry",
          synthesisStatus: "created",
          safe: true,
          autoApproved: true,
          autoApplied: true,
        },
      ],
      reviewedCount: 1,
      appliedCount: 1,
      skippedCount: 0,
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:librarian:main",
      workspaceDir: "/workspace/project",
    }).execute("call-reconcile", {
      action: "proposals_reconcile",
      agentIds: ["librarian"],
      mode: "apply_safe",
      decisionNote: "Auto-apply safe governance repairs.",
    });

    expect(mocks.reconcileGovernanceProposals).toHaveBeenCalledWith({
      agentIds: ["librarian"],
      workspaceDirs: ["/workspace/project"],
      mode: "apply_safe",
      createdByAgentId: "librarian",
      createdBySessionKey: "agent:librarian:main",
      decisionNote: "Auto-apply safe governance repairs.",
    });
    expect(result.details).toEqual({
      action: "proposals_reconcile",
      requesterAgentId: "librarian",
      proposalReconciled: {
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        findingIds: ["capability_inventory.registry_missing"],
        mode: "apply_safe",
        synthesized: {
          createdCount: 1,
          existingCount: 0,
          skippedCount: 0,
        },
        entries: [
          {
            ruleId: "bootstrap_capability_asset_registry",
            synthesisStatus: "created",
            safe: true,
            autoApproved: true,
            autoApplied: true,
          },
        ],
        reviewedCount: 1,
        appliedCount: 1,
        skippedCount: 0,
      },
    });
  });

  it("creates governance proposals with requester defaults", async () => {
    mocks.createGovernanceProposal.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      proposal: {
        id: "gpr-1",
        status: "pending",
      },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-4", {
      action: "proposal_create",
      title: "Create founder charter",
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
      createdBySessionKey: "agent:founder:main",
      operations: [
        {
          kind: "write",
          path: "agents/founder.yaml",
          content: "version: 1\n",
        },
      ],
    });
    expect(result.details).toEqual({
      action: "proposal_create",
      requesterAgentId: "founder",
      proposalCreated: {
        storageDir: "/state/governance/proposals",
        proposal: {
          id: "gpr-1",
          status: "pending",
        },
      },
    });
  });

  it("reviews governance proposals in batch with requester defaults", async () => {
    mocks.reviewGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        status: "pending",
        limit: 2,
        matchedProposalIds: ["gpr-1", "gpr-2"],
      },
      decision: "approve",
      reviewedCount: 2,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          statusBefore: "pending",
          statusAfter: "approved",
        },
        {
          proposalId: "gpr-2",
          ok: true,
          statusBefore: "pending",
          statusAfter: "approved",
        },
      ],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-review-many", {
      action: "proposals_review_many",
      status: "pending",
      limit: 2,
      decision: "approve",
      continueOnError: false,
    });

    expect(mocks.reviewGovernanceProposals).toHaveBeenCalledWith({
      status: "pending",
      limit: 2,
      decision: "approve",
      decidedBy: "founder",
      decidedByType: "agent",
      decisionNote: undefined,
      continueOnError: false,
    });
    expect(result.details).toEqual({
      action: "proposals_review_many",
      requesterAgentId: "founder",
      proposalsReviewed: {
        storageDir: "/state/governance/proposals",
        selection: {
          status: "pending",
          limit: 2,
          matchedProposalIds: ["gpr-1", "gpr-2"],
        },
        decision: "approve",
        reviewedCount: 2,
        failedCount: 0,
        stoppedEarly: false,
        entries: [
          {
            proposalId: "gpr-1",
            ok: true,
            statusBefore: "pending",
            statusAfter: "approved",
          },
          {
            proposalId: "gpr-2",
            ok: true,
            statusBefore: "pending",
            statusAfter: "approved",
          },
        ],
      },
    });
  });

  it("applies governance proposals with requester defaults", async () => {
    mocks.applyGovernanceProposal.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      charterDir: "/repo/governance/charter",
      writtenPaths: ["governance/charter/agents/founder.yaml"],
      proposal: {
        id: "gpr-1",
        status: "applied",
      },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-5", {
      action: "proposal_apply",
      proposalId: "gpr-1",
    });

    expect(mocks.applyGovernanceProposal).toHaveBeenCalledWith({
      proposalId: "gpr-1",
      appliedBy: "founder",
      appliedByType: "agent",
    });
    expect(result.details).toEqual({
      action: "proposal_apply",
      requesterAgentId: "founder",
      proposalApplied: {
        storageDir: "/state/governance/proposals",
        charterDir: "/repo/governance/charter",
        writtenPaths: ["governance/charter/agents/founder.yaml"],
        proposal: {
          id: "gpr-1",
          status: "applied",
        },
      },
    });
  });

  it("applies governance proposals in batch with explicit proposal ids", async () => {
    mocks.applyGovernanceProposals.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        proposalIds: ["gpr-1", "gpr-2"],
        matchedProposalIds: ["gpr-1", "gpr-2"],
      },
      appliedCount: 2,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          statusBefore: "approved",
          statusAfter: "applied",
          writtenPaths: ["governance/charter/agents/founder.yaml"],
        },
        {
          proposalId: "gpr-2",
          ok: true,
          statusBefore: "approved",
          statusAfter: "applied",
          writtenPaths: ["governance/charter/agents/strategist.yaml"],
        },
      ],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-apply-many", {
      action: "proposals_apply_many",
      proposalIds: ["gpr-1", "gpr-2"],
    });

    expect(mocks.applyGovernanceProposals).toHaveBeenCalledWith({
      proposalIds: ["gpr-1", "gpr-2"],
      appliedBy: "founder",
      appliedByType: "agent",
    });
    expect(result.details).toEqual({
      action: "proposals_apply_many",
      requesterAgentId: "founder",
      proposalsApplied: {
        storageDir: "/state/governance/proposals",
        selection: {
          proposalIds: ["gpr-1", "gpr-2"],
          matchedProposalIds: ["gpr-1", "gpr-2"],
        },
        appliedCount: 2,
        failedCount: 0,
        stoppedEarly: false,
        entries: [
          {
            proposalId: "gpr-1",
            ok: true,
            statusBefore: "approved",
            statusAfter: "applied",
            writtenPaths: ["governance/charter/agents/founder.yaml"],
          },
          {
            proposalId: "gpr-2",
            ok: true,
            statusBefore: "approved",
            statusAfter: "applied",
            writtenPaths: ["governance/charter/agents/strategist.yaml"],
          },
        ],
      },
    });
  });

  it("reverts governance proposal applies with requester defaults", async () => {
    mocks.revertGovernanceProposalApply.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      charterDir: "/repo/governance/charter",
      ledgerPath: "/state/governance/applies/gpr-1.json",
      restoredPaths: ["governance/charter/agents/founder.yaml"],
      proposal: {
        id: "gpr-1",
        status: "approved",
      },
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-6", {
      action: "proposal_revert",
      proposalId: "gpr-1",
    });

    expect(mocks.revertGovernanceProposalApply).toHaveBeenCalledWith({
      proposalId: "gpr-1",
      revertedBy: "founder",
    });
    expect(result.details).toEqual({
      action: "proposal_revert",
      requesterAgentId: "founder",
      proposalReverted: {
        storageDir: "/state/governance/proposals",
        charterDir: "/repo/governance/charter",
        ledgerPath: "/state/governance/applies/gpr-1.json",
        restoredPaths: ["governance/charter/agents/founder.yaml"],
        proposal: {
          id: "gpr-1",
          status: "approved",
        },
      },
    });
  });

  it("reverts governance proposal applies in batch with explicit proposal ids", async () => {
    mocks.revertGovernanceProposalApplies.mockResolvedValue({
      storageDir: "/state/governance/proposals",
      selection: {
        proposalIds: ["gpr-1", "gpr-2"],
        matchedProposalIds: ["gpr-1", "gpr-2"],
      },
      revertedCount: 2,
      failedCount: 0,
      stoppedEarly: false,
      entries: [
        {
          proposalId: "gpr-1",
          ok: true,
          statusBefore: "applied",
          statusAfter: "approved",
          restoredPaths: ["governance/charter/agents/founder.yaml"],
        },
        {
          proposalId: "gpr-2",
          ok: true,
          statusBefore: "applied",
          statusAfter: "approved",
          restoredPaths: ["governance/charter/agents/strategist.yaml"],
        },
      ],
    });

    const result = await createGovernanceTool({
      agentSessionKey: "agent:founder:main",
    }).execute("call-revert-many", {
      action: "proposals_revert_many",
      proposalIds: ["gpr-1", "gpr-2"],
    });

    expect(mocks.revertGovernanceProposalApplies).toHaveBeenCalledWith({
      proposalIds: ["gpr-1", "gpr-2"],
      revertedBy: "founder",
    });
    expect(result.details).toEqual({
      action: "proposals_revert_many",
      requesterAgentId: "founder",
      proposalsReverted: {
        storageDir: "/state/governance/proposals",
        selection: {
          proposalIds: ["gpr-1", "gpr-2"],
          matchedProposalIds: ["gpr-1", "gpr-2"],
        },
        revertedCount: 2,
        failedCount: 0,
        stoppedEarly: false,
        entries: [
          {
            proposalId: "gpr-1",
            ok: true,
            statusBefore: "applied",
            statusAfter: "approved",
            restoredPaths: ["governance/charter/agents/founder.yaml"],
          },
          {
            proposalId: "gpr-2",
            ok: true,
            statusBefore: "applied",
            statusAfter: "approved",
            restoredPaths: ["governance/charter/agents/strategist.yaml"],
          },
        ],
      },
    });
  });

  it("requires agentId when no requester session is bound", async () => {
    await expect(
      createGovernanceTool().execute("call-7", {
        action: "agent",
      }),
    ).rejects.toThrow("agentId required");
  });

  it("requires teamId for team lookups", async () => {
    await expect(
      createGovernanceTool().execute("call-8", {
        action: "team",
      }),
    ).rejects.toThrow("teamId required");
  });
});
