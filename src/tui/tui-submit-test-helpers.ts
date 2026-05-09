import { vi } from "vitest";
import { createEditorSubmitHandler } from "./tui-submit.js";

type MockFn = ReturnType<typeof vi.fn>;

export type SubmitHarness = {
  editor: {
    setText: MockFn;
    addToHistory: MockFn;
  };
  handleCommand: MockFn;
  sendMessage: MockFn;
  handleBangLine: MockFn;
  enqueueMessage: MockFn;
  onSubmit: (text: string) => void;
};

export function createSubmitHarness(params?: { hasActiveRun?: () => boolean }): SubmitHarness {
  const editor = {
    setText: vi.fn(),
    addToHistory: vi.fn(),
  };
  const handleCommand = vi.fn();
  const sendMessage = vi.fn();
  const handleBangLine = vi.fn();
  const enqueueMessage = vi.fn();
  const onSubmit = createEditorSubmitHandler({
    editor,
    handleCommand,
    sendMessage,
    handleBangLine,
    resolveControlInput: (value) =>
      value === "打开设置" ? { routedText: "/settings", reason: "settings" } : null,
    enqueueMessage,
    hasActiveRun: params?.hasActiveRun,
  });
  return { editor, handleCommand, sendMessage, handleBangLine, enqueueMessage, onSubmit };
}
