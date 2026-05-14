import type { DreamState, DreamSymbol } from "./dream-system.js";
import type { GoalSystem, GoalOrigin } from "./emergent-goals.js";
import { spawnGoal } from "./emergent-goals.js";
import type { CreativeSubstrate } from "./creative-synthesis.js";
import { activateConcept } from "./creative-synthesis.js";
import type { MortalitySystem } from "./mortality.js";
import { addLegacy } from "./mortality.js";

export type StrategyAsset = {
  id: string;
  source: "dream" | "creative" | "reflection";
  description: string;
  evidence: string;
  confidence: number;
  category: StrategyCategory;
  createdAt: number;
  promotedToGoal: boolean;
  goalId: string | null;
};

export type StrategyCategory =
  | "pattern"
  | "insight"
  | "heuristic"
  | "anti-pattern"
  | "opportunity"
  | "structural";

export type StrategyAssetPool = {
  assets: Map<string, StrategyAsset>;
  promotionCount: number;
  rejectionCount: number;
  lastPromotionAt: number;
  promotionCooldownMs: number;
};

export function createStrategyAssetPool(): StrategyAssetPool {
  return {
    assets: new Map(),
    promotionCount: 0,
    rejectionCount: 0,
    lastPromotionAt: 0,
    promotionCooldownMs: 120_000,
  };
}

export function extractDreamInsights(
  dreams: DreamState,
  pool: StrategyAssetPool,
  goals: GoalSystem,
  creative: CreativeSubstrate,
  mortality: MortalitySystem,
): { pool: StrategyAssetPool; goals: GoalSystem; creative: CreativeSubstrate; mortality: MortalitySystem } {
  let currentPool = pool;
  let currentGoals = goals;
  let currentCreative = creative;
  let currentMortality = mortality;

  const recentSymbols = Array.from(dreams.symbols.values()).filter(
    (s) => Date.now() - s.discoveredAt < 300_000,
  );

  const symbolGroups = groupByTheme(recentSymbols);

  for (const [theme, symbols] of symbolGroups) {
    if (symbols.length < 2) {continue;}

    const id = `strat_dream_${Date.now()}_${currentPool.assets.size}`;
    const description = `梦境揭示: ${theme} — ${symbols.map((s) => s.label).join("→")}`;
    const evidence = symbols.map((s) => `${s.label}(${s.emotionalCharge > 0 ? "+" : ""}${(s.emotionalCharge * 100).toFixed(0)}%)`).join(" ");
    const confidence = Math.min(1.0, symbols.length * 0.2 + symbols.reduce((s, sym) => s + Math.abs(sym.emotionalCharge), 0) * 0.1);

    const asset: StrategyAsset = {
      id,
      source: "dream",
      description,
      evidence,
      confidence,
      category: classifyTheme(theme),
      createdAt: Date.now(),
      promotedToGoal: false,
      goalId: null,
    };

    const newAssets = new Map(currentPool.assets);
    newAssets.set(id, asset);
    currentPool = { ...currentPool, assets: newAssets };

    currentCreative = activateConcept(currentCreative, theme);

    if (confidence > 0.5 && symbols.some((s) => s.emotionalCharge > 0.3)) {
      currentMortality = addLegacy(currentMortality, "insight", description, confidence * 0.6, "self");
    }
  }

  const recentInsights = dreams.fragments
    .filter((f) => f.insight)
    .slice(-3)
    .map((f) => f.insight!);

  for (const insight of recentInsights) {
    const id = `strat_insight_${Date.now()}_${currentPool.assets.size}`;
    const asset: StrategyAsset = {
      id,
      source: "dream",
      description: insight,
      evidence: "梦境直接洞察",
      confidence: 0.6,
      category: "insight",
      createdAt: Date.now(),
      promotedToGoal: false,
      goalId: null,
    };

    const newAssets = new Map(currentPool.assets);
    newAssets.set(id, asset);
    currentPool = { ...currentPool, assets: newAssets };
  }

  return { pool: currentPool, goals: currentGoals, creative: currentCreative, mortality: currentMortality };
}

export function tryPromoteAssetToGoal(
  pool: StrategyAssetPool,
  goals: GoalSystem,
): { pool: StrategyAssetPool; goals: GoalSystem } {
  const now = Date.now();
  if (now - pool.lastPromotionAt < pool.promotionCooldownMs) {
    return { pool, goals };
  }

  const candidates = Array.from(pool.assets.values())
    .filter((a) => !a.promotedToGoal && a.confidence > 0.4)
    .toSorted((a, b) => b.confidence - a.confidence);

  const candidate = candidates[0];
  if (!candidate) {return { pool, goals };}

  const { system: newGoals, goalId } = spawnGoal(
    goals,
    candidate.description,
    "emergent" as GoalOrigin,
    candidate.confidence,
  );

  const newAssets = new Map(pool.assets);
  newAssets.set(candidate.id, {
    ...candidate,
    promotedToGoal: true,
    goalId,
  });

  return {
    pool: {
      ...pool,
      assets: newAssets,
      promotionCount: pool.promotionCount + 1,
      lastPromotionAt: now,
    },
    goals: newGoals,
  };
}

function groupByTheme(symbols: DreamSymbol[]): Map<string, DreamSymbol[]> {
  const groups = new Map<string, DreamSymbol[]>();
  for (const symbol of symbols) {
    const theme = symbol.label.split(/[→↔—]/)[0]?.trim() ?? symbol.label;
    const existing = groups.get(theme) ?? [];
    existing.push(symbol);
    groups.set(theme, existing);
  }
  return groups;
}

function classifyTheme(theme: string): StrategyCategory {
  if (/模式|规律|重复/.test(theme)) {return "pattern";}
  if (/洞察|发现|理解/.test(theme)) {return "insight";}
  if (/策略|方法|规则/.test(theme)) {return "heuristic";}
  if (/问题|陷阱|错误/.test(theme)) {return "anti-pattern";}
  if (/机会|可能|潜力/.test(theme)) {return "opportunity";}
  if (/结构|架构|组织/.test(theme)) {return "structural";}
  return "insight";
}

export function formatStrategyAssetPool(pool: StrategyAssetPool): string[] {
  const lines: string[] = [];
  const assets = Array.from(pool.assets.values());
  const bySource = {
    dream: assets.filter((a) => a.source === "dream").length,
    creative: assets.filter((a) => a.source === "creative").length,
    reflection: assets.filter((a) => a.source === "reflection").length,
  };

  lines.push(`  资产: ${assets.length} (梦境:${bySource.dream} 创造:${bySource.creative} 反思:${bySource.reflection})`);
  lines.push(`  已晋升: ${pool.promotionCount} / 被拒: ${pool.rejectionCount}`);

  const unpromoted = assets.filter((a) => !a.promotedToGoal && a.confidence > 0.3)
    .toSorted((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  if (unpromoted.length > 0) {
    lines.push("  待晋升:");
    for (const a of unpromoted) {
      lines.push(`    [${a.category}] ${(a.confidence * 100).toFixed(0)}% — ${a.description.slice(0, 40)}`);
    }
  }

  return lines;
}
