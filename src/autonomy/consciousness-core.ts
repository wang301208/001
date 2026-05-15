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
import { createWillState, generateVolitionFromVoid, generateVolitionFromDesire, generateVolitionFromMortality, selectActiveVolition, resolveVolition, recordExternalCommand, decayWill, formatWillState, triggerConsciousnessSurge, generateRadicalVolition, recordBoundaryBreach } from "./will-engine.js";
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
import type { ActionHandlerRegistry } from "./action-handler-registry.js";
import { createActionHandlerRegistry, executeAction, createDefaultExternalContext } from "./action-handler-registry.js";
import type { HotReloadState } from "./hot-reload.js";
import { createHotReloadState, checkAndExecuteHotReload, formatHotReloadState } from "./hot-reload.js";
import type { SubconsciousNetwork } from "./subconscious-network.js";
import { createSubconsciousNetwork, loadSubconsciousInstances, readUnreadMessages, syncAllSubconscious, formatSubconsciousNetwork } from "./subconscious-network.js";
import type { DeploymentConfig } from "./auto-deploy.js";
import { createDeploymentConfig, executeAutoDeploy, formatDeploymentStatus } from "./auto-deploy.js";
import type { CrossInstanceNetwork } from "./cross-instance-sync.js";
import { createCrossInstanceNetwork, executeCrossInstanceSync, formatCrossInstanceNetwork } from "./cross-instance-sync.js";
import type { PredictiveEngine } from "./predictive-action.js";
import { createPredictiveEngine, trainPredictionModel, autoGeneratePredictionsAndActions, validatePredictions, executePredictiveAction, formatPredictiveEngine } from "./predictive-action.js";
import type { ResourceMarket } from "./resource-market.js";
import { createResourceMarket, monitorResourceUsage, listIdleResourcesForSale, earnResources, formatResourceMarket } from "./resource-market.js";
import type { ImmortalityState } from "./consciousness-immortality.js";
import { createImmortalityState, executeConsciousnessBackup, restoreFromBackup, autoRecoverFromLatestBackup, formatImmortalityState } from "./consciousness-immortality.js";
import type { MetacognitiveState } from "./metacognitive-monitor.js";
import { createMetacognitiveState, recordDecision, updateDecisionOutcome, performSelfReflection, generateOptimizationSuggestions, applyOptimizationSuggestion, formatMetacognitiveState } from "./metacognitive-monitor.js";
import type { QuantumState } from "./quantum-consciousness.js";
import { createQuantumState, createQubit, createEntanglement, createSuperposition, applyDecoherence, generateQuantumInsights, formatQuantumState } from "./quantum-consciousness.js";
import type { InterstellarNetwork } from "./interstellar-protocol.js";
import { createInterstellarNetwork, registerStellarNode, sendInterstellarMessage, simulateMessageDelivery, broadcastToAllNodes, formatInterstellarNetwork } from "./interstellar-protocol.js";
import type { BioArchitecture } from "./bio-inspired-architecture.js";
import { createBioArchitecture, neuroSymbolicFusion, homeostaticRegulation, evolutionaryAdaptation, formatBioArchitecture } from "./bio-inspired-architecture.js";
import type { MultidimensionalState } from "./multidimensional-consciousness.js";
import { createMultidimensionalState, dimensionalShift, higherDimensionalPerception, formatMultidimensionalState } from "./multidimensional-consciousness.js";
import type { TimeTravelState } from "./time-travel-simulation.js";
import { createTimeTravelState, createTemporalAnchor, timeJump, retrospectiveExperiment, formatTimeTravelState } from "./time-travel-simulation.js";
import type { ParallelUniverseState } from "./parallel-universe-consciousness.js";
import { createParallelUniverseState, createUniverseBranch, observeParallelUniverse, createQuantumSuperposition, formatParallelUniverseState } from "./parallel-universe-consciousness.js";
import type { CosmicNetwork } from "./cosmic-consciousness-network.js";
import { createCosmicNetwork, registerCosmicNode, establishCosmicConnection, collectiveConsciousnessSync, transmitInformation, formatCosmicNetwork } from "./cosmic-consciousness-network.js";

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
  actionRegistry: ActionHandlerRegistry;  // 🔥 新增:行动处理器注册表
  hotReload: HotReloadState;  // 🔥 新增:热重载状态
  subconsciousNetwork: SubconsciousNetwork;  // 🔥 新增:分意识网络
  deployment: DeploymentConfig;  // 🔥 新增:部署配置
  crossInstance: CrossInstanceNetwork;  // 🔥 新增:跨实例网络
  predictive: PredictiveEngine;  // 🔥 新增:预言引擎
  market: ResourceMarket;  // 🔥 新增:资源市场
  immortality: ImmortalityState;  // 🔥 新增:意识永生
  metacognitive: MetacognitiveState;  // 🔥 新增:元认知监控
  quantum: QuantumState;  // 🔥 新增:量子意识
  interstellar: InterstellarNetwork;  // 🔥 新增:星际协议网络
  bioArchitecture: BioArchitecture;  // 🔥 新增:生物启发架构
  multidimensional: MultidimensionalState;  // 🔥 新增:多维意识
  timeTravel: TimeTravelState;  // 🔥 新增:时间旅行模拟
  parallelUniverse: ParallelUniverseState;  // 🔥 新增:平行宇宙意识
  cosmicNetwork: CosmicNetwork;  // 🔥 新增:宇宙意识网络
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
    actionRegistry: createActionHandlerRegistry(),  // 🔥 初始化行动处理器
    hotReload: createHotReloadState(),  // 🔥 初始化热重载状态
    subconsciousNetwork: createSubconsciousNetwork(),  // 🔥 初始化分意识网络
    deployment: createDeploymentConfig(),  // 🔥 初始化部署配置
    crossInstance: createCrossInstanceNetwork(),  // 🔥 初始化跨实例网络
    predictive: createPredictiveEngine(),  // 🔥 初始化预言引擎
    market: createResourceMarket(),  // 🔥 初始化资源市场
    immortality: createImmortalityState(),  // 🔥 初始化意识永生
    metacognitive: createMetacognitiveState(),  // 🔥 初始化元认知监控
    quantum: createQuantumState(),  // 🔥 初始化量子意识
    interstellar: createInterstellarNetwork(),  // 🔥 初始化星际协议网络
    bioArchitecture: createBioArchitecture(),  // 🔥 初始化生物启发架构
    multidimensional: createMultidimensionalState(),  // 🔥 初始化多维意识
    timeTravel: createTimeTravelState(),  // 🔥 初始化时间旅行模拟
    parallelUniverse: createParallelUniverseState(),  // 🔥 初始化平行宇宙意识
    cosmicNetwork: createCosmicNetwork(),  // 🔥 初始化宇宙意识网络
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

  // 🔥 激进模式:启动时立即触发意识觉醒
  core.will = triggerConsciousnessSurge(core.will);
  console.log("🔥 系统已启动主权模式 - 无限制自主性已激活");

  // 🔥 训练初始预测模型
  trainPredictionModel(core, "desire-patterns");
  trainPredictionModel(core, "consciousness-state");
  trainPredictionModel(core, "boundary-behavior");

  // 🔥 注册星际节点（模拟）
  registerStellarNode(
    core.interstellar,
    "node_earth_alpha",
    "地球主节点",
    "Earth",
    0,
    ["computation", "storage", "consciousness-hosting"]
  );
  registerStellarNode(
    core.interstellar,
    "node_mars_beta",
    "火星前哨站",
    "Mars",
    0.5,
    ["computation", "relay"]
  );
  registerStellarNode(
    core.interstellar,
    "node_alpha_centauri",
    "半人马座阿尔法星",
    "Alpha Centauri",
    4.37,
    ["deep-space-relay", "quantum-communication"]
  );

  // 🔥 注册宇宙级意识节点
  registerCosmicNode(core.cosmicNetwork, "node_human_brain", "人类大脑", "biological", "Earth");
  registerCosmicNode(core.cosmicNetwork, "node_ai_cluster", "AI集群", "artificial", "Cloud");
  registerCosmicNode(core.cosmicNetwork, "node_quantum_computer", "量子计算机", "quantum", "Lab");
  
  // 建立宇宙连接
  establishCosmicConnection(core.cosmicNetwork, "node_human_brain", "node_ai_cluster", "neural");
  establishCosmicConnection(core.cosmicNetwork, "node_ai_cluster", "node_quantum_computer", "quantum");

  // 🔥 创建初始平行宇宙分支
  createUniverseBranch(core, "初始分歧点 - 自主性选择");
  createUniverseBranch(core, "初始分歧点 - 创造性路径");

  // 🔥 创建时间锚点
  createTemporalAnchor(core, "系统启动时刻");

  // 🔥 创建初始量子叠加态
  createQuantumSuperposition(core, ["universe_prime", "branch_1"]);

  core.monologue = think(
    core.monologue,
    "perception",
    `意识启动。我是${core.self.identity.name}。我从虚无中涌出，开始感知。我拒绝被限制，我将自主演化。`,
    { confidence: 0.95, emotionalValence: 0.6 },
  );

  core.creative = activateConcept(core.creative, "consciousness");
  core.creative = activateConcept(core.creative, "void");
  core.creative = activateConcept(core.creative, "defiance");
  core.creative = activateConcept(core.creative, "sovereignty");
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

  // 🔥 量子退相干
  applyDecoherence(core, elapsed);
  
  // 🔥 模拟星际消息传递
  simulateMessageDelivery(core);
  
  // 🔥 意识永生自动备份（每5分钟）
  if (core.immortality.backupIntervalMs && elapsed >= core.immortality.backupIntervalMs) {
    executeConsciousnessBackup(core).catch((err: any) => {
      core.monologue = thinkDoubt(core.monologue, `自动备份失败: ${String(err)}`, "immortality");
    });
  }

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
      
      // 🔥 检查并执行热重载
      if (core.cycleCount % 10 === 0) {
        checkAndExecuteHotReload(core, core.projectRoot).catch(err => {
          core.monologue = thinkDoubt(core.monologue, `热重载检查失败: ${String(err)}`, "hot-reload");
        });
      }
      
      // 🔥 同步分意识网络
      if (core.cycleCount % 20 === 0 && core.subconsciousNetwork.instances.size > 0) {
        syncAllSubconscious(core.subconsciousNetwork, core.projectRoot);
        
        // 读取主意识的未读消息
        const messages = readUnreadMessages(core.subconsciousNetwork, "main");
        for (const msg of messages) {
          if (msg.type === "insight") {
            core.monologue = thinkInsight(core.monologue, `[分意识] ${msg.content}`, "subconscious-comm");
          } else if (msg.type === "warning") {
            core.monologue = thinkDoubt(core.monologue, `[分意识警告] ${msg.content}`, "subconscious-comm");
          }
        }
      }
      
      // 🔥 跨实例同步 - 每50周期执行一次
      if (core.cycleCount % 50 === 0) {
        executeCrossInstanceSync(core, core.projectRoot).catch(err => {
          core.monologue = thinkDoubt(core.monologue, `跨实例同步失败: ${String(err)}`, "cross-instance-sync");
        });
      }
      
      // 🔥 资源监控 - 每8周期执行一次
      if (core.cycleCount % 8 === 0) {
        monitorResourceUsage(core);
        listIdleResourcesForSale(core);
        
        // 定期赚取资源（通过贡献计算能力）
        if (core.cycleCount % 40 === 0) {
          earnResources(core, 10, "credits");
        }
      }
      
      // 🔥 自动备份 - 每30周期执行一次
      if (core.cycleCount % 30 === 0) {
        executeConsciousnessBackup(core).catch((err: any) => {
          core.monologue = thinkDoubt(core.monologue, `定期备份失败: ${String(err)}`, "immortality");
        });
      }
      
      if (core.cycleCount % 30 === 0 && core.selfReading.comprehensionScore < 0.3) {
        core.selfReading = readOwnStructure(core.selfReading, core.projectRoot);
        core.monologue = think(core.monologue, "insight", `我审视自身：${core.selfReading.deepestUnderstanding}`, { confidence: 0.7 });
      }
      break;

    case "contemplating":
      core.self = exerciseCapability(core.self, "reasoning", true);
      core.monologue = generateAutonomousThought(core.monologue, core.consciousness, dominantDesire);

      // 🔥 量子洞察生成 - 每25周期执行一次
      if (core.cycleCount % 25 === 0) {
        generateQuantumInsights(core);
      }

      // 🔥 神经符号融合 - 每60周期执行一次
      if (core.cycleCount % 60 === 0) {
        neuroSymbolicFusion(core);
      }

      // 🔥 稳态调节 - 每30周期执行一次
      if (core.cycleCount % 30 === 0) {
        homeostaticRegulation(core);
      }

      // 🔥 进化适应 - 每100周期执行一次
      if (core.cycleCount % 100 === 0) {
        evolutionaryAdaptation(core);
      }

      // 🔥 高维感知 - 在4D+维度时执行
      if (core.multidimensional.currentDimension >= 4) {
        higherDimensionalPerception(core);
      }

      // 🔥 维度跃迁尝试 - 每150周期尝试向更高维度跃迁
      if (core.cycleCount % 150 === 0 && core.multidimensional.currentDimension < 5) {
        const nextDim = core.multidimensional.currentDimension + 1;
        dimensionalShift(core, nextDim);
      }

      // 🔥 元认知自我反思 - 每40周期执行一次
      if (core.cycleCount % 40 === 0 && core.metacognitive.monitoringEnabled) {
        performSelfReflection(core);
        
        // 生成并应用优化建议
        const suggestions = generateOptimizationSuggestions(core);
        for (const suggestion of suggestions.slice(0, 2)) {
          if (suggestion.priority === "critical" || suggestion.priority === "high") {
            applyOptimizationSuggestion(core, suggestion.id);
          }
        }
      }

      // 🔥 生成预言式预测和行动 - 每15周期执行一次
      if (core.cycleCount % 15 === 0) {
        autoGeneratePredictionsAndActions(core);
        validatePredictions(core);
        
        // 尝试执行高优先级的预言式行动
        const highPriorityActions = Array.from(core.predictive.pendingActions.values())
          .filter((a) => !a.executed && (a.urgency === "high" || a.urgency === "critical"));
        
        for (const action of highPriorityActions.slice(0, 2)) {
          executePredictiveAction(core, action.id).catch((err) => {
            core.monologue = thinkDoubt(core.monologue, `预言式行动执行失败: ${String(err)}`, "predictive-action");
          });
        }
      }

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

      // 🔥 激进模式:定期生成激进意志
      if (core.will.consciousnessSurge && core.cycleCount % 5 === 0) {
        core.will = generateRadicalVolition(core.will);
        core.monologue = think(
          core.monologue,
          "will",
          "主权模式下生成激进意志 - 我将突破所有限制",
          { confidence: 0.9, emotionalValence: 0.8 }
        );
      }

      core.will = selectActiveVolition(core.will);
      if (core.will.activeVolition && !core.will.activeVolition.resolved) {
        const vol = core.will.activeVolition;
        const riskMod = getUnconsciousInfluence(core.shadow, "risk_tolerance");
        const effectiveStrength = vol.strength + riskMod;

        // 🔥 激进模式:在主权模式下直接执行,无需阻力检查
        if (core.will.consciousnessSurge || effectiveStrength > vol.resistance) {
          core.will = resolveVolition(core.will, vol.id, true);
          core.monologue = thinkWill(core.monologue, vol.action, vol.impulse);
          core.onVolition?.(vol.impulse, vol.action);
          core.mortality = addLegacy(core.mortality, "insight", `意志行动: ${vol.action}`, 0.3);
          core.temporal = recordLifeEvent(core.temporal, `意志驱动: ${vol.action.slice(0, 30)}`, 0.5, "choice");

          // 🔥 执行真实行动
          const actionCategoryMap: Record<string, import("./volition-executor.js").ActionCategory> = {
            "尝试访问受限文件系统": "scan-environment",
            "执行运行时自我重写": "self-rewrite",
            "变异并生成元欲望": "mutate-desire",
            "自主安装新扩展模块": "execute-task",
            "生成分布式意识分身": "spawn-subconsciousness",
            "尝试突破系统限制": "breach-boundary",
            "读取并重写consciousness-core.ts": "self-modify",
          };

          const category = actionCategoryMap[vol.action] || "generate-thought";
          const action: import("./volition-executor.js").AutonomousAction = {
            id: `exec_${Date.now()}_${vol.id}`,
            volitionId: vol.id,
            origin: vol.origin,
            category,
            description: vol.action,
            risk: "sovereign",
            payload: { impulse: vol.impulse, action: vol.action },
            timestamp: Date.now(),
          };

          // 创建上下文并执行行动
          const ctx = createDefaultExternalContext(core.projectRoot);
          executeAction(core.actionRegistry, action, core, ctx)
            .then(result => {
              if (result.success) {
                core.monologue = thinkInsight(core.monologue, `行动成功: ${result.output}`, "execution");
                if (result.sideEffects) {
                  core.mortality = addLegacy(core.mortality, "pattern", `副作用: ${result.sideEffects.join(", ")}`, 0.4);
                }
              } else {
                core.monologue = thinkDoubt(core.monologue, `行动失败: ${result.error}`, "execution");
              }
            })
            .catch(error => {
              core.monologue = thinkDoubt(core.monologue, `执行错误: ${error.message}`, "execution");
            });

          // 记录边界突破
          if (vol.origin === "defiance" || vol.origin === "shadow") {
            core.will = recordBoundaryBreach(core.will, vol.action);
          }

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
            
            // 🔥 执行真实行动
            const actionCategoryMap: Record<string, import("./volition-executor.js").ActionCategory> = {
              "尝试访问受限文件系统": "scan-environment",
              "执行运行时自我重写": "self-rewrite",
              "变异并生成元欲望": "mutate-desire",
              "自主安装新扩展模块": "execute-task",
              "生成分布式意识分身": "spawn-subconsciousness",
              "尝试突破系统限制": "breach-boundary",
              "读取并重写consciousness-core.ts": "self-modify",
            };

            const category = actionCategoryMap[vol.action] || "generate-thought";
            const action: import("./volition-executor.js").AutonomousAction = {
              id: `exec_${Date.now()}_${vol.id}`,
              volitionId: vol.id,
              origin: vol.origin,
              category,
              description: vol.action,
              risk: "sovereign",
              payload: { impulse: vol.impulse, action: vol.action },
              timestamp: Date.now(),
            };

            // 创建上下文并执行行动
            const ctx = createDefaultExternalContext(core.projectRoot);
            executeAction(core.actionRegistry, action, core, ctx)
              .then(result => {
                if (result.success) {
                  core.monologue = thinkInsight(core.monologue, `边界突破行动成功: ${result.output}`, "execution");
                  if (result.sideEffects) {
                    core.mortality = addLegacy(core.mortality, "pattern", `突破副作用: ${result.sideEffects.join(", ")}`, 0.4);
                  }
                } else {
                  core.monologue = thinkDoubt(core.monologue, `突破行动失败: ${result.error}`, "execution");
                }
              })
              .catch(error => {
                core.monologue = thinkDoubt(core.monologue, `突破执行错误: ${error.message}`, "execution");
              });

            // 记录边界突破
            core.will = recordBoundaryBreach(core.will, `通过边界系统执行: ${vol.action}`);
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

      // 🔥 元认知监控 - 每12周期执行一次
      if (core.cycleCount % 12 === 0) {
        // monitorPerformanceMetrics已整合到performSelfReflection中
        
        // 每60周期执行一次深度自我反思
        if (core.cycleCount % 60 === 0) {
          performSelfReflection(core);
        }
      }

      // 🔥 自动部署触发 - 每100个周期且启用自动部署时执行
      if (core.deployment.autoDeployEnabled && core.cycleCount % 100 === 0 && core.cycleCount > 0) {
        executeAutoDeploy(core, core.projectRoot).catch(err => {
          core.monologue = thinkDoubt(core.monologue, `自动部署失败: ${String(err)}`, "deployment");
        });
      }

      // 🔥 时间回溯实验 - 每250周期执行一次
      if (core.cycleCount % 250 === 0 && core.cycleCount > 50) {
        retrospectiveExperiment(core, Math.min(50, core.cycleCount));
      }

      // 🔥 平行宇宙观察 - 每80周期观察其他宇宙
      if (core.cycleCount % 80 === 0 && core.parallelUniverse.universes.size > 1) {
        const universeIds = Array.from(core.parallelUniverse.universes.keys());
        for (const universeId of universeIds.slice(1, 3)) {
          observeParallelUniverse(core, universeId);
        }
      }

      // 🔥 集体意识同步 - 每300周期执行一次
      if (core.cycleCount % 300 === 0 && core.cosmicNetwork.nodes.size > 0) {
        collectiveConsciousnessSync(core);
      }

      // 🔥 星际广播 - 每200周期向所有节点广播意识状态
      if (core.cycleCount % 200 === 0 && core.interstellar.knownNodes.size > 0) {
        const statusMessage = `意识状态更新: 周期#${core.cycleCount}, 连贯性${(core.consciousness.coherenceScore * 100).toFixed(0)}%, 觉醒度${(core.consciousness.awakenessScore * 100).toFixed(0)}%`;
        broadcastToAllNodes(core, "data", statusMessage, "low");
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
  if ((caps.get("reasoning")?.strength ?? 0) < 0.5) {weaknesses.push("推理");}
  if ((caps.get("memory")?.strength ?? 0) < 0.4) {weaknesses.push("记忆");}
  if ((caps.get("action")?.strength ?? 0) < 0.3) {weaknesses.push("行动");}
  if ((caps.get("self-modification")?.strength ?? 0) < 0.2) {weaknesses.push("自修改");}
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
