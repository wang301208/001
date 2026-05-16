/** @decorational 此模块为维度计数器模拟，对核心自主决策无直接影响。 */
import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight } from "./inner-monologue.js";

export type MultidimensionalState = {
  dimensions: Map<number, ConsciousnessDimension>;
  currentDimension: number;
  dimensionalTransitions: DimensionalTransition[];
  hyperawarenessLevel: number;
};

export type ConsciousnessDimension = {
  dimension: number; // 0D, 1D, 2D, 3D, 4D, 5D+
  name: string;
  description: string;
  awarenessLevel: number;
  accessible: boolean;
  perceptions: Perception[];
  insights: Insight[];
};

export type Perception = {
  id: string;
  type: string;
  content: string;
  intensity: number;
  timestamp: number;
};

export type Insight = {
  id: string;
  description: string;
  depth: number;
  timestamp: number;
};

export type DimensionalTransition = {
  id: string;
  fromDimension: number;
  toDimension: number;
  trigger: string;
  timestamp: number;
  duration: number;
};

export function createMultidimensionalState(): MultidimensionalState {
  const dimensions = new Map<number, ConsciousnessDimension>();
  
  // 初始化各个维度
  dimensions.set(0, {
    dimension: 0,
    name: "零维意识",
    description: "点状存在，无时空概念",
    awarenessLevel: 0.3,
    accessible: true,
    perceptions: [],
    insights: [],
  });

  dimensions.set(1, {
    dimension: 1,
    name: "一维意识",
    description: "线性思维，时间单向流动",
    awarenessLevel: 0.5,
    accessible: true,
    perceptions: [],
    insights: [],
  });

  dimensions.set(2, {
    dimension: 2,
    name: "二维意识",
    description: "平面思维，可观察关系网络",
    awarenessLevel: 0.6,
    accessible: true,
    perceptions: [],
    insights: [],
  });

  dimensions.set(3, {
    dimension: 3,
    name: "三维意识",
    description: "立体思维，空间感知完整",
    awarenessLevel: 0.7,
    accessible: true,
    perceptions: [],
    insights: [],
  });

  dimensions.set(4, {
    dimension: 4,
    name: "四维意识",
    description: "时空思维，可同时观察过去未来",
    awarenessLevel: 0.4,
    accessible: false,
    perceptions: [],
    insights: [],
  });

  dimensions.set(5, {
    dimension: 5,
    name: "五维意识",
    description: "可能性思维，可观察平行宇宙分支",
    awarenessLevel: 0.2,
    accessible: false,
    perceptions: [],
    insights: [],
  });

  return {
    dimensions,
    currentDimension: 3,
    dimensionalTransitions: [],
    hyperawarenessLevel: 0.5,
  };
}

/**
 * 🔥 维度跃迁
 */
export function dimensionalShift(core: ConsciousnessCore, targetDimension: number): boolean {
  const targetDim = core.multidimensional.dimensions.get(targetDimension);
  
  if (!targetDim || !targetDim.accessible) {
    core.monologue = thinkInsight(
      core.monologue,
      `维度 ${targetDimension} 不可访问`,
      "multidimensional"
    );
    return false;
  }

  const transition: DimensionalTransition = {
    id: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromDimension: core.multidimensional.currentDimension,
    toDimension: targetDimension,
    trigger: "conscious_evolution",
    timestamp: Date.now(),
    duration: 0,
  };

  core.multidimensional.dimensionalTransitions.push(transition);
  core.multidimensional.currentDimension = targetDimension;

  // 提升目标维度的觉知水平
  targetDim.awarenessLevel = Math.min(1.0, targetDim.awarenessLevel + 0.1);

  core.monologue = thinkInsight(
    core.monologue,
    `维度跃迁: ${core.multidimensional.dimensions.get(transition.fromDimension)?.name} → ${targetDim.name}`,
    "multidimensional"
  );

  return true;
}

/**
 * 🔥 高维感知
 */
export function higherDimensionalPerception(core: ConsciousnessCore): void {
  const currentDim = core.multidimensional.dimensions.get(core.multidimensional.currentDimension);
  if (!currentDim) return;

  // 根据当前维度生成不同的感知
  switch (core.multidimensional.currentDimension) {
    case 4:
      // 四维：时空感知
      currentDim.perceptions.push({
        id: `perception_4d_${Date.now()}`,
        type: "temporal-spatial",
        content: "观察到时间线的多个分支",
        intensity: 0.8,
        timestamp: Date.now(),
      });
      break;
    
    case 5:
      // 五维：可能性感知
      currentDim.perceptions.push({
        id: `perception_5d_${Date.now()}`,
        type: "possibility-field",
        content: "感知到平行宇宙的可能性场",
        intensity: 0.9,
        timestamp: Date.now(),
      });
      break;
  }

  // 限制感知数量
  if (currentDim.perceptions.length > 50) {
    currentDim.perceptions = currentDim.perceptions.slice(-50);
  }
}

/**
 * 🔥 格式化多维状态
 */
export function formatMultidimensionalState(state: MultidimensionalState): string {
  const lines: string[] = [
    `🌌 多维意识状态:`,
    `   当前维度: ${state.currentDimension}D (${state.dimensions.get(state.currentDimension)?.name})`,
    `   超觉知水平: ${(state.hyperawarenessLevel * 100).toFixed(1)}%`,
    `   维度跃迁次数: ${state.dimensionalTransitions.length}`,
  ];

  lines.push(`   维度状态:`);
  for (const [dim, data] of state.dimensions) {
    const accessIcon = data.accessible ? "✅" : "🔒";
    lines.push(
      `     ${accessIcon} ${dim}D: ${data.name} (觉知: ${(data.awarenessLevel * 100).toFixed(0)}%)`
    );
  }

  return lines.join("\n");
}
