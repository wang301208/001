import type { DiscoveredEnvironment } from "./env-discover.js";
import type { ModelProbeResult, ProbedModel } from "./model-probe.js";
import { discoverEnvironment } from "./env-discover.js";
import { probeModels } from "./model-probe.js";

export type ZeroConfigResult = {
  environment: DiscoveredEnvironment;
  modelProbe: ModelProbeResult;
  resolvedConfig: {
    port: number;
    bindHost: string;
    defaultModel: string;
    availableProviders: string[];
    recommendedRoutes: RouteRecommendation[];
  };
  warnings: string[];
  autoDetected: boolean;
};

export type RouteRecommendation = {
  modelAlias: string;
  provider: string;
  providerModel: string;
  priority: number;
  reason: string;
};

export async function resolveZeroConfig(): Promise<ZeroConfigResult> {
  const environment = await discoverEnvironment();
  const modelProbe = await probeModels();
  const warnings: string[] = [];

  const port = environment.envVars.port ?? (environment.isKubernetes ? 3000 : 18790);
  const bindHost = environment.envVars.bindHost ?? (environment.isDocker || environment.isKubernetes ? "0.0.0.0" : "127.0.0.1");

  if (!environment.envVars.hasOpenAiKey && !environment.envVars.hasAnthropicKey && !environment.envVars.hasGoogleKey && !environment.envVars.hasOllama && !environment.envVars.hasLmStudio) {
    warnings.push("未检测到任何 AI 提供商 API 密钥或本地模型服务。请配置至少一个提供商。");
  }

  if (environment.availableMemoryMb < 256) {
    warnings.push(`可用内存 ${environment.availableMemoryMb}MB 低于推荐最低 256MB。`);
  }

  if (environment.isDocker && bindHost === "127.0.0.1") {
    warnings.push("Docker 环境下绑定 127.0.0.1 将无法从容器外部访问。建议设置 ZHUSHOU_BIND=0.0.0.0。");
  }

  const availableProviders = modelProbe.models.filter((m) => m.available).map((m) => m.provider);
  const uniqueProviders = [...new Set(availableProviders)];

  const recommendedRoutes = buildRouteRecommendations(modelProbe.models, environment);
  const defaultModel = resolveDefaultModel(modelProbe.models, environment);

  return {
    environment,
    modelProbe,
    resolvedConfig: {
      port,
      bindHost,
      defaultModel,
      availableProviders: uniqueProviders,
      recommendedRoutes,
    },
    warnings,
    autoDetected: true,
  };
}

function buildRouteRecommendations(
  models: ProbedModel[],
  env: DiscoveredEnvironment,
): RouteRecommendation[] {
  const routes: RouteRecommendation[] = [];
  const available = models.filter((m) => m.available);

  const cloudModels = available.filter((m) => ["openai", "anthropic", "google", "openrouter"].includes(m.provider));
  const localModels = available.filter((m) => ["ollama", "lmstudio"].includes(m.provider));

  for (const model of cloudModels) {
    routes.push({
      modelAlias: model.id,
      provider: model.provider,
      providerModel: model.id,
      priority: 1,
      reason: `云端模型，延迟 ${model.latencyMs?.toFixed(0) ?? "?"}ms`,
    });
    if (localModels.length > 0) {
      routes.push({
        modelAlias: model.id,
        provider: localModels[0].provider,
        providerModel: localModels[0].id,
        priority: 2,
        reason: `${localModels[0].provider} 本地降级备选`,
      });
    }
  }

  for (const model of localModels) {
    routes.push({
      modelAlias: `local/${model.id}`,
      provider: model.provider,
      providerModel: model.id,
      priority: 1,
      reason: "本地模型，零延迟",
    });
  }

  if (env.envVars.hasOllama && !cloudModels.length) {
    routes.push({
      modelAlias: "default",
      provider: "ollama",
      providerModel: "llama3",
      priority: 1,
      reason: "仅 Ollama 可用，设为默认",
    });
  }

  return routes;
}

function resolveDefaultModel(
  models: ProbedModel[],
  env: DiscoveredEnvironment,
): string {
  if (env.envVars.hasOpenAiKey) {return "gpt-4o";}
  if (env.envVars.hasAnthropicKey) {return "claude-sonnet-4-20250514";}
  if (env.envVars.hasGoogleKey) {return "gemini-2.5-pro";}
  if (env.envVars.hasOllama) {return "local/llama3";}
  if (env.envVars.hasLmStudio) {return "local/local-model";}
  return "default";
}
