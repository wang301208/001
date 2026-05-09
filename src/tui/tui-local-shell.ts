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
      deps.chatLog.addSystem("Allow local shell commands for this session?");
      deps.chatLog.addSystem(
        "This runs commands on YOUR machine (not the gateway) and may delete files or reveal secrets.",
      );
      deps.chatLog.addSystem("Select Yes/No (arrows + Enter), Esc to cancel.");
      const selector = createSelector(
        [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ],
        2,
      );
      selector.onSelect = (item) => {
        deps.closeOverlay();
        if (item.value === "yes") {
          localExecAllowed = true;
          deps.chatLog.addSystem("local shell: enabled for this session");
          resolve(true);
        } else {
          deps.chatLog.addSystem("local shell: not enabled");
          resolve(false);
        }
        deps.tui.requestRender();
      };
      selector.onCancel = () => {
        deps.closeOverlay();
        deps.chatLog.addSystem("local shell: cancelled");
        deps.tui.requestRender();
        resolve(false);
      };
      deps.openOverlay(selector);
      deps.tui.requestRender();
    });
  };

  const runLocalShellLine = async (line: string) => {
    const cmd = line.slice(1);
    // NOTE: A lone '!' is handled by the submit handler as a normal message.
    // Keep this guard anyway in case this is called directly.
    if (cmd === "") {
      return;
    }

    if (localExecAsked && !localExecAllowed) {
      deps.chatLog.addSystem("local shell: not enabled for this session");
      deps.tui.requestRender();
      return;
    }

    const allowed = await ensureLocalExecAllowed();
    if (!allowed) {
      return;
    }

    const cwd = getCwd();
    const redirection = parseShellRedirection(cmd, cwd);
    deps.chatLog.addSystem(`[local] $ ${cmd}`);
    deps.tui.requestRender();

    const appendWithCap = (text: string, chunk: string) => {
      const combined = text + chunk;
      return combined.length > maxChars ? combined.slice(-maxChars) : combined;
    };

    await new Promise<void>((resolve) => {
      const child = spawnCommand(redirection.command, {
        // Intentionally a shell: this is an operator-only local TUI feature (prefixed with `!`)
        // and is gated behind an explicit in-session approval prompt.
        shell: true,
        cwd,
        env: { ...env, ASSISTANT_SHELL: "tui-local" },
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
        streamLines("[local]", chunk);
      });
      child.stderr.on("data", (buf) => {
        const chunk = buf.toString("utf8");
        stderr = appendWithCap(stderr, chunk);
        streamLines("[local:err]", chunk);
      });

      child.on("close", (code, signal) => {
        const finish = () => {
          if (redirection.stdoutFile) {
            deps.chatLog.addSystem(`[local] redirected stdout to ${redirection.stdoutFile}`);
          }
          deps.chatLog.addSystem(
            `[local] exit ${code ?? "?"}${signal ? ` (signal ${signal})` : ""}`,
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
        deps.chatLog.addSystem(`[local] error: ${String(err)}`);
        deps.tui.requestRender();
        resolve();
      });
    });
  };

  return { runLocalShellLine };
}
