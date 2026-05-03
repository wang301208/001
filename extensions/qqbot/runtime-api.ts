export type { ChannelPlugin, ZhushouPluginApi, PluginRuntime } from "zhushou/plugin-sdk/core";
export type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
export type {
  OpenClawPluginService,
  OpenClawPluginServiceContext,
  PluginLogger,
} from "zhushou/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/runtime.js";
