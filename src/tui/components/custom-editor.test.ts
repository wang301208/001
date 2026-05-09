import { TUI } from "@mariozechner/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editorTheme } from "../theme/theme.js";
import { CustomEditor } from "./custom-editor.js";

describe("CustomEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes alt+enter to the follow-up handler", () => {
    const tui = { requestRender: vi.fn() } as unknown as TUI;
    const editor = new CustomEditor(tui, editorTheme);
    const onAltEnter = vi.fn();
    editor.onAltEnter = onAltEnter;

    editor.handleInput("\u001b\r");

    expect(onAltEnter).toHaveBeenCalledTimes(1);
  });

  it("routes alt+up to the dequeue handler", () => {
    const tui = { requestRender: vi.fn() } as unknown as TUI;
    const editor = new CustomEditor(tui, editorTheme);
    const onAltUp = vi.fn();
    editor.onAltUp = onAltUp;

    editor.handleInput("\u001bp");

    expect(onAltUp).toHaveBeenCalledTimes(1);
  });

  it("keeps escape inside the editor while slash autocomplete is open", () => {
    const tui = { requestRender: vi.fn() } as unknown as TUI;
    const editor = new CustomEditor(tui, editorTheme);
    const onEscape = vi.fn();
    editor.onEscape = onEscape;
    vi.spyOn(editor, "isShowingAutocomplete").mockReturnValue(true);
    const superHandle = vi.spyOn(Object.getPrototypeOf(CustomEditor.prototype), "handleInput");

    editor.handleInput("\u001b");

    expect(onEscape).not.toHaveBeenCalled();
    expect(superHandle).toHaveBeenCalledWith("\u001b");
  });
});
