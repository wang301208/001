import { ProcessTerminal } from "@mariozechner/pi-tui";

export type TerminalKind =
  | "kitty"
  | "ghostty"
  | "wezterm"
  | "iterm2"
  | "vscode"
  | "alacritty"
  | "mintty"
  | "windows-terminal"
  | "cmd"
  | "conemu"
  | "xterm"
  | "unknown";

export interface TerminalCapabilities {
  trueColor: boolean;
  kittyProtocol: boolean;
  modifyOtherKeys: boolean;
  bracketedPaste: boolean;
  osc8Hyperlinks: boolean;
  syncOutput: boolean;
  imageProtocol: "kitty" | "iterm2" | null;
}

export interface TerminalInfo {
  kind: TerminalKind;
  capabilities: TerminalCapabilities;
  isWindows: boolean;
  isMsys: boolean;
  columns: number;
  rows: number;
}

export type InputHandler = (data: string) => void;
export type ResizeHandler = () => void;

export interface TerminalAdapter {
  readonly info: TerminalInfo;
  start(input: InputHandler, resize: ResizeHandler): void;
  stop(): void;
  write(data: string): void;
  drainInput?(maxMs?: number, idleMs?: number): Promise<void>;
  get kittyProtocolActive(): boolean;
}

function detectTerminalKind(env: Record<string, string | undefined>): TerminalKind {
  const termProgram = (env.TERM_PROGRAM ?? "").toLowerCase();
  const term = (env.TERM ?? "").toLowerCase();
  const colorTerm = (env.COLORTERM ?? "").toLowerCase();

  if (env.KITTY_WINDOW_ID || termProgram === "kitty") return "kitty";
  if (termProgram === "ghostty" || term.includes("ghostty") || env.GHOSTTY_RESOURCES_DIR) return "ghostty";
  if (env.WEZTERM_PANE || termProgram === "wezterm") return "wezterm";
  if (env.ITERM_SESSION_ID || termProgram === "iterm.app") return "iterm2";
  if (termProgram === "vscode") return "vscode";
  if (termProgram === "alacritty") return "alacritty";
  if (termProgram === "mintty" || term.includes("mintty")) return "mintty";
  if (env.WT_SESSION) return "windows-terminal";
  if (env.ConEmuANSI === "ON" || env.ConEmuANSI === "1") return "conemu";

  const msystem = (env.MSYSTEM ?? "").toUpperCase();
  if (msystem.startsWith("MINGW") || msystem.startsWith("MSYS")) return "mintty";

  if (term.includes("xterm")) return "xterm";
  return "unknown";
}

function detectCapabilities(kind: TerminalKind, env: Record<string, string | undefined>): TerminalCapabilities {
  const colorTerm = (env.COLORTERM ?? "").toLowerCase();

  switch (kind) {
    case "kitty":
    case "ghostty":
    case "wezterm":
      return {
        trueColor: true,
        kittyProtocol: kind === "kitty" || kind === "ghostty",
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: true,
        imageProtocol: kind === "kitty" || kind === "ghostty" ? "kitty" : null,
      };
    case "iterm2":
      return {
        trueColor: true,
        kittyProtocol: false,
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: true,
        imageProtocol: "iterm2",
      };
    case "vscode":
    case "alacritty":
      return {
        trueColor: true,
        kittyProtocol: false,
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: false,
        imageProtocol: null,
      };
    case "mintty":
      return {
        trueColor: true,
        kittyProtocol: false,
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: false,
        imageProtocol: null,
      };
    case "windows-terminal":
      return {
        trueColor: true,
        kittyProtocol: false,
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: true,
        imageProtocol: null,
      };
    default: {
      const trueColor = colorTerm === "truecolor" || colorTerm === "24bit";
      return {
        trueColor,
        kittyProtocol: false,
        modifyOtherKeys: true,
        bracketedPaste: true,
        osc8Hyperlinks: true,
        syncOutput: false,
        imageProtocol: null,
      };
    }
  }
}

export function detectTerminalInfo(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  platform: string = process.platform,
  stdout: { columns?: number; rows?: number } = process.stdout,
): TerminalInfo {
  const kind = detectTerminalKind(env);
  const capabilities = detectCapabilities(kind, env);
  const isWindows = platform === "win32";
  const msystem = (env.MSYSTEM ?? "").toUpperCase();
  const isMsys = isWindows && (msystem.startsWith("MINGW") || msystem.startsWith("MSYS"));

  return {
    kind,
    capabilities,
    isWindows,
    isMsys,
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  };
}

export class ProcessTerminalAdapter implements TerminalAdapter {
  private terminal: ProcessTerminal;
  private _info: TerminalInfo;

  constructor(env?: Record<string, string | undefined>, platform?: string) {
    this._info = detectTerminalInfo(env, platform);
    this.terminal = new ProcessTerminal();
  }

  get info(): TerminalInfo {
    return this._info;
  }

  start(input: InputHandler, resize: ResizeHandler): void {
    this.terminal.start(input, resize);
  }

  stop(): void {
    this.terminal.stop();
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  async drainInput(maxMs?: number, idleMs?: number): Promise<void> {
    if (typeof this.terminal.drainInput === "function") {
      await this.terminal.drainInput(maxMs, idleMs);
    }
  }

  get kittyProtocolActive(): boolean {
    return this.terminal.kittyProtocolActive;
  }
}

export function shouldEnableWindowsGitBashPasteFallback(
  platform: string = process.platform,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  if (platform === "darwin") {
    const termProgram = (env.TERM_PROGRAM ?? "").toLowerCase();
    if (termProgram.includes("iterm") || termProgram.includes("apple_terminal")) return true;
    return false;
  }
  if (platform !== "win32") return false;
  const msystem = (env.MSYSTEM ?? "").toUpperCase();
  const shell = env.SHELL ?? "";
  const termProgram = (env.TERM_PROGRAM ?? "").toLowerCase();
  if (msystem.startsWith("MINGW") || msystem.startsWith("MSYS")) return true;
  if (shell.toLowerCase().includes("bash")) return true;
  return termProgram.includes("mintty");
}

export function resolveDefaultBorder(
  platform: string = process.platform,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): "unicode" | "ascii" {
  if (platform !== "win32") return "unicode";
  const term = env.TERM ?? "";
  const termProgram = env.TERM_PROGRAM ?? "";
  const isModernTerminal =
    Boolean(env.WT_SESSION) ||
    term.includes("xterm") ||
    term.includes("cygwin") ||
    term.includes("msys") ||
    termProgram === "vscode";
  return isModernTerminal ? "unicode" : "ascii";
}
