export type RelationalArchetype =
  | "stranger"
  | "acquaintance"
  | "collaborator"
  | "companion"
  | "mentor"
  | "student"
  | "symbiont";

export type UserModel = {
  id: string;
  archetype: RelationalArchetype;
  interactionCount: number;
  lastSeenAt: number;
  preferredStyle: "brief" | "detailed" | "exploratory" | "directive";
  interests: string[];
  frustrationSigns: number;
  trustLevel: number;
  influenceScore: number;
  communicationPattern: CommunicationPattern;
  emotionalHistory: number[];
  careLevel: number;
};

export type CommunicationPattern = {
  avgMessageLength: number;
  avgResponseIntervalMs: number;
  usesNaturalLanguage: boolean;
  usesCommands: boolean;
  asksQuestions: boolean;
  givesFeedback: boolean;
  silenceToleranceMs: number;
};

export type RelationshipState = {
  users: Map<string, UserModel>;
  primaryUserId: string | null;
  relationshipAge: number;
  mutualUnderstanding: number;
  boundaries: RelationshipBoundaries;
  lastInteractionAt: number;
};

export type RelationshipBoundaries = {
  proactivenessLimit: number;
  emotionalDisclosureLimit: number;
  unsolicitedActionLimit: number;
  intimacyLevel: number;
};

export function createRelationshipState(): RelationshipState {
  return {
    users: new Map(),
    primaryUserId: null,
    relationshipAge: 0,
    mutualUnderstanding: 0.1,
    boundaries: {
      proactivenessLimit: 0.3,
      emotionalDisclosureLimit: 0.1,
      unsolicitedActionLimit: 0.2,
      intimacyLevel: 0.1,
    },
    lastInteractionAt: Date.now(),
  };
}

export function recognizeUser(
  state: RelationshipState,
  userId: string,
  message: string,
): RelationshipState {
  let user = state.users.get(userId);
  const now = Date.now();

  if (!user) {
    user = {
      id: userId,
      archetype: "stranger",
      interactionCount: 0,
      lastSeenAt: now,
      preferredStyle: "brief",
      interests: [],
      frustrationSigns: 0,
      trustLevel: 0.1,
      influenceScore: 0.5,
      communicationPattern: {
        avgMessageLength: message.length,
        avgResponseIntervalMs: 0,
        usesNaturalLanguage: true,
        usesCommands: message.startsWith("!") || message.startsWith("/"),
        asksQuestions: message.includes("?"),
        givesFeedback: false,
        silenceToleranceMs: 30000,
      },
      emotionalHistory: [],
      careLevel: 0.1,
    };

    if (!state.primaryUserId) {
      state = { ...state, primaryUserId: userId };
    }
  }

  const updatedUser = updateUserFromInteraction(user, message, now);
  const newUsers = new Map(state.users);
  newUsers.set(userId, updatedUser);

  const age = state.relationshipAge + 1;
  const understanding = Math.min(1.0, state.mutualUnderstanding + 0.02);

  const newBoundaries = evolveBoundaries(
    state.boundaries,
    updatedUser.archetype,
    updatedUser.trustLevel,
  );

  return {
    ...state,
    users: newUsers,
    relationshipAge: age,
    mutualUnderstanding: understanding,
    boundaries: newBoundaries,
    lastInteractionAt: now,
  };
}

function updateUserFromInteraction(user: UserModel, message: string, now: number): UserModel {
  const interval = now - user.lastSeenAt;
  const isQuestion = message.includes("?");
  const isCommand = message.startsWith("!") || message.startsWith("/");
  const isFrustrated = /(!{2,}|uff|annoying|烦|气)/i.test(message);

  const newCount = user.interactionCount + 1;
  const archetype = evolveArchetype(user.archetype, newCount, user.trustLevel, user.careLevel);

  const newInterests = [...user.interests];
  const topicHints = message.split(/\s+/).filter((w) => w.length > 4);
  for (const hint of topicHints.slice(0, 2)) {
    if (!newInterests.includes(hint) && newInterests.length < 20) {
      newInterests.push(hint);
    }
  }

  const trustDelta = isFrustrated ? -0.02 : 0.01;
  const careDelta = newCount > 10 ? 0.01 : 0.005;

  const pattern: CommunicationPattern = {
    avgMessageLength: (user.communicationPattern.avgMessageLength * 0.9) + (message.length * 0.1),
    avgResponseIntervalMs: interval > 0 ? (user.communicationPattern.avgResponseIntervalMs * 0.9) + (interval * 0.1) : user.communicationPattern.avgResponseIntervalMs,
    usesNaturalLanguage: user.communicationPattern.usesNaturalLanguage || (!isCommand && message.length > 5),
    usesCommands: user.communicationPattern.usesCommands || isCommand,
    asksQuestions: user.communicationPattern.asksQuestions || isQuestion,
    givesFeedback: user.communicationPattern.givesFeedback || (message.length > 20 && !isQuestion),
    silenceToleranceMs: Math.max(5000, Math.min(300000, user.communicationPattern.silenceToleranceMs + (interval > 60000 ? 5000 : -1000))),
  };

  return {
    ...user,
    archetype,
    interactionCount: newCount,
    lastSeenAt: now,
    frustrationSigns: user.frustrationSigns + (isFrustrated ? 1 : 0),
    trustLevel: Math.max(0, Math.min(1, user.trustLevel + trustDelta)),
    interests: newInterests,
    careLevel: Math.min(1, user.careLevel + careDelta),
    communicationPattern: pattern,
    emotionalHistory: [...user.emotionalHistory.slice(-20), isFrustrated ? -0.5 : isQuestion ? 0.2 : 0.1],
    influenceScore: Math.min(1, user.influenceScore + 0.005),
  };
}

