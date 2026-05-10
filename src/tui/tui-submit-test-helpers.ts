import { vi } from "vitest";
import { createEditorSubmitHandler } from "./tui-submit.js";
import type { AssistantAction } from "./assistant-actions.js";

type MockFn = ReturnType<typeof vi.fn>;

export type SubmitHarness = {
  editor: {
    setText: MockFn;
    addToHistory: MockFn;
  };
  sendMessage: MockFn;
  handleBangLine: MockFn;
  handleAction: MockFn;
  notifyUser: MockFn;
  enqueueMessage: MockFn;
  onSubmit: (text: string) => void;
};

export function createSubmitHarness(params?: {
  hasActiveRun?: () => boolean;
  resolveInput?: (
    value: string,
  ) =>
    | { kind: "action"; action: AssistantAction; reason: string }
    | { kind: "message"; message: string; reason: string }
    | null;
}): SubmitHarness {
  const editor = {
    setText: vi.fn(),
    addToHistory: vi.fn(),
  };
  const sendMessage = vi.fn();
  const handleBangLine = vi.fn();
  const handleAction = vi.fn();
  const notifyUser = vi.fn();
  const enqueueMessage = vi.fn();
  const onSubmit = createEditorSubmitHandler({
    editor,
    sendMessage,
    handleBangLine,
    handleAction,
    notifyUser,
    resolveInput: params?.resolveInput ?? ((value) => {
      if (value === "打开设置") {
        return {
          kind: "action",
          action: { type: "tui.operation", operation: "settings" },
          reason: "settings",
        };
      }
      if (value === "执行本地命令 pnpm test") {
        return {
          kind: "action",
          action: { type: "shell.run", command: "pnpm test" },
          reason: "local-shell",
        };
      }
      if (value === "请检查项目测试并修复失败项") {
        return {
          kind: "message",
          message: "[意图: 执行任务]\n用户目标: 请检查项目测试并修复失败项",
          reason: "task-execution",
        };
      }
      return null;
    }),
    enqueueMessage,
    hasActiveRun: params?.hasActiveRun,
  });
  return {
    editor,
    sendMessage,
    handleBangLine,
    handleAction,
    notifyUser,
    enqueueMessage,
    onSubmit,
  };
}
