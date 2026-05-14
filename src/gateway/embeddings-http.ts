import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAgentDir } from "../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../agents/memory-search.js";
import { loadConfig } from "../config/config.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { formatErrorMessage } from "../infra/errors.js";
import { logWarn } from "../logger.js";
import {
  getMemoryEmbeddingProvider,
  listMemoryEmbeddingProviders,
} from "../plugins/memory-embedding-provider-runtime.js";
import type {
  MemoryEmbeddingProvider,
  MemoryEmbeddingProviderAdapter,
} from "../plugins/memory-embedding-providers.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { sendJson } from "./http-common.js";
import { handleGatewayPostJsonEndpoint } from "./http-endpoint-helpers.js";
import {
  ZHUSHOU_MODEL_ID,
  getHeader,
  resolveAgentIdForRequest,
  resolveAgentIdFromModel,
  resolveOpenAiCompatibleHttpOperatorScopes,
} from "./http-utils.js";

type OpenAiEmbeddingsHttpOptions = {
  auth: ResolvedGatewayAuth;
  maxBodyBytes?: number;
  trustedProxies?: string[];
  allowRealIpFallback?: boolean;
  rateLimiter?: AuthRateLimiter;
};

type EmbeddingsRequest = {
  model?: unknown;
  input?: unknown;
  encoding_format?: unknown;
  dimensions?: unknown;
  user?: unknown;
};

const DEFAULT_EMBEDDINGS_BODY_BYTES = 5 * 1024 * 1024;
const MAX_EMBEDDING_INPUTS = 128;
const MAX_EMBEDDING_INPUT_CHARS = 8_192;
const MAX_EMBEDDING_TOTAL_CHARS = 65_536;
type EmbeddingProviderRequest = string;

function coerceRequest(value: unknown): EmbeddingsRequest {
  return value && typeof value === "object" ? (value as EmbeddingsRequest) : {};
}

function resolveInputTexts(input: unknown): string[] | null {
  if (typeof input === "string") {
    return [input];
  }
  if (!Array.isArray(input)) {
    return null;
  }
  if (input.every((entry) => typeof entry === "string")) {
    return input;
  }
  return null;
}

function encodeEmbeddingBase64(embedding: number[]): string {
  const float32 = Float32Array.from(embedding);
  return Buffer.from(float32.buffer).toString("base64");
}

function validateInputTexts(texts: string[]): string | undefined {
  if (texts.length > MAX_EMBEDDING_INPUTS) {
    return `输入过多（最多 ${MAX_EMBEDDING_INPUTS} 个）。`;
  }
  let totalChars = 0;
  for (const text of texts) {
    if (text.length > MAX_EMBEDDING_INPUT_CHARS) {
      return `输入过长（最多 ${MAX_EMBEDDING_INPUT_CHARS} 字符）。`;
    }
    totalChars += text.length;
    if (totalChars > MAX_EMBEDDING_TOTAL_CHARS) {
      return `总输入过大（最多 ${MAX_EMBEDDING_TOTAL_CHARS} 字符）。`;
    }
  }
  return undefined;
}

function resolveAutoExplicitProviders(cfg: ZhushouConfig): Set<string> {
  return new Set(
    listMemoryEmbeddingProviders(cfg)
      .filter((adapter) => adapter.allowExplicitWhenConfiguredAuto)
      .map((adapter) => adapter.id),
  );
}

function shouldContinueAutoSelection(
  adapter: MemoryEmbeddingProviderAdapter,
  err: unknown,
): boolean {
  return adapter.shouldContinueAutoSelection?.(err) ?? false;
}

async function createConfiguredEmbeddingProvider(params: {
  cfg: ZhushouConfig;
  agentDir: string;
  provider: EmbeddingProviderRequest;
  model: string;
  memorySearch?: Pick<
    NonNullable<ReturnType<typeof resolveMemorySearchConfig>>,
    "local" | "remote" | "outputDimensionality"
  >;
}): Promise<MemoryEmbeddingProvider> {
  const createWithAdapter = async (adapter: MemoryEmbeddingProviderAdapter) => {
    const result = await adapter.create({
      config: params.cfg,
      agentDir: params.agentDir,
      model: params.model || adapter.defaultModel || "",
      local: params.memorySearch?.local,
      remote: params.memorySearch?.remote
        ? {
            baseUrl: params.memorySearch?.remote.baseUrl,
            apiKey: params.memorySearch?.remote.apiKey,
            headers: params.memorySearch?.remote.headers,
          }
        : undefined,
      outputDimensionality: params.memorySearch?.outputDimensionality,
    });
    return result.provider;
  };

  if (params.provider === "auto") {
    const adapters = listMemoryEmbeddingProviders(params.cfg)
      .filter((adapter) => typeof adapter.autoSelectPriority === "number")
      .toSorted(
        (a, b) =>
          (a.autoSelectPriority ?? Number.MAX_SAFE_INTEGER) -
          (b.autoSelectPriority ?? Number.MAX_SAFE_INTEGER),
      );
    for (const adapter of adapters) {
      try {
        const provider = await createWithAdapter(adapter);
        if (provider) {
          return provider;
        }
      } catch (err) {
        if (shouldContinueAutoSelection(adapter, err)) {
          continue;
        }
        throw err;
      }
    }
    throw new Error("没有可用的嵌入提供商。");
  }

  const adapter = getMemoryEmbeddingProvider(params.provider, params.cfg);
  if (!adapter) {
    throw new Error(`未知的记忆嵌入提供商：${params.provider}`);
  }
  const provider = await createWithAdapter(adapter);
  if (!provider) {
    throw new Error(`记忆嵌入提供商 ${params.provider} 不可用。`);
  }
  return provider;
}

