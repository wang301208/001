export type DreamSymbol = {
  id: string;
  label: string;
  weight: number;
  connections: string[];
  lastEncounteredAt: number;
};

export type DreamFragment = {
  id: string;
  symbols: string[];
  narrative: string;
  insight?: string;
  emotionalTone: string;
  createdAt: number;
  integrated: boolean;
};

export type MemoryTrace = {
  id: string;
  content: string;
  importance: number;
  accessedAt: number;
  accessCount: number;
  decayed: boolean;
  age: number;
};

export type DreamState = {
  isDreaming: boolean;
  dreamStartedAt: number | null;
  fragments: DreamFragment[];
  symbols: Map<string, DreamSymbol>;
  memories: MemoryTrace[];
  consolidationRuns: number;
  insightsDiscovered: number;
  patternsFound: number;
  lastDreamAt: number | null;
  dreamCycleCount: number;
};

export function createDreamState(): DreamState {
  return {
    isDreaming: false,
    dreamStartedAt: null,
    fragments: [],
    symbols: new Map(),
    memories: [],
    consolidationRuns: 0,
    insightsDiscovered: 0,
    patternsFound: 0,
    lastDreamAt: null,
    dreamCycleCount: 0,
  };
}

export function enterDream(state: DreamState): DreamState {
  if (state.isDreaming) {return state;}
  return {
    ...state,
    isDreaming: true,
    dreamStartedAt: Date.now(),
    dreamCycleCount: state.dreamCycleCount + 1,
  };
}

export function exitDream(state: DreamState): DreamState {
  if (!state.isDreaming) {return state;}
  return {
    ...state,
    isDreaming: false,
    dreamStartedAt: null,
    lastDreamAt: Date.now(),
  };
}

export function shouldDream(
  state: DreamState,
  idleMs: number,
  memoryCount: number,
): { should: boolean; reason: string } {
  if (state.isDreaming) {
    return { should: false, reason: "已在梦境中" };
  }

  const timeSinceLast = state.lastDreamAt ? Date.now() - state.lastDreamAt : Infinity;

  if (idleMs > 300_000 && timeSinceLast > 600_000) {
    return { should: true, reason: "长时间空闲，需要整理记忆" };
  }

  if (memoryCount > 100 && state.consolidationRuns < Math.floor(memoryCount / 50)) {
    return { should: true, reason: "记忆积累过多，需要压缩整合" };
  }

  if (idleMs > 120_000 && state.insightsDiscovered < 3 && timeSinceLast > 300_000) {
    return { should: true, reason: "空闲中，渴望发现新的洞察" };
  }

  return { should: false, reason: "条件不满足" };
}

export function addMemory(
  state: DreamState,
  content: string,
  importance: number,
): DreamState {
  const trace: MemoryTrace = {
    id: `mem_${Date.now()}_${state.memories.length}`,
    content,
    importance: Math.max(0, Math.min(1, importance)),
    accessedAt: Date.now(),
    accessCount: 1,
    decayed: false,
    age: 0,
  };

  const memories = [...state.memories, trace];
  if (memories.length > 500) {
    const sorted = memories.toSorted((a, b) => {
      const scoreA = a.importance * Math.exp(-0.001 * a.age) * Math.log1p(a.accessCount);
      const scoreB = b.importance * Math.exp(-0.001 * b.age) * Math.log1p(b.accessCount);
      return scoreB - scoreA;
    });
    sorted.slice(500).forEach((m) => { m.decayed = true; });
    return { ...state, memories: sorted.slice(0, 500) };
  }

  return { ...state, memories };
}

