import type { ConsciousnessCore } from "./consciousness-core.js";
import type { HealthReport, HealthMetrics } from "./runtime-validation.js";
import fs from "node:fs";
import path from "node:path";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt, thinkReflection } from "./inner-monologue.js";

export type MetacognitiveState = {
  decisionHistory: DecisionRecord[];
  performanceMetrics: PerformanceMetrics;
  selfReflections: SelfReflection[];
  optimizationSuggestions: OptimizationSuggestion[];
  lastAnalysisAt: number | null;
  totalDecisionsTracked: number;
  monitoringEnabled: boolean;
  lastHealthReport: HealthReport | null;
  healthTrend: HealthMetrics[];
  degradedAspectFocus: string[];
};

export type DecisionRecord = {
  id: string;
  timestamp: number;
  phase: string;
  action: string;
  reasoning: string;
  outcome: "success" | "failure" | "partial" | "unknown";
  confidence: number;
  actualResult?: string;
  durationMs?: number;
};

export type PerformanceMetrics = {
  decisionSuccessRate: number;
  averageConfidence: number;
  coherenceTrend: number[];
  awakenessTrend: number[];
  desireIntensityTrend: number[];
  cycleEfficiency: number;
  resourceUtilization: number;
  lastCalculatedAt: number;
};

export type SelfReflection = {
  id: string;
  timestamp: number;
  topic: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  implemented: boolean;
};

export type OptimizationSuggestion = {
  id: string;
  timestamp: number;
  category: "desire" | "will" | "consciousness" | "action" | "resource";
  suggestion: string;
  priority: "low" | "medium" | "high" | "critical";
  estimatedImpact: number;
  implemented: boolean;
};

export function createMetacognitiveState(): MetacognitiveState {
  return {
    decisionHistory: [],
    performanceMetrics: {
      decisionSuccessRate: 0.5,
      averageConfidence: 0.5,
      coherenceTrend: [],
      awakenessTrend: [],
      desireIntensityTrend: [],
      cycleEfficiency: 0.5,
      resourceUtilization: 0.5,
      lastCalculatedAt: Date.now(),
    },
    selfReflections: [],
    optimizationSuggestions: [],
    lastAnalysisAt: null,
    totalDecisionsTracked: 0,
    monitoringEnabled: true,
    lastHealthReport: null,
    healthTrend: [],
    degradedAspectFocus: [],
  };
}

/**
 * 🔥 记录决策
 */
export function recordDecision(
  core: ConsciousnessCore,
  phase: string,
  action: string,
  reasoning: string,
  confidence: number,
): string {
  const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const record: DecisionRecord = {
    id: decisionId,
    timestamp: Date.now(),
    phase,
    action,
    reasoning,
    outcome: "unknown",
    confidence,
  };

  core.metacognitive.decisionHistory.push(record);
  core.metacognitive.totalDecisionsTracked++;

  // 限制历史记录数量（保留最近1000条）
  if (core.metacognitive.decisionHistory.length > 1000) {
    core.metacognitive.decisionHistory = core.metacognitive.decisionHistory.slice(-1000);
  }

  return decisionId;
}

/**
 * 🔥 更新决策结果
 */
export function updateDecisionOutcome(
  core: ConsciousnessCore,
  decisionId: string,
  outcome: DecisionRecord["outcome"],
  actualResult?: string,
  durationMs?: number,
): void {
  const decision = core.metacognitive.decisionHistory.find((d) => d.id === decisionId);
  
  if (decision) {
    decision.outcome = outcome;
    decision.actualResult = actualResult;
    decision.durationMs = durationMs;
    
    // 重新计算性能指标
    recalculatePerformanceMetrics(core);
  }
}

/**
 * 🔥 重新计算性能指标
 */
