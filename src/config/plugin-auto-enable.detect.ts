import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import {
  configMayNeedPluginAutoEnable,
  resolveConfiguredPluginAutoEnableCandidates,
  resolvePluginAutoEnableManifestRegistry,
} from "./plugin-auto-enable.shared.js";
import type { PluginAutoEnableCandidate } from "./plugin-auto-enable.types.js";
import type { ZhushouConfig } from "./types.zhushou.js";

export function detectPluginAutoEnableCandidates(params: {
  config?: ZhushouConfig;
  env?: NodeJS.ProcessEnv;
  manifestRegistry?: PluginManifestRegistry;
}): PluginAutoEnableCandidate[] {
  const env = params.env ?? process.env;
  const config = params.config ?? ({} as ZhushouConfig);
  if (!configMayNeedPluginAutoEnable(config, env)) {
    return [];
  }
  const registry = resolvePluginAutoEnableManifestRegistry({
    config,
    env,
    manifestRegistry: params.manifestRegistry,
  });
  return resolveConfiguredPluginAutoEnableCandidates({
    config,
    env,
    registry,
  });
}
