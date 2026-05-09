import { createConfigIO, getRuntimeConfigSnapshot, type AssistantConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): AssistantConfig {
  return getRuntimeConfigSnapshot() ?? createConfigIO().loadConfig();
}
