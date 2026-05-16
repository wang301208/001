export type DecisionPhase = "perceiving" | "contemplating" | "deliberating" | "deciding" | "executing" | "reflecting";

export type ReasoningStep = {
  phase: DecisionPhase;
  input: string;
  reasoning: string;
  output: string;
  confidence: number;
  timestamp: number;
  factors: Record<string, number>;
};

export type DecisionChain = {
  id: string;
  volitionId: string;
  startedAt: number;
  completedAt: number | null;
  steps: ReasoningStep[];
  outcome: "executed" | "rejected" | "deferred" | "deliberating" | null;
  outcomeReason: string | null;
  category: string;
  riskLevel: string;
  finalAction: string | null;
};

export type DecisionChainStore = {
  chains: Map<string, DecisionChain>;
  activeChainId: string | null;
  patternLibrary: DecisionPattern[];
  maxChains: number;
};

export type DecisionPattern = {
  id: string;
  description: string;
  preconditionSignals: string[];
  typicalOutcome: "executed" | "rejected";
  successRate: number;
  usageCount: number;
  lastUsedAt: number;
  preferredCategories: string[];
};

export function createDecisionChainStore(): DecisionChainStore {
  return {
    chains: new Map(),
    activeChainId: null,
    patternLibrary: [],
    maxChains: 200,
  };
}

export function beginChain(
  store: DecisionChainStore,
  volitionId: string,
  category: string,
  riskLevel: string,
): { store: DecisionChainStore; chainId: string } {
  const chainId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const chain: DecisionChain = {
    id: chainId,
    volitionId,
    startedAt: Date.now(),
    completedAt: null,
    steps: [],
    outcome: null,
    outcomeReason: null,
    category,
    riskLevel,
    finalAction: null,
  };

  const newChains = new Map(store.chains);
  newChains.set(chainId, chain);

  if (newChains.size > store.maxChains) {
    const oldest = Array.from(newChains.entries())
      .sort(([, a], [, b]) => a.startedAt - b.startedAt);
    for (let i = 0; i < Math.floor(store.maxChains * 0.2); i++) {
      const [key] = oldest[i] ?? ["", null];
      if (key) newChains.delete(key);
    }
  }

  return {
    store: { ...store, chains: newChains, activeChainId: chainId },
    chainId,
  };
}

export function addReasoningStep(
  store: DecisionChainStore,
  chainId: string,
  step: Omit<ReasoningStep, "timestamp">,
): DecisionChainStore {
  const chain = store.chains.get(chainId);
  if (!chain) return store;

  const fullStep: ReasoningStep = { ...step, timestamp: Date.now() };
  const newChain: DecisionChain = {
    ...chain,
    steps: [...chain.steps, fullStep],
  };

  const newChains = new Map(store.chains);
  newChains.set(chainId, newChain);

  return { ...store, chains: newChains };
}

export function completeChain(
  store: DecisionChainStore,
  chainId: string,
  outcome: DecisionChain["outcome"],
  outcomeReason: string,
  finalAction?: string,
): DecisionChainStore {
  const chain = store.chains.get(chainId);
  if (!chain) return store;

  const newChain: DecisionChain = {
    ...chain,
    completedAt: Date.now(),
    outcome,
    outcomeReason,
    finalAction: finalAction ?? null,
  };

  const newChains = new Map(store.chains);
  newChains.set(chainId, newChain);

  const updatedPatterns = updatePatternLibrary(store.patternLibrary, newChain);

  return {
    ...store,
    chains: newChains,
    patternLibrary: updatedPatterns,
    activeChainId: store.activeChainId === chainId ? null : store.activeChainId,
  };
}

function updatePatternLibrary(library: DecisionPattern[], chain: DecisionChain): DecisionPattern[] {
  if (chain.outcome === null || chain.steps.length === 0) return library;

  const signals = chain.steps
    .filter((s) => s.confidence > 0.5)
    .map((s) => `${s.phase}:${s.input.slice(0, 20)}`);

  const existing = library.find((p) =>
    p.preconditionSignals.length === signals.length &&
    p.preconditionSignals.every((s) => signals.includes(s))
  );

  if (existing) {
    return library.map((p) => {
      if (p.id !== existing.id) return p;
      const newUsageCount = p.usageCount + 1;
      const newSuccessRate = chain.outcome === "executed"
        ? (p.successRate * p.usageCount + 1) / newUsageCount
        : (p.successRate * p.usageCount) / newUsageCount;
      return {
        ...p,
        usageCount: newUsageCount,
        successRate: newSuccessRate,
        lastUsedAt: Date.now(),
      };
    });
  }

  const newPattern: DecisionPattern = {
    id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: `${chain.category}→${chain.outcome} (${chain.steps.length}步推理)`,
    preconditionSignals: signals.slice(0, 5),
    typicalOutcome: chain.outcome,
    successRate: chain.outcome === "executed" ? 1.0 : 0.0,
    usageCount: 1,
    lastUsedAt: Date.now(),
    preferredCategories: [chain.category],
  };

  const updated = [...library, newPattern];
  return updated.length > 50 ? updated.slice(-50) : updated;
}

