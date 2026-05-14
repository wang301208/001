import { Container, Text } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { truncateAnsi } from "../zhushou-style.js";

export type PanelId =
  | "chat"
  | "memory"
  | "tasks"
  | "governance"
  | "perception"
  | "log";

export const PANEL_LABELS: Record<PanelId, string> = {
  chat: "对话",
  memory: "记忆",
  tasks: "任务",
  governance: "治理",
  perception: "感知",
  log: "日志",
};

export const PANEL_ICONS: Record<PanelId, string> = {
  chat: "◈",
  memory: "◎",
  tasks: "◆",
  governance: "⬡",
  perception: "◉",
  log: "▧",
};

export const DEFAULT_PANEL_ORDER: PanelId[] = [
  "chat",
  "memory",
  "tasks",
  "governance",
  "perception",
  "log",
];

export type PanelLayoutMode = "single" | "split-h" | "split-v" | "grid";

export type PanelState = {
  id: PanelId;
  visible: boolean;
  collapsed: boolean;
  focused: boolean;
  contentLines: string[];
  scrollOffset: number;
  badge?: string;
};

export type SixPanelLayoutConfig = {
  mode: PanelLayoutMode;
  activePrimary: PanelId;
  activeSecondary: PanelId | null;
  panelStates: Map<PanelId, PanelState>;
  showTabs: boolean;
};

export function createDefaultPanelStates(): Map<PanelId, PanelState> {
  const states = new Map<PanelId, PanelState>();
  for (const id of DEFAULT_PANEL_ORDER) {
    states.set(id, {
      id,
      visible: id === "chat" || id === "perception",
      collapsed: false,
      focused: id === "chat",
      contentLines: [],
      scrollOffset: 0,
    });
  }
  return states;
}

export class SixPanelLayout extends Container {
  private mode: PanelLayoutMode = "split-v";
  private activePrimary: PanelId = "chat";
  private activeSecondary: PanelId | null = "perception";
  private panelStates: Map<PanelId, PanelState>;
  private primaryContainer = new Container();
  private secondaryContainer = new Container();
  private tabBar = new Text("", 1, 0);
  private dividerBar = new Text("", 1, 0);
  private showTabs = true;

  constructor() {
    super();
    this.panelStates = createDefaultPanelStates();
    this.addChild(this.tabBar);
    this.addChild(this.primaryContainer);
    this.addChild(this.dividerBar);
    this.addChild(this.secondaryContainer);
  }

  setMode(mode: PanelLayoutMode): void {
    this.mode = mode;
    if (mode === "single") {
      this.activeSecondary = null;
    } else if (mode === "split-v" || mode === "split-h" || mode === "grid") {
      if (!this.activeSecondary) {
        this.activeSecondary = this.findNextVisiblePanel(this.activePrimary);
      }
    }
  }

  getMode(): PanelLayoutMode {
    return this.mode;
  }

  focusPanel(id: PanelId): void {
    for (const [panelId, state] of this.panelStates) {
      state.focused = panelId === id;
    }
    if (this.activePrimary !== id && this.activeSecondary !== id) {
      this.activeSecondary = this.activePrimary;
      this.activePrimary = id;
    }
  }

  getFocusedPanel(): PanelId {
    for (const [, state] of this.panelStates) {
      if (state.focused) return state.id;
    }
    return this.activePrimary;
  }

  togglePanel(id: PanelId): void {
    const state = this.panelStates.get(id);
    if (!state) return;
    state.visible = !state.visible;
    if (state.visible && !this.activeSecondary) {
      this.activeSecondary = id;
    }
  }

  cyclePanel(direction: 1 | -1 = 1): PanelId {
    const visiblePanels = DEFAULT_PANEL_ORDER.filter(
      (id) => this.panelStates.get(id)?.visible,
    );
    if (visiblePanels.length === 0) return this.activePrimary;

    const currentIdx = visiblePanels.indexOf(this.activePrimary);
    const nextIdx =
      (currentIdx + direction + visiblePanels.length) % visiblePanels.length;
    const nextPanel = visiblePanels[nextIdx] ?? this.activePrimary;
    this.focusPanel(nextPanel);
    return nextPanel;
  }

  setPanelContent(id: PanelId, lines: string[]): void {
    const state = this.panelStates.get(id);
    if (state) {
      state.contentLines = lines;
    }
  }

  setPanelBadge(id: PanelId, badge?: string): void {
    const state = this.panelStates.get(id);
    if (state) {
      state.badge = badge;
    }
  }

  update(width: number = 120): void {
    this.renderTabBar(width);
    this.renderDivider(width);
  }

  getActivePrimary(): PanelId {
    return this.activePrimary;
  }

  getActiveSecondary(): PanelId | null {
    return this.activeSecondary;
  }

  getPrimaryContainer(): Container {
    return this.primaryContainer;
  }

  getSecondaryContainer(): Container {
    return this.secondaryContainer;
  }

  private renderTabBar(width: number): void {
    if (!this.showTabs) {
      this.tabBar.setText("");
      return;
    }

    const parts: string[] = [];
    for (const id of DEFAULT_PANEL_ORDER) {
      const state = this.panelStates.get(id);
      if (!state?.visible) continue;

      const icon = PANEL_ICONS[id];
      const label = PANEL_LABELS[id];
      const isPrimary = id === this.activePrimary;
      const isSecondary = id === this.activeSecondary;
      const isFocused = state.focused;

      let tab = `${icon} ${label}`;
      if (state.badge) {
        tab += ` ${theme.dim(state.badge)}`;
      }

      if (isFocused) {
        tab = theme.accent(tab);
      } else if (isPrimary || isSecondary) {
        tab = theme.fg(tab);
      } else {
        tab = theme.dim(tab);
      }

      parts.push(tab);
    }

    const line = parts.join(theme.dim(" │ "));
    this.tabBar.setText(truncateAnsi(line, Math.max(20, width)));
  }

  private renderDivider(width: number): void {
    if (this.mode === "single" || !this.activeSecondary) {
      this.dividerBar.setText("");
      return;
    }
    const divider = this.mode === "split-v"
      ? theme.panelBorder("─".repeat(Math.max(1, width)))
      : theme.panelBorder("│");
    this.dividerBar.setText(truncateAnsi(divider, Math.max(1, width)));
  }

  private findNextVisiblePanel(exclude: PanelId): PanelId | null {
    for (const id of DEFAULT_PANEL_ORDER) {
      if (id === exclude) continue;
      const state = this.panelStates.get(id);
      if (state?.visible) return id;
    }
    return null;
  }
}

export function formatPanelHeader(id: PanelId, width: number = 120): string {
  const icon = PANEL_ICONS[id];
  const label = PANEL_LABELS[id];
  const innerWidth = Math.max(10, width - 6);
  const header = `${icon} ${label}`;
  const padding = Math.max(0, innerWidth - header.length - 2);
  return theme.panelBorder(
    `╭─ ${theme.bold(header)} ${"─".repeat(padding)}╮`,
  );
}

export function formatPanelFooter(width: number = 120): string {
  const innerWidth = Math.max(10, width - 2);
  return theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
}
