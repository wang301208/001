import type { RoutingContext, RoutingDecision, ProviderMetrics } from "./router.js";

export interface RoutingStrategy {
  decide(ctx: RoutingContext, candidates: ProviderMetrics[]): Promise<RoutingDecision>;
}

export class StrategyLeastLatency implements RoutingStrategy {
  async decide(ctx: RoutingContext, candidates: ProviderMetrics[]): Promise<RoutingDecision> {
    const sorted = [...candidates].toSorted((a, b) => a.avgLatencyMs - b.avgLatencyMs);
    const primary = sorted[0];
    return {
      providerId: primary.id,
      modelId: ctx.model,
      baseUrl: "",
      confidence: 0.9,
      reason: `最低延迟选择: ${primary.avgLatencyMs}ms`,
      estimatedLatencyMs: primary.avgLatencyMs,
      estimatedCostUsd: 0,
      fallbackChain: sorted.slice(1, 3).map((p) => ({ providerId: p.id, modelId: ctx.model })),
    };
  }
}

export class StrategyCostOptimized implements RoutingStrategy {
  async decide(ctx: RoutingContext, candidates: ProviderMetrics[]): Promise<RoutingDecision> {
    const promptTokens = ctx.promptTokens ?? 1000;
    const sorted = [...candidates].toSorted((a, b) => {
      const costA = a.costPerToken.prompt * promptTokens;
      const costB = b.costPerToken.prompt * promptTokens;
      return costA - costB;
    });
    const primary = sorted[0];
    const estimatedCost = primary.costPerToken.prompt * promptTokens;
    return {
      providerId: primary.id,
      modelId: ctx.model,
      baseUrl: "",
      confidence: 0.85,
      reason: `成本优化选择: ~$${estimatedCost.toFixed(6)}`,
      estimatedLatencyMs: primary.avgLatencyMs,
      estimatedCostUsd: estimatedCost,
      fallbackChain: sorted.slice(1, 3).map((p) => ({ providerId: p.id, modelId: ctx.model })),
    };
  }
}

export class StrategyQualityFirst implements RoutingStrategy {
  private qualityRanking = new Map([
    ["anthropic", 1], ["openai", 2], ["google", 3],
    ["openrouter", 4], ["groq", 5], ["mistral", 6],
    ["ollama", 7], ["lmstudio", 8],
  ]);

  async decide(ctx: RoutingContext, candidates: ProviderMetrics[]): Promise<RoutingDecision> {
    const sorted = [...candidates].toSorted((a, b) => {
      const rankA = this.qualityRanking.get(a.id) ?? 99;
      const rankB = this.qualityRanking.get(b.id) ?? 99;
      return rankA - rankB;
    });
    const primary = sorted[0];
    return {
      providerId: primary.id,
      modelId: ctx.model,
      baseUrl: "",
      confidence: 0.8,
      reason: `质量优先选择: ${primary.id}`,
      estimatedLatencyMs: primary.avgLatencyMs,
      estimatedCostUsd: primary.costPerToken.prompt * (ctx.promptTokens ?? 1000),
      fallbackChain: sorted.slice(1, 3).map((p) => ({ providerId: p.id, modelId: ctx.model })),
    };
  }
}

export class StrategyAdaptive implements RoutingStrategy {
  async decide(ctx: RoutingContext, candidates: ProviderMetrics[]): Promise<RoutingDecision> {
    const scored = candidates.map((c) => {
      const latencyScore = 1 / (1 + c.avgLatencyMs / 1000);
      const reliabilityScore = 1 - c.errorRate;
      const costScore = c.costPerToken.prompt > 0 ? 1 / (1 + c.costPerToken.prompt * 10000) : 1;
      const loadScore = c.maxLoad > 0 ? 1 - c.currentLoad / c.maxLoad : 0.5;

      const weights = {
        latency: ctx.priority === "high" ? 0.4 : 0.2,
        reliability: 0.3,
        cost: ctx.priority === "low" ? 0.4 : 0.2,
        load: 0.3,
      };

      const totalScore =
        latencyScore * weights.latency +
        reliabilityScore * weights.reliability +
        costScore * weights.cost +
        loadScore * weights.load;

      return { provider: c, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    const primary = scored[0];

    return {
      providerId: primary.provider.id,
      modelId: ctx.model,
      baseUrl: "",
      confidence: Math.min(primary.score, 1),
      reason: `自适应选择: 综合评分 ${primary.score.toFixed(3)}`,
      estimatedLatencyMs: primary.provider.avgLatencyMs,
      estimatedCostUsd: primary.provider.costPerToken.prompt * (ctx.promptTokens ?? 1000),
      fallbackChain: scored.slice(1, 3).map((s) => ({ providerId: s.provider.id, modelId: ctx.model })),
    };
  }
}
