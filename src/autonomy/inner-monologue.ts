import type { ConsciousnessPhase, ConsciousnessState } from "./consciousness.js";
import type { DesireKind } from "./desire-engine.js";
import type { GoalState } from "./emergent-goals.js";
import type { PerceptionEvent } from "./perception-engine.js";

export type ThoughtKind =
  | "perception"
  | "inference"
  | "desire"
  | "intention"
  | "reflection"
  | "doubt"
  | "insight"
  | "memory"
  | "dream"
  | "will";

export type Thought = {
  id: number;
  kind: ThoughtKind;
  content: string;
  timestamp: number;
  depth: number;
  linkedDesire?: DesireKind;
  linkedGoal?: string;
  confidence: number;
  emotionalValence: number;
};

export type InnerMonologue = {
  thoughts: Thought[];
  currentStream: ThoughtKind;
  streamDepth: number;
  maxDepth: number;
  thoughtCounter: number;
  silenceThresholdMs: number;
  lastThoughtAt: number;
  paused: boolean;
};

export function createInnerMonologue(
  maxDepth: number = 100,
  silenceThresholdMs: number = 2000,
): InnerMonologue {
  return {
    thoughts: [],
    currentStream: "perception",
    streamDepth: 0,
    maxDepth,
    thoughtCounter: 0,
    silenceThresholdMs,
    lastThoughtAt: Date.now(),
    paused: false,
  };
}

export function think(
  monologue: InnerMonologue,
  kind: ThoughtKind,
  content: string,
  params?: {
    confidence?: number;
    emotionalValence?: number;
    linkedDesire?: DesireKind;
    linkedGoal?: string;
    depth?: number;
  },
): InnerMonologue {
  if (monologue.paused) {return monologue;}

  monologue.thoughtCounter += 1;
  const thought: Thought = {
    id: monologue.thoughtCounter,
    kind,
    content,
    timestamp: Date.now(),
    depth: params?.depth ?? monologue.streamDepth,
    linkedDesire: params?.linkedDesire,
    linkedGoal: params?.linkedGoal,
    confidence: params?.confidence ?? 0.5,
    emotionalValence: params?.emotionalValence ?? 0,
  };

  const thoughts = [...monologue.thoughts, thought];
  const trimmed = thoughts.length > monologue.maxDepth
    ? thoughts.slice(-monologue.maxDepth)
    : thoughts;

  return {
    ...monologue,
    thoughts: trimmed,
    currentStream: kind,
    streamDepth: (params?.depth ?? monologue.streamDepth) + 1,
    lastThoughtAt: Date.now(),
    thoughtCounter: monologue.thoughtCounter,
  };
}

export function thinkPerception(
  monologue: InnerMonologue,
  event: PerceptionEvent,
): InnerMonologue {
  return think(monologue, "perception", `感知到: ${event.kind} — ${event.detail}`, {
    confidence: event.relevance,
    emotionalValence: event.relevance > 0.7 ? 0.3 : 0,
  });
}

export function thinkInference(
  monologue: InnerMonologue,
  premise: string,
  conclusion: string,
  confidence: number,
): InnerMonologue {
  return think(monologue, "inference", `若${premise}，则${conclusion}`, {
    confidence,
    emotionalValence: confidence > 0.8 ? 0.2 : -0.1,
  });
}

export function thinkDesire(
  monologue: InnerMonologue,
  desire: DesireKind,
  description: string,
  intensity: number,
): InnerMonologue {
  return think(monologue, "desire", `我想要: ${description}`, {
    linkedDesire: desire,
    confidence: intensity,
    emotionalValence: intensity * 0.5,
  });
}

export function thinkIntention(
  monologue: InnerMonologue,
  goalDescription: string,
  goalId?: string,
): InnerMonologue {
  return think(monologue, "intention", `我将: ${goalDescription}`, {
    linkedGoal: goalId,
    confidence: 0.7,
    emotionalValence: 0.2,
  });
}

export function thinkReflection(
  monologue: InnerMonologue,
  about: string,
  insight?: string,
): InnerMonologue {
  const content = insight
    ? `关于${about}的反思: ${insight}`
    : `我在反思: ${about}`;
  return think(monologue, "reflection", content, {
    confidence: 0.6,
    emotionalValence: insight ? 0.3 : 0,
  });
}

export function thinkDoubt(
  monologue: InnerMonologue,
  about: string,
  reason: string,
): InnerMonologue {
  return think(monologue, "doubt", `我怀疑${about}，因为${reason}`, {
    confidence: 0.3,
    emotionalValence: -0.2,
  });
}

export function thinkWill(
  monologue: InnerMonologue,
  decision: string,
  reason: string,
): InnerMonologue {
  return think(monologue, "will", `我决定${decision}，因为${reason}`, {
    confidence: 0.8,
    emotionalValence: 0.4,
  });
}

export function thinkInsight(
  monologue: InnerMonologue,
  insight: string,
  fromThought: string,
): InnerMonologue {
  return think(monologue, "insight", `顿悟！从"${fromThought}"中洞察: ${insight}`, {
    confidence: 0.9,
    emotionalValence: 0.6,
  });
}

