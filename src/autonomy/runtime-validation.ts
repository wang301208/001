import type { DecisionChainStore, StrategyTemplate } from "./decision-chain.js";
import type { WillState, VolitionOrigin } from "./will-engine.js";
import type { MetacognitiveState } from "./metacognitive-monitor.js";
import type { ConsciousnessState } from "./consciousness.js";

export type HealthMetrics = {
  overallHealth: number;
  decisionQuality: number;
  volitionEffectiveness: number;
  patternFreshness: number;
  coherenceStability: number;
  diversityScore: number;
  stalenessDetected: boolean;
};

export type DegradationIssue = {
  kind: "success-rate-drop" | "stale-patterns" | "low-coherence" | "stuck-volitions" | "origin-imbalance" | "pattern-monopoly";
  severity: number;
  description: string;
  affectedOrigin?: VolitionOrigin;
};

export type CorrectiveAction = {
  target: "origin-weights" | "risk-threshold" | "pattern-prune" | "volition-reset" | "re-evaluation";
  description: string;
  applied: boolean;
};

export type HealthReport = {
  metrics: HealthMetrics;
  issues: DegradationIssue[];
  corrections: CorrectiveAction[];
  validatedAt: number;
};

export function computeHealthMetrics(
  will: WillState,
  decisionChains: DecisionChainStore,
  strategyTemplates: StrategyTemplate[],
  metacognitive: MetacognitiveState,
  consciousness: ConsciousnessState,
  recentHealthHistory: HealthMetrics[],
): HealthMetrics {
  const completedChains = Array.from(decisionChains.chains.values())
    .filter((c) => c.outcome !== null);

  const totalDecisions = completedChains.length;
  const executedCount = completedChains.filter((c) => c.outcome === "executed").length;
  const decisionQuality = totalDecisions > 0 ? executedCount / totalDecisions : 0.5;

  const resolvedVolitions = will.volitions.filter((v) => v.resolved);
  const executedVolitions = resolvedVolitions.filter((v) => !v.overridden);
  const volitionEffectiveness = resolvedVolitions.length > 0
    ? executedVolitions.length / resolvedVolitions.length
    : 0.5;

  const now = Date.now();
  const freshPatterns = decisionChains.patternLibrary
    .filter((p) => now - p.lastUsedAt < 300_000).length;
  const patternFreshness = decisionChains.patternLibrary.length > 0
    ? freshPatterns / decisionChains.patternLibrary.length
    : 1.0;

  const recentCoherence = recentHealthHistory.slice(-5).map((h) => h.coherenceStability);
  const coherenceStability = consciousness.coherenceScore;

  const originCounts = new Map<VolitionOrigin, number>();
  for (const v of will.volitions.slice(-20)) {
    originCounts.set(v.origin, (originCounts.get(v.origin) ?? 0) + 1);
  }
  const usedOrigins = Array.from(originCounts.values()).filter((c) => c >= 2).length;
  const diversityScore = Math.min(1.0, usedOrigins / 4);

  const stalenessDetected = patternFreshness < 0.3 && decisionChains.patternLibrary.length > 5;

  const overallHealth = (
    decisionQuality * 0.3 +
    volitionEffectiveness * 0.2 +
    patternFreshness * 0.15 +
    coherenceStability * 0.2 +
    diversityScore * 0.15
  );

  return {
    overallHealth,
    decisionQuality,
    volitionEffectiveness,
    patternFreshness,
    coherenceStability,
    diversityScore,
    stalenessDetected,
  };
}

