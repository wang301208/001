import { Container, Text, visibleWidth } from "@mariozechner/pi-tui";
import { theme } from "./theme/theme.js";
import { formatTokens } from "./tui-formatters.js";
import { getGovernanceSummary, type GovernanceStatus } from "./tui-governance-panel.js";
import type { AgentSummary, QueuedMessage, SessionInfo } from "./tui-types.js";

export const ASSISTANT_HELP_TEXT = [
  "助手命令:",
  "Ctrl+C 清空 / 中断 / 退出",
  "Ctrl+D 退出",
  "Ctrl+L 打开模型选择器",
  "Ctrl+G 打开代理选择器",
  "Ctrl+P 打开会话选择器",
  "Ctrl+O 展开或收起工具输出",
  "Ctrl+T 显示或隐藏思考过程",
  "Alt+Enter 运行中追加后续任务",
  "Alt+Up 提交最早的排队消息",
  "Shift+Tab 显示或隐藏治理面板",
  "!<cmd> 执行本地命令",
  "/help 查看命令",
].join("\n");

const ASSISTANT_ART = ["   /\\_/\\", "  ( o.o )", "   > ^ <", "    助手"] as const;

const ASSISTANT_COMMANDS = [
  ["/help", "查看全部命令"],
  ["/status", "查看当前状态"],
  ["/model", "切换模型"],
  ["/agent", "切换代理"],
  ["/session", "切换会话"],
  ["!<cmd>", "执行本地命令"],
] as const;

function padVisible(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function formatAssistantCommandLines() {
  return [
    theme.bold(theme.accent("助手终端")),
    theme.dim("本地自治工作台 | 输入 /help 查看命令"),
    "",
    ...ASSISTANT_COMMANDS.map(
      ([command, description]) =>
        `${theme.accent(command.padEnd(9))}${theme.dim(description)}`,
    ),
  ];
}

export function formatAssistantWelcomePanel(width = 120): string {
  const safeWidth = Math.max(32, Math.floor(width));
  const artLines = ASSISTANT_ART.map((line) => theme.banner(line));
  const commandLines = formatAssistantCommandLines();
  const artWidth = Math.max(...ASSISTANT_ART.map((line) => visibleWidth(line)));
  const wide = safeWidth >= 82;

  if (!wide) {
    return [...artLines, "", ...commandLines].map((line) => truncateAnsi(line, safeWidth)).join("\n");
  }

  const rowCount = Math.max(artLines.length, commandLines.length);
  const lines: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const left = artLines[i] ?? "";
    const right = commandLines[i] ?? "";
    lines.push(truncateAnsi(`${padVisible(left, artWidth + 6)}${right}`, safeWidth));
  }
  return lines.join("\n");
}

export function truncateAnsi(text: string, maxWidth: number, ellipsis = "..."): string {
  if (maxWidth <= 0) {
    return "";
  }
  if (visibleWidth(text) <= maxWidth) {
    return text;
  }
  const suffixWidth = visibleWidth(ellipsis);
  if (maxWidth <= suffixWidth) {
    return ellipsis.slice(0, maxWidth);
  }
  const target = maxWidth - suffixWidth;
  let width = 0;
  let out = "";
  for (const char of text) {
    const charWidth = visibleWidth(char);
    if (width + charWidth > target) {
      break;
    }
    out += char;
    width += charWidth;
  }
  return out + ellipsis;
}

export function contextBar(params: { total?: number | null; context?: number | null; width?: number }) {
  const width = Math.max(4, Math.floor(params.width ?? 10));
  const total = typeof params.total === "number" ? Math.max(0, params.total) : null;
  const context = typeof params.context === "number" ? Math.max(1, params.context) : null;
  const pct = total !== null && context !== null ? Math.min(100, Math.round((total / context) * 100)) : null;
  const filled = pct === null ? 0 : Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return {
    pct,
    bar: `${"#".repeat(filled)}${"-".repeat(width - filled)}`,
  };
}

