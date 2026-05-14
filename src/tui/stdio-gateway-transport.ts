import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createInterface, type Interface } from "node:readline";
import { truncateUtf16Safe } from "../utils.js";
import type { GatewayEvent } from "./gateway-chat.js";

const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const MAX_LOG_LINES = 200;
const MAX_LOG_LINE_BYTES = 4096;
const MAX_LOG_PREVIEW = 240;

type StdioChildProcess = Pick<ChildProcess, "stdin" | "stdout" | "stderr" | "killed" | "exitCode"> &
  EventEmitter & {
    kill: (signal?: NodeJS.Signals | number) => boolean;
  };

type SpawnGatewayProcess = (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio: ["pipe", "pipe", "pipe"];
    windowsHide?: boolean;
  },
) => StdioChildProcess;

type ResolvedStdioGatewayProcess = {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

type PendingRequest = {
  id: string;
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type JsonRpcRequest = {
  id: string;
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  id?: unknown;
  result?: unknown;
  error?: unknown;
};

type JsonRpcEvent = {
  method?: unknown;
  params?: unknown;
};

export type { SpawnGatewayProcess };

export type StdioGatewayTransportOptions = {
  spawn?: SpawnGatewayProcess;
  resolveProcess?: () => ResolvedStdioGatewayProcess;
  startupTimeoutMs?: number;
  requestTimeoutMs?: number;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truncateLogLine(line: string): string {
  return line.length > MAX_LOG_LINE_BYTES
    ? `${truncateUtf16Safe(line, MAX_LOG_LINE_BYTES)} [已截断 ${line.length} 字节]`
    : line;
}

function jsonRpcErrorToError(raw: unknown): Error {
  if (raw && typeof raw === "object" && "message" in raw) {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }
  return new Error("stdio 网关请求失败");
}

function normalizeEventParams(params: unknown): GatewayEvent | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return null;
  }
  const record = params as {
    type?: unknown;
    event?: unknown;
    payload?: unknown;
    seq?: unknown;
  };
  const event =
    typeof record.event === "string"
      ? record.event
      : typeof record.type === "string"
        ? record.type
        : "";
  if (!event) {
    return null;
  }
  return {
    event,
    payload: record.payload,
    ...(typeof record.seq === "number" ? { seq: record.seq } : {}),
  };
}

function resolveNodeStdioGatewayProcess(): ResolvedStdioGatewayProcess {
  const root = process.env.ZHUSHOU_GATEWAY_CWD?.trim() || process.cwd();
  return {
    command: process.execPath,
    args: ["zhushou.mjs", "stdio-gateway"],
    cwd: root,
    env: {
      ...process.env,
      ZHUSHOU_STDIO_GATEWAY_BRIDGE: "1",
    },
  };
}

function resolveDefaultStdioGatewayProcess(): ResolvedStdioGatewayProcess {
  return resolveNodeStdioGatewayProcess();
}

function appendDebugLog(line: string) {
  try {
    const dir = path.join(os.homedir(), ".zhushou", "logs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, "tui-stdio-gateway.log"),
      `${new Date().toISOString()} ${line}\n`,
      "utf8",
    );
  } catch {
    // 调试日志绝不能影响网关启动。
  }
}

export class StdioGatewayTransport {
  private proc: StdioChildProcess | null = null;
  private stdoutRl: Interface | null = null;
  private stderrRl: Interface | null = null;
  private pending = new Map<string, PendingRequest>();
  private logs: string[] = [];
  private nextId = 0;
  private ready = false;
  private readyTimer: NodeJS.Timeout | null = null;
  private readonly spawnProcess: SpawnGatewayProcess;
  private readonly resolveProcess: () => ResolvedStdioGatewayProcess;
  private readonly startupTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  onEvent?: (evt: GatewayEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  constructor(opts: StdioGatewayTransportOptions = {}) {
    this.spawnProcess = opts.spawn ?? ((command, args, options) => spawn(command, args, options));
    this.resolveProcess = opts.resolveProcess ?? resolveDefaultStdioGatewayProcess;
    this.startupTimeoutMs =
      opts.startupTimeoutMs ??
      parsePositiveInteger(process.env.ZHUSHOU_TUI_STARTUP_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS);
    this.requestTimeoutMs =
      opts.requestTimeoutMs ??
      parsePositiveInteger(process.env.ZHUSHOU_TUI_RPC_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
  }

  start() {
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) {
      return;
    }

    this.ready = false;
    this.clearReadyTimer();
    this.stdoutRl?.close();
    this.stderrRl?.close();
    this.stdoutRl = null;
    this.stderrRl = null;

    const resolved = this.resolveProcess();
    appendDebugLog(
      `spawn command=${resolved.command} args=${JSON.stringify(resolved.args)} cwd=${resolved.cwd ?? process.cwd()}`,
    );
    this.proc = this.spawnProcess(resolved.command, resolved.args, {
      cwd: resolved.cwd,
      env: resolved.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.readyTimer = setTimeout(() => {
      if (this.ready) {
        return;
      }
      const stderrTail = this.getLogTail(20);
      this.pushLog(
        `[启动] 等待 gateway.ready 超时 (命令=${resolved.command}, cwd=${resolved.cwd ?? process.cwd()})`,
      );
      this.onEvent?.({
        event: "gateway.start_timeout",
        payload: {
          command: resolved.command,
          args: resolved.args,
          cwd: resolved.cwd ?? process.cwd(),
          stderrTail,
        },
      });
    }, this.startupTimeoutMs);
    this.readyTimer.unref?.();

    if (this.proc.stdout) {
      this.stdoutRl = createInterface({ input: this.proc.stdout });
      this.stdoutRl.on("line", (line) => this.handleStdoutLine(line));
    }

    if (this.proc.stderr) {
      this.stderrRl = createInterface({ input: this.proc.stderr });
      this.stderrRl.on("line", (line) => {
        const trimmed = truncateLogLine(line.trim());
        if (!trimmed) {
          return;
        }
        this.pushLog(trimmed);
        this.onEvent?.({ event: "gateway.stderr", payload: { line: trimmed } });
      });
    }

    this.proc.once("error", (err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      appendDebugLog(`error ${error.message}`);
      this.pushLog(`[spawn] ${error.message}`);
      this.rejectPending(new Error(`stdio 网关错误: ${error.message}`));
      this.onEvent?.({ event: "gateway.stderr", payload: { line: `[spawn] ${error.message}` } });
    });

    this.proc.once("exit", (code, signal) => {
      this.clearReadyTimer();
      const reason = signal ? `信号 ${signal}` : `退出 ${code ?? "未知"}`;
      appendDebugLog(`exit ${reason}`);
      this.rejectPending(new Error(`stdio 网关已退出 (${reason})`));
      this.onDisconnected?.(reason);
    });
  }

  stop() {
    this.clearReadyTimer();
    this.rejectPending(new Error("stdio 网关已停止"));
    this.stdoutRl?.close();
    this.stderrRl?.close();
    this.stdoutRl = null;
    this.stderrRl = null;
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) {
      this.proc.kill();
    }
    this.proc = null;
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.proc?.stdin || this.proc.killed || this.proc.exitCode !== null) {
      this.start();
    }
    if (!this.proc?.stdin) {
      throw new Error("stdio 网关未运行");
    }

    const id = `r${++this.nextId}`;
    const frame: JsonRpcRequest = {
      id,
      jsonrpc: "2.0",
      method,
      ...(params === undefined ? {} : { params }),
    };

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`stdio 网关请求超时: ${method}`));
      }, this.requestTimeoutMs);
      timeout.unref?.();
      this.pending.set(id, {
        id,
        method,
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      try {
        this.proc!.stdin!.write(`${JSON.stringify(frame)}\n`);
      } catch (err) {
        const pending = this.pending.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(id);
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  getLogTail(limit = 20): string {
    return this.logs.slice(-Math.max(1, limit)).join("\n");
  }

  private handleStdoutLine(raw: string) {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      const preview = raw.trim().slice(0, MAX_LOG_PREVIEW) || "(空行)";
      this.pushLog(`[协议] stdout 格式错误: ${preview}`);
      this.onEvent?.({ event: "gateway.protocol_error", payload: { preview } });
      return;
    }

    if (!msg || typeof msg !== "object") {
      return;
    }

    const response = msg as JsonRpcResponse;
    const responseId = typeof response.id === "string" ? response.id : "";
    const pending = responseId ? this.pending.get(responseId) : undefined;
    if (pending) {
      clearTimeout(pending.timeout);
      this.pending.delete(responseId);
      if (response.error) {
        pending.reject(jsonRpcErrorToError(response.error));
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    const eventMessage = msg as JsonRpcEvent;
    if (eventMessage.method !== "event") {
      return;
    }
    const evt = normalizeEventParams(eventMessage.params);
    if (!evt) {
      return;
    }
    if (evt.event === "gateway.ready") {
      this.ready = true;
      this.clearReadyTimer();
      this.onConnected?.();
      return;
    }
    this.onEvent?.(evt);
  }

  private clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private pushLog(line: string) {
    this.logs.push(truncateLogLine(line));
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    }
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
