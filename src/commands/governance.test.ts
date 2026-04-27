import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  getGovernanceOverview: vi.fn(),
  getGovernanceAgent: vi.fn(),
  getGovernanceTeam: vi.fn(),
  getGovernanceCapabilityInventory: vi.fn(),
  getGovernanceCapabilityAssetRegistry: vi.fn(),
  getGovernanceGenesisPlan: vi.fn(),
  synthesizeGovernanceProposals: vi.fn(),
  reconcileGovernanceProposals: vi.fn(),
  listGovernanceProposals: vi.fn(),
  createGovernanceProposal: vi.fn(),
  reviewGovernanceProposal: vi.fn(),
  reviewGovernanceProposals: vi.fn(),
  applyGovernanceProposal: vi.fn(),
  applyGovernanceProposals: vi.fn(),
  revertGovernanceProposalApply: vi.fn(),
  revertGovernanceProposalApplies: vi.fn(),
  normalizeAgentId: vi.fn((value?: string) => (value ?? "").trim().toLowerCase()),
}));

vi.mock("../governance/control-plane.js", () => ({
  getGovernanceOverview: mocks.getGovernanceOverview,
  getGovernanceAgent: mocks.getGovernanceAgent,
  getGovernanceTeam: mocks.getGovernanceTeam,
  getGovernanceCapabilityInventory: mocks.getGovernanceCapabilityInventory,
  getGovernanceCapabilityAssetRegistry: mocks.getGovernanceCapabilityAssetRegistry,
  getGovernanceGenesisPlan: mocks.getGovernanceGenesisPlan,
  synthesizeGovernanceProposals: mocks.synthesizeGovernanceProposals,
  reconcileGovernanceProposals: mocks.reconcileGovernanceProposals,
}));

vi.mock("../governance/proposals.js", () => ({
  listGovernanceProposals: mocks.listGovernanceProposals,
  createGovernanceProposal: mocks.createGovernanceProposal,
  reviewGovernanceProposal: mocks.reviewGovernanceProposal,
  reviewGovernanceProposals: mocks.reviewGovernanceProposals,
  applyGovernanceProposal: mocks.applyGovernanceProposal,
  applyGovernanceProposals: mocks.applyGovernanceProposals,
  revertGovernanceProposalApply: mocks.revertGovernanceProposalApply,
  revertGovernanceProposalApplies: mocks.revertGovernanceProposalApplies,
}));

vi.mock("../routing/session-key.js", () => ({
  normalizeAgentId: mocks.normalizeAgentId,
}));

vi.mock("../terminal/theme.js", () => ({
  theme: {
    info: (value: string) => value,
  },
}));

import {
  governanceCapabilityAssetRegistryCommand,
  governanceCapabilityInventoryCommand,
} from "./governance.js";

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

describe("governance commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints knowledge-asset counts for governance capability inventory", async () => {
    mocks.getGovernanceCapabilityInventory.mockReturnValue({
      observedAt: 1,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/a", "/tmp/b"],
      requestedAgentIds: ["founder"],
      summary: {
        totalEntries: 5,
        skillCount: 1,
        skillReady: 1,
        skillAttention: 0,
        skillBlocked: 0,
        pluginCount: 1,
        pluginActivated: 1,
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
        autonomyProfileCount: 3,
        genesisMemberCount: 6,
        gapCount: 2,
        criticalGapCount: 1,
        warningGapCount: 1,
        infoGapCount: 0,
      },
      entries: [],
      gaps: [],
    });

    const { runtime, logs } = createRuntime();
    await governanceCapabilityInventoryCommand(
      {
        agentIds: ["founder"],
        workspaceDirs: [" /tmp/b ", "/tmp/a", "/tmp/b"],
      },
      runtime,
    );

    expect(mocks.getGovernanceCapabilityInventory).toHaveBeenCalledWith({
      agentIds: ["founder"],
      workspaceDirs: ["/tmp/a", "/tmp/b"],
    });
    expect(logs.join("\n")).toContain("memory=1");
    expect(logs.join("\n")).toContain("strategy=1");
    expect(logs.join("\n")).toContain("algorithm=1");
    expect(logs.join("\n")).toContain("autonomyProfiles=3");
    expect(logs.join("\n")).toContain("genesisMembers=6");
    expect(logs.join("\n")).toContain("algorithmBlocked=1");
  });

  it("prints registry asset-kind and status summaries", async () => {
    mocks.getGovernanceCapabilityAssetRegistry.mockReturnValue({
      observedAt: 1,
      charterDir: "/tmp/governance/charter",
      workspaceDirs: ["/tmp/a"],
      requestedAgentIds: ["founder"],
      currentAssetCount: 2,
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
          observedAt: 1,
        },
        assets: [
          {
            id: "skill:demo",
            kind: "skill",
            status: "ready",
            title: "Demo Skill",
            coverage: [],
            dependencies: [],
            issues: [],
            installOptions: [],
          },
          {
            id: "memory:charter",
            kind: "memory",
            status: "attention",
            title: "Charter Memory",
            coverage: [],
            dependencies: [],
            issues: ["refresh indexing"],
            installOptions: [],
          },
          {
            id: "strategy:evolution",
            kind: "strategy",
            status: "ready",
            title: "Evolution Strategy",
            coverage: [],
            dependencies: [],
            issues: [],
            installOptions: [],
          },
          {
            id: "algorithm:sandbox",
            kind: "algorithm",
            status: "blocked",
            title: "Sandbox Algorithm",
            coverage: [],
            dependencies: [],
            issues: ["missing replay evidence"],
            installOptions: [],
          },
        ],
      },
      assetCount: 4,
      missingAssetIds: ["strategy:evolution"],
      staleAssetIds: [],
      driftedAssetIds: ["algorithm:sandbox"],
      hasChanges: true,
    });

    const { runtime, logs } = createRuntime();
    await governanceCapabilityAssetRegistryCommand(
      {
        agentIds: ["founder"],
        workspaceDirs: ["/tmp/a"],
      },
      runtime,
    );

    expect(logs.join("\n")).toContain("assetKinds: skills=1, plugins=0, memory=1, strategy=1, algorithm=1");
    expect(logs.join("\n")).toContain("assetStatuses: ready=2, attention=1, blocked=1");
    expect(logs.join("\n")).toContain("drifted=1");
  });
});