function resolveEmbeddingsTarget(params: {
  requestModel: string;
  configuredProvider: EmbeddingProviderRequest;
  cfg: ZhushouConfig;
}): { provider: EmbeddingProviderRequest; model: string } | { errorMessage: string } {
  const raw = params.requestModel.trim();
  const slash = raw.indexOf("/");
  if (slash === -1) {
    return { provider: params.configuredProvider, model: raw };
  }

  const provider = normalizeLowercaseStringOrEmpty(raw.slice(0, slash));
  const model = raw.slice(slash + 1).trim();
  if (!model) {
    return { errorMessage: "不支持的嵌入模型引用。" };
  }

  if (params.configuredProvider === "auto") {
    const safeAutoExplicitProviders = resolveAutoExplicitProviders(params.cfg);
    if (provider === "auto") {
      return { provider: "auto", model };
    }
    if (safeAutoExplicitProviders.has(provider)) {
      return { provider, model };
    }
    return {
      errorMessage: "此代理不允许在 `/v1/embeddings` 上使用该嵌入提供商。",
    };
  }

  if (provider !== params.configuredProvider) {
    return {
      errorMessage: "此代理不允许在 `/v1/embeddings` 上使用该嵌入提供商。",
    };
  }

  return { provider: params.configuredProvider, model };
}

export async function handleOpenAiEmbeddingsHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: OpenAiEmbeddingsHttpOptions,
): Promise<boolean> {
  const handled = await handleGatewayPostJsonEndpoint(req, res, {
    pathname: "/v1/embeddings",
    requiredOperatorMethod: "chat.send",
    resolveOperatorScopes: resolveOpenAiCompatibleHttpOperatorScopes,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
    maxBodyBytes: opts.maxBodyBytes ?? DEFAULT_EMBEDDINGS_BODY_BYTES,
  });
  if (handled === false) {
    return false;
  }
  if (!handled) {
    return true;
  }

  const payload = coerceRequest(handled.body);
  const requestModel = normalizeOptionalString(payload.model) ?? "";
  if (!requestModel) {
    sendJson(res, 400, {
      error: { message: "缺少 `model`。", type: "invalid_request_error" },
    });
    return true;
  }

  const cfg = loadConfig();
  if (requestModel !== ZHUSHOU_MODEL_ID && !resolveAgentIdFromModel(requestModel, cfg)) {
    sendJson(res, 400, {
      error: {
        message: "无效的 `model`。请使用 `zhushou` 或 `zhushou/<agentId>`。",
        type: "invalid_request_error",
      },
    });
    return true;
  }

  const texts = resolveInputTexts(payload.input);
  if (!texts) {
    sendJson(res, 400, {
      error: {
        message: "`input` 必须为字符串或字符串数组。",
        type: "invalid_request_error",
      },
    });
    return true;
  }
  const inputError = validateInputTexts(texts);
  if (inputError) {
    sendJson(res, 400, {
      error: { message: inputError, type: "invalid_request_error" },
    });
    return true;
  }

  const agentId = resolveAgentIdForRequest({ req, model: requestModel });
  const agentDir = resolveAgentDir(cfg, agentId);
  const memorySearch = resolveMemorySearchConfig(cfg, agentId);
  const configuredProvider = memorySearch?.provider ?? "openai";
  const overrideModel =
    normalizeOptionalString(getHeader(req, "x-zhushou-model")) ||
    normalizeOptionalString(memorySearch?.model) ||
    "";
  const target = resolveEmbeddingsTarget({
    requestModel: overrideModel,
    configuredProvider,
    cfg,
  });
  if ("errorMessage" in target) {
    sendJson(res, 400, {
      error: {
        message: target.errorMessage,
        type: "invalid_request_error",
      },
    });
    return true;
  }

  try {
    const provider = await createConfiguredEmbeddingProvider({
      cfg,
      agentDir,
      provider: target.provider,
      model: target.model,
      memorySearch: memorySearch
        ? {
            ...memorySearch,
            outputDimensionality:
              typeof payload.dimensions === "number" && payload.dimensions > 0
                ? Math.floor(payload.dimensions)
                : memorySearch.outputDimensionality,
          }
        : undefined,
    });
    const embeddings = await provider.embedBatch(texts);
    const encodingFormat = payload.encoding_format === "base64" ? "base64" : "float";

    sendJson(res, 200, {
      object: "list",
      data: embeddings.map((embedding, index) => ({
        object: "embedding",
        index,
        embedding: encodingFormat === "base64" ? encodeEmbeddingBase64(embedding) : embedding,
      })),
      model: requestModel,
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (err) {
    logWarn(`openai-compat: 嵌入请求失败: ${formatErrorMessage(err)}`);
    sendJson(res, 500, {
      error: {
        message: "内部错误",
        type: "api_error",
      },
    });
  }

  return true;
}
