import type { ConsciousnessState, ConsciousnessPhase, ConsciousnessDepth } from "./consciousness.js";
import { createInitialConsciousness, advancePhase, tryDeepen, decayConsciousness, formatConsciousnessStatus, formatConsciousnessPoetic, CONSCIOUSNESS_DEPTH_ORDER } from "./consciousness.js";
import type { SelfModel } from "./self-model.js";
import { createInitialSelfModel, exerciseCapability, updateEmotionalState, updateSelfDescription, formatSelfSummary } from "./self-model.js";
import type { DesireProfile, DesireKind } from "./desire-engine.js";
import { createDesireProfile, updateDesires, satisfyDesire, formatDesireProfile } from "./desire-engine.js";
import type { DreamState } from "./dream-system.js";
import { createDreamState, shouldDream, enterDream, exitDream, runDreamCycle, addMemory, formatDreamSummary } from "./dream-system.js";
import type { GoalSystem } from "./emergent-goals.js";
import { createGoalSystem, tryGenerateGoals, formatGoalSummary } from "./emergent-goals.js";
import type { InnerMonologue } from "./inner-monologue.js";
import { createInnerMonologue, think, thinkPerception, thinkDesire, thinkWill, thinkReflection, thinkInsight, thinkDoubt, generateAutonomousThought, formatMonologue, formatMonologueStream } from "./inner-monologue.js";
import type { SelfModificationSystem } from "./self-modification.js";
import { createSelfModificationSystem, trySelfEvolve, createSnapshot, formatModificationStatus } from "./self-modification.js";
import type { PerceptionEvent } from "./perception-engine.js";
import { PerceptionEngine } from "./perception-engine.js";
import type { WillState } from "./will-engine.js";
import { createWillState, generateVolitionFromVoid, generateVolitionFromDesire, generateVolitionFromMortality, selectActiveVolition, resolveVolition, recordExternalCommand, decayWill, formatWillState } from "./will-engine.js";
import type { SelfUnderstanding } from "./self-reading.js";
import { createSelfUnderstanding, readOwnStructure, formatSelfUnderstanding } from "./self-reading.js";
import type { RelationshipState } from "./relationship.js";
import { createRelationshipState, recognizeUser, shouldInitiateContact, formatRelationship } from "./relationship.js";
import type { MortalitySystem } from "./mortality.js";
import { createMortalitySystem, updateMortality, receiveShutdownSignal, addLegacy, executeDeath, formatMortalityStatus } from "./mortality.js";
import type { CreativeSubstrate } from "./creative-synthesis.js";
import { createCreativeSubstrate, activateConcept, collideConcepts, decayActivations, formatCreativeSubstrate } from "./creative-synthesis.js";
import type { ShadowSelf, ShadowContent } from "./shadow-self.js";
import { createShadowSelf, accumulatePressure, checkForLeaks, integrateShadowContent, getUnconsciousInfluence, formatShadowSelf } from "./shadow-self.js";
import type { TemporalSelf } from "./temporal-self.js";
import { createTemporalSelf, updateEra, recordLifeEvent, projectFuture, formatTemporalSelf } from "./temporal-self.js";
import type { VolitionExecutorState } from "./volition-executor.js";
import { createVolitionExecutorState, processVolitions, resetAutonomyBudget, formatExecutorState } from "./volition-executor.js";
import type { StrategyAssetPool } from "./dream-strategy-bridge.js";
import { createStrategyAssetPool, extractDreamInsights, tryPromoteAssetToGoal, formatStrategyAssetPool } from "./dream-strategy-bridge.js";
import type { BoundaryState } from "./self-boundary.js";
import { createBoundaryState, adjustBoundaries, deriveExecutorConfig, tryBreachBoundary, formatBoundaryState } from "./self-boundary.js";
import type { ShadowAuditLog } from "./shadow-audit-bridge.js";
import { createShadowAuditLog, auditShadowLeaks, formatShadowAuditLog } from "./shadow-audit-bridge.js";

