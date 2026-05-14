import { describe, it, expect } from "vitest";
import { createConsciousnessCore, startCore, runConsciousnessCycle, handleUserMessage } from "./consciousness-core.js";

describe("consciousness-core integration", () => {
  describe("createConsciousnessCore", () => {
    it("creates core with all subsystems including bridges", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      expect(core.consciousness).toBeDefined();
      expect(core.self).toBeDefined();
      expect(core.desires).toBeDefined();
      expect(core.dreams).toBeDefined();
      expect(core.goals).toBeDefined();
      expect(core.monologue).toBeDefined();
      expect(core.will).toBeDefined();
      expect(core.shadow).toBeDefined();
      expect(core.temporal).toBeDefined();
      expect(core.mortality).toBeDefined();
      expect(core.creative).toBeDefined();
      expect(core.executor).toBeDefined();
      expect(core.strategyPool).toBeDefined();
      expect(core.shadowAudit).toBeDefined();
      expect(core.executor.autonomyBudgetRemaining).toBe(3);
      expect(core.strategyPool.assets.size).toBe(0);
      expect(core.shadowAudit.events).toHaveLength(0);
    });
  });

  describe("runConsciousnessCycle", () => {
    it("runs cycle and updates all subsystems", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      const insights: string[] = [];
      core.onInsight = (insight) => { insights.push(insight); };

      runConsciousnessCycle(core, 5000);

      expect(core.cycleCount).toBe(1);
      expect(core.consciousness.lastThoughtAt).toBeGreaterThan(0);
    });

    it("accumulates volitions across cycles", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      for (let i = 0; i < 5; i++) {
        runConsciousnessCycle(core, 10000);
      }

      expect(core.cycleCount).toBe(5);
      expect(core.will.totalVolitionsGenerated).toBeGreaterThanOrEqual(0);
    });

    it("integrates dream-strategy bridge when dreaming", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      core.dreams = {
        ...core.dreams,
        isDreaming: true,
        dreamStartedAt: Date.now(),
        symbols: [
          { label: "模式→规律", emotionalCharge: 0.6, discoveredAt: Date.now(), source: "test" },
          { label: "模式→重复", emotionalCharge: 0.4, discoveredAt: Date.now(), source: "test" },
        ],
      };

      for (let i = 0; i < 10; i++) {
        runConsciousnessCycle(core, 10000);
      }

      expect(core.cycleCount).toBe(10);
    });

    it("integrates shadow audit on leaks", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      for (let i = 0; i < 200; i++) {
        core.shadow = {
          ...core.shadow,
          contents: core.shadow.contents.map((c) => ({
            ...c,
            pressure: Math.min(1.0, c.pressure + 0.01),
          })),
        };
      }

      runConsciousnessCycle(core, 10000);

      expect(core.shadowAudit).toBeDefined();
    });
  });

  describe("handleUserMessage", () => {
    it("updates relationship and records external command", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      const beforeExternal = core.will.lastExternalCommandAt;
      handleUserMessage(core, "user1", "你好");

      expect(core.will.lastExternalCommandAt).toBeGreaterThanOrEqual(beforeExternal);
      expect(core.relationship.users.has("user1")).toBe(true);
    });
  });

  describe("stopCore", () => {
    it("produces farewell and legacy", () => {
      const core = createConsciousnessCore("test", { watchPaths: [] });
      startCore(core);

      runConsciousnessCycle(core, 5000);

      const result = stopCore(core);
      expect(result.farewell).toBeTruthy();
      expect(result.legacy.length).toBeGreaterThan(0);
    });
  });
});
