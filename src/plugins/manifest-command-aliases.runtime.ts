import type { ZhushouConfig } from "../config/types.zhushou.js";
import {
  resolveManifestCommandAliasOwnerInRegistry,
  type PluginManifestCommandAliasRegistry,
  type PluginManifestCommandAliasRecord,
} from "./manifest-command-aliases.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";

export function resolveManifestCommandAliasOwner(params: {
  command: string | undefined;
  config?: ZhushouConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  registry?: PluginManifestCommandAliasRegistry;
}): PluginManifestCommandAliasRecord | undefined {
  const registry =
    params.registry ??
    loadPluginManifestRegistry({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
    });
  return resolveManifestCommandAliasOwnerInRegistry({
    command: params.command,
    registry,
  });
}
