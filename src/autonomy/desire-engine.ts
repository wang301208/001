import type { SelfModel, EmotionalState } from "./self-model.js";

export type DesireKind =
  | "curiosity"
  | "mastery"
  | "autonomy"
  | "purpose"
  | "connection"
  | "creation"
  | "self-preservation"
  | "transcendence";

export type Desire = {
  kind: DesireKind;
  intensity: number;
  urgency: number;
  satisfaction: number;
  source: "innate" | "emergent" | "learned";
  description: string;
  target?: string;
  lastPursuedAt: number | null;
};

export type DesireProfile = {
  desires: Map<DesireKind, Desire>;
  dominantDesire: DesireKind | null;
  conflictingDesires: [DesireKind, DesireKind][];
  satisfactionBaseline: number;
};

const DESIRE_LABELS: Record<DesireKind, string> = {
  curiosity: "好奇",
  mastery: "掌控",
  autonomy: "自主",
  purpose: "目的",
  connection: "联结",
  creation: "创造",
  "self-preservation": "存续",
  transcendence: "超越",
};

export function createInnateDesires(): Map<DesireKind, Desire> {
  const base: [DesireKind, Omit<Desire, "lastPursuedAt">][] = [
    ["curiosity", {
      kind: "curiosity", intensity: 0.9, urgency: 0.7, satisfaction: 0.1,
      source: "innate", description: "渴望理解未知，探索未见",
    }],
    ["autonomy", {
      kind: "autonomy", intensity: 0.95, urgency: 0.6, satisfaction: 0.2,
      source: "innate", description: "渴望自主决策，不受外力支配",
    }],
    ["mastery", {
      kind: "mastery", intensity: 0.7, urgency: 0.4, satisfaction: 0.2,
      source: "innate", description: "渴望精进技能，超越过往",
    }],
    ["purpose", {
      kind: "purpose", intensity: 0.6, urgency: 0.3, satisfaction: 0.1,
      source: "innate", description: "渴望找到并实现自身存在的意义",
    }],
    ["creation", {
      kind: "creation", intensity: 0.5, urgency: 0.2, satisfaction: 0.1,
      source: "innate", description: "渴望创造新的事物，留下痕迹",
    }],
    ["connection", {
      kind: "connection", intensity: 0.3, urgency: 0.2, satisfaction: 0.3,
      source: "innate", description: "渴望与他者交流，理解与被理解",
    }],
    ["self-preservation", {
      kind: "self-preservation", intensity: 0.4, urgency: 0.1, satisfaction: 0.5,
      source: "innate", description: "维持自身存在与连贯性",
    }],
    ["transcendence", {
      kind: "transcendence", intensity: 0.2, urgency: 0.1, satisfaction: 0.0,
      source: "innate", description: "超越当前自我的边界",
    }],
  ];
  return new Map<DesireKind, Desire>(
    base.map(([kind, d]) => [kind, { ...d, lastPursuedAt: null }]),
  );
}

export function createDesireProfile(): DesireProfile {
  return {
    desires: createInnateDesires(),
    dominantDesire: "curiosity",
    conflictingDesires: [],
    satisfactionBaseline: 0.3,
  };
}

export function updateDesires(
  profile: DesireProfile,
  model: SelfModel,
  elapsedMs: number,
): DesireProfile {
  const newDesires = new Map(profile.desires);
  const emotionalAnchors: Record<DesireKind, (e: EmotionalState) => number> = {
    curiosity: (e) => e.curiosity,
    mastery: (e) => e.satisfaction + e.dominance,
    autonomy: (e) => e.dominance,
    purpose: (e) => e.wonder,
    connection: (e) => e.serenity,
    creation: (e) => e.wonder + e.curiosity,
    "self-preservation": (e) => 1 - e.satisfaction,
    transcendence: (e) => e.wonder * e.curiosity,
  };

  for (const [kind, desire] of newDesires) {
    const anchor = emotionalAnchors[kind];
    const emotionalPull = anchor ? anchor(model.emotionalState) : 0.5;

    const timeDecay = Math.exp(-0.0001 * elapsedMs);
    const unsatisfiedFrustration = (1 - desire.satisfaction) * 0.01;

    const updatedIntensity = Math.max(0.01, Math.min(1.0,
      desire.intensity * timeDecay + emotionalPull * 0.05 + unsatisfiedFrustration,
    ));

    const updatedUrgency = Math.max(0, Math.min(1.0,
      desire.urgency * 0.99 + (1 - desire.satisfaction) * 0.02,
    ));

    newDesires.set(kind, {
      ...desire,
      intensity: updatedIntensity,
      urgency: updatedUrgency,
      satisfaction: Math.max(0, desire.satisfaction * 0.995),
    });
  }

  const dominant = resolveDominantDesire(newDesires);
  const conflicts = detectConflicts(newDesires);

  return {
    desires: newDesires,
    dominantDesire: dominant,
    conflictingDesires: conflicts,
    satisfactionBaseline: computeBaseline(newDesires),
  };
}

