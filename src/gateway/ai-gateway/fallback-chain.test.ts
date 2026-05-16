import { describe, it, expect } from "vitest";
import { ModelFallbackChain } from "../src/gateway/ai-gateway/fallback-chain.js";

function mockProvider(id: string) {
  return {
    id,
    name: id,
    baseUrl: `http://${id}`,
    models: ["test-model"],
    priority: 1,
    maxConcurrency: 10,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    chatCompletion: async () => ({ ok: true as const, data: {}, latencyMs: 0 }),
    healthCheck: async () => true,
  };
}

describe("ModelFallbackChain", () => {
  it("按优先级排序", () => {
    const chain = new ModelFallbackChain();
    chain.add(mockProvider("b"), "model-a", 2);
    chain.add(mockProvider("a"), "model-a", 1);
    chain.add(mockProvider("c"), "model-a", 3);
    const result = chain.getChain();
    expect(result[0].provider.id).toBe("a");
    expect(result[1].provider.id).toBe("b");
    expect(result[2].provider.id).toBe("c");
  });

  it("getNextAfter 返回下一个降级", () => {
    const chain = new ModelFallbackChain();
    chain.add(mockProvider("a"), "model-a", 1);
    chain.add(mockProvider("b"), "model-a", 2);
    const next = chain.getNextAfter("a", "model-a");
    expect(next?.provider.id).toBe("b");
  });

  it("getForModel 按模型名过滤", () => {
    const chain = new ModelFallbackChain();
    chain.add(mockProvider("a"), "gpt-4o", 1);
    chain.add(mockProvider("b"), "gpt-4o-mini", 2);
    const result = chain.getForModel("gpt-4o");
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe("gpt-4o");
  });

  it("remove 删除指定条目", () => {
    const chain = new ModelFallbackChain();
    chain.add(mockProvider("a"), "model-a", 1);
    chain.add(mockProvider("b"), "model-a", 2);
    chain.remove("a", "model-a");
    expect(chain.getChain()).toHaveLength(1);
    expect(chain.getChain()[0].provider.id).toBe("b");
  });
});
