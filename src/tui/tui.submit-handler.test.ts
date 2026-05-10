import { describe, expect, it, vi } from "vitest";
import { createSubmitHarness } from "./tui-submit-test-helpers.js";
import {
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "./tui-submit.js";

describe("createEditorSubmitHandler", () => {
  it("blocks direct bang commands and asks for natural language", () => {
    const { sendMessage, handleBangLine, notifyUser, onSubmit } = createSubmitHarness();

    onSubmit("!ls");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(notifyUser).toHaveBeenCalledWith("本地命令入口已改为自然语言。请说：执行本地命令 ls");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("treats a lone ! as a normal message", () => {
    const { sendMessage, handleBangLine, onSubmit } = createSubmitHarness();

    onSubmit("!");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("!");
  });

  it("does not treat leading whitespace before ! as a bang command", () => {
    const { editor, sendMessage, handleBangLine, onSubmit } = createSubmitHarness();

    onSubmit("  !ls");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("!ls");
    expect(editor.addToHistory).toHaveBeenCalledWith("!ls");
  });

  it("routes natural-language local shell requests to handleBangLine", () => {
    const { handleAction, handleBangLine, onSubmit } = createSubmitHarness();

    onSubmit("执行本地命令 pnpm test");

    expect(handleAction).toHaveBeenCalledWith({ type: "shell.run", command: "pnpm test" });
    expect(handleBangLine).not.toHaveBeenCalled();
  });

  it("trims normal messages before sending and adding to history", () => {
    const { editor, sendMessage, onSubmit } = createSubmitHarness();

    onSubmit("  hello  ");

    expect(sendMessage).toHaveBeenCalledWith("hello");
    expect(editor.addToHistory).toHaveBeenCalledWith("hello");
  });

  it("preserves internal newlines for multiline messages", () => {
    const { editor, sendMessage, handleBangLine, onSubmit } = createSubmitHarness();

    onSubmit("Line 1\nLine 2\nLine 3");

    expect(sendMessage).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    expect(editor.addToHistory).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    expect(handleBangLine).not.toHaveBeenCalled();
  });

  it("queues normal messages while a run is active", () => {
    const { enqueueMessage, sendMessage, onSubmit } = createSubmitHarness({
      hasActiveRun: () => true,
    });

    onSubmit("follow this next");

    expect(enqueueMessage).toHaveBeenCalledWith("follow this next", "followUp");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("routes natural-language control intents before sending to the agent", () => {
    const { handleAction, sendMessage, onSubmit } = createSubmitHarness();

    onSubmit("打开设置");

    expect(handleAction).toHaveBeenCalledWith({
      type: "tui.operation",
      operation: "settings",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not accept old natural-language command routes from the submit path", () => {
    const { handleAction, sendMessage, notifyUser, onSubmit } = createSubmitHarness({
      resolveInput: () => ({
        kind: "action",
        action: { type: "tui.operation", operation: "settings" },
        reason: "settings",
      }),
    });

    onSubmit("/settings");

    expect(handleAction).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(notifyUser).toHaveBeenCalledWith("自然语言直达已启用。请直接描述目标。");
  });

  it("routes natural-language project work into an execution message", () => {
    const { sendMessage, onSubmit } = createSubmitHarness();

    onSubmit("请检查项目测试并修复失败项");

    expect(sendMessage).toHaveBeenCalledWith(
      "[意图: 执行任务]\n用户目标: 请检查项目测试并修复失败项",
    );
  });
});

describe("createSubmitBurstCoalescer", () => {
  it("coalesces rapid single-line submits into one multiline submit when enabled", () => {
    vi.useFakeTimers();
    const submit = vi.fn();
    let now = 1_000;
    const onSubmit = createSubmitBurstCoalescer({
      submit,
      enabled: true,
      burstWindowMs: 50,
      now: () => now,
    });

    onSubmit("Line 1");
    now += 10;
    onSubmit("Line 2");
    now += 10;
    onSubmit("Line 3");

    expect(submit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3");
    vi.useRealTimers();
  });

  it("passes through immediately when disabled", () => {
    const submit = vi.fn();
    const onSubmit = createSubmitBurstCoalescer({
      submit,
      enabled: false,
    });

    onSubmit("Line 1");
    onSubmit("Line 2");

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenNthCalledWith(1, "Line 1");
    expect(submit).toHaveBeenNthCalledWith(2, "Line 2");
  });
});

describe("shouldEnableWindowsGitBashPasteFallback", () => {
  it("enables fallback on Windows Git Bash env", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "win32",
        env: {
          MSYSTEM: "MINGW64",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(true);
  });

  it("enables fallback on macOS iTerm", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "darwin",
        env: {
          TERM_PROGRAM: "iTerm.app",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(true);
  });

  it("enables fallback on macOS Terminal.app", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "darwin",
        env: {
          TERM_PROGRAM: "Apple_Terminal",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(true);
  });

  it("disables fallback outside Windows", () => {
    expect(
      shouldEnableWindowsGitBashPasteFallback({
        platform: "linux",
        env: {
          MSYSTEM: "MINGW64",
        } as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
  });
});