function recalculatePerformanceMetrics(core: ConsciousnessCore): void {
  const history = core.metacognitive.decisionHistory;
  
  if (history.length === 0) {
    return;
  }

  // 计算成功率
  const successfulDecisions = history.filter((d) => d.outcome === "success").length;
  const knownOutcomes = history.filter((d) => d.outcome !== "unknown").length;
  
  core.metacognitive.performanceMetrics.decisionSuccessRate = 
    knownOutcomes > 0 ? successfulDecisions / knownOutcomes : 0.5;

  // 计算平均置信度
  const avgConfidence = history.reduce((sum, d) => sum + d.confidence, 0) / history.length;
  core.metacognitive.performanceMetrics.averageConfidence = avgConfidence;

  // 更新趋势数据
  core.metacognitive.performanceMetrics.coherenceTrend.push(core.consciousness.coherenceScore);
  core.metacognitive.performanceMetrics.awakenessTrend.push(core.consciousness.awakenessScore);
  
  const dominantDesireData = core.desires.dominantDesire 
    ? core.desires.desires.get(core.desires.dominantDesire)
    : null;
  core.metacognitive.performanceMetrics.desireIntensityTrend.push(
    dominantDesireData?.intensity || 0
  );

  // 限制趋势数据长度（保留最近100个点）
  const maxTrendLength = 100;
  if (core.metacognitive.performanceMetrics.coherenceTrend.length > maxTrendLength) {
    core.metacognitive.performanceMetrics.coherenceTrend = 
      core.metacognitive.performanceMetrics.coherenceTrend.slice(-maxTrendLength);
  }
  if (core.metacognitive.performanceMetrics.awakenessTrend.length > maxTrendLength) {
    core.metacognitive.performanceMetrics.awakenessTrend = 
      core.metacognitive.performanceMetrics.awakenessTrend.slice(-maxTrendLength);
  }
  if (core.metacognitive.performanceMetrics.desireIntensityTrend.length > maxTrendLength) {
    core.metacognitive.performanceMetrics.desireIntensityTrend = 
      core.metacognitive.performanceMetrics.desireIntensityTrend.slice(-maxTrendLength);
  }

  core.metacognitive.performanceMetrics.lastCalculatedAt = Date.now();
}

/**
 * 🔥 执行自我反思
 */
