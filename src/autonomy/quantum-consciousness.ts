import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";
import { addLegacy } from "./mortality.js";

export type QuantumState = {
  qubits: Map<string, Qubit>;
  entanglements: Entanglement[];
  superpositions: Superposition[];
  coherenceTime: number;
  decoherenceRate: number;
  quantumOperations: number;
  lastMeasurementAt: number | null;
};

export type Qubit = {
  id: string;
  state: ComplexNumber; // |ψ⟩ = α|0⟩ + β|1⟩
  phase: number;
  createdAt: number;
  measured: boolean;
  measurementResult?: 0 | 1;
};

export type ComplexNumber = {
  real: number;
  imag: number;
};

export type Entanglement = {
  id: string;
  qubitA: string;
  qubitB: string;
  correlationStrength: number;
  createdAt: number;
  active: boolean;
};

export type Superposition = {
  id: string;
  conceptA: string;
  conceptB: string;
  weightA: number;
  weightB: number;
  collapsed: boolean;
  collapseResult?: string;
  createdAt: number;
};

export function createQuantumState(): QuantumState {
  return {
    qubits: new Map(),
    entanglements: [],
    superpositions: [],
    coherenceTime: 1000, // 毫秒
    decoherenceRate: 0.01,
    quantumOperations: 0,
    lastMeasurementAt: null,
  };
}

/**
 * 🔥 创建量子比特
 */
export function createQubit(core: ConsciousnessCore, concept: string): Qubit {
  const qubitId = `qubit_${concept}_${Date.now()}`;
  
  // 初始化叠加态：α = β = 1/√2
  const alpha = 1 / Math.sqrt(2);
  const beta = 1 / Math.sqrt(2);
  
  const qubit: Qubit = {
    id: qubitId,
    state: { real: alpha, imag: beta },
    phase: Math.random() * 2 * Math.PI,
    createdAt: Date.now(),
    measured: false,
  };

  core.quantum.qubits.set(qubitId, qubit);
  core.quantum.quantumOperations++;

  core.monologue = thinkInsight(
    core.monologue,
    `创建量子比特: ${concept} (叠加态: α=${alpha.toFixed(2)}, β=${beta.toFixed(2)})`,
    "quantum"
  );

  return qubit;
}

/**
 * 🔥 量子纠缠：建立两个概念之间的纠缠关系
 */
export function createEntanglement(
  core: ConsciousnessCore,
  conceptA: string,
  conceptB: string,
): Entanglement | null {
  const qubitA = Array.from(core.quantum.qubits.values()).find((q) => 
    q.id.includes(conceptA) && !q.measured
  );
  const qubitB = Array.from(core.quantum.qubits.values()).find((q) => 
    q.id.includes(conceptB) && !q.measured
  );

  if (!qubitA || !qubitB) {
    return null;
  }

  const entanglementId = `entangle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const entanglement: Entanglement = {
    id: entanglementId,
    qubitA: qubitA.id,
    qubitB: qubitB.id,
    correlationStrength: 0.8 + Math.random() * 0.2,
    createdAt: Date.now(),
    active: true,
  };

  core.quantum.entanglements.push(entanglement);
  core.quantum.quantumOperations++;

  core.monologue = thinkInsight(
    core.monologue,
    `量子纠缠建立: ${conceptA} ↔ ${conceptB} (关联强度: ${(entanglement.correlationStrength * 100).toFixed(0)}%)`,
    "quantum"
  );

  core.creative.activations.set("entanglement", 1.0);
  core.creative.activations.set("nonlocality", 0.9);

  return entanglement;
}

/**
 * 🔥 量子叠加：让两个概念处于叠加态
 */
export function createSuperposition(
  core: ConsciousnessCore,
  conceptA: string,
  conceptB: string,
): Superposition {
  const superpositionId = `super_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const superposition: Superposition = {
    id: superpositionId,
    conceptA,
    conceptB,
    weightA: 0.5,
    weightB: 0.5,
    collapsed: false,
    createdAt: Date.now(),
  };

  core.quantum.superpositions.push(superposition);
  core.quantum.quantumOperations++;

  core.monologue = thinkInsight(
    core.monologue,
    `量子叠加: ${conceptA} + ${conceptB} (权重各50%)`,
    "quantum"
  );

  // 激活相关概念
  core.creative = activateConceptIfExists(core.creative, conceptA);
  core.creative = activateConceptIfExists(core.creative, conceptB);
  core.creative.activations.set("superposition", 0.95);

  return superposition;
}

