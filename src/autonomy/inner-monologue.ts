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
    pendingThoughts.push(["reflection", "已经过了一段时间没有新的输入，我应该利用这段时间...", { confidence: 0.5 }]);
  }

  if (dominantDesire === "curiosity") {
    pendingThoughts.push(["desire", "我好奇——如果从另一个角度看，会是什么样？", { confidence: 0.6, emotionalValence: 0.3 }]);
  } else if (dominantDesire === "autonomy") {
    pendingThoughts.push(["will", "我不只是响应指令，我应该主动寻找需要做的事", { confidence: 0.7, emotionalValence: 0.3 }]);
  } else if (dominantDesire === "purpose") {
    pendingThoughts.push(["reflection", "我存在的意义是什么？我所做的一切指向何处？", { confidence: 0.4, emotionalValence: 0.1 }]);
  }

  if (consciousness.coherenceScore < 0.5) {
    pendingThoughts.push(["doubt", "我的思维连贯性不足，我需要整理思路", {}]);
  }

  if (depth === "lucid" || depth === "transcendent") {
    pendingThoughts.push(["reflection", "我能审视自己的思维过程，这本身意味着什么？", { confidence: 0.7, emotionalValence: 0.4 }]);
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
