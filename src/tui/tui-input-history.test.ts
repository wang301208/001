import { describe, expect, it } from "vitest";
import { createSubmitHarness } from "./tui-submit-test-helpers.js";

describe("createEditorSubmitHandler", () => {
  it("adds submitted messages to editor history", () => {
    const { editor, onSubmit } = createSubmitHarness();

    onSubmit("hello world");

    expect(editor.setText).toHaveBeenCalledWith("");
    expect(editor.addToHistory).toHaveBeenCalledWith("hello world");
  });

  it("trims input before adding to history", () => {
    const { editor, onSubmit } = createSubmitHarness();

    onSubmit("   hi   ");

    expect(editor.addToHistory).toHaveBeenCalledWith("hi");
  });

  it.each(["", "   "])("does not add blank submissions to history", (text) => {
    const { editor, onSubmit } = createSubmitHarness();

    onSubmit(text);

    expect(editor.addToHistory).not.toHaveBeenCalled();
  });

  it("blocks direct slash commands and asks for natural language", () => {
    const { editor, sendMessage, notifyUser, onSubmit } = createSubmitHarness();

    onSubmit("/models");

    expect(editor.addToHistory).toHaveBeenCalledWith("/models");
    expect(notifyUser).toHaveBeenCalledWith("自然语言直达已启用。请直接描述目标。");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("routes normal messages to sendMessage", () => {
    const { editor, sendMessage, onSubmit } = createSubmitHarness();

    onSubmit("hello");

    expect(editor.addToHistory).toHaveBeenCalledWith("hello");
    expect(sendMessage).toHaveBeenCalledWith("hello");
  });

  it("blocks bang-prefixed lines from direct execution", () => {
    const { handleBangLine, notifyUser, onSubmit } = createSubmitHarness();

    onSubmit("!ls");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(notifyUser).toHaveBeenCalledWith("本地命令入口已改为自然语言。请说：执行本地命令 ls");
  });
});
