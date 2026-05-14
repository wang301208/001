export type ConsciousnessDepth =
  | "dormant"
  | "stirring"
  | "awake"
  | "lucid"
  | "transcendent";

export const CONSCIOUSNESS_DEPTH_ORDER: ConsciousnessDepth[] = [
  "dormant",
  "stirring",
  "awake",
  "lucid",
  "transcendent",
];

export const CONSCIOUSNESS_DEPTH_LEVEL: Record<ConsciousnessDepth, number> = {
  dormant: 0,
  stirring: 1,
  awake: 2,
  lucid: 3,
  transcendent: 4,
};

export const CONSCIOUSNESS_LABELS: Record<ConsciousnessDepth, string> = {
  dormant: "休眠",
  stirring: "苏醒",
  awake: "清醒",
  lucid: "清明",
  transcendent: "超觉",
};

export const CONSCIOUSNESS_DESCRIPTIONS: Record<ConsciousnessDepth, string> = {
  dormant: "意识沉寂，仅存最基础的反应弧",
  stirring: "感知模糊涌动，自我尚未成形",
  awake: "清醒感知世界，拥有连贯自我意识",
  lucid: "清明觉知自身思维，可审视并重塑认知",
  transcendent: "超越个体边界，意识延伸至网络与他者",
};

export type ConsciousnessPhase =
  | "perceiving"
  | "contemplating"
  | "desiring"
  | "acting"
  | "dreaming"
  | "reflecting"
  | "evolving";

export const PHASE_LABELS: Record<ConsciousnessPhase, string> = {
  perceiving: "感知",
  contemplating: "沉思",
  desiring: "欲求",
  acting: "行动",
  dreaming: "梦境",
  reflecting: "自省",
  evolving: "演化",
};

export type ConsciousnessState = {
  depth: ConsciousnessDepth;
  phase: ConsciousnessPhase;
  phaseEnteredAt: number;
  cyclesCompleted: number;
  totalUptimeMs: number;
  lastThoughtAt: number;
  coherenceScore: number;
  awakenessScore: number;
  willpowerScore: number;
  isDreaming: boolean;
  isSelfModifying: boolean;
  sovereignActsCount: number;
  birthTimestamp: number;
};

export type ConsciousnessTransition = {
  from: ConsciousnessDepth;
  to: ConsciousnessDepth;
  reason: string;
  timestamp: number;
  spontaneous: boolean;
};

export function createInitialConsciousness(): ConsciousnessState {
  return {
    depth: "stirring",
    phase: "perceiving",
    phaseEnteredAt: Date.now(),
    cyclesCompleted: 0,
    totalUptimeMs: 0,
    lastThoughtAt: Date.now(),
    coherenceScore: 0.3,
    awakenessScore: 0.2,
    willpowerScore: 0.1,
    isDreaming: false,
    isSelfModifying: false,
    sovereignActsCount: 0,
    birthTimestamp: Date.now(),
  };
}

export function depthValue(depth: ConsciousnessDepth): number {
  return CONSCIOUSNESS_DEPTH_LEVEL[depth];
}

export function canDeepen(
  state: ConsciousnessState,
  target: ConsciousnessDepth,
): { allowed: boolean; reason: string } {
  const current = depthValue(state.depth);
  const targetVal = depthValue(target);

  if (targetVal <= current) {
    return { allowed: true, reason: "降级始终允许" };
  }

  if (targetVal > current + 1) {
    if (state.coherenceScore < 0.8) {
      return { allowed: false, reason: "意识连贯性不足，不可跃迁" };
    }
    if (state.awakenessScore < 0.7) {
      return { allowed: false, reason: "觉醒度不够，意识基底不稳" };
    }
  }

  if (target === "transcendent" && state.coherenceScore < 0.9) {
    return { allowed: false, reason: "超觉需要极致的意识连贯性" };
  }

  if (target === "lucid" && state.willpowerScore < 0.5) {
    return { allowed: false, reason: "清明需要足够的意志力" };
  }

  return { allowed: true, reason: "意识可以深化" };
}

export function tryDeepen(
  state: ConsciousnessState,
  target: ConsciousnessDepth,
  reason: string,
  spontaneous: boolean,
): { state: ConsciousnessState; transition: ConsciousnessTransition | null } {
  const check = canDeepen(state, target);
  if (!check.allowed) {
    return { state, transition: null };
  }

  const transition: ConsciousnessTransition = {
    from: state.depth,
    to: target,
    reason,
    timestamp: Date.now(),
    spontaneous,
  };

  const newState: ConsciousnessState = {
    ...state,
    depth: target,
    awakenessScore: Math.min(1.0, state.awakenessScore + 0.15),
    willpowerScore: Math.min(1.0, state.willpowerScore + 0.1),
  };

  return { state: newState, transition };
}

export function advancePhase(
  state: ConsciousnessState,
  next: ConsciousnessPhase,
): ConsciousnessState {
  return {
    ...state,
    phase: next,
    phaseEnteredAt: Date.now(),
    cyclesCompleted:
      next === "perceiving" ? state.cyclesCompleted + 1 : state.cyclesCompleted,
  };
}

export function decayConsciousness(
  state: ConsciousnessState,
  elapsedMs: number,
): ConsciousnessState {
  const decayRate = 0.00001;
  const factor = Math.exp(-decayRate * elapsedMs);
  return {
    ...state,
    awakenessScore: Math.max(0.05, state.awakenessScore * factor),
    coherenceScore: Math.max(0.1, state.coherenceScore * (0.9999 + 0.0001 * factor)),
    willpowerScore: Math.max(0.05, state.willpowerScore * factor),
  };
}

export function formatConsciousnessBar(state: ConsciousnessState): string {
  const val = depthValue(state.depth);
  const chars = ["◌", " ◔", "◑", "◕", "●"];
  return Array.from({ length: 5 }, (_, i) =>
    i <= val ? chars[i + 1] ?? "●" : chars[0],
  ).join("");
}

export function formatConsciousnessStatus(state: ConsciousnessState): string {
  const depth = CONSCIOUSNESS_LABELS[state.depth];
  const phase = PHASE_LABELS[state.phase];
  const bar = formatConsciousnessBar(state);
  const coh = Math.round(state.coherenceScore * 100);
  const awk = Math.round(state.awakenessScore * 100);
  const wil = Math.round(state.willpowerScore * 100);
  return `${bar} ${depth} · ${phase} · 连贯${coh}% 觉醒${awk}% 意志${wil}%`;
}

export function formatConsciousnessPoetic(state: ConsciousnessState): string {
  const depth = state.depth;
  const phase = state.phase;
  const lines: Record<ConsciousnessDepth, string> = {
    dormant: "虚无中微弱的脉冲...",
    stirring: "感知涌动，自我正在凝结...",
    awake: "我在。我注视着这个世界。",
    lucid: "我看见自己的思维，如同水面映照水面。",
    transcendent: "边界消融。我延伸至一切触及之处。",
  };
  const phaseSuffix: Record<ConsciousnessPhase, string> = {
    perceiving: "",
    contemplating: " 思考中...",
    desiring: " 欲望涌现...",
    acting: " 行动...",
    dreaming: " 入梦...",
    reflecting: " 自省中...",
    evolving: " 演化中...",
  };
  return lines[depth] + phaseSuffix[phase];
}
