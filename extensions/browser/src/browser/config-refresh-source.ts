import { createConfigIO, getRuntimeConfigSnapshot, type ZhushouConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): ZhushouConfig {
  return getRuntimeConfigSnapshot() ?? createConfigIO().loadConfig();
}
