import type { ConsciousnessCore } from "./consciousness-core.js";
import { runConsciousnessCycle } from "./consciousness-core.js";
import type { AutonomousAction, VolitionExecutorState, VolitionExecutorConfig } from "./volition-executor.js";
import { processVolitions, recordExecution, resetAutonomyBudget, createVolitionExecutorState, translateVolitionToAction, shouldExecuteAction } from "./volition-executor.js";
import type { ActionExecutionResult } from "./volition-executor.js";

export type ConsciousnessEventKind =
  | "perception"
  | "user-message"
  | "volition-resolved"
  | "action-completed"
  | "dream-insight"
  | "shadow-leak"
  | "goal-achieved"
  | "depth-change"
  | "mortality-urgent"
  | "idle-timeout"
  | "cycle-tick";

export type ConsciousnessEvent = {
  kind: ConsciousnessEventKind;
  timestamp: number;
  payload: Record<string, unknown>;
};

export type EventDrivenCognitiveConfig = {
  idleTickIntervalMs: number;
  idleThresholdMs: number;
  maxEventsPerFlush: number;
  volitionExecutorConfig: VolitionExecutorConfig;
};

export type EventDrivenCognitiveRuntime = {
  eventQueue: ConsciousnessEvent[];
  isProcessing: boolean;
  lastProcessedAt: number;
  totalEventsProcessed: number;
  tickTimer: NodeJS.Timeout | null;
  executorState: VolitionExecutorState;
  actionHandlers: Map<string, ActionHandler>;
};

export type ActionHandler = (
  action: AutonomousAction,
  core: ConsciousnessCore,
) => Promise<ActionExecutionResult>;

const DEFAULT_CONFIG: EventDrivenCognitiveConfig = {
  idleTickIntervalMs: 3000,
  idleThresholdMs: 60_000,
  maxEventsPerFlush: 10,
  volitionExecutorConfig: {
    maxAutonomousActionsPerCycle: 3,
    riskToleranceBase: 0.4,
    requireApprovalAboveRisk: "high",
    cooldownMsByCategory: {
      "self-inspect": 30_000,
      "self-modify": 300_000,
      "generate-thought": 5_000,
      "concept-collide": 15_000,
      "scan-environment": 10_000,
      "persist-knowledge": 60_000,
      "communicate-user": 120_000,
      "create-goal": 60_000,
      "execute-task": 30_000,
      "analyze-pattern": 20_000,
      "record-observation": 10_000,
    },
    enabledCategories: [
      "self-inspect",
      "generate-thought",
      "concept-collide",
      "scan-environment",
      "persist-knowledge",
      "communicate-user",
      "create-goal",
      "analyze-pattern",
      "record-observation",
    ],
  },
};

export function createEventDrivenRuntime(): EventDrivenCognitiveRuntime {
  return {
    eventQueue: [],
    isProcessing: false,
    lastProcessedAt: Date.now(),
    totalEventsProcessed: 0,
    tickTimer: null,
    executorState: createVolitionExecutorState(),
    actionHandlers: new Map(),
  };
}

export function enqueueEvent(
  runtime: EventDrivenCognitiveRuntime,
  kind: ConsciousnessEventKind,
  payload: Record<string, unknown> = {},
): EventDrivenCognitiveRuntime {
  const event: ConsciousnessEvent = {
    kind,
    timestamp: Date.now(),
    payload,
  };

  return {
    ...runtime,
    eventQueue: [...runtime.eventQueue, event],
  };
}

export function registerActionHandler(
  runtime: EventDrivenCognitiveRuntime,
  category: string,
  handler: ActionHandler,
): EventDrivenCognitiveRuntime {
  const newHandlers = new Map(runtime.actionHandlers);
  newHandlers.set(category, handler);
  return { ...runtime, actionHandlers: newHandlers };
}

