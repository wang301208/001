import type { ZhushouConfig } from "../../config/types.zhushou.js";
import { loadZhushouPlugins } from "../loader.js";
import { hasExplicitPluginIdScope } from "../plugin-scope.js";
import type { PluginRegistry } from "../registry.js";
import { buildPluginRuntimeLoadOptions, resolvePluginRuntimeLoadContext } from "./load-context.js";

export function loadPluginMetadataRegistrySnapshot(options?: {
  config?: ZhushouConfig;
  activationSourceConfig?: ZhushouConfig;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  onlyPluginIds?: string[];
  loadModules?: boolean;
}): PluginRegistry {
  const context = resolvePluginRuntimeLoadContext(options);

  return loadZhushouPlugins(
    buildPluginRuntimeLoadOptions(context, {
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: options?.loadModules,
      ...(hasExplicitPluginIdScope(options?.onlyPluginIds)
        ? { onlyPluginIds: options?.onlyPluginIds }
        : {}),
    }),
  );
}
