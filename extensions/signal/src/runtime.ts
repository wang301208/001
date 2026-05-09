import type { PluginRuntime } from "assistant/plugin-sdk/core";
import { createPluginRuntimeStore } from "assistant/plugin-sdk/runtime-store";

const {
  setRuntime: setSignalRuntime,
  clearRuntime: clearSignalRuntime,
  getRuntime: getSignalRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "signal",
  errorMessage: "Signal runtime not initialized",
});
export { clearSignalRuntime, getSignalRuntime, setSignalRuntime };
