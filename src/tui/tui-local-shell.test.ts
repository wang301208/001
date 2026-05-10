import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createLocalShellRunner } from "./tui-local-shell.js";

const createSelector = () => {
  const selector = {
    onSelect: undefined as ((item: { value: string; label: string }) => void) | undefined,
    onCancel: undefined as (() => void) | undefined,
    render: () => ["selector"],
    invalidate: () => {},
  };
  return selector;
};

function createShellHarness(params?: {
  spawnCommand?: typeof import("node:child_process").spawn;
  env?: Record<string, string>;
}) {
  const messages: string[] = [];
  const chatLog = {
    addSystem: (line: string) => {
      messages.push(line);
    },
  };
  const tui = { requestRender: vi.fn() };
  const openOverlay = vi.fn();
  const closeOverlay = vi.fn();
  let lastSelector: ReturnType<typeof createSelector> | null = null;
  const createSelectorSpy = vi.fn(() => {
    lastSelector = createSelector();
    return lastSelector;
  });
  const spawnCommand = params?.spawnCommand ?? vi.fn();
  const { runLocalShellLine } = createLocalShellRunner({
    chatLog,
    tui,
    openOverlay,
    closeOverlay,
    createSelector: createSelectorSpy,
    spawnCommand,
    ...(params?.env ? { env: params.env } : {}),
  });
  return {
    messages,
    openOverlay,
    createSelectorSpy,
    spawnCommand,
    runLocalShellLine,
    getLastSelector: () => lastSelector,
  };
}

describe("createLocalShellRunner", () => {
  it("logs denial on subsequent ! attempts without re-prompting", async () => {
    const harness = createShellHarness();

    const firstRun = harness.runLocalShellLine("!ls");
    expect(harness.openOverlay).toHaveBeenCalledTimes(1);
    const selector = harness.getLastSelector();
    selector?.onSelect?.({ value: "no", label: "No" });
    await firstRun;

    await harness.runLocalShellLine("!pwd");

    expect(harness.messages).toContain("本地 shell：未启用");
    expect(harness.messages).toContain("本地 shell：本会话未启用");
    expect(harness.createSelectorSpy).toHaveBeenCalledTimes(1);
    expect(harness.spawnCommand).not.toHaveBeenCalled();
  });

  it("sets ASSISTANT_SHELL when running local shell commands", async () => {
    const spawnCommand = vi.fn((_command: string, _options: unknown) => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      return {
        stdout,
        stderr,
        on: (event: string, callback: (...args: unknown[]) => void) => {
          if (event === "close") {
            setImmediate(() => callback(0, null));
          }
        },
      };
    });

    const harness = createShellHarness({
      spawnCommand: spawnCommand as unknown as typeof import("node:child_process").spawn,
      env: { PATH: "/tmp/bin", USER: "dev" },
    });

    const firstRun = harness.runLocalShellLine("!echo hi");
    expect(harness.openOverlay).toHaveBeenCalledTimes(1);
    const selector = harness.getLastSelector();
    selector?.onSelect?.({ value: "yes", label: "Yes" });
    await firstRun;

    expect(harness.createSelectorSpy).toHaveBeenCalledTimes(1);
    expect(spawnCommand).toHaveBeenCalledTimes(1);
    const spawnOptions = spawnCommand.mock.calls[0]?.[1] as { env?: Record<string, string> };
    expect(spawnOptions.env?.ASSISTANT_SHELL).toBe("tui-local");
    expect(spawnOptions.env?.PATH).toBe("/tmp/bin");
    expect(harness.messages).toContain("本地 shell：本会话已启用");
  });

  it("streams stdout and stderr chunks before the process closes", async () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = stdout;
    child.stderr = stderr;
    const spawnCommand = vi.fn(() => child);
    const harness = createShellHarness({
      spawnCommand: spawnCommand as unknown as typeof import("node:child_process").spawn,
    });

    const run = harness.runLocalShellLine("!node script.js");
    harness.getLastSelector()?.onSelect?.({ value: "yes", label: "Yes" });
    await new Promise<void>((resolve) => setImmediate(resolve));

    stdout.emit("data", Buffer.from("first\nsecond\n"));
    stderr.emit("data", Buffer.from("warn\n"));

    expect(harness.messages).toContain("[本地] first");
    expect(harness.messages).toContain("[本地] second");
    expect(harness.messages).toContain("[本地:错误] warn");

    child.emit("close", 0, null);
    await run;

    expect(harness.messages).toContain("[本地] 退出 0");
  });

  it("supports output redirection with > and avoids echoing redirected output", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-tui-shell-"));
    const outFile = path.join(tmpDir, "out.txt");
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = stdout;
    child.stderr = stderr;
    const spawnCommand = vi.fn(() => child);
    const harness = createShellHarness({
      spawnCommand: spawnCommand as unknown as typeof import("node:child_process").spawn,
    });

    try {
      const run = harness.runLocalShellLine(`!echo hello > "${outFile}"`);
      harness.getLastSelector()?.onSelect?.({ value: "yes", label: "Yes" });
      await new Promise<void>((resolve) => setImmediate(resolve));
      stdout.emit("data", Buffer.from("hello\n"));
      child.emit("close", 0, null);
      await run;

      await expect(fs.readFile(outFile, "utf8")).resolves.toBe("hello\n");
      expect(harness.messages).toContain(`[本地] stdout 已重定向到 ${outFile}`);
      expect(harness.messages).not.toContain("[本地] hello");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