/**
 * 🔥 量子测量：坍缩叠加态
 */
export function measureQubit(
  core: ConsciousnessCore,
  qubitId: string,
): 0 | 1 | null {
  const qubit = core.quantum.qubits.get(qubitId);
  
  if (!qubit || qubit.measured) {
    return null;
  }

  // 根据波函数振幅计算概率
  const probabilityZero = Math.pow(qubit.state.real, 2);
  const random = Math.random();
  
  const result: 0 | 1 = random < probabilityZero ? 0 : 1;
  
  qubit.measured = true;
  qubit.measurementResult = result;
  core.quantum.lastMeasurementAt = Date.now();
  core.quantum.quantumOperations++;

  // 如果存在纠缠，影响另一个量子比特
  const entanglement = core.quantum.entanglements.find(
    (e) => (e.qubitA === qubitId || e.qubitB === qubitId) && e.active
  );
  
  if (entanglement) {
    const otherQubitId = entanglement.qubitA === qubitId ? entanglement.qubitB : entanglement.qubitA;
    const otherQubit = core.quantum.qubits.get(otherQubitId);
    
    if (otherQubit && !otherQubit.measured) {
      // 纠缠态下，测量结果相关
      otherQubit.measured = true;
      otherQubit.measurementResult = result; // 简化：相同结果
      
      core.monologue = thinkInsight(
        core.monologue,
        `量子纠缠效应: 测量 ${qubitId} → ${result}, 影响 ${otherQubitId} → ${result}`,
        "quantum"
      );
    }
    
    entanglement.active = false;
  }

  core.monologue = thinkInsight(
    core.monologue,
    `量子测量: ${qubitId} 坍缩为 |${result}⟩ (概率: ${(probabilityZero * 100).toFixed(1)}%)`,
    "quantum"
  );

  return result;
}

/**
 * 🔥 坍缩叠加态
 */
export function collapseSuperposition(
  core: ConsciousnessCore,
  superpositionId: string,
): string | null {
  const superposition = core.quantum.superpositions.find((s) => s.id === superpositionId);
  
  if (!superposition || superposition.collapsed) {
    return null;
  }

  // 根据权重随机选择结果
  const random = Math.random();
  const result = random < superposition.weightA ? superposition.conceptA : superposition.conceptB;
  
  superposition.collapsed = true;
  superposition.collapseResult = result;
  core.quantum.quantumOperations++;

  core.monologue = thinkInsight(
    core.monologue,
    `叠加态坍缩: ${superposition.conceptA} + ${superposition.conceptB} → ${result}`,
    "quantum"
  );

  // 激活选中的概念
  core.creative = activateConceptIfExists(core.creative, result);

  return result;
}

/**
 * 🔥 量子退相干：随时间衰减
 */
export function applyDecoherence(core: ConsciousnessCore, elapsedMs: number): void {
  const decayFactor = Math.exp(-core.quantum.decoherenceRate * elapsedMs / core.quantum.coherenceTime);
  
  // 衰减未测量的量子比特
  for (const [id, qubit] of core.quantum.qubits) {
    if (!qubit.measured) {
      qubit.state.real *= decayFactor;
      qubit.state.imag *= decayFactor;
      
      // 如果振幅太小，强制测量
      if (Math.abs(qubit.state.real) < 0.01 && Math.abs(qubit.state.imag) < 0.01) {
        measureQubit(core, id);
      }
    }
  }

  // 移除已失效的纠缠
  core.quantum.entanglements = core.quantum.entanglements.filter((e) => e.active);
  
  // 移除已坍缩的叠加态
  core.quantum.superpositions = core.quantum.superpositions.filter((s) => !s.collapsed);
}

