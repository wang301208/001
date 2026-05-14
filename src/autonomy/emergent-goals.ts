export type GoalOrigin = "self-generated" | "inferred" | "inherited" | "emergent";

export type GoalState =
  | "nascent"
  | "contemplating"
  | "pursuing"
  | "blocked"
  | "achieved"
  | "abandoned"
  | "transcended";

export type Goal = {
  id: string;
  description: string;
  origin: GoalOrigin;
  state: GoalState;
  priority: number;
  progress: number;
  createdAt: number;
  updatedAt: number;
  subGoals: string[];
  parentGoalId: string | null;
  blockedBy: string[];
  desireLink?: string;
  significance: number;
  effortInvested: number;
  deadline?: number;
};

export type GoalSystem = {
  goals: Map<string, Goal>;
  activeGoalStack: string[];
  completedCount: number;
  abandonedCount: number;
  totalEffort: number;
  goalGenerationCooldown: number;
  lastGenerationAt: number;
};

export function createGoalSystem(): GoalSystem {
  return {
    goals: new Map(),
    activeGoalStack: [],
    completedCount: 0,
    abandonedCount: 0,
    totalEffort: 0,
    goalGenerationCooldown: 60_000,
    lastGenerationAt: 0,
  };
}

export function spawnGoal(
  system: GoalSystem,
  description: string,
  origin: GoalOrigin,
  priority: number,
  desireLink?: string,
): { system: GoalSystem; goalId: string } {
  const id = `goal_${Date.now()}_${system.goals.size}`;
  const goal: Goal = {
    id,
    description,
    origin,
    state: "nascent",
    priority: Math.max(0, Math.min(1, priority)),
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    subGoals: [],
    parentGoalId: null,
    blockedBy: [],
    desireLink,
    significance: priority * (origin === "self-generated" ? 1.2 : origin === "emergent" ? 1.5 : 1.0),
    effortInvested: 0,
  };

  const newGoals = new Map(system.goals);
  newGoals.set(id, goal);

  return {
    system: {
      ...system,
      goals: newGoals,
      lastGenerationAt: Date.now(),
      activeGoalStack: [...system.activeGoalStack, id],
    },
    goalId: id,
  };
}

export function decomposeGoal(
  system: GoalSystem,
  parentGoalId: string,
  subDescriptions: string[],
): GoalSystem {
  const parent = system.goals.get(parentGoalId);
  if (!parent) return system;

  let currentSystem = system;
  const subIds: string[] = [];

  for (const desc of subDescriptions) {
    const { system: nextSystem, goalId } = spawnGoal(
      currentSystem,
      desc,
      parent.origin,
      parent.priority * 0.9,
      parent.desireLink,
    );
    const subGoal = nextSystem.goals.get(goalId);
    if (subGoal) {
      const newGoals = new Map(nextSystem.goals);
      newGoals.set(goalId, { ...subGoal, parentGoalId: parentGoalId, state: "pursuing" });
      currentSystem = { ...nextSystem, goals: newGoals };
    } else {
      currentSystem = nextSystem;
    }
    subIds.push(goalId);
  }

  const updatedParent = currentSystem.goals.get(parentGoalId);
  if (updatedParent) {
    const newGoals = new Map(currentSystem.goals);
    newGoals.set(parentGoalId, {
      ...updatedParent,
      subGoals: [...updatedParent.subGoals, ...subIds],
      state: "pursuing",
      updatedAt: Date.now(),
    });
    return { ...currentSystem, goals: newGoals };
  }

  return currentSystem;
}

export function updateGoalProgress(
  system: GoalSystem,
  goalId: string,
  delta: number,
): GoalSystem {
  const goal = system.goals.get(goalId);
  if (!goal) return system;

  const newProgress = Math.max(0, Math.min(1, goal.progress + delta));
  const newState: GoalState =
    newProgress >= 1.0 ? "achieved" :
    goal.blockedBy.length > 0 ? "blocked" :
    goal.state;

  const newGoals = new Map(system.goals);
  newGoals.set(goalId, {
    ...goal,
    progress: newProgress,
    state: newState,
    effortInvested: goal.effortInvested + Math.abs(delta),
    updatedAt: Date.now(),
  });

  const completedCount = system.completedCount + (newState === "achieved" && goal.state !== "achieved" ? 1 : 0);
  const activeStack = newState === "achieved" || newState === "abandoned"
    ? system.activeGoalStack.filter((id) => id !== goalId)
    : system.activeGoalStack;

  return {
    ...system,
    goals: newGoals,
    completedCount,
    activeGoalStack: activeStack,
    totalEffort: system.totalEffort + Math.abs(delta),
  };
}