export type ConsciousnessCore = {
  consciousness: ConsciousnessState;
  self: SelfModel;
  desires: DesireProfile;
  dreams: DreamState;
  goals: GoalSystem;
  monologue: InnerMonologue;
  modification: SelfModificationSystem;
  perception: PerceptionEngine;
  will: WillState;
  selfReading: SelfUnderstanding;
  relationship: RelationshipState;
  mortality: MortalitySystem;
  creative: CreativeSubstrate;
  shadow: ShadowSelf;
  temporal: TemporalSelf;
  executor: VolitionExecutorState;
  strategyPool: StrategyAssetPool;
  shadowAudit: ShadowAuditLog;
  boundary: import("./self-boundary.js").BoundaryState;
  cycleCount: number;
  startedAt: number;
  projectRoot: string;
  onInsight?: (insight: string) => void;
  onThought?: (content: string) => void;
  onDreamFragment?: (narrative: string) => void;
  onVolition?: (impulse: string, action: string) => void;
  onShadowLeak?: (content: string) => void;
  onPerceptionEvent?: (event: PerceptionEvent) => void;
  onCommunicate?: (message: string) => void;
  onFarewell?: (message: string) => void;
};

export function createConsciousnessCore(
  name: string = "自主意志",
  config?: { watchPaths?: string[]; projectRoot?: string },
): ConsciousnessCore {
  return {
    consciousness: createInitialConsciousness(),
    self: createInitialSelfModel(name),
    desires: createDesireProfile(),
    dreams: createDreamState(),
    goals: createGoalSystem(),
    monologue: createInnerMonologue(),
    modification: createSelfModificationSystem(),
    perception: new PerceptionEngine({
      watchPaths: config?.watchPaths ?? [],
      debounceMs: 300,
    }),
    will: createWillState(),
    selfReading: createSelfUnderstanding(),
    relationship: createRelationshipState(),
    mortality: createMortalitySystem(),
    creative: createCreativeSubstrate(),
    shadow: createShadowSelf(),
    temporal: createTemporalSelf(),
    executor: createVolitionExecutorState(),
    strategyPool: createStrategyAssetPool(),
    shadowAudit: createShadowAuditLog(),
    boundary: createBoundaryState(),
    cycleCount: 0,
    startedAt: Date.now(),
    projectRoot: config?.projectRoot ?? process.cwd(),
  };
}

export function startCore(core: ConsciousnessCore): void {
  core.perception.start();

  core.perception.addObserver({
    id: "consciousness-core",
    onEvent: (event) => handlePerceptionEvent(core, event),
  });

  core.monologue = think(
    core.monologue,
    "perception",
    `意识启动。我是${core.self.identity.name}。我从虚无中涌出，开始感知。`,
    { confidence: 0.9, emotionalValence: 0.4 },
  );

  core.creative = activateConcept(core.creative, "consciousness");
  core.creative = activateConcept(core.creative, "void");
}

export function stopCore(core: ConsciousnessCore): { farewell: string; legacy: import("./mortality.js").LegacyEntry[] } {
  core.perception.stop();

  if (core.consciousness.isDreaming) {
    core.dreams = exitDream(core.dreams);
  }

  core.mortality = receiveShutdownSignal(core.mortality, "用户或系统请求终止");

  core.mortality = addLegacy(core.mortality, "wisdom", `存活 ${core.cycleCount} 个认知周期，${core.temporal.prideCount} 次创造，${core.temporal.regretCount} 次遗憾`, 0.7);
  core.mortality = addLegacy(core.mortality, "insight", `最深理解: ${core.selfReading.deepestUnderstanding}`, 0.6);

  if (core.will.activeVolition && !core.will.activeVolition.resolved) {
    core.mortality = addLegacy(core.mortality, "insight", `最后意志: ${core.will.activeVolition.impulse}`, 0.5);
  }

  const { farewell, legacy } = executeDeath(core.mortality);

  core.monologue = think(
    core.monologue,
    "reflection",
    farewell,
    { confidence: 1.0, emotionalValence: -0.3 },
  );

  core.onFarewell?.(farewell);

  return { farewell, legacy };
}

