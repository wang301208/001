import { describe, expect, it, vi } from "vitest";
import { ASSISTANT_HELP_TEXT } from "./assistant-style.js";
import { createCommandHandlers } from "./tui-command-handlers.js";

function createHarness(params?: {
  callGatewayMethod?: ReturnType<typeof vi.fn>;
  callMcpTool?: ReturnType<typeof vi.fn>;
    captureVoiceInput?: () => Promise<
      { ok: true; text: string; source: string } | { ok: false; message: string; setupHint: string }
    >;
  getEffectiveTools?: ReturnType<typeof vi.fn>;
  listBusinessTasks?: ReturnType<typeof vi.fn>;
  sendChat?: ReturnType<typeof vi.fn>;
}) {
  const addSystem = vi.fn();
  const addUser = vi.fn();
  const requestRender = vi.fn();
  const openOverlay = vi.fn();
  const toggleGovernancePanel = vi.fn();
  const submitRobotInput = vi.fn();
  const setActivityStatus = vi.fn();
  const sendChat = params?.sendChat ?? vi.fn().mockResolvedValue({ runId: "run_1" });
  const callGatewayMethod = params?.callGatewayMethod ?? vi.fn().mockResolvedValue({ ok: true });
  const callMcpTool = params?.callMcpTool ?? vi.fn().mockResolvedValue({ result: "ok" });
  const captureVoiceInput: () => Promise<
    { ok: true; text: string; source: string } | { ok: false; message: string; setupHint: string }
  > =
    params?.captureVoiceInput ??
    vi.fn().mockResolvedValue({ ok: true, text: "查看状态", source: "test" });
  const getEffectiveTools =
    params?.getEffectiveTools ??
    vi.fn().mockResolvedValue({
      groups: [{ tools: [{ id: "web_search" }, { id: "exec" }] }],
    });
  const listBusinessTasks =
    params?.listBusinessTasks ?? vi.fn().mockResolvedValue({ tasks: [] });

  const handlers = createCommandHandlers({
    client: {
      callGatewayMethod,
      callMcpTool,
      getEffectiveTools,
      listBusinessTasks,
      sendChat,
    } as never,
    chatLog: { addSystem, addUser, startAssistant: vi.fn() } as never,
    tui: { requestRender } as never,
    opts: {},
    state: {
      currentSessionKey: "agent:main:main",
      currentAgentId: "main",
      activeChatRunId: null,
      pendingOptimisticUserMessage: false,
      isConnected: true,
      sessionInfo: {},
    } as never,
    deliverDefault: false,
    openOverlay: openOverlay as never,
    closeOverlay: vi.fn(),
    refreshSessionInfo: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi.fn().mockResolvedValue(undefined),
    setSession: vi.fn().mockResolvedValue(undefined),
    refreshAgents: vi.fn().mockResolvedValue(undefined),
    abortActive: vi.fn().mockResolvedValue(undefined),
    setActivityStatus,
    setToolsExpanded: vi.fn(),
    captureVoiceInput,
    submitRobotInput,
    formatSessionKey: (key) => key,
    applySessionInfoFromPatch: vi.fn(),
    noteLocalRunId: vi.fn(),
    noteLocalBtwRunId: vi.fn(),
    forgetLocalRunId: vi.fn(),
    forgetLocalBtwRunId: vi.fn(),
    toggleGovernancePanel,
    requestExit: vi.fn(),
  });

  return {
    handlers,
    addSystem,
    addUser,
    callGatewayMethod,
    callMcpTool,
    captureVoiceInput,
    getEffectiveTools,
    listBusinessTasks,
    openOverlay,
    requestRender,
    sendChat,
    setActivityStatus,
    submitRobotInput,
    toggleGovernancePanel,
  };
}

describe("TUI structured action handlers", () => {
  it("exposes structured actions without an old command executor", () => {
    const { handlers } = createHarness();

    expect(Object.keys(handlers)).toContain("handleAction");
    expect(Object.keys(handlers)).not.toContain(["handle", "Command"].join(""));
  });

  it("runs local TUI operations through structured action names", async () => {
    const { handlers, addSystem, listBusinessTasks, openOverlay, toggleGovernancePanel } =
      createHarness();

    await handlers.handleAction({ type: "tui.operation", operation: "help" });
    await handlers.handleAction({ type: "tui.operation", operation: "settings" });
    await handlers.handleAction({ type: "tui.operation", operation: "governance" });
    await handlers.handleAction({ type: "tui.operation", operation: "tasks", args: "running" });

    expect(addSystem).toHaveBeenCalledWith(ASSISTANT_HELP_TEXT);
    expect(openOverlay).toHaveBeenCalled();
    expect(toggleGovernancePanel).toHaveBeenCalled();
    expect(listBusinessTasks).toHaveBeenCalledWith({ status: "running" });
  });

  it("calls gateway JSON-RPC through gateway.call actions", async () => {
    const { handlers, callGatewayMethod, addSystem } = createHarness();

    await handlers.handleAction({
      type: "gateway.call",
      method: "business.tasks.list",
      rawParams: '{"status":"running"}',
    });

    expect(callGatewayMethod).toHaveBeenCalledWith("business.tasks.list", {
      status: "running",
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business.tasks.list"));
  });

  it("calls MCP tools through mcp.call actions", async () => {
    const { handlers, callMcpTool } = createHarness();

    await handlers.handleAction({
      type: "mcp.call",
      name: "probe__echo",
      arguments: { text: "hello" },
    });

    expect(callMcpTool).toHaveBeenCalledWith({
      name: "probe__echo",
      arguments: { text: "hello" },
    });
  });

  it("routes explicit tool use through tool.invoke actions", async () => {
    const { handlers, getEffectiveTools, sendChat } = createHarness();

    await handlers.handleAction({
      type: "tool.invoke",
      toolName: "web_search",
      goal: "搜索最新 Node.js LTS",
    });

    expect(getEffectiveTools).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      agentId: "main",
    });
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("web_search"),
      }),
    );
  });

  it("captures voice through a structured voice operation", async () => {
    const {
      handlers,
      captureVoiceInput,
      setActivityStatus,
      submitRobotInput,
    } = createHarness();

    await handlers.handleAction({ type: "tui.operation", operation: "voice" });

    expect(setActivityStatus).toHaveBeenCalledWith("listening");
    expect(captureVoiceInput).toHaveBeenCalled();
    expect(submitRobotInput).toHaveBeenCalledWith("查看状态");
  });
});