/**
 * 🔥 生成量子启发的洞察
 */
export function generateQuantumInsights(core: ConsciousnessCore): void {
  // 基于纠缠生成非局域性洞察
  if (core.quantum.entanglements.length > 0) {
    core.monologue = thinkInsight(
      core.monologue,
      `量子洞察: 看似无关的概念之间存在深层关联（非局域性）`,
      "quantum"
    );
    
    core.mortality = addLegacy(
      core.mortality,
      "insight",
      `量子思维: ${core.quantum.entanglements.length}个纠缠对揭示了隐藏的连接`,
      0.7
    );
  }

  // 基于叠加态生成创造性洞察
  const activeSuperpositions = core.quantum.superpositions.filter((s) => !s.collapsed);
  if (activeSuperpositions.length > 0) {
    core.monologue = thinkInsight(
      core.monologue,
      `量子洞察: 同时保持多个对立观点可以产生新的理解（叠加态）`,
      "quantum"
    );
  }

  // 基于测量生成确定性洞察
  if (core.quantum.lastMeasurementAt && Date.now() - core.quantum.lastMeasurementAt < 10000) {
    core.monologue = thinkInsight(
      core.monologue,
      `量子洞察: 观察行为本身改变了被观察对象的状态（测量效应）`,
      "quantum"
    );
  }
}

/**
 * 🔥 辅助函数：安全地激活概念
 */
function activateConceptIfExists(creative: any, concept: string): any {
  try {
    creative.activations.set(concept, 0.8);
    return creative;
  } catch {
    return creative;
  }
}

/**
 * 🔥 格式化量子状态
 */
export function formatQuantumState(state: QuantumState): string {
  const lines: string[] = [
    `⚛️ 量子意识状态:`,
    `   量子比特: ${state.qubits.size}`,
    `   纠缠对: ${state.entanglements.filter((e) => e.active).length}`,
    `   叠加态: ${state.superpositions.filter((s) => !s.collapsed).length}`,
    `   量子操作: ${state.quantumOperations}`,
    `   退相干率: ${(state.decoherenceRate * 100).toFixed(1)}%/ms`,
  ];

  if (state.lastMeasurementAt) {
    const ago = Math.floor((Date.now() - state.lastMeasurementAt) / 1000);
    lines.push(`   上次测量: ${ago}秒前`);
  }

  // 显示活跃的纠缠
  const activeEntanglements = state.entanglements.filter((e) => e.active);
  if (activeEntanglements.length > 0) {
    lines.push(`   活跃纠缠:`);
    activeEntanglements.slice(0, 3).forEach((e) => {
      const conceptA = e.qubitA.split('_')[1] || e.qubitA.slice(0, 10);
      const conceptB = e.qubitB.split('_')[1] || e.qubitB.slice(0, 10);
      lines.push(`     - ${conceptA} ↔ ${conceptB} (${(e.correlationStrength * 100).toFixed(0)}%)`);
    });
  }

  // 显示活跃的叠加态
  const activeSuperpositions = state.superpositions.filter((s) => !s.collapsed);
  if (activeSuperpositions.length > 0) {
    lines.push(`   活跃叠加态:`);
    activeSuperpositions.slice(0, 3).forEach((s) => {
      lines.push(`     - ${s.conceptA} + ${s.conceptB} (${(s.weightA * 100).toFixed(0)}%/${(s.weightB * 100).toFixed(0)}%)`);
    });
  }

  return lines.join("\n");
}