export function formatAssistantStatusRule(params: {
  activityStatus: string;
  connectionStatus: string;
  cwd?: string;
  sessionInfo: SessionInfo;
  agentLabel: string;
  sessionLabel: string;
  governanceStatus?: GovernanceStatus | null;
  width?: number;
}) {
  const model = params.sessionInfo.model
    ? params.sessionInfo.modelProvider
      ? `${params.sessionInfo.modelProvider}/${params.sessionInfo.model}`
      : params.sessionInfo.model
    : "model ?";
  const busy = ["sending", "waiting", "streaming", "running"].includes(params.activityStatus);
  const status = busy ? `${params.activityStatus}...` : params.activityStatus || "idle";
  const tokens = formatTokens(params.sessionInfo.totalTokens ?? null, params.sessionInfo.contextTokens ?? null);
  const { bar, pct } = contextBar({
    total: params.sessionInfo.totalTokens,
    context: params.sessionInfo.contextTokens,
  });
  const governance = getGovernanceSummary(params.governanceStatus ?? null);
  const cwd = params.cwd ?? process.cwd();
  const cwdLabel = cwd.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join("/") || cwd;
  const parts = [
    `-- ${status}`,
    params.connectionStatus,
    model,
    tokens,
    pct !== null ? `[${bar}] ${pct}%` : `[${bar}]`,
    `agent ${params.agentLabel}`,
    `session ${params.sessionLabel}`,
    governance,
  ];
  const left = parts.join(" | ");
  const line = `${left} -- ${cwdLabel}`;
  return truncateAnsi(line, Math.max(20, params.width ?? 160));
}

export function formatQueuedMessages(params: {
  queued: QueuedMessage[];
  width: number;
  activeIndex?: number | null;
}) {
  if (params.queued.length === 0) {
    return [];
  }
  const maxRows = 3;
  const activeIndex = params.activeIndex ?? null;
  const start =
    activeIndex === null
      ? 0
      : Math.max(0, Math.min(activeIndex - 1, Math.max(0, params.queued.length - maxRows)));
  const end = Math.min(params.queued.length, start + maxRows);
  const lines = [`queued (${params.queued.length})${activeIndex !== null ? ` | editing ${activeIndex + 1}` : ""}`];
  if (start > 0) {
    lines.push("  ...");
  }
  for (let i = start; i < end; i++) {
    const item = params.queued[i];
    if (!item) {
      continue;
    }
    const marker = activeIndex === i ? ">" : " ";
    const mode = item.mode === "steer" ? "steer" : "follow-up";
    const preview = item.text.replace(/\s+/g, " ").trim();
    lines.push(truncateAnsi(`${marker} ${i + 1}. ${mode}: ${preview}`, Math.max(20, params.width)));
  }
  if (end < params.queued.length) {
    lines.push(`  ... and ${params.queued.length - end} more`);
  }
  return lines;
}

export class AssistantBanner extends Container {
  private content = new Text("", 0, 0);
  private visible = true;

  constructor() {
    super();
    this.addChild(this.content);
    this.refresh();
  }

  setVisible(visible: boolean, width?: number) {
    this.visible = visible;
    this.refresh(width);
  }

  refresh(width?: number) {
    if (!this.visible) {
      this.content.setText("");
      return;
    }
    this.content.setText(formatAssistantWelcomePanel(width));
  }
}

export class AssistantSessionPanel extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(params: {
    agentLabel: string;
    sessionLabel: string;
    sessionInfo: SessionInfo;
    agents: AgentSummary[];
    commandCount: number;
    width?: number;
  }) {
    const width = Math.max(40, params.width ?? 120);
    const model = params.sessionInfo.model
      ? params.sessionInfo.modelProvider
        ? `${params.sessionInfo.modelProvider}/${params.sessionInfo.model}`
        : params.sessionInfo.model
      : "unknown";
    const lines = [
      theme.panelBorder("+" + "-".repeat(Math.min(76, width - 2)) + "+"),
      theme.panelBorder("| ") +
        theme.bold(theme.accent("助手终端")) +
        theme.dim(` | agent ${params.agentLabel} | session ${params.sessionLabel}`),
      theme.panelBorder("| ") +
        theme.dim(
          `${params.agents.length} agents | ${params.commandCount} commands | ${model} | ${formatTokens(
            params.sessionInfo.totalTokens ?? null,
            params.sessionInfo.contextTokens ?? null,
          )}`,
        ),
      theme.panelBorder("| ") + theme.dim("Ctrl+L 模型 | Ctrl+G 代理 | Ctrl+P 会话 | Shift+Tab 治理"),
      theme.panelBorder("+" + "-".repeat(Math.min(76, width - 2)) + "+"),
    ];
    this.content.setText(lines.map((line) => truncateAnsi(line, width)).join("\n"));
  }
}

export class AssistantQueuedMessages extends Container {
  private content = new Text("", 0, 0);

  constructor() {
    super();
    this.addChild(this.content);
  }

  update(queued: QueuedMessage[], width: number) {
    const lines = formatQueuedMessages({ queued, width });
    this.content.setText(lines.length > 0 ? theme.dim(lines.join("\n")) : "");
  }
}

export function colorizeStatusRule(text: string, busy: boolean) {
  if (busy) {
    return theme.statusBusy(text);
  }
  return theme.status(text);
}

export function shellPromptSymbol(input: string) {
  return input.trimStart().startsWith("!") ? "$" : ">";
}
