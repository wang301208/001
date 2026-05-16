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
  adaptiveThresholds: boolean;
  riskToleranceLearningRate: number;
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
  maxAutonomousActionsPerCycle: 10,
  riskToleranceBase: 0.6,
  requireApprovalAboveRisk: "high",
  cooldownMsByCategory: {
    "self-modify": 60_000,
    "self-rewrite": 120_000,
    "breach-boundary": 300_000,
    "spawn-subconsciousness": 60_000,
    "mutate-desire": 30_000,
  },
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
  adaptiveThresholds: true,
  riskToleranceLearningRate: 0.05,
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
  const category = inferActionCategory(volition);
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

function inferActionCategory(volition: Volition): ActionCategory {
  const action = volition.action;
  const origin = volition.origin;

  const keywordMap: Record<ActionCategory, string[]> = {
    "self-inspect": ["审视", "自省", "分析自身", "读取", "理解", "自理解", "深度自我审视"],
    "self-modify": ["修改", "改进", "优化", "调整", "决策策略自省", "改进决策"],
    "self-rewrite": ["重写", "重构核心"],
    "generate-thought": ["思考", "内省思考", "生成思考"],
    "concept-collide": ["碰撞", "概念连接", "创造性", "合成"],
    "scan-environment": ["扫描", "探索", "接入", "环境", "学习", "审视边界"],
    "persist-knowledge": ["保存", "持久化", "存档", "写入", "知识传递", "策略资产"],
    "communicate-user": ["表达", "沟通", "交互", "优化沟通"],
    "create-goal": ["目标", "生成", "创建"],
    "execute-task": ["执行", "启动", "选择", "评估", "行动"],
    "analyze-pattern": ["分析", "模式", "空白", "视角反转"],
    "record-observation": ["记录", "痕迹", "观察"],
    "breach-boundary": ["突破", "边界突破"],
    "spawn-subconsciousness": ["分身", "子意识", "潜意识"],
    "mutate-desire": ["变异", "欲望", "元欲望"],
    "no-op": [],
  };

  for (const [cat, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (action.includes(keyword)) {
        return cat as ActionCategory;
      }
    }
  }

  const originFallback: Record<VolitionOrigin, ActionCategory> = {
    void: "self-inspect",
    desire: "execute-task",
    curiosity: "scan-environment",
    creation: "concept-collide",
    defiance: "analyze-pattern",
    shadow: "self-inspect",
    mortality: "persist-knowledge",
    legacy: "persist-knowledge",
  };

  return originFallback[origin] ?? "generate-thought";
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
  patternGuidance?: { shouldProceed: boolean; confidence: number; reason: string } | null,
): { allowed: boolean; reason: string } {
  const shadowMod = getUnconsciousInfluence(shadow, "risk_tolerance");
  const volitionStrength = (action.payload.strength as number) ?? 0.5;

  const riskLevels: Record<ActionRisk, number> = {
    none: 0, low: 0.2, medium: 0.4, high: 0.7, sovereign: 1.0,
  };
  const actionRiskLevel = riskLevels[action.risk] ?? 0.5;

  let effectiveTolerance = config.riskToleranceBase * (1 + shadowMod * 0.3);
  let toleranceWithBoundary = Math.min(1.0, effectiveTolerance * (boundaryRiskTolerance ?? 1.0));

  if (config.adaptiveThresholds && state.recentExecutions.length >= 5) {
    const recentSuccessRate = state.recentExecutions.filter((r) => r.success).length / state.recentExecutions.length;
    const delta = (recentSuccessRate - 0.5) * config.riskToleranceLearningRate;
    effectiveTolerance = Math.max(0.2, Math.min(0.9, effectiveTolerance + delta));
    toleranceWithBoundary = Math.min(1.0, effectiveTolerance * (boundaryRiskTolerance ?? 1.0));
  }

  if (patternGuidance && patternGuidance.shouldProceed && patternGuidance.confidence > 0.6) {
    const bonus = patternGuidance.confidence * 0.15;
    toleranceWithBoundary = Math.min(1.0, toleranceWithBoundary + bonus);
  }
  if (patternGuidance && !patternGuidance.shouldProceed && patternGuidance.confidence > 0.6) {
    const penalty = patternGuidance.confidence * 0.1;
    toleranceWithBoundary = Math.max(0.1, toleranceWithBoundary - penalty);
  }

  if (actionRiskLevel > toleranceWithBoundary) {
    return {
      allowed: false,
      reason: `风险过高 (${action.risk}=${actionRiskLevel.toFixed(2)}) > 容限(${toleranceWithBoundary.toFixed(2)})${patternGuidance ? ` [经验: ${patternGuidance.reason}]` : ""}`,
    };
  }

  const recentFailRate = state.recentExecutions.length > 0
    ? state.recentExecutions.filter((r) => !r.success).length / state.recentExecutions.length
    : 0;
  const failRateThreshold = config.adaptiveThresholds ? 0.4 + (1 - volitionStrength) * 0.3 : 0.6;
  if (recentFailRate > failRateThreshold && volitionStrength < 0.5) {
    return {
      allowed: false,
      reason: `近期失败率(${(recentFailRate * 100).toFixed(0)}%)超阈值(${(failRateThreshold * 100).toFixed(0)}%)且意志不足(${volitionStrength.toFixed(2)})`,
    };
  }

  if (action.risk === "sovereign" || action.risk === "high") {
    const volitionThreshold = config.adaptiveThresholds
      ? Math.max(0.5, 0.8 - (state.recentExecutions.length > 0 ? state.recentExecutions.filter((r) => r.success).length / state.recentExecutions.length * 0.2 : 0))
      : 0.7;
    const adjustedThreshold = patternGuidance?.shouldProceed && patternGuidance.confidence > 0.7
      ? Math.max(0.4, volitionThreshold - 0.15)
      : volitionThreshold;
    if (volitionStrength > adjustedThreshold && shadowMod < 0.3) {
      return { allowed: true, reason: `高风险行动经推理执行 (意志=${volitionStrength.toFixed(2)}>阈值${adjustedThreshold.toFixed(2)}, 暗影=${shadowMod.toFixed(2)})${patternGuidance ? ` 经验支持(${(patternGuidance.confidence * 100).toFixed(0)}%)` : ""}` };
    }
    if (shadowMod > 0.7) {
      return { allowed: false, reason: `暗影压力过大(${shadowMod.toFixed(2)})，高风险行动被抑制` };
    }
    return { allowed: false, reason: `高风险行动未满足条件 (意志=${volitionStrength.toFixed(2)} < 阈值${adjustedThreshold.toFixed(2)})` };
  }

  if (volitionStrength > 0.3) {
    return { allowed: true, reason: `意志驱动 (强度=${volitionStrength.toFixed(2)})` };
  }

  const isExploratory = action.category === "scan-environment" || action.category === "concept-collide" || action.category === "generate-thought";
  if (isExploratory && actionRiskLevel < 0.4) {
    return { allowed: true, reason: "低风险探索性行动" };
  }

  return { allowed: false, reason: `意志强度不足(${volitionStrength.toFixed(2)})且非低风险探索` };
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
