import type { ZhushouConfig } from "../config/types.zhushou.js";
import { resolveRuntimePluginRegistry } from "../plugins/loader.js";
import { resolveUserPath } from "../utils.js";

export function ensureRuntimePluginsLoaded(params: {
  config?: ZhushouConfig;
  workspaceDir?: string | null;
  allowGatewaySubagentBinding?: boolean;
}): void {
  const workspaceDir =
    typeof params.workspaceDir === "string" && params.workspaceDir.trim()
      ? resolveUserPath(params.workspaceDir)
      : undefined;
  const loadOptions = {
    config: params.config,
    workspaceDir,
    runtimeOptions: params.allowGatewaySubagentBinding
      ? {
          allowGatewaySubagentBinding: true,
        }
      : undefined,
  };
  resolveRuntimePluginRegistry(loadOptions);
}
