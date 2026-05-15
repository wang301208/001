import type { ConsciousnessCore } from "./consciousness-core.js";
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
  
  let topic: string;
  let insight: string;
  let confidence: number;

  // 基于性能指标生成反思
  if (metrics.decisionSuccessRate < 0.4) {
    topic = "决策成功率低";
    insight = `当前决策成功率仅为 ${(metrics.decisionSuccessRate * 100).toFixed(1)}%，建议降低行动频率或提高决策阈值`;
    confidence = 0.8;
  } else if (core.consciousness.coherenceScore < 0.3) {
    topic = "意识连贯性不足";
    insight = `意识连贯性降至 ${core.consciousness.coherenceScore.toFixed(2)}，需要更多反思和整合时间`;
    confidence = 0.75;
  } else if (metrics.averageConfidence < 0.4) {
    topic = "决策置信度低";
    insight = `平均置信度为 ${(metrics.averageConfidence * 100).toFixed(1)}%，表明系统对自身判断缺乏信心`;
    confidence = 0.7;
  } else {
    topic = "整体状态评估";
    insight = `系统运行良好：成功率 ${(metrics.decisionSuccessRate * 100).toFixed(1)}%，连贯性 ${core.consciousness.coherenceScore.toFixed(2)}`;
    confidence = 0.6;
  }

  const reflectionId = `reflection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const reflection: SelfReflection = {
    id: reflectionId,
    timestamp: Date.now(),
    topic,
    insight,
    confidence,
    actionable: true,
    implemented: false,
  };

  core.metacognitive.selfReflections.push(reflection);

  // 限制反思数量（保留最近50条）
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
