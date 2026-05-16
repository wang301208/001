import { describe, it, expect } from "vitest";

describe("自治中间件", () => {
  it("自防御中间件 - 拦截被封禁IP", async () => {
    const { createSelfDefenseSystem } = await import("../../self-defense/defense.js");
    const { createLocalEventBus } = await import("../../event-bus/bus.js");
    const defense = createSelfDefenseSystem({ blockDurationMs: 60_000 });
    const eventBus = createLocalEventBus("test");

    defense.recordEvent({
      type: "block",
      ip: "1.2.3.4",
      timestamp: Date.now(),
      metadata: { ip: "1.2.3.4", reason: "test block" },
    });

    const blocks = defense.getActiveBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].ip).toBe("1.2.3.4");

    const verdict = defense.evaluate({ requestRate: 10, errorRate: 0, authFailureRate: 0 });
    expect(verdict.action).toBe("allow");
  });

  it("语义缓存中间件 - 命中/未命中", async () => {
    const { createSemanticCache } = await import("../../semantic-cache/cache.js");
    const cache = createSemanticCache(undefined, { similarityThreshold: 0.9 });

    const missResult = await cache.get("你好世界");
    expect(missResult.hit).toBe(false);

    await cache.set("你好世界", { choices: [{ message: { content: "你好！" } }] });
    const hitResult = await cache.get("你好世界");
    expect(hitResult.hit).toBe(true);
    expect(hitResult.entry?.value).toBeDefined();
  });

  it("成本治理中间件 - 配额检查", async () => {
    const { createCostGovernance } = await import("../../cost-governance/governance.js");
    const governance = createCostGovernance();

    governance.setTenantQuota("test-tenant", { dailyLimitUsd: 0.01, monthlyLimitUsd: 1 });

    const allowed = governance.checkQuota("test-tenant", 0.005);
    expect(allowed.allowed).toBe(true);

    const blocked = governance.checkQuota("test-tenant", 0.01);
    expect(blocked.allowed).toBe(false);
  });

  it("审计链中间件 - 记录请求", async () => {
    const { createAuditChain } = await import("../../audit-chain/chain.js");
    const chain = createAuditChain();

    chain.append({
      actor: "127.0.0.1",
      action: "POST /v1/chat/completions",
      resource: "/v1/chat/completions",
      outcome: "success",
    });

    chain.append({
      actor: "192.168.1.1",
      action: "POST /v1/chat/completions",
      resource: "/v1/chat/completions",
      outcome: "failure",
    });

    const entries = chain.getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].actor).toBe("127.0.0.1");
    expect(entries[1].previousHash).toBe(entries[0].hash);

    const integrity = chain.verify();
    expect(integrity.valid).toBe(true);
  });

  it("指标联动 - 事件总线订阅指标", async () => {
    const { createLocalEventBus } = await import("../../event-bus/bus.js");
    const { createConfigEvolution } = await import("../../config-evolution/evolution.js");
    const { createMetricsIntegration } = await import("../../autonomous-orchestrator/metrics-integration.js");

    const eventBus = createLocalEventBus("test");
    const configEvolution = createConfigEvolution();

    configEvolution.registerParameter({
      path: "gateway.maxConcurrentRequests",
      currentValue: 100,
      minValue: 10,
      maxValue: 1000,
      step: 10,
      impact: "high",
    });

    const shutdown = createMetricsIntegration({
      configEvolution,
      eventBus,
      config: { adaptIntervalMs: 1000 },
    });

    await eventBus.publish("metrics.request", {
      method: "POST",
      path: "/v1/chat/completions",
      status: 200,
      durationMs: 150,
      timestamp: Date.now(),
    });

    const stats = eventBus.getStats();
    expect(stats.published).toBeGreaterThanOrEqual(1);

    shutdown();
  });
});