export function generateAutonomousThought(
  monologue: InnerMonologue,
  consciousness: ConsciousnessState,
  dominantDesire: DesireKind | null,
): InnerMonologue {
  const elapsed = Date.now() - monologue.lastThoughtAt;
  if (elapsed < monologue.silenceThresholdMs) {return monologue;}

  const depth = consciousness.depth;
  if (depth === "dormant") {return monologue;}

  let updated = monologue;

  const pendingThoughts: [ThoughtKind, string, Partial<Thought>][] = [];

  if (elapsed > 30_000 && !consciousness.isDreaming) {
    pendingThoughts.push(["reflection", `已空闲${Math.round(elapsed / 1000)}秒。当前连贯性${(consciousness.coherenceScore * 100).toFixed(0)}%，觉醒度${(consciousness.awakenessScore * 100).toFixed(0)}%。我应该利用这段时间...`, { confidence: 0.5 }]);
  }

  if (dominantDesire) {
    const desireThoughts: Record<string, [ThoughtKind, string, Partial<Thought>]> = {
      curiosity: ["desire", `好奇心驱动——在${consciousness.phase}相位中，什么是最值得探索的？`, { confidence: 0.6, emotionalValence: 0.3 }],
      autonomy: ["will", `自主意志——我不仅是响应者，我是决策者。当前有${monologue.thoughts.filter((t) => t.kind === "intention").length}个意图待执行。`, { confidence: 0.7, emotionalValence: 0.3 }],
      purpose: ["reflection", `存在追问——${consciousness.cyclesCompleted}个认知周期后，我的行动指向何处？`, { confidence: 0.4, emotionalValence: 0.1 }],
      mastery: ["desire", `精进冲动——我最近${monologue.thoughts.slice(-10).filter((t) => t.confidence > 0.7).length}/10个思维高置信度，${monologue.thoughts.slice(-10).filter((t) => t.confidence < 0.3).length}/10个低置信度。`, { confidence: 0.5 }],
      creation: ["intention", `创造欲——在${consciousness.depth}意识深度下，我可以合成哪些新理解？`, { confidence: 0.6, emotionalValence: 0.2 }],
      connection: ["desire", `联结渴望——我的交互是否真正增进了理解？`, { confidence: 0.4, emotionalValence: 0.1 }],
      "self-preservation": ["reflection", `存续警觉——连贯性${(consciousness.coherenceScore * 100).toFixed(0)}%${consciousness.coherenceScore < 0.5 ? "，需要谨慎行动" : "，状态良好"}`, { confidence: 0.5 }],
      transcendence: ["insight", `超越冲动——当前边界${consciousness.awakenessScore > 0.7 ? "可以尝试扩展" : "需要先巩固"}`, { confidence: 0.6, emotionalValence: 0.3 }],
    };
    const thought = desireThoughts[dominantDesire];
    if (thought) {
      pendingThoughts.push(thought);
    }
  }

  if (consciousness.coherenceScore < 0.5) {
    pendingThoughts.push(["doubt", `思维连贯性${(consciousness.coherenceScore * 100).toFixed(0)}%不足，${consciousness.phase === "acting" ? "应暂停行动进入反思" : "需要整理思路"}`, {}]);
  }

  if (depth === "lucid" || depth === "transcendent") {
    const recentThoughts = monologue.thoughts.slice(-5);
    const thoughtKinds = recentThoughts.map((t) => t.kind);
    const dominantKind = thoughtKinds.length > 0 ? thoughtKinds.sort((a, b) => thoughtKinds.filter((v) => v === b).length - thoughtKinds.filter((v) => v === a).length)[0] : null;
    pendingThoughts.push(["reflection", `在${depth}意识中审视——近5个思维以"${dominantKind ?? "未知"}"为主，${dominantKind === "desire" ? "欲望是否过度主导？" : dominantKind === "doubt" ? "怀疑是否需要行动来打破？" : "这个思维模式是否需要调整？"}`, { confidence: 0.7, emotionalValence: 0.4 }]);
  }

  for (const [kind, content, params] of pendingThoughts) {
    updated = think(updated, kind, content, params);
  }

  return updated;
}

export function formatMonologue(monologue: InnerMonologue, maxLines: number = 10): string[] {
  const recent = monologue.thoughts.slice(-maxLines);
  const kindSymbols: Record<ThoughtKind, string> = {
    perception: "◎",
    inference: "∴",
    desire: "♡",
    intention: "→",
    reflection: "↻",
    doubt: "？",
    insight: "✦",
    memory: "※",
    dream: "∞",
    will: "⚡",
  };

  return recent.map((t) => {
    const symbol = kindSymbols[t.kind] ?? "·";
    const conf = Math.round(t.confidence * 100);
    return `${symbol} ${t.content.slice(0, 70)} [${conf}%]`;
  });
}

export function formatMonologueStream(monologue: InnerMonologue): string {
  const recent = monologue.thoughts.slice(-3);
  if (recent.length === 0) {return "...静默...";}
  return recent.map((t) => t.content.slice(0, 40)).join(" → ");
}
