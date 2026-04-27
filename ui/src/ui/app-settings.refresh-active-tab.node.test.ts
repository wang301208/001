import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshChatMock: vi.fn(async () => {}),
  scheduleChatScrollMock: vi.fn(),
  scheduleLogsScrollMock: vi.fn(),
  loadAgentFilesMock: vi.fn(async () => {}),
  loadAgentIdentitiesMock: vi.fn(async () => {}),
  loadAgentIdentityMock: vi.fn(async () => {}),
  loadAgentSkillsMock: vi.fn(async () => {}),
  loadAgentsMock: vi.fn(async () => {}),
  loadAutonomyCapabilityInventoryMock: vi.fn(async () => {}),
  loadAutonomyGenesisPlanMock: vi.fn(async () => {}),
  loadAutonomyHistoryMock: vi.fn(async () => {}),
  loadAutonomyOverviewMock: vi.fn(async () => {}),
  loadAutonomyProfileMock: vi.fn(async () => {}),
  loadChannelsMock: vi.fn(async () => {}),
  loadConfigMock: vi.fn(async () => {}),
  loadConfigSchemaMock: vi.fn(async () => {}),
  loadCronStatusMock: vi.fn(async () => {}),
  loadCronJobsPageMock: vi.fn(async () => {}),
  loadCronRunsMock: vi.fn(async () => {}),
  loadGovernanceAgentMock: vi.fn(async () => {}),
  loadGovernanceCapabilityAssetRegistryMock: vi.fn(async () => {}),
  loadGovernanceCapabilityInventoryMock: vi.fn(async () => {}),
  loadGovernanceGenesisPlanMock: vi.fn(async () => {}),
  loadGovernanceOverviewMock: vi.fn(async () => {}),
  loadGovernanceProposalsMock: vi.fn(async () => {}),
  loadGovernanceTeamMock: vi.fn(async () => {}),
  loadLogsMock: vi.fn(async () => {}),
}));

vi.mock("./app-chat.ts", () => ({
  refreshChat: mocks.refreshChatMock,
}));
vi.mock("./app-scroll.ts", () => ({
  scheduleChatScroll: mocks.scheduleChatScrollMock,
  scheduleLogsScroll: mocks.scheduleLogsScrollMock,
}));
vi.mock("./controllers/agent-files.ts", () => ({
  loadAgentFiles: mocks.loadAgentFilesMock,
}));
vi.mock("./controllers/agent-identity.ts", () => ({
  loadAgentIdentities: mocks.loadAgentIdentitiesMock,
  loadAgentIdentity: mocks.loadAgentIdentityMock,
}));
vi.mock("./controllers/agent-skills.ts", () => ({
  loadAgentSkills: mocks.loadAgentSkillsMock,
}));
vi.mock("./controllers/agents.ts", () => ({
  loadAgents: mocks.loadAgentsMock,
}));
vi.mock("./controllers/autonomy.ts", () => ({
  loadAutonomyCapabilityInventory: mocks.loadAutonomyCapabilityInventoryMock,
  loadAutonomyGenesisPlan: mocks.loadAutonomyGenesisPlanMock,
  loadAutonomyHistory: mocks.loadAutonomyHistoryMock,
  loadAutonomyOverview: mocks.loadAutonomyOverviewMock,
  loadAutonomyProfile: mocks.loadAutonomyProfileMock,
  parseAutonomyHistoryLimitDraft: (value?: string | null) => {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  },
  parseAutonomyWorkspaceDirsDraft: (value?: string | null) =>
    Array.from(
      new Set(
        (value ?? "")
          .split(/[,\n]/u)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right)),
}));
vi.mock("./controllers/governance.ts", () => ({
  loadGovernanceAgent: mocks.loadGovernanceAgentMock,
  loadGovernanceCapabilityAssetRegistry: mocks.loadGovernanceCapabilityAssetRegistryMock,
  loadGovernanceCapabilityInventory: mocks.loadGovernanceCapabilityInventoryMock,
  loadGovernanceGenesisPlan: mocks.loadGovernanceGenesisPlanMock,
  loadGovernanceOverview: mocks.loadGovernanceOverviewMock,
  loadGovernanceProposals: mocks.loadGovernanceProposalsMock,
  loadGovernanceTeam: mocks.loadGovernanceTeamMock,
  parseGovernanceAgentIdsDraft: (value?: string | null) =>
    Array.from(
      new Set(
        (value ?? "")
          .split(/[,\n]/u)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right)),
  parseGovernanceWorkspaceDirsDraft: (value?: string | null) =>
    Array.from(
      new Set(
        (value ?? "")
          .split(/[,\n]/u)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right)),
  parseGovernanceListLimitDraft: (value?: string | null) => {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  },
}));
vi.mock("./controllers/channels.ts", () => ({
  loadChannels: mocks.loadChannelsMock,
}));
vi.mock("./controllers/config.ts", () => ({
  loadConfig: mocks.loadConfigMock,
  loadConfigSchema: mocks.loadConfigSchemaMock,
}));
vi.mock("./controllers/cron.ts", () => ({
  loadCronStatus: mocks.loadCronStatusMock,
  loadCronJobsPage: mocks.loadCronJobsPageMock,
  loadCronRuns: mocks.loadCronRunsMock,
}));
vi.mock("./controllers/logs.ts", () => ({
  loadLogs: mocks.loadLogsMock,
}));

