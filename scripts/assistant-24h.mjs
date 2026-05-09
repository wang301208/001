#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const runtimeDir = path.join(repoRoot, ".tmp", "assistant-24h");
const logDir = path.join(runtimeDir, "logs");
const statePath = path.join(runtimeDir, "state.json");

const command = process.argv[2] ?? "help";
const optionArgs = process.argv.slice(3);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = optionArgs.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = optionArgs.indexOf(`--${name}`);
  if (index !== -1 && optionArgs[index + 1]) {
    return optionArgs[index + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return optionArgs.includes(`--${name}`) || process.env[`ASSISTANT_24H_${name.toUpperCase().replaceAll("-", "_")}`] === "1";
}

function readNumberOption(name, fallback) {
  const raw = readOption(name, String(fallback));
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function ensureRuntimeDirs() {
  fs.mkdirSync(logDir, { recursive: true });
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  ensureRuntimeDirs();
  fs.writeFileSync(statePath, `${JSON.stringify({ ...state, updatedAt: Date.now() }, null, 2)}\n`);
}

function appendSupervisorLog(message) {
  ensureRuntimeDirs();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logDir, "supervisor.log"), line);
  if (process.stdout.isTTY) {
    process.stdout.write(line);
  }
}

function isProcessAlive(pid) {
  if (!pid || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killProcessTree(pid) {
  if (!isProcessAlive(pid)) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }

  await sleep(1500);
  if (isProcessAlive(pid)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Already exited.
      }
    }
  }
}