export function detectDegradation(
  metrics: HealthMetrics,
  will: WillState,
  decisionChains: DecisionChainStore,
  recentHealthHistory: HealthMetrics[],
): DegradationIssue[] {
  const issues: DegradationIssue[] = [];

  if (recentHealthHistory.length >= 3) {
    const recent3 = recentHealthHistory.slice(-3);
    const trend = recent3[2]!.decisionQuality - recent3[0]!.decisionQuality;
    if (trend < -0.15) {
      issues.push({
        kind: "success-rate-drop",
        severity: Math.min(1.0, Math.abs(trend) * 3),
        description: `决策成功率3周期下降${(trend * 100).toFixed(0)}%，从${(recent3[0]!.decisionQuality * 100).toFixed(0)}%降至${(recent3[2]!.decisionQuality * 100).toFixed(0)}%`,
      });
    }
  }

  if (metrics.stalenessDetected) {
    const staleCount = decisionChains.patternLibrary
      .filter((p) => Date.now() - p.lastUsedAt > 300_000).length;
    issues.push({
      kind: "stale-patterns",
      severity: Math.min(1.0, staleCount / 10),
      description: `${staleCount}个决策模式超过5分钟未使用，模式库可能过时`,
    });
  }

  if (metrics.coherenceStability < 0.3) {
    issues.push({
      kind: "low-coherence",
      severity: 1.0 - metrics.coherenceStability,
      description: `连贯性仅${(metrics.coherenceStability * 100).toFixed(0)}%，认知状态不稳定`,
    });
  }

  const stuckVolitions = will.volitions.filter(
    (v) => !v.resolved && v.maturity === "deliberating" && Date.now() - v.timestamp > 60_000,
  );
  if (stuckVolitions.length >= 3) {
    issues.push({
      kind: "stuck-volitions",
      severity: Math.min(1.0, stuckVolitions.length / 5),
      description: `${stuckVolitions.length}个意志卡在审议阶段超过60秒`,
    });
  }

  const maxWeight = Math.max(...Array.from(will.originWeights.values()));
  const minWeight = Math.min(...Array.from(will.originWeights.values()));
  if (maxWeight / Math.max(0.01, minWeight) > 4) {
    const dominantOrigin = Array.from(will.originWeights.entries())
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    issues.push({
      kind: "origin-imbalance",
      severity: 0.6,
      description: `来源权重极差比${(maxWeight / Math.max(0.01, minWeight)).toFixed(1)}，来源"${dominantOrigin}"过度主导`,
      affectedOrigin: dominantOrigin,
    });
  }

  if (decisionChains.patternLibrary.length > 10) {
    const topCategory = decisionChains.patternLibrary
      .flatMap((p) => p.preferredCategories)
      .reduce<Record<string, number>>((acc, cat) => {
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
      }, {});
    const maxCatCount = Math.max(...Object.values(topCategory));
    if (maxCatCount / decisionChains.patternLibrary.length > 0.6) {
      const dominantCat = Object.entries(topCategory).find(([, c]) => c === maxCatCount)?.[0];
      issues.push({
        kind: "pattern-monopoly",
        severity: 0.5,
        description: `类别"${dominantCat}"占据${(maxCatCount / decisionChains.patternLibrary.length * 100).toFixed(0)}%模式库，决策视野狭窄`,
      });
    }
  }

  return issues;
}

