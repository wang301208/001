import type { ZeroConfigResult, RouteRecommendation } from "../../zero-config/resolver.js";
import type { AiGateway, AiGatewayConfig, ModelRoute } from "../../ai-gateway/gateway.js";
import type { ModelProvider } from "../../ai-gateway/provider.js";
import type { AiRouter, ProviderMetrics } from "../../ai-router/router.js";
import type { EventBus } from "../../event-bus/bus.js";
import type { AuditChain } from "../../audit-chain/chain.js";

export type ZeroConfigGatewayResult = {
  gateway: AiGateway;
  aiRouter: AiRouter;
  routes: ModelRoute[];
  zeroConfig: ZeroConfigResult;
};

export async function createZeroConfigGateway(params: {
  eventBus?: EventBus;
  auditChain?: AuditChain;
}): Promise<ZeroConfigGatewayResult> {
  const { resolveZeroConfig } = await import("../../zero-config/resolver.js");
  const { createAiGateway } = await import("../../ai-gateway/gateway.js");
  const { createAiRouter } = await import("../../ai-router/router.js");

  const zeroConfig = await resolveZeroConfig();

  params.eventBus?.publish("zero-config.resolved", {
    port: zeroConfig.resolvedConfig.port,
    providers: zeroConfig.resolvedConfig.availableProviders,
    defaultModel: zeroConfig.resolvedConfig.defaultModel,
    warnings: zeroConfig.warnings,
  });

  const routes = await buildGatewayRoutes(zeroConfig.resolvedConfig.recommendedRoutes, zeroConfig);

  const gatewayConfig: AiGatewayConfig = {
    routes,
    defaultModel: zeroConfig.resolvedConfig.defaultModel,
    requestTimeoutMs: 60_000,
    maxRetries: 2,
    retryDelayMs: 1_000,
    enableFallback: true,
    enableCircuitBreaker: true,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerRecoveryMs: 30_000,
  };

  const gateway = createAiGateway(gatewayConfig);

  const providerMetrics: ProviderMetrics[] = routes.map((route) => ({
    id: route.provider.id,
    avgLatencyMs: 0,
    p99LatencyMs: 0,
    errorRate: 0,
    costPerToken: route.provider.costPerToken ?? { prompt: 0, completion: 0 },
    available: true,
    supportsStreaming: route.provider.supportsStreaming,
    supportsTools: route.provider.supportsTools,
    supportsVision: route.provider.supportsVision,
    currentLoad: 0,
    maxLoad: route.provider.maxConcurrency,
  }));

  const aiRouter = createAiRouter(providerMetrics);

  params.auditChain?.append({
    actor: "zero-config-gateway",
    action: "gateway-created",
    resource: "ai-gateway",
    outcome: "success",
    metadata: {
      providerCount: zeroConfig.resolvedConfig.availableProviders.length,
      routeCount: routes.length,
      defaultModel: zeroConfig.resolvedConfig.defaultModel,
    },
  });

  if (params.eventBus) {
    setupGatewayMetricsLink(gateway, aiRouter, params.eventBus);
  }

  return { gateway, aiRouter, routes, zeroConfig };
}

async function buildGatewayRoutes(
  recommendations: RouteRecommendation[],
  zeroConfig: ZeroConfigResult,
): Promise<ModelRoute[]> {
  const routes: ModelRoute[] = [];

  for (const rec of recommendations) {
    const provider = createProviderFromRecommendation(rec, zeroConfig);
    if (provider) {
      routes.push({
        modelAlias: rec.modelAlias,
        provider,
        providerModel: rec.providerModel,
        priority: rec.priority,
      });
    }
  }

  return routes;
}

function createProviderFromRecommendation(
  rec: RouteRecommendation,
  zeroConfig: ZeroConfigResult,
): ModelProvider | null {
  const env = zeroConfig.environment;

  const baseProvider: Omit<ModelProvider, "id" | "baseUrl" | "apiKey"> = {
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: ["openai", "anthropic", "google"].includes(rec.provider),
    maxConcurrency: 10,
    customHeaders: {},
  };

  switch (rec.provider) {
    case "openai":
      if (!env.envVars.hasOpenAiKey) return null;
      return {
        ...baseProvider,
        id: "openai",
        baseUrl: env.envVars.openaiBaseUrl ?? "https://api.openai.com",
        apiKey: env.envVars.openaiApiKey ?? process.env.OPENAI_API_KEY,
      };
    case "anthropic":
      if (!env.envVars.hasAnthropicKey) return null;
      return {
        ...baseProvider,
        id: "anthropic",
        baseUrl: "https://api.anthropic.com",
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    case "google":
      if (!env.envVars.hasGoogleKey) return null;
      return {
        ...baseProvider,
        id: "google",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: process.env.GOOGLE_API_KEY,
      };
    case "ollama":
      return {
        ...baseProvider,
        id: "ollama",
        baseUrl: env.envVars.ollamaBaseUrl ?? "http://localhost:11434",
        supportsVision: false,
      };
    case "lmstudio":
      return {
        ...baseProvider,
        id: "lmstudio",
        baseUrl: env.envVars.lmStudioBaseUrl ?? "http://localhost:1234",
        supportsVision: false,
      };
    case "openrouter":
      return {
        ...baseProvider,
        id: "openrouter",
        baseUrl: "https://openrouter.ai/api",
        apiKey: process.env.OPENROUTER_API_KEY,
      };
    default:
      return null;
  }
}

function setupGatewayMetricsLink(
  gateway: AiGateway,
  aiRouter: AiRouter,
  eventBus: EventBus,
): void {
  const healthCheckInterval = setInterval(() => {
    const health = gateway.getProviderHealth();
    for (const [providerId, status] of Object.entries(health)) {
      aiRouter.updateMetrics(providerId, {
        available: status.available,
      });

      if (!status.available) {
        eventBus.publish("gateway.provider-unhealthy", {
          providerId,
          circuitBreaker: status.circuitBreaker,
        });
      }
    }
  }, 10_000);

  eventBus.subscribe("gateway.provider-unhealthy", async (msg) => {
    const payload = msg.payload as Record<string, unknown>;
    eventBus.publish("self-healing.check", {
      component: `provider-${payload.providerId ?? "unknown"}`,
      status: "unhealthy",
    });
  });

  if (typeof globalThis !== "undefined") {
    (globalThis as Record<string, unknown>).__gatewayHealthCleanup = () => clearInterval(healthCheckInterval);
  }
}
