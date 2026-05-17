import { Key, matchesKey } from "../adapters/index.js";

export interface KeyboardAction {
  type:
    | "clear-input"
    | "exit"
    | "toggle-tools"
    | "toggle-thinking"
    | "toggle-governance"
    | "cycle-prompt"
    | "cancel"
    | "switch-model"
    | "switch-agent"
    | "switch-session"
    | "toggle-consciousness-overlay"
    | "toggle-monologue-panel"
    | "toggle-desire-panel"
    | "toggle-dream-panel"
    | "toggle-goal-panel"
    | "toggle-will-panel"
    | "toggle-shadow-panel"
    | "toggle-creative-panel"
    | "toggle-mortality-panel"
    | "toggle-relationship-panel"
    | "toggle-temporal-panel"
    | "toggle-executor-panel"
    | "toggle-strategy-panel"
    | "toggle-audit-panel"
    | "refresh-session"
    | "escape"
    | "shift-tab"
    | "alt-enter"
    | "alt-up"
    | "ctrl-c-warn"
    | "unknown";
}

export interface KeyboardHandlerContext {
  hasInput: boolean;
  hasVisibleBtw: boolean;
  hasActiveRun: boolean;
  lastCtrlCAt: number;
}

export class KeyboardHandler {
  resolveCtrlCAction(ctx: KeyboardHandlerContext): {
    action: "clear" | "exit" | "warn";
    nextLastCtrlCAt: number;
  } {
    const now = Date.now();
    const exitWindowMs = 1000;
    const dedupeWindowMs = 80;
    if (ctx.lastCtrlCAt > 0 && now - ctx.lastCtrlCAt <= dedupeWindowMs) {
      return { action: "warn", nextLastCtrlCAt: ctx.lastCtrlCAt };
    }
    if (ctx.hasInput) {
      return { action: "clear", nextLastCtrlCAt: now };
    }
    if (now - ctx.lastCtrlCAt <= exitWindowMs) {
      return { action: "exit", nextLastCtrlCAt: ctx.lastCtrlCAt };
    }
    return { action: "warn", nextLastCtrlCAt: now };
  }

  resolveKeyAction(
    data: string,
    ctx: KeyboardHandlerContext,
  ): KeyboardAction | null {
    if (matchesKey(data, Key.ctrl("c"))) {
      const decision = this.resolveCtrlCAction(ctx);
      if (decision.action === "clear") return { type: "clear-input" };
      if (decision.action === "exit") return { type: "exit" };
      return { type: "ctrl-c-warn" };
    }
    if (matchesKey(data, Key.ctrl("d"))) return { type: "exit" };
    if (matchesKey(data, Key.ctrl("o"))) return { type: "toggle-tools" };
    if (matchesKey(data, Key.ctrl("l"))) return { type: "switch-model" };
    if (matchesKey(data, Key.ctrl("g"))) return { type: "switch-agent" };
    if (matchesKey(data, Key.ctrl("p"))) return { type: "switch-session" };
    if (matchesKey(data, Key.ctrl("t"))) return { type: "toggle-thinking" };
    if (matchesKey(data, Key.ctrl("y"))) return { type: "cycle-prompt" };
    if (matchesKey(data, Key.shift(Key.tab))) return { type: "shift-tab" };
    if (matchesKey(data, Key.ctrl("a"))) return { type: "toggle-consciousness-overlay" };
    if (matchesKey(data, Key.ctrl("s"))) return { type: "toggle-monologue-panel" };
    if (matchesKey(data, Key.ctrl("f"))) return { type: "toggle-desire-panel" };
    if (matchesKey(data, Key.ctrl("j"))) return { type: "toggle-dream-panel" };
    if (matchesKey(data, Key.ctrl("m"))) return { type: "toggle-goal-panel" };
    if (matchesKey(data, Key.ctrl("w"))) return { type: "toggle-will-panel" };
    if (matchesKey(data, Key.ctrl("x"))) return { type: "toggle-shadow-panel" };
    if (matchesKey(data, Key.ctrl("e"))) return { type: "toggle-creative-panel" };
    if (matchesKey(data, Key.ctrl("q"))) return { type: "toggle-mortality-panel" };
    if (matchesKey(data, Key.ctrl("r"))) return { type: "toggle-relationship-panel" };
    if (matchesKey(data, Key.ctrl("u"))) return { type: "toggle-temporal-panel" };
    if (matchesKey(data, Key.ctrl("1"))) return { type: "toggle-executor-panel" };
    if (matchesKey(data, Key.ctrl("2"))) return { type: "toggle-strategy-panel" };
    if (matchesKey(data, Key.ctrl("3"))) return { type: "toggle-audit-panel" };
    if (matchesKey(data, Key.alt(Key.enter))) return { type: "alt-enter" };
    if (matchesKey(data, Key.alt(Key.up))) return { type: "alt-up" };
    if (matchesKey(data, Key.escape)) return { type: "escape" };
    return null;
  }
}
