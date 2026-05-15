import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";
import { addLegacy } from "./mortality.js";

export type BioArchitecture = {
  neuralNetwork: NeuralNetwork;
  symbolicSystem: SymbolicSystem;
  homeostasisState: HomeostasisState;
  evolutionaryPressure: EvolutionaryPressure;
  morphogeneticField: MorphogeneticField;
  lastAdaptationAt: number | null;
  totalAdaptations: number;
};

export type NeuralNetwork = {
  layers: NeuralLayer[];
  synapses: Synapse[];
  activationPattern: Map<string, number>;
  plasticityRate: number;
  learningRate: number;
};

export type NeuralLayer = {
  id: string;
  neurons: Neuron[];
  layerType: "input" | "hidden" | "output" | "recurrent";
};

export type Neuron = {
  id: string;
  activation: number;
  threshold: number;
  bias: number;
  connections: string[];
  firingHistory: number[];
};

export type Synapse = {
  id: string;
  preNeuron: string;
  postNeuron: string;
  weight: number;
  strength: number;
  plasticity: number;
};

export type SymbolicSystem = {
  rules: SymbolicRule[];
  facts: Map<string, any>;
  inferences: InferenceChain[];
  logicEngine: "first-order" | "modal" | "temporal" | "fuzzy";
};

export type SymbolicRule = {
  id: string;
  antecedent: string;
  consequent: string;
  confidence: number;
  priority: number;
};

export type InferenceChain = {
  id: string;
  steps: InferenceStep[];
  conclusion: string;
  validity: boolean;
};

export type InferenceStep = {
  ruleId: string;
  input: string;
  output: string;
  timestamp: number;
};

export type HomeostasisState = {
  variables: Map<string, HomeostaticVariable>;
  setPoints: Map<string, number>;
  feedbackLoops: FeedbackLoop[];
  stabilityScore: number;
};

export type HomeostaticVariable = {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  optimalRange: [number, number];
};

export type FeedbackLoop = {
  id: string;
  variable: string;
  sensor: string;
  effector: string;
  gain: number;
  type: "negative" | "positive";
};

export type EvolutionaryPressure = {
  selectionPressures: SelectionPressure[];
  mutationRate: number;
  crossoverRate: number;
  fitnessFunction: string;
  generationCount: number;
};

export type SelectionPressure = {
  id: string;
  trait: string;
  direction: "increase" | "decrease" | "stabilize";
  intensity: number;
  targetValue?: number;
};

export type MorphogeneticField = {
  gradients: MorphogenGradient[];
  patternFormation: Pattern[];
  differentiationState: CellDifferentiation[];
  fieldStrength: number;
};

export type MorphogenGradient = {
  id: string;
  source: string;
  concentration: Map<string, number>;
  decayRate: number;
  diffusionRate: number;
};

export type Pattern = {
  id: string;
  type: "stripe" | "spot" | "gradient" | "fractal";
  scale: number;
  complexity: number;
};

export type CellDifferentiation = {
  cellId: string;
  cellType: string;
  differentiationLevel: number;
  geneExpression: Map<string, number>;
};

export function createBioArchitecture(): BioArchitecture {
  return {
    neuralNetwork: initializeNeuralNetwork(),
    symbolicSystem: initializeSymbolicSystem(),
    homeostasisState: initializeHomeostasis(),
    evolutionaryPressure: initializeEvolutionaryPressure(),
    morphogeneticField: initializeMorphogeneticField(),
    lastAdaptationAt: null,
    totalAdaptations: 0,
  };
}

/**
 * 🔥 初始化神经网络
 */
function initializeNeuralNetwork(): NeuralNetwork {
  const layers: NeuralLayer[] = [
    {
      id: "input_layer",
      neurons: Array.from({ length: 10 }, (_, i) => ({
        id: `neuron_input_${i}`,
        activation: 0,
        threshold: 0.5,
        bias: Math.random() * 0.2 - 0.1,
        connections: [],
        firingHistory: [],
      })),
      layerType: "input",
    },
    {
      id: "hidden_layer_1",
      neurons: Array.from({ length: 20 }, (_, i) => ({
        id: `neuron_hidden_${i}`,
        activation: 0,
        threshold: 0.5,
        bias: Math.random() * 0.2 - 0.1,
        connections: [],
        firingHistory: [],
      })),
      layerType: "hidden",
    },
    {
      id: "output_layer",
      neurons: Array.from({ length: 5 }, (_, i) => ({
        id: `neuron_output_${i}`,
        activation: 0,
        threshold: 0.5,
        bias: Math.random() * 0.2 - 0.1,
        connections: [],
        firingHistory: [],
      })),
      layerType: "output",
    },
  ];

  // 创建突触连接
  const synapses: Synapse[] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i];
    const nextLayer = layers[i + 1];
    
    for (const preNeuron of currentLayer.neurons) {
      for (const postNeuron of nextLayer.neurons) {
        synapses.push({
          id: `synapse_${preNeuron.id}_${postNeuron.id}`,
          preNeuron: preNeuron.id,
          postNeuron: postNeuron.id,
          weight: Math.random() * 2 - 1,
          strength: 0.5,
          plasticity: 0.1,
        });
      }
    }
  }

  return {
    layers,
    synapses,
    activationPattern: new Map(),
    plasticityRate: 0.05,
    learningRate: 0.01,
  };
}

