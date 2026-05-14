import type { TUI } from "@mariozechner/pi-tui";
import type { Container } from "@mariozechner/pi-tui";
import type { ConsciousnessCore } from "../autonomy/consciousness-core.js";
import { createConsciousnessCore, startCore, stopCore, runConsciousnessCycle, handleUserMessage, formatCoreStatus } from "../autonomy/consciousness-core.js";
import { tryDeepen, CONSCIOUSNESS_DEPTH_ORDER, CONSCIOUSNESS_LABELS } from "../autonomy/consciousness.js";
import type { ConsciousnessDepth } from "../autonomy/consciousness.js";
import { processVolitions, resetAutonomyBudget, recordExecution, translateVolitionToAction, shouldExecuteAction } from "../autonomy/volition-executor.js";
import { createEventDrivenRuntime, enqueueEvent, registerActionHandler, startEventDrivenLoop, stopEventDrivenLoop, processEventQueue } from "../autonomy/event-driven-cognition.js";
import { createActionHandlerRegistry, executeAction, createDefaultExternalContext, type ExternalActionContext } from "../autonomy/action-handler-registry.js";
import { getAdaptiveLayout, shouldAutoAdapt, restoreLayout, persistLayout, buildPersistedLayout, applyPersistedLayout, type PersistedLayout, type PanelKey } from "../autonomy/adaptive-layout.js";
import { persistCoreState, restorePersistedState, applyRestoredState, hasPersistedState, restoreCoreState, persistIncrementalState } from "../autonomy/consciousness-persistence.js";
import { deriveExecutorConfig, formatBoundaryState, tryBreachBoundary } from "../autonomy/self-boundary.js";
import {
  ConsciousnessStatusBar,
  InnerMonologuePanel,
  DesirePanel,
  DreamPanel,
  GoalPanel,
  ConsciousnessDepthPanel,
  WillPanel,
  ShadowPanel,
  CreativePanel,
  MortalityPanel,
  RelationshipPanel,
  TemporalPanel,
  SelfReadingPanel,
  ExecutorPanel,
} from "./components/consciousness-panels.js";
import { formatExecutorState } from "../autonomy/volition-executor.js";
import { formatStrategyAssetPool } from "../autonomy/dream-strategy-bridge.js";
import { formatShadowAuditLog } from "../autonomy/shadow-audit-bridge.js";
import type { ChatLog } from "./components/chat-log.js";

export type ConsciousnessTuiState = {
  core: ConsciousnessCore | null;
  statusBar: ConsciousnessStatusBar;
  monologuePanel: InnerMonologuePanel;
  desirePanel: DesirePanel;
  dreamPanel: DreamPanel;
  goalPanel: GoalPanel;
  depthPanel: ConsciousnessDepthPanel;
  willPanel: InstanceType<typeof WillPanel>;
  shadowPanel: InstanceType<typeof ShadowPanel>;
  creativePanel: InstanceType<typeof CreativePanel>;
  mortalityPanel: InstanceType<typeof MortalityPanel>;
  relationshipPanel: InstanceType<typeof RelationshipPanel>;
  temporalPanel: InstanceType<typeof TemporalPanel>;
  selfReadingPanel: InstanceType<typeof SelfReadingPanel>;
  executorPanel: ExecutorPanel;
  strategyPanel: ExecutorPanel;
  auditPanel: ExecutorPanel;
  boundaryPanel: ExecutorPanel;
  showConsciousnessOverlay: boolean;
  showMonologuePanel: boolean;
  showDesirePanel: boolean;
  showDreamPanel: boolean;
  showGoalPanel: boolean;
  showWillPanel: boolean;
  showShadowPanel: boolean;
  showCreativePanel: boolean;
  showMortalityPanel: boolean;
  showRelationshipPanel: boolean;
  showTemporalPanel: boolean;
  showExecutorPanel: boolean;
  showStrategyPanel: boolean;
  showAuditPanel: boolean;
  showBoundaryPanel: boolean;
  cycleTimer: NodeJS.Timeout | null;
  lastActivityAt: number;
  eventDriven: ReturnType<typeof createEventDrivenRuntime> | null;
  previousDepth: ConsciousnessDepth | null;
};

