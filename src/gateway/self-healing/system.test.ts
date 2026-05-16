import { describe, it, expect } from "vitest";
import { createSelfHealingSystem } from "../src/gateway/self-healing/system.js";

describe("SelfHealingSystem", () => {
  it("初始状态正确", () => {
    const system = createSelfHealingSystem();
    const status = system.getStatus();
    expect(status.running).toBe(false);
    expect(status.checksRegistered).toBe(0);
    expect(status.remediationsRegistered).toBe(0);
  });

  it("注册健康检查和修复动作", () => {
    const system = createSelfHealingSystem();
    system.registerHealthCheck({
      component: "test",
      check: async () => ({
        component: "test",
        status: "healthy",
        lastCheckAt: Date.now(),
      }),
    });
    system.registerRemediation({
      name: "restart",
      component: "test",
      execute: async () => ({ success: true, message: "restarted" }),
    });
    const status = system.getStatus();
    expect(status.checksRegistered).toBe(1);
    expect(status.remediationsRegistered).toBe(1);
  });

  it("启动后停止", () => {
    const system = createSelfHealingSystem();
    system.registerHealthCheck({
      component: "test",
      intervalMs: 1000,
      check: async () => ({
        component: "test",
        status: "healthy",
        lastCheckAt: Date.now(),
      }),
    });
    system.start();
    expect(system.getStatus().running).toBe(true);
    system.stop();
    expect(system.getStatus().running).toBe(false);
  });

  it("异常检测和回调", async () => {
    const anomalies: unknown[] = [];
    const system = createSelfHealingSystem({
      onAnomaly: (event) => {
        anomalies.push(event);
      },
    });
    system.registerHealthCheck({
      component: "failing",
      check: async () => ({
        component: "failing",
        status: "unhealthy",
        message: "connection lost",
        lastCheckAt: Date.now(),
      }),
    });
    system.start();
    await new Promise((r) => setTimeout(r, 200));
    system.stop();
    expect(anomalies.length).toBeGreaterThan(0);
  });
});
