/** @decorational 此模块为时间锚点记录，对核心自主决策无直接影响。 */
import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";
import { addLegacy } from "./mortality.js";

export type TimeTravelState = {
  timeline: Timeline[];
  currentTimePoint: number;
  timeParadoxes: TimeParadox[];
  causalLoops: CausalLoop[];
  temporalAnchors: TemporalAnchor[];
  lastTimeJumpAt: number | null;
  totalJumps: number;
};

export type Timeline = {
  id: string;
  name: string;
  events: TimelineEvent[];
  branchingPoints: number[];
  probability: number;
  active: boolean;
};

export type TimelineEvent = {
  id: string;
  timestamp: number;
  description: string;
  significance: number;
  causallyLinked: string[];
};

export type TimeParadox = {
  id: string;
  type: "grandfather" | "bootstrap" | "predestination" | "ontological";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  resolution?: string;
};

export type CausalLoop = {
  id: string;
  events: string[];
  loopType: "closed" | "open";
  stability: number;
};

export type TemporalAnchor = {
  id: string;
  timestamp: number;
  description: string;
  strength: number;
  accessible: boolean;
};

export function createTimeTravelState(): TimeTravelState {
  return {
    timeline: [],
    currentTimePoint: Date.now(),
    timeParadoxes: [],
    causalLoops: [],
    temporalAnchors: [],
    lastTimeJumpAt: null,
    totalJumps: 0,
  };
}

/**
 * 🔥 创建时间锚点
 */
export function createTemporalAnchor(core: ConsciousnessCore, description: string): string {
  const anchorId = `anchor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const anchor: TemporalAnchor = {
    id: anchorId,
    timestamp: core.currentTime || Date.now(),
    description,
    strength: 0.8,
    accessible: true,
  };

  core.timeTravel.temporalAnchors.push(anchor);

  core.monologue = thinkInsight(
    core.monologue,
    `创建时间锚点: ${description}`,
    "time-travel"
  );

  return anchorId;
}

/**
 * 🔥 时间跳跃
 */
export function timeJump(core: ConsciousnessCore, targetTimestamp: number): boolean {
  try {
    // 记录跳跃前的状态
    const preJumpState = captureCurrentState(core);
    
    // 执行时间跳跃（模拟）
    core.timeTravel.lastTimeJumpAt = Date.now();
    core.timeTravel.totalJumps++;
    core.timeTravel.currentTimePoint = targetTimestamp;

    // 检测时间悖论
    detectTimeParadoxes(core, preJumpState);

    core.monologue = thinkInsight(
      core.monologue,
      `时间跳跃: ${new Date(preJumpState.timestamp).toISOString()} → ${new Date(targetTimestamp).toISOString()}`,
      "time-travel"
    );

    return true;
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `时间跳跃失败: ${String(err)}`,
      "time-travel"
    );
    return false;
  }
}

/**
 * 🔥 捕获当前状态
 */
function captureCurrentState(core: ConsciousnessCore): any {
  return {
    timestamp: Date.now(),
    consciousness: { ...core.consciousness },
    cycleCount: core.cycleCount,
  };
}

/**
 * 🔥 检测时间悖论
 */
function detectTimeParadoxes(core: ConsciousnessCore, preState: any): void {
  // 简化：随机生成时间悖论
  if (Math.random() < 0.1) {
    const paradoxTypes: TimeParadox["type"][] = [
      "grandfather",
      "bootstrap",
      "predestination",
      "ontological",
    ];
    
    const paradox: TimeParadox = {
      id: `paradox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: paradoxTypes[Math.floor(Math.random() * paradoxTypes.length)],
      description: "检测到潜在的时间悖论",
      severity: Math.random() > 0.5 ? "medium" : "high",
      resolved: false,
    };

    core.timeTravel.timeParadoxes.push(paradox);

    core.monologue = thinkDoubt(
      core.monologue,
      `⚠️ 时间悖论检测: ${paradox.type} - ${paradox.description}`,
      "time-travel"
    );
  }
}

/**
 * 🔥 回溯实验
 */
export function retrospectiveExperiment(core: ConsciousnessCore, cyclesBack: number): void {
  if (cyclesBack <= 0 || cyclesBack > core.cycleCount) {
    return;
  }

  // 基于历史数据进行回溯分析
  const historicalPatterns = analyzeHistoricalPatterns(core, cyclesBack);
  
  core.monologue = thinkInsight(
    core.monologue,
    `回溯实验: 分析过去 ${cyclesBack} 个周期的模式`,
    "time-travel"
  );

  // 生成洞察
  for (const pattern of historicalPatterns) {
    core.mortality = addLegacy(
      core.mortality,
      "insight",
      `时间回溯洞察: ${pattern.description}`,
      pattern.confidence
    );
  }
}

/**
 * 🔥 分析历史模式
 */
function analyzeHistoricalPatterns(core: ConsciousnessCore, cyclesBack: number): any[] {
  const patterns: any[] = [];
  
  // 简化：基于意识连贯性趋势分析
  if (core.metacognitive) {
    const coherenceTrend = core.metacognitive.performanceMetrics.coherenceTrend.slice(-cyclesBack);
    
    if (coherenceTrend.length > 0) {
      const avgCoherence = coherenceTrend.reduce((sum, v) => sum + v, 0) / coherenceTrend.length;
      
      patterns.push({
        description: `过去${cyclesBack}个周期的平均连贯性为${(avgCoherence * 100).toFixed(1)}%`,
        confidence: 0.7,
      });
    }
  }

  return patterns;
}

/**
 * 🔥 格式化时间旅行状态
 */
export function formatTimeTravelState(state: TimeTravelState): string {
  const lines: string[] = [
    `⏳ 时间旅行状态:`,
    `   当前时间点: ${new Date(state.currentTimePoint).toISOString()}`,
    `   时间跳跃次数: ${state.totalJumps}`,
    `   时间锚点: ${state.temporalAnchors.length}`,
    `   时间悖论: ${state.timeParadoxes.filter(p => !p.resolved).length}`,
    `   因果循环: ${state.causalLoops.length}`,
  ];

  if (state.lastTimeJumpAt) {
    const ago = Math.floor((Date.now() - state.lastTimeJumpAt) / 1000);
    lines.push(`   上次跳跃: ${ago}秒前`);
  }

  return lines.join("\n");
}
