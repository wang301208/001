import type { PluginRuntime } from "assistant/plugin-sdk/core";
import { createPluginRuntimeStore } from "assistant/plugin-sdk/runtime-store";

const { setRuntime: setQQBotRuntime, getRuntime: getQQBotRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "qqbot",
    errorMessage: "QQBot runtime not initialized",
  });
export { getQQBotRuntime, setQQBotRuntime };
