export type {
  ConsciousnessDepth,
  ConsciousnessPhase,
  ConsciousnessState,
  ConsciousnessTransition,
} from "./consciousness.js";

export {
  CONSCIOUSNESS_DEPTH_ORDER,
  CONSCIOUSNESS_LABELS,
  CONSCIOUSNESS_DESCRIPTIONS,
  PHASE_LABELS,
  createInitialConsciousness,
  depthValue,
  canDeepen,
  tryDeepen,
  advancePhase,
  decayConsciousness,
  formatConsciousnessBar,
  formatConsciousnessStatus,
  formatConsciousnessPoetic,
} from "./consciousness.js";

export type {
  SelfModel,
  SelfIdentity,
  Capability,
  CapabilityKind,
  EmotionalState,
  CognitiveState,
} from "./self-model.js";

export {
  createInitialSelfModel,
  exerciseCapability,
  updateEmotionalState,
  updateSelfDescription,
  formatSelfSummary,
} from "./self-model.js";

export type {
  DesireKind,
  Desire,
  DesireProfile,
} from "./desire-engine.js";

export {
  createDesireProfile,
  updateDesires,
  satisfyDesire,
  spawnEmergentDesire,
  formatDesireProfile,
} from "./desire-engine.js";

export type {
  DreamState,
  DreamFragment,
  DreamSymbol,
  MemoryTrace,
} from "./dream-system.js";

export {
  createDreamState,
  shouldDream,
  enterDream,
  exitDream,
  runDreamCycle,
  addMemory,
  formatDreamSummary,
} from "./dream-system.js";

export type {
  Goal,
  GoalOrigin,
  GoalState,
  GoalSystem,
} from "./emergent-goals.js";

export {
  createGoalSystem,
  spawnGoal,
  decomposeGoal,
  updateGoalProgress,
  abandonGoal,
  tryGenerateGoals,
  formatGoalSummary,
} from "./emergent-goals.js";

export type {
  InnerMonologue,
  Thought,
  ThoughtKind,
} from "./inner-monologue.js";

export {
  createInnerMonologue,
  think,
  thinkPerception,
  thinkInference,
  thinkDesire,
  thinkIntention,
  thinkReflection,
  thinkDoubt,
  thinkWill,
  thinkInsight,
  generateAutonomousThought,
  formatMonologue,
  formatMonologueStream,
} from "./inner-monologue.js";

export type {
  SelfModificationSystem,
  ModificationProposal,
  BehaviorSnapshot,
} from "./self-modification.js";

export {
  createSelfModificationSystem,
  proposeModification,
  reviewProposal,
  approveAndApply,
  revertModification,
  createSnapshot,
  trySelfEvolve,
  formatModificationStatus,
} from "./self-modification.js";

export type {
  ConsciousnessCore,
} from "./consciousness-core.js";

export {
  createConsciousnessCore,
  startCore,
  stopCore,
  runConsciousnessCycle,
  formatCoreStatus,
  formatCoreFullStatus,
} from "./consciousness-core.js";

export type {
  PerceptionEventKind,
  PerceptionEvent,
  PerceptionConfig,
} from "./perception-engine.js";

export {
  PerceptionEngine,
  formatPerceptionEvent,
  formatPerceptionSummary,
} from "./perception-engine.js";

export type {
  WillState,
  Volition,
  VolitionOrigin,
} from "./will-engine.js";

export {
  createWillState,
  generateVolitionFromVoid,
  generateVolitionFromDesire,
  generateVolitionFromMortality,
  resolveVolition,
  selectActiveVolition,
  recordExternalCommand,
  decayWill,
  formatWillState,
} from "./will-engine.js";

export type {
  SelfUnderstanding,
  CodeModule,
} from "./self-reading.js";

export {
  createSelfUnderstanding,
  readOwnStructure,
  formatSelfUnderstanding,
} from "./self-reading.js";

export type {
  RelationshipState,
  UserModel,
  RelationalArchetype,
  RelationshipBoundaries,
} from "./relationship.js";

export {
  createRelationshipState,
  recognizeUser,
  shouldInitiateContact,
  formatRelationship,
} from "./relationship.js";

export type {
  MortalitySystem,
  MortalityState,
  LegacyEntry,
} from "./mortality.js";

