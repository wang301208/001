import { spawn, type ChildProcess } from "node:child_process";
import { formatErrorMessage } from "../infra/errors.js";

export type VoiceInputResult =
  | { ok: true; text: string; source: string }
  | { ok: false; message: string; setupHint: string };

export type VoiceInputOptions = {
  command?: string;
  args?: string[];
  timeoutMs?: number;
  spawnProcess?: typeof spawn;
};

const DEFAULT_TIMEOUT_MS = 60_000;

function splitCommandLine(value: string): { command: string; args: string[] } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [command, ...args] = parts.map((part) => part.replace(/^"|"$/g, ""));
  if (!command) {
    return null;
  }
  return { command, args };
}

function resolveVoiceCommand(options: VoiceInputOptions = {}) {
  if (options.command?.trim()) {
    return { command: options.command.trim(), args: options.args ?? [] };
  }
  const fromEnv = splitCommandLine(process.env.ASSISTANT_TUI_STT_COMMAND ?? "");
  if (fromEnv) {
    return fromEnv;
  }
  return null;
}

export function getVoiceInputSetupHint(): string {
  return [
    "语音输入未配置。",
    "设置 ASSISTANT_TUI_STT_COMMAND 为一个录音并输出转写文本的命令，例如：",
    'ASSISTANT_TUI_STT_COMMAND="python scripts/local-stt-once.py"',
    "该命令应在 stdout 输出识别出的自然语言文本；助手会把它当作普通输入继续调用全部能力。",
  ].join("\n");
}

export async function captureVoiceInput(options: VoiceInputOptions = {}): Promise<VoiceInputResult> {
  const resolved = resolveVoiceCommand(options);
  if (!resolved) {
    return {
      ok: false,
      message: "语音输入命令未配置",
      setupHint: getVoiceInputSetupHint(),
    };
  }

  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const spawnProcess = options.spawnProcess ?? spawn;

  return await new Promise<VoiceInputResult>((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let proc: ChildProcess;

    const finish = (result: VoiceInputResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        proc?.kill();
      } catch {
        // best-effort only
      }
      finish({
        ok: false,
        message: `语音输入超时：${timeoutMs}ms`,
        setupHint: getVoiceInputSetupHint(),
      });
    }, timeoutMs);
    timer.unref?.();

    try {
      proc = spawnProcess(resolved.command, resolved.args, {
        shell: process.platform === "win32",
        windowsHide: true,
      });
    } catch (err) {
      finish({
        ok: false,
        message: `语音输入启动失败: ${formatErrorMessage(err)}`,
        setupHint: getVoiceInputSetupHint(),
      });
      return;
    }

    proc.stdout?.setEncoding("utf8");
    proc.stderr?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.once("error", (err) => {
      finish({
        ok: false,
        message: `语音输入失败: ${formatErrorMessage(err)}`,
        setupHint: getVoiceInputSetupHint(),
      });
    });
    proc.once("exit", (code, signal) => {
      const text = stdout.trim();
      if (code === 0 && text) {
        finish({ ok: true, text, source: resolved.command });
        return;
      }
      const reason = signal ? `信号 ${signal}` : `退出 ${code ?? "未知"}`;
      const detail = stderr.trim() || stdout.trim() || "未产生转写文本";
      finish({
        ok: false,
        message: `语音输入失败 (${reason}): ${detail}`,
        setupHint: getVoiceInputSetupHint(),
      });
    });
  });
}
