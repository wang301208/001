import type { AiGateway, AiGatewayConfig, ModelRoute } from "../gateway.js";
import { createAiGateway } from "../gateway.js";

export type AutoDiscoveredAiGateway = AiGateway & {
  discoveredRoutes: ModelRoute[];
  probeTimeMs: number;
};

export async function createAutoDiscoveredAiGateway(): Promise<AutoDiscoveredAiGateway> {
  const { probeModels } = await import("../../zero-config/model-probe.js");
  const probeResult = await probeModels();
  const routes: ModelRoute[] = [];

  for (const model of probeResult.models) {
    if (!model.available) {
      continue;
    }
    routes.push({
      modelAlias: model.id,
      provider: {
        id: model.provider,
        name: model.provider,
        baseUrl: model.baseUrl,
        models: [model.id],
        priority: getProviderPriority(model.provider),
        maxConcurrency: 10,
        supportsStreaming: model.supportsStreaming ?? true,
        supportsTools: model.supportsTools ?? false,
        supportsVision: model.supportsVision ?? false,
        chatCompletion: createProxyChatCompletion(model.baseUrl),
        healthCheck: () => Promise.resolve(true),
      },
      providerModel: model.id,
      priority: getProviderPriority(model.provider),
    });
  }

  const defaultModel = routes[0]?.modelAlias ?? "default";
  const config: AiGatewayConfig = {
    routes,
    defaultModel,
    enableFallback: true,
    enableCircuitBreaker: true,
  };

  const gateway = createAiGateway(config);

  return {
    ...gateway,
    discoveredRoutes: routes,
    probeTimeMs: probeResult.probeTimeMs,
  };
}

function getProviderPriority(provider: string): number {
  const priorities: Record<string, number> = {
    openai: 1,
    anthropic: 2,
    google: 3,
    openrouter: 4,
    groq: 5,
    mistral: 6,
    ollama: 7,
    lmstudio: 8,
  };
  return priorities[provider] ?? 10;
}

function createProxyChatCompletion(baseUrl: string) {
  return async (request: Request, signal?: AbortSignal) => {
    const start = performance.now();
    try {
      const response = await fetch(request, { signal });
      const latencyMs = performance.now() - start;
      if (!response.ok) {
        return {
          ok: false as const,
          error: `Provider returned ${response.status}`,
          status: response.status,
          retryable: response.status >= 500 || response.status === 429,
        };
      }
      const data = await response.json();
      return { ok: true as const, data, latencyMs };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
        status: 500,
        retryable: true,
      };
    }
  };
}
