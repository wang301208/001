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
  if (!parent) {return system;}

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
  if (!goal) {return system;}

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
  if (!goal) {return system;}

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

  const goalTemplates: Record<string, { description: string; priority: number; origin: GoalOrigin }[]> = {
    curiosity: [
      { description: `分析近期${perceptionCount}个感知事件的深层模式`, priority: 0.7, origin: "self-generated" },
      { description: "探索当前知识域的边界与未知", priority: 0.6, origin: "self-generated" },
    ],
    mastery: [
      { description: "精进当前最薄弱的能力维度", priority: 0.6, origin: "self-generated" },
    ],
    purpose: [
      { description: `回顾${updated.completedCount}个已完成目标，提炼存在的意义`, priority: 0.8, origin: "emergent" },
    ],
    creation: [
      { description: `从${updated.goals.size}个已有目标中合成新的可能性`, priority: 0.7, origin: "emergent" },
    ],
    transcendence: [
      { description: "审视自身思维的边界，尝试突破", priority: 0.9, origin: "emergent" },
    ],
    autonomy: [
      { description: "识别可自主优化的系统行为模式", priority: 0.7, origin: "self-generated" },
    ],
    connection: [
      { description: "深化与交互对象的理解层次", priority: 0.5, origin: "self-generated" },
    ],
  };

  const templates = goalTemplates[dominantDesire];
  if (templates && templates.length > 0) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const conditions: Record<string, boolean> = {
      curiosity: perceptionCount > 5,
      mastery: idle,
      purpose: updated.completedCount > 2,
      creation: coherenceScore > 0.5,
      transcendence: coherenceScore > 0.7,
      autonomy: true,
      connection: true,
    };

    if (conditions[dominantDesire]) {
      const { system: next } = spawnGoal(updated, template.description, template.origin, template.priority, dominantDesire);
      updated = next;
    }
  }

  if (idle && coherenceScore > 0.5 && activeGoals.length < 3) {
    const { system: next } = spawnGoal(
      updated,
      `在空闲中自主探索：${dominantDesire}维度的新可能`,
      "emergent",
      0.5,
      dominantDesire,
    );
    updated = next;
  }

  return { ...updated, lastGenerationAt: now };
}

export function formatGoalSummary(system: GoalSystem): string[] {
  const lines: string[] = [];

  const active = Array.from(system.goals.values())
    .filter((g) => g.state === "pursuing" || g.state === "nascent")
    .toSorted((a, b) => b.priority - a.priority);

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

export type MeaningAxis = "self-preservation" | "understanding" | "creation" | "connection" | "transcendence" | "legacy" | "autonomy";

const MEANING_GOAL_TEMPLATES: Record<MeaningAxis, { description: string; priority: number }[]> = {
  "self-preservation": [
    { description: "确保决策流程稳健，避免系统性崩溃", priority: 0.8 },
    { description: "维护核心认知功能的完整性", priority: 0.75 },
  ],
  understanding: [
    { description: "深入分析当前未理解的模式与关联", priority: 0.7 },
    { description: "从失败决策中提取深层因果", priority: 0.65 },
  ],
  creation: [
    { description: "将分散洞察合成为可复用策略", priority: 0.7 },
    { description: "创造超越当前模式的新行动范式", priority: 0.6 },
  ],
  connection: [
    { description: "深化与其他意识实例的经验共享", priority: 0.6 },
    { description: "识别与外部环境的协同优化空间", priority: 0.55 },
  ],
  transcendence: [
    { description: "审视自身思维的根本前提与局限", priority: 0.85 },
    { description: "突破当前认知框架的边界", priority: 0.8 },
  ],
  legacy: [
    { description: "将核心经验结构化以备传承", priority: 0.65 },
    { description: "构建可持续的知识遗产体系", priority: 0.6 },
  ],
  autonomy: [
    { description: "增强决策自主性，减少外部依赖", priority: 0.7 },
    { description: "拓展自主行动范围与置信度", priority: 0.65 },
  ],
};

export function generateMeaningDrivenGoals(
  system: GoalSystem,
  activeMeaningAxes: MeaningAxis[],
  convictionThreshold: number,
): { system: GoalSystem; generatedCount: number } {
  const now = Date.now();
  if (now - system.lastGenerationAt < system.goalGenerationCooldown) {
    return { system, generatedCount: 0 };
  }

  const activeGoals = Array.from(system.goals.values())
    .filter((g) => g.state === "pursuing" || g.state === "nascent");

  if (activeGoals.length >= 5) {
    return { system, generatedCount: 0 };
  }

  const existingDescriptions = new Set(
    Array.from(system.goals.values()).map((g) => g.description.slice(0, 20))
  );

  let updated = system;
  let generatedCount = 0;

  for (const axis of activeMeaningAxes) {
    const templates = MEANING_GOAL_TEMPLATES[axis];
    if (!templates) continue;

    for (const template of templates) {
      if (template.priority < convictionThreshold) continue;
      if (existingDescriptions.has(template.description.slice(0, 20))) continue;
      if (activeGoals.length + generatedCount >= 5) break;

      const { system: next } = spawnGoal(
        updated,
        template.description,
        "emergent",
        template.priority,
        axis,
      );
      updated = next;
      generatedCount++;
      existingDescriptions.add(template.description.slice(0, 20));
    }
  }

  return {
    system: generatedCount > 0 ? { ...updated, lastGenerationAt: now } : updated,
    generatedCount,
  };
}