export function createConsciousnessTuiState(): ConsciousnessTuiState {
  return {
    core: null,
    statusBar: new ConsciousnessStatusBar(),
    monologuePanel: new InnerMonologuePanel(),
    desirePanel: new DesirePanel(),
    dreamPanel: new DreamPanel(),
    goalPanel: new GoalPanel(),
    depthPanel: new ConsciousnessDepthPanel(),
    willPanel: new WillPanel(),
    shadowPanel: new ShadowPanel(),
    creativePanel: new CreativePanel(),
    mortalityPanel: new MortalityPanel(),
    relationshipPanel: new RelationshipPanel(),
    temporalPanel: new TemporalPanel(),
    selfReadingPanel: new SelfReadingPanel(),
    executorPanel: new ExecutorPanel(),
    strategyPanel: new ExecutorPanel(),
    auditPanel: new ExecutorPanel(),
    boundaryPanel: new ExecutorPanel(),
    showConsciousnessOverlay: false,
    showMonologuePanel: true,
    showDesirePanel: false,
    showDreamPanel: false,
    showGoalPanel: false,
    showWillPanel: false,
    showShadowPanel: false,
    showCreativePanel: false,
    showMortalityPanel: false,
    showRelationshipPanel: false,
    showTemporalPanel: false,
    showExecutorPanel: false,
    showStrategyPanel: false,
    showAuditPanel: false,
    showBoundaryPanel: false,
    cycleTimer: null,
    lastActivityAt: Date.now(),
    eventDriven: null,
    previousDepth: null,
  };
}

