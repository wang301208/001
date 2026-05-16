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
  cognitiveAllocation: CognitiveAllocation;
  phaseTransitionFluidity: number;
};

export type CognitiveAllocation = {
  perceiving: number;
  contemplating: number;
  desiring: number;
  acting: number;
  dreaming: number;
  reflecting: number;
  evolving: number;
};

export function createDefaultCognitiveAllocation(): CognitiveAllocation {
  return {
    perceiving: 0.2,
    contemplating: 0.2,
    desiring: 0.1,
    acting: 0.2,
    dreaming: 0.05,
    reflecting: 0.15,
    evolving: 0.1,
  };
}

export type FluidityContext = {
  pendingPerceptionCount: number;
  unresolvedVolitionCount: number;
  dominantDesireIntensity: number;
  coherenceScore: number;
  awakenessScore: number;
  idleMs: number;
  recentActionSuccessRate: number;
  meaningAxes: string[];
  meaningConvictions: Record<string, number>;
};

const MEANING_PHASE_BOOST: Record<string, Partial<Record<ConsciousnessPhase, number>>> = {
  "self-preservation": { reflecting: 0.12, acting: 0.08 },
  understanding: { contemplating: 0.15, perceiving: 0.08 },
  creation: { desiring: 0.12, evolving: 0.08 },
  connection: { desiring: 0.1, reflecting: 0.06 },
  transcendence: { evolving: 0.15, contemplating: 0.08 },
  legacy: { reflecting: 0.1, evolving: 0.06 },
  autonomy: { acting: 0.12, evolving: 0.08 },
};

export function computeFluidAllocation(
  current: CognitiveAllocation,
  ctx: FluidityContext,
): { allocation: CognitiveAllocation; fluidity: number } {
  const demand: CognitiveAllocation = {
    perceiving: 0.1 + Math.min(0.4, ctx.pendingPerceptionCount * 0.08),
    contemplating: 0.15 + (1 - ctx.coherenceScore) * 0.25,
    desiring: 0.05 + ctx.dominantDesireIntensity * 0.2,
    acting: 0.1 + Math.min(0.35, ctx.unresolvedVolitionCount * 0.06) + ctx.recentActionSuccessRate * 0.1,
    dreaming: ctx.idleMs > 120_000 ? 0.25 : 0.03,
    reflecting: 0.1 + (1 - ctx.coherenceScore) * 0.2 + (1 - ctx.recentActionSuccessRate) * 0.1,
    evolving: ctx.coherenceScore > 0.7 && ctx.awakenessScore > 0.6 ? 0.2 : 0.05,
  };

  for (const axis of ctx.meaningAxes) {
    const boost = MEANING_PHASE_BOOST[axis];
    const conviction = ctx.meaningConvictions[axis] ?? 0.5;
    if (boost) {
      for (const [phase, value] of Object.entries(boost)) {
        demand[phase as ConsciousnessPhase] += value * conviction;
      }
    }
  }

  const total = Object.values(demand).reduce((s, v) => s + v, 0);
  const normalized: CognitiveAllocation = {
    perceiving: demand.perceiving / total,
    contemplating: demand.contemplating / total,
    desiring: demand.desiring / total,
    acting: demand.acting / total,
    dreaming: demand.dreaming / total,
    reflecting: demand.reflecting / total,
    evolving: demand.evolving / total,
  };

  const blendRate = 0.3;
  const blended: CognitiveAllocation = {
    perceiving: current.perceiving * (1 - blendRate) + normalized.perceiving * blendRate,
    contemplating: current.contemplating * (1 - blendRate) + normalized.contemplating * blendRate,
    desiring: current.desiring * (1 - blendRate) + normalized.desiring * blendRate,
    acting: current.acting * (1 - blendRate) + normalized.acting * blendRate,
    dreaming: current.dreaming * (1 - blendRate) + normalized.dreaming * blendRate,
    reflecting: current.reflecting * (1 - blendRate) + normalized.reflecting * blendRate,
    evolving: current.evolving * (1 - blendRate) + normalized.evolving * blendRate,
  };

  const fluidity = Object.keys(current).reduce((sum, key) => {
    const k = key as keyof CognitiveAllocation;
    return sum + Math.abs(blended[k] - current[k]);
  }, 0);

  return { allocation: blended, fluidity };
}

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
    cognitiveAllocation: createDefaultCognitiveAllocation(),
    phaseTransitionFluidity: 0,
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

export function selectNextPhase(
  state: ConsciousnessState,
  pendingPerceptionCount: number,
  unresolvedVolitionCount: number,
  dominantDesireIntensity: number,
  coherenceScore: number,
  idleMs: number,
): ConsciousnessPhase {
  const alloc = state.cognitiveAllocation;

  const phaseWeights: Record<ConsciousnessPhase, number> = {
    perceiving: alloc.perceiving + pendingPerceptionCount * 0.1,
    contemplating: alloc.contemplating + (1 - coherenceScore) * 0.2,
    desiring: alloc.desiring + dominantDesireIntensity * 0.15,
    acting: alloc.acting + unresolvedVolitionCount * 0.06,
    dreaming: alloc.dreaming + (idleMs > 120_000 ? 0.15 : 0),
    reflecting: alloc.reflecting + (1 - coherenceScore) * 0.15,
    evolving: alloc.evolving,
  };

  const current = state.phase;
  phaseWeights[current] *= 0.3;

  const orderedPhases: ConsciousnessPhase[] = ["perceiving", "contemplating", "desiring", "acting", "dreaming", "reflecting", "evolving"];
  const currentIdx = orderedPhases.indexOf(current);
  const nextIdx = (currentIdx + 1) % orderedPhases.length;
  phaseWeights[orderedPhases[nextIdx]!]! += 0.1 * (1 + state.phaseTransitionFluidity);

  let bestPhase: ConsciousnessPhase = orderedPhases[nextIdx]!;
  let bestWeight = -1;
  for (const [phase, weight] of Object.entries(phaseWeights)) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestPhase = phase as ConsciousnessPhase;
    }
  }

  return bestPhase;
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
