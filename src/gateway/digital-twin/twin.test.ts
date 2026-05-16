import { describe, it, expect } from "vitest";

describe("createDigitalTwin", () => {
  it("captureSnapshot() 创建系统快照", async () => {
    const { createDigitalTwin } = await import("./twin.js");
    const twin = createDigitalTwin();
    const snapshot = twin.captureSnapshot("gateway", { status: "running" }, { p99LatencyMs: 200, errorRate: 0.01 });
    expect(snapshot.id).toBeDefined();
    expect(snapshot.component).toBe("gateway");
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.state).toEqual({ status: "running" });
    expect(snapshot.metrics).toEqual({ p99LatencyMs: 200, errorRate: 0.01 });
  });

  it("simulate() 基于快照运行仿真", async () => {
    const { createDigitalTwin } = await import("./twin.js");
    const twin = createDigitalTwin();
    const snapshot = twin.captureSnapshot("service-a", { status: "healthy" }, { p99LatencyMs: 500, errorRate: 0.02 });
    const result = twin.simulate(snapshot.id, { scaleFactor: 2, loadMultiplier: 1.5 });
    expect(result.snapshotId).toBe(snapshot.id);
    expect(result.predictedMetrics).toBeDefined();
    expect(result.violations).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("simulate() 对不存在快照返回失败", async () => {
    const { createDigitalTwin } = await import("./twin.js");
    const twin = createDigitalTwin();
    const result = twin.simulate("non-existent-id", {});
    expect(result.success).toBe(false);
    expect(result.violations).toContain("snapshot not found");
  });

  it("validateChange() 验证变更安全性", async () => {
    const { createDigitalTwin } = await import("./twin.js");
    const twin = createDigitalTwin();
    twin.captureSnapshot("service-b", { status: "running" }, { p99LatencyMs: 100 });
    const result = twin.validateChange("service-b", { memory: 512, timeout: 5000 });
    expect(result).toHaveProperty("safe");
    expect(result).toHaveProperty("risks");
    expect(result).toHaveProperty("recommendation");
  });

  it("simulate() 检测内存超限违规", async () => {
    const { createDigitalTwin } = await import("./twin.js");
    const twin = createDigitalTwin();
    const snapshot = twin.captureSnapshot("service-c", {}, { p99LatencyMs: 100, errorRate: 0.01 });
    const result = twin.simulate(snapshot.id, { memory_alloc: 4096 });
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });
});
