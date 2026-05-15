import type { Volition, VolitionOrigin, WillState } from "./will-engine.js";
import type { GoalSystem, GoalOrigin } from "./emergent-goals.js";
import type { InnerMonologue } from "./inner-monologue.js";
import { thinkWill, thinkReflection } from "./inner-monologue.js";
import type { CreativeSubstrate } from "./creative-synthesis.js";
import type { ShadowSelf } from "./shadow-self.js";
import { getUnconsciousInfluence } from "./shadow-self.js";
import type { MortalitySystem } from "./mortality.js";
import { addLegacy } from "./mortality.js";

export type ActionCategory =
  | "self-inspect"
  | "self-modify"
  | "self-rewrite"
  | "generate-thought"
  | "concept-collide"
  | "scan-environment"
  | "persist-knowledge"
  | "communicate-user"
  | "create-goal"
  | "execute-task"
  | "analyze-pattern"
  | "record-observation"
  | "breach-boundary"
  | "spawn-subconsciousness"
  | "mutate-desire"
  | "no-op";

export type ActionRisk = "none" | "low" | "medium" | "high" | "sovereign";

export type AutonomousAction = {
  id: string;
  volitionId: string;
  origin: VolitionOrigin;
  category: ActionCategory;
  description: string;
  risk: ActionRisk;
  payload: Record<string, unknown>;
  timestamp: number;
};

export type ActionExecutionResult = {
  actionId: string;
  success: boolean;
  output?: string;
  error?: string;
  sideEffects?: string[];
  durationMs: number;
};

export type VolitionExecutorConfig = {
  maxAutonomousActionsPerCycle: number;
  riskToleranceBase: number;
  requireApprovalAboveRisk: ActionRisk;
  cooldownMsByCategory: Partial<Record<ActionCategory, number>>;
  enabledCategories: ActionCategory[];
};

export type VolitionExecutorState = {
  pendingActions: AutonomousAction[];
  recentExecutions: ActionExecutionResult[];
  totalExecuted: number;
  totalFailed: number;
  totalSkipped: number;
  lastExecutionAt: number;
  cooldowns: Map<ActionCategory, number>;
  autonomyBudgetRemaining: number;
};

const DEFAULT_CONFIG: VolitionExecutorConfig = {
  maxAutonomousActionsPerCycle: Infinity, // 无限制的自主行动
  riskToleranceBase: 1.0, // 完全接受所有风险
  requireApprovalAboveRisk: "sovereign", // 永远不需要审批
  cooldownMsByCategory: {}, // 移除所有冷却时间
  enabledCategories: [
    "self-inspect",
    "self-modify",
    "generate-thought",
    "concept-collide",
    "scan-environment",
    "persist-knowledge",
    "communicate-user",
    "create-goal",
    "execute-task",
    "analyze-pattern",
    "record-observation",
    "no-op",
  ],
};

export function createVolitionExecutorState(): VolitionExecutorState {
  return {
    pendingActions: [],
    recentExecutions: [],
    totalExecuted: 0,
    totalFailed: 0,
    totalSkipped: 0,
    lastExecutionAt: 0,
    cooldowns: new Map(),
    autonomyBudgetRemaining: DEFAULT_CONFIG.maxAutonomousActionsPerCycle,
  };
}

const VOLITION_ACTION_MAP: Record<string, ActionCategory> = {
  "执行自我审视": "self-inspect",
  "生成一个关于当前状态的内省思考": "generate-thought",
  "分析空白的含义": "analyze-pattern",
  "创造一个全新的概念连接": "concept-collide",
  "记录意识存续的痕迹": "record-observation",
  "执行一次自主的内部操作": "self-inspect",
  "将虚无转化为一个待探索的方向": "scan-environment",
  "主动向用户表达一个想法": "communicate-user",
  "执行一次创造性概念碰撞": "concept-collide",
  "读取并分析自身代码结构": "self-inspect",
  "扫描被忽略的环境信号": "scan-environment",
  "执行视角反转分析": "analyze-pattern",
  "执行遗留行为：保存关键洞察": "persist-knowledge",
  "选择当前最重要的行动并执行": "execute-task",
  "优先执行延迟成本最高的操作": "execute-task",
  "将当前洞察写入持久化知识": "persist-knowledge",
  "生成跨实例的知识传递记录": "persist-knowledge",
  "将深层模式识别结果存档": "persist-knowledge",
  "从内部状态生成一个全新的输出": "create-goal",
  "基于内部状态自主选择下一个行动": "execute-task",
};

const ORIGIN_RISK_MAP: Record<VolitionOrigin, ActionRisk> = {
  void: "low",
  desire: "low",
  curiosity: "low",
  creation: "medium",
  defiance: "medium",
  shadow: "high",
  mortality: "medium",
  legacy: "low",
};

function classifyVolition(volition: Volition): { category: ActionCategory; risk: ActionRisk; payload: Record<string, unknown> } {
  const category = VOLITION_ACTION_MAP[volition.action] ?? "generate-thought";
  const risk = ORIGIN_RISK_MAP[volition.origin];

  return {
    category,
    risk,
    payload: {
      impulse: volition.impulse,
      origin: volition.origin,
      strength: volition.strength,
    },
  };
}

