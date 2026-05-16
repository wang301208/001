import { describe, it, expect } from "vitest";
import { createPredictionModel, createPredictivePreheater } from "../src/gateway/predictive/preheater.js";

describe("PredictionModel", () => {
  it("高频访问项预测概率高", () => {
    const model = createPredictionModel();
    for (let i = 0; i < 10; i++) {
      model.update("frequent", true);
    }
    const prob = model.predictAccessProbability("frequent");
    expect(prob).toBeGreaterThan(0.5);
  });

  it("低频访问项预测概率低", () => {
    const model = createPredictionModel();
    model.update("rare", true);
    for (let i = 0; i < 10; i++) {
      model.update("rare", false);
    }
    const prob = model.predictAccessProbability("rare");
    expect(prob).toBeLessThan(0.5);
  });

  it("预热候选项按概率过滤", () => {
    const model = createPredictionModel();
    for (let i = 0; i < 5; i++) {
      model.update("hot", true);
    }
    model.update("cold", false);
    const candidates = model.getPreheatCandidates(0.5);
    expect(candidates).toContain("hot");
    expect(candidates).not.toContain("cold");
  });
});

describe("PredictivePreheater", () => {
  it("记录访问并预热", async () => {
    const loaded: string[] = [];
    const preheater = createPredictivePreheater(
      async (key) => {
        loaded.push(key);
      },
      { threshold: 0.5, maxConcurrentPreheats: 5 },
    );
    for (let i = 0; i < 5; i++) {
      preheater.onAccess("plugin:telegram");
    }
    const results = await preheater.preheat();
    expect(results.length).toBeGreaterThan(0);
  });

  it("统计信息正确", () => {
    const preheater = createPredictivePreheater(async () => {});
    const stats = preheater.getStats();
    expect(stats.trackedKeys).toBe(0);
    expect(stats.preheatedKeys).toBe(0);
  });
});