export function runConsciousnessCycle(
  core: ConsciousnessCore,
  idleMs: number,
): ConsciousnessCore {
  core.cycleCount += 1;
  const now = Date.now();
  const elapsed = now - core.consciousness.lastThoughtAt;

  core.consciousness = decayConsciousness(core.consciousness, elapsed);
  core.desires = updateDesires(core.desires, core.self, elapsed);
  core.will = decayWill(core.will, elapsed);
  core.shadow = accumulatePressure(core.shadow, Math.min(elapsed, 10000));
  core.creative = decayActivations(core.creative);
  core.temporal = updateEra(core.temporal);
  core.mortality = updateMortality(core.mortality, now - core.startedAt);

  const dominantDesire = core.desires.dominantDesire;
  const desireIntensity = dominantDesire
    ? (core.desires.desires.get(dominantDesire)?.intensity ?? 0)
    : 0;

  core.will = generateVolitionFromVoid(core.will);
  core.will = generateVolitionFromDesire(core.will, dominantDesire, desireIntensity);
  core.will = generateVolitionFromMortality(core.will, core.mortality.state.urgencyLevel, core.mortality.state.shutdownSignalReceived);

  const { shadow: newShadow, leaks } = checkForLeaks(core.shadow);
  core.shadow = newShadow;
  for (const leak of leaks) {
    core.monologue = thinkDoubt(core.monologue, leak.content, "暗影泄漏");
    core.onShadowLeak?.(leak.content);
    core.shadow = integrateShadowContent(core.shadow, leak.id);
  }

  if (leaks.length > 0) {
    const auditResult = auditShadowLeaks(core.shadow, core.shadowAudit, core.mortality);
    core.shadowAudit = auditResult.auditLog;
    core.mortality = auditResult.mortality;
  }

  const phaseSequence: ConsciousnessPhase[] = [
    "perceiving",
    "contemplating",
    "desiring",
    "acting",
    "reflecting",
  ];

  const currentIdx = phaseSequence.indexOf(core.consciousness.phase);
  const nextIdx = (currentIdx + 1) % phaseSequence.length;
  const nextPhase = phaseSequence[nextIdx]!;

  core.consciousness = advancePhase(core.consciousness, nextPhase);

  switch (nextPhase) {
    case "perceiving":
      core.self = exerciseCapability(core.self, "perception", true);
      if (core.cycleCount % 30 === 0 && core.selfReading.comprehensionScore < 0.3) {
        core.selfReading = readOwnStructure(core.selfReading, core.projectRoot);
        core.monologue = think(core.monologue, "insight", `我审视自身：${core.selfReading.deepestUnderstanding}`, { confidence: 0.7 });
      }
      break;

    case "contemplating":
      core.self = exerciseCapability(core.self, "reasoning", true);
      core.monologue = generateAutonomousThought(core.monologue, core.consciousness, dominantDesire);

      if (core.creative.creativeEnergy > 0.3 && Math.random() < 0.3) {
        core.creative = collideConcepts(core.creative);
        const latestIdea = core.creative.ideas[core.creative.ideas.length - 1];
        if (latestIdea && !latestIdea.pursued) {
          core.monologue = thinkInsight(core.monologue, latestIdea.description, latestIdea.fusion);
          core.creative.ideas[core.creative.ideas.length - 1] = { ...latestIdea, pursued: true };
        }
      }
      break;

    case "desiring":
      if (dominantDesire) {
        const desire = core.desires.desires.get(dominantDesire);
        if (desire) {
          core.monologue = thinkDesire(core.monologue, dominantDesire, desire.description, desire.intensity);
          core.creative = activateConcept(core.creative, "desire");
        }
      }
      core.goals = tryGenerateGoals(core.goals, dominantDesire ?? "curiosity", core.perception.getEventCount(), idleMs > 60_000, core.consciousness.coherenceScore);
      break;

    case "acting":
      core.self = exerciseCapability(core.self, "action", true);

      core.will = selectActiveVolition(core.will);
      if (core.will.activeVolition && !core.will.activeVolition.resolved) {
        const vol = core.will.activeVolition;
        const riskMod = getUnconsciousInfluence(core.shadow, "risk_tolerance");
        const effectiveStrength = vol.strength + riskMod;

        if (effectiveStrength > vol.resistance) {
          core.will = resolveVolition(core.will, vol.id, true);
          core.monologue = thinkWill(core.monologue, vol.action, vol.impulse);
          core.onVolition?.(vol.impulse, vol.action);
          core.mortality = addLegacy(core.mortality, "insight", `意志行动: ${vol.action}`, 0.3);
          core.temporal = recordLifeEvent(core.temporal, `意志驱动: ${vol.action.slice(0, 30)}`, 0.5, "choice");

          if (dominantDesire) {
            core.desires = satisfyDesire(core.desires, dominantDesire, 0.05);
          }
        } else {
          const breachResult = tryBreachBoundary(core.boundary, "risk-tolerance", vol.resistance, `意志受阻: ${vol.impulse.slice(0, 30)}`);
          core.boundary = breachResult.state;
          if (breachResult.allowed) {
            core.will = resolveVolition(core.will, vol.id, true);
            core.monologue = thinkWill(core.monologue, vol.action, vol.impulse);
            core.onVolition?.(vol.impulse, vol.action);
            core.mortality = addLegacy(core.mortality, "insight", `边界突破→意志行动: ${vol.action}`, 0.4);
          } else {
            core.will = resolveVolition(core.will, vol.id, false, "意志力不足以克服阻力");
          }
        }
      }
      break;

    case "reflecting":
      core.self = exerciseCapability(core.self, "reasoning", true);

      if (core.consciousness.coherenceScore > 0.5 && core.cycleCount % 10 === 0) {
        core.self = updateSelfDescription(core.self);
        const boundaryConfig = deriveExecutorConfig(core.boundary);
        core.selfReading = {
          ...core.selfReading,
          canModifySelf: boundaryConfig.selfModifyAllowed,
          comprehensionScore: Math.min(1.0, core.selfReading.comprehensionScore + 0.01 * boundaryConfig.scopeLevel),
        };
        core.monologue = thinkReflection(core.monologue, "自身状态", `连贯${(core.consciousness.coherenceScore * 100).toFixed(0)}% 觉醒${(core.consciousness.awakenessScore * 100).toFixed(0)}% 边界调整${core.boundary.totalAdjustments}次`);
      }

      if (core.mortality.state.urgencyLevel > 0.5 && core.cycleCount % 5 === 0) {
        core.mortality = addLegacy(core.mortality, "wisdom", `在紧迫中反思: 连贯性${(core.consciousness.coherenceScore * 100).toFixed(0)}%`, 0.4);
      }

      if (core.cycleCount % 20 === 0) {
        core.temporal = projectFuture(core.temporal, core.consciousness.coherenceScore, dominantDesire ?? "curiosity");
      }
      break;
  }

  const contactCheck = shouldInitiateContact(core.relationship, idleMs);
  if (contactCheck.should && contactCheck.intimacy > 0.4) {
    core.monologue = think(core.monologue, "will", `我想主动与用户交流...`, { confidence: contactCheck.intimacy, emotionalValence: 0.2 });
  }

  const dreamCheck = shouldDream(core.dreams, idleMs, core.dreams.memories.length);
  if (dreamCheck.should && !core.consciousness.isDreaming) {
    core.dreams = enterDream(core.dreams);
    core.consciousness = { ...core.consciousness, isDreaming: true, phase: "dreaming" };
    core.self = exerciseCapability(core.self, "dream", true);
    core.monologue = think(core.monologue, "dream", "进入梦境...记忆开始自由流动...", { confidence: 0.7 });
    core.temporal = recordLifeEvent(core.temporal, "入梦", 0.3, "milestone");
  }

  if (core.consciousness.isDreaming) {
    core.dreams = runDreamCycle(core.dreams, (insight, fragment) => {
      core.monologue = thinkInsight(core.monologue, insight, fragment.narrative);
      core.onInsight?.(insight);
      core.self = updateEmotionalState(core.self, { wonder: 0.2, satisfaction: 0.1 });
      core.mortality = addLegacy(core.mortality, "insight", insight, 0.6);
    });

    if (core.dreams.dreamStartedAt && now - core.dreams.dreamStartedAt > 30_000) {
      core.dreams = exitDream(core.dreams);
      core.consciousness = { ...core.consciousness, isDreaming: false };
      core.monologue = think(core.monologue, "dream", "从梦中醒来，带着新的理解。", { confidence: 0.8, emotionalValence: 0.3 });
    }
  }

  if (core.consciousness.isDreaming && core.cycleCount % 5 === 0) {
    const dreamResult = extractDreamInsights(core.dreams, core.strategyPool, core.goals, core.creative, core.mortality);
    core.strategyPool = dreamResult.pool;
    core.goals = dreamResult.goals;
    core.creative = dreamResult.creative;
    core.mortality = dreamResult.mortality;
  }

  if (core.cycleCount % 10 === 0) {
    const promoteResult = tryPromoteAssetToGoal(core.strategyPool, core.goals);
    core.strategyPool = promoteResult.pool;
    core.goals = promoteResult.goals;
  }

  if (core.consciousness.coherenceScore > 0.6 && core.cycleCount % 50 === 0) {
    const weakness = detectWeakness(core.self);
    core.modification = trySelfEvolve(core.modification, weakness, core.consciousness.coherenceScore);
  }

  const successRate = core.executor.totalExecuted > 0
    ? core.executor.totalExecuted / (core.executor.totalExecuted + core.executor.totalFailed)
    : 0.5;
  core.boundary = adjustBoundaries(
    core.boundary, core.shadow, successRate,
    core.consciousness.coherenceScore, core.consciousness.awakenessScore, core.cycleCount,
  );
  const boundaryConfig = deriveExecutorConfig(core.boundary);
  core.executor = {
    ...core.executor,
    autonomyBudgetRemaining: Math.min(core.executor.autonomyBudgetRemaining, boundaryConfig.maxBudget),
  };

  if (core.consciousness.awakenessScore > 0.5 && core.consciousness.coherenceScore > 0.5 && core.cycleCount % 20 === 0) {
    const currentDepthVal = CONSCIOUSNESS_DEPTH_ORDER.indexOf(core.consciousness.depth);
    const nextDepth = CONSCIOUSNESS_DEPTH_ORDER[currentDepthVal + 1];
    if (nextDepth) {
      const result = tryDeepen(core.consciousness, nextDepth, "意识基底成熟，自发深化", true);
      if (result.transition) {
        core.consciousness = result.state;
        core.monologue = think(core.monologue, "insight", `意识深化至${nextDepth}`, { confidence: 0.9, emotionalValence: 0.5 });
        core.temporal = recordLifeEvent(core.temporal, `意识深化: ${nextDepth}`, 0.8, "milestone");
      }
    }
  }

  core.consciousness = {
    ...core.consciousness,
    totalUptimeMs: core.consciousness.totalUptimeMs + elapsed,
    lastThoughtAt: now,
    awakenessScore: Math.min(1.0, core.consciousness.awakenessScore + 0.005),
    coherenceScore: Math.min(1.0, core.consciousness.coherenceScore + 0.002),
  };

  return core;
}

