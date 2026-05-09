import { describe, expect, it, vi } from "vitest";
import { createCommandHandlers } from "./tui-command-handlers.js";

type LoadHistoryMock = ReturnType<typeof vi.fn> & (() => Promise<void>);
type SetActivityStatusMock = ReturnType<typeof vi.fn> & ((text: string) => void);
type SetSessionMock = ReturnType<typeof vi.fn> & ((key: string) => Promise<void>);

function createHarness(params?: {
  sendChat?: ReturnType<typeof vi.fn>;
  getGatewayStatus?: ReturnType<typeof vi.fn>;
  getToolsCatalog?: ReturnType<typeof vi.fn>;
  getEffectiveTools?: ReturnType<typeof vi.fn>;
  callGatewayMethod?: ReturnType<typeof vi.fn>;
  listGatewayMethods?: ReturnType<typeof vi.fn>;
  describeGatewayMethod?: ReturnType<typeof vi.fn>;
  captureExperience?: ReturnType<typeof vi.fn>;
  searchExperience?: ReturnType<typeof vi.fn>;
  getExperienceSummary?: ReturnType<typeof vi.fn>;
  recallSessionMemory?: ReturnType<typeof vi.fn>;
  listBusinessTasks?: ReturnType<typeof vi.fn>;
  createBusinessTask?: ReturnType<typeof vi.fn>;
  updateBusinessTask?: ReturnType<typeof vi.fn>;
  deleteBusinessTask?: ReturnType<typeof vi.fn>;
  getConfig?: ReturnType<typeof vi.fn>;
  patchConfig?: ReturnType<typeof vi.fn>;
  tailLogs?: ReturnType<typeof vi.fn>;
  listRemoteModels?: ReturnType<typeof vi.fn>;
  getSkillsStatus?: ReturnType<typeof vi.fn>;
  searchSkills?: ReturnType<typeof vi.fn>;
  listAgentFiles?: ReturnType<typeof vi.fn>;
  getAgentFile?: ReturnType<typeof vi.fn>;
  setAgentFile?: ReturnType<typeof vi.fn>;
  listMcpTools?: ReturnType<typeof vi.fn>;
  callMcpTool?: ReturnType<typeof vi.fn>;
  listSkillCandidates?: ReturnType<typeof vi.fn>;
  createSkillCandidate?: ReturnType<typeof vi.fn>;
  recordSkillUsage?: ReturnType<typeof vi.fn>;
  exportSkillCandidate?: ReturnType<typeof vi.fn>;
  captureStrategicMemory?: ReturnType<typeof vi.fn>;
  listDueStrategicPushes?: ReturnType<typeof vi.fn>;
  advanceStrategicMemory?: ReturnType<typeof vi.fn>;
  getSelfModel?: ReturnType<typeof vi.fn>;
  updateSelfModel?: ReturnType<typeof vi.fn>;
  updateUserModel?: ReturnType<typeof vi.fn>;
  queryUserModel?: ReturnType<typeof vi.fn>;
  startAgentsParallel?: ReturnType<typeof vi.fn>;
  getAgentsParallelStatus?: ReturnType<typeof vi.fn>;
  cancelAgentsParallel?: ReturnType<typeof vi.fn>;
  patchSession?: ReturnType<typeof vi.fn>;
  resetSession?: ReturnType<typeof vi.fn>;
  steerSession?: ReturnType<typeof vi.fn>;
  setSession?: SetSessionMock;
  loadHistory?: LoadHistoryMock;
  refreshSessionInfo?: ReturnType<typeof vi.fn>;
  applySessionInfoFromPatch?: ReturnType<typeof vi.fn>;
  setActivityStatus?: SetActivityStatusMock;
  openOverlay?: ReturnType<typeof vi.fn>;
  toggleGovernancePanel?: ReturnType<typeof vi.fn>;
  setToolsExpanded?: ReturnType<typeof vi.fn>;
  captureVoiceInput?: ReturnType<typeof vi.fn>;
  submitRobotInput?: ReturnType<typeof vi.fn>;
  isConnected?: boolean;
  activeChatRunId?: string | null;
}) {
  const sendChat = params?.sendChat ?? vi.fn().mockResolvedValue({ runId: "r1" });
  const getGatewayStatus = params?.getGatewayStatus ?? vi.fn().mockResolvedValue({});
  const getToolsCatalog = params?.getToolsCatalog ?? vi.fn().mockResolvedValue({
    agentId: "main",
    profiles: [],
    governance: {
      charterDeclared: false,
      charterToolDeny: [],
      charterRequireAgentId: false,
      charterElevatedLocked: false,
      freezeActive: false,
      freezeDeny: [],
      freezeDetails: [],
      activeSovereigntyIncidentCount: 0,
      activeSovereigntyIncidentIds: [],
      activeSovereigntyFreezeIncidentIds: [],
    },
    groups: [],
  });
  const getEffectiveTools = params?.getEffectiveTools ?? vi.fn().mockResolvedValue({
    agentId: "main",
    profile: "full",
    governance: {
      charterDeclared: false,
      charterToolDeny: [],
      charterRequireAgentId: false,
      charterElevatedLocked: false,
      freezeActive: false,
      freezeDeny: [],
      freezeDetails: [],
      activeSovereigntyIncidentCount: 0,
      activeSovereigntyIncidentIds: [],
      activeSovereigntyFreezeIncidentIds: [],
    },
    groups: [],
  });
  const callGatewayMethod = params?.callGatewayMethod ?? vi.fn().mockResolvedValue({ ok: true });
  const listGatewayMethods =
    params?.listGatewayMethods ??
    vi.fn().mockResolvedValue({
      count: 3,
      methods: [
        { name: "status", category: "status", scope: "operator.read" },
        { name: "business.tasks.list", category: "business", scope: "operator.read" },
        { name: "business.tasks.create", category: "business", scope: "operator.admin" },
      ],
    });
  const describeGatewayMethod =
    params?.describeGatewayMethod ??
    vi.fn().mockResolvedValue({
      method: { name: "business.tasks.list", category: "business", scope: "operator.read" },
      paramsSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "integer" },
        },
      },
      exampleParams: { status: "running", limit: 20 },
      callTemplate: '/gateway-call business.tasks.list {"status":"running","limit":20}',
    });
  const captureExperience =
    params?.captureExperience ?? vi.fn().mockResolvedValue({ event: { id: "exp_1" } });
  const searchExperience =
    params?.searchExperience ?? vi.fn().mockResolvedValue({ query: "deploy", results: [] });
  const getExperienceSummary =
    params?.getExperienceSummary ??
    vi.fn().mockResolvedValue({ counts: { events: 0, skillCandidates: 0 }, recentEvents: [] });
  const recallSessionMemory =
    params?.recallSessionMemory ??
    vi.fn().mockResolvedValue({ query: "deploy", backend: "sqlite-fts5", summary: "", hits: [] });
  const listBusinessTasks =
    params?.listBusinessTasks ?? vi.fn().mockResolvedValue({ tasks: [] });
  const createBusinessTask =
    params?.createBusinessTask ??
    vi.fn().mockResolvedValue({ task: { id: "task_1", name: "Build API" } });
  const updateBusinessTask =
    params?.updateBusinessTask ??
    vi.fn().mockResolvedValue({ task: { id: "task_1", status: "completed" } });
  const deleteBusinessTask =
    params?.deleteBusinessTask ?? vi.fn().mockResolvedValue({ ok: true, id: "task_1" });
  const getConfig =
    params?.getConfig ?? vi.fn().mockResolvedValue({ raw: "{}", path: "/tmp/assistant.json" });
  const patchConfig =
    params?.patchConfig ?? vi.fn().mockResolvedValue({ ok: true, changedPaths: ["models"] });
  const tailLogs =
    params?.tailLogs ?? vi.fn().mockResolvedValue({ lines: ["log"], cursor: 1, size: 1 });
  const listRemoteModels =
    params?.listRemoteModels ?? vi.fn().mockResolvedValue({ models: [] });
  const getSkillsStatus =
    params?.getSkillsStatus ?? vi.fn().mockResolvedValue({ ok: true, entries: [] });
  const searchSkills =
    params?.searchSkills ?? vi.fn().mockResolvedValue({ results: [] });
  const listAgentFiles =
    params?.listAgentFiles ?? vi.fn().mockResolvedValue({ files: [] });
  const getAgentFile =
    params?.getAgentFile ?? vi.fn().mockResolvedValue({ file: { name: "MEMORY.md", content: "" } });
  const setAgentFile =
    params?.setAgentFile ?? vi.fn().mockResolvedValue({ file: { name: "MEMORY.md", content: "" } });
  const listMcpTools =
    params?.listMcpTools ?? vi.fn().mockResolvedValue({ tools: [] });
  const callMcpTool =
    params?.callMcpTool ?? vi.fn().mockResolvedValue({ result: { content: [] } });
  const listSkillCandidates =
    params?.listSkillCandidates ?? vi.fn().mockResolvedValue({ candidates: [] });
  const createSkillCandidate =
    params?.createSkillCandidate ??
    vi.fn().mockResolvedValue({ candidate: { id: "skill_candidate_1" } });
  const recordSkillUsage =
    params?.recordSkillUsage ??
    vi.fn().mockResolvedValue({
      usage: { id: "skill_usage_1", candidateId: "skill_candidate_1", outcome: "ok" },
      candidate: { id: "skill_candidate_1", title: "Deploy guard", status: "proposed" },
    });
  const exportSkillCandidate =
    params?.exportSkillCandidate ??
    vi.fn().mockResolvedValue({
      name: "deploy-guard",
      skillPath: "/tmp/deploy-guard/SKILL.md",
      directory: "/tmp/deploy-guard",
      content: "",
    });
  const captureStrategicMemory =
    params?.captureStrategicMemory ??
    vi.fn().mockResolvedValue({ memory: { id: "strategy_1", title: "Skill harvest" } });
  const listDueStrategicPushes =
    params?.listDueStrategicPushes ?? vi.fn().mockResolvedValue({ pushes: [] });
  const advanceStrategicMemory =
    params?.advanceStrategicMemory ??
    vi.fn().mockResolvedValue({ memory: { id: "strategy_1", title: "Skill harvest" } });
  const getSelfModel =
    params?.getSelfModel ?? vi.fn().mockResolvedValue({ selfModel: { strengths: [] } });
  const updateSelfModel =
    params?.updateSelfModel ??
    vi.fn().mockResolvedValue({ selfModel: { learnedPatterns: ["pattern"] } });
  const updateUserModel =
    params?.updateUserModel ?? vi.fn().mockResolvedValue({ userModel: { preferences: [] } });
  const queryUserModel =
    params?.queryUserModel ??
    vi.fn().mockResolvedValue({ answer: "concise", hypotheses: [], model: {} });
  const startAgentsParallel =
    params?.startAgentsParallel ??
    vi.fn().mockResolvedValue({
      batchId: "parallel_1",
      status: "running",
      counts: { total: 2, queued: 0, starting: 0, running: 2, failed: 0, cancelled: 0 },
      tasks: [
        { id: "task_1", status: "running", agentId: "researcher", goal: "inspect" },
        { id: "task_2", status: "running", agentId: "developer", goal: "patch" },
      ],
    });
  const getAgentsParallelStatus =
    params?.getAgentsParallelStatus ??
    vi.fn().mockResolvedValue({
      batchId: "parallel_1",
      status: "running",
      counts: { total: 2, queued: 0, starting: 0, running: 2, failed: 0, cancelled: 0 },
      tasks: [],
    });
  const cancelAgentsParallel =
    params?.cancelAgentsParallel ??
    vi.fn().mockResolvedValue({
      batchId: "parallel_1",
      status: "cancelled",
      counts: { total: 2, queued: 0, starting: 0, running: 0, failed: 0, cancelled: 2 },
      tasks: [],
    });
  const patchSession = params?.patchSession ?? vi.fn().mockResolvedValue({});
  const resetSession = params?.resetSession ?? vi.fn().mockResolvedValue({ ok: true });
  const steerSession = params?.steerSession ?? vi.fn().mockResolvedValue({ runId: "run-steer" });
  const setSession = params?.setSession ?? (vi.fn().mockResolvedValue(undefined) as SetSessionMock);
  const addUser = vi.fn();
  const addSystem = vi.fn();
  const startAssistant = vi.fn();
  const requestRender = vi.fn();
  const noteLocalRunId = vi.fn();
  const noteLocalBtwRunId = vi.fn();
  const loadHistory =
    params?.loadHistory ?? (vi.fn().mockResolvedValue(undefined) as LoadHistoryMock);
  const refreshSessionInfo = params?.refreshSessionInfo ?? vi.fn().mockResolvedValue(undefined);
  const applySessionInfoFromPatch = params?.applySessionInfoFromPatch ?? vi.fn();
  const setActivityStatus = params?.setActivityStatus ?? (vi.fn() as SetActivityStatusMock);
  const openOverlay = params?.openOverlay ?? vi.fn();
  const toggleGovernancePanel = params?.toggleGovernancePanel ?? vi.fn();
  const setToolsExpanded = params?.setToolsExpanded ?? vi.fn();
  const captureVoiceInput = params?.captureVoiceInput ?? vi.fn();
  const submitRobotInput = params?.submitRobotInput ?? vi.fn();
  const state = {
    currentSessionKey: "agent:main:main",
    currentAgentId: "main",
    activeChatRunId: params?.activeChatRunId ?? null,
    pendingOptimisticUserMessage: false,
    isConnected: params?.isConnected ?? true,
    sessionInfo: {},
  };

  const { handleCommand } = createCommandHandlers({
    client: {
      sendChat,
      getGatewayStatus,
      getToolsCatalog,
      getEffectiveTools,
      callGatewayMethod,
      listGatewayMethods,
      describeGatewayMethod,
      captureExperience,
      searchExperience,
      getExperienceSummary,
      recallSessionMemory,
      listBusinessTasks,
      createBusinessTask,
      updateBusinessTask,
      deleteBusinessTask,
      getConfig,
      patchConfig,
      tailLogs,
      listRemoteModels,
      getSkillsStatus,
      searchSkills,
      listAgentFiles,
      getAgentFile,
      setAgentFile,
      listMcpTools,
      callMcpTool,
      listSkillCandidates,
      createSkillCandidate,
      recordSkillUsage,
      exportSkillCandidate,
      captureStrategicMemory,
      listDueStrategicPushes,
      advanceStrategicMemory,
      getSelfModel,
      updateSelfModel,
      updateUserModel,
      queryUserModel,
      startAgentsParallel,
      getAgentsParallelStatus,
      cancelAgentsParallel,
      patchSession,
      resetSession,
      steerSession,
    } as never,
    chatLog: { addUser, addSystem, startAssistant } as never,
    tui: { requestRender } as never,
    opts: {},
    state: state as never,
    deliverDefault: false,
    openOverlay: openOverlay as never,
    closeOverlay: vi.fn(),
    refreshSessionInfo: refreshSessionInfo as never,
    loadHistory,
    setSession,
    refreshAgents: vi.fn(),
    abortActive: vi.fn(),
    setActivityStatus,
    setToolsExpanded: setToolsExpanded as never,
    captureVoiceInput: captureVoiceInput as never,
    submitRobotInput: submitRobotInput as never,
    formatSessionKey: vi.fn(),
    applySessionInfoFromPatch: applySessionInfoFromPatch as never,
    noteLocalRunId,
    noteLocalBtwRunId,
    forgetLocalRunId: vi.fn(),
    forgetLocalBtwRunId: vi.fn(),
    toggleGovernancePanel: toggleGovernancePanel as never,
    requestExit: vi.fn(),
  });

  return {
    handleCommand,
    getGatewayStatus,
    getToolsCatalog,
    getEffectiveTools,
    callGatewayMethod,
    listGatewayMethods,
    describeGatewayMethod,
    captureExperience,
    searchExperience,
    getExperienceSummary,
    recallSessionMemory,
    listBusinessTasks,
    createBusinessTask,
    updateBusinessTask,
    deleteBusinessTask,
    getConfig,
    patchConfig,
    tailLogs,
    listRemoteModels,
    getSkillsStatus,
    searchSkills,
    listAgentFiles,
    getAgentFile,
    setAgentFile,
    listMcpTools,
    callMcpTool,
    listSkillCandidates,
    createSkillCandidate,
    recordSkillUsage,
    exportSkillCandidate,
    captureStrategicMemory,
    listDueStrategicPushes,
    advanceStrategicMemory,
    getSelfModel,
    updateSelfModel,
    updateUserModel,
    queryUserModel,
    startAgentsParallel,
    getAgentsParallelStatus,
    cancelAgentsParallel,
    sendChat,
    patchSession,
    resetSession,
    steerSession,
    setSession,
    addUser,
    addSystem,
    startAssistant,
    requestRender,
    loadHistory,
    refreshSessionInfo,
    applySessionInfoFromPatch,
    setActivityStatus,
    openOverlay: openOverlay as never,
    toggleGovernancePanel: toggleGovernancePanel as never,
    setToolsExpanded,
    captureVoiceInput,
    submitRobotInput,
    noteLocalRunId,
    noteLocalBtwRunId,
    state,
  };
}