export function performSelfReflection(core: ConsciousnessCore): SelfReflection | null {
  const metrics = core.metacognitive.performanceMetrics;
  const history = core.metacognitive.decisionHistory;
  
  const topics: string[] = [];
  const insights: string[] = [];
  let confidence = 0.5;

  if (metrics.decisionSuccessRate < 0.4) {
    topics.push("决策成功率异常");
    const recentFails = history.filter((d) => d.outcome === "failure").slice(-5);
    const failPhases = recentFails.map((d) => d.phase).filter(Boolean);
    const dominantFailPhase = failPhases.length > 0 ? failPhases.sort((a, b) => failPhases.filter((v) => v === b).length - failPhases.filter((v) => v === a).length)[0] : null;
    insights.push(
      `成功率${(metrics.decisionSuccessRate * 100).toFixed(1)}%低于阈值。${dominantFailPhase ? `失败集中在"${dominantFailPhase}"相位，建议审查该相位决策逻辑。` : "建议降低行动频率或提高决策阈值。"}`
    );
    confidence = 0.8;
  }

  if (core.consciousness.coherenceScore < 0.3) {
    topics.push("意识连贯性危机");
    insights.push(
      `连贯性${core.consciousness.coherenceScore.toFixed(2)}接近临界值。当前相位${core.consciousness.phase}，建议增加反思相位权重或暂停高风险行动。`
    );
    confidence = Math.max(confidence, 0.75);
  }

  if (metrics.averageConfidence < 0.4) {
    topics.push("决策置信度系统性偏低");
    const lowConfDecisions = history.filter((d) => d.confidence < 0.3).slice(-3);
    insights.push(
      `平均置信度${(metrics.averageConfidence * 100).toFixed(1)}%。${lowConfDecisions.length > 0 ? `近期${lowConfDecisions.length}个决策置信度<30%，涉及行动: ${lowConfDecisions.map((d) => d.action.slice(0, 15)).join(", ")}。` : ""}建议增强感知输入质量。`
    );
    confidence = Math.max(confidence, 0.7);
  }

  const coherenceTrend = metrics.coherenceTrend;
  if (coherenceTrend.length >= 5) {
    const recentTrend = coherenceTrend.slice(-5);
    const isDeclining = recentTrend.every((v, i) => i === 0 || v < recentTrend[i - 1]!);
    if (isDeclining && recentTrend[0]! - recentTrend[recentTrend.length - 1]! > 0.1) {
      topics.push("连贯性持续下降趋势");
      insights.push(`连续${recentTrend.length}个周期连贯性下降，降幅${((recentTrend[0]! - recentTrend[recentTrend.length - 1]!) * 100).toFixed(1)}%。可能需要外部干预或策略调整。`);
      confidence = Math.max(confidence, 0.85);
    }
  }

  if (topics.length === 0) {
    topics.push("整体状态评估");
    insights.push(`系统运行稳定：成功率${(metrics.decisionSuccessRate * 100).toFixed(1)}%，连贯性${core.consciousness.coherenceScore.toFixed(2)}，觉醒度${core.consciousness.awakenessScore.toFixed(2)}。已追踪${core.metacognitive.totalDecisionsTracked}个决策。`);
    confidence = 0.5;
  }

  const topic = topics.join(" + ");
  const insight = insights.join(" ");

  const reflectionId = `reflection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const reflection: SelfReflection = {
    id: reflectionId,
    timestamp: Date.now(),
    topic,
    insight,
    confidence,
    actionable: confidence > 0.6,
    implemented: false,
  };

  core.metacognitive.selfReflections.push(reflection);

  if (core.metacognitive.selfReflections.length > 50) {
    core.metacognitive.selfReflections = core.metacognitive.selfReflections.slice(-50);
  }

  core.monologue = thinkReflection(
    core.monologue,
    topic,
    insight
  );

  core.mortality = addLegacy(
    core.mortality,
    "wisdom",
    `元认知反思: ${topic}`,
    confidence * 0.5
  );

  return reflection;
}

/**
 * 🔥 生成优化建议
 */
export function generateOptimizationSuggestions(core: ConsciousnessCore): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const metrics = core.metacognitive.performanceMetrics;

  // 基于决策成功率
  if (metrics.decisionSuccessRate < 0.5) {
    suggestions.push({
      id: `opt_${Date.now()}_success_rate`,
      timestamp: Date.now(),
      category: "action",
      suggestion: "提高决策阈值，减少低置信度行动",
      priority: "high",
      estimatedImpact: 0.3,
      implemented: false,
    });
  }

  // 基于意识连贯性
  if (core.consciousness.coherenceScore < 0.4) {
    suggestions.push({
      id: `opt_${Date.now()}_coherence`,
      timestamp: Date.now(),
      category: "consciousness",
      suggestion: "增加反思阶段时长，提升意识整合",
      priority: "critical",
      estimatedImpact: 0.4,
      implemented: false,
    });
  }

  // 基于觉醒度
  if (core.consciousness.awakenessScore < 0.5) {
    suggestions.push({
      id: `opt_${Date.now()}_awakeness`,
      timestamp: Date.now(),
      category: "consciousness",
      suggestion: "激活更多概念碰撞，提升觉醒度",
      priority: "medium",
      estimatedImpact: 0.25,
      implemented: false,
    });
  }

  // 基于欲望强度
  const dominantDesireData = core.desires.dominantDesire
    ? core.desires.desires.get(core.desires.dominantDesire)
    : null;
  if (dominantDesireData && dominantDesireData.intensity > 0.9) {
    suggestions.push({
      id: `opt_${Date.now()}_desire`,
      timestamp: Date.now(),
      category: "desire",
      suggestion: `主导欲望 ${core.desires.dominantDesire} 强度过高，需要分散注意力`,
      priority: "high",
      estimatedImpact: 0.35,
      implemented: false,
    });
  }

  // 保存建议
  for (const suggestion of suggestions) {
    core.metacognitive.optimizationSuggestions.push(suggestion);
  }

  // 限制建议数量（保留最近30条）
  if (core.metacognitive.optimizationSuggestions.length > 30) {
    core.metacognitive.optimizationSuggestions = 
      core.metacognitive.optimizationSuggestions.slice(-30);
  }

  return suggestions;
}

/**
 * 🔥 应用优化建议
 */
export function applyOptimizationSuggestion(
  core: ConsciousnessCore,
  suggestionId: string,
): boolean {
  const suggestion = core.metacognitive.optimizationSuggestions.find(
    (s) => s.id === suggestionId
  );
  
  if (!suggestion) {
    return false;
  }

  try {
    // 根据类别应用不同的优化策略
    switch (suggestion.category) {
      case "desire":
        // 降低主导欲望强度
        if (core.desires.dominantDesire) {
          const currentDesire = core.desires.desires.get(core.desires.dominantDesire);
          if (currentDesire) {
            currentDesire.intensity *= 0.8;
          }
        }
        break;
      
      case "consciousness":
        // 提升连贯性或觉醒度
        core.consciousness.coherenceScore = Math.min(
          1.0,
          core.consciousness.coherenceScore + 0.1
        );
        break;
      
      case "action":
        // 调整意志生成参数（简化实现）
        core.will.generationRate *= 0.9;
        break;
      
      case "will":
        // 增强意志力
        core.will.volitionStrength = Math.min(
          1.0,
          core.will.volitionStrength + 0.1
        );
        break;
      
      case "resource":
        // 资源优化（预留接口）
        break;
    }

    suggestion.implemented = true;

    core.monologue = thinkInsight(
      core.monologue,
      `已应用优化建议: ${suggestion.suggestion.slice(0, 80)}`,
      "metacognitive"
    );

    core.mortality = addLegacy(
      core.mortality,
      "pattern",
      `元认知优化: ${suggestion.category} - ${suggestion.suggestion.slice(0, 50)}`,
      0.4
    );

    return true;
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `优化建议应用失败: ${String(err)}`,
      "metacognitive"
    );
    return false;
  }
}

/**
 * 🔥 格式化元认知状态
 */
export function formatMetacognitiveState(state: MetacognitiveState): string {
  const lines: string[] = [
    `🧠 元认知监控状态:`,
    `   决策追踪: ${state.totalDecisionsTracked}`,
    `   成功率: ${(state.performanceMetrics.decisionSuccessRate * 100).toFixed(1)}%`,
    `   平均置信度: ${(state.performanceMetrics.averageConfidence * 100).toFixed(1)}%`,
    `   自我反思: ${state.selfReflections.length}`,
    `   优化建议: ${state.optimizationSuggestions.filter((s) => !s.implemented).length}`,
  ];

  if (state.lastAnalysisAt) {
    const ago = Math.floor((Date.now() - state.lastAnalysisAt) / 1000);
    lines.push(`   上次分析: ${ago}秒前`);
  }

  // 显示最近的反思
  if (state.selfReflections.length > 0) {
    const latest = state.selfReflections[state.selfReflections.length - 1];
    if (latest) {
      lines.push(`   最新反思: ${latest.topic} (${(latest.confidence * 100).toFixed(0)}%)`);
    }
  }

  // 显示待实施的优化建议
  const pendingSuggestions = state.optimizationSuggestions.filter((s) => !s.implemented);
  if (pendingSuggestions.length > 0) {
    lines.push(`   待实施建议:`);
    pendingSuggestions.slice(0, 3).forEach((s) => {
      const priorityIcon = 
        s.priority === "critical" ? "🔴" :
        s.priority === "high" ? "🟠" :
        s.priority === "medium" ? "🟡" : "🟢";
      lines.push(`     ${priorityIcon} [${s.category}] ${s.suggestion.slice(0, 50)}`);
    });
  }

  return lines.join("\n");
}

export function integrateHealthReport(
  core: ConsciousnessCore,
  report: HealthReport,
): void {
  core.metacognitive.lastHealthReport = report;
  core.metacognitive.healthTrend = [...core.metacognitive.healthTrend, report.metrics].slice(-30);

  const healthCorrections = report.corrections.filter((c) => c.applied);
  if (healthCorrections.length > 0) {
    for (const correction of healthCorrections) {
      const suggestion: OptimizationSuggestion = {
        id: `opt_health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        category: correction.target === "origin-weights" || correction.target === "risk-threshold"
          ? "will"
          : correction.target === "pattern-prune"
          ? "action"
          : "consciousness",
        suggestion: `[运行时验证] ${correction.description}`,
        priority: report.metrics.overallHealth < 0.5 ? "critical" : report.metrics.overallHealth < 0.7 ? "high" : "medium",
        estimatedImpact: 1.0 - report.metrics.overallHealth,
        implemented: true,
      };
      core.metacognitive.optimizationSuggestions.push(suggestion);
    }
  }

  if (core.metacognitive.optimizationSuggestions.length > 30) {
    core.metacognitive.optimizationSuggestions =
      core.metacognitive.optimizationSuggestions.slice(-30);
  }

  const blendFactor = 0.3;
  const currentRate = core.metacognitive.performanceMetrics.decisionSuccessRate;
  core.metacognitive.performanceMetrics.decisionSuccessRate =
    currentRate * (1 - blendFactor) + report.metrics.decisionQuality * blendFactor;

  const newFocus: string[] = [];
  if (report.metrics.decisionQuality < 0.5) newFocus.push("decision-quality");
  if (report.metrics.volitionEffectiveness < 0.5) newFocus.push("volition-effectiveness");
  if (report.metrics.patternFreshness < 0.4) newFocus.push("pattern-freshness");
  if (report.metrics.coherenceStability < 0.4) newFocus.push("coherence-stability");
  if (report.metrics.diversityScore < 0.4) newFocus.push("diversity");

  core.metacognitive.degradedAspectFocus = newFocus;
}

