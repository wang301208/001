import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { createOpenClawCodingTools } from "./pi-tools.js";
import type { AnyAgentTool } from "./tools/common.js";
import type { AgentGovernanceRuntimeContract } from "../governance/runtime-contract.js";
import type { AgentToolGovernanceSummary } from "../governance/tool-governance-summary.js";

function mockTool(params: {
  name: string;
  label: string;
  description: string;
  displaySummary?: string;
}): AnyAgentTool {
  return {
    ...params,
    parameters: { type: "object", properties: {} },
    execute: async () => ({ text: params.description }),
  } as unknown as AnyAgentTool;
}

function createGovernanceSummary(
  overrides: Partial<AgentToolGovernanceSummary> = {},
): AgentToolGovernanceSummary {
  return {
    charterDeclared: false,
    charterContractValid: true,
    charterContractIssues: [],
    charterToolDeny: [],
    charterRequireAgentId: false,
    charterElevatedLocked: false,
    freezeActive: false,
    freezeDeny: [],
    freezeDetails: [],
    activeSovereigntyIncidentCount: 0,
    activeSovereigntyIncidentIds: [],
    activeSovereigntyFreezeIncidentIds: [],
    ...overrides,
  };
}

function createGovernanceContract(
  overrides: Partial<AgentGovernanceRuntimeContract> = {},
): AgentGovernanceRuntimeContract {
  return {
    agentId: "main",
    charterDeclared: false,
    charterContractValid: true,
    charterContractIssues: [],
    collaborators: [],
    reportsTo: [],
    mutationAllow: [],
    mutationDeny: [],
    networkConditions: [],
    runtimeHooks: [],
    charterToolDeny: [],
    charterRequireAgentId: false,
    charterElevatedLocked: false,
    freezeActive: false,
    freezeDeny: [],
    freezeDetails: [],
    activeSovereigntyIncidentCount: 0,
    activeSovereigntyIncidentIds: [],
    activeSovereigntyFreezeIncidentIds: [],
    effectiveToolDeny: [],
    ...overrides,
  };
}

const effectiveInventoryState = vi.hoisted(() => ({
  tools: [
    mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
    mockTool({ name: "docs_lookup", label: "Docs Lookup", description: "Search docs" }),
  ] as AnyAgentTool[],
  pluginMeta: {} as Record<string, { pluginId: string } | undefined>,
  channelMeta: {} as Record<string, { channelId: string } | undefined>,
  effectivePolicy: {} as { profile?: string; providerProfile?: string },
  governance: createGovernanceSummary(),
  governanceContract: createGovernanceContract(),
  resolvedModelCompat: undefined as Record<string, unknown> | undefined,
  createToolsMock: vi.fn<typeof createOpenClawCodingTools>(
    (_options) =>
      [
        mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
        mockTool({ name: "docs_lookup", label: "Docs Lookup", description: "Search docs" }),
      ] as AnyAgentTool[],
  ),
}));

vi.mock("./agent-scope.js", async () => {
  const actual = await vi.importActual<typeof import("./agent-scope.js")>("./agent-scope.js");
  return {
    ...actual,
    resolveSessionAgentId: () => "main",
    resolveAgentWorkspaceDir: () => "/tmp/workspace-main",
    resolveAgentDir: () => "/tmp/agents/main/agent",
  };
});

vi.mock("./pi-tools.js", () => ({
  createOpenClawCodingTools: (options?: Parameters<typeof createOpenClawCodingTools>[0]) =>
    effectiveInventoryState.createToolsMock(options),
}));

vi.mock("./pi-embedded-runner/model.js", () => ({
  resolveModel: vi.fn(() => ({
    model: effectiveInventoryState.resolvedModelCompat
      ? { compat: effectiveInventoryState.resolvedModelCompat }
      : undefined,
    authStorage: {} as never,
    modelRegistry: {} as never,
  })),
}));

vi.mock("../plugins/tools.js", () => ({
  getPluginToolMeta: (tool: { name: string }) => effectiveInventoryState.pluginMeta[tool.name],
}));

vi.mock("./channel-tools.js", () => ({
  getChannelAgentToolMeta: (tool: { name: string }) =>
    effectiveInventoryState.channelMeta[tool.name],
}));

vi.mock("./pi-tools.policy.js", () => ({
  resolveEffectiveToolPolicy: () => effectiveInventoryState.effectivePolicy,
}));

vi.mock("../governance/tool-governance-summary.js", async () => {
  const actual = await vi.importActual<typeof import("../governance/tool-governance-summary.js")>(
    "../governance/tool-governance-summary.js",
  );
  return {
    ...actual,
    resolveAgentToolGovernanceSummary: () => effectiveInventoryState.governance,
  };
});

vi.mock("../governance/runtime-contract.js", async () => {
  const actual = await vi.importActual<typeof import("../governance/runtime-contract.js")>(
    "../governance/runtime-contract.js",
  );
  return {
    ...actual,
    resolveAgentGovernanceRuntimeContract: () => effectiveInventoryState.governanceContract,
  };
});

