import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { initSubagentRegistry } from "../agents/subagent-registry.js";
import { runChannelPluginStartupMaintenance } from "../channels/plugins/lifecycle-startup.js";
import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import type { AssistantConfig } from "../config/types.assistant.js";
import { isTruthyEnvValue } from "../infra/env.js";
import {
  resolveConfiguredDeferredChannelPluginIds,
  resolveGatewayStartupPluginIds,
} from "../plugins/channel-plugin-ids.js";
import { createEmptyPluginRegistry } from "../plugins/registry.js";
import { getActivePluginRegistry, setActivePluginRegistry } from "../plugins/runtime.js";
import { listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";
import { loadGatewayStartupPlugins } from "./server-plugin-bootstrap.js";
import { runStartupSessionMigration } from "./server-startup-session-migration.js";

type GatewayPluginBootstrapLog = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
};

export async function prepareGatewayPluginBootstrap(params: {
  cfgAtStart: AssistantConfig;
  startupRuntimeConfig: AssistantConfig;
  minimalTestGateway: boolean;
  log: GatewayPluginBootstrapLog;
}) {
  const skipPluginStartup =
    params.minimalTestGateway ||
    isTruthyEnvValue(process.env.ASSISTANT_SKIP_CHANNELS) ||
    isTruthyEnvValue(process.env.ASSISTANT_SKIP_PROVIDERS);
  const startupMaintenanceConfig =
    params.cfgAtStart.channels === undefined && params.startupRuntimeConfig.channels !== undefined
      ? {
          ...params.cfgAtStart,
          channels: params.startupRuntimeConfig.channels,
        }
      : params.cfgAtStart;

  if (!skipPluginStartup) {
    await runChannelPluginStartupMaintenance({
      cfg: startupMaintenanceConfig,
      env: process.env,
      log: params.log,
    });
    await runStartupSessionMigration({
      cfg: params.cfgAtStart,
      env: process.env,
      log: params.log,
    });
  }

  initSubagentRegistry();

  const gatewayPluginConfigAtStart = skipPluginStartup
    ? params.cfgAtStart
    : applyPluginAutoEnable({
        config: params.cfgAtStart,
        env: process.env,
      }).config;
  const defaultAgentId = resolveDefaultAgentId(gatewayPluginConfigAtStart);
  const defaultWorkspaceDir = resolveAgentWorkspaceDir(gatewayPluginConfigAtStart, defaultAgentId);
  const deferredConfiguredChannelPluginIds = skipPluginStartup
    ? []
    : resolveConfiguredDeferredChannelPluginIds({
        config: gatewayPluginConfigAtStart,
        workspaceDir: defaultWorkspaceDir,
        env: process.env,
      });
  const startupPluginIds = skipPluginStartup
    ? []
    : resolveGatewayStartupPluginIds({
        config: gatewayPluginConfigAtStart,
        activationSourceConfig: params.cfgAtStart,
        workspaceDir: defaultWorkspaceDir,
        env: process.env,
      });

  const baseMethods = listGatewayMethods();
  const emptyPluginRegistry = createEmptyPluginRegistry();
  let pluginRegistry = emptyPluginRegistry;
  let baseGatewayMethods = baseMethods;

  if (!skipPluginStartup) {
    ({ pluginRegistry, gatewayMethods: baseGatewayMethods } = loadGatewayStartupPlugins({
      cfg: gatewayPluginConfigAtStart,
      activationSourceConfig: params.cfgAtStart,
      workspaceDir: defaultWorkspaceDir,
      log: params.log,
      coreGatewayHandlers,
      baseMethods,
      pluginIds: startupPluginIds,
      preferSetupRuntimeForChannelPlugins: deferredConfiguredChannelPluginIds.length > 0,
      suppressPluginInfoLogs: deferredConfiguredChannelPluginIds.length > 0,
    }));
  } else {
    pluginRegistry = getActivePluginRegistry() ?? emptyPluginRegistry;
    setActivePluginRegistry(pluginRegistry);
  }

  return {
    gatewayPluginConfigAtStart,
    defaultWorkspaceDir,
    deferredConfiguredChannelPluginIds,
    startupPluginIds,
    baseMethods,
    pluginRegistry,
    baseGatewayMethods,
  };
}