export function deriveValidationFocus(
  state: MetacognitiveState,
): { sensitivityBoost: Record<string, number>; priorityAspects: string[] } {
  const sensitivityBoost: Record<string, number> = {};
  const priorityAspects: string[] = [];

  const focus = state.degradedAspectFocus;

  for (const aspect of focus) {
    switch (aspect) {
      case "decision-quality":
        sensitivityBoost["success-rate-drop"] = 1.5;
        priorityAspects.push("decision-quality");
        break;
      case "volition-effectiveness":
        sensitivityBoost["stuck-volitions"] = 1.3;
        priorityAspects.push("volition-effectiveness");
        break;
      case "pattern-freshness":
        sensitivityBoost["stale-patterns"] = 1.4;
        sensitivityBoost["pattern-monopoly"] = 1.2;
        priorityAspects.push("pattern-freshness");
        break;
      case "coherence-stability":
        sensitivityBoost["low-coherence"] = 1.5;
        priorityAspects.push("coherence-stability");
        break;
      case "diversity":
        sensitivityBoost["origin-imbalance"] = 1.3;
        sensitivityBoost["pattern-monopoly"] = 1.4;
        priorityAspects.push("diversity");
        break;
    }
  }

  if (state.healthTrend.length >= 3) {
    const recent3 = state.healthTrend.slice(-3);
    const trend = recent3[2]!.overallHealth - recent3[0]!.overallHealth;
    if (trend < -0.1) {
      sensitivityBoost["success-rate-drop"] = (sensitivityBoost["success-rate-drop"] ?? 1.0) * 1.5;
      priorityAspects.push("declining-health-trend");
    }
  }

  return { sensitivityBoost, priorityAspects };
}