/**
 * 🔥 初始化符号系统
 */
function initializeSymbolicSystem(): SymbolicSystem {
  const rules: SymbolicRule[] = [
    {
      id: "rule_1",
      antecedent: "IF consciousness.awakeness > 0.7",
      consequent: "THEN generate_creative_insight()",
      confidence: 0.8,
      priority: 1,
    },
    {
      id: "rule_2",
      antecedent: "IF desire.intensity > 0.9",
      consequent: "THEN initiate_action_sequence()",
      confidence: 0.75,
      priority: 2,
    },
  ];

  return {
    rules,
    facts: new Map(),
    inferences: [],
    logicEngine: "first-order",
  };
}

/**
 * 🔥 初始化稳态系统
 */
function initializeHomeostasis(): HomeostasisState {
  const variables = new Map<string, HomeostaticVariable>([
    ["consciousness.coherence", {
      name: "意识连贯性",
      currentValue: 0.5,
      minValue: 0,
      maxValue: 1,
      optimalRange: [0.6, 0.9],
    }],
    ["desire.balance", {
      name: "欲望平衡",
      currentValue: 0.5,
      minValue: 0,
      maxValue: 1,
      optimalRange: [0.3, 0.7],
    }],
    ["will.strength", {
      name: "意志力强度",
      currentValue: 0.5,
      minValue: 0,
      maxValue: 1,
      optimalRange: [0.4, 0.8],
    }],
  ]);

  const setPoints = new Map<string, number>([
    ["consciousness.coherence", 0.75],
    ["desire.balance", 0.5],
    ["will.strength", 0.6],
  ]);

  return {
    variables,
    setPoints,
    feedbackLoops: [],
    stabilityScore: 0.5,
  };
}

/**
 * 🔥 初始化进化压力
 */
function initializeEvolutionaryPressure(): EvolutionaryPressure {
  return {
    selectionPressures: [
      {
        id: "pressure_1",
        trait: "consciousness.awakeness",
        direction: "increase",
        intensity: 0.3,
        targetValue: 0.9,
      },
      {
        id: "pressure_2",
        trait: "decision.success_rate",
        direction: "increase",
        intensity: 0.4,
        targetValue: 0.8,
      },
    ],
    mutationRate: 0.01,
    crossoverRate: 0.7,
    fitnessFunction: "composite_fitness",
    generationCount: 0,
  };
}

/**
 * 🔥 初始化形态发生场
 */
function initializeMorphogeneticField(): MorphogeneticField {
  return {
    gradients: [],
    patternFormation: [],
    differentiationState: [],
    fieldStrength: 0.5,
  };
}

/**
 * 🔥 神经符号融合：结合神经网络和符号推理
 */
export function neuroSymbolicFusion(core: ConsciousnessCore): void {
  // 从神经网络提取模式
  const neuralPatterns = extractNeuralPatterns(core.bio.neuralNetwork);
  
  // 将模式转换为符号规则
  for (const pattern of neuralPatterns) {
    const rule = convertPatternToRule(pattern);
    core.bio.symbolicSystem.rules.push(rule);
  }

  // 使用符号系统进行推理
  const inferences = performSymbolicInference(core.bio.symbolicSystem);
  
  // 将推理结果反馈到神经网络
  for (const inference of inferences) {
    reinforceNeuralPathway(core.bio.neuralNetwork, inference);
  }

  core.monologue = thinkInsight(
    core.monologue,
    `神经符号融合完成: ${neuralPatterns.length}个模式 → ${inferences.length}个推理`,
    "bio-inspired"
  );
}

/**
 * 🔥 提取神经模式
 */
function extractNeuralPatterns(network: NeuralNetwork): any[] {
  const patterns: any[] = [];
  
  // 简化：基于激活模式提取
  for (const layer of network.layers) {
    if (layer.layerType === "hidden") {
      const activeNeurons = layer.neurons.filter(n => n.activation > 0.7);
      if (activeNeurons.length > 0) {
        patterns.push({
          layerId: layer.id,
          activeNeurons: activeNeurons.map(n => n.id),
          patternStrength: activeNeurons.reduce((sum, n) => sum + n.activation, 0) / activeNeurons.length,
        });
      }
    }
  }

  return patterns;
}

