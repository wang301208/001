import { Key, matchesKey } from "./adapters/index.js";
import { resolveAgentIdByWorkspacePath, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { resolveContextTokensForModel } from "../agents/context.js";
import { loadConfig, type ZhushouConfig } from "../config/config.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { appendFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildAgentMainSessionKey,
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { GatewayChatClient } from "./gateway-chat.js";
import type {
  AgentSummary,
  SessionInfo,
  SessionScope,
  TuiOptions,
} from "./tui-types.js";
import {
  createConsciousnessTuiState,
  type ConsciousnessTuiState,
} from "./tui-consciousness.js";
import { TuiController, type TuiControllerDeps } from "./controllers/index.js";

export { resolveFinalZhushouText } from "./tui-formatters.js";
export type { TuiOptions } from "./tui-types.js";
export {
  createEditorSubmitHandler,
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "./tui-submit.js";
export { TuiController, type TuiControllerDeps } from "./controllers/index.js";

function appendTuiDebugLog(line: string) {
  try {
    const dir = path.join(os.homedir(), ".zhushou", "logs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, "tui-startup.log"),
      `${new Date().toISOString()} ${line}\n`,
      "utf8",
    );
  } catch {
  }
}

export function resolveTuiSessionKey(params: {
  raw?: string;
  sessionScope: SessionScope;
  currentAgentId: string;
  sessionMainKey: string;
}) {
  const trimmed = (params.raw ?? "").trim();
  if (!trimmed) {
    if (params.sessionScope === "global") {
      return "global";
    }
    return buildAgentMainSessionKey({
      agentId: params.currentAgentId,
      mainKey: params.sessionMainKey,
    });
  }
  if (trimmed === "global" || trimmed === "unknown") {
    return trimmed;
  }
  if (trimmed.startsWith("agent:")) {
    return normalizeLowercaseStringOrEmpty(trimmed);
  }
  return `agent:${params.currentAgentId}:${normalizeLowercaseStringOrEmpty(trimmed)}`;
}

export function resolveInitialTuiAgentId(params: {
  cfg: ZhushouConfig;
  fallbackAgentId: string;
  initialSessionInput?: string;
  cwd?: string;
}) {
  const parsed = parseAgentSessionKey((params.initialSessionInput ?? "").trim());
  if (parsed?.agentId) {
    return normalizeAgentId(parsed.agentId);
  }

  const inferredFromWorkspace = resolveAgentIdByWorkspacePath(
    params.cfg,
    params.cwd ?? process.cwd(),
  );
  if (inferredFromWorkspace) {
    return inferredFromWorkspace;
  }

  return normalizeAgentId(params.fallbackAgentId);
}

export function resolveInitialTuiSessionInfo(params: {
  cfg: ZhushouConfig;
  agentId?: string;
}): SessionInfo {
  const modelRef = resolveDefaultModelForAgent({
    cfg: params.cfg,
    agentId: params.agentId,
  });
  const contextTokens =
    resolveContextTokensForModel({
      cfg: params.cfg,
      provider: modelRef.provider,
      model: modelRef.model,
      allowAsyncLoad: false,
    }) ?? null;
  return {
    modelProvider: modelRef.provider,
    model: modelRef.model,
    contextTokens,
    totalTokens: 0,
    totalTokensFresh: false,
  };
}

export function resolveGatewayDisconnectState(reason?: string): {
  connectionStatus: string;
  activityStatus: string;
  pairingHint?: string;
} {
  const reasonLabel = reason?.trim() ? reason.trim() : "已关闭";
  if (/pairing required/i.test(reasonLabel)) {
    return {
      connectionStatus: `后端已断开: ${reasonLabel}`,
      activityStatus: "需要配对: 运行 zhushou devices list",
      pairingHint:
        "需要设备配对。请运行 `zhushou devices list`，批准你的请求 ID，然后重新连接。",
    };
  }
  return {
    connectionStatus: `后端已断开: ${reasonLabel}`,
    activityStatus: "idle",
  };
}

export function createBackspaceDeduper(params?: { dedupeWindowMs?: number; now?: () => number }) {
  const dedupeWindowMs = Math.max(0, Math.floor(params?.dedupeWindowMs ?? 8));
  const now = params?.now ?? (() => Date.now());
  let lastBackspaceAt = -1;

  return (data: string): string => {
    if (!matchesKey(data, Key.backspace)) {
      return data;
    }
    const ts = now();
    if (lastBackspaceAt >= 0 && ts - lastBackspaceAt <= dedupeWindowMs) {
      return "";
    }
    lastBackspaceAt = ts;
    return data;
  };
}

export function isIgnorableTuiStopError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: unknown; syscall?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  const syscall = typeof err.syscall === "string" ? err.syscall : "";
  const message = typeof err.message === "string" ? err.message : "";
  if (code === "EBADF" && syscall === "setRawMode") {
    return true;
  }
  return /setRawMode/i.test(message) && /EBADF/i.test(message);
}

export function stopTuiSafely(stop: () => void): void {
  try {
    stop();
  } catch (error) {
    if (!isIgnorableTuiStopError(error)) {
      throw error;
    }
  }
}

type DrainableTui = {
  stop: () => void;
  terminal?: {
    drainInput?: (maxMs?: number, idleMs?: number) => Promise<void>;
  };
};

export async function drainAndStopTuiSafely(tui: DrainableTui): Promise<void> {
  if (typeof tui.terminal?.drainInput === "function") {
    try {
      await tui.terminal.drainInput();
    } catch {
    }
  }
  stopTuiSafely(() => tui.stop());
}

type CtrlCAction = "clear" | "warn" | "exit";

export function resolveCtrlCAction(params: {
  hasInput: boolean;
  now: number;
  lastCtrlCAt: number;
  exitWindowMs?: number;
  dedupeWindowMs?: number;
}): { action: CtrlCAction; nextLastCtrlCAt: number } {
  const exitWindowMs = Math.max(1, Math.floor(params.exitWindowMs ?? 1000));
  const dedupeWindowMs = Math.max(0, Math.floor(params.dedupeWindowMs ?? 80));
  if (params.lastCtrlCAt > 0 && params.now - params.lastCtrlCAt <= dedupeWindowMs) {
    return {
      action: "warn",
      nextLastCtrlCAt: params.lastCtrlCAt,
    };
  }
  if (params.hasInput) {
    return {
      action: "clear",
      nextLastCtrlCAt: params.now,
    };
  }
  if (params.now - params.lastCtrlCAt <= exitWindowMs) {
    return {
      action: "exit",
      nextLastCtrlCAt: params.lastCtrlCAt,
    };
  }
  return {
      action: "warn",
      nextLastCtrlCAt: params.now,
  };
}

export async function runTui(opts: TuiOptions) {
  appendTuiDebugLog("runTui:start");
  const config = loadConfig();
  appendTuiDebugLog("config:loaded");
  const initialSessionInput = (opts.session ?? "").trim();
  const sessionScope: SessionScope = (config.session?.scope ?? "per-sender") as SessionScope;
  const sessionMainKey = normalizeMainKey(config.session?.mainKey);
  const agentDefaultId = resolveDefaultAgentId(config);
  const currentAgentId = resolveInitialTuiAgentId({
    cfg: config,
    fallbackAgentId: agentDefaultId,
    initialSessionInput,
    cwd: process.cwd(),
  });
  const agents: AgentSummary[] = [];
  const agentNames = new Map<string, string>();
  const deliverDefault = opts.deliver ?? false;
  const autoMessage = opts.message?.trim();
  const consciousnessState = createConsciousnessTuiState();

  appendTuiDebugLog(`connect:begin url=${opts.url ? "set" : "stdio"}`);
  const client = await GatewayChatClient.connect({
    url: opts.url,
    token: opts.token,
    password: opts.password,
  });
  appendTuiDebugLog(`connect:created kind=${client.connection.kind ?? "websocket"}`);

  const controller = new TuiController({
    client,
    opts,
    config,
    initialSessionInput,
    currentAgentId,
    agentDefaultId,
    sessionScope,
    sessionMainKey,
    agents,
    agentNames,
    consciousnessState,
    deliverDefault,
    autoMessage,
    appendTuiDebugLog,
  });

  const sigintHandler = () => {
    controller.getHandleCtrlC()();
  };
  const sigtermHandler = () => {
    controller.getRequestExit()();
  };
  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigtermHandler);

  appendTuiDebugLog("client:start");
  client.start();
  appendTuiDebugLog("client:started");
  controller.start();
  appendTuiDebugLog("tui:started");

  await new Promise<void>((resolve) => {
    const finish = () => {
      process.removeListener("SIGINT", sigintHandler);
      process.removeListener("SIGTERM", sigtermHandler);
      resolve();
    };
    process.once("exit", finish);
  });
}