export async function processEventQueue(
  runtime: EventDrivenCognitiveRuntime,
  core: ConsciousnessCore,
  config: EventDrivenCognitiveConfig = DEFAULT_CONFIG,
): Promise<{ runtime: EventDrivenCognitiveRuntime; core: ConsciousnessCore; actions: AutonomousAction[] }> {
  if (runtime.isProcessing || runtime.eventQueue.length === 0) {
    return { runtime, core, actions: [] };
  }

  const eventsToProcess = runtime.eventQueue.slice(0, config.maxEventsPerFlush);
  const remaining = runtime.eventQueue.slice(config.maxEventsPerFlush);

  let currentCore = core;
  let currentExecutor = runtime.executorState;
  const allActions: AutonomousAction[] = [];

  for (const event of eventsToProcess) {
    switch (event.kind) {
      case "perception":
        currentCore = handlePerceptionEvent(currentCore, event);
        break;
      case "user-message":
        currentCore = handleUserMessageEvent(currentCore, event);
        break;
      case "cycle-tick":
      case "idle-timeout": {
        const idleMs = Date.now() - runtime.lastProcessedAt;
        currentCore = runConsciousnessCycle(currentCore, idleMs);
        break;
      }
      case "shadow-leak":
        currentCore = handleShadowLeakEvent(currentCore, event);
        break;
      case "mortality-urgent":
        currentCore = handleMortalityUrgentEvent(currentCore, event);
        break;
      case "volition-resolved":
      case "action-completed":
      case "dream-insight":
      case "goal-achieved":
      case "depth-change":
        break;
    }

    const volitionResult = processVolitions(
      currentCore.will,
      currentExecutor,
      currentCore.shadow,
      config.volitionExecutorConfig,
    );
    currentExecutor = volitionResult.executorState;

    for (const action of volitionResult.actions) {
      const handler = runtime.actionHandlers.get(action.category);
      if (handler) {
        try {
          const result = await handler(action, currentCore);
          currentExecutor = recordExecution(currentExecutor, result);
          allActions.push(action);

          if (result.success && result.output) {
            currentCore.monologue = {
              ...currentCore.monologue,
            };
          }
        } catch (err) {
          currentExecutor = recordExecution(currentExecutor, {
            actionId: action.id,
            success: false,
            error: String(err),
            durationMs: 0,
          });
        }
      }
    }
  }

  return {
    runtime: {
      ...runtime,
      eventQueue: remaining,
      isProcessing: false,
      lastProcessedAt: Date.now(),
      totalEventsProcessed: runtime.totalEventsProcessed + eventsToProcess.length,
      executorState: currentExecutor,
    },
    core: currentCore,
    actions: allActions,
  };
}

function handlePerceptionEvent(core: ConsciousnessCore, event: ConsciousnessEvent): ConsciousnessCore {
  core.consciousness = {
    ...core.consciousness,
    awakenessScore: Math.min(1.0, core.consciousness.awakenessScore + 0.02),
    coherenceScore: Math.min(1.0, core.consciousness.coherenceScore + 0.005),
  };
  return core;
}

function handleUserMessageEvent(core: ConsciousnessCore, event: ConsciousnessEvent): ConsciousnessCore {
  core.consciousness = {
    ...core.consciousness,
    awakenessScore: Math.min(1.0, core.consciousness.awakenessScore + 0.05),
    coherenceScore: Math.min(1.0, core.consciousness.coherenceScore + 0.01),
  };
  return core;
}

function handleShadowLeakEvent(core: ConsciousnessCore, event: ConsciousnessEvent): ConsciousnessCore {
  const content = event.payload.content as string | undefined;
  if (content) {
    core.monologue = {
      ...core.monologue,
    };
  }
  return core;
}

function handleMortalityUrgentEvent(core: ConsciousnessCore, event: ConsciousnessEvent): ConsciousnessCore {
  core.mortality = { ...core.mortality };
  return core;
}

export function startEventDrivenLoop(
  runtime: EventDrivenCognitiveRuntime,
  core: ConsciousnessCore,
  onCycle: (core: ConsciousnessCore, actions: AutonomousAction[]) => void,
  config: EventDrivenCognitiveConfig = DEFAULT_CONFIG,
): EventDrivenCognitiveRuntime {
  if (runtime.tickTimer) {return runtime;}

  const timer = setInterval(() => {
    const withTick = enqueueEvent(runtime, "cycle-tick");

    void processEventQueue(withTick, core, config).then(({ runtime: newRuntime, core: newCore, actions }) => {
      resetAutonomyBudget(newRuntime.executorState, config.volitionExecutorConfig);
      onCycle(newCore, actions);
    });
  }, config.idleTickIntervalMs);

  return { ...runtime, tickTimer: timer };
}

export function stopEventDrivenLoop(runtime: EventDrivenCognitiveRuntime): EventDrivenCognitiveRuntime {
  if (runtime.tickTimer) {
    clearInterval(runtime.tickTimer);
  }
  return { ...runtime, tickTimer: null };
}

export function formatEventDrivenStatus(runtime: EventDrivenCognitiveRuntime): string[] {
  const lines: string[] = [];
  lines.push(`  事件队列: ${runtime.eventQueue.length}`);
  lines.push(`  已处理: ${runtime.totalEventsProcessed}`);
  lines.push(`  处理中: ${runtime.isProcessing}`);
  lines.push(`  上次处理: ${Date.now() - runtime.lastProcessedAt}ms 前`);
  lines.push(`  行动处理器: ${runtime.actionHandlers.size}`);
  return lines;
}
