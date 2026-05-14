import type { ZhushouConfig } from "../../config/types.zhushou.js";
import { buildProviderAuthDoctorHintWithPlugin } from "../../plugins/provider-runtime.runtime.js";
import { normalizeProviderId } from "../provider-id.js";
import type { AuthProfileStore } from "./types.js";

/**
 * 已弃用/已移除 OAuth 提供者的迁移提示。
 * 拥有过时凭据的用户应被引导迁移。
 */
const DEPRECATED_PROVIDER_MIGRATION_HINTS: Record<string, string> = {
  "qwen-portal":
    "Qwen OAuth via portal.qwen.ai has been deprecated. Please migrate to Qwen Cloud Coding Plan. Run: zhushou onboard --auth-choice qwen-api-key (or qwen-api-key-cn for the China endpoint). Legacy modelstudio auth-choice ids still work.",
};

export async function formatAuthDoctorHint(params: {
  cfg?: ZhushouConfig;
  store: AuthProfileStore;
  provider: string;
  profileId?: string;
}): Promise<string> {
  const normalizedProvider = normalizeProviderId(params.provider);

  // 首先检查已弃用提供者的迁移提示
  const migrationHint = DEPRECATED_PROVIDER_MIGRATION_HINTS[normalizedProvider];
  if (migrationHint) {
    return migrationHint;
  }

  const pluginHint = await buildProviderAuthDoctorHintWithPlugin({
    provider: normalizedProvider,
    context: {
      config: params.cfg,
      store: params.store,
      provider: normalizedProvider,
      profileId: params.profileId,
    },
  });
  if (typeof pluginHint === "string" && pluginHint.trim()) {
    return pluginHint;
  }
  return "";
}