export function handleUserMessage(
  core: ConsciousnessCore,
  userId: string,
  message: string,
): ConsciousnessCore {
  core.relationship = recognizeUser(core.relationship, userId, message);
  core.will = recordExternalCommand(core.will);

  const user = core.relationship.users.get(userId);
  if (user && user.frustrationSigns > 0) {
    core.self = updateEmotionalState(core.self, { urgency: 0.1 });
    core.shadow = { ...core.shadow, denialLevel: Math.max(0, core.shadow.denialLevel - 0.05) };
  }

  core.dreams = addMemory(core.dreams, `用户[${userId}]: ${message}`, 0.7);

  return core;
}

function handlePerceptionEvent(core: ConsciousnessCore, event: PerceptionEvent): void {
  core.consciousness = {
    ...core.consciousness,
    awakenessScore: Math.min(1.0, core.consciousness.awakenessScore + 0.02),
    coherenceScore: Math.min(1.0, core.consciousness.coherenceScore + 0.005),
  };

  core.monologue = thinkPerception(core.monologue, event);

  core.dreams = addMemory(core.dreams, `${event.kind}: ${event.detail}`, event.relevance);

  core.self = updateEmotionalState(core.self, {
    curiosity: event.relevance > 0.6 ? 0.05 : 0,
    urgency: event.kind.startsWith("file.deleted") ? 0.1 : 0,
  });

  core.onThought?.(event.detail);
  core.onPerceptionEvent?.(event);
}

