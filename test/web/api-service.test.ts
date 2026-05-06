import { beforeEach, describe, expect, it, vi } from "vitest";

const wsMock = vi.hoisted(() => ({
  wsManager: {
    isConnected: true,
    isConnecting: false,
    request: vi.fn(),
    setToken: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../../web/src/services/ws-manager", () => wsMock);

async function loadApiService() {
  vi.resetModules();
  wsMock.wsManager.isConnected = true;
  wsMock.wsManager.isConnecting = false;
  wsMock.wsManager.request.mockReset();
  const module = await import("../../web/src/services/api");
  return {
    api: module.createApiService(),
    adaptGovernanceStatus: module.adaptGovernanceStatus,
  };
}

describe("web API service gateway contract adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adapts channels.status and sends channel control params accepted by the gateway", async () => {
    const { api } = await loadApiService();
    wsMock.wsManager.request.mockImplementation(async (method: string) => {
      if (method === "channels.status") {
        return {
          channelOrder: ["telegram", "slack"],
          channelLabels: { telegram: "Telegram", slack: "Slack" },
          channels: {
            telegram: { configured: true },
            slack: { configured: false },
          },
          channelAccounts: {
            telegram: [
              {
                accountId: "default",
                connected: true,
                healthState: "healthy",
                lastInboundAt: 20,
              },
            ],
            slack: [],
          },
          channelDefaultAccountId: { telegram: "default" },
        };
      }
      return { ok: true };
    });

    await expect(api.getChannels()).resolves.toMatchObject({
      success: true,
      data: [
        {
          id: "telegram",
          type: "telegram",
          name: "Telegram",
          connected: true,
          status: "healthy",
          lastActivity: 20,
        },
        {
          id: "slack",
          type: "slack",
          name: "Slack",
          connected: false,
        },
      ],
    });

    await api.connectChannel("telegram");
    await api.disconnectChannel("slack");

    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "channels.connect",
      { channel: "telegram" },
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "channels.logout",
      { channel: "slack" },
      expect.any(Number),
    );
  });

  it("adapts session envelopes and sends chat params accepted by the gateway", async () => {
    const { api } = await loadApiService();
    wsMock.wsManager.request.mockImplementation(async (method: string) => {
      if (method === "sessions.list") {
        return {
          sessions: [
            {
              key: "agent:default:dashboard:1",
              sessionId: "raw-session-id",
              displayName: "Dashboard",
              updatedAt: 200,
              startedAt: 100,
            },
          ],
        };
      }
      if (method === "sessions.create") {
        return { key: "agent:default:dashboard:2", sessionId: "raw-created-id" };
      }
      if (method === "chat.history") {
        return {
          messages: [
            { id: "m1", role: "user", content: [{ type: "text", text: "hello" }], timestamp: 10 },
          ],
        };
      }
      return { ok: true };
    });

    await expect(api.getSessions(1)).resolves.toMatchObject({
      success: true,
      data: [
        {
          id: "agent:default:dashboard:1",
          title: "Dashboard",
          createdAt: 100,
          updatedAt: 200,
          messageCount: 0,
        },
      ],
    });
    await expect(api.createSession("New session")).resolves.toMatchObject({
      success: true,
      data: {
        sessionId: "agent:default:dashboard:2",
        key: "agent:default:dashboard:2",
      },
    });
    await expect(api.getSessionMessages("agent:default:dashboard:1", 50)).resolves.toMatchObject({
      success: true,
      data: [{ id: "m1", role: "user", content: "hello", timestamp: 10 }],
    });

    await api.sendMessage("agent:default:dashboard:1", "hi");
    await api.abortChat("agent:default:dashboard:1");
    await api.deleteSession("agent:default:dashboard:1");

    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        sessionKey: "agent:default:dashboard:1",
        message: "hi",
        idempotencyKey: expect.any(String),
      }),
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "chat.abort",
      { sessionKey: "agent:default:dashboard:1" },
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "sessions.delete",
      { key: "agent:default:dashboard:1" },
      expect.any(Number),
    );
  });

  it("adapts governance overview and proposal envelopes", async () => {
    const { api, adaptGovernanceStatus } = await loadApiService();
    const rawOverview = {
      observedAt: 123,
      organization: {
        agents: [{ id: "architect", title: "Architect", layer: "control" }],
      },
      sovereignty: { open: 0 },
      enforcement: {
        active: true,
        reasonCode: "freeze",
        denyTools: ["shell"],
      },
    };
    const proposal = {
      id: "p1",
      title: "Fix policy",
      rationale: "Because",
      status: "pending",
      createdAt: 10,
      updatedAt: 20,
      operations: [{ kind: "write", path: "policies/a.yaml", content: "a: true\n" }],
    };
    wsMock.wsManager.request.mockImplementation(async (method: string) => {
      if (method === "governance.overview") return rawOverview;
      if (method === "governance.proposals.list") return { proposals: [proposal] };
      if (method.endsWith(".create") || method.endsWith(".review") || method.endsWith(".apply") || method.endsWith(".revert")) {
        return { proposal };
      }
      return {};
    });

    expect(adaptGovernanceStatus(rawOverview)).toMatchObject({
      sovereigntyBoundary: true,
      freezeActive: true,
      activeAgents: [{ id: "architect", name: "Architect", role: "control", status: "active" }],
      freezeStatus: { active: true, reason: "freeze", affectedSubsystems: ["shell"] },
    });
    await expect(api.getGovernanceStatus()).resolves.toMatchObject({
      success: true,
      data: { freezeActive: true, activeAgents: [{ id: "architect" }] },
    });
    await expect(api.listProposals()).resolves.toMatchObject({
      success: true,
      data: [{ id: "p1", description: "Because", type: "write", status: "pending" }],
    });

    await api.createProposal({
      title: "Fix policy",
      description: "Because",
      type: "evolution",
      operations: [{ kind: "write", path: "policies/a.yaml", content: "a: true\n" }],
    });
    await api.reviewProposal("p1", "approve", "Looks good");
    await api.applyProposal("p1");
    await api.revertProposal("p1");

    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "governance.proposals.create",
      expect.objectContaining({
        title: "Fix policy",
        rationale: "Because",
        operations: [{ kind: "write", path: "policies/a.yaml", content: "a: true\n" }],
      }),
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "governance.proposals.review",
      { proposalId: "p1", decision: "approve", decidedBy: "web-console", decisionNote: "Looks good" },
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "governance.proposals.apply",
      { proposalId: "p1", appliedBy: "web-console" },
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "governance.proposals.revert",
      { proposalId: "p1", revertedBy: "web-console" },
      expect.any(Number),
    );
  });

  it("does not send invalid governance create requests when operations are missing", async () => {
    const { api } = await loadApiService();

    await expect(
      api.createProposal({ title: "No operation", description: "Missing operation", type: "evolution" }),
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("operation"),
    });
    expect(wsMock.wsManager.request).not.toHaveBeenCalled();
  });

  it("unwraps models and maps autonomy overview to task cards without invalid params", async () => {
    const { api } = await loadApiService();
    wsMock.wsManager.request.mockImplementation(async (method: string) => {
      if (method === "models.list") {
        return { models: [{ id: "gpt-test", name: "GPT Test", provider: "openai" }] };
      }
      if (method === "autonomy.overview") {
        return {
          overview: {
            entries: [
              {
                agentId: "builder",
                profile: { id: "builder", name: "Builder" },
                latestFlow: {
                  id: "flow-1",
                  goal: "Ship feature",
                  status: "running",
                  createdAt: 100,
                  updatedAt: 200,
                },
              },
            ],
          },
        };
      }
      return { ok: true };
    });

    await expect(api.getModels()).resolves.toMatchObject({
      success: true,
      data: [{ id: "gpt-test", name: "GPT Test", provider: "openai" }],
    });
    await expect(api.getTasks("running")).resolves.toMatchObject({
      success: true,
      data: [
        {
          id: "builder:flow-1",
          name: "Ship feature",
          status: "running",
          createdAt: 100,
        },
      ],
    });

    await api.cancelTask("be_builder:flow-1");

    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "autonomy.overview",
      {},
      expect.any(Number),
    );
    expect(wsMock.wsManager.request).toHaveBeenCalledWith(
      "autonomy.cancel",
      { agentId: "builder", flowId: "flow-1" },
      expect.any(Number),
    );
  });
});