async function checkHealth(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildConfig() {
  const gatewayPort = readNumberOption(
    "gateway-port",
    Number(process.env.ASSISTANT_GATEWAY_PORT ?? process.env.ASSISTANT_WEB_PORT ?? 3000),
  );
  const webPort = gatewayPort;
  const intervalMs = readNumberOption(
    "interval-ms",
    Number(process.env.ASSISTANT_24H_INTERVAL_MS ?? 30000),
  );
  const startupGraceMs = readNumberOption(
    "startup-grace-ms",
    Number(process.env.ASSISTANT_24H_STARTUP_GRACE_MS ?? 45000),
  );
  const healthFailLimit = readNumberOption(
    "health-fail-limit",
    Number(process.env.ASSISTANT_24H_HEALTH_FAIL_LIMIT ?? 3),
  );
  const webHost = readOption("web-host", process.env.ASSISTANT_WEB_HOST ?? "127.0.0.1");
  const publicUrl = `http://${webHost}:${webPort}/`;

  return {
    gatewayPort,
    webPort,
    publicUrl,
    intervalMs,
    startupGraceMs,
    healthFailLimit,
    gatewayBind: readOption("gateway-bind", process.env.ASSISTANT_GATEWAY_BIND ?? "loopback"),
    gatewayMode: readOption("gateway-mode", process.env.ASSISTANT_24H_GATEWAY_MODE ?? "dist"),
    gatewayToken: process.env.ASSISTANT_GATEWAY_TOKEN || "",
    allowUnconfigured: hasFlag("allow-unconfigured"),
    webHost,
  };
}

function buildServiceDefinitions(config) {
  const gatewayHealthUrl = `${config.publicUrl}healthz`;
  const gatewayArgs = [
    config.gatewayMode === "dev" ? "scripts/run-node.mjs" : "assistant.mjs",
    "gateway",
    "run",
    "--bind",
    config.gatewayBind,
    "--port",
    String(config.gatewayPort),
  ];
  if (config.allowUnconfigured) {
    gatewayArgs.push("--allow-unconfigured");
  }

  const services = [
    {
      name: "gateway",
      command: process.execPath,
      args: gatewayArgs,
      cwd: repoRoot,
      env: {
        ...(config.gatewayToken ? { ASSISTANT_GATEWAY_TOKEN: config.gatewayToken } : {}),
        ASSISTANT_GATEWAY_PORT: String(config.gatewayPort),
        ASSISTANT_GATEWAY_BIND: config.gatewayBind,
      },
      healthUrl: gatewayHealthUrl,
    },
  ];

  return services;
}

function spawnManagedService(definition, config) {
  ensureRuntimeDirs();
  const logPath = path.join(logDir, `${definition.name}.log`);
  const fd = fs.openSync(logPath, "a");
  const child = spawn(definition.command, definition.args, {
    cwd: definition.cwd,
    env: {
      ...process.env,
      ...definition.env,
      ASSISTANT_24H_SUPERVISED: "1",
    },
    stdio: ["ignore", fd, fd],
    detached: true,
    windowsHide: true,
  });
  fs.closeSync(fd);

  const serviceState = {
    name: definition.name,
    pid: child.pid,
    command: [definition.command, ...definition.args].join(" "),
    healthUrl: definition.healthUrl,
    logPath,
    startedAt: Date.now(),
    failures: 0,
    lastExit: null,
  };

  child.on("exit", (code, signal) => {
    serviceState.lastExit = { code, signal, at: Date.now() };
    appendSupervisorLog(`${definition.name} exited code=${code ?? "null"} signal=${signal ?? "null"}`);
  });

  appendSupervisorLog(`${definition.name} started pid=${child.pid}`);
  return serviceState;
}

async function superviseCommand() {
  ensureRuntimeDirs();
  const config = buildConfig();
  const definitions = buildServiceDefinitions(config);
  const services = new Map();

  const persist = () => {
    writeState({
      supervisorPid: process.pid,
      repoRoot,
      config,
      services: Object.fromEntries(services.entries()),
    });
  };

  const stopAll = async () => {
    appendSupervisorLog("stopping supervised services");
    for (const service of services.values()) {
      await killProcessTree(service.pid);
    }
    persist();
  };

  process.on("SIGINT", () => {
    void stopAll().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void stopAll().finally(() => process.exit(0));
  });

  appendSupervisorLog(`one-shot supervisor started pid=${process.pid}`);
  appendSupervisorLog(`Unified frontend/gateway entry: ${config.publicUrl}`);
  for (const definition of definitions) {
    services.set(definition.name, spawnManagedService(definition, config));
  }
  persist();

  while (true) {
    await sleep(config.intervalMs);

    for (const definition of definitions) {
      const service = services.get(definition.name);
      if (!service) {
        continue;
      }
      const alive = isProcessAlive(service?.pid);
      if (!alive) {
        appendSupervisorLog(`${definition.name} is not running; leaving stopped`);
        service.lastHealth = { ok: false, at: Date.now(), error: "process stopped" };
        persist();
        continue;
      }

      const withinStartupGrace = Date.now() - service.startedAt < config.startupGraceMs;
      const health = await checkHealth(definition.healthUrl);
      if (health.ok) {
        if (service.failures !== 0) {
          appendSupervisorLog(`${definition.name} health recovered`);
        }
        service.failures = 0;
        service.lastHealth = { ok: true, at: Date.now(), status: health.status };
        persist();
        continue;
      }

      service.lastHealth = { ok: false, at: Date.now(), error: health.error, status: health.status };
      if (withinStartupGrace) {
        persist();
        continue;
      }

      service.failures += 1;
      appendSupervisorLog(
        `${definition.name} health failed (${service.failures}/${config.healthFailLimit}): ${
          health.error ?? health.status ?? "unknown"
        }`,
      );
      persist();
    }
  }
}

async function startCommand() {
  console.error("Assistant 24h automatic supervisor has been removed. Start the gateway manually with `node assistant.mjs gateway run`.");
  process.exitCode = 1;
}

async function stopCommand() {
  const state = readState();
  if (!state.supervisorPid && !state.services) {
    console.log("Assistant 24h supervisor is not recorded as running.");
    return;
  }

  for (const service of Object.values(state.services ?? {})) {
    if (service?.pid) {
      await killProcessTree(service.pid);
    }
  }

  if (state.supervisorPid && state.supervisorPid !== process.pid) {
    await killProcessTree(state.supervisorPid);
  }

  writeState({
    supervisorPid: null,
    repoRoot,
    services: {},
    stoppedAt: Date.now(),
  });
  console.log("Assistant 24h supervisor stopped.");
}

async function statusCommand() {
  const state = readState();
  const supervisorAlive = isProcessAlive(state.supervisorPid);
  console.log(`Supervisor: ${supervisorAlive ? "running" : "stopped"}${state.supervisorPid ? ` pid=${state.supervisorPid}` : ""}`);
  if (state.config?.publicUrl) {
    console.log(`Unified frontend/gateway entry: ${state.config.publicUrl}`);
  }

  const services = Object.values(state.services ?? {});
  if (services.length === 0) {
    process.exitCode = supervisorAlive ? 0 : 1;
    return;
  }

  let allOk = supervisorAlive;
  for (const service of services) {
    const alive = isProcessAlive(service.pid);
    const health = service.healthUrl ? await checkHealth(service.healthUrl, 3000) : { ok: alive };
    const status = alive && health.ok ? "ok" : alive ? "unhealthy" : "stopped";
    if (status !== "ok") {
      allOk = false;
    }
    console.log(
      `${service.name}: ${status} pid=${service.pid ?? "n/a"} health=${service.healthUrl ?? "n/a"} log=${service.logPath ?? "n/a"}`,
    );
  }
  process.exitCode = allOk ? 0 : 1;
}

function installTaskCommand() {
  console.error("Assistant 24h automatic supervisor task installation has been removed.");
  process.exitCode = 1;
}

function uninstallTaskCommand() {
  console.error("Assistant 24h automatic supervisor task removal has been removed.");
  process.exitCode = 1;
}

function printHelp() {
  console.log(`Usage: node scripts/assistant-24h.mjs <command> [options]

Commands:
  supervise       Start managed services once and monitor without restarting them.
  start           Removed: automatic supervisor startup is disabled.
  stop            Stop the supervisor and child processes.
  restart         Removed: automatic supervisor restart is disabled.
  status          Print process and health status.
  install-task    Removed: automatic task installation is disabled.
  uninstall-task  Removed: automatic task removal is disabled.

Options:
  --gateway-port <port>       Unified frontend/gateway listen port. Default: 3000
  --gateway-bind <mode>       Default: loopback
  --allow-unconfigured        Pass through gateway startup without gateway.mode
  --web-port <port>           Alias for the unified listen port. Default: 3000
  --web-host <host>           Unified bind host. Default: 127.0.0.1
  --web-mode <dev|preview>    Deprecated: frontend is served by the gateway process
  --gateway-mode <dist|dev>   Default: dist
  --interval-ms <ms>          Default: 30000

Environment:
  ASSISTANT_GATEWAY_TOKEN       Optional token passed to the internal gateway process
  ASSISTANT_24H_DISABLE_WEB=1   Deprecated: frontend is served by the gateway process
`);
}

switch (command) {
  case "supervise":
    await superviseCommand();
    break;
  case "start":
    await startCommand();
    break;
  case "stop":
    await stopCommand();
    break;
  case "restart":
    await stopCommand();
    await startCommand();
    break;
  case "status":
    await statusCommand();
    break;
  case "install-task":
    installTaskCommand();
    break;
  case "uninstall-task":
    uninstallTaskCommand();
    break;
  default:
    printHelp();
    process.exitCode = command === "help" || command === "--help" || command === "-h" ? 0 : 1;
}
