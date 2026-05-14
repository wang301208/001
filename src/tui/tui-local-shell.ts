import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Component, SelectItem } from "@mariozechner/pi-tui";
import { createSearchableSelectList } from "./components/selectors.js";

type LocalShellDeps = {
  chatLog: {
    addSystem: (line: string) => void;
  };
  tui: {
    requestRender: () => void;
  };
  openOverlay: (component: Component) => void;
  closeOverlay: () => void;
  createSelector?: (
    items: SelectItem[],
    maxVisible: number,
  ) => Component & {
    onSelect?: (item: SelectItem) => void;
    onCancel?: () => void;
  };
  spawnCommand?: typeof spawn;
  getCwd?: () => string;
  env?: NodeJS.ProcessEnv;
  maxOutputChars?: number;
};

type ShellRedirection = {
  command: string;
  stdoutFile?: string;
  append: boolean;
};

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseShellRedirection(command: string, cwd: string): ShellRedirection {
  const match = command.match(/^(.*?)(>>|>)\s*(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/);
  if (!match) {
    return { command, append: false };
  }
  const before = match[1]?.trimEnd() ?? "";
  const operator = match[2] ?? ">";
  const rawTarget = match[3] ?? match[4] ?? match[5] ?? "";
  const target = stripMatchingQuotes(rawTarget);
  if (!before || !target) {
    return { command, append: false };
  }
  return {
    command: before,
    stdoutFile: path.resolve(cwd, target),
    append: operator === ">>",
  };
}

export function createLocalShellRunner(deps: LocalShellDeps) {
  let localExecAsked = false;
  let localExecAllowed = false;
  const createSelector = deps.createSelector ?? createSearchableSelectList;
  const spawnCommand = deps.spawnCommand ?? spawn;
  const getCwd = deps.getCwd ?? (() => process.cwd());
  const env = deps.env ?? process.env;
  const maxChars = deps.maxOutputChars ?? 40_000;

  const ensureLocalExecAllowed = async (): Promise<boolean> => {
    if (localExecAllowed) {
      return true;
    }
    if (localExecAsked) {
      return false;
    }
    localExecAsked = true;

    return await new Promise<boolean>((resolve) => {
      deps.chatLog.addSystem("是否允许本会话执行本地 shell 命令？");
      deps.chatLog.addSystem(
        "这会在你的本机执行命令（不是网关环境），可能删除文件或暴露密钥。",
      );
      deps.chatLog.addSystem("请选择 是/否（方向键 + Enter），Esc 取消。");
      const selector = createSelector(
        [
          { value: "no", label: "否" },
          { value: "yes", label: "是" },
        ],
        2,
      );
      selector.onSelect = (item) => {
        deps.closeOverlay();
        if (item.value === "yes") {
          localExecAllowed = true;
          deps.chatLog.addSystem("本地 shell：本会话已启用");
          resolve(true);
        } else {
          deps.chatLog.addSystem("本地 shell：未启用");
          resolve(false);
        }
        deps.tui.requestRender();
      };
      selector.onCancel = () => {
        deps.closeOverlay();
        deps.chatLog.addSystem("本地 shell：已取消");
        deps.tui.requestRender();
        resolve(false);
      };
      deps.openOverlay(selector);
      deps.tui.requestRender();
    });
  };

  const runLocalShellLine = async (line: string) => {
    const cmd = line.slice(1);
    // 注意：单独的 '!' 由提交处理器作为普通消息处理。
    // 仍保留此守卫以防直接调用。
    if (cmd === "") {
      return;
    }

    if (localExecAsked && !localExecAllowed) {
      deps.chatLog.addSystem("本地 shell：本会话未启用");
      deps.tui.requestRender();
      return;
    }

    const allowed = await ensureLocalExecAllowed();
    if (!allowed) {
      return;
    }

    const cwd = getCwd();
    const redirection = parseShellRedirection(cmd, cwd);
    deps.chatLog.addSystem(`[本地] $ ${cmd}`);
    deps.tui.requestRender();

    const appendWithCap = (text: string, chunk: string) => {
      const combined = text + chunk;
      return combined.length > maxChars ? combined.slice(-maxChars) : combined;
    };

    await new Promise<void>((resolve) => {
      const child = spawnCommand(redirection.command, {
        // 故意使用 shell：这是操作员专属的本地 TUI 功能（以 `!` 为前缀）
        // 且由显式的会话内审批提示门控。
        shell: true,
        cwd,
        env: { ...env, ZHUSHOU_SHELL: "tui-local" },
      });

      let stdout = "";
      let stderr = "";
      const stdoutStream =
        redirection.stdoutFile !== undefined
          ? fs.createWriteStream(redirection.stdoutFile, {
              flags: redirection.append ? "a" : "w",
              encoding: "utf8",
            })
          : null;
      const streamLines = (prefix: string, chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (!line) {
            continue;
          }
          deps.chatLog.addSystem(`${prefix} ${line}`);
        }
        deps.tui.requestRender();
      };
      child.stdout.on("data", (buf) => {
        const chunk = buf.toString("utf8");
        stdout = appendWithCap(stdout, chunk);
        if (stdoutStream) {
          stdoutStream.write(chunk);
          return;
        }
        streamLines("[本地]", chunk);
      });
      child.stderr.on("data", (buf) => {
        const chunk = buf.toString("utf8");
        stderr = appendWithCap(stderr, chunk);
        streamLines("[本地:错误]", chunk);
      });

      child.on("close", (code, signal) => {
        const finish = () => {
          if (redirection.stdoutFile) {
            deps.chatLog.addSystem(`[本地] stdout 已重定向到 ${redirection.stdoutFile}`);
          }
          deps.chatLog.addSystem(
            `[本地] 退出 ${code ?? "?"}${signal ? ` (信号 ${signal})` : ""}`,
          );
          deps.tui.requestRender();
          resolve();
        };
        if (stdoutStream) {
          stdoutStream.end(finish);
          return;
        }
        finish();
      });

      child.on("error", (err) => {
        stdoutStream?.end();
        deps.chatLog.addSystem(`[本地] 错误: ${String(err)}`);
        deps.tui.requestRender();
        resolve();
      });
    });
  };

  return { runLocalShellLine };
}