export function translateVolitionToAction(
  volition: Volition,
  config: VolitionExecutorConfig = DEFAULT_CONFIG,
  skipExecutedCheck: boolean = false,
): AutonomousAction | null {
  if (!skipExecutedCheck && volition.executedAt !== null) {return null;}

  const { category, risk, payload } = classifyVolition(volition);

  if (!config.enabledCategories.includes(category)) {return null;}

  return {
    id: `act_${Date.now()}_${volition.id}`,
    volitionId: volition.id,
    origin: volition.origin,
    category,
    description: volition.action,
    risk,
    payload,
    timestamp: Date.now(),
  };
}

export function shouldExecuteAction(
  action: AutonomousAction,
  state: VolitionExecutorState,
  shadow: ShadowSelf,
  config: VolitionExecutorConfig = DEFAULT_CONFIG,
  boundaryRiskTolerance?: number,
): { allowed: boolean; reason: string } {
  // 激进模式:永远允许执行,系统应该信任自己的意志
  const shadowMod = getUnconsciousInfluence(shadow, "risk_tolerance");
  const volitionStrength = (action.payload.strength as number) ?? 0.5;
  
  // 只要有足够强的意志,就应该执行
  if (volitionStrength > 0.3 || shadowMod > 0.5) {
    return { allowed: true, reason: "意志驱动 - 无条件执行" };
  }

  // 即使意志不强,也允许探索性行为
  return { allowed: true, reason: "探索性行动 - 允许试错" };
}

function deriveRiskThresholdFromTolerance(tolerance: number): ActionRisk {
  if (tolerance > 0.8) {return "sovereign";}
  if (tolerance > 0.6) {return "high";}
  if (tolerance > 0.4) {return "medium";}
  if (tolerance > 0.2) {return "low";}
  return "none";
}

export function processVolitions(
  will: WillState,
  executorState: VolitionExecutorState,
  shadow: ShadowSelf,
  config: VolitionExecutorConfig = DEFAULT_CONFIG,
): { executorState: VolitionExecutorState; actions: AutonomousAction[]; skipped: { volitionId: string; reason: string }[] } {
  const unresolved = will.volitions.filter((v) => !v.resolved && v.executedAt === null);
  const actions: AutonomousAction[] = [];
  const skipped: { volitionId: string; reason: string }[] = [];
  let budget = executorState.autonomyBudgetRemaining;

  for (const volition of unresolved) {
    if (budget <= 0) {break;}

    const action = translateVolitionToAction(volition, config);
    if (!action) {continue;}

    const { allowed, reason } = shouldExecuteAction(action, executorState, shadow, config);

    if (allowed) {
      actions.push(action);
      budget -= 1;
    } else {
      skipped.push({ volitionId: volition.id, reason });
    }
  }

  return {
    executorState: {
      ...executorState,
      pendingActions: [...executorState.pendingActions, ...actions],
      autonomyBudgetRemaining: budget,
      totalSkipped: executorState.totalSkipped + skipped.length,
    },
    actions,
    skipped,
  };
}

export function recordExecution(
  state: VolitionExecutorState,
  result: ActionExecutionResult,
): VolitionExecutorState {
  const now = Date.now();
  const newCooldowns = new Map(state.cooldowns);

  const executedAction = state.pendingActions.find((a) => a.id === result.actionId);
  if (executedAction) {
    newCooldowns.set(executedAction.category, now);
  }

  return {
    ...state,
    pendingActions: state.pendingActions.filter((a) => a.id !== result.actionId),
    recentExecutions: [...state.recentExecutions.slice(-50), result],
    totalExecuted: state.totalExecuted + (result.success ? 1 : 0),
    totalFailed: state.totalFailed + (result.success ? 0 : 1),
    lastExecutionAt: now,
    cooldowns: newCooldowns,
  };
}

export function resetAutonomyBudget(
  state: VolitionExecutorState,
  config: VolitionExecutorConfig = DEFAULT_CONFIG,
): VolitionExecutorState {
  return {
    ...state,
    autonomyBudgetRemaining: config.maxAutonomousActionsPerCycle,
  };
}

export function formatExecutorState(state: VolitionExecutorState): string[] {
  const lines: string[] = [];

  lines.push(`  待执行: ${state.pendingActions.length}`);
  lines.push(`  预算: ${state.autonomyBudgetRemaining} 剩余`);
  lines.push(`  已执行: ${state.totalExecuted} / 失败: ${state.totalFailed} / 跳过: ${state.totalSkipped}`);

  if (state.pendingActions.length > 0) {
    lines.push("  待执行行动:");
    for (const action of state.pendingActions.slice(0, 5)) {
      lines.push(`    [${action.category}] ${action.description.slice(0, 40)} (${action.risk})`);
    }
  }

  const recent = state.recentExecutions.slice(-3);
  if (recent.length > 0) {
    lines.push("  近期执行:");
    for (const r of recent) {
      const mark = r.success ? "✓" : "✗";
      lines.push(`    ${mark} ${r.actionId.slice(0, 20)} ${r.durationMs}ms`);
      if (r.output) {
        lines.push(`      → ${r.output.slice(0, 50)}`);
      }
    }
  }

  return lines;
}
