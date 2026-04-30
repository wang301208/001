import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { createAnthropicVertexStreamFnForModel } from "../anthropic-vertex-stream.js";
import { createOpenAIWebSocketStreamFn } from "../openai-ws-stream.js";
import { getModelProviderRequestTransport } from "../provider-request-config.js";
import { createBoundaryAwareStreamFnForModel } from "../provider-transport-stream.js";
import { stripSystemPromptCacheBoundary } from "../system-prompt-cache-boundary.js";
import type { EmbeddedRunAttemptParams } from "./run/types.js";

let embeddedAgentBaseStreamFnCache = new WeakMap<object, StreamFn | undefined>();

export function resolveEmbeddedAgentBaseStreamFn(params: {
  session: { agent: { streamFn?: StreamFn } };
}): StreamFn | undefined {
  const cached = embeddedAgentBaseStreamFnCache.get(params.session);
  if (cached !== undefined || embeddedAgentBaseStreamFnCache.has(params.session)) {
    return cached;
  }
  const baseStreamFn = params.session.agent.streamFn;
  embeddedAgentBaseStreamFnCache.set(params.session, baseStreamFn);
  return baseStreamFn;
}

export function resetEmbeddedAgentBaseStreamFnCacheForTest(): void {
  embeddedAgentBaseStreamFnCache = new WeakMap<object, StreamFn | undefined>();
}

function hasConfiguredCompat(model: EmbeddedRunAttemptParams["model"]): boolean {
  const compat = (model as { compat?: unknown }).compat;
  return Boolean(compat && typeof compat === "object" && !Array.isArray(compat));
}

function shouldPreferBoundaryAwareStreamFn(params: {
  currentStreamFn: StreamFn | undefined;
  model: EmbeddedRunAttemptParams["model"];
}): boolean {
  if (params.currentStreamFn === undefined || params.currentStreamFn === streamSimple) {
    return true;
  }
  // Custom OpenAI-compatible providers often need OpenClaw's normalized payload
  // shaping even when the embedded SDK session installed its own default stream.
  return hasConfiguredCompat(params.model) || Boolean(getModelProviderRequestTransport(params.model));
}

export function describeEmbeddedAgentStreamStrategy(params: {
  currentStreamFn: StreamFn | undefined;
  providerStreamFn?: StreamFn;
  shouldUseWebSocketTransport: boolean;
  wsApiKey?: string;
  model: EmbeddedRunAttemptParams["model"];
}): string {
  if (params.providerStreamFn) {
    return "provider";
  }
  if (params.shouldUseWebSocketTransport) {
    return params.wsApiKey ? "openai-websocket" : "session-http-fallback";
  }
  if (params.model.provider === "anthropic-vertex") {
    return "anthropic-vertex";
  }
  const boundaryAwareStreamFn = createBoundaryAwareStreamFnForModel(params.model);
  if (boundaryAwareStreamFn && shouldPreferBoundaryAwareStreamFn(params)) {
    return `boundary-aware:${params.model.api}`;
  }
  if (params.currentStreamFn === undefined || params.currentStreamFn === streamSimple) {
    return "stream-simple";
  }
  return "session-custom";
}

export async function resolveEmbeddedAgentApiKey(params: {
  provider: string;
  resolvedApiKey?: string;
  authStorage?: { getApiKey(provider: string): Promise<string | undefined> };
}): Promise<string | undefined> {
  const resolvedApiKey = params.resolvedApiKey?.trim();
  if (resolvedApiKey) {
    return resolvedApiKey;
  }
  return params.authStorage ? await params.authStorage.getApiKey(params.provider) : undefined;
}

function normalizeProviderOwnedContext(context: Parameters<StreamFn>[1]): Parameters<StreamFn>[1] {
  return context.systemPrompt
    ? {
        ...context,
        systemPrompt: stripSystemPromptCacheBoundary(context.systemPrompt),
      }
    : context;
}

function wrapStreamFnWithRuntimeApiKey(
  inner: StreamFn,
  params: {
    model: EmbeddedRunAttemptParams["model"];
    resolvedApiKey?: string;
    authStorage?: { getApiKey(provider: string): Promise<string | undefined> };
    normalizeContext?: (context: Parameters<StreamFn>[1]) => Parameters<StreamFn>[1];
  },
): StreamFn {
  const normalizeContext = params.normalizeContext ?? ((context) => context);
  if (!params.authStorage && !params.resolvedApiKey) {
    return (m, context, options) => inner(m, normalizeContext(context), options);
  }
  const { authStorage, model, resolvedApiKey } = params;
  return async (m, context, options) => {
    const apiKey = await resolveEmbeddedAgentApiKey({
      provider: model.provider,
      resolvedApiKey,
      authStorage,
    });
    return inner(m, normalizeContext(context), {
      ...options,
      apiKey: apiKey ?? options?.apiKey,
    });
  };
}

export function resolveEmbeddedAgentStreamFn(params: {
  currentStreamFn: StreamFn | undefined;
  providerStreamFn?: StreamFn;
  shouldUseWebSocketTransport: boolean;
  wsApiKey?: string;
  sessionId: string;
  signal?: AbortSignal;
  model: EmbeddedRunAttemptParams["model"];
  resolvedApiKey?: string;
  authStorage?: { getApiKey(provider: string): Promise<string | undefined> };
}): StreamFn {
  if (params.providerStreamFn) {
    // Provider-owned transports bypass pi-coding-agent's default auth lookup,
    // so keep injecting the resolved runtime apiKey for streamSimple-compatible
    // transports that still read credentials from options.apiKey.
    return wrapStreamFnWithRuntimeApiKey(params.providerStreamFn, {
      model: params.model,
      resolvedApiKey: params.resolvedApiKey,
      authStorage: params.authStorage,
      normalizeContext: normalizeProviderOwnedContext,
    });
  }

  const currentStreamFn = params.currentStreamFn ?? streamSimple;
  if (params.shouldUseWebSocketTransport) {
    return params.wsApiKey
      ? createOpenAIWebSocketStreamFn(params.wsApiKey, params.sessionId, {
          signal: params.signal,
          managerOptions: {
            request: getModelProviderRequestTransport(params.model),
          },
        })
      : currentStreamFn;
  }

  if (params.model.provider === "anthropic-vertex") {
    return createAnthropicVertexStreamFnForModel(params.model);
  }

  const boundaryAwareStreamFn = createBoundaryAwareStreamFnForModel(params.model);
  if (
    boundaryAwareStreamFn &&
    shouldPreferBoundaryAwareStreamFn({
      currentStreamFn: params.currentStreamFn,
      model: params.model,
    })
  ) {
    // Boundary-aware OpenClaw transports replace the SDK default streamFn,
    // so they must also receive the runtime credential the SDK normally adds.
    return wrapStreamFnWithRuntimeApiKey(boundaryAwareStreamFn, {
      model: params.model,
      resolvedApiKey: params.resolvedApiKey,
      authStorage: params.authStorage,
    });
  }

  return currentStreamFn;
}
