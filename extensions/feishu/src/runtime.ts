import type { PluginRuntime } from "zhushou/plugin-sdk/core";
import { createPluginRuntimeStore } from "zhushou/plugin-sdk/runtime-store";

const { setRuntime: setFeishuRuntime, getRuntime: getFeishuRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "feishu",
    errorMessage: "Feishu runtime not initialized",
  });
export { getFeishuRuntime, setFeishuRuntime };
