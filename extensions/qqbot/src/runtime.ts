import type { PluginRuntime } from "zhushou/plugin-sdk/core";
import { createPluginRuntimeStore } from "zhushou/plugin-sdk/runtime-store";

const { setRuntime: setQQBotRuntime, getRuntime: getQQBotRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "qqbot",
    errorMessage: "QQBot runtime not initialized",
  });
export { getQQBotRuntime, setQQBotRuntime };