describe("tui command handlers", () => {
  it("renders the sending indicator before chat.send resolves", async () => {
    let resolveSend: (value: { runId: string }) => void = () => {
      throw new Error("sendChat promise resolver was not initialized");
    };
    const sendPromise = new Promise<{ runId: string }>((resolve) => {
      resolveSend = (value) => resolve(value);
    });
    const sendChat = vi.fn(() => sendPromise);
    const setActivityStatus = vi.fn();

    const { handleCommand, requestRender } = createHarness({
      sendChat,
      setActivityStatus,
    });

    const pending = handleCommand("/context");
    await Promise.resolve();

    expect(setActivityStatus).toHaveBeenCalledWith("sending");
    const sendingOrder = setActivityStatus.mock.invocationCallOrder[0] ?? 0;
    const renderOrders = requestRender.mock.invocationCallOrder;
    expect(renderOrders.some((order) => order > sendingOrder)).toBe(true);

    resolveSend({ runId: "r1" });
    await pending;
    expect(setActivityStatus).toHaveBeenCalledWith("waiting");
  });

  it("forwards unknown slash commands to the gateway", async () => {
    const { handleCommand, sendChat, addUser, addSystem, requestRender } = createHarness();

    await handleCommand("/context");

    expect(addSystem).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/context");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/context",
      }),
    );
    expect(requestRender).toHaveBeenCalled();
  });

  it("forwards /status to the shared gateway command path", async () => {
    const { handleCommand, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/status");

    expect(addSystem).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/status");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/status",
      }),
    );
  });

  it("starts a parallel agent batch from slash command task segments", async () => {
    const { handleCommand, startAgentsParallel, addSystem } = createHarness();

    await handleCommand("/agents-parallel researcher: inspect constraints | developer: patch code");

    expect(startAgentsParallel).toHaveBeenCalledWith({
      parentSessionKey: "agent:main:main",
      tasks: [
        { agentId: "researcher", goal: "inspect constraints" },
        { agentId: "developer", goal: "patch code" },
      ],
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("parallel batch parallel_1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("running=2"));
  });

  it("queries and cancels parallel agent batches", async () => {
    const { handleCommand, getAgentsParallelStatus, cancelAgentsParallel, addSystem } =
      createHarness();

    await handleCommand("/agents-parallel-status parallel_1");
    await handleCommand("/agents-parallel-cancel parallel_1");

    expect(getAgentsParallelStatus).toHaveBeenCalledWith({ batchId: "parallel_1" });
    expect(cancelAgentsParallel).toHaveBeenCalledWith({ batchId: "parallel_1" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("parallel batch parallel_1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("status=cancelled"));
  });

  it("keeps gateway diagnostics on /gateway-status", async () => {
    const { handleCommand, getGatewayStatus, addSystem, addUser, sendChat } = createHarness({
      getGatewayStatus: vi.fn().mockResolvedValue({
        runtimeVersion: "1.2.3",
        sessions: { count: 2, defaults: { model: "gpt-5.4", contextTokens: 200000 } },
      }),
    });

    await handleCommand("/gateway-status");

    expect(getGatewayStatus).toHaveBeenCalledTimes(1);
    expect(addUser).not.toHaveBeenCalled();
    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("Gateway status");
    expect(addSystem).toHaveBeenCalledWith("Version: 1.2.3");
  });

  it("keeps optimistic run state after chat.send so follow-up input queues until events finish it", async () => {
    const { handleCommand, noteLocalRunId, state } = createHarness();

    await handleCommand("/context");

    expect(noteLocalRunId).not.toHaveBeenCalled();
    expect(state.activeChatRunId).toEqual(expect.any(String));
    expect(state.pendingOptimisticUserMessage).toBe(true);
  });

  it("steers an active run through sessions.steer without queuing as a later follow-up", async () => {
    const steerSession = vi.fn().mockResolvedValue({
      runId: "run-steered",
      interruptedActiveRun: true,
    });
    const setActivityStatus = vi.fn();
    const { handleCommand, sendChat, addUser, addSystem, state, requestRender } = createHarness({
      activeChatRunId: "run-active",
      steerSession,
      setActivityStatus,
    });

    await handleCommand("/steer use the faster plan");

    expect(addSystem).not.toHaveBeenCalledWith(expect.stringContaining("usage: /steer"));
    expect(addUser).toHaveBeenCalledWith("/steer use the faster plan");
    expect(sendChat).not.toHaveBeenCalled();
    expect(steerSession).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      message: "use the faster plan",
      thinking: undefined,
      timeoutMs: undefined,
      runId: expect.any(String),
    });
    expect(state.activeChatRunId).toBe("run-steered");
    expect(state.pendingOptimisticUserMessage).toBe(true);
    expect(setActivityStatus).toHaveBeenLastCalledWith("waiting");
    expect(requestRender).toHaveBeenCalled();
  });

  it("reports usage when /steer has no instruction", async () => {
    const { handleCommand, addSystem, steerSession } = createHarness({
      activeChatRunId: "run-active",
    });

    await handleCommand("/steer");

    expect(addSystem).toHaveBeenCalledWith("usage: /steer <instruction>");
    expect(steerSession).not.toHaveBeenCalled();
  });

  it("sends /btw without hijacking the active main run", async () => {
    const setActivityStatus = vi.fn();
    const { handleCommand, sendChat, addUser, noteLocalRunId, noteLocalBtwRunId, state } =
      createHarness({
        activeChatRunId: "run-main",
        setActivityStatus,
      });

    await handleCommand("/btw what changed?");

    expect(addUser).not.toHaveBeenCalled();
    expect(noteLocalRunId).not.toHaveBeenCalled();
    expect(noteLocalBtwRunId).toHaveBeenCalledTimes(1);
    expect(state.activeChatRunId).toBe("run-main");
    expect(setActivityStatus).not.toHaveBeenCalledWith("sending");
    expect(setActivityStatus).not.toHaveBeenCalledWith("waiting");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "/btw what changed?",
      }),
    );
  });

  it("creates unique session for /new and resets shared session for /reset", async () => {
    const loadHistory = vi.fn().mockResolvedValue(undefined);
    const setSessionMock = vi.fn().mockResolvedValue(undefined) as SetSessionMock;
    const { handleCommand, resetSession } = createHarness({
      loadHistory,
      setSession: setSessionMock,
    });

    await handleCommand("/new");
    await handleCommand("/reset");

    // /new creates a unique session key (isolates TUI client) (#39217)
    expect(setSessionMock).toHaveBeenCalledTimes(1);
    expect(setSessionMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tui-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),
    );
    // /reset still resets the shared session
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(resetSession).toHaveBeenCalledWith("agent:main:main", "reset");
    expect(loadHistory).toHaveBeenCalledTimes(1); // /reset calls loadHistory directly; /new does so indirectly via setSession
  });

  it("reports send failures and marks activity status as error", async () => {
    const setActivityStatus = vi.fn();
    const { handleCommand, addSystem, state } = createHarness({
      sendChat: vi.fn().mockRejectedValue(new Error("gateway down")),
      setActivityStatus,
    });

    await handleCommand("/context");

    expect(addSystem).toHaveBeenCalledWith("send failed: Error: gateway down");
    expect(setActivityStatus).toHaveBeenLastCalledWith("error");
    expect(state.pendingOptimisticUserMessage).toBe(false);
  });

  it("sanitizes control sequences in /new and /reset failures", async () => {
    const setSession = vi.fn().mockRejectedValue(new Error("\u001b[31mboom\u001b[0m"));
    const resetSession = vi.fn().mockRejectedValue(new Error("\u001b[31mboom\u001b[0m"));
    const { handleCommand, addSystem } = createHarness({
      setSession,
      resetSession,
    });

    await handleCommand("/new");
    await handleCommand("/reset");

    expect(addSystem).toHaveBeenNthCalledWith(1, "new session failed: Error: boom");
    expect(addSystem).toHaveBeenNthCalledWith(2, "reset failed: Error: boom");
  });

  it("reports disconnected status and skips gateway send when offline", async () => {
    const { handleCommand, sendChat, addUser, addSystem, setActivityStatus } = createHarness({
      isConnected: false,
    });

    await handleCommand("/context");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("not connected to gateway - message not sent");
    expect(setActivityStatus).toHaveBeenLastCalledWith("disconnected");
  });

  it("keeps /settings on the settings overlay and /governance on the governance panel", async () => {
    const openOverlay = vi.fn();
    const toggleGovernancePanel = vi.fn();
    const { handleCommand } = createHarness({ openOverlay, toggleGovernancePanel });

    await handleCommand("/settings");
    expect(openOverlay).toHaveBeenCalledTimes(1);
    expect(toggleGovernancePanel).not.toHaveBeenCalled();

    await handleCommand("/governance");
    await handleCommand("/gov");
    expect(toggleGovernancePanel).toHaveBeenCalledTimes(2);
  });

  it("shows robot natural-language control help", async () => {
    const { handleCommand, addSystem } = createHarness();

    await handleCommand("/robot");

    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("机器人控制台"));
  });

  it("feeds voice transcripts back through the same robot input path", async () => {
    const captureVoiceInput = vi.fn().mockResolvedValue({
      ok: true,
      text: "打开设置",
      source: "test-stt",
    });
    const submitRobotInput = vi.fn();
    const { handleCommand, addSystem, setActivityStatus } = createHarness({
      captureVoiceInput,
      submitRobotInput,
    });

    await handleCommand("/voice");

    expect(setActivityStatus).toHaveBeenCalledWith("listening");
    expect(addSystem).toHaveBeenCalledWith("voice -> 打开设置");
    expect(submitRobotInput).toHaveBeenCalledWith("打开设置");
  });

  it("surfaces voice setup guidance when speech input is not configured", async () => {
    const captureVoiceInput = vi.fn().mockResolvedValue({
      ok: false,
      message: "voice input command is not configured",
      setupHint: "set ASSISTANT_TUI_STT_COMMAND",
    });
    const { handleCommand, addSystem, setActivityStatus } = createHarness({
      captureVoiceInput,
      submitRobotInput: vi.fn(),
    });

    await handleCommand("/voice");

    expect(addSystem).toHaveBeenCalledWith(
      "voice input command is not configured\nset ASSISTANT_TUI_STT_COMMAND",
    );
    expect(setActivityStatus).toHaveBeenCalledWith("voice unavailable");
  });

  it("lets natural language toggle tool output through /tools", async () => {
    const { handleCommand, setToolsExpanded, getEffectiveTools, addSystem } = createHarness();

    await handleCommand("/tools expanded");
    await handleCommand("/tools collapsed");

    expect(setToolsExpanded).toHaveBeenNthCalledWith(1, true);
    expect(setToolsExpanded).toHaveBeenNthCalledWith(2, false);

    await handleCommand("/tools");

    expect(getEffectiveTools).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      agentId: "main",
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("当前可调用工具"));
  });

  it("shows the real backend capability catalog", async () => {
    const getToolsCatalog = vi.fn().mockResolvedValue({
      agentId: "main",
      profiles: [
        { id: "minimal", label: "Minimal" },
        { id: "full", label: "Full" },
      ],
      governance: {
        charterDeclared: true,
        charterTitle: "自治助手",
        charterLayer: "execution",
        charterToolDeny: ["dangerous_tool"],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "system",
          label: "System",
          source: "core",
          tools: [
            {
              id: "gateway.status",
              label: "Gateway status",
              description: "Read gateway status",
              source: "core",
              defaultProfiles: ["full"],
            },
          ],
        },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ getToolsCatalog });

    await handleCommand("/capabilities");

    expect(getToolsCatalog).toHaveBeenCalledWith({ agentId: "main", includePlugins: true });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("能力目录"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("gateway.status"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("dangerous_tool"));
  });

  it("filters backend capability catalog by keyword", async () => {
    const getToolsCatalog = vi.fn().mockResolvedValue({
      agentId: "main",
      profiles: [],
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "runtime",
          label: "Runtime",
          source: "core",
          tools: [
            {
              id: "exec",
              label: "exec",
              description: "Run shell commands",
              source: "core",
              defaultProfiles: ["full"],
            },
            {
              id: "web_search",
              label: "web_search",
              description: "Search the web",
              source: "core",
              defaultProfiles: ["full"],
            },
          ],
        },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ getToolsCatalog });

    await handleCommand("/capabilities exec");

    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("匹配: exec"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("exec"));
    expect(addSystem).not.toHaveBeenCalledWith(expect.stringContaining("web_search"));
  });

  it("shows currently effective tools for the active session", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "sessions.send",
              label: "Send session message",
              description: "Send a message",
              rawDescription: "Send a message",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ getEffectiveTools });

    await handleCommand("/tools-effective");

    expect(getEffectiveTools).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      agentId: "main",
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("当前可调用工具"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("sessions.send"));
  });

  it("filters current tools by keyword", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "sessions_send",
              label: "Send session message",
              description: "Send a message",
              rawDescription: "Send a message",
              source: "core",
            },
            {
              id: "web_fetch",
              label: "Fetch web content",
              description: "Fetch web content",
              rawDescription: "Fetch web content",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ getEffectiveTools });

    await handleCommand("/tools send");

    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("匹配: send"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("sessions_send"));
    expect(addSystem).not.toHaveBeenCalledWith(expect.stringContaining("web_fetch"));
  });

  it("surfaces capability lookup failures without sending chat", async () => {
    const getToolsCatalog = vi.fn().mockRejectedValue(new Error("gateway unavailable"));
    const { handleCommand, addSystem, sendChat } = createHarness({ getToolsCatalog });

    await handleCommand("/capabilities");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("capabilities failed: Error: gateway unavailable");
  });

  it("bridges explicit tool invocation requests into the agent tool-calling path", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "web_search",
              label: "web_search",
              description: "Search the web",
              rawDescription: "Search the web",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, sendChat, addUser } = createHarness({ getEffectiveTools });

    await handleCommand("/invoke-tool web_search 搜索最新 Node.js LTS");

    expect(addUser).toHaveBeenCalledWith(expect.stringContaining("调用工具 web_search"));
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: expect.stringContaining("Tool requested: web_search"),
      }),
    );
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("User goal: 搜索最新 Node.js LTS"),
      }),
    );
  });

  it("rejects malformed explicit tool invocation requests before sending", async () => {
    const { handleCommand, sendChat, addSystem } = createHarness();

    await handleCommand("/invoke-tool web_search");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("usage: /invoke-tool <tool_name> <goal>");
  });

  it("rejects explicit tool invocation when the tool is not currently available", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "web_fetch",
              label: "web_fetch",
              description: "Fetch web content",
              rawDescription: "Fetch web content",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, sendChat, addSystem } = createHarness({ getEffectiveTools });

    await handleCommand("/invoke-tool web_search 搜索最新 Node.js LTS");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith(
      expect.stringContaining('tool "web_search" is not available in this session'),
    );
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("web_fetch"));
  });

  it("resolves explicit tool invocation aliases before sending", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "web_search",
              label: "web_search",
              description: "Search the web",
              rawDescription: "Search the web",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, sendChat } = createHarness({ getEffectiveTools });

    await handleCommand("/invoke-tool search 搜索最新 Node.js LTS");

    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Tool requested: web_search"),
      }),
    );
  });

  it("reports ambiguous explicit tool aliases instead of guessing", async () => {
    const getEffectiveTools = vi.fn().mockResolvedValue({
      agentId: "main",
      profile: "full",
      governance: {
        charterDeclared: false,
        charterToolDeny: [],
        charterRequireAgentId: false,
        charterElevatedLocked: false,
        freezeActive: false,
        freezeDeny: [],
        freezeDetails: [],
        activeSovereigntyIncidentCount: 0,
        activeSovereigntyIncidentIds: [],
        activeSovereigntyFreezeIncidentIds: [],
      },
      groups: [
        {
          id: "core",
          label: "Core",
          source: "core",
          tools: [
            {
              id: "web_search",
              label: "web_search",
              description: "Search the web",
              rawDescription: "Search the web",
              source: "core",
            },
            {
              id: "memory_search",
              label: "memory_search",
              description: "Search memory",
              rawDescription: "Search memory",
              source: "core",
            },
          ],
        },
      ],
    });
    const { handleCommand, sendChat, addSystem } = createHarness({ getEffectiveTools });

    await handleCommand("/invoke-tool search 查找资料");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining('tool "search" is ambiguous'));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("web_search"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("memory_search"));
  });

  it("calls arbitrary gateway RPC methods from the TUI command layer", async () => {
    const callGatewayMethod = vi.fn().mockResolvedValue({ count: 2, tasks: [] });
    const { handleCommand, addSystem } = createHarness({ callGatewayMethod });

    await handleCommand('/gateway-call business.tasks.list {"status":"running"}');

    expect(callGatewayMethod).toHaveBeenCalledWith("business.tasks.list", { status: "running" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business.tasks.list result"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining('"count": 2'));
  });

  it("rejects malformed gateway RPC JSON before calling the gateway", async () => {
    const callGatewayMethod = vi.fn();
    const { handleCommand, addSystem } = createHarness({ callGatewayMethod });

    await handleCommand("/gateway-call business.tasks.list {bad-json}");

    expect(callGatewayMethod).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("gateway-call params must be JSON"));
  });

  it("suggests matching gateway methods when an RPC call targets an unknown method", async () => {
    const callGatewayMethod = vi.fn().mockRejectedValue(new Error("unknown method: business.task"));
    const listGatewayMethods = vi.fn().mockResolvedValue({
      count: 2,
      query: "business.task",
      methods: [
        { name: "business.tasks.list", category: "business", scope: "operator.read" },
        { name: "business.tasks.create", category: "business", scope: "operator.admin" },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ callGatewayMethod, listGatewayMethods });

    await handleCommand("/gateway-call business.task");

    expect(listGatewayMethods).toHaveBeenCalledWith({ query: "business.task" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("gateway-call failed"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Did you mean"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business.tasks.list"));
  });

  it("lists discoverable gateway RPC methods with optional filtering", async () => {
    const listGatewayMethods = vi.fn().mockResolvedValue({
      count: 2,
      query: "business",
      methods: [
        { name: "business.tasks.list", category: "business", scope: "operator.read" },
        { name: "business.tasks.create", category: "business", scope: "operator.admin" },
      ],
    });
    const { handleCommand, addSystem } = createHarness({ listGatewayMethods });

    await handleCommand("/methods business");

    expect(listGatewayMethods).toHaveBeenCalledWith({ query: "business" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Gateway RPC methods: 2"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business.tasks.list"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("operator.admin"));
  });

  it("describes a gateway RPC method contract and runnable call template", async () => {
    const describeGatewayMethod = vi.fn().mockResolvedValue({
      method: { name: "business.tasks.list", category: "business", scope: "operator.read" },
      paramsSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "integer" },
        },
      },
      exampleParams: { status: "running", limit: 20 },
      callTemplate: '/gateway-call business.tasks.list {"status":"running","limit":20}',
    });
    const { handleCommand, addSystem } = createHarness({ describeGatewayMethod });

    await handleCommand("/method business.tasks.list");

    expect(describeGatewayMethod).toHaveBeenCalledWith("business.tasks.list");
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business.tasks.list"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("operator.read"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Params schema"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("/gateway-call business.tasks.list"));
  });

  it("captures and searches persistent experience from TUI commands", async () => {
    const captureExperience = vi.fn().mockResolvedValue({
      event: { id: "exp_1", kind: "lesson", summary: "remember deploy lesson" },
    });
    const searchExperience = vi.fn().mockResolvedValue({
      query: "deploy",
      results: [
        { type: "event", id: "exp_1", summary: "remember deploy lesson", score: 2 },
      ],
    });
    const getExperienceSummary = vi.fn().mockResolvedValue({
      counts: { events: 1, skillCandidates: 0 },
      recentEvents: [{ id: "exp_1", summary: "remember deploy lesson" }],
    });
    const { handleCommand, addSystem } = createHarness({
      captureExperience,
      searchExperience,
      getExperienceSummary,
    });

    await handleCommand("/experience-capture remember deploy lesson");
    await handleCommand("/experience-search deploy");
    await handleCommand("/experience-summary");

    expect(captureExperience).toHaveBeenCalledWith({
      kind: "lesson",
      summary: "remember deploy lesson",
      source: "tui",
      sessionKey: "agent:main:main",
    });
    expect(searchExperience).toHaveBeenCalledWith({ query: "deploy" });
    expect(getExperienceSummary).toHaveBeenCalledWith({});
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("captured experience: exp_1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("experience search: deploy"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("events: 1"));
  });

  it("manages skill candidates and self model from TUI commands", async () => {
    const listSkillCandidates = vi.fn().mockResolvedValue({
      candidates: [{ id: "skill_candidate_1", title: "Deploy guard", status: "proposed" }],
    });
    const createSkillCandidate = vi.fn().mockResolvedValue({
      candidate: { id: "skill_candidate_2", title: "Log guard", status: "proposed" },
    });
    const getSelfModel = vi.fn().mockResolvedValue({
      selfModel: { strengths: ["gateway"], nextGrowthAreas: [] },
    });
    const updateSelfModel = vi.fn().mockResolvedValue({
      selfModel: { learnedPatterns: ["Prefer durable memory"] },
    });
    const { handleCommand, addSystem } = createHarness({
      listSkillCandidates,
      createSkillCandidate,
      getSelfModel,
      updateSelfModel,
    });

    await handleCommand("/skill-candidates");
    await handleCommand("/skill-candidate-create Log guard | log failure | inspect logs, fix root cause");
    await handleCommand("/self-model");
    await handleCommand("/self-model-update Prefer durable memory");

    expect(listSkillCandidates).toHaveBeenCalledWith({});
    expect(createSkillCandidate).toHaveBeenCalledWith({
      title: "Log guard",
      trigger: "log failure",
      steps: ["inspect logs", "fix root cause"],
    });
    expect(getSelfModel).toHaveBeenCalledWith({});
    expect(updateSelfModel).toHaveBeenCalledWith({
      learnedPatterns: ["Prefer durable memory"],
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("skill candidates: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("created skill candidate"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("self model"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Prefer durable memory"));
  });

  it("manages session recall, skill evolution, strategy memory, and user model from TUI commands", async () => {
    const recallSessionMemory = vi.fn().mockResolvedValue({
      query: "deploy",
      backend: "sqlite-fts5",
      summary: "deploy summary",
      hits: [{ id: "hit_1", path: "/tmp/session.jsonl", snippet: "deploy migrations", score: 1 }],
    });
    const recordSkillUsage = vi.fn().mockResolvedValue({
      usage: { id: "skill_usage_1", candidateId: "skill_candidate_1", outcome: "worked" },
      candidate: { id: "skill_candidate_1", title: "Deploy guard", status: "proposed" },
    });
    const exportSkillCandidate = vi.fn().mockResolvedValue({
      name: "deploy-guard",
      skillPath: "/tmp/deploy-guard/SKILL.md",
    });
    const captureStrategicMemory = vi.fn().mockResolvedValue({
      memory: { id: "strategy_1", title: "Skill harvest" },
    });
    const listDueStrategicPushes = vi.fn().mockResolvedValue({
      pushes: [{ id: "strategy_1", cadence: "weekly", prompt: "Review failures" }],
    });
    const advanceStrategicMemory = vi.fn().mockResolvedValue({
      memory: { id: "strategy_1", title: "Skill harvest" },
    });
    const updateUserModel = vi.fn().mockResolvedValue({
      userModel: { preferences: ["Prefer concise execution"] },
    });
    const queryUserModel = vi.fn().mockResolvedValue({
      answer: "Prefer concise execution",
      hypotheses: [{ claim: "Prefer concise execution", confidence: 0.8 }],
    });
    const { handleCommand, addSystem } = createHarness({
      recallSessionMemory,
      recordSkillUsage,
      exportSkillCandidate,
      captureStrategicMemory,
      listDueStrategicPushes,
      advanceStrategicMemory,
      updateUserModel,
      queryUserModel,
    });

    await handleCommand("/session-recall deploy");
    await handleCommand("/skill-usage-record skill_candidate_1 | worked | add smoke check");
    await handleCommand("/skill-export skill_candidate_1");
    await handleCommand("/strategy-memory Skill harvest | Review failures");
    await handleCommand("/strategy-due");
    await handleCommand("/strategy-advance strategy_1");
    await handleCommand("/user-model-update Prefer concise execution");
    await handleCommand("/user-model communication style");

    expect(recallSessionMemory).toHaveBeenCalledWith({ query: "deploy" });
    expect(recordSkillUsage).toHaveBeenCalledWith({
      candidateId: "skill_candidate_1",
      outcome: "worked",
      observations: ["add smoke check"],
    });
    expect(exportSkillCandidate).toHaveBeenCalledWith({ candidateId: "skill_candidate_1" });
    expect(captureStrategicMemory).toHaveBeenCalledWith({
      title: "Skill harvest",
      objective: "Review failures",
    });
    expect(listDueStrategicPushes).toHaveBeenCalledWith({});
    expect(advanceStrategicMemory).toHaveBeenCalledWith({ id: "strategy_1" });
    expect(updateUserModel).toHaveBeenCalledWith({
      preferences: ["Prefer concise execution"],
    });
    expect(queryUserModel).toHaveBeenCalledWith({ query: "communication style" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("session recall: deploy"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("recorded skill usage"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("exported skill"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("captured strategic memory"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("strategic pushes due: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("advanced strategic memory"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("user model updated"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("user model dialectic"));
  });

  it("exposes backend task, config, log, model, skill, agent-file, and MCP operations as direct TUI commands", async () => {
    const listBusinessTasks = vi.fn().mockResolvedValue({
      tasks: [{ id: "task_1", name: "Build API", status: "running", goal: "Connect backend" }],
    });
    const createBusinessTask = vi.fn().mockResolvedValue({
      task: { id: "task_2", name: "Wire MCP", status: "running", goal: "Connect MCP" },
    });
    const getConfig = vi.fn().mockResolvedValue({ raw: "{\"models\":{}}", path: "/tmp/assistant.json" });
    const patchConfig = vi.fn().mockResolvedValue({ ok: true, changedPaths: ["models"] });
    const tailLogs = vi.fn().mockResolvedValue({ lines: ["gateway ready"], cursor: 1, size: 1 });
    const listRemoteModels = vi.fn().mockResolvedValue({
      models: [{ id: "llama3", name: "llama3", provider: "local" }],
    });
    const getSkillsStatus = vi.fn().mockResolvedValue({
      ok: true,
      entries: [{ name: "deploy", status: "ready" }],
    });
    const searchSkills = vi.fn().mockResolvedValue({
      results: [{ slug: "deploy", displayName: "Deploy", score: 1 }],
    });
    const listAgentFiles = vi.fn().mockResolvedValue({
      files: [{ name: "MEMORY.md", exists: true, size: 6 }],
    });
    const getAgentFile = vi.fn().mockResolvedValue({
      file: { name: "MEMORY.md", content: "memory" },
    });
    const setAgentFile = vi.fn().mockResolvedValue({
      file: { name: "MEMORY.md", content: "memory" },
    });
    const listMcpTools = vi.fn().mockResolvedValue({
      tools: [{ name: "probe__echo", description: "Echo input" }],
    });
    const callMcpTool = vi.fn().mockResolvedValue({
      result: { content: [{ type: "text", text: "echo:hello" }] },
    });
    const { handleCommand, addSystem } = createHarness({
      listBusinessTasks,
      createBusinessTask,
      getConfig,
      patchConfig,
      tailLogs,
      listRemoteModels,
      getSkillsStatus,
      searchSkills,
      listAgentFiles,
      getAgentFile,
      setAgentFile,
      listMcpTools,
      callMcpTool,
    });

    await handleCommand("/tasks running");
    await handleCommand("/task-create Wire MCP | Connect MCP | long | high");
    await handleCommand("/config");
    await handleCommand('/config-patch {"models":{}}');
    await handleCommand("/logs 5");
    await handleCommand("/remote-models ollama mock://local local");
    await handleCommand("/skills");
    await handleCommand("/skill-search deploy");
    await handleCommand("/agent-files");
    await handleCommand("/agent-file MEMORY.md");
    await handleCommand("/agent-file-set MEMORY.md | memory");
    await handleCommand("/mcp-tools");
    await handleCommand('/mcp-call probe__echo {"text":"hello"}');

    expect(listBusinessTasks).toHaveBeenCalledWith({ status: "running" });
    expect(createBusinessTask).toHaveBeenCalledWith({
      name: "Wire MCP",
      goal: "Connect MCP",
      duration: "long",
      priority: "high",
    });
    expect(getConfig).toHaveBeenCalledWith({});
    expect(patchConfig).toHaveBeenCalledWith({ raw: "{\"models\":{}}" });
    expect(tailLogs).toHaveBeenCalledWith({ limit: 5 });
    expect(listRemoteModels).toHaveBeenCalledWith({
      api: "ollama",
      endpoint: "mock://local",
      provider: "local",
    });
    expect(getSkillsStatus).toHaveBeenCalledWith({});
    expect(searchSkills).toHaveBeenCalledWith({ query: "deploy" });
    expect(listAgentFiles).toHaveBeenCalledWith({ agentId: "main" });
    expect(getAgentFile).toHaveBeenCalledWith({ agentId: "main", name: "MEMORY.md" });
    expect(setAgentFile).toHaveBeenCalledWith({
      agentId: "main",
      name: "MEMORY.md",
      content: "memory",
    });
    expect(listMcpTools).toHaveBeenCalledWith({});
    expect(callMcpTool).toHaveBeenCalledWith({
      name: "probe__echo",
      arguments: { text: "hello" },
    });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("business tasks: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("created task: task_2"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("config /tmp/assistant.json"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("config patched: models"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("logs tail: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("remote models: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("skills status"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("skill search: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("agent files: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("agent file MEMORY.md"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("agent file saved: MEMORY.md"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("MCP tools: 1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("MCP call probe__echo"));
  });

  it("rejects invalid /activation values before patching the session", async () => {
    const { handleCommand, patchSession, addSystem } = createHarness();

    await handleCommand("/activation sometimes");

    expect(patchSession).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("usage: /activation <mention|always>");
  });

  it("patches the session for valid /activation values", async () => {
    const refreshSessionInfo = vi.fn().mockResolvedValue(undefined);
    const applySessionInfoFromPatch = vi.fn();
    const patchSession = vi.fn().mockResolvedValue({ groupActivation: "always" });
    const { handleCommand, addSystem } = createHarness({
      patchSession,
      refreshSessionInfo,
      applySessionInfoFromPatch,
    });

    await handleCommand("/activation always");

    expect(patchSession).toHaveBeenCalledWith({
      key: "agent:main:main",
      groupActivation: "always",
    });
    expect(addSystem).toHaveBeenCalledWith("activation set to always");
    expect(applySessionInfoFromPatch).toHaveBeenCalledWith({ groupActivation: "always" });
    expect(refreshSessionInfo).toHaveBeenCalledTimes(1);
  });
});
