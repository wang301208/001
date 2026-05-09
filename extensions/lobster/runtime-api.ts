export { definePluginEntry } from "assistant/plugin-sdk/core";
export type {
  AnyAgentTool,
  AssistantPluginApi,
  AssistantPluginToolContext,
  AssistantPluginToolFactory,
} from "assistant/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "assistant/plugin-sdk/windows-spawn";
