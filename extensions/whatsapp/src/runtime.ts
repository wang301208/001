import type { PluginRuntime } from "zhushou/plugin-sdk/core";
import { createPluginRuntimeStore } from "zhushou/plugin-sdk/runtime-store";

const { setRuntime: setWhatsAppRuntime, getRuntime: getWhatsAppRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "whatsapp",
    errorMessage: "WhatsApp runtime not initialized",
  });
export { getWhatsAppRuntime, setWhatsAppRuntime };