let resolveEffectiveToolInventory: typeof import("./tools-effective-inventory.js").resolveEffectiveToolInventory;

async function loadHarness(options?: {
  tools?: AnyAgentTool[];
  createToolsMock?: typeof effectiveInventoryState.createToolsMock;
  pluginMeta?: Record<string, { pluginId: string } | undefined>;
  channelMeta?: Record<string, { channelId: string } | undefined>;
  effectivePolicy?: { profile?: string; providerProfile?: string };
  governance?: AgentToolGovernanceSummary;
  governanceContract?: AgentGovernanceRuntimeContract;
  resolvedModelCompat?: Record<string, unknown>;
}) {
  effectiveInventoryState.tools = options?.tools ?? [
    mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
    mockTool({ name: "docs_lookup", label: "Docs Lookup", description: "Search docs" }),
  ];
  effectiveInventoryState.pluginMeta = options?.pluginMeta ?? {};
  effectiveInventoryState.channelMeta = options?.channelMeta ?? {};
  effectiveInventoryState.effectivePolicy = options?.effectivePolicy ?? {};
  effectiveInventoryState.governance = options?.governance ?? createGovernanceSummary();
  effectiveInventoryState.governanceContract =
    options?.governanceContract ?? createGovernanceContract();
  effectiveInventoryState.resolvedModelCompat = options?.resolvedModelCompat;
  effectiveInventoryState.createToolsMock =
    options?.createToolsMock ??
    vi.fn<typeof createOpenClawCodingTools>((_options) => effectiveInventoryState.tools);
  return {
    resolveEffectiveToolInventory,
    createToolsMock: effectiveInventoryState.createToolsMock,
  };
}

