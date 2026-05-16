import type { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from "./types.js";
import type { ModelProvider, ProviderResponse } from "./provider.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { ModelFallbackChain } from "./fallback-chain.js";

export type ModelRoute = {
  modelAlias: string;
  provider: ModelProvider;
  providerModel: string;
  priority: number;
};

export type AiGatewayConfig = {
  routes: ModelRoute[];
  defaultModel: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableFallback?: boolean;
  enableCircuitBreaker?: boolean;
  circuitBreakerFailureThreshold?: number;
  circuitBreakerRecoveryMs?: number;
  costBudgetPerRequestUsd?: number;
};

export type AiGateway = {
  chatCompletion(req: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse>;
  chatCompletionStream(req: ChatCompletionRequest, signal?: AbortSignal): AsyncIterable<ChatCompletionChunk>;
  listModels(): ModelInfo[];
  getProviderHealth(): Record<string, { available: boolean; circuitBreaker: string }>;
};

export type ModelInfo = {
  id: string;
  provider: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  costPerToken?: { prompt: number; completion: number };
};

type ProviderEntry = {
  provider: ModelProvider;
  circuitBreaker: CircuitBreaker;
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  totalLatencyMs: number;
};

export function createAiGateway(config: AiGatewayConfig): AiGateway {
  const providerMap = new Map<string, ProviderEntry>();
  const fallbackChains = new Map<string, ModelFallbackChain>();

  for (const route of config.routes) {
    if (!providerMap.has(route.provider.id)) {
      providerMap.set(route.provider.id, {
        provider: route.provider,
        circuitBreaker: new CircuitBreaker(
          config.circuitBreakerFailureThreshold ?? 5,
          config.circuitBreakerRecoveryMs ?? 30_000,
        ),
        activeRequests: 0,
        totalRequests: 0,
        totalErrors: 0,
        totalLatencyMs: 0,
      });
    }

    let chain = fallbackChains.get(route.modelAlias);
    if (!chain) {
      chain = new ModelFallbackChain();
      fallbackChains.set(route.modelAlias, chain);
    }
    chain.add(route.provider, route.providerModel, route.priority);
  }

  const timeoutMs = config.requestTimeoutMs ?? 60_000;
  const maxRetries = config.maxRetries ?? 2;
  const retryDelayMs = config.retryDelayMs ?? 1_000;

  async function executeWithFallback(
    model: string,
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<ProviderResponse> {
    const chain = fallbackChains.get(model);
    if (!chain) {
      const entries = [...fallbackChains.entries()];
      for (const [alias, fallbackChain] of entries) {
        if (alias.startsWith(model.split(":")[0])) {
          return executeChain(fallbackChain, request, signal);
        }
      }
      return { ok: false as const, error: `No provider found for model: ${model}`, status: 404, retryable: false };
    }
    return executeChain(chain, request, signal);
  }

  async function executeChain(
    chain: ModelFallbackChain,
    request: ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<ProviderResponse> {
    const entries = chain.getChain();
    let lastError: ProviderResponse | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      for (const entry of entries) {
        const providerEntry = providerMap.get(entry.provider.id);
        if (!providerEntry) {continue;}

        if (!providerEntry.circuitBreaker.isAvailable) {continue;}
        if (providerEntry.activeRequests >= entry.provider.maxConcurrency) {continue;}

        providerEntry.activeRequests++;
        providerEntry.totalRequests++;
        const startTime = performance.now();

        try {
          const timeoutSignal = AbortSignal.timeout(timeoutMs);
          const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutSignal])
            : timeoutSignal;

          const internalReq = new Request(`${entry.provider.baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(entry.provider.apiKey ? { Authorization: `Bearer ${entry.provider.apiKey}` } : {}),
              ...entry.provider.customHeaders,
            },
            body: JSON.stringify({ ...request, model: entry.model }),
            signal: combinedSignal,
          });

          const result = await entry.provider.chatCompletion(internalReq, combinedSignal);
          const latency = performance.now() - startTime;
          providerEntry.totalLatencyMs += latency;

          if (result.ok) {
            providerEntry.circuitBreaker.recordSuccess();
            providerEntry.activeRequests--;
            return result;
          }

          providerEntry.totalErrors++;
          if (result.retryable) {
            providerEntry.circuitBreaker.recordFailure();
            lastError = result;
            continue;
          }

          providerEntry.circuitBreaker.recordFailure();
          providerEntry.activeRequests--;
          return result;
        } catch (err) {
          providerEntry.totalErrors++;
          providerEntry.circuitBreaker.recordFailure();
          lastError = {
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
            status: 500,
            retryable: true,
          };
        } finally {
          providerEntry.activeRequests = Math.max(0, providerEntry.activeRequests - 1);
        }
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
      }
    }

    return lastError ?? { ok: false as const, error: "All providers exhausted", status: 503, retryable: false };
  }

  return {
    async chatCompletion(req, signal) {
      const result = await executeWithFallback(req.model, req, signal);
      if (!result.ok) {
        throw new AiGatewayError(result.error, result.status, result.retryable);
      }
      return result.data as ChatCompletionResponse;
    },

    async *chatCompletionStream(req, signal) {
      const chain = fallbackChains.get(req.model);
      if (!chain) {
        throw new AiGatewayError(`No provider for model: ${req.model}`, 404, false);
      }
      const entries = chain.getChain();
      for (const entry of entries) {
        const providerEntry = providerMap.get(entry.provider.id);
        if (!providerEntry?.circuitBreaker.isAvailable) {continue;}

        const internalReq = new Request(`${entry.provider.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(entry.provider.apiKey ? { Authorization: `Bearer ${entry.provider.apiKey}` } : {}),
          },
          body: JSON.stringify({ ...req, model: entry.model, stream: true }),
          signal,
        });

        const result = await entry.provider.chatCompletion(internalReq, signal);
        if (!result.ok) {continue;}
        yield result.data as ChatCompletionChunk;
        return;
      }
      throw new AiGatewayError("All providers exhausted for streaming", 503, true);
    },

    listModels() {
      const models: ModelInfo[] = [];
      const seen = new Set<string>();
      for (const route of config.routes) {
        if (seen.has(route.modelAlias)) {continue;}
        seen.add(route.modelAlias);
        models.push({
          id: route.modelAlias,
          provider: route.provider.id,
          supportsStreaming: route.provider.supportsStreaming,
          supportsTools: route.provider.supportsTools,
          supportsVision: route.provider.supportsVision,
          costPerToken: route.provider.costPerToken,
        });
      }
      return models;
    },

    getProviderHealth() {
      const health: Record<string, { available: boolean; circuitBreaker: string }> = {};
      for (const [id, entry] of providerMap) {
        health[id] = {
          available: entry.circuitBreaker.isAvailable,
          circuitBreaker: entry.circuitBreaker.currentState,
        };
      }
      return health;
    },
  };
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}
