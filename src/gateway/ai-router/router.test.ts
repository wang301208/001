import { describe, it, expect } from "vitest";
import { createAiRouter, StrategyAdaptive, StrategyLeastLatency, StrategyCostOptimized } from "../src/gateway/ai-router/router.js";
import type { ProviderMetrics } from "../src/gateway/ai-router/router.js";

const mockProviders: ProviderMetrics[] = [
  {
    id: "openai",
    avgLatencyMs: 500,
    p99LatencyMs: 2000,
    errorRate: 0.01,
    costPerToken: { prompt: 0.00003, completion: 0.00006 },
    available: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    currentLoad: 5,
    maxLoad: 100,
  },
  {
    id: "ollama",
    avgLatencyMs: 200,
    p99LatencyMs: 800,
    errorRate: 0.05,
    costPerToken: { prompt: 0, completion: 0 },
    available: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    currentLoad: 2,
    maxLoad: 50,
  },
  {
    id: "groq",
    avgLatencyMs: 100,
    p99LatencyMs: 300,
    errorRate: 0.02,
    costPerToken: { prompt: 0.000001, completion: 0.000002 },
    available: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    currentLoad: 10,
    maxLoad: 200,
  },
];

describe("AiRouter", () => {
  it("自适应策略选择最优提供商", async () => {
    const router = createAiRouter(mockProviders, new StrategyAdaptive());
    const decision = await router.route({ model: "gpt-4o" });
    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.estimatedLatencyMs).toBeGreaterThan(0);
    expect(decision.fallbackChain.length).toBeGreaterThan(0);
  });

  it("最低延迟策略选择最快提供商", async () => {
    const router = createAiRouter(mockProviders, new StrategyLeastLatency());
    const decision = await router.route({ model: "gpt-4o" });
    expect(decision.providerId).toBe("groq");
  });

  it("成本优化策略选择最便宜提供商", async () => {
    const router = createAiRouter(mockProviders, new StrategyCostOptimized());
    const decision = await router.route({ model: "gpt-4o" });
    expect(decision.providerId).toBe("ollama");
  });

  it("视觉请求过滤掉不支持视觉的提供商", async () => {
    const router = createAiRouter(mockProviders, new StrategyLeastLatency());
    const decision = await router.route({ model: "gpt-4o", hasVision: true });
    expect(decision.providerId).toBe("openai");
  });

  it("更新指标", async () => {
    const router = createAiRouter(mockProviders, new StrategyAdaptive());
    router.updateMetrics("openai", { avgLatencyMs: 100 });
    const metrics = router.getMetrics();
    expect(metrics.openai.avgLatencyMs).toBe(100);
  });
});
