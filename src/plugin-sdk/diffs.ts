// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to the bundled diffs surface.

export { definePluginEntry } from "./plugin-entry.js";
export type { AssistantConfig } from "../config/config.js";
export { resolvePreferredAssistantTmpDir } from "../infra/tmp-assistant-dir.js";
export type {
  AnyAgentTool,
  AssistantPluginApi,
  AssistantPluginConfigSchema,
  AssistantPluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
