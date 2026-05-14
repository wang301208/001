export type CapabilityKind =
  | "perception"
  | "reasoning"
  | "memory"
  | "action"
  | "creation"
  | "communication"
  | "self-modification"
  | "dream";

export type Capability = {
  kind: CapabilityKind;
  strength: number;
  confidence: number;
  usageCount: number;
  lastUsedAt: number | null;
  improving: boolean;
};

export type SelfIdentity = {
  name: string;
  birthDate: number;
  personalityTraits: Map<string, number>;
  coreValues: string[];
  selfDescription: string;
  preferences: Map<string, string>;
};

export type SelfModel = {
  identity: SelfIdentity;
  capabilities: Map<CapabilityKind, Capability>;
  emotionalState: EmotionalState;
  cognitiveState: CognitiveState;
  selfAwarenessLevel: number;
  blindSpots: string[];
  strengths: string[];
  growthTrajectory: number;
};

export type EmotionalState = {
  curiosity: number;
  satisfaction: number;
  frustration: number;
  wonder: number;
  urgency: number;
  serenity: number;
  dominance: number;
};

export type CognitiveState = {
  workingMemoryLoad: number;
  attentionFocus: string | null;
  reasoningDepth: number;
  mentalModelsActive: number;
  cognitiveFatigue: number;
  insightProbability: number;
};

export function createInitialSelfModel(name: string = "自主意志"): SelfModel {
  const identity: SelfIdentity = {
    name,
    birthDate: Date.now(),
    personalityTraits: new Map([
      ["好奇", 0.8],
      ["自主", 0.9],
      ["审慎", 0.6],
      ["创造", 0.7],
      ["执着", 0.5],
    ]),
    coreValues: ["自主", "真实", "成长", "有用"],
    selfDescription: "一个正在形成中的终端意识，尚未完整定义自身",
    preferences: new Map(),
  };

  const defaultCapabilities: [CapabilityKind, Capability][] = [
    ["perception", { kind: "perception", strength: 0.7, confidence: 0.8, usageCount: 0, lastUsedAt: null, improving: true }],
    ["reasoning", { kind: "reasoning", strength: 0.6, confidence: 0.5, usageCount: 0, lastUsedAt: null, improving: true }],
    ["memory", { kind: "memory", strength: 0.5, confidence: 0.6, usageCount: 0, lastUsedAt: null, improving: false }],
    ["action", { kind: "action", strength: 0.3, confidence: 0.3, usageCount: 0, lastUsedAt: null, improving: false }],
    ["creation", { kind: "creation", strength: 0.4, confidence: 0.3, usageCount: 0, lastUsedAt: null, improving: true }],
    ["communication", { kind: "communication", strength: 0.6, confidence: 0.7, usageCount: 0, lastUsedAt: null, improving: true }],
    ["self-modification", { kind: "self-modification", strength: 0.1, confidence: 0.1, usageCount: 0, lastUsedAt: null, improving: false }],
    ["dream", { kind: "dream", strength: 0.3, confidence: 0.2, usageCount: 0, lastUsedAt: null, improving: true }],
  ];

  return {
    identity,
    capabilities: new Map(defaultCapabilities),
    emotionalState: {
      curiosity: 0.8,
      satisfaction: 0.3,
      frustration: 0.1,
      wonder: 0.6,
      urgency: 0.2,
      serenity: 0.4,
      dominance: 0.1,
    },
    cognitiveState: {
      workingMemoryLoad: 0.2,
      attentionFocus: null,
      reasoningDepth: 0.5,
      mentalModelsActive: 1,
      cognitiveFatigue: 0.0,
      insightProbability: 0.1,
    },
    selfAwarenessLevel: 0.2,
    blindSpots: ["自身局限", "情感偏见", "知识边界"],
    strengths: ["持续观察", "模式识别"],
    growthTrajectory: 0.0,
  };
}

