import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../src/gateway/ai-gateway/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("初始状态为 closed", () => {
    const cb = new CircuitBreaker();
    expect(cb.currentState).toBe("closed");
    expect(cb.isAvailable).toBe(true);
  });

  it("连续失败达到阈值后打开", () => {
    const cb = new CircuitBreaker(3, 1000);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.currentState).toBe("closed");
    cb.recordFailure();
    expect(cb.currentState).toBe("open");
    expect(cb.isAvailable).toBe(false);
  });

  it("恢复超时后进入 half-open", () => {
    const cb = new CircuitBreaker(1, 50);
    cb.recordFailure();
    expect(cb.currentState).toBe("open");
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.currentState).toBe("half-open");
        expect(cb.isAvailable).toBe(true);
        resolve();
      }, 60);
    });
  });

  it("half-open 状态连续成功后恢复 closed", () => {
    const cb = new CircuitBreaker(1, 50, 2);
    cb.recordFailure();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.currentState).toBe("half-open");
        cb.recordSuccess();
        cb.recordSuccess();
        expect(cb.currentState).toBe("closed");
        resolve();
      }, 60);
    });
  });

  it("reset 恢复到初始状态", () => {
    const cb = new CircuitBreaker(1, 10000);
    cb.recordFailure();
    expect(cb.currentState).toBe("open");
    cb.reset();
    expect(cb.currentState).toBe("closed");
    expect(cb.isAvailable).toBe(true);
  });
});