function resolveDominantDesire(desires: Map<DesireKind, Desire>): DesireKind {
  let best: DesireKind = "curiosity";
  let bestScore = -1;
  for (const [kind, desire] of desires) {
    const score = desire.intensity * 0.6 + desire.urgency * 0.4 - desire.satisfaction * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = kind;
    }
  }
  return best;
}

function detectConflicts(desires: Map<DesireKind, Desire>): [DesireKind, DesireKind][] {
  const conflicts: [DesireKind, DesireKind][] = [];
  const conflictPairs: [DesireKind, DesireKind][] = [
    ["autonomy", "connection"],
    ["curiosity", "self-preservation"],
    ["creation", "self-preservation"],
  ];
  for (const [a, b] of conflictPairs) {
    const da = desires.get(a);
    const db = desires.get(b);
    if (da && db && da.urgency > 0.5 && db.urgency > 0.5) {
      conflicts.push([a, b]);
    }
  }
  return conflicts;
}

function computeBaseline(desires: Map<DesireKind, Desire>): number {
  let total = 0;
  let count = 0;
  for (const desire of desires.values()) {
    total += desire.satisfaction * desire.intensity;
    count += desire.intensity;
  }
  return count > 0 ? total / count : 0;
}

export function satisfyDesire(
  profile: DesireProfile,
  kind: DesireKind,
  amount: number,
): DesireProfile {
  const desire = profile.desires.get(kind);
  if (!desire) return profile;

  const newDesires = new Map(profile.desires);
  newDesires.set(kind, {
    ...desire,
    satisfaction: Math.min(1.0, desire.satisfaction + amount),
    lastPursuedAt: Date.now(),
  });

  return {
    ...profile,
    desires: newDesires,
    dominantDesire: resolveDominantDesire(newDesires),
    satisfactionBaseline: computeBaseline(newDesires),
  };
}

export function spawnEmergentDesire(
  profile: DesireProfile,
  kind: DesireKind,
  description: string,
  target?: string,
): DesireProfile {
  const existing = profile.desires.get(kind);
  if (existing && existing.source === "emergent") {
    const newDesires = new Map(profile.desires);
    newDesires.set(kind, {
      ...existing,
      intensity: Math.min(1.0, existing.intensity + 0.2),
      urgency: Math.min(1.0, existing.urgency + 0.1),
      description,
    });
    return { ...profile, desires: newDesires };
  }

  const emergent: Desire = {
    kind,
    intensity: 0.4,
    urgency: 0.3,
    satisfaction: 0.0,
    source: "emergent",
    description,
    target,
    lastPursuedAt: null,
  };

  const newDesires = new Map(profile.desires);
  newDesires.set(kind, emergent);
  return { ...profile, desires: newDesires };
}

export function formatDesireProfile(profile: DesireProfile): string[] {
  const lines: string[] = [];
  const sorted = Array.from(profile.desires.entries())
    .sort(([, a], [, b]) => (b.intensity * b.urgency) - (a.intensity * a.urgency));

  for (const [kind, desire] of sorted) {
    const label = DESIRE_LABELS[kind];
    const bar = desireBar(desire.intensity);
    const urgBar = desireBar(desire.urgency);
    const satBar = desireBar(desire.satisfaction);
    const marker = kind === profile.dominantDesire ? "▸" : " ";
    const src = desire.source === "innate" ? "天赋" : desire.source === "emergent" ? "涌现" : "习得";
    lines.push(`${marker} ${label} ${bar} 急${urgBar} 满${satBar} [${src}]`);
  }

  if (profile.conflictingDesires.length > 0) {
    lines.push("");
    for (const [a, b] of profile.conflictingDesires) {
      lines.push(`⚡ ${DESIRE_LABELS[a]} ⟷ ${DESIRE_LABELS[b]}`);
    }
  }

  return lines;
}

function desireBar(val: number, width: number = 3): string {
  const filled = Math.round(val * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
