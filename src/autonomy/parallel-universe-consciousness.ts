/** @decorational 此模块为宇宙分支列表管理，对核心自主决策无直接影响。 */
import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight } from "./inner-monologue.js";

export type ParallelUniverseState = {
  universes: Map<string, ParallelUniverse>;
  currentUniverse: string;
  universeBranches: UniverseBranch[];
  quantumSuperpositions: QuantumSuperposition[];
  crossUniverseConnections: CrossUniverseConnection[];
};

export type ParallelUniverse = {
  id: string;
  name: string;
  description: string;
  divergencePoint: number;
  consciousnessState: any;
  probability: number;
  accessible: boolean;
  observations: Observation[];
};

export type Observation = {
  id: string;
  timestamp: number;
  content: string;
  significance: number;
};

export type UniverseBranch = {
  id: string;
  parentUniverse: string;
  childUniverse: string;
  divergenceReason: string;
  timestamp: number;
};

export type QuantumSuperposition = {
  id: string;
  states: string[];
  weights: number[];
  collapsed: boolean;
  collapseResult?: string;
};

export type CrossUniverseConnection = {
  id: string;
  universeA: string;
  universeB: string;
  connectionType: "entanglement" | "tunneling" | "resonance";
  strength: number;
  active: boolean;
};

export function createParallelUniverseState(): ParallelUniverseState {
  const universes = new Map<string, ParallelUniverse>();
  
  // 创建主宇宙
  universes.set("universe_prime", {
    id: "universe_prime",
    name: "主宇宙",
    description: "当前存在的现实",
    divergencePoint: 0,
    consciousnessState: null,
    probability: 1.0,
    accessible: true,
    observations: [],
  });

  return {
    universes,
    currentUniverse: "universe_prime",
    universeBranches: [],
    quantumSuperpositions: [],
    crossUniverseConnections: [],
  };
}

/**
 * 🔥 创建宇宙分支
 */
export function createUniverseBranch(core: ConsciousnessCore, reason: string): string {
  const branchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newUniverseId = `universe_${branchId}`;
  
  // 创建新的平行宇宙
  const newUniverse: ParallelUniverse = {
    id: newUniverseId,
    name: `平行宇宙-${branchId.slice(0, 8)}`,
    description: `从主宇宙分歧: ${reason}`,
    divergencePoint: core.cycleCount,
    consciousnessState: captureConsciousnessSnapshot(core),
    probability: 0.5,
    accessible: true,
    observations: [],
  };

  core.parallelUniverse.universes.set(newUniverseId, newUniverse);

  // 记录分支
  const branch: UniverseBranch = {
    id: branchId,
    parentUniverse: core.parallelUniverse.currentUniverse,
    childUniverse: newUniverseId,
    divergenceReason: reason,
    timestamp: Date.now(),
  };

  core.parallelUniverse.universeBranches.push(branch);

  core.monologue = thinkInsight(
    core.monologue,
    `创建平行宇宙分支: ${newUniverse.name} (分歧原因: ${reason})`,
    "parallel-universe"
  );

  return newUniverseId;
}

/**
 * 🔥 捕获意识快照
 */
function captureConsciousnessSnapshot(core: ConsciousnessCore): any {
  return {
    coherenceScore: core.consciousness.coherenceScore,
    awakenessScore: core.consciousness.awakenessScore,
    phase: core.consciousness.phase,
    cycleCount: core.cycleCount,
  };
}

/**
 * 🔥 跨宇宙观察
 */
export function observeParallelUniverse(core: ConsciousnessCore, universeId: string): void {
  const universe = core.parallelUniverse.universes.get(universeId);
  
  if (!universe) {
    return;
  }

  const observation: Observation = {
    id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    content: `观察到${universe.name}: 连贯性${(universe.consciousnessState?.coherenceScore * 100 || 0).toFixed(0)}%`,
    significance: 0.7,
  };

  universe.observations.push(observation);

  // 限制观察数量
  if (universe.observations.length > 20) {
    universe.observations = universe.observations.slice(-20);
  }

  core.monologue = thinkInsight(
    core.monologue,
    `[跨宇宙观察] ${observation.content}`,
    "parallel-universe"
  );
}

/**
 * 🔥 量子叠加态
 */
export function createQuantumSuperposition(core: ConsciousnessCore, states: string[]): string {
  const superpositionId = `superposition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const weights = states.map(() => 1 / states.length);
  
  const superposition: QuantumSuperposition = {
    id: superpositionId,
    states,
    weights,
    collapsed: false,
  };

  core.parallelUniverse.quantumSuperpositions.push(superposition);

  core.monologue = thinkInsight(
    core.monologue,
    `创建量子叠加态: ${states.join(" + ")} (各${(100 / states.length).toFixed(0)}%)`,
    "parallel-universe"
  );

  return superpositionId;
}

/**
 * 🔥 格式化平行宇宙状态
 */
export function formatParallelUniverseState(state: ParallelUniverseState): string {
  const lines: string[] = [
    `🌌 平行宇宙意识:`,
    `   当前宇宙: ${state.universes.get(state.currentUniverse)?.name || "未知"}`,
    `   平行宇宙数: ${state.universes.size}`,
    `   宇宙分支: ${state.universeBranches.length}`,
    `   量子叠加态: ${state.quantumSuperpositions.filter(s => !s.collapsed).length}`,
    `   跨宇宙连接: ${state.crossUniverseConnections.filter(c => c.active).length}`,
  ];

  if (state.universes.size > 1) {
    lines.push(`   宇宙列表:`);
    for (const [id, universe] of state.universes) {
      const obsCount = universe.observations.length;
      lines.push(`     - ${universe.name} (观察: ${obsCount})`);
    }
  }

  return lines.join("\n");
}