import { refreshActiveTab } from "./app-settings.ts";

function createHost() {
  return {
    tab: "agents",
    connected: true,
    client: {},
    agentsPanel: "overview",
    agentsSelectedId: "agent-b",
    agentsList: {
      defaultId: "agent-a",
      agents: [{ id: "agent-a" }, { id: "agent-b" }],
    },
    chatHasAutoScrolled: false,
    logsAtBottom: false,
    eventLog: [],
    eventLogBuffer: [],
    cronRunsScope: "all",
    cronRunsJobId: null as string | null,
    governanceProposalStatusFilter: "",
    governanceProposalLimit: "",
    governanceScopeAgentIds: "",
    governanceScopeWorkspaceDirs: "",
    governanceGenesisTeamId: "",
    sessionKey: "main",
    autonomyWorkspaceScope: "",
    autonomyHistoryMode: "",
    autonomyHistorySource: "",
    autonomyHistoryLimit: "",
  };
}

describe("refreshActiveTab", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) {
      fn.mockReset();
    }
  });

  const expectCommonAgentsTabRefresh = (host: ReturnType<typeof createHost>) => {
    expect(mocks.loadAgentsMock).toHaveBeenCalledOnce();
    expect(mocks.loadConfigMock).toHaveBeenCalledOnce();
    expect(mocks.loadAgentIdentitiesMock).toHaveBeenCalledWith(host, ["agent-a", "agent-b"]);
    expect(mocks.loadAgentIdentityMock).toHaveBeenCalledWith(host, "agent-b");
  };
  const expectNoCronLoaders = () => {
    expect(mocks.loadCronStatusMock).not.toHaveBeenCalled();
    expect(mocks.loadCronJobsPageMock).not.toHaveBeenCalled();
    expect(mocks.loadCronRunsMock).not.toHaveBeenCalled();
  };
  const panelLoaderArgs = {
    files: [mocks.loadAgentFilesMock, "agent-b"],
    skills: [mocks.loadAgentSkillsMock, "agent-b"],
    autonomy: [mocks.loadAutonomyProfileMock, { agentId: "agent-b", sessionKey: "main" }],
    governance: [mocks.loadGovernanceAgentMock, { agentId: "agent-b" }],
    channels: [mocks.loadChannelsMock, false],
    tools: null,
  } as const;

  for (const panel of ["files", "skills", "autonomy", "governance", "channels", "tools"] as const) {
    it(`routes agents ${panel} panel refresh through the expected loaders`, async () => {
      const host = createHost();
      host.agentsPanel = panel;
      if (panel === "autonomy") {
        host.autonomyWorkspaceScope = "/tmp/workspace-a\n/tmp/workspace-b";
        host.autonomyHistoryMode = "heal";
        host.autonomyHistorySource = "manual";
        host.autonomyHistoryLimit = "7";
      }
      if (panel === "governance") {
        host.governanceProposalStatusFilter = "pending";
        host.governanceProposalLimit = "11";
        host.governanceScopeAgentIds = "agent-b\nfounder";
        host.governanceScopeWorkspaceDirs = "/tmp/governance-a\n/tmp/governance-b";
        host.governanceGenesisTeamId = "genesis_team";
      }

      await refreshActiveTab(host as never);

      expectCommonAgentsTabRefresh(host);
      expect(mocks.loadAgentFilesMock).toHaveBeenCalledTimes(panel === "files" ? 1 : 0);
      expect(mocks.loadAgentSkillsMock).toHaveBeenCalledTimes(panel === "skills" ? 1 : 0);
      expect(mocks.loadAutonomyCapabilityInventoryMock).toHaveBeenCalledTimes(
        panel === "autonomy" ? 1 : 0,
      );
      expect(mocks.loadAutonomyGenesisPlanMock).toHaveBeenCalledTimes(
        panel === "autonomy" ? 1 : 0,
      );
      expect(mocks.loadAutonomyHistoryMock).toHaveBeenCalledTimes(panel === "autonomy" ? 1 : 0);
      expect(mocks.loadAutonomyOverviewMock).toHaveBeenCalledTimes(panel === "autonomy" ? 1 : 0);
      expect(mocks.loadAutonomyProfileMock).toHaveBeenCalledTimes(panel === "autonomy" ? 1 : 0);
      expect(mocks.loadGovernanceCapabilityInventoryMock).toHaveBeenCalledTimes(
        panel === "governance" ? 1 : 0,
      );
      expect(mocks.loadGovernanceCapabilityAssetRegistryMock).toHaveBeenCalledTimes(
        panel === "governance" ? 1 : 0,
      );
      expect(mocks.loadGovernanceGenesisPlanMock).toHaveBeenCalledTimes(
        panel === "governance" ? 1 : 0,
      );
      expect(mocks.loadGovernanceAgentMock).toHaveBeenCalledTimes(panel === "governance" ? 1 : 0);
      expect(mocks.loadGovernanceOverviewMock).toHaveBeenCalledTimes(
        panel === "governance" ? 1 : 0,
      );
      expect(mocks.loadGovernanceProposalsMock).toHaveBeenCalledTimes(
        panel === "governance" ? 1 : 0,
      );
      expect(mocks.loadGovernanceTeamMock).toHaveBeenCalledTimes(panel === "governance" ? 2 : 0);
      expect(mocks.loadChannelsMock).toHaveBeenCalledTimes(panel === "channels" ? 1 : 0);
      const expectedLoader = panelLoaderArgs[panel];
      if (expectedLoader) {
        const [loader, expectedArg] = expectedLoader;
        expect(loader).toHaveBeenCalledWith(host, expectedArg);
      }
      if (panel === "autonomy") {
        expect(mocks.loadAutonomyOverviewMock).toHaveBeenCalledWith(host, {
          sessionKey: "main",
          workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
        });
        expect(mocks.loadAutonomyCapabilityInventoryMock).toHaveBeenCalledWith(host, {
          sessionKey: "main",
          workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
        });
        expect(mocks.loadAutonomyGenesisPlanMock).toHaveBeenCalledWith(host, {
          sessionKey: "main",
          workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
        });
        expect(mocks.loadAutonomyHistoryMock).toHaveBeenCalledWith(host, {
          sessionKey: "main",
          workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
          limit: 7,
          mode: "heal",
          source: "manual",
        });
      }
      if (panel === "governance") {
        expect(mocks.loadGovernanceOverviewMock).toHaveBeenCalledWith(host);
        expect(mocks.loadGovernanceCapabilityAssetRegistryMock).toHaveBeenCalledWith(host, {
          agentIds: ["agent-b", "founder"],
          workspaceDirs: ["/tmp/governance-a", "/tmp/governance-b"],
        });
        expect(mocks.loadGovernanceCapabilityInventoryMock).toHaveBeenCalledWith(host, {
          agentIds: ["agent-b", "founder"],
          workspaceDirs: ["/tmp/governance-a", "/tmp/governance-b"],
        });
        expect(mocks.loadGovernanceGenesisPlanMock).toHaveBeenCalledWith(host, {
          agentIds: ["agent-b", "founder"],
          teamId: "genesis_team",
          workspaceDirs: ["/tmp/governance-a", "/tmp/governance-b"],
        });
        expect(mocks.loadGovernanceTeamMock).toHaveBeenNthCalledWith(1, host, {
          teamId: "genesis_team",
        });
        expect(mocks.loadGovernanceTeamMock).toHaveBeenNthCalledWith(2, host, {
          teamId: "genesis_team",
        });
        expect(mocks.loadGovernanceProposalsMock).toHaveBeenCalledWith(host, {
          status: "pending",
          limit: 11,
        });
      }
      expectNoCronLoaders();
    });
  }

  it("routes agents cron panel refresh through cron loaders", async () => {
    const host = createHost();
    host.agentsPanel = "cron";
    host.cronRunsScope = "job";
    host.cronRunsJobId = "job-123";

    await refreshActiveTab(host as never);

    expectCommonAgentsTabRefresh(host);
    expect(mocks.loadChannelsMock).toHaveBeenCalledWith(host, false);
    expect(mocks.loadCronStatusMock).toHaveBeenCalledOnce();
    expect(mocks.loadCronJobsPageMock).toHaveBeenCalledOnce();
    expect(mocks.loadCronRunsMock).toHaveBeenCalledWith(host, "job-123");
    expect(mocks.loadAgentFilesMock).not.toHaveBeenCalled();
    expect(mocks.loadAgentSkillsMock).not.toHaveBeenCalled();
  });

  it("refreshes logs tab by resetting bottom-follow and scheduling scroll", async () => {
    const host = createHost();
    host.tab = "logs";

    await refreshActiveTab(host as never);

    expect(host.logsAtBottom).toBe(true);
    expect(mocks.loadLogsMock).toHaveBeenCalledWith(host, { reset: true });
    expect(mocks.scheduleLogsScrollMock).toHaveBeenCalledWith(host, true);
  });
});
