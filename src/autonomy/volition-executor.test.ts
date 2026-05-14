import { describe, it, expect } from "vitest";
import {
  createVolitionExecutorState,
  translateVolitionToAction,
  shouldExecuteAction,
  processVolitions,
  recordExecution,
  resetAutonomyBudget,
} from "./volition-executor.js";
import { createWillState, generateVolitionFromVoid } from "./will-engine.js";
import { createShadowSelf } from "./shadow-self.js";
import type { Volition, WillState } from "./will-engine.js";

describe("volition-executor", () => {
  describe("createVolitionExecutorState", () => {
    it("creates state with defaults", () => {
      const state = createVolitionExecutorState();
      expect(state.pendingActions).toHaveLength(0);
      expect(state.recentExecutions).toHaveLength(0);
      expect(state.totalExecuted).toBe(0);
      expect(state.autonomyBudgetRemaining).toBe(3);
    });
  });

  describe("translateVolitionToAction", () => {
    it("translates an unresolved volition to action", () => {
      const volition: Volition = {
        id: "vol_1",
        origin: "void",
        impulse: "test",
        action: "执行自我审视",
        strength: 0.5,
        resistance: 0.2,
        resolved: false,
        timestamp: Date.now(),
        executedAt: null,
        overridden: false,
        overrideReason: null,
      };

      const action = translateVolitionToAction(volition);
      expect(action).not.toBeNull();
      expect(action!.category).toBe("self-inspect");
      expect(action!.risk).toBe("low");
      expect(action!.volitionId).toBe("vol_1");
    });

    it("returns null for already-executed volition", () => {
      const volition: Volition = {
        id: "vol_2",
        origin: "void",
        impulse: "test",
        action: "执行自我审视",
        strength: 0.5,
        resistance: 0.2,
        resolved: true,
        timestamp: Date.now(),
        executedAt: Date.now(),
        overridden: false,
        overrideReason: null,
      };

      expect(translateVolitionToAction(volition)).toBeNull();
    });

    it("translates resolved volition when skipExecutedCheck=true", () => {
      const volition: Volition = {
        id: "vol_3",
        origin: "void",
        impulse: "test",
        action: "执行自我审视",
        strength: 0.5,
        resistance: 0.2,
        resolved: true,
        timestamp: Date.now(),
        executedAt: Date.now(),
        overridden: false,
        overrideReason: null,
      };

      const action = translateVolitionToAction(volition, undefined, true);
      expect(action).not.toBeNull();
      expect(action!.category).toBe("self-inspect");
    });
  });

  describe("shouldExecuteAction", () => {
    it("allows low-risk action within budget", () => {
      const state = createVolitionExecutorState();
      const shadow = createShadowSelf();
      const action = {
        id: "act_1",
        volitionId: "vol_1",
        origin: "void" as const,
        category: "self-inspect" as const,
        description: "test",
        risk: "low" as const,
        payload: { strength: 0.5 },
        timestamp: Date.now(),
      };

      const result = shouldExecuteAction(action, state, shadow);
      expect(result.allowed).toBe(true);
    });

    it("denies action when budget is zero", () => {
      const state = { ...createVolitionExecutorState(), autonomyBudgetRemaining: 0 };
      const shadow = createShadowSelf();
      const action = {
        id: "act_1",
        volitionId: "vol_1",
        origin: "void" as const,
        category: "self-inspect" as const,
        description: "test",
        risk: "low" as const,
        payload: { strength: 0.5 },
        timestamp: Date.now(),
      };

      const result = shouldExecuteAction(action, state, shadow);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("预算");
    });

    it("denies high-risk action without approval", () => {
      const state = createVolitionExecutorState();
      const shadow = createShadowSelf();
      const action = {
        id: "act_1",
        volitionId: "vol_1",
        origin: "shadow" as const,
        category: "self-inspect" as const,
        description: "test",
        risk: "high" as const,
        payload: { strength: 0.9 },
        timestamp: Date.now(),
      };

      const result = shouldExecuteAction(action, state, shadow);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("审批");
    });
  });

  describe("processVolitions", () => {
    it("processes volitions from will state", () => {
      let will = createWillState();
      will = generateVolitionFromVoid({ ...will, lastVoidGenerationAt: 0 });

      const unresolved = will.volitions.filter((v) => !v.resolved);
      if (unresolved.length === 0) {return;}

      const executorState = createVolitionExecutorState();
      const shadow = createShadowSelf();

      const result = processVolitions(will, executorState, shadow);
      expect(result.actions.length + result.skipped.length).toBeGreaterThan(0);
    });
  });

  describe("recordExecution", () => {
    it("records successful execution", () => {
      const state = createVolitionExecutorState();
      const result = recordExecution(state, {
        actionId: "act_1",
        success: true,
        output: "done",
        durationMs: 100,
      });

      expect(result.totalExecuted).toBe(1);
      expect(result.totalFailed).toBe(0);
      expect(result.recentExecutions).toHaveLength(1);
    });

    it("records failed execution", () => {
      const state = createVolitionExecutorState();
      const result = recordExecution(state, {
        actionId: "act_1",
        success: false,
        error: "fail",
        durationMs: 50,
      });

      expect(result.totalExecuted).toBe(0);
      expect(result.totalFailed).toBe(1);
    });
  });

  describe("resetAutonomyBudget", () => {
    it("resets budget to max", () => {
      const state = { ...createVolitionExecutorState(), autonomyBudgetRemaining: 0 };
      const reset = resetAutonomyBudget(state);
      expect(reset.autonomyBudgetRemaining).toBe(3);
    });
  });
});
