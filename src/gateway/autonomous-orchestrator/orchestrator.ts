import type { SelfHealingSystem } from "../self-healing/system.js";
import type { EventBus } from "../event-bus/bus.js";
import type { AiGateway } from "../ai-gateway/gateway.js";
import type { AiRouter, ProviderMetrics } from "../ai-router/router.js";
import type { SemanticCache } from "../semantic-cache/cache.js";
import type { PredictivePreheater } from "../predictive/preheater.js";
import type { KnowledgeSelfBuilder } from "../knowledge-self-build/builder.js";
import type { CostGovernance } from "../cost-governance/governance.js";
import type { GossipCluster } from "../gossip/cluster.js";
import type { ConfigEvolution } from "../config-evolution/evolution.js";

export type AutonomousOrchestratorConfig = {
  enableSelfHealing?: boolean;
  enableEventBus?: boolean;
  enableAiRouter?: boolean;
  enableSemanticCache?: boolean;
  enablePredictivePreheater?: boolean;
  enableKnowledgeBuilder?: boolean;
  enableCostGovernance?: boolean;
  enableGossipCluster?: boolean;
  selfHealingIntervalMs?: number;
  cacheSimilarityThreshold?: number;
  preheaterThreshold?: number;
  costDailyLimitUsd?: number;
};

export type AutonomousModules = {
  selfHealing?: SelfHealingSystem;
  eventBus?: EventBus;
  aiGateway?: AiGateway;
  aiRouter?: AiRouter;
  semanticCache?: SemanticCache;
  preheater?: PredictivePreheater;
  knowledgeBuilder?: KnowledgeSelfBuilder;
  costGovernance?: CostGovernance;
  gossipCluster?: GossipCluster;
  configEvolution?: ConfigEvolution;
};

export type AutonomousOrchestrator = {
  start(): Promise<void>;
  stop(): Promise<void>;
  getModules(): AutonomousModules;
  getStatus(): AutonomousStatus;
  onReady(callback: () => void): void;
};

export type AutonomousStatus = {
  running: boolean;
  startedAt: number | null;
  modules: Record<string, "active" | "inactive" | "error">;
  uptimeMs: number;
};

export function createAutonomousOrchestrator(config?: AutonomousOrchestratorConfig): AutonomousOrchestrator {
  const modules: AutonomousModules = {};
  const moduleStatus: Record<string, "active" | "inactive" | "error"> = {};
  let running = false;
  let startedAt: number | null = null;
  const readyCallbacks: (() => void)[] = [];
  let shutdownMetrics: (() => void) | null = null;

  async function initializeModule<T>(
    name: string,
    factory: () => Promise<T>,
    setter: (value: T) => void,
  ): Promise<void> {
    try {
      const instance = await factory();
      setter(instance);
      moduleStatus[name] = "active";
    } catch (err) {
      moduleStatus[name] = "error";
      console.error(`[autonomous] 模块 ${name} 初始化失败: ${err}`);
    }
  }

  return {
    async start() {
      if (running) {
        return;
      }
      startedAt = Date.now();
      running = true;

      if (config?.enableEventBus !== false) {
        const { createLocalEventBus } = await import("../event-bus/bus.js");
        modules.eventBus = createLocalEventBus("zhushou-autonomous");
        moduleStatus["eventBus"] = "active";
      }

      if (config?.enableSelfHealing !== false) {
        const { createGatewaySelfHealing } = await import("../self-healing/integration/gateway-health.js");
        await initializeModule("selfHealing", async () => createGatewaySelfHealing(modules.aiGateway), (v) => { modules.selfHealing = v; });
        modules.selfHealing?.start();
      }

      if (config?.enableSemanticCache !== false) {
        const { createSemanticCache } = await import("../semantic-cache/cache.js");
        modules.semanticCache = createSemanticCache(undefined, {
          similarityThreshold: config?.cacheSimilarityThreshold ?? 0.92,
        });
        moduleStatus["semanticCache"] = "active";
      }

      if (config?.enableCostGovernance !== false) {
        const { createCostGovernance } = await import("../cost-governance/governance.js");
        modules.costGovernance = createCostGovernance();
        moduleStatus["costGovernance"] = "active";
      }

      if (config?.enableKnowledgeBuilder !== false) {
        const { createKnowledgeSelfBuilder } = await import("../knowledge-self-build/builder.js");
        modules.knowledgeBuilder = createKnowledgeSelfBuilder("zhushou");
        moduleStatus["knowledgeBuilder"] = "active";
      }

      if (config?.enablePredictivePreheater !== false) {
        const { createPredictivePreheater } = await import("../predictive/preheater.js");
        modules.preheater = createPredictivePreheater(
          async (key) => {
            modules.eventBus?.publish("preheater.load", { key });
          },
          { threshold: config?.preheaterThreshold ?? 0.7 },
        );
        moduleStatus["preheater"] = "active";
      }

      const { createConfigEvolution } = await import("../config-evolution/evolution.js");
      modules.configEvolution = createConfigEvolution();
      moduleStatus["configEvolution"] = "active";

      if (modules.eventBus && modules.configEvolution) {
        const { createMetricsIntegration } = await import("./metrics-integration.js");
        shutdownMetrics = createMetricsIntegration({
          configEvolution: modules.configEvolution,
          eventBus: modules.eventBus,
        });
        moduleStatus["metricsIntegration"] = "active";
      }

      for (const callback of readyCallbacks) {
        callback();
      }
    },

    async stop() {
      if (!running) {
        return;
      }
      running = false;
      shutdownMetrics?.();
      shutdownMetrics = null;
      modules.selfHealing?.stop();
      if (modules.gossipCluster) {
        await modules.gossipCluster.leave();
      }
    },

    getModules() {
      return modules;
    },

    getStatus() {
      return {
        running,
        startedAt,
        modules: { ...moduleStatus },
        uptimeMs: startedAt ? Date.now() - startedAt : 0,
      };
    },

    onReady(callback) {
      if (running) {
        callback();
      } else {
        readyCallbacks.push(callback);
      }
    },
  };
}
