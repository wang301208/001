import type { AssistantConfig } from "assistant/plugin-sdk/browser-config-runtime";
import {
  normalizePluginsConfig,
  resolveEffectiveEnableState,
} from "assistant/plugin-sdk/browser-config-runtime";

export function isDefaultBrowserPluginEnabled(cfg: AssistantConfig): boolean {
  return resolveEffectiveEnableState({
    id: "browser",
    origin: "bundled",
    config: normalizePluginsConfig(cfg.plugins),
    rootConfig: cfg,
    enabledByDefault: true,
  }).enabled;
}
