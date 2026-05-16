import { describe, it, expect } from "vitest";

describe("createAutonomousOrchestrator", () => {
  it("启动后 getStatus().running === true", async () => {
    const { createAutonomousOrchestrator } = await import("./orchestrator.js");
    const orchestrator = createAutonomousOrchestrator();
    await orchestrator.start();
    expect(orchestrator.getStatus().running).toBe(true);
    await orchestrator.stop();
  });

  it("模块状态包含 eventBus, selfHealing, semanticCache, costGovernance, knowledgeBuilder, preheater 且均为 active", async () => {
    const { createAutonomousOrchestrator } = await import("./orchestrator.js");
    const orchestrator = createAutonomousOrchestrator();
    await orchestrator.start();
    const status = orchestrator.getStatus();
    const expectedModules = ["eventBus", "selfHealing", "semanticCache", "costGovernance", "knowledgeBuilder", "preheater"];
    for (const mod of expectedModules) {
      expect(status.modules[mod]).toBe("active");
    }
    await orchestrator.stop();
  });

  it("getModules() 返回的对象有对应的模块实例", async () => {
    const { createAutonomousOrchestrator } = await import("./orchestrator.js");
    const orchestrator = createAutonomousOrchestrator();
    await orchestrator.start();
    const modules = orchestrator.getModules();
    expect(modules.eventBus).toBeDefined();
    expect(modules.semanticCache).toBeDefined();
    expect(modules.costGovernance).toBeDefined();
    expect(modules.knowledgeBuilder).toBeDefined();
    expect(modules.preheater).toBeDefined();
    await orchestrator.stop();
  });

  it("停止后 getStatus().running === false", async () => {
    const { createAutonomousOrchestrator } = await import("./orchestrator.js");
    const orchestrator = createAutonomousOrchestrator();
    await orchestrator.start();
    await orchestrator.stop();
    expect(orchestrator.getStatus().running).toBe(false);
  });

  it("onReady 回调在启动后被调用", async () => {
    const { createAutonomousOrchestrator } = await import("./orchestrator.js");
    const orchestrator = createAutonomousOrchestrator();
    let called = false;
    orchestrator.onReady(() => {
      called = true;
    });
    await orchestrator.start();
    expect(called).toBe(true);
    await orchestrator.stop();
  });
});