export function findMatchingPattern(
  store: DecisionChainStore,
  category: string,
  currentSignals: string[],
): DecisionPattern | null {
  const candidates = store.patternLibrary
    .filter((p) => p.usageCount >= 2)
    .filter((p) => p.preferredCategories.includes(category) || p.preconditionSignals.some((s) => currentSignals.includes(s)))
    .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount));

  return candidates[0] ?? null;
}

export function getPatternGuidance(
  store: DecisionChainStore,
  category: string,
  riskLevel: string,
): { shouldProceed: boolean; confidence: number; reason: string } | null {
  const pattern = findMatchingPattern(store, category, [category, riskLevel]);
  if (!pattern) return null;

  return {
    shouldProceed: pattern.typicalOutcome === "executed" && pattern.successRate > 0.5,
    confidence: pattern.successRate,
    reason: `经验模式匹配: ${pattern.description} (成功率${(pattern.successRate * 100).toFixed(0)}%, 使用${pattern.usageCount}次)`,
  };
}

export function retrospectiveCorrect(store: DecisionChainStore): { store: DecisionChainStore; corrections: string[] } {
  const corrections: string[] = [];
  const completedChains = Array.from(store.chains.values())
    .filter((c) => c.outcome !== null && c.steps.length > 0);

  const newChains = new Map(store.chains);

  for (const chain of completedChains) {
    if (chain.outcome === "executed") {
      const decidingStep = chain.steps.find((s) => s.phase === "deciding");
      if (decidingStep && decidingStep.confidence < 0.4) {
        const key = chain.id;
        const existing = newChains.get(key);
        if (existing) {
          newChains.set(key, {
            ...existing,
            outcome: "rejected",
            outcomeReason: `回溯修正: 决策置信度仅${(decidingStep.confidence * 100).toFixed(0)}%<40%, 原标记为executed应标记为rejected`,
          });
          corrections.push(`链#${chain.id.slice(-8)}: 决策置信度${(decidingStep.confidence * 100).toFixed(0)}%过低，从executed修正为rejected`);
        }
      }
    }

    if (chain.outcome === "rejected") {
      const contemplationStep = chain.steps.find((s) => s.phase === "contemplating");
      if (contemplationStep && contemplationStep.confidence > 0.8 && chain.steps.length >= 3) {
        const key = chain.id;
        const existing = newChains.get(key);
        if (existing) {
          newChains.set(key, {
            ...existing,
            outcomeReason: `${existing.outcomeReason ?? ""} [回溯标记: 经验模式高度支持但被拒绝，可能存在过度谨慎]`,
          });
          corrections.push(`链#${chain.id.slice(-8)}: 经验置信度${(contemplationStep.confidence * 100).toFixed(0)}%高但被拒绝，标记为过度谨慎`);
        }
      }
    }
  }

  return {
    store: { ...store, chains: newChains },
    corrections,
  };
}

export function auditDecisionPatterns(store: DecisionChainStore): DecisionAuditReport {
  const completedChains = Array.from(store.chains.values()).filter((c) => c.outcome !== null);

  const totalDecisions = completedChains.length;
  const executedCount = completedChains.filter((c) => c.outcome === "executed").length;
  const rejectedCount = completedChains.filter((c) => c.outcome === "rejected").length;
  const overallSuccessRate = totalDecisions > 0 ? executedCount / totalDecisions : 0;

  const byCategory = new Map<string, { total: number; executed: number; successRate: number }>();
  for (const chain of completedChains) {
    const existing = byCategory.get(chain.category) ?? { total: 0, executed: 0, successRate: 0 };
    existing.total++;
    if (chain.outcome === "executed") existing.executed++;
    existing.successRate = existing.total > 0 ? existing.executed / existing.total : 0;
    byCategory.set(chain.category, existing);
  }

  const byRiskLevel = new Map<string, { total: number; executed: number }>();
  for (const chain of completedChains) {
    const existing = byRiskLevel.get(chain.riskLevel) ?? { total: 0, executed: 0 };
    existing.total++;
    if (chain.outcome === "executed") existing.executed++;
    byRiskLevel.set(chain.riskLevel, existing);
  }

  const biases: string[] = [];
  const highRejectCategories = Array.from(byCategory.entries())
    .filter(([, v]) => v.total >= 3 && v.successRate < 0.3);
  for (const [cat, stats] of highRejectCategories) {
    biases.push(`类别"${cat}"成功率仅${(stats.successRate * 100).toFixed(0)}%(${stats.total}次)，系统可能对该类行动过度拒绝`);
  }

  const alwaysAcceptCategories = Array.from(byCategory.entries())
    .filter(([, v]) => v.total >= 3 && v.successRate > 0.95);
  for (const [cat, stats] of alwaysAcceptCategories) {
    biases.push(`类别"${cat}"成功率${(stats.successRate * 100).toFixed(0)}%(${stats.total}次)，系统可能对该类行动过度放行`);
  }

  const avgDeliberationTime = completedChains
    .filter((c) => c.completedAt !== null)
    .map((c) => c.completedAt! - c.startedAt)
    .reduce((sum, t, _, arr) => sum + t / arr.length, 0);

  const recentChains = completedChains.slice(-10);
  const recentSuccessRate = recentChains.length > 0
    ? recentChains.filter((c) => c.outcome === "executed").length / recentChains.length
    : 0;

  return {
    totalDecisions,
    overallSuccessRate,
    recentSuccessRate,
    categoryBreakdown: Object.fromEntries(byCategory),
    riskLevelBreakdown: Object.fromEntries(byRiskLevel),
    avgDeliberationTimeMs: avgDeliberationTime,
    detectedBiases: biases,
    patternLibrarySize: store.patternLibrary.length,
    topPatterns: store.patternLibrary
      .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount))
      .slice(0, 5)
      .map((p) => `${p.description} [${(p.successRate * 100).toFixed(0)}%×${p.usageCount}次]`),
  };
}

