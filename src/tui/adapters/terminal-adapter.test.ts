import { describe, it, expect } from "vitest";
import {
  detectTerminalInfo,
  shouldEnableWindowsGitBashPasteFallback,
  resolveDefaultBorder,
  type TerminalInfo,
} from "../adapters/terminal-adapter.js";

describe("adapters/terminal-adapter", () => {
  describe("detectTerminalInfo", () => {
    it("detects kitty terminal", () => {
      const info = detectTerminalInfo(
        { KITTY_WINDOW_ID: "1", TERM: "xterm-kitty" },
        "linux",
        { columns: 120, rows: 40 },
      );
      expect(info.kind).toBe("kitty");
      expect(info.capabilities.kittyProtocol).toBe(true);
      expect(info.capabilities.trueColor).toBe(true);
      expect(info.columns).toBe(120);
    });

    it("detects mintty from MSYSTEM", () => {
      const info = detectTerminalInfo(
        { MSYSTEM: "MINGW64", TERM: "xterm-256color" },
        "win32",
        { columns: 80, rows: 24 },
      );
      expect(info.kind).toBe("mintty");
      expect(info.isWindows).toBe(true);
      expect(info.isMsys).toBe(true);
      expect(info.capabilities.modifyOtherKeys).toBe(true);
    });

    it("detects windows-terminal from WT_SESSION", () => {
      const info = detectTerminalInfo(
        { WT_SESSION: "1", TERM_PROGRAM: "" },
        "win32",
        { columns: 120, rows: 30 },
      );
      expect(info.kind).toBe("windows-terminal");
      expect(info.capabilities.syncOutput).toBe(true);
    });

    it("detects vscode terminal", () => {
      const info = detectTerminalInfo(
        { TERM_PROGRAM: "vscode", TERM: "xterm-256color" },
        "linux",
        {},
      );
      expect(info.kind).toBe("vscode");
      expect(info.capabilities.trueColor).toBe(true);
    });

    it("falls back to unknown", () => {
      const info = detectTerminalInfo({}, "linux", {});
      expect(info.kind).toBe("unknown");
      expect(info.columns).toBe(80);
      expect(info.rows).toBe(24);
    });
  });

  describe("shouldEnableWindowsGitBashPasteFallback", () => {
    it("returns true for Windows MINGW", () => {
      expect(shouldEnableWindowsGitBashPasteFallback("win32", { MSYSTEM: "MINGW64" })).toBe(true);
    });

    it("returns true for Windows bash shell", () => {
      expect(shouldEnableWindowsGitBashPasteFallback("win32", { SHELL: "/usr/bin/bash" })).toBe(true);
    });

    it("returns false for non-Windows non-darwin", () => {
      expect(shouldEnableWindowsGitBashPasteFallback("linux", {})).toBe(false);
    });

    it("returns true for macOS iTerm2", () => {
      expect(shouldEnableWindowsGitBashPasteFallback("darwin", { TERM_PROGRAM: "iTerm.app" })).toBe(true);
    });
  });

  describe("resolveDefaultBorder", () => {
    it("returns unicode for non-Windows", () => {
      expect(resolveDefaultBorder("linux", {})).toBe("unicode");
    });

    it("returns unicode for Windows Terminal", () => {
      expect(resolveDefaultBorder("win32", { WT_SESSION: "1" })).toBe("unicode");
    });

    it("returns ascii for plain cmd", () => {
      expect(resolveDefaultBorder("win32", {})).toBe("ascii");
    });

    it("returns unicode for Git Bash (msys TERM)", () => {
      expect(resolveDefaultBorder("win32", { TERM: "xterm-256color-italic", MSYSTEM: "MINGW64" })).toBe("unicode");
    });
  });
});