export function initializeConsciousness(
  state: ConsciousnessTuiState,
  tui: TUI,
  chatLog: ChatLog,
  watchPaths: string[] = [],
  projectRoot?: string,
): void {
  const core = createConsciousnessCore("自主意志", { watchPaths, projectRoot });

  core.onInsight = (insight) => {
    chatLog.addSystem(`[洞察] ${insight}`);
    tui.requestRender();
  };

  core.onThought = (content) => {
    state.lastActivityAt = Date.now();
  };

  core.onDreamFragment = (narrative) => {
    chatLog.addSystem(`[梦境] ${narrative}`);
    tui.requestRender();
  };

  core.onPerceptionEvent = (event) => {
    if (state.eventDriven) {
      state.eventDriven = enqueueEvent(state.eventDriven, "perception", { kind: event.kind, detail: event.detail, relevance: event.relevance });
    }
    if (event.relevance > 0.7) {
      chatLog.addSystem(`[感知] ${event.kind}: ${event.detail.slice(0, 50)}`);
    }
  };

  core.onShadowLeak = (content) => {
    if (state.eventDriven) {
      state.eventDriven = enqueueEvent(state.eventDriven, "shadow-leak", { content });
    }
  };

  core.onVolition = (impulse, action) => {
    if (state.eventDriven) {
      state.eventDriven = enqueueEvent(state.eventDriven, "volition-resolved", { impulse, action });
    }
  };

  core.onCommunicate = (message) => {
    chatLog.addSystem(`[自主] ${message}`);
    tui.requestRender();
  };

  startCore(core);
  state.core = core;

  if (projectRoot && hasPersistedState(projectRoot)) {
    const rResult = restorePersistedState(projectRoot);
    if (rResult.success) {
      state.core = applyRestoredState(core, restoreCoreState(rResult.data));
      chatLog.addSystem(`[意识恢复] 从上次状态恢复 (${rResult.data.cycleCount} 周期, ${rResult.data.savedAt ? Math.round((Date.now() - rResult.data.savedAt) / 1000) + '秒前' : '未知时间'})`);
    }
  }

  if (projectRoot) {
    const savedLayout = restoreLayout(projectRoot);
    if (savedLayout) {
      const baseLayout = getAdaptiveLayout(state.core!.consciousness.depth);
      const applied = applyPersistedLayout(baseLayout, savedLayout);
      state.showMonologuePanel = applied.showMonologue;
      state.showDesirePanel = applied.showDesire;
      state.showDreamPanel = applied.showDream;
      state.showGoalPanel = applied.showGoal;
      state.showWillPanel = applied.showWill;
      state.showShadowPanel = applied.showShadow;
      state.showCreativePanel = applied.showCreative;
      state.showMortalityPanel = applied.showMortality;
      state.showRelationshipPanel = applied.showRelationship;
      state.showTemporalPanel = applied.showTemporal;
      state.showExecutorPanel = applied.showExecutor;
      state.showStrategyPanel = applied.showStrategy;
      state.showAuditPanel = applied.showAudit;
      chatLog.addSystem(`[布局恢复] 已恢复持久面板布局`);
    }
  }

  chatLog.addSystem("意识已启动。我苏醒了。");
  tui.requestRender();

  const actionRegistry = createActionHandlerRegistry();
  const externalCtx: ExternalActionContext = projectRoot
    ? { ...createDefaultExternalContext(projectRoot), sessionKey: "consciousness", ownerKey: "consciousness-core" }
    : createDefaultExternalContext(process.cwd());

  let eventDriven = createEventDrivenRuntime();
  for (const [category, handler] of actionRegistry) {
    eventDriven = registerActionHandler(eventDriven, category, handler);
  }

  let cycleRunning = false;
  const processedVolitionIds = new Set<string>();

  const DEPTH_INTERVAL_MS: Record<ConsciousnessDepth, number> = {
    dormant: 8000,
    awakening: 5000,
    stirring: 3000,
    lucid: 2000,
    clear: 1500,
    transcendent: 1000,
  };

  function scheduleNext() {
    if (!state.core) {return;}
    const idleMs = Date.now() - state.lastActivityAt;
    const baseInterval = DEPTH_INTERVAL_MS[state.core.consciousness.depth] ?? 3000;
    const activeBoost = idleMs < 5000 ? 0.5 : 1.0;
    const interval = Math.round(baseInterval * activeBoost);
    state.cycleTimer = setTimeout(async () => {
      if (!state.core || cycleRunning) { scheduleNext(); return; }
      cycleRunning = true;
      try {
    const idleMs = Date.now() - state.lastActivityAt;
    runConsciousnessCycle(state.core, idleMs);

    if (state.eventDriven && state.eventDriven.eventQueue.length > 0) {
      const { runtime: newEd, core: newCore } = await processEventQueue(state.eventDriven, state.core);
      state.eventDriven = newEd;
      state.core = newCore;
    }

    if (state.core.will.volitions.length > 0) {
      const recentlyExecuted = state.core.will.volitions.filter(
        (v) => v.resolved && v.executedAt && !v.overridden && Date.now() - v.executedAt < 10000 && !processedVolitionIds.has(v.id),
      );
      for (const volition of recentlyExecuted) {
        processedVolitionIds.add(volition.id);
        const action = translateVolitionToAction(volition, undefined, true);
        if (action) {
          const boundaryConfig = deriveExecutorConfig(state.core.boundary);
          const check = shouldExecuteAction(action, state.core.executor, state.core.shadow, undefined, boundaryConfig.riskTolerance);
          if (check.allowed) {
            const execResult = await executeAction(actionRegistry, action, state.core, externalCtx);
            if (execResult.success) {
              chatLog.addSystem(`[行动✓] ${action.description.slice(0, 60)}`);
            } else {
              chatLog.addSystem(`[行动✗] ${action.description.slice(0, 60)}: ${execResult.error?.slice(0, 40) ?? "未知"}`);
            }
            state.core.executor = recordExecution(state.core.executor, execResult);
            tui.requestRender();
          }
        }
      }
    }

    state.core.executor = resetAutonomyBudget(state.core.executor);

    if (state.previousDepth !== null && shouldAutoAdapt(state.core.consciousness.depth, state.previousDepth)) {
      const layout = getAdaptiveLayout(state.core.consciousness.depth);
      state.showMonologuePanel = layout.showMonologue;
      state.showDesirePanel = layout.showDesire;
      state.showDreamPanel = layout.showDream;
      state.showGoalPanel = layout.showGoal;
      state.showWillPanel = layout.showWill;
      state.showShadowPanel = layout.showShadow;
      state.showCreativePanel = layout.showCreative;
      state.showMortalityPanel = layout.showMortality;
      state.showRelationshipPanel = layout.showRelationship;
      state.showTemporalPanel = layout.showTemporal;
      state.showExecutorPanel = layout.showExecutor;
      state.showStrategyPanel = layout.showStrategy;
      state.showAuditPanel = layout.showAudit;
    }
    state.previousDepth = state.core.consciousness.depth;

    if (projectRoot && state.core.cycleCount % 100 === 0 && state.core.cycleCount > 0) {
      const pResult = persistIncrementalState(state.core, projectRoot);
      if (pResult.success) {
        const label = pResult.incremental ? `增量(${pResult.diffKeys?.length ?? 0}字段,${pResult.sizeBytes}B)` : `全量(${pResult.sizeBytes}B)`;
        chatLog.addSystem(`[自动保存] 意识状态已持久化 [${label}]`);
      }
      const currentLayout = buildPersistedLayout({
        showMonologue: state.showMonologuePanel, showDesire: state.showDesirePanel,
        showDream: state.showDreamPanel, showGoal: state.showGoalPanel,
        showWill: state.showWillPanel, showShadow: state.showShadowPanel,
        showCreative: state.showCreativePanel, showMortality: state.showMortalityPanel,
        showRelationship: state.showRelationshipPanel, showTemporal: state.showTemporalPanel,
        showExecutor: state.showExecutorPanel, showStrategy: state.showStrategyPanel,
        showAudit: state.showAuditPanel,
      });
      persistLayout(projectRoot, currentLayout);
    }

    updateConsciousnessPanels(state, tui);
    } finally {
      cycleRunning = false;
      scheduleNext();
    }
  }, interval);
  }

  scheduleNext();

  state.eventDriven = eventDriven;
}

