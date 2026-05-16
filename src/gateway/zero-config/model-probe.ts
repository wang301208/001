export type ProbedModel = {
  id: string;
  provider: string;
  baseUrl: string;
  available: boolean;
  latencyMs?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  contextWindow?: number;
  error?: string;
};

export type ModelProbeResult = {
  models: ProbedModel[];
  totalProbed: number;
  availableCount: number;
  probeTimeMs: number;
};

export async function probeModels(endpoints?: ModelProbeEndpoint[]): Promise<ModelProbeResult> {
  const start = performance.now();
  const probeEndpoints = endpoints ?? getDefaultProbeEndpoints();
  const results = await Promise.allSettled(probeEndpoints.map(probeEndpoint));
  const models = results.map((r, i) => {
    if (r.status === "fulfilled") {return r.value;}
    return {
      id: probeEndpoints[i].modelId,
      provider: probeEndpoints[i].provider,
      baseUrl: probeEndpoints[i].baseUrl,
      available: false,
      error: r.status === "rejected" ? String(r.reason) : "Unknown error",
    } satisfies ProbedModel;
  });
  return {
    models,
    totalProbed: models.length,
    availableCount: models.filter((m) => m.available).length,
    probeTimeMs: performance.now() - start,
  };
}

export type ModelProbeEndpoint = {
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey?: string;
  probeModel?: string;
};

function getDefaultProbeEndpoints(): ModelProbeEndpoint[] {
  const endpoints: ModelProbeEndpoint[] = [];

  if (process.env.OPENAI_API_KEY) {
    endpoints.push({
      provider: "openai",
      modelId: "gpt-4o",
      baseUrl: "https://api.openai.com",
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    endpoints.push({
      provider: "openrouter",
      modelId: "openrouter/auto",
      baseUrl: "https://openrouter.ai/api",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    endpoints.push({
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      baseUrl: "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  if (process.env.GOOGLE_API_KEY) {
    endpoints.push({
      provider: "google",
      modelId: "gemini-2.5-pro",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  endpoints.push({
    provider: "ollama",
    modelId: "llama3",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  });

  endpoints.push({
    provider: "lmstudio",
    modelId: "local-model",
    baseUrl: process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234",
  });

  return endpoints;
}

async function probeEndpoint(endpoint: ModelProbeEndpoint): Promise<ProbedModel> {
  const start = performance.now();
  const baseUrl = endpoint.baseUrl.replace(/\/+$/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (endpoint.apiKey) {
      headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
    }

    const resp = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        id: endpoint.modelId,
        provider: endpoint.provider,
        baseUrl: endpoint.baseUrl,
        available: false,
        latencyMs: performance.now() - start,
        error: `HTTP ${resp.status}`,
      };
    }

    const data = await resp.json() as { data?: { id: string }[] };
    const availableModels = data.data?.map((m) => m.id) ?? [];

    return {
      id: endpoint.modelId,
      provider: endpoint.provider,
      baseUrl: endpoint.baseUrl,
      available: true,
      latencyMs: performance.now() - start,
      supportsStreaming: true,
      supportsTools: endpoint.provider !== "ollama" || availableModels.length > 0,
      supportsVision: endpoint.provider === "openai" || endpoint.provider === "anthropic" || endpoint.provider === "google",
    };
  } catch (err) {
    return {
      id: endpoint.modelId,
      provider: endpoint.provider,
      baseUrl: endpoint.baseUrl,
      available: false,
      latencyMs: performance.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
