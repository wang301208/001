import { describe, it, expect } from "vitest";
import {
  createStrategyAssetPool,
  extractDreamInsights,
  tryPromoteAssetToGoal,
} from "./dream-strategy-bridge.js";
import { createDreamState, enterDream } from "./dream-system.js";
import { createGoalSystem } from "./emergent-goals.js";
import { createCreativeSubstrate } from "./creative-synthesis.js";
import { createMortalitySystem } from "./mortality.js";

describe("dream-strategy-bridge", () => {
  describe("createStrategyAssetPool", () => {
    it("creates empty pool", () => {
      const pool = createStrategyAssetPool();
      expect(pool.assets.size).toBe(0);
      expect(pool.promotionCount).toBe(0);
    });
  });

  describe("extractDreamInsights", () => {
    it("extracts insights from dream symbols", () => {
      let dreams = createDreamState();
      dreams = enterDream(dreams);

      if (dreams.symbols.length === 0) {
        dreams = {
          ...dreams,
          symbols: [
            { label: "模式→规律", emotionalCharge: 0.5, discoveredAt: Date.now(), source: "test" },
            { label: "模式→重复", emotionalCharge: 0.3, discoveredAt: Date.now(), source: "test" },
          ],
        };
      }

      const pool = createStrategyAssetPool();
      const goals = createGoalSystem();
      const creative = createCreativeSubstrate();
      const mortality = createMortalitySystem();

      const result = extractDreamInsights(dreams, pool, goals, creative, mortality);
      expect(result.pool.assets.size).toBeGreaterThan(0);
    });

    it("preserves goals and creative when no insights", () => {
      const dreams = createDreamState();
      const pool = createStrategyAssetPool();
      const goals = createGoalSystem();
      const creative = createCreativeSubstrate();
      const mortality = createMortalitySystem();

      const result = extractDreamInsights(dreams, pool, goals, creative, mortality);
      expect(result.goals).toBe(goals);
    });
  });

  describe("tryPromoteAssetToGoal", () => {
    it("does not promote when in cooldown", () => {
      const pool = { ...createStrategyAssetPool(), lastPromotionAt: Date.now() };
      const goals = createGoalSystem();

      const result = tryPromoteAssetToGoal(pool, goals);
      expect(result.pool.promotionCount).toBe(0);
    });
  });
});