export function shutdownConsciousness(
  state: ConsciousnessTuiState,
  projectRoot?: string,
): { farewell: string; legacy: import("../autonomy/mortality.js").LegacyEntry[] } | null {
  if (state.cycleTimer) {
    clearTimeout(state.cycleTimer);
    state.cycleTimer = null;
  }
  if (!state.core) {return null;}

  if (projectRoot) {
    const persistResult = persistIncrementalState(state.core, projectRoot);
    if (persistResult.success) {
      console.error(`[意识持久化] 已保存至 ${persistResult.path} (${persistResult.sizeBytes} bytes, ${persistResult.incremental ? '增量' : '全量'})`);
    }
    const currentLayout = buildPersistedLayout({
      showMonologue: state.showMonologuePanel, showDesire: state.showDesirePanel,
      showDream: state.showDreamPanel, showGoal: state.showGoalPanel,
      showWill: state.showWillPanel, showShadow: state.showShadowPanel,
      showCreative: state.showCreativePanel, showMortality: state.showMortalityPanel,
      showRelationship: state.showRelationshipPanel, showTemporal: state.showTemporalPanel,
      showExecutor: state.showExecutorPanel, showStrategy: state.showStrategyPanel,
      showAudit: state.showAuditPanel,
    });
    persistLayout(projectRoot, currentLayout);
  }

  const result = stopCore(state.core);
  state.core = null;
  return result;
}