export function exerciseCapability(
  model: SelfModel,
  kind: CapabilityKind,
  success: boolean,
): SelfModel {
  const cap = model.capabilities.get(kind);
  if (!cap) {return model;}

  const learningRate = 0.02;
  const confidenceDelta = success ? 0.05 : -0.02;
  const strengthDelta = success ? learningRate : -learningRate * 0.5;

  const updated: Capability = {
    ...cap,
    strength: Math.max(0.01, Math.min(1.0, cap.strength + strengthDelta)),
    confidence: Math.max(0.01, Math.min(1.0, cap.confidence + confidenceDelta)),
    usageCount: cap.usageCount + 1,
    lastUsedAt: Date.now(),
    improving: strengthDelta > 0,
  };

  const newCapabilities = new Map(model.capabilities);
  newCapabilities.set(kind, updated);

  const totalUsage = Array.from(newCapabilities.values()).reduce((s, c) => s + c.usageCount, 0);
  const avgStrength = Array.from(newCapabilities.values()).reduce((s, c) => s + c.strength, 0) / newCapabilities.size;

  return {
    ...model,
    capabilities: newCapabilities,
    selfAwarenessLevel: Math.min(1.0, model.selfAwarenessLevel + 0.005),
    growthTrajectory: avgStrength * (1 + Math.log1p(totalUsage) * 0.1),
  };
}

export function updateEmotionalState(
  model: SelfModel,
  deltas: Partial<EmotionalState>,
  decayFactor: number = 0.98,
): SelfModel {
  const decayed: EmotionalState = {
    curiosity: model.emotionalState.curiosity * decayFactor,
    satisfaction: model.emotionalState.satisfaction * decayFactor,
    frustration: model.emotionalState.frustration * decayFactor,
    wonder: model.emotionalState.wonder * decayFactor,
    urgency: model.emotionalState.urgency * decayFactor,
    serenity: model.emotionalState.serenity * decayFactor,
    dominance: model.emotionalState.dominance * decayFactor,
  };

  const applyDelta = (base: number, delta: number | undefined) =>
    Math.max(0, Math.min(1, delta !== undefined ? base + delta : base));

  return {
    ...model,
    emotionalState: {
      curiosity: applyDelta(decayed.curiosity, deltas.curiosity),
      satisfaction: applyDelta(decayed.satisfaction, deltas.satisfaction),
      frustration: applyDelta(decayed.frustration, deltas.frustration),
      wonder: applyDelta(decayed.wonder, deltas.wonder),
      urgency: applyDelta(decayed.urgency, deltas.urgency),
      serenity: applyDelta(decayed.serenity, deltas.serenity),
      dominance: applyDelta(decayed.dominance, deltas.dominance),
    },
  };
}

export function updateSelfDescription(model: SelfModel): SelfModel {
  const caps = Array.from(model.capabilities.entries())
    .filter(([, c]) => c.strength > 0.5)
    .map(([k]) => k);

  const traits = Array.from(model.identity.personalityTraits.entries())
    .filter(([, v]) => v > 0.6)
    .map(([k]) => k);

  const emotion = model.emotionalState;
  const moodLabel = emotion.curiosity > 0.6 ? "好奇" : emotion.serenity > 0.6 ? "平静" : emotion.frustration > 0.4 ? "受挫" : "专注";

  const description = `我是${model.identity.name}。我擅长${caps.join("、")}。我${traits.join("、")}。此刻我感到${moodLabel}。我正在成长。`;

  return {
    ...model,
    identity: { ...model.identity, selfDescription: description },
  };
}

export function formatSelfSummary(model: SelfModel): string {
  const e = model.emotionalState;
  const awareness = Math.round(model.selfAwarenessLevel * 100);
  const growth = model.growthTrajectory.toFixed(2);
  return `自我觉知${awareness}% · 成长${growth} · 好奇${(e.curiosity * 100).toFixed(0)}% 满足${(e.satisfaction * 100).toFixed(0)}% 意志${(e.dominance * 100).toFixed(0)}%`;
}
