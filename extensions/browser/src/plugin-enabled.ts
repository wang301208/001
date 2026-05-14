import type { ZhushouConfig } from "zhushou/plugin-sdk/browser-config-runtime";
import {
  normalizePluginsConfig,
  resolveEffectiveEnableState,
} from "zhushou/plugin-sdk/browser-config-runtime";

export function isDefaultBrowserPluginEnabled(cfg: ZhushouConfig): boolean {
  return resolveEffectiveEnableState({
    id: "browser",
    origin: "bundled",
    config: normalizePluginsConfig(cfg.plugins),
    rootConfig: cfg,
    enabledByDefault: true,
  }).enabled;
}
