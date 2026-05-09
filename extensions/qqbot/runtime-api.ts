export type { ChannelPlugin, AssistantPluginApi, PluginRuntime } from "assistant/plugin-sdk/core";
export type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
export type {
  AssistantPluginService,
  AssistantPluginServiceContext,
  PluginLogger,
} from "assistant/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/runtime.js";