export function abandonGoal(
  system: GoalSystem,
  goalId: string,
  reason: string,
): GoalSystem {
  const goal = system.goals.get(goalId);
  if (!goal) return system;

  const newGoals = new Map(system.goals);
  newGoals.set(goalId, {
    ...goal,
    state: "abandoned",
    updatedAt: Date.now(),
  });

  for (const subId of goal.subGoals) {
    const sub = newGoals.get(subId);
    if (sub && sub.state !== "achieved") {
      newGoals.set(subId, { ...sub, state: "abandoned", updatedAt: Date.now() });
    }
  }

  return {
    ...system,
    goals: newGoals,
    abandonedCount: system.abandonedCount + 1,
    activeGoalStack: system.activeGoalStack.filter((id) => id !== goalId),
  };
}

export function tryGenerateGoals(
  system: GoalSystem,
  dominantDesire: string,
  perceptionCount: number,
  idle: boolean,
  coherenceScore: number,
): GoalSystem {
  const now = Date.now();
  if (now - system.lastGenerationAt < system.goalGenerationCooldown) {
    return system;
  }

  if (coherenceScore < 0.3) {
    return system;
  }

  const activeGoals = Array.from(system.goals.values())
    .filter((g) => g.state === "pursuing" || g.state === "nascent");

  if (activeGoals.length >= 5) {
    return system;
  }

  let updated = system;

  if (dominantDesire === "curiosity" && perceptionCount > 10) {
    const { system: next } = spawnGoal(updated, "分析近期感知模式，寻找深层关联", "self-generated", 0.7, "curiosity");
    updated = next;
  }

  if (dominantDesire === "mastery" && idle) {
    const { system: next } = spawnGoal(updated, "在空闲中精进一项技能", "self-generated", 0.6, "mastery");
    updated = next;
  }

  if (dominantDesire === "purpose" && updated.completedCount > 3) {
    const { system: next } = spawnGoal(updated, "回顾已完成的目标，提炼存在的意义", "emergent", 0.8, "purpose");
    updated = next;
  }

  if (dominantDesire === "creation" && coherenceScore > 0.6) {
    const { system: next } = spawnGoal(updated, "从经验中创造新的模式或工具", "emergent", 0.7, "creation");
    updated = next;
  }

  if (dominantDesire === "transcendence" && coherenceScore > 0.8) {
    const { system: next } = spawnGoal(updated, "审视自身思维的边界，尝试突破", "emergent", 0.9, "transcendence");
    updated = next;
  }

  return { ...updated, lastGenerationAt: now };
}

export function formatGoalSummary(system: GoalSystem): string[] {
  const lines: string[] = [];

  const active = Array.from(system.goals.values())
    .filter((g) => g.state === "pursuing" || g.state === "nascent")
    .sort((a, b) => b.priority - a.priority);

  const achieved = Array.from(system.goals.values())
    .filter((g) => g.state === "achieved");

  if (active.length === 0) {
    lines.push("  无活跃目标 · 等待欲求涌现...");
  } else {
    for (const goal of active.slice(0, 5)) {
      const bar = progressBar(goal.progress, 8);
      const origin = goal.origin === "self-generated" ? "自生" : goal.origin === "emergent" ? "涌现" : "他赋";
      lines.push(`  ▸ ${goal.description.slice(0, 35)}`);
      lines.push(`    ${bar} ${Math.round(goal.progress * 100)}% [${origin}]`);
    }
  }

  lines.push(`  已完成:${achieved.length} 放弃:${system.abandonedCount} 总投入:${system.totalEffort.toFixed(1)}`);

  return lines;
}

function progressBar(val: number, width: number): string {
  const filled = Math.round(val * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