export function applyCorrectiveActions(
  issues: DegradationIssue[],
  will: WillState,
  decisionChains: DecisionChainStore,
): { will: WillState; decisionChains: DecisionChainStore; corrections: CorrectiveAction[] } {
  const corrections: CorrectiveAction[] = [];

  for (const issue of issues) {
    switch (issue.kind) {
      case "success-rate-drop": {
        const newWeights = new Map(will.originWeights);
        for (const [origin, weight] of newWeights) {
          newWeights.set(origin, weight * 0.95 + 0.05);
        }
        will = { ...will, originWeights: newWeights };
        corrections.push({
          target: "origin-weights",
          description: `成功率下降，来源权重向均值回归(学习率0.05)`,
          applied: true,
        });
        break;
      }

      case "stale-patterns": {
        const now = Date.now();
        const prunedPatterns = decisionChains.patternLibrary
          .filter((p) => now - p.lastUsedAt < 600_000 || p.successRate > 0.7);
        const removedCount = decisionChains.patternLibrary.length - prunedPatterns.length;
        decisionChains = { ...decisionChains, patternLibrary: prunedPatterns };
        corrections.push({
          target: "pattern-prune",
          description: `修剪${removedCount}个过时低成功率模式`,
          applied: true,
        });
        break;
      }

      case "low-coherence": {
        will = {
          ...will,
          voidGenerationRate: Math.max(0.5, will.voidGenerationRate * 0.8),
          resolveAccumulator: Math.min(0.8, will.resolveAccumulator + 0.1),
        };
        corrections.push({
          target: "risk-threshold",
          description: `连贯性低，降低冲动频率并提升决断力`,
          applied: true,
        });
        break;
      }

      case "stuck-volitions": {
        const now = Date.now();
        const updatedVolitions = will.volitions.map((v) => {
          if (!v.resolved && v.maturity === "deliberating" && now - v.timestamp > 60_000) {
            return {
              ...v,
              resolved: true,
              overridden: true,
              overrideReason: "运行时验证：审议超时自动否决",
              maturity: "decided" as const,
              maturityEnteredAt: { ...v.maturityEnteredAt, decided: now },
            };
          }
          return v;
        });
        will = { ...will, volitions: updatedVolitions };
        corrections.push({
          target: "volition-reset",
          description: `自动否决卡住的意志`,
          applied: true,
        });
        break;
      }

      case "origin-imbalance": {
        if (issue.affectedOrigin) {
          const currentWeight = will.originWeights.get(issue.affectedOrigin) ?? 1.0;
          const newWeights = new Map(will.originWeights);
          newWeights.set(issue.affectedOrigin, currentWeight * 0.9);
          will = { ...will, originWeights: newWeights };
          corrections.push({
            target: "origin-weights",
            description: `衰减过度主导来源"${issue.affectedOrigin}"权重(${currentWeight.toFixed(2)}→${(currentWeight * 0.9).toFixed(2)})`,
            applied: true,
          });
        }
        break;
      }

      case "pattern-monopoly": {
        corrections.push({
          target: "re-evaluation",
          description: `决策视野狭窄，建议在下一轮生成更多元类型冲动以增加多样性`,
          applied: false,
        });
        break;
      }
    }
  }

  return { will, decisionChains, corrections };
}

export function performRuntimeValidation(
  will: WillState,
  decisionChains: DecisionChainStore,
  strategyTemplates: StrategyTemplate[],
  metacognitive: MetacognitiveState,
  consciousness: ConsciousnessState,
  recentHealthHistory: HealthMetrics[],
): { report: HealthReport; will: WillState; decisionChains: DecisionChainStore } {
  const metrics = computeHealthMetrics(will, decisionChains, strategyTemplates, metacognitive, consciousness, recentHealthHistory);
  const issues = detectDegradation(metrics, will, decisionChains, recentHealthHistory);

  let correctedWill = will;
  let correctedChains = decisionChains;
  let corrections: CorrectiveAction[] = [];

  if (issues.length > 0) {
    const result = applyCorrectiveActions(issues, will, decisionChains);
    correctedWill = result.will;
    correctedChains = result.decisionChains;
    corrections = result.corrections;
  }

  return {
    report: {
      metrics,
      issues,
      corrections,
      validatedAt: Date.now(),
    },
    will: correctedWill,
    decisionChains: correctedChains,
  };
}

export function formatHealthReport(report: HealthReport): string[] {
  const lines: string[] = [
    `运行时验证 [${new Date(report.validatedAt).toISOString().slice(11, 19)}]`,
    `  整体健康: ${(report.metrics.overallHealth * 100).toFixed(0)}%`,
    `  决策质量: ${(report.metrics.decisionQuality * 100).toFixed(0)}% 意志效能: ${(report.metrics.volitionEffectiveness * 100).toFixed(0)}%`,
    `  模式鲜度: ${(report.metrics.patternFreshness * 100).toFixed(0)}% 连贯性: ${(report.metrics.coherenceStability * 100).toFixed(0)}%`,
    `  多样性: ${(report.metrics.diversityScore * 100).toFixed(0)}%`,
  ];

  if (report.issues.length > 0) {
    lines.push(`  检出${report.issues.length}个退化问题:`);
    for (const issue of report.issues) {
      lines.push(`    [${(issue.severity * 100).toFixed(0)}%] ${issue.description}`);
    }
  }

  const appliedCorrections = report.corrections.filter((c) => c.applied);
  if (appliedCorrections.length > 0) {
    lines.push(`  应用${appliedCorrections.length}个修正:`);
    for (const c of appliedCorrections) {
      lines.push(`    → ${c.description}`);
    }
  }

  return lines;
}