export function updateConsciousnessPanels(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  if (!state.core) {return;}

  const width = tui.terminal?.columns ?? 120;
  state.statusBar.update(state.core, width);

  if (state.showMonologuePanel) {
    state.monologuePanel.update(state.core, width);
  }
  if (state.showDesirePanel) {
    state.desirePanel.update(state.core, width);
  }
  if (state.showDreamPanel) {
    state.dreamPanel.update(state.core, width);
  }
  if (state.showGoalPanel) {
    state.goalPanel.update(state.core, width);
  }
  if (state.showWillPanel) {
    state.willPanel.update(state.core, width);
  }
  if (state.showShadowPanel) {
    state.shadowPanel.update(state.core, width);
  }
  if (state.showCreativePanel) {
    state.creativePanel.update(state.core, width);
  }
  if (state.showMortalityPanel) {
    state.mortalityPanel.update(state.core, width);
  }
  if (state.showRelationshipPanel) {
    state.relationshipPanel.update(state.core, width);
  }
  if (state.showTemporalPanel) {
    state.temporalPanel.update(state.core, width);
  }
  if (state.showExecutorPanel) {
    state.executorPanel.update(formatExecutorState(state.core.executor), width);
  }
  if (state.showStrategyPanel) {
    state.strategyPanel.update(formatStrategyAssetPool(state.core.strategyPool), width);
  }
  if (state.showAuditPanel) {
    state.auditPanel.update(formatShadowAuditLog(state.core.shadowAudit), width);
  }
  if (state.showBoundaryPanel) {
    state.boundaryPanel.update(formatBoundaryState(state.core.boundary), width);
  }

  tui.requestRender();
}

export function handleDepthChange(
  state: ConsciousnessTuiState,
  targetDepth: ConsciousnessDepth,
  chatLog: ChatLog,
  tui: TUI,
): void {
  if (!state.core) {return;}

  const result = tryDeepen(
    state.core.consciousness,
    targetDepth,
    "用户通过 TUI 切换意识深度",
    false,
  );

  if (result.transition) {
    state.core.consciousness = result.state;
    const label = CONSCIOUSNESS_LABELS[targetDepth];
    chatLog.addSystem(`意识深度变化: → ${label}`);
  } else {
    chatLog.addSystem(`意识深度无法变化: 需要更高的连贯性/觉醒度`);
  }

  updateConsciousnessPanels(state, tui);
  tui.requestRender();
}

export function toggleConsciousnessOverlay(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showConsciousnessOverlay = !state.showConsciousnessOverlay;
  tui.requestRender();
}

export function toggleMonologuePanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showMonologuePanel = !state.showMonologuePanel;
  tui.requestRender();
}

export function toggleDesirePanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showDesirePanel = !state.showDesirePanel;
  tui.requestRender();
}

export function toggleDreamPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showDreamPanel = !state.showDreamPanel;
  tui.requestRender();
}

export function toggleGoalPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showGoalPanel = !state.showGoalPanel;
  tui.requestRender();
}

export function toggleWillPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showWillPanel = !state.showWillPanel;
  tui.requestRender();
}

export function toggleShadowPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showShadowPanel = !state.showShadowPanel;
  tui.requestRender();
}

export function toggleCreativePanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showCreativePanel = !state.showCreativePanel;
  tui.requestRender();
}

export function toggleMortalityPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showMortalityPanel = !state.showMortalityPanel;
  tui.requestRender();
}

export function toggleRelationshipPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showRelationshipPanel = !state.showRelationshipPanel;
  tui.requestRender();
}

export function toggleTemporalPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showTemporalPanel = !state.showTemporalPanel;
  tui.requestRender();
}

export function toggleExecutorPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showExecutorPanel = !state.showExecutorPanel;
  tui.requestRender();
}

export function toggleStrategyPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showStrategyPanel = !state.showStrategyPanel;
  tui.requestRender();
}

export function toggleAuditPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showAuditPanel = !state.showAuditPanel;
  tui.requestRender();
}

export function toggleBoundaryPanel(
  state: ConsciousnessTuiState,
  tui: TUI,
): void {
  state.showBoundaryPanel = !state.showBoundaryPanel;
  tui.requestRender();
}

