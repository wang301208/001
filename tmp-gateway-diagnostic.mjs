process.env.VITEST = "1";
process.env.ASSISTANT_TEST_MINIMAL_GATEWAY = "1";
process.env.ASSISTANT_SKIP_CHANNELS = "1";
process.env.ASSISTANT_GATEWAY_PORT = "18789";

import { appendFileSync } from "node:fs";

function log(step) {
  console.log(`${new Date().toISOString()} ${step}`);
  try {
    appendFileSync("tmp-gateway-diagnostic.log", `${new Date().toISOString()} ${step}\n`);
  } catch {
    // ignore logging fallback errors
  }
}

function failAfter(label, ms) {
  return setTimeout(() => {
    console.error(`TIMEOUT ${label}`);
    process.exit(124);
  }, ms);
}

log("diagnostic start");

let timer = failAfter("import config", 60_000);
const startupConfig = await import("./src/gateway/server-startup-config.ts");
clearTimeout(timer);
log("import config done");

timer = failAfter("import plugins", 60_000);
const startupPlugins = await import("./src/gateway/server-startup-plugins.ts");
clearTimeout(timer);
log("import plugins done");

timer = failAfter("import runtime config", 60_000);
const runtimeConfigModule = await import("./src/gateway/server-runtime-config.ts");
clearTimeout(timer);
log("import runtime config done");

const logObj = {
  info: (message) => log(`info ${message}`),
  warn: (message) => log(`warn ${message}`),
  error: (message) => log(`error ${message}`),
  debug: (message) => log(`debug ${message}`),
};

timer = failAfter("load config snapshot", 30_000);
const configSnapshot = await startupConfig.loadGatewayStartupConfigSnapshot({
  minimalTestGateway: true,
  log: logObj,
});
clearTimeout(timer);
log(`load config snapshot done exists=${configSnapshot.exists} valid=${configSnapshot.valid}`);

log("create runtime secrets activator start");
const activateRuntimeSecrets = startupConfig.createRuntimeSecretsActivator({
  logSecrets: logObj,
  emitStateEvent: () => {},
  prepareRuntimeSecretsSnapshot: async ({ config }) => {
    log("stub prepare runtime secrets snapshot");
    return {
      sourceConfig: config,
      config,
      warnings: [],
      secrets: new Map(),
    };
  },
  activateRuntimeSecretsSnapshot: () => {
    log("stub activate runtime secrets snapshot");
  },
});
log("create runtime secrets activator done");

log("prepare startup config start");
timer = failAfter("prepare startup config", 30_000);
const authBootstrap = await startupConfig.prepareGatewayStartupConfig({
  configSnapshot,
  authOverride: { mode: "none" },
  activateRuntimeSecrets,
});
clearTimeout(timer);
log("prepare startup config done");

timer = failAfter("prepare plugin bootstrap", 30_000);
const pluginBootstrap = await startupPlugins.prepareGatewayPluginBootstrap({
  cfgAtStart: authBootstrap.cfg,
  startupRuntimeConfig: authBootstrap.cfg,
  minimalTestGateway: true,
  log: logObj,
});
clearTimeout(timer);
log(`prepare plugin bootstrap done baseMethods=${pluginBootstrap.baseMethods.length}`);

timer = failAfter("resolve runtime config", 30_000);
const runtimeConfig = await runtimeConfigModule.resolveGatewayRuntimeConfig({
  cfg: authBootstrap.cfg,
  port: 18789,
  bind: "loopback",
  auth: { mode: "none" },
});
clearTimeout(timer);
log(`resolve runtime config done bindHost=${runtimeConfig.bindHost}`);
