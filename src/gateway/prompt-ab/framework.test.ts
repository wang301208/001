import { describe, it, expect } from "vitest";
import { createPromptABFramework } from "../src/gateway/prompt-ab/framework.js";

describe("PromptABFramework", () => {
  it("创建实验并返回 ID", () => {
    const framework = createPromptABFramework();
    const id = framework.createExperiment({
      name: "test",
      model: "gpt-4o",
      variants: [
        { id: "a", name: "A", systemPrompt: "You are A", temperature: 0.7 },
        { id: "b", name: "B", systemPrompt: "You are B", temperature: 0.5 },
      ],
      trafficPercent: 100,
      evaluationMetric: "quality",
    });
    expect(id).toBeTruthy();
    expect(framework.listExperiments()).toHaveLength(1);
  });

  it("分配变体", () => {
    const framework = createPromptABFramework();
    framework.createExperiment({
      name: "test",
      model: "gpt-4o",
      variants: [
        { id: "a", name: "A", systemPrompt: "You are A" },
        { id: "b", name: "B", systemPrompt: "You are B" },
      ],
      trafficPercent: 100,
      evaluationMetric: "latency",
    });
    const expId = framework.listExperiments()[0].id;
    const variant = framework.assignVariant(expId, { userId: "user1" });
    expect(variant).not.toBeNull();
    expect(["a", "b"]).toContain(variant!.id);
  });

  it("记录结果并判定胜出", () => {
    const framework = createPromptABFramework();
    framework.createExperiment({
      name: "test",
      model: "gpt-4o",
      variants: [
        { id: "a", name: "A", systemPrompt: "A" },
        { id: "b", name: "B", systemPrompt: "B" },
      ],
      trafficPercent: 100,
      evaluationMetric: "quality",
      minSampleSize: 5,
    });
    const expId = framework.listExperiments()[0].id;
    for (let i = 0; i < 30; i++) {
      framework.recordOutcome(expId, "a", 0.9);
      framework.recordOutcome(expId, "b", 0.6);
    }
    const winner = framework.getWinner(expId);
    expect(winner).not.toBeNull();
    expect(winner!.variantId).toBe("a");
  });

  it("暂停和恢复实验", () => {
    const framework = createPromptABFramework();
    framework.createExperiment({
      name: "test",
      model: "gpt-4o",
      variants: [
        { id: "a", name: "A", systemPrompt: "A" },
        { id: "b", name: "B", systemPrompt: "B" },
      ],
      trafficPercent: 100,
      evaluationMetric: "latency",
    });
    const expId = framework.listExperiments()[0].id;
    framework.pauseExperiment(expId);
    expect(framework.listExperiments()[0].status).toBe("paused");
    const variant = framework.assignVariant(expId, { userId: "user1" });
    expect(variant).toBeNull();
    framework.resumeExperiment(expId);
    expect(framework.listExperiments()[0].status).toBe("running");
  });
});