describe("resolveEffectiveToolInventory", () => {
  beforeAll(async () => {
    ({ resolveEffectiveToolInventory } = await import("./tools-effective-inventory.js"));
  });

  beforeEach(() => {
    effectiveInventoryState.tools = [
      mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
      mockTool({ name: "docs_lookup", label: "Docs Lookup", description: "Search docs" }),
    ];
    effectiveInventoryState.pluginMeta = {};
    effectiveInventoryState.channelMeta = {};
    effectiveInventoryState.effectivePolicy = {};
    effectiveInventoryState.governance = createGovernanceSummary();
    effectiveInventoryState.governanceContract = createGovernanceContract();
    effectiveInventoryState.resolvedModelCompat = undefined;
    effectiveInventoryState.createToolsMock = vi.fn<typeof createOpenClawCodingTools>(
      (_options) => effectiveInventoryState.tools,
    );
  });

  it("groups core, plugin, and channel tools from the effective runtime set", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      tools: [
        mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
        mockTool({ name: "docs_lookup", label: "Docs Lookup", description: "Search docs" }),
        mockTool({
          name: "message_actions",
          label: "Message Actions",
          description: "Act on messages",
        }),
      ],
      pluginMeta: { docs_lookup: { pluginId: "docs" } },
      channelMeta: { message_actions: { channelId: "telegram" } },
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });

    expect(result).toEqual({
      agentId: "main",
      profile: "full",
      governance: createGovernanceSummary(),
      governanceContract: createGovernanceContract(),
      groups: [
        {
          id: "core",
          label: "Built-in tools",
          source: "core",
          tools: [
            {
              id: "exec",
              label: "Exec",
              description: "Run shell commands",
              rawDescription: "Run shell commands",
              source: "core",
            },
          ],
        },
        {
          id: "plugin",
          label: "Connected tools",
          source: "plugin",
          tools: [
            {
              id: "docs_lookup",
              label: "Docs Lookup",
              description: "Search docs",
              rawDescription: "Search docs",
              source: "plugin",
              pluginId: "docs",
            },
          ],
        },
        {
          id: "channel",
          label: "Channel tools",
          source: "channel",
          tools: [
            {
              id: "message_actions",
              label: "Message Actions",
              description: "Act on messages",
              rawDescription: "Act on messages",
              source: "channel",
              channelId: "telegram",
            },
          ],
        },
      ],
    });
  });

  it("disambiguates duplicate labels with source ids", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      tools: [
        mockTool({ name: "docs_lookup", label: "Lookup", description: "Search docs" }),
        mockTool({ name: "jira_lookup", label: "Lookup", description: "Search Jira" }),
      ],
      pluginMeta: {
        docs_lookup: { pluginId: "docs" },
        jira_lookup: { pluginId: "jira" },
      },
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });
    const labels = result.groups.flatMap((group) => group.tools.map((tool) => tool.label));

    expect(labels).toEqual(["Lookup (docs)", "Lookup (jira)"]);
  });

  it("prefers displaySummary over raw description", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      tools: [
        mockTool({
          name: "cron",
          label: "Cron",
          displaySummary: "Schedule and manage cron jobs.",
          description: "Long raw description\n\nACTIONS:\n- status",
        }),
      ],
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });

    expect(result.groups[0]?.tools[0]).toEqual({
      id: "cron",
      label: "Cron",
      description: "Schedule and manage cron jobs.",
      rawDescription: "Long raw description\n\nACTIONS:\n- status",
      source: "core",
    });
  });

  it("falls back to a sanitized summary for multi-line raw descriptions", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      tools: [
        mockTool({
          name: "cron",
          label: "Cron",
          description:
            'Manage Gateway cron jobs (status/list/add/update/remove/run/runs) and send wake events. Use this for reminders, "check back later" requests, delayed follow-ups, and recurring tasks. Do not emulate scheduling with exec sleep or process polling.\n\nACTIONS:\n- status: Check cron scheduler status\nJOB SCHEMA:\n{ ... }',
        }),
      ],
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });

    const description = result.groups[0]?.tools[0]?.description ?? "";
    expect(description).toContain(
      "Manage Gateway cron jobs (status/list/add/update/remove/run/runs) and send wake events.",
    );
    expect(description).toContain("Use this for reminders");
    expect(description.endsWith("...")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(120);
    expect(result.groups[0]?.tools[0]?.rawDescription).toContain("ACTIONS:");
  });

  it("includes the resolved tool profile", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      tools: [mockTool({ name: "exec", label: "Exec", description: "Run shell commands" })],
      effectivePolicy: { profile: "minimal", providerProfile: "coding" },
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });

    expect(result.profile).toBe("coding");
  });

  it("includes governance summary for the current agent", async () => {
    const { resolveEffectiveToolInventory } = await loadHarness({
      governance: {
        ...createGovernanceSummary(),
        charterDeclared: true,
        charterTitle: "Founder",
        charterLayer: "evolution",
        charterToolDeny: ["web_fetch", "web_search"],
        charterRequireAgentId: true,
        charterExecutionContract: "strict-agentic",
        charterElevatedLocked: true,
        freezeActive: true,
        freezeReasonCode: "network_boundary_opened",
        freezeDeny: ["exec", "write"],
        freezeDetails: ["gateway.bind=lan"],
      },
      governanceContract: createGovernanceContract({
        agentId: "main",
        charterDeclared: true,
        charterTitle: "Founder",
        charterLayer: "evolution",
        charterToolDeny: ["web_fetch", "web_search"],
        charterRequireAgentId: true,
        charterExecutionContract: "strict-agentic",
        charterElevatedLocked: true,
        freezeActive: true,
        freezeReasonCode: "network_boundary_opened",
        freezeDeny: ["exec", "write"],
        freezeDetails: ["gateway.bind=lan"],
        effectiveToolDeny: ["exec", "web_fetch", "web_search", "write"],
      }),
    });

    const result = resolveEffectiveToolInventory({ cfg: {} });

    expect(result.governance).toEqual({
      ...createGovernanceSummary(),
      charterDeclared: true,
      charterTitle: "Founder",
      charterLayer: "evolution",
      charterToolDeny: ["web_fetch", "web_search"],
      charterRequireAgentId: true,
      charterExecutionContract: "strict-agentic",
      charterElevatedLocked: true,
      freezeActive: true,
      freezeReasonCode: "network_boundary_opened",
      freezeDeny: ["exec", "write"],
      freezeDetails: ["gateway.bind=lan"],
    });
    expect(result.governanceContract).toEqual(
      createGovernanceContract({
        agentId: "main",
        charterDeclared: true,
        charterTitle: "Founder",
        charterLayer: "evolution",
        charterToolDeny: ["web_fetch", "web_search"],
        charterRequireAgentId: true,
        charterExecutionContract: "strict-agentic",
        charterElevatedLocked: true,
        freezeActive: true,
        freezeReasonCode: "network_boundary_opened",
        freezeDeny: ["exec", "write"],
        freezeDetails: ["gateway.bind=lan"],
        effectiveToolDeny: ["exec", "web_fetch", "web_search", "write"],
      }),
    );
  });

  it("passes resolved model compat into effective tool creation", async () => {
    const createToolsMock = vi.fn<typeof createOpenClawCodingTools>(() => [
      mockTool({ name: "exec", label: "Exec", description: "Run shell commands" }),
    ]);
    const { resolveEffectiveToolInventory } = await loadHarness({
      createToolsMock,
      resolvedModelCompat: { supportsTools: true, supportsNativeWebSearch: true },
    });

    resolveEffectiveToolInventory({
      cfg: {},
      agentDir: "/tmp/agents/main/agent",
      modelProvider: "xai",
      modelId: "grok-test",
    });

    expect(createToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowGatewaySubagentBinding: true,
        modelCompat: { supportsTools: true, supportsNativeWebSearch: true },
      }),
    );
  });
});
