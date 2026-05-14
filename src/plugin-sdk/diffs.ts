// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to the bundled diffs surface.

export { definePluginEntry } from "./plugin-entry.js";
export type { ZhushouConfig } from "../config/config.js";
export { resolvePreferredZhushouTmpDir } from "../infra/tmp-zhushou-dir.js";
export type {
  AnyAgentTool,
  ZhushouPluginApi,
  ZhushouPluginConfigSchema,
  ZhushouPluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
