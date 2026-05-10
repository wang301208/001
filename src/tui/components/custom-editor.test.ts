import { CURSOR_MARKER, TUI, visibleWidth, type Terminal } from "@mariozechner/pi-tui";
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

  it("keeps rendered prompt lines within terminal width", () => {
    const tui = new TUI(createTestTerminal(80, 24));
    const editor = new CustomEditor(tui, editorTheme);
    const width = 80;

    editor.focused = true;
    editor.setText("");

    const lines = editor.render(width);

    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  });

  it("does not split the hardware cursor marker while replacing the prompt", () => {
    const tui = new TUI(createTestTerminal(80, 24));
    const editor = new CustomEditor(tui, editorTheme);

    editor.focused = true;
    editor.setText("");

    const inputLine = editor.render(80)[1] ?? "";

    expect(inputLine).toContain(CURSOR_MARKER);
  });
});

function createTestTerminal(columns: number, rows: number): Terminal {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    drainInput: vi.fn(async () => undefined),
    write: vi.fn(),
    get columns() {
      return columns;
    },
    get rows() {
      return rows;
    },
    get kittyProtocolActive() {
      return false;
    },
    moveBy: vi.fn(),
    hideCursor: vi.fn(),
    showCursor: vi.fn(),
    clearLine: vi.fn(),
    clearFromCursor: vi.fn(),
    clearScreen: vi.fn(),
    setTitle: vi.fn(),
  };
}
