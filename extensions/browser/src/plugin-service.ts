import {
  startLazyPluginServiceModule,
  type LazyPluginServiceHandle,
  type ZhushouPluginService,
} from "zhushou/plugin-sdk/browser-node-runtime";

type BrowserControlHandle = LazyPluginServiceHandle | null;
const UNSAFE_BROWSER_CONTROL_OVERRIDE_SPECIFIER = /^(?:data|http|https|node):/i;

function validateBrowserControlOverrideSpecifier(specifier: string): string {
  const trimmed = specifier.trim();
  if (UNSAFE_BROWSER_CONTROL_OVERRIDE_SPECIFIER.test(trimmed)) {
    throw new Error(`Refusing unsafe browser control override specifier: ${trimmed}`);
  }
  return trimmed;
}

export function createBrowserPluginService(): ZhushouPluginService {
  let handle: BrowserControlHandle = null;

  return {
    id: "browser-control",
    start: async () => {
      if (handle) {
        return;
      }
      handle = await startLazyPluginServiceModule({
        skipEnvVar: "ZHUSHOU_SKIP_BROWSER_CONTROL_SERVER",
        overrideEnvVar: "ZHUSHOU_BROWSER_CONTROL_MODULE",
        validateOverrideSpecifier: validateBrowserControlOverrideSpecifier,
        // Keep the default module import static so compiled builds still bundle it.
        loadDefaultModule: async () => await import("./server.js"),
        startExportNames: [
          "startBrowserControlServiceFromConfig",
          "startBrowserControlServerFromConfig",
        ],
        stopExportNames: ["stopBrowserControlService", "stopBrowserControlServer"],
      });
    },
    stop: async () => {
      const current = handle;
      handle = null;
      if (!current) {
        return;
      }
      await current.stop().catch(() => {});
    },
  };
}
