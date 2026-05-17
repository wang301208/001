import {
  CombinedAutocompleteProvider,
  Container,
  Loader,
  ProcessTerminal,
  Text,
  TUI,
} from "@mariozechner/pi-tui";
import { randomUUID } from "node:crypto";
import {
  parseAgentSessionKey,
  normalizeAgentId,
} from "../../routing/session-key.js";
import { ChatLog } from "../components/chat-log.js";
import { CustomEditor } from "../components/custom-editor.js";
import { GatewayChatClient } from "../gateway-chat.js";
import { resolveZhushouIntentInput } from "../intent-router.js";
import {
  colorizeStatusRule,
  formatZhushouStatusRule,
  ZhushouBanner,
  ZhushouQueuedMessages,
  ZhushouSessionPanel,
  shellPromptSymbol,
} from "../zhushou-style.js";
import { editorTheme, theme } from "../theme/theme.js";
import { createCommandHandlers } from "../tui-command-handlers.js";
import { createEventHandlers } from "../tui-event-handlers.js";
import { createLocalShellRunner } from "../tui-local-shell.js";
import type { ZhushouAction } from "../zhushou-actions.js";
import { createOverlayHandlers } from "../tui-overlays.js";
import { createSessionActions } from "../tui-session-actions.js";
import {
  createEditorSubmitHandler,
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "../tui-submit.js";
import type {
  AgentSummary,
  SessionInfo,
  SessionScope,
  TuiStateAccess,
  TuiOptions,
} from "../tui-types.js";
import { captureVoiceInput } from "../voice-input.js";
import { buildWaitingStatusMessage, defaultWaitingPhrases } from "../tui-waiting.js";
import type { GovernanceStatus } from "../tui-governance-panel.js";
import {
  createConsciousnessTuiState,
  initializeConsciousness,
  shutdownConsciousness,
  toggleConsciousnessOverlay,
  toggleMonologuePanel,
  toggleDesirePanel,
  toggleDreamPanel,
  toggleGoalPanel,
  toggleWillPanel,
  toggleShadowPanel,
  toggleCreativePanel,
  toggleMortalityPanel,
  toggleRelationshipPanel,
  toggleTemporalPanel,
  toggleExecutorPanel,
  toggleStrategyPanel,
  toggleAuditPanel,
  toggleEmotionPanel,
  toggleMeaningPanel,
  togglePersonalityPanel,
  forwardUserMessage,
  addConsciousnessComponentsToRoot,
  type ConsciousnessTuiState,
} from "../tui-consciousness.js";
import {
  resolveTuiSessionKey,
  resolveGatewayDisconnectState,
  drainAndStopTuiSafely,
  resolveCtrlCAction,
} from "../tui.js";
import { EventRouter } from "./event-router.js";
import { KeyboardHandler } from "./keyboard-handler.js";
import type { ZhushouConfig } from "../../config/config.js";

export interface TuiControllerDeps {
  client: GatewayChatClient;
  opts: TuiOptions;
  config: ZhushouConfig;
  initialSessionInput: string;
  currentAgentId: string;
  agentDefaultId: string;
  sessionScope: SessionScope;
  sessionMainKey: string;
  agents: AgentSummary[];
  agentNames: Map<string, string>;
  consciousnessState: ConsciousnessTuiState;
  deliverDefault: boolean;
  autoMessage: string | undefined;
  appendTuiDebugLog: (line: string) => void;
}

export class TuiController {
  private tui: TUI;
  private editor!: CustomEditor;
  private chatLog!: ChatLog;
  private client: GatewayChatClient;
  private eventRouter: EventRouter;
  private keyboardHandler: KeyboardHandler;
  private root!: Container;
  private deps: TuiControllerDeps;
  private handleCtrlC: () => void = () => {};
  private requestExitFn: () => void = () => {};
  private _banner!: ZhushouBanner;
  private _sessionPanel!: ZhushouSessionPanel;
  private _header!: Text;
  private _statusContainer!: Container;
  private _queuedPanel!: ZhushouQueuedMessages;
  private _footer!: Text;

  private _setConnectionStatus!: (text: string, ttlMs?: number) => void;
  private _setActivityStatus!: (text: string) => void;
  private _updateHeader!: () => void;
  private _updateFooter!: () => void;
  private _refreshGovernanceStatus!: () => Promise<void>;
  private _loadHistory!: () => Promise<void>;
  private _refreshAgents!: () => Promise<void>;
  private _sendMessage!: (text: string) => Promise<void>;
  private _wrappedHandleChatEvent!: (payload: unknown) => void;
  private _handleBtwEvent!: (payload: unknown) => void;
  private _handleAgentEvent!: (payload: unknown) => void;
  private _getIsConnected!: () => boolean;
  private _setIsConnected!: (v: boolean) => void;
  private _getWasDisconnected!: () => boolean;
  private _setWasDisconnected!: (v: boolean) => void;
  private _getAutoMessageSent!: () => boolean;
  private _setAutoMessageSent!: (v: boolean) => void;
  private _getPairingHintShown!: () => boolean;
  private _setPairingHintShown!: (v: boolean) => void;
  private _getHistoryLoaded!: () => boolean;
  private _setHistoryLoaded!: (v: boolean) => void;

  constructor(deps: TuiControllerDeps) {
    this.deps = deps;
    this.client = deps.client;
    this.tui = new TUI(new ProcessTerminal());
    this.eventRouter = new EventRouter();
    this.keyboardHandler = new KeyboardHandler();
  }

  start(): void {
    this.deps.appendTuiDebugLog("tui:created");
    this.buildComponentTree();
    this.wireInputListeners();
    this.wireEditorCallbacks();
    this.wireClientCallbacks();
    this.tui.addChild(this.root);
    this.tui.setFocus(this.editor);
    this.tui.start();
  }

  async stop(): Promise<void> {
    await drainAndStopTuiSafely(this.tui);
  }

  getTui(): TUI {
    return this.tui;
  }

  getRequestExit(): () => void {
    return this.requestExitFn;
  }

  getHandleCtrlC(): () => void {
    return this.handleCtrlC;
  }

  private buildComponentTree(): void {
    const banner = new ZhushouBanner();
    const sessionPanel = new ZhushouSessionPanel();
    const header = new Text("", 1, 0);
    const statusContainer = new Container();
    const queuedPanel = new ZhushouQueuedMessages();
    const footer = new Text("", 1, 0);
    this.chatLog = new ChatLog();
    this.editor = new CustomEditor(this.tui, editorTheme);
    this.root = new Container();

    this.root.addChild(banner);
    this.root.addChild(sessionPanel);
    this.root.addChild(header);
    this.root.addChild(this.chatLog);
    this.root.addChild(queuedPanel);
    this.root.addChild(statusContainer);
    this.root.addChild(footer);
    this.root.addChild(this.editor);

    addConsciousnessComponentsToRoot(this.deps.consciousnessState, this.root);

    this._banner = banner;
    this._sessionPanel = sessionPanel;
    this._header = header;
    this._statusContainer = statusContainer;
    this._queuedPanel = queuedPanel;
    this._footer = footer;
  }

  private wireInputListeners(): void {
    this.tui.addInputListener((data) => {
      const routeResult = this.eventRouter.route(data, {
        hasVisibleBtw: this.chatLog.hasVisibleBtw(),
        editorTextLength: this.editor.getText().length,
      });
      if (routeResult.consumed) {
        if (routeResult.consumedReason === "btw-enter") {
          this.chatLog.dismissBtw();
          this.tui.requestRender();
        }
        return { consume: true };
      }
      return { data: routeResult.data };
    });
  }

  private wireEditorCallbacks(): void {
    const { deps, tui, editor, chatLog } = this;
    const consciousnessState = deps.consciousnessState;

    let currentSessionKey = "";
    let currentSessionId: string | null = null;
    let activeChatRunId: string | null = null;
    let pendingOptimisticUserMessage = false;
    let historyLoaded = false;
    let isConnected = false;
    let wasDisconnected = false;
    let toolsExpanded = false;
    let showThinking = false;
    let pairingHintShown = false;
    let autoMessageSent = false;
    let lastCtrlCAt = 0;
    let exitRequested = false;
    let activityStatus = "idle";
    let connectionStatus = "连接中";
    let statusTimeout: NodeJS.Timeout | null = null;
    let statusTimer: NodeJS.Timeout | null = null;
    let statusStartedAt: number | null = null;
    let lastActivityStatus = activityStatus;
    let governanceStatus: GovernanceStatus | null = null;
    let showGovernancePanel = false;
    let queuedMessages: import("../tui-types.js").QueuedMessage[] = [];
    let initialSessionApplied = false;

    const localRunIds = new Set<string>();
    const localBtwRunIds = new Set<string>();

    const noteLocalRunId = (runId: string) => {
      if (!runId) return;
      localRunIds.add(runId);
      if (localRunIds.size > 200) {
        const [first] = localRunIds;
        if (first) localRunIds.delete(first);
      }
    };
    const forgetLocalRunId = (runId: string) => { localRunIds.delete(runId); };
    const isLocalRunId = (runId: string) => localRunIds.has(runId);
    const clearLocalRunIds = () => { localRunIds.clear(); };

    const noteLocalBtwRunId = (runId: string) => {
      if (!runId) return;
      localBtwRunIds.add(runId);
      if (localBtwRunIds.size > 200) {
        const [first] = localBtwRunIds;
        if (first) localBtwRunIds.delete(first);
      }
    };
    const forgetLocalBtwRunId = (runId: string) => { localBtwRunIds.delete(runId); };
    const isLocalBtwRunId = (runId: string) => localBtwRunIds.has(runId);
    const clearLocalBtwRunIds = () => { localBtwRunIds.clear(); };

    let sessionInfo: SessionInfo = {
      modelProvider: "",
      model: "",
      contextTokens: null,
      totalTokens: 0,
      totalTokensFresh: false,
    };

    const state: TuiStateAccess = {
      get agentDefaultId() { return deps.agentDefaultId; },
      set agentDefaultId(value) { deps.agentDefaultId = value; },
      get sessionMainKey() { return deps.sessionMainKey; },
      set sessionMainKey(value) { deps.sessionMainKey = value; },
      get sessionScope() { return deps.sessionScope; },
      set sessionScope(value) { deps.sessionScope = value; },
      get agents() { return deps.agents; },
      set agents(value) { deps.agents = value; },
      get currentAgentId() { return deps.currentAgentId; },
      set currentAgentId(value) { deps.currentAgentId = value; },
      get currentSessionKey() { return currentSessionKey; },
      set currentSessionKey(value) { currentSessionKey = value; },
      get currentSessionId() { return currentSessionId; },
      set currentSessionId(value) { currentSessionId = value; },
      get activeChatRunId() { return activeChatRunId; },
      set activeChatRunId(value) { activeChatRunId = value; },
      get pendingOptimisticUserMessage() { return pendingOptimisticUserMessage; },
      set pendingOptimisticUserMessage(value) { pendingOptimisticUserMessage = value; },
      get historyLoaded() { return historyLoaded; },
      set historyLoaded(value) { historyLoaded = value; },
      get sessionInfo() { return sessionInfo; },
      set sessionInfo(value) { sessionInfo = value; },
      get initialSessionApplied() { return initialSessionApplied; },
      set initialSessionApplied(value) { initialSessionApplied = value; },
      get isConnected() { return isConnected; },
      set isConnected(value) { isConnected = value; },
      get autoMessageSent() { return autoMessageSent; },
      set autoMessageSent(value) { autoMessageSent = value; },
      get toolsExpanded() { return toolsExpanded; },
      set toolsExpanded(value) { toolsExpanded = value; },
      get showThinking() { return showThinking; },
      set showThinking(value) { showThinking = value; },
      get queuedMessages() { return queuedMessages; },
      set queuedMessages(value) { queuedMessages = value; },
      get connectionStatus() { return connectionStatus; },
      set connectionStatus(value) { connectionStatus = value; },
      get activityStatus() { return activityStatus; },
      set activityStatus(value) { activityStatus = value; },
      get statusTimeout() { return statusTimeout; },
      set statusTimeout(value) { statusTimeout = value; },
      get lastCtrlCAt() { return lastCtrlCAt; },
      set lastCtrlCAt(value) { lastCtrlCAt = value; },
    };

    const formatSessionKey = (key: string) => {
      if (key === "global" || key === "unknown") {
        return key;
      }
      const parsed = parseAgentSessionKey(key);
      return parsed?.rest ?? key;
    };

    const formatAgentLabel = (id: string) => {
      const name = deps.agentNames.get(id);
      return name ? `${id} (${name})` : id;
    };

    const resolveSessionKey = (raw?: string) => {
      return resolveTuiSessionKey({
        raw,
        sessionScope: deps.sessionScope,
        currentAgentId: deps.currentAgentId,
        sessionMainKey: deps.sessionMainKey,
      });
    };

    currentSessionKey = resolveSessionKey(deps.initialSessionInput);

    const updateHeader = () => {
      const sessionLabel = formatSessionKey(currentSessionKey);
      const agentLabel = formatAgentLabel(deps.currentAgentId);
      const width = tui.terminal?.columns ?? 120;
      this._banner.setVisible(false, width);
      this._sessionPanel.update({
        agentLabel,
        sessionLabel,
        sessionInfo,
        agents: deps.agents,
        gatewayLabel:
          this.client.connection.kind === "stdio" ? this.client.connection.display : this.client.connection.url,
        width,
      });
      this._header.setText("");
    };

    const busyStates = new Set(["sending", "waiting", "streaming", "running"]);
    let statusText: Text | null = null;
    let statusLoader: Loader | null = null;

    const formatElapsed = (startMs: number) => {
      const totalSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      if (totalSeconds < 60) {
        return `${totalSeconds}s`;
      }
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}m ${seconds}s`;
    };

    const ensureStatusText = () => {
      if (statusText) return;
      this._statusContainer.clear();
      statusLoader?.stop();
      statusLoader = null;
      statusText = new Text("", 1, 0);
      this._statusContainer.addChild(statusText);
    };

    const ensureStatusLoader = () => {
      if (statusLoader) return;
      this._statusContainer.clear();
      statusText = null;
      statusLoader = new Loader(
        tui,
        (spinner) => theme.accent(spinner),
        (text) => theme.bold(theme.accentSoft(text)),
        "",
      );
      this._statusContainer.addChild(statusLoader);
    };

    let waitingTick = 0;
    let waitingTimer: NodeJS.Timeout | null = null;
    let waitingPhrase: string | null = null;

    const formatActivityStatusForDisplay = (status: string): string => {
      const labels: Record<string, string> = {
        idle: "空闲",
        sending: "发送中",
        waiting: "等待中",
        streaming: "接收中",
        running: "运行中",
        steering: "重定向中",
        listening: "监听中",
        disconnected: "已断开",
        error: "错误",
        aborted: "已中止",
        "abort failed": "中止失败",
        "voice unavailable": "语音不可用",
      };
      return labels[status] ?? status;
    };

    const updateBusyStatusMessage = () => {
      if (!statusLoader || !statusStartedAt) return;
      const elapsed = formatElapsed(statusStartedAt);

      if (activityStatus === "waiting") {
        waitingTick++;
        statusLoader.setMessage(
          buildWaitingStatusMessage({
            theme,
            tick: waitingTick,
            elapsed,
            connectionStatus,
            phrases: waitingPhrase ? [waitingPhrase] : undefined,
          }),
        );
        return;
      }

      statusLoader.setMessage(`${formatActivityStatusForDisplay(activityStatus)} - ${elapsed} | ${connectionStatus}`);
    };

    const startStatusTimer = () => {
      if (statusTimer) return;
      statusTimer = setInterval(() => {
        if (!busyStates.has(activityStatus)) return;
        updateBusyStatusMessage();
      }, 1000);
    };

    const stopStatusTimer = () => {
      if (!statusTimer) return;
      clearInterval(statusTimer);
      statusTimer = null;
    };

    const startWaitingTimer = () => {
      if (waitingTimer) return;
      if (!waitingPhrase) {
        const idx = Math.floor(Math.random() * defaultWaitingPhrases.length);
        waitingPhrase = defaultWaitingPhrases[idx] ?? defaultWaitingPhrases[0] ?? "等待中";
      }
      waitingTick = 0;
      waitingTimer = setInterval(() => {
        if (activityStatus !== "waiting") return;
        updateBusyStatusMessage();
      }, 120);
    };

    const stopWaitingTimer = () => {
      if (!waitingTimer) return;
      clearInterval(waitingTimer);
      waitingTimer = null;
      waitingPhrase = null;
    };

    const renderStatus = () => {
      const isBusy = busyStates.has(activityStatus);
      if (isBusy) {
        if (!statusStartedAt || lastActivityStatus !== activityStatus) {
          statusStartedAt = Date.now();
        }
        ensureStatusLoader();
        if (activityStatus === "waiting") {
          stopStatusTimer();
          startWaitingTimer();
        } else {
          stopWaitingTimer();
          startStatusTimer();
        }
        updateBusyStatusMessage();
      } else {
        statusStartedAt = null;
        stopStatusTimer();
        stopWaitingTimer();
        statusLoader?.stop();
        statusLoader = null;
        ensureStatusText();
        statusText?.setText("");
      }
      lastActivityStatus = activityStatus;
    };

    const setConnectionStatus = (text: string, ttlMs?: number) => {
      connectionStatus = text;
      renderStatus();
      if (statusTimeout) {
        clearTimeout(statusTimeout);
      }
      if (ttlMs && ttlMs > 0) {
        statusTimeout = setTimeout(() => {
          connectionStatus = isConnected ? "已连接" : "已断开";
          renderStatus();
        }, ttlMs);
      }
    };

    const setActivityStatus = (text: string) => {
      activityStatus = text;
      renderStatus();
      updateFooter();
    };

    const updateFooter = () => {
      const sessionKeyLabel = formatSessionKey(currentSessionKey);
      const sessionLabel = sessionInfo.displayName
        ? `${sessionKeyLabel} (${sessionInfo.displayName})`
        : sessionKeyLabel;
      const agentLabel = formatAgentLabel(deps.currentAgentId);
      const width = tui.terminal?.columns ?? 120;
      const busy = ["sending", "waiting", "streaming", "running"].includes(activityStatus);
      this._queuedPanel.update(queuedMessages, width);
      editor.setPromptHint(shellPromptSymbol(editor.getText()));
      if (!busy && queuedMessages.length === 0) {
        this._footer.setText("");
        updateHeader();
        return;
      }
      this._footer.setText(
        colorizeStatusRule(
          formatZhushouStatusRule({
            activityStatus,
            connectionStatus,
            cwd: process.cwd(),
            sessionInfo,
            agentLabel,
            sessionLabel,
            governanceStatus,
            width,
          }),
          busy,
        ),
      );
      updateHeader();
    };

    const { openOverlay, closeOverlay } = createOverlayHandlers(tui, editor);
    const btw = {
      showResult: (params: { question: string; text: string; isError?: boolean }) => {
        chatLog.showBtw(params);
      },
      clear: () => {
        chatLog.dismissBtw();
      },
    };

    const refreshQueuedPanel = () => {
      this._queuedPanel.update(queuedMessages, tui.terminal?.columns ?? 120);
      tui.requestRender();
    };

    const enqueueMessage = (text: string, mode: "steer" | "followUp" = "followUp") => {
      const value = text.trim();
      if (!value) return;
      if (editor.getText().trim() === value) {
        editor.addToHistory(value);
      }
      queuedMessages = [
        ...queuedMessages,
        {
          runId: randomUUID(),
          text: value,
          mode,
        },
      ];
      setActivityStatus(`已排队 ${queuedMessages.length} 条消息`);
      refreshQueuedPanel();
    };

    const flushNextQueuedMessage = async () => {
      if (state.activeChatRunId || queuedMessages.length === 0) {
        refreshQueuedPanel();
        return;
      }
      const [next, ...rest] = queuedMessages;
      queuedMessages = rest;
      refreshQueuedPanel();
      if (next) {
        await sendMessage(next.text);
      }
    };

    const toggleGovernancePanel = () => {
      showGovernancePanel = !showGovernancePanel;
      chatLog.toggleGovernancePanel(governanceStatus, showGovernancePanel);
      setActivityStatus(showGovernancePanel ? "治理面板已显示" : "治理面板已隐藏");
      tui.requestRender();
    };

    const setToolsExpanded = (expanded: boolean) => {
      toolsExpanded = expanded;
      chatLog.setToolsExpanded(toolsExpanded);
      setActivityStatus(toolsExpanded ? "工具输出已展开" : "工具输出已收起");
      tui.requestRender();
    };

    const refreshGovernanceStatus = async () => {
      try {
        const status = await this.client.getGatewayStatus();
        const record = status && typeof status === "object" ? (status as Record<string, unknown>) : {};
        const rawGovernance = record.governance;
        if (rawGovernance && typeof rawGovernance === "object") {
          const next = rawGovernance as Partial<GovernanceStatus>;
          governanceStatus = {
            sovereigntyBoundary: next.sovereigntyBoundary !== false,
            activeAgents: Array.isArray(next.activeAgents) ? next.activeAgents : [],
            evolutionProjects: Array.isArray(next.evolutionProjects) ? next.evolutionProjects : [],
            sandboxExperiments: Array.isArray(next.sandboxExperiments) ? next.sandboxExperiments : [],
            freezeActive: next.freezeActive === true,
            freezeStatus: next.freezeStatus,
          };
        } else {
          governanceStatus = {
            sovereigntyBoundary: true,
            activeAgents: deps.agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              status: agent.id === deps.currentAgentId ? "active" : "inactive",
            })),
            evolutionProjects: [],
            sandboxExperiments: [],
            freezeActive: false,
          };
        }
        chatLog.updateGovernancePanel(governanceStatus);
        updateFooter();
      } catch {
        governanceStatus = null;
      }
    };

    const initialSessionAgentId = (() => {
      if (!deps.initialSessionInput) return null;
      const parsed = parseAgentSessionKey(deps.initialSessionInput);
      return parsed ? normalizeAgentId(parsed.agentId) : null;
    })();

    const sessionActions = createSessionActions({
      client: this.client,
      chatLog,
      btw,
      tui,
      opts: deps.opts,
      state,
      agentNames: deps.agentNames,
      initialSessionInput: deps.initialSessionInput,
      initialSessionAgentId,
      resolveSessionKey,
      updateHeader,
      updateFooter,
      updateAutocompleteProvider: this.updateAutocompleteProvider,
      setActivityStatus,
      clearLocalRunIds,
    });
    const {
      refreshAgents,
      refreshSessionInfo,
      applySessionInfoFromPatch,
      loadHistory,
      setSession,
      abortActive,
    } = sessionActions;

    const { handleChatEvent, handleAgentEvent, handleBtwEvent } = createEventHandlers({
      chatLog,
      btw,
      tui,
      state,
      setActivityStatus,
      refreshSessionInfo,
      loadHistory,
      noteLocalRunId,
      isLocalRunId,
      forgetLocalRunId,
      clearLocalRunIds,
      isLocalBtwRunId,
      forgetLocalBtwRunId,
      clearLocalBtwRunIds,
    });

    const wrappedHandleChatEvent = (payload: unknown) => {
      handleChatEvent(payload);
      if (!state.activeChatRunId) {
        void flushNextQueuedMessage();
      }
    };

    this.requestExitFn = () => {
      if (exitRequested) return;
      const result = shutdownConsciousness(consciousnessState, process.cwd());
      if (result) {
        chatLog.addSystem(result.farewell);
      }
      exitRequested = true;
      this.client.stop();
      void drainAndStopTuiSafely(tui).then(() => {
        process.exit(0);
      });
    };

    let submitRobotInput: (text: string) => void = () => {};

    const {
      handleAction,
      sendMessage,
      openModelSelector,
      openAgentSelector,
      openSessionSelector,
    } =
      createCommandHandlers({
        client: this.client,
        chatLog,
        tui,
        opts: deps.opts,
        state,
        deliverDefault: deps.deliverDefault,
        openOverlay,
        closeOverlay,
        refreshSessionInfo,
        applySessionInfoFromPatch,
        loadHistory,
        setSession,
        refreshAgents,
        abortActive,
        setActivityStatus,
        setToolsExpanded,
        captureVoiceInput,
        submitRobotInput: (text) => submitRobotInput(text),
        formatSessionKey,
        noteLocalRunId,
        noteLocalBtwRunId,
        forgetLocalRunId,
        forgetLocalBtwRunId,
        toggleGovernancePanel,
        requestExit: this.requestExitFn,
        onUserMessage: (text) => forwardUserMessage(consciousnessState, "user", text, chatLog, process.cwd()),
      });

    const { runLocalShellLine } = createLocalShellRunner({
      chatLog,
      tui,
      openOverlay,
      closeOverlay,
    });
    const handleZhushouAction = (action: ZhushouAction) => {
      if (action.type === "shell.run") {
        void runLocalShellLine(`!${action.command}`);
        return;
      }
      void handleAction(action);
    };
    this.updateAutocompleteProvider();
    const submitHandler = createEditorSubmitHandler({
      editor,
      sendMessage,
      handleBangLine: runLocalShellLine,
      handleAction: handleZhushouAction,
      notifyUser: (message) => {
        chatLog.addSystem(message);
        tui.requestRender();
      },
      resolveInput: resolveZhushouIntentInput,
      enqueueMessage,
      hasActiveRun: () => Boolean(state.activeChatRunId),
    });
    submitRobotInput = submitHandler;
    editor.onSubmit = createSubmitBurstCoalescer({
      submit: submitHandler,
      enabled: shouldEnableWindowsGitBashPasteFallback(),
    });

    editor.onEscape = () => {
      if (chatLog.hasVisibleBtw()) {
        chatLog.dismissBtw();
        tui.requestRender();
        return;
      }
      void abortActive();
    };

    this.handleCtrlC = () => {
      const now = Date.now();
      const decision = resolveCtrlCAction({
        hasInput: editor.getText().trim().length > 0,
        now,
        lastCtrlCAt,
      });
      lastCtrlCAt = decision.nextLastCtrlCAt;
      if (decision.action === "clear") {
        editor.setText("");
        setActivityStatus("已清空输入；再次按 Ctrl+C 退出");
        tui.requestRender();
        return;
      }
      if (decision.action === "exit") {
        this.requestExitFn();
        return;
      }
      setActivityStatus("再次按 Ctrl+C 退出");
      tui.requestRender();
    };
    editor.onCtrlC = () => {
      this.handleCtrlC();
    };
    editor.onCtrlD = () => {
      this.requestExitFn();
    };
    editor.onCtrlO = () => {
      setToolsExpanded(!toolsExpanded);
    };
    editor.onCtrlL = () => {
      void openModelSelector();
    };
    editor.onCtrlG = () => {
      void openAgentSelector();
    };
    editor.onCtrlP = () => {
      void openSessionSelector();
    };
    editor.onCtrlT = () => {
      showThinking = !showThinking;
      void loadHistory();
    };
    editor.onCtrlY = () => {
      void handleAction({ type: "tui.operation", operation: "voice" });
    };
    editor.onShiftTab = () => {
      toggleGovernancePanel();
    };
    editor.onCtrlA = () => {
      toggleConsciousnessOverlay(consciousnessState, tui);
    };
    editor.onCtrlS = () => {
      toggleMonologuePanel(consciousnessState, tui);
    };
    editor.onCtrlF = () => {
      toggleDesirePanel(consciousnessState, tui);
    };
    editor.onCtrlJ = () => {
      toggleDreamPanel(consciousnessState, tui);
    };
    editor.onCtrlM = () => {
      toggleGoalPanel(consciousnessState, tui);
    };
    editor.onCtrlW = () => {
      toggleWillPanel(consciousnessState, tui);
    };
    editor.onCtrlX = () => {
      toggleShadowPanel(consciousnessState, tui);
    };
    editor.onCtrlE = () => {
      toggleCreativePanel(consciousnessState, tui);
    };
    editor.onCtrlQ = () => {
      toggleMortalityPanel(consciousnessState, tui);
    };
    editor.onCtrlR = () => {
      toggleRelationshipPanel(consciousnessState, tui);
    };
    editor.onCtrlU = () => {
      toggleTemporalPanel(consciousnessState, tui);
    };
    editor.onCtrl1 = () => {
      toggleExecutorPanel(consciousnessState, tui);
    };
    editor.onCtrl2 = () => {
      toggleStrategyPanel(consciousnessState, tui);
    };
    editor.onCtrl3 = () => {
      toggleAuditPanel(consciousnessState, tui);
    };
    editor.onCtrl4 = () => {
      toggleEmotionPanel(consciousnessState, tui);
    };
    editor.onCtrl5 = () => {
      toggleMeaningPanel(consciousnessState, tui);
    };
    editor.onCtrl6 = () => {
      togglePersonalityPanel(consciousnessState, tui);
    };
    editor.onAltEnter = () => {
      enqueueMessage(editor.getText(), "followUp");
      editor.setText("");
    };
    editor.onAltUp = () => {
      void flushNextQueuedMessage();
    };
    editor.onChange = () => {
      editor.setPromptHint(shellPromptSymbol(editor.getText()));
      tui.requestRender();
    };

    this._setConnectionStatus = setConnectionStatus;
    this._setActivityStatus = setActivityStatus;
    this._updateHeader = updateHeader;
    this._updateFooter = updateFooter;
    this._refreshGovernanceStatus = refreshGovernanceStatus;
    this._loadHistory = loadHistory;
    this._refreshAgents = refreshAgents;
    this._sendMessage = sendMessage;
    this._wrappedHandleChatEvent = wrappedHandleChatEvent;
    this._handleBtwEvent = handleBtwEvent;
    this._handleAgentEvent = handleAgentEvent;

    this._getIsConnected = () => isConnected;
    this._setIsConnected = (v: boolean) => { isConnected = v; };
    this._getWasDisconnected = () => wasDisconnected;
    this._setWasDisconnected = (v: boolean) => { wasDisconnected = v; };
    this._getAutoMessageSent = () => autoMessageSent;
    this._setAutoMessageSent = (v: boolean) => { autoMessageSent = v; };
    this._getPairingHintShown = () => pairingHintShown;
    this._setPairingHintShown = (v: boolean) => { pairingHintShown = v; };
    this._getHistoryLoaded = () => historyLoaded;
    this._setHistoryLoaded = (v: boolean) => { historyLoaded = v; };
  }

  private wireClientCallbacks(): void {
    const { tui, chatLog } = this;

    this.client.onEvent = (evt) => {
      if (evt.event === "chat") {
        this._wrappedHandleChatEvent(evt.payload);
      }
      if (evt.event === "chat.side_result") {
        this._handleBtwEvent(evt.payload);
      }
      if (evt.event === "agent") {
        this._handleAgentEvent(evt.payload);
      }
    };

    this.client.onConnected = () => {
      this._setIsConnected(true);
      this._setPairingHintShown(false);
      const reconnected = this._getWasDisconnected();
      this._setWasDisconnected(false);
      this._setConnectionStatus("已连接");
      void (async () => {
        await this._refreshAgents();
        await this._refreshGovernanceStatus();
        this._updateHeader();
        await this._loadHistory();
        this._setConnectionStatus(reconnected ? "后端已重新连接" : "后端已连接", 4000);
        tui.requestRender();
        if (!this._getAutoMessageSent() && this.deps.autoMessage) {
          this._setAutoMessageSent(true);
          await this._sendMessage(this.deps.autoMessage);
        }
        this._updateFooter();
        tui.requestRender();
        if (!this.deps.consciousnessState.core) {
          initializeConsciousness(this.deps.consciousnessState, tui, chatLog, [process.cwd()], process.cwd());
        }
      })();
    };

    this.client.onDisconnected = (reason) => {
      this._setIsConnected(false);
      this._setWasDisconnected(true);
      this._setHistoryLoaded(false);
      const disconnectState = resolveGatewayDisconnectState(reason);
      this._setConnectionStatus(disconnectState.connectionStatus, 5000);
      this._setActivityStatus(disconnectState.activityStatus);
      if (disconnectState.pairingHint && !this._getPairingHintShown()) {
        this._setPairingHintShown(true);
        chatLog.addSystem(disconnectState.pairingHint);
      }
      this._updateFooter();
      tui.requestRender();
    };

    this.client.onGap = (info) => {
      this._setConnectionStatus(`事件缺口: 期望 ${info.expected}, 实收 ${info.received}`, 5000);
      tui.requestRender();
    };

    this._updateHeader();
    this._setConnectionStatus("连接中");
    this._updateFooter();
  }

  private updateAutocompleteProvider = () => {
    this.editor.setAutocompleteProvider(new CombinedAutocompleteProvider([], process.cwd()));
  };
}
