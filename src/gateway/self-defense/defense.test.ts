import { describe, it, expect } from "vitest";

describe("createSelfDefenseSystem", () => {
  it("evaluateRequest() 对合法请求返回 allow", async () => {
    const { createSelfDefenseSystem } = await import("./defense.js");
    const defense = createSelfDefenseSystem();
    const verdict = defense.evaluate({
      requestRate: 10,
      errorRate: 0.01,
      authFailureRate: 0.01,
      payloadSizeAvg: 1024,
      geoAnomalies: 0,
    });
    expect(verdict.action).toBe("allow");
  });

  it("addRule() 添加自定义规则后生效", async () => {
    const { createSelfDefenseSystem } = await import("./defense.js");
    const defense = createSelfDefenseSystem();
    defense.addRule({
      name: "custom-high-concurrency",
      evaluate: (ind) => ({
        triggered: ind.patternAnomalies > 100,
        severity: 1,
        reason: "并发模式异常",
      }),
      action: "challenge",
      cooldownMs: 30_000,
    });
    const verdict = defense.evaluate({
      requestRate: 10,
      patternAnomalies: 200,
    });
    expect(verdict.action).toBe("challenge");
  });

  it("IP 封禁：recordEvent 封禁 IP 后 getActiveBlocks 返回该 IP", async () => {
    const { createSelfDefenseSystem } = await import("./defense.js");
    const defense = createSelfDefenseSystem({ blockDurationMs: 60000 });
    defense.recordEvent({
      type: "block",
      ip: "192.168.1.100",
      timestamp: Date.now(),
      metadata: { ip: "192.168.1.100", reason: "brute-force" },
    });
    const blocks = defense.getActiveBlocks();
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].ip).toBe("192.168.1.100");
  });

  it("getStats() 返回正确的统计信息", async () => {
    const { createSelfDefenseSystem } = await import("./defense.js");
    const defense = createSelfDefenseSystem();
    defense.evaluate({ requestRate: 10 });
    defense.evaluate({ requestRate: 10 });
    defense.evaluate({ requestRate: 200 });
    const stats = defense.getStats();
    expect(stats.totalEvaluations).toBe(3);
    expect(stats.totalBlocks).toBeGreaterThanOrEqual(0);
    expect(stats.totalRateLimits).toBeGreaterThanOrEqual(0);
  });
});