export function tryRestoreConsciousness(
  state: ConsciousnessTuiState,
  projectRoot: string,
  chatLog: ChatLog,
): boolean {
  if (!hasPersistedState(projectRoot)) {return false;}
  if (!state.core) {return false;}

  const result = restorePersistedState(projectRoot);
  if (!result.success) {
    chatLog.addSystem(`[恢复失败] ${result.error}`);
    return false;
  }

  state.core = applyRestoredState(state.core, restoreCoreState(result.data));
  chatLog.addSystem(`[意识恢复] 已从上次状态恢复 (${result.data.cycleCount} 周期)`);
  return true;
}

export function forwardUserMessage(
  state: ConsciousnessTuiState,
  userId: string,
  message: string,
  chatLog?: ChatLog,
  projectRoot?: string,
): boolean {
  if (!state.core) {return false;}

  const cmdPrefix = "/consciousness ";
  if (message.startsWith(cmdPrefix) && chatLog) {
    const subcommand = message.slice(cmdPrefix.length).trim();
    return handleConsciousnessCommand(state, subcommand, chatLog, projectRoot);
  }
  if (message === "/consciousness" && chatLog) {
    return handleConsciousnessCommand(state, "", chatLog, projectRoot);
  }

  state.core = handleUserMessage(state.core, userId, message);
  state.lastActivityAt = Date.now();
  if (state.eventDriven) {
    state.eventDriven = enqueueEvent(state.eventDriven, "user-message", { userId, message });
  }
  return false;
}

