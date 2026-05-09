import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import path from "node:path";
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
    ? `${truncateUtf16Safe(line, MAX_LOG_LINE_BYTES)} [truncated ${line.length} bytes]`
    : line;
}

function jsonRpcErrorToError(raw: unknown): Error {
  if (raw && typeof raw === "object" && "message" in raw) {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }
  return new Error("stdio gateway request failed");
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

function resolvePythonExecutable(root: string): string {
  const configured =
    process.env.ASSISTANT_PYTHON?.trim() || process.env.PYTHON?.trim();
  if (configured) {
    return configured;
  }

  const venv = process.env.VIRTUAL_ENV?.trim();
  const candidates = [
    venv ? path.resolve(venv, "Scripts", "python.exe") : "",
    venv ? path.resolve(venv, "bin", "python") : "",
    venv ? path.resolve(venv, "bin", "python3") : "",
    path.resolve(root, ".venv", "Scripts", "python.exe"),
    path.resolve(root, ".venv", "bin", "python"),
    path.resolve(root, ".venv", "bin", "python3"),
    path.resolve(root, "venv", "Scripts", "python.exe"),
    path.resolve(root, "venv", "bin", "python"),
    path.resolve(root, "venv", "bin", "python3"),
  ];
  const hit = candidates.find((candidate) => candidate && existsSync(candidate));
  return hit || (process.platform === "win32" ? "python" : "python3");
}

function withPythonPath(root: string): NodeJS.ProcessEnv {
  const pyPath = process.env.PYTHONPATH?.trim();
  return {
    ...process.env,
    PYTHONPATH: pyPath ? `${root}${delimiter}${pyPath}` : root,
    PYTHONIOENCODING: process.env.PYTHONIOENCODING?.trim() || "utf-8",
    PYTHONUTF8: process.env.PYTHONUTF8?.trim() || "1",
  };
}

function resolveDefaultStdioGatewayProcess(): ResolvedStdioGatewayProcess {
  const root = process.env.ASSISTANT_PYTHON_SRC_ROOT?.trim() || process.cwd();
  return {
    command: resolvePythonExecutable(root),
    args: ["-m", "tui_gateway.entry"],
    cwd: process.env.ASSISTANT_GATEWAY_CWD?.trim() || root,
    env: withPythonPath(root),
  };
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
      parsePositiveInteger(process.env.ASSISTANT_TUI_STARTUP_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS);
    this.requestTimeoutMs =
      opts.requestTimeoutMs ??
      parsePositiveInteger(process.env.ASSISTANT_TUI_RPC_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
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
        `[startup] timed out waiting for gateway.ready (command=${resolved.command}, cwd=${resolved.cwd ?? process.cwd()})`,
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
      this.pushLog(`[spawn] ${error.message}`);
      this.rejectPending(new Error(`stdio gateway error: ${error.message}`));
      this.onEvent?.({ event: "gateway.stderr", payload: { line: `[spawn] ${error.message}` } });
    });

    this.proc.once("exit", (code, signal) => {
      this.clearReadyTimer();
      const reason = signal ? `signal ${signal}` : `exit ${code ?? "unknown"}`;
      this.rejectPending(new Error(`stdio gateway exited (${reason})`));
      this.onDisconnected?.(reason);
    });
  }

  stop() {
    this.clearReadyTimer();
    this.rejectPending(new Error("stdio gateway stopped"));
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
      throw new Error("stdio gateway not running");
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
        reject(new Error(`stdio gateway request timeout for ${method}`));
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
      const preview = raw.trim().slice(0, MAX_LOG_PREVIEW) || "(empty line)";
      this.pushLog(`[protocol] malformed stdout: ${preview}`);
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
