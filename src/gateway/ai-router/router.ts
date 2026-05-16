export type RoutingContext = {
  model: string;
  promptTokens?: number;
  isStream?: boolean;
  hasTools?: boolean;
  hasVision?: boolean;
  channelId?: string;
  userId?: string;
  priority?: "low" | "normal" | "high";
  maxLatencyMs?: number;
  maxCostUsd?: number;
};

export type RoutingDecision = {
  providerId: string;
  modelId: string;
  baseUrl: string;
  confidence: number;
  reason: string;
  estimatedLatencyMs: number;
  estimatedCostUsd: number;
  fallbackChain: { providerId: string; modelId: string }[];
};

export type ProviderMetrics = {
  id: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  costPerToken: { prompt: number; completion: number };
  available: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  currentLoad: number;
  maxLoad: number;
};

export type AiRouter = {
  route(ctx: RoutingContext): Promise<RoutingDecision>;
  updateMetrics(providerId: string, metrics: Partial<ProviderMetrics>): void;
  getMetrics(): Record<string, ProviderMetrics>;
};

import type { RoutingStrategy } from "./strategies.js";

export function createAiRouter(
  providers: ProviderMetrics[],
  strategy?: RoutingStrategy,
): AiRouter {
  const metricsMap = new Map<string, ProviderMetrics>();
  for (const p of providers) {
    metricsMap.set(p.id, { ...p });
  }

  const activeStrategy = strategy ?? new StrategyAdaptive();

  return {
    async route(ctx) {
      const allMetrics = [...metricsMap.values()];
      const candidates = allMetrics.filter((m) => {
        if (!m.available) {return false;}
        if (ctx.hasTools && !m.supportsTools) {return false;}
        if (ctx.hasVision && !m.supportsVision) {return false;}
        if (ctx.isStream && !m.supportsStreaming) {return false;}
        if (ctx.maxLatencyMs && m.p99LatencyMs > ctx.maxLatencyMs) {return false;}
        return true;
      });

      if (candidates.length === 0) {
        const fallback = allMetrics[0];
        if (!fallback) {
          return {
            providerId: "none",
            modelId: ctx.model,
            baseUrl: "",
            confidence: 0,
            reason: "无可用提供商",
            estimatedLatencyMs: Infinity,
            estimatedCostUsd: Infinity,
            fallbackChain: [],
          };
        }
        return {
          providerId: fallback.id,
          modelId: ctx.model,
          baseUrl: "",
          confidence: 0.1,
          reason: "降级：无完美匹配提供商",
          estimatedLatencyMs: fallback.p99LatencyMs,
          estimatedCostUsd: 0,
          fallbackChain: [],
        };
      }

      return activeStrategy.decide(ctx, candidates);
    },

    updateMetrics(providerId, update) {
      const current = metricsMap.get(providerId);
      if (current) {
        metricsMap.set(providerId, { ...current, ...update });
      }
    },

    getMetrics() {
      return Object.fromEntries(metricsMap);
    },
  };
}