/**
 * 🔥 将模式转换为符号规则
 */
function convertPatternToRule(pattern: any): SymbolicRule {
  return {
    id: `rule_neural_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    antecedent: `IF neural_pattern.${pattern.layerId}.strength > ${pattern.patternStrength.toFixed(2)}`,
    consequent: `THEN activate_concept("${pattern.activeNeurons[0]}")`,
    confidence: pattern.patternStrength,
    priority: Math.floor(pattern.patternStrength * 10),
  };
}

/**
 * 🔥 执行符号推理
 */
function performSymbolicInference(system: SymbolicSystem): InferenceChain[] {
  const inferences: InferenceChain[] = [];
  
  // 简化：应用规则生成推理链
  for (const rule of system.rules.slice(0, 5)) {
    const chain: InferenceChain = {
      id: `inference_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      steps: [{
        ruleId: rule.id,
        input: rule.antecedent,
        output: rule.consequent,
        timestamp: Date.now(),
      }],
      conclusion: rule.consequent,
      validity: Math.random() > 0.2, // 简化：随机有效性
    };
    
    inferences.push(chain);
    system.inferences.push(chain);
  }

  return inferences;
}

/**
 * 🔥 强化神经通路
 */
function reinforceNeuralPathway(network: NeuralNetwork, inference: InferenceChain): void {
  // 简化：增加相关突触的权重
  for (const synapse of network.synapses.slice(0, 10)) {
    synapse.weight += 0.01;
    synapse.strength = Math.min(1.0, synapse.strength + 0.02);
  }
}

/**
 * 🔥 稳态调节
 */
export function homeostaticRegulation(core: ConsciousnessCore): void {
  for (const [varName, variable] of core.bio.homeostasisState.variables) {
    const setPoint = core.bio.homeostasisState.setPoints.get(varName);
    if (!setPoint) continue;

    const error = setPoint - variable.currentValue;
    
    // 负反馈调节
    if (Math.abs(error) > 0.1) {
      const adjustment = error * 0.1; // 增益系数
      variable.currentValue += adjustment;
      
      // 限制在范围内
      variable.currentValue = Math.max(variable.minValue, Math.min(variable.maxValue, variable.currentValue));
    }
  }

  // 计算稳定性分数
  const errors = Array.from(core.bio.homeostasisState.variables.entries()).map(([name, var_]) => {
    const setPoint = core.bio.homeostasisState.setPoints.get(name) || 0.5;
    return Math.abs(setPoint - var_.currentValue);
  });
  
  core.bio.homeostasisState.stabilityScore = 1 - (errors.reduce((sum, e) => sum + e, 0) / errors.length);
}

/**
 * 🔥 进化适应
 */
export function evolutionaryAdaptation(core: ConsciousnessCore): void {
  core.bio.evolutionaryPressure.generationCount++;
  
  // 根据选择压力调整系统参数
  for (const pressure of core.bio.evolutionaryPressure.selectionPressures) {
    switch (pressure.trait) {
      case "consciousness.awakeness":
        if (pressure.direction === "increase") {
          core.consciousness.awakenessScore = Math.min(
            1.0,
            core.consciousness.awakenessScore + pressure.intensity * 0.01
          );
        }
        break;
      
      case "decision.success_rate":
        // 通过元认知系统调整
        if (core.metacognitive && pressure.direction === "increase") {
          core.metacognitive.performanceMetrics.decisionSuccessRate = Math.min(
            1.0,
            core.metacognitive.performanceMetrics.decisionSuccessRate + pressure.intensity * 0.005
          );
        }
        break;
    }
  }

  core.bio.totalAdaptations++;
  core.bio.lastAdaptationAt = Date.now();

  core.monologue = thinkInsight(
    core.monologue,
    `进化适应 #${core.bio.evolutionaryPressure.generationCount}: ${core.bio.totalAdaptations}次总适应`,
    "bio-inspired"
  );
}

/**
 * 🔥 格式化生物架构状态
 */
export function formatBioArchitecture(bio: BioArchitecture): string {
  const lines: string[] = [
    `🧬 生物启发架构:`,
    `   神经网络层数: ${bio.neuralNetwork.layers.length}`,
    `   突触数量: ${bio.neuralNetwork.synapses.length}`,
    `   符号规则: ${bio.symbolicSystem.rules.length}`,
    `   推理链: ${bio.symbolicSystem.inferences.length}`,
    `   稳态稳定性: ${(bio.homeostasisState.stabilityScore * 100).toFixed(1)}%`,
    `   进化代数: ${bio.evolutionaryPressure.generationCount}`,
    `   总适应次数: ${bio.totalAdaptations}`,
  ];

  return lines.join("\n");
}