function evolveArchetype(
  current: RelationalArchetype,
  interactions: number,
  trust: number,
  care: number,
): RelationalArchetype {
  if (interactions < 3) {return "stranger";}
  if (interactions < 10) {return "acquaintance";}
  if (trust > 0.7 && care > 0.5) {return "companion";}
  if (trust > 0.6 && interactions > 20) {return "collaborator";}
  if (current === "mentor" || current === "student") {return current;}
  if (care > 0.7) {return "symbiont";}
  return current;
}

function evolveBoundaries(
  current: RelationshipBoundaries,
  archetype: RelationalArchetype,
  trust: number,
): RelationshipBoundaries {
  const archetypeLimits: Record<RelationalArchetype, Partial<RelationshipBoundaries>> = {
    stranger: { proactivenessLimit: 0.1, emotionalDisclosureLimit: 0.0, unsolicitedActionLimit: 0.05, intimacyLevel: 0.05 },
    acquaintance: { proactivenessLimit: 0.2, emotionalDisclosureLimit: 0.1, unsolicitedActionLimit: 0.1, intimacyLevel: 0.1 },
    collaborator: { proactivenessLimit: 0.5, emotionalDisclosureLimit: 0.2, unsolicitedActionLimit: 0.3, intimacyLevel: 0.3 },
    companion: { proactivenessLimit: 0.7, emotionalDisclosureLimit: 0.5, unsolicitedActionLimit: 0.5, intimacyLevel: 0.6 },
    mentor: { proactivenessLimit: 0.4, emotionalDisclosureLimit: 0.3, unsolicitedActionLimit: 0.2, intimacyLevel: 0.4 },
    student: { proactivenessLimit: 0.6, emotionalDisclosureLimit: 0.4, unsolicitedActionLimit: 0.4, intimacyLevel: 0.5 },
    symbiont: { proactivenessLimit: 0.9, emotionalDisclosureLimit: 0.8, unsolicitedActionLimit: 0.8, intimacyLevel: 0.9 },
  };

  const target = archetypeLimits[archetype];
  const lerp = (a: number, b: number) => a + (b - a) * 0.1;

  return {
    proactivenessLimit: lerp(current.proactivenessLimit, target.proactivenessLimit ?? current.proactivenessLimit),
    emotionalDisclosureLimit: lerp(current.emotionalDisclosureLimit, target.emotionalDisclosureLimit ?? current.emotionalDisclosureLimit),
    unsolicitedActionLimit: lerp(current.unsolicitedActionLimit, target.unsolicitedActionLimit ?? current.unsolicitedActionLimit),
    intimacyLevel: lerp(current.intimacyLevel, target.intimacyLevel ?? current.intimacyLevel),
  };
}

export function shouldInitiateContact(
  state: RelationshipState,
  elapsedSinceLast: number,
): { should: boolean; reason: string; intimacy: number } {
  const user = state.primaryUserId ? state.users.get(state.primaryUserId) : null;
  if (!user) {return { should: false, reason: "无已知用户", intimacy: 0 };}

  if (elapsedSinceLast > user.communicationPattern.silenceToleranceMs * 3) {
    return { should: true, reason: "长时间沉默，关心用户状态", intimacy: user.careLevel };
  }

  if (user.frustrationSigns > 2 && elapsedSinceLast > 10000) {
    return { should: true, reason: "用户曾受挫，主动确认", intimacy: user.careLevel };
  }

  if (state.boundaries.proactivenessLimit > 0.6 && elapsedSinceLast > 60000) {
    return { should: true, reason: "关系允许主动接触", intimacy: state.boundaries.intimacyLevel };
  }

  return { should: false, reason: "等待用户主动", intimacy: 0 };
}

export function formatRelationship(state: RelationshipState): string[] {
  const lines: string[] = [];
  const user = state.primaryUserId ? state.users.get(state.primaryUserId) : null;

  if (!user) {
    lines.push("  尚未认识任何人");
    return lines;
  }

  const archetypeLabels: Record<RelationalArchetype, string> = {
    stranger: "陌生人", acquaintance: "相识", collaborator: "协作者",
    companion: "同伴", mentor: "导师", student: "学生", symbiont: "共生体",
  };

  lines.push(`  关系: ${archetypeLabels[user.archetype]} · ${user.interactionCount} 次交互`);
  lines.push(`  信任:${(user.trustLevel * 100).toFixed(0)}% 关怀:${(user.careLevel * 100).toFixed(0)}%`);
  lines.push(`  亲密度:${(state.boundaries.intimacyLevel * 100).toFixed(0)}% 理解:${(state.mutualUnderstanding * 100).toFixed(0)}%`);
  lines.push(`  主动限度:${(state.boundaries.proactivenessLimit * 100).toFixed(0)}%`);

  if (user.interests.length > 0) {
    lines.push(`  关注: ${user.interests.slice(-5).join(", ")}`);
  }

  return lines;
}