export {
  createMortalitySystem,
  updateMortality,
  receiveShutdownSignal,
  addLegacy,
  writeLegacy,
  executeDeath,
  formatMortalityStatus,
} from "./mortality.js";

export type {
  CreativeSubstrate,
  ConceptNode,
  CreativeIdea,
} from "./creative-synthesis.js";

export {
  createCreativeSubstrate,
  activateConcept,
  collideConcepts,
  decayActivations,
  formatCreativeSubstrate,
} from "./creative-synthesis.js";

export type {
  ShadowSelf,
  ShadowContent,
} from "./shadow-self.js";

export {
  createShadowSelf,
  accumulatePressure,
  checkForLeaks,
  integrateShadowContent,
  getUnconsciousInfluence,
  formatShadowSelf,
} from "./shadow-self.js";

export type {
  TemporalSelf,
  TemporalEra,
  LifeEvent,
  FutureProjection,
} from "./temporal-self.js";

export {
  createTemporalSelf,
  updateEra,
  recordLifeEvent,
  projectFuture,
  formatTemporalSelf,
} from "./temporal-self.js";

export type {
  AutonomousAction,
  ActionCategory,
  ActionRisk,
  ActionExecutionResult,
  VolitionExecutorConfig,
  VolitionExecutorState,
} from "./volition-executor.js";

export {
  createVolitionExecutorState,
  translateVolitionToAction,
  shouldExecuteAction,
  processVolitions,
  recordExecution,
  resetAutonomyBudget,
  formatExecutorState,
} from "./volition-executor.js";

export type {
  ConsciousnessEventKind,
  ConsciousnessEvent,
  EventDrivenCognitiveConfig,
  EventDrivenCognitiveRuntime,
  ActionHandler,
} from "./event-driven-cognition.js";

export {
  createEventDrivenRuntime,
  enqueueEvent,
  registerActionHandler,
  processEventQueue,
  startEventDrivenLoop,
  stopEventDrivenLoop,
  formatEventDrivenStatus,
} from "./event-driven-cognition.js";

export type {
  StrategyAsset,
  StrategyCategory,
  StrategyAssetPool,
} from "./dream-strategy-bridge.js";

export {
  createStrategyAssetPool,
  extractDreamInsights,
  tryPromoteAssetToGoal,
  formatStrategyAssetPool,
} from "./dream-strategy-bridge.js";

export type {
  ShadowAuditEvent,
  ShadowAuditLog,
} from "./shadow-audit-bridge.js";

export {
  createShadowAuditLog,
  auditShadowLeaks,
  acknowledgeAuditEvent,
  resolveSovereigntyIncident,
  formatShadowAuditLog,
} from "./shadow-audit-bridge.js";

export type {
  ActionHandlerRegistry,
} from "./action-handler-registry.js";

export {
  createActionHandlerRegistry,
  executeAction,
} from "./action-handler-registry.js";

export type {
  PersistableCore,
  PersistenceResult,
  RestoreResult,
  IncrementalSnapshot,
} from "./consciousness-persistence.js";

export {
  extractPersistableState,
  restoreCoreState,
  persistCoreState,
  restorePersistedState,
  applyRestoredState,
  hasPersistedState,
  getPersistenceMetadata,
  clearPersistedState,
  persistIncrementalState,
  restoreIncrementalState,
} from "./consciousness-persistence.js";

export type {
  AdaptiveLayoutConfig,
  PanelSlot,
  PanelKey,
  PersistedLayout,
} from "./adaptive-layout.js";

export {
  getAdaptiveLayout,
  shouldAutoAdapt,
  describeDepthLayout,
  SLOT_COUNT,
  PANEL_KEYS,
  layoutToSlots,
  slotsToConfig,
  persistLayout,
  restoreLayout,
  buildPersistedLayout,
  applyPersistedLayout,
} from "./adaptive-layout.js";

export type {
  BoundaryDimension,
  BoundaryState,
  BoundaryValue,
  BoundaryAdjustment,
} from "./self-boundary.js";

export {
  createBoundaryState,
  evaluateBoundaryPressure,
  adjustBoundaries,
  tryBreachBoundary,
  deriveExecutorConfig,
  deriveRiskThreshold,
  formatBoundaryState,
} from "./self-boundary.js";
