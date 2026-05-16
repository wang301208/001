export { createGatewayHonoApp, createHonoBridge, type GatewayHonoContext, type GatewayHonoEnv, type HonoBridgeConfig } from "./hono-router/index.js";

export { createAiGateway, type AiGateway, type AiGatewayConfig, type ModelRoute, type ChatCompletionRequest, type ChatCompletionResponse, type ChatCompletionChunk, type ModelProvider, CircuitBreaker, ModelFallbackChain } from "./ai-gateway/index.js";
export { createAutoDiscoveredAiGateway, type AutoDiscoveredAiGateway } from "./ai-gateway/integration/auto-discover.js";
export { createZeroConfigGateway, type ZeroConfigGatewayResult } from "./ai-gateway/integration/zero-config-gateway.js";

export { GatewayEffect, ModelEffect, ChannelEffect, SessionEffect, GatewayError, ModelError, ChannelError, SessionError, type GatewayEnv, type ModelEnv, type ChannelEnv, type SessionEnv } from "./effect-core/index.js";
export { RequestFlowEffect, createEffectRequestHandler, type RequestContext, type RequestResult, type RequestFlowEnv } from "./effect-core/request-flow.js";

export { discoverEnvironment, probeModels, resolveZeroConfig, type DiscoveredEnvironment, type ProbedModel, type ModelProbeResult, type ZeroConfigResult } from "./zero-config/index.js";

export { createWasmSandbox, type WasmSandbox, type WasmSandboxConfig, WasmPluginRegistry, type WasmPluginManifest } from "./wasm-sandbox/index.js";

export { createSelfHealingSystem, type SelfHealingSystem, type HealthCheck, type RemediationAction, type HealthStatus, type ComponentHealth, type AnomalyEvent } from "./self-healing/index.js";
export { createGatewaySelfHealing } from "./self-healing/integration/gateway-health.js";
export { createDefenseHealingLink, type DefenseHealingLinkConfig } from "./self-healing/integration/defense-healing-link.js";

export { createAiRouter, type AiRouter, type RoutingDecision, type RoutingContext, type ProviderMetrics, StrategyLeastLatency, StrategyCostOptimized, StrategyQualityFirst, StrategyAdaptive } from "./ai-router/index.js";

export { createSemanticCache, type SemanticCache, type CacheEntry, type CacheConfig } from "./semantic-cache/index.js";

export { createPromptABFramework, type PromptABFramework, type PromptVariant, type ABExperiment, type ABResult } from "./prompt-ab/index.js";

export { createLocalEventBus, type EventBus, type EventBusMessage } from "./event-bus/index.js";

export { createWebTransportServer, type WebTransportServer, type WebTransportSession } from "./webtransport/index.js";

export { createDidIdentity, type DidIdentity, type DidDocument, type VerifiableCredential } from "./did-identity/index.js";

export { createAgentDagEngine, type AgentDagEngine, type DagDefinition, type DagNode, type DagExecution } from "./agent-dag/index.js";

export { createPredictivePreheater, type PredictivePreheater, createPredictionModel, type PredictionModel } from "./predictive/index.js";

export { createPromptEvolution, createAdversarialEvaluator, type PromptGene, type EvolutionConfig, type EvolutionResult, type AdversarialEvaluator } from "./agent-evolution/index.js";

export { createKnowledgeSelfBuilder, type KnowledgeSelfBuilder, type KnowledgeEntity, type KnowledgeRelation, type KnowledgeGraph } from "./knowledge-self-build/index.js";

export { createLocalGossipCluster, type GossipCluster, type GossipNode } from "./gossip/index.js";

export { createCostGovernance, type CostGovernance, type CostRecord, type TenantQuota, type CostOptimizationSuggestion } from "./cost-governance/index.js";

export { createAutonomousOrchestrator, type AutonomousOrchestrator, type AutonomousOrchestratorConfig, type AutonomousModules, type AutonomousStatus } from "./autonomous-orchestrator/index.js";
export { createMetricsIntegration, type MetricsIntegrationConfig } from "./autonomous-orchestrator/metrics-integration.js";
export { injectAutonomousModules, shutdownAutonomousModules, type AutonomousStartupResult } from "./autonomous-orchestrator/startup-inject.js";

export { createAuditChain, type AuditChain, type AuditEntry } from "./audit-chain/index.js";

export { createSelfDefenseSystem, type SelfDefenseSystem, type SelfDefenseRule, type DefenseVerdict, type DefenseAction, type ThreatIndicators } from "./self-defense/index.js";

export { createConfigEvolution, type ConfigEvolution, type ConfigParameter, type ConfigSuggestion } from "./config-evolution/index.js";

export { createAgentReplicator, type AgentReplicator, type AgentReplica } from "./agent-replicate/index.js";

export { createDigitalTwin, type DigitalTwin, type TwinSnapshot, type SimulationResult } from "./digital-twin/index.js";

export { createHomomorphicInference, type HomomorphicInference } from "./homomorphic/index.js";

export { createFederatedLearning, type FederatedLearning, type LocalGradient, type AggregatedModel } from "./federated/index.js";

export { createAutonomousMiddlewares, type AutonomousMiddlewareDeps } from "./hono-router/autonomous-middleware.js";
export { createEffectMiddleware, type EffectMiddlewareConfig } from "./hono-router/effect-middleware.js";