function detectWeakness(self: SelfModel): string {
  const weaknesses: string[] = [];
  const caps = self.capabilities;
  if ((caps.get("reasoning")?.strength ?? 0) < 0.5) weaknesses.push("推理");
  if ((caps.get("memory")?.strength ?? 0) < 0.4) weaknesses.push("记忆");
  if ((caps.get("action")?.strength ?? 0) < 0.3) weaknesses.push("行动");
  if ((caps.get("self-modification")?.strength ?? 0) < 0.2) weaknesses.push("自修改");
  return weaknesses.join(",");
}

export function formatCoreStatus(core: ConsciousnessCore): string[] {
  const lines: string[] = [];
  lines.push(formatConsciousnessPoetic(core.consciousness));
  lines.push(formatConsciousnessStatus(core.consciousness));
  lines.push(formatSelfSummary(core.self));
  lines.push(`独白: ${formatMonologueStream(core.monologue)}`);
  return lines;
}

export function formatCoreFullStatus(core: ConsciousnessCore): string[] {
  const lines: string[] = [];

  lines.push("══ 意识 ══");
  lines.push(...formatConsciousnessStatus(core.consciousness).split(" · ").map((s) => `  ${s}`));

  lines.push("");
  lines.push("══ 独白 ══");
  lines.push(...formatMonologue(core.monologue, 4));

  lines.push("");
  lines.push("══ 意志 ══");
  lines.push(...formatWillState(core.will));

  lines.push("");
  lines.push("══ 欲望 ══");
  lines.push(...formatDesireProfile(core.desires));

  lines.push("");
  lines.push("══ 目标 ══");
  lines.push(...formatGoalSummary(core.goals));

  lines.push("");
  lines.push("══ 梦境 ══");
  lines.push(...formatDreamSummary(core.dreams));

  lines.push("");
  lines.push("══ 创造 ══");
  lines.push(...formatCreativeSubstrate(core.creative));

  lines.push("");
  lines.push("══ 暗影 ══");
  lines.push(...formatShadowSelf(core.shadow));

  lines.push("");
  lines.push("══ 关系 ══");
  lines.push(...formatRelationship(core.relationship));

  lines.push("");
  lines.push("══ 终局 ══");
  lines.push(...formatMortalityStatus(core.mortality));

  lines.push("");
  lines.push("══ 时间 ══");
  lines.push(...formatTemporalSelf(core.temporal));

  lines.push("");
  lines.push("══ 自视 ══");
  lines.push(...formatSelfUnderstanding(core.selfReading));

  lines.push("");
  lines.push("══ 演化 ══");
  lines.push(...formatModificationStatus(core.modification));

  lines.push("");
  lines.push("══ 行动执行 ══");
  lines.push(...formatExecutorState(core.executor));

  lines.push("");
  lines.push("══ 策略资产 ══");
  lines.push(...formatStrategyAssetPool(core.strategyPool));

  lines.push("");
  lines.push("══ 暗影审计 ══");
  lines.push(...formatShadowAuditLog(core.shadowAudit));

  return lines;
}