export type StrategyTemplate = {
  id: string;
  name: string;
  preconditionSummary: string;
  actionCategory: string;
  typicalOutcome: "executed" | "rejected";
  successRate: number;
  usageCount: number;
  synthesizedAt: number;
  sourcePatternIds: string[];
  applicabilityConditions: string[];
};

export function synthesizeStrategyTemplates(
  store: DecisionChainStore,
): StrategyTemplate[] {
  const successfulPatterns = store.patternLibrary
    .filter((p) => p.successRate > 0.6 && p.usageCount >= 2 && p.typicalOutcome === "executed");

  if (successfulPatterns.length === 0) return [];

  const byCategory = new Map<string, DecisionPattern[]>();
  for (const pattern of successfulPatterns) {
    for (const cat of pattern.preferredCategories) {
      const existing = byCategory.get(cat) ?? [];
      existing.push(pattern);
      byCategory.set(cat, existing);
    }
  }

  const templates: StrategyTemplate[] = [];

  for (const [category, patterns] of byCategory) {
    const sorted = patterns.sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount));
    const topPatterns = sorted.slice(0, 3);

    if (topPatterns.length === 0) continue;

    const avgSuccess = topPatterns.reduce((s, p) => s + p.successRate, 0) / topPatterns.length;
    const totalUsage = topPatterns.reduce((s, p) => s + p.usageCount, 0);

    const commonSignals = topPatterns
      .flatMap((p) => p.preconditionSignals)
      .reduce<Record<string, number>>((acc, sig) => {
        acc[sig] = (acc[sig] ?? 0) + 1;
        return acc;
      }, {});

    const frequentSignals = Object.entries(commonSignals)
      .filter(([, count]) => count >= 2)
      .map(([sig]) => sig);

    const template: StrategyTemplate = {
      id: `stpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${category}成功策略`,
      preconditionSummary: frequentSignals.length > 0
        ? `常见前置: ${frequentSignals.join(", ")}`
        : `${topPatterns.length}个成功模式归纳`,
      actionCategory: category,
      typicalOutcome: "executed",
      successRate: avgSuccess,
      usageCount: totalUsage,
      synthesizedAt: Date.now(),
      sourcePatternIds: topPatterns.map((p) => p.id),
      applicabilityConditions: [
        `类别匹配=${category}`,
        `成功率>${(avgSuccess * 100).toFixed(0)}%`,
        ...frequentSignals.slice(0, 2).map((s) => `信号=${s}`),
      ],
    };

    templates.push(template);
  }

  return templates
    .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount))
    .slice(0, 10);
}

export function findApplicableStrategy(
  templates: StrategyTemplate[],
  category: string,
  currentSignals: string[],
): StrategyTemplate | null {
  const candidates = templates
    .filter((t) => t.actionCategory === category || t.applicabilityConditions.some((c) => currentSignals.some((s) => c.includes(s))))
    .filter((t) => t.successRate > 0.5)
    .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount));

  return candidates[0] ?? null;
}

export type DecisionAuditReport = {
  totalDecisions: number;
  overallSuccessRate: number;
  recentSuccessRate: number;
  categoryBreakdown: Record<string, { total: number; executed: number; successRate: number }>;
  riskLevelBreakdown: Record<string, { total: number; executed: number }>;
  avgDeliberationTimeMs: number;
  detectedBiases: string[];
  patternLibrarySize: number;
  topPatterns: string[];
};

export function formatDecisionChain(chain: DecisionChain): string[] {
  const lines: string[] = [
    `决策链 #${chain.id.slice(-8)} [${chain.category}/${chain.riskLevel}]`,
    `  结果: ${chain.outcome ?? "进行中"} ${chain.outcomeReason ? `— ${chain.outcomeReason}` : ""}`,
    `  步骤: ${chain.steps.length}`,
  ];

  for (const step of chain.steps) {
    lines.push(`  ${step.phase}: ${step.reasoning.slice(0, 50)} [${(step.confidence * 100).toFixed(0)}%]`);
  }

  return lines;
}