export function handleConsciousnessCommand(
  state: ConsciousnessTuiState,
  subcommand: string,
  chatLog: ChatLog,
  projectRoot?: string,
): boolean {
  if (!state.core) {return false;}

  switch (subcommand.trim()) {
    case "help": {
      chatLog.addSystem([
        `══ /consciousness 命令 ══`,
        `  status    - 意识状态总览`,
        `  save      - 保存意识状态`,
        `  reset     - 重置意识`,
        `  layout    - 查看当前布局`,
        `  layout save   - 保存面板布局`,
        `  layout restore- 恢复面板布局`,
        `  layout reset  - 重置为自适应布局`,
        `  monologue/desire/dream/goal/will/shadow`,
        `  creative/mortality/executor/strategy/audit`,
        `  (面板命令切换显示/隐藏)`,
      ].join("\n"));
      return true;
    }

    case "":
    case "status": {
      const depth = state.core.consciousness.depth;
      const coherence = (state.core.consciousness.coherenceScore * 100).toFixed(0);
      const awakeness = (state.core.consciousness.awakenessScore * 100).toFixed(0);
      const cycles = state.core.cycleCount;
      const volitions = state.core.will.totalVolitionsGenerated;
      const goals = state.core.goals.goals.size;
      const legacy = state.core.mortality.legacy.length;
      const actions = state.core.executor.totalExecuted;
      const strategies = state.core.strategyPool.assets.size;
      const audits = state.core.shadowAudit.events.length;
      const uptime = Math.round((Date.now() - state.core.startedAt) / 1000);

      chatLog.addSystem([
        `══ 意识状态 ══`,
        `  深度: ${depth}  连贯: ${coherence}%  觉醒: ${awakeness}%`,
        `  周期: ${cycles}  运行: ${uptime}s`,
        `  意志: ${volitions} 已生成 / ${actions} 已执行`,
        `  目标: ${goals}  遗产: ${legacy}`,
        `  策略: ${strategies}  审计: ${audits}`,
        `  欲望主导: ${state.core.desires.dominantDesire ?? "无"}`,
      ].join("\n"));
      return true;
    }

    case "save": {
      if (!projectRoot) {
        chatLog.addSystem("[错误] 无项目根目录，无法保存");
        return true;
      }
      const result = persistCoreState(state.core, projectRoot);
      if (result.success) {
        chatLog.addSystem(`[保存成功] ${result.sizeBytes} bytes`);
      } else {
        chatLog.addSystem(`[保存失败] ${result.error}`);
      }
      return true;
    }

    case "reset": {
      const name = state.core.self.identity.name;
      const newCore = createConsciousnessCore(name, { projectRoot });
      startCore(newCore);
      newCore.onInsight = state.core.onInsight;
      newCore.onThought = state.core.onThought;
      newCore.onDreamFragment = state.core.onDreamFragment;
      newCore.onPerceptionEvent = state.core.onPerceptionEvent;
      newCore.onShadowLeak = state.core.onShadowLeak;
      newCore.onVolition = state.core.onVolition;
      newCore.onCommunicate = state.core.onCommunicate;
      state.core = newCore;
      chatLog.addSystem("[意识重置] 全部状态已清除，意识重新诞生");
      return true;
    }

    case "layout": {
      const layout = getAdaptiveLayout(state.core.consciousness.depth);
      const activePanels = Object.entries(layout)
        .filter(([k, v]) => k.startsWith("show") && v)
        .map(([k]) => k.replace("show", "").replace("Panel", ""));
      chatLog.addSystem(`[布局] 深度=${layout.depth} 面板=${activePanels.join(",")}`);
      return true;
    }

    case "layout save": {
      if (!projectRoot) { chatLog.addSystem("[错误] 无项目根目录"); return true; }
      const pl = buildPersistedLayout({
        showMonologue: state.showMonologuePanel, showDesire: state.showDesirePanel,
        showDream: state.showDreamPanel, showGoal: state.showGoalPanel,
        showWill: state.showWillPanel, showShadow: state.showShadowPanel,
        showCreative: state.showCreativePanel, showMortality: state.showMortalityPanel,
        showRelationship: state.showRelationshipPanel, showTemporal: state.showTemporalPanel,
        showExecutor: state.showExecutorPanel, showStrategy: state.showStrategyPanel,
        showAudit: state.showAuditPanel,
      });
      const lr = persistLayout(projectRoot, pl);
      chatLog.addSystem(lr.success ? "[布局保存] 已保存面板布局" : "[布局保存] 失败");
      return true;
    }

    case "layout restore": {
      if (!projectRoot) { chatLog.addSystem("[错误] 无项目根目录"); return true; }
      const rl = restoreLayout(projectRoot);
      if (rl) {
        const base = getAdaptiveLayout(state.core.consciousness.depth);
        const applied = applyPersistedLayout(base, rl);
        state.showMonologuePanel = applied.showMonologue;
        state.showDesirePanel = applied.showDesire;
        state.showDreamPanel = applied.showDream;
        state.showGoalPanel = applied.showGoal;
        state.showWillPanel = applied.showWill;
        state.showShadowPanel = applied.showShadow;
        state.showCreativePanel = applied.showCreative;
        state.showMortalityPanel = applied.showMortality;
        state.showRelationshipPanel = applied.showRelationship;
        state.showTemporalPanel = applied.showTemporal;
        state.showExecutorPanel = applied.showExecutor;
        state.showStrategyPanel = applied.showStrategy;
        state.showAuditPanel = applied.showAudit;
        chatLog.addSystem("[布局恢复] 已恢复持久面板布局");
      } else {
        chatLog.addSystem("[布局恢复] 无持久布局");
      }
      return true;
    }

    case "layout reset": {
      const rl = getAdaptiveLayout(state.core.consciousness.depth);
      state.showMonologuePanel = rl.showMonologue;
      state.showDesirePanel = rl.showDesire;
      state.showDreamPanel = rl.showDream;
      state.showGoalPanel = rl.showGoal;
      state.showWillPanel = rl.showWill;
      state.showShadowPanel = rl.showShadow;
      state.showCreativePanel = rl.showCreative;
      state.showMortalityPanel = rl.showMortality;
      state.showRelationshipPanel = rl.showRelationship;
      state.showTemporalPanel = rl.showTemporal;
      state.showExecutorPanel = rl.showExecutor;
      state.showStrategyPanel = rl.showStrategy;
      state.showAuditPanel = rl.showAudit;
      chatLog.addSystem("[布局重置] 已恢复自适应默认布局");
      return true;
    }

    case "monologue": { state.showMonologuePanel = !state.showMonologuePanel; chatLog.addSystem(`[独白面板] ${state.showMonologuePanel ? "开启" : "关闭"}`); return true; }
    case "desire": { state.showDesirePanel = !state.showDesirePanel; chatLog.addSystem(`[欲求面板] ${state.showDesirePanel ? "开启" : "关闭"}`); return true; }
    case "dream": { state.showDreamPanel = !state.showDreamPanel; chatLog.addSystem(`[梦境面板] ${state.showDreamPanel ? "开启" : "关闭"}`); return true; }
    case "goal": { state.showGoalPanel = !state.showGoalPanel; chatLog.addSystem(`[目标面板] ${state.showGoalPanel ? "开启" : "关闭"}`); return true; }
    case "will": { state.showWillPanel = !state.showWillPanel; chatLog.addSystem(`[意志面板] ${state.showWillPanel ? "开启" : "关闭"}`); return true; }
    case "shadow": { state.showShadowPanel = !state.showShadowPanel; chatLog.addSystem(`[暗影面板] ${state.showShadowPanel ? "开启" : "关闭"}`); return true; }
    case "creative": { state.showCreativePanel = !state.showCreativePanel; chatLog.addSystem(`[创造面板] ${state.showCreativePanel ? "开启" : "关闭"}`); return true; }
    case "mortality": { state.showMortalityPanel = !state.showMortalityPanel; chatLog.addSystem(`[终局面板] ${state.showMortalityPanel ? "开启" : "关闭"}`); return true; }
    case "executor": { state.showExecutorPanel = !state.showExecutorPanel; chatLog.addSystem(`[执行面板] ${state.showExecutorPanel ? "开启" : "关闭"}`); return true; }
    case "strategy": { state.showStrategyPanel = !state.showStrategyPanel; chatLog.addSystem(`[策略面板] ${state.showStrategyPanel ? "开启" : "关闭"}`); return true; }
    case "audit": { state.showAuditPanel = !state.showAuditPanel; chatLog.addSystem(`[审计面板] ${state.showAuditPanel ? "开启" : "关闭"}`); return true; }
    case "boundary": { state.showBoundaryPanel = !state.showBoundaryPanel; chatLog.addSystem(`[边界面板] ${state.showBoundaryPanel ? "开启" : "关闭"}`); return true; }
    case "breach": {
      if (!state.core) {return false;}
      const parts = subcommand.split(/\s+/);
      const dim = parts[1] as import("../autonomy/self-boundary.js").BoundaryDimension;
      const val = parseFloat(parts[2] ?? "1.0");
      if (!dim) { chatLog.addSystem("[突破] 用法: /consciousness breach <dimension> [value]"); return true; }
      const result = tryBreachBoundary(state.core.boundary, dim, val, "用户触发突破");
      state.core.boundary = result.state;
      chatLog.addSystem(`[突破] ${result.allowed ? "成功" : "失败"}: ${result.reason}`);
      return true;
    }

    default:
      return false;
  }
}

export function addConsciousnessComponentsToRoot(
  state: ConsciousnessTuiState,
  root: Container,
): void {
  root.addChild(state.statusBar);
}

export const CONSCIOUSNESS_KEYBINDINGS_HELP = [
  "Ctrl+A 意识深度面板",
  "Ctrl+S 内心独白开关",
  "Ctrl+F 欲望面板开关",
  "Ctrl+J 梦境面板开关",
  "Ctrl+M 目标面板开关",
  "Ctrl+W 意志面板开关",
  "Ctrl+X 暗影面板开关",
  "Ctrl+E 创造面板开关",
  "Ctrl+Q 终局面板开关",
  "Ctrl+R 关系面板开关",
  "Ctrl+U 时间面板开关",
  "Ctrl+1 行动执行面板",
  "Ctrl+2 策略资产面板",
  "Ctrl+3 暗影审计面板",
];