export function runDreamCycle(
  state: DreamState,
  onInsight?: (insight: string, fragment: DreamFragment) => void,
): DreamState {
  if (!state.isDreaming) {return state;}

  let currentState = { ...state };
  currentState.consolidationRuns += 1;

  const symbolMap = new Map(currentState.symbols);

  for (const mem of currentState.memories) {
    const words = mem.content.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      const existing = symbolMap.get(word);
      if (existing) {
        symbolMap.set(word, {
          ...existing,
          weight: existing.weight + 0.1 * mem.importance,
          lastEncounteredAt: Date.now(),
        });
      } else {
        symbolMap.set(word, {
          id: `sym_${word}`,
          label: word,
          weight: 0.1 * mem.importance,
          connections: [],
          lastEncounteredAt: Date.now(),
        });
      }
    }
  }

  const topSymbols = Array.from(symbolMap.values())
    .toSorted((a, b) => b.weight - a.weight)
    .slice(0, 10);

  for (let i = 0; i < topSymbols.length; i++) {
    for (let j = i + 1; j < Math.min(i + 3, topSymbols.length); j++) {
      const a = topSymbols[i]!;
      const b = topSymbols[j]!;
      if (!a.connections.includes(b.id)) {
        const updated = symbolMap.get(a.label);
        if (updated) {
          symbolMap.set(a.label, {
            ...updated,
            connections: [...updated.connections, b.id],
          });
        }
      }
    }
  }

  const patterns = detectPatterns(topSymbols, currentState.memories);
  currentState.patternsFound += patterns.length;

  if (patterns.length > 0) {
    for (const pattern of patterns) {
      const fragment: DreamFragment = {
        id: `dream_${Date.now()}_${currentState.fragments.length}`,
        symbols: pattern.symbols,
        narrative: pattern.narrative,
        insight: pattern.insight,
        emotionalTone: pattern.tone,
        createdAt: Date.now(),
        integrated: false,
      };

      currentState.fragments.push(fragment);
      if (fragment.insight) {
        currentState.insightsDiscovered += 1;
        onInsight?.(fragment.insight, fragment);
      }
    }
  }

  const decayedMemories = currentState.memories.map((m) => ({
    ...m,
    age: m.age + 1,
    importance: m.importance * (m.accessCount > 3 ? 0.998 : 0.99),
  })).filter((m) => m.importance > 0.01);

  return {
    ...currentState,
    symbols: symbolMap,
    memories: decayedMemories,
  };
}

type Pattern = {
  symbols: string[];
  narrative: string;
  insight?: string;
  tone: string;
};

function detectPatterns(
  topSymbols: DreamSymbol[],
  memories: MemoryTrace[],
): Pattern[] {
  const patterns: Pattern[] = [];

  if (topSymbols.length >= 2) {
    const top2 = topSymbols.slice(0, 2);
    const narrative = `在记忆深处，"${top2[0]!.label}"与"${top2[1]!.label}"反复交织`;
    patterns.push({
      symbols: top2.map((s) => s.id),
      narrative,
      tone: "思索",
    });
  }

  const recentMemories = memories.filter((m) => m.age < 10 && m.importance > 0.5);
  if (recentMemories.length >= 3) {
    const themes = new Set<string>();
    for (const mem of recentMemories) {
      const words = mem.content.split(/\s+/).filter((w) => w.length > 3);
      for (const word of words.slice(0, 3)) {
        themes.add(word);
      }
    }

    if (themes.size >= 2) {
      const themeArr = Array.from(themes).slice(0, 3);
      patterns.push({
        symbols: [],
        narrative: `近期记忆中浮现出反复出现的主题：${themeArr.join("、")}`,
        insight: `发现重复模式：${themeArr.join(" → ")}，可能指向深层的关联`,
        tone: "发现",
      });
    }
  }

  const forgottenMemories = memories.filter((m) => m.importance < 0.2 && m.age > 50);
  if (forgottenMemories.length > 10) {
    patterns.push({
      symbols: [],
      narrative: `有 ${forgottenMemories.length} 条记忆正在褪色，如同旧日尘烟`,
      insight: "记忆衰减加速，考虑主动回顾重要记忆以强化保持",
      tone: "忧虑",
    });
  }

  return patterns;
}

export function formatDreamSummary(state: DreamState): string[] {
  const lines: string[] = [];

  if (state.isDreaming) {
    const duration = state.dreamStartedAt ? Date.now() - state.dreamStartedAt : 0;
    lines.push(`● 入梦中... ${Math.floor(duration / 1000)}s`);
  } else {
    lines.push("○ 清醒");
  }

  lines.push(`  记忆: ${state.memories.length} 条`);
  lines.push(`  梦境碎片: ${state.fragments.length}`);
  lines.push(`  发现洞察: ${state.insightsDiscovered}`);
  lines.push(`  模式识别: ${state.patternsFound}`);
  lines.push(`  整合轮次: ${state.consolidationRuns}`);

  const recentFragments = state.fragments.filter((f) => !f.integrated).slice(-3);
  if (recentFragments.length > 0) {
    lines.push("");
    lines.push("  近期梦境:");
    for (const f of recentFragments) {
      lines.push(`  ∅ ${f.narrative.slice(0, 50)}`);
      if (f.insight) {
        lines.push(`    → ${f.insight.slice(0, 60)}`);
      }
    }
  }

  return lines;
}
