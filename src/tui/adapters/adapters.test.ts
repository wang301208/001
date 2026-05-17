import { describe, it, expect, beforeEach } from "vitest";
import { matchesKey, parseKey, Key, setKittyProtocolActive, isKittyProtocolActive, isKeyRelease, isKeyRepeat } from "../adapters/keys.js";
import { TUI_KEYBINDINGS, KeybindingsManager } from "../adapters/keybindings.js";

describe("adapters/keys", () => {
  beforeEach(() => {
    setKittyProtocolActive(false);
  });

  describe("Enter key matching", () => {
    it("matches CR (\\r) as enter", () => {
      expect(matchesKey("\r", "enter")).toBe(true);
    });

    it("matches LF (\\n) as enter when Kitty protocol is OFF", () => {
      setKittyProtocolActive(false);
      expect(matchesKey("\n", "enter")).toBe(true);
    });

    it("does not match LF (\\n) as enter when Kitty protocol is ON", () => {
      setKittyProtocolActive(true);
      expect(matchesKey("\n", "enter")).toBe(false);
    });

    it("matches modifyOtherKeys Enter (\\x1b[27;1;13~)", () => {
      expect(matchesKey("\x1b[27;1;13~", "enter")).toBe(true);
    });

    it("matches modifyOtherKeys Shift+Enter (\\x1b[27;2;13~)", () => {
      expect(matchesKey("\x1b[27;2;13~", "shift+enter")).toBe(true);
    });

    it("matches SS3 M (numpad enter)", () => {
      expect(matchesKey("\x1bOM", "enter")).toBe(true);
    });

    it("matches Kitty protocol Enter (\\x1b[13;1u)", () => {
      expect(matchesKey("\x1b[13;1u", "enter")).toBe(true);
    });

    it("matches CSI-u Enter (\\x1b[13u)", () => {
      expect(matchesKey("\x1b[13u", "enter")).toBe(true);
    });
  });

  describe("Tab key matching", () => {
    it("matches plain tab", () => {
      expect(matchesKey("\t", "tab")).toBe(true);
    });

    it("matches modifyOtherKeys Tab (\\x1b[27;1;9~)", () => {
      expect(matchesKey("\x1b[27;1;9~", "tab")).toBe(true);
    });

    it("matches Shift+Tab (\\x1b[Z)", () => {
      expect(matchesKey("\x1b[Z", "shift+tab")).toBe(true);
    });
  });

  describe("Arrow key matching", () => {
    it("matches legacy arrow sequences", () => {
      expect(matchesKey("\x1b[A", "up")).toBe(true);
      expect(matchesKey("\x1b[B", "down")).toBe(true);
      expect(matchesKey("\x1b[D", "left")).toBe(true);
      expect(matchesKey("\x1b[C", "right")).toBe(true);
    });

    it("matches modifyOtherKeys arrow sequences (CSI 1;1X)", () => {
      expect(matchesKey("\x1b[1;1A", "up")).toBe(true);
      expect(matchesKey("\x1b[1;1B", "down")).toBe(true);
      expect(matchesKey("\x1b[1;1D", "left")).toBe(true);
      expect(matchesKey("\x1b[1;1C", "right")).toBe(true);
    });
  });

  describe("Functional key matching with modifyOtherKeys", () => {
    it("matches mOK escape", () => {
      expect(matchesKey("\x1b[27;1;27~", "escape")).toBe(true);
    });

    it("matches mOK space", () => {
      expect(matchesKey("\x1b[27;1;32~", "space")).toBe(true);
    });

    it("matches mOK backspace", () => {
      expect(matchesKey("\x1b[27;1;127~", "backspace")).toBe(true);
    });

    it("matches mOK delete", () => {
      expect(matchesKey("\x1b[27;1;51~", "delete")).toBe(true);
    });

    it("matches mOK home", () => {
      expect(matchesKey("\x1b[27;1;72~", "home")).toBe(true);
    });

    it("matches mOK end", () => {
      expect(matchesKey("\x1b[27;1;70~", "end")).toBe(true);
    });
  });

  describe("Ctrl combinations", () => {
    it("matches Ctrl+C", () => {
      expect(matchesKey("\x03", "ctrl+c")).toBe(true);
    });

    it("matches Ctrl+D", () => {
      expect(matchesKey("\x04", "ctrl+d")).toBe(true);
    });

    it("matches Ctrl+L", () => {
      expect(matchesKey("\x0c", "ctrl+l")).toBe(true);
    });
  });

  describe("parseKey", () => {
    it("parses Enter", () => {
      expect(parseKey("\r")).toBe("enter");
    });

    it("parses Ctrl+C", () => {
      expect(parseKey("\x03")).toBe("ctrl+c");
    });

    it("parses Up arrow", () => {
      expect(parseKey("\x1b[A")).toBe("up");
    });
  });

  describe("Key helper", () => {
    it("creates ctrl combinations", () => {
      expect(Key.ctrl("c")).toBe("ctrl+c");
      expect(Key.ctrl("d")).toBe("ctrl+d");
    });

    it("creates shift combinations", () => {
      expect(Key.shift("tab")).toBe("shift+tab");
    });

    it("creates alt combinations", () => {
      expect(Key.alt("enter")).toBe("alt+enter");
    });
  });

  describe("isKeyRelease / isKeyRepeat", () => {
    it("detects key release from Kitty protocol", () => {
      expect(isKeyRelease("\x1b[13;3u")).toBe(true);
    });

    it("detects key repeat from Kitty protocol", () => {
      expect(isKeyRepeat("\x1b[13;2u")).toBe(true);
    });

    it("does not flag regular key as release", () => {
      expect(isKeyRelease("\r")).toBe(false);
    });
  });
});

describe("adapters/keybindings", () => {
  it("defines tui.input.submit as enter", () => {
    expect(TUI_KEYBINDINGS["tui.input.submit"]).toBeDefined();
    expect(TUI_KEYBINDINGS["tui.input.submit"].defaultKeys).toBe("enter");
  });

  it("KeybindingsManager matches Enter for submit", () => {
    const kb = new KeybindingsManager(TUI_KEYBINDINGS);
    expect(kb.matches("\r", "tui.input.submit")).toBe(true);
  });

  it("KeybindingsManager matches mOK Enter for submit", () => {
    const kb = new KeybindingsManager(TUI_KEYBINDINGS);
    expect(kb.matches("\x1b[27;1;13~", "tui.input.submit")).toBe(true);
  });

  it("KeybindingsManager matches tab for tui.input.tab", () => {
    const kb = new KeybindingsManager(TUI_KEYBINDINGS);
    expect(kb.matches("\t", "tui.input.tab")).toBe(true);
  });

  it("KeybindingsManager matches mOK Tab for tui.input.tab", () => {
    const kb = new KeybindingsManager(TUI_KEYBINDINGS);
    expect(kb.matches("\x1b[27;1;9~", "tui.input.tab")).toBe(true);
  });
});
