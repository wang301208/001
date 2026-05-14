import { Container, Text, visibleWidth } from "@mariozechner/pi-tui";
import { theme } from "./theme/theme.js";
import { formatTokens } from "./tui-formatters.js";
import { getGovernanceSummary, type GovernanceStatus } from "./tui-governance-panel.js";
import type { AgentSummary, QueuedMessage, SessionInfo } from "./tui-types.js";
import { formatTokenCount } from "../utils/usage-format.js";

export const ZHUSHOU_HELP_TEXT = [
  "助手自然语言交互:",
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
  "Ctrl+A 意识深度面板",
  "Ctrl+S 内心独白开关",
  "Ctrl+F 欲望面板开关",
  "Ctrl+J 梦境面板开关",
  "Ctrl+M 目标面板开关",
  "Ctrl+W 意志面板开关",
  "Ctrl+X 暗影面板开关",
  "Ctrl+E 创造面板开关",
  "Ctrl+Q 终局面板开关",
  "Ctrl+R 关系面板开关",
  "Ctrl+U 时间面板开关",
  "直接输入自然语言目标即可调用功能",
].join("\n");

const ZHUSHOU_HEADER_ART = [
  "⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⡴⠒⠒⠂⠤⢄⡀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⢀⣤⣾⣿⡿⠋⠀⠀⠀⣀⣀⡀⠈⠑⠤⡀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⣠⣿⣿⣿⡟⠀⠀⠀⠀⣾⣿⣿⣿⣆⠀⠀⠘⢄⠀⠀⠀⠀",
  "⠀⠀⠀⣰⣿⣿⣿⣿⣷⡀⠀⠀⠀⢿⣿⣿⣿⠏⠀⠀⠀⠈⢆⠀⠀⠀",
  "⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠉⠉⠁⠀⠀⠀⠀⠀⠘⡀⠀⠀",
  "⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀",
  "⠀⠀⠈⣿⣿⣿⣿⣿⣿⡿⠿⠿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⢠⠁⠀⠀",
  "⠀⠀⠀⠹⣿⣿⣿⣿⠏⠀⠀⠀⠈⣿⣿⣿⣷⡀⠀⠀⠀⢀⠎⠀⠀⠀",
  "⠀⠀⠀⠀⠙⣿⣿⣿⣆⠀⠀⠀⢀⣿⣿⣿⣿⠃⠀⠀⢠⠊⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠈⠛⢿⣿⣷⣶⣶⣿⣿⣿⠟⠁⢀⡠⠒⠁⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠛⠻⠿⠿⠅⠒⠊⠁⠀⠀⠀⠀⠀⠀⠀⠀",
] as const;

const ZHUSHOU_HEADER_ART_WIDTH = 26;

const ZHUSHOU_ART = ZHUSHOU_HEADER_ART;

const ZHUSHOU_COMMANDS = [
  ["查看状态", "查看当前状态"],
  ["列出任务", "查看任务中心"],
  ["切换模型", "打开模型选择"],
  ["切换代理", "打开代理选择"],
  ["回忆会话", "搜索历史记忆"],
  ["执行本地命令", "运行终端命令"],
] as const;

function padVisible(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function formatZhushouCommandLines() {
  return [
    centeredLine("助手", 34),
    theme.dim("自然语言"),
    "",
    ...ZHUSHOU_COMMANDS.map(
      ([command, description]) =>
        `${theme.accent(command.padEnd(9))}${theme.dim(description)}`,
    ),
    "",
    theme.dim("直接描述目标即可调用功能"),
  ];
}

export function formatZhushouWelcomePanel(width = 120): string {
  const safeWidth = Math.max(32, Math.floor(width));
  const artLines = ZHUSHOU_ART.map((line) => theme.banner(truncateAnsi(line, ZHUSHOU_HEADER_ART_WIDTH)));
  const commandLines = formatZhushouCommandLines();
  const artWidth = ZHUSHOU_HEADER_ART_WIDTH;
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

export function formatZhushouStatusRule(params: {
  activityStatus: string;
  connectionStatus: string;
  cwd?: string;
  sessionInfo: SessionInfo;
  agentLabel: string;
  sessionLabel: string;
  governanceStatus?: GovernanceStatus | null;
  autonomyLabel?: string;
  width?: number;
}) {
  const model = params.sessionInfo.model
    ? params.sessionInfo.modelProvider
      ? `${params.sessionInfo.modelProvider}/${params.sessionInfo.model}`
      : params.sessionInfo.model
    : "模型 ?";
  const busy = ["sending", "waiting", "streaming", "running"].includes(params.activityStatus);
  const status = busy ? `${formatActivityStatus(params.activityStatus)}...` : formatActivityStatus(params.activityStatus || "idle");
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
    `代理 ${params.agentLabel}`,
    `会话 ${params.sessionLabel}`,
    governance,
    params.autonomyLabel ?? "",
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
  const lines = [`队列 (${params.queued.length})${activeIndex !== null ? ` | 正在编辑 ${activeIndex + 1}` : ""}`];
  if (start > 0) {
    lines.push("  ...");
  }
  for (let i = start; i < end; i++) {
    const item = params.queued[i];
    if (!item) {
      continue;
    }
    const marker = activeIndex === i ? ">" : " ";
    const mode = item.mode === "steer" ? "重定向" : "后续任务";
    const preview = item.text.replace(/\s+/g, " ").trim();
    lines.push(truncateAnsi(`${marker} ${i + 1}. ${mode}: ${preview}`, Math.max(20, params.width)));
  }
  if (end < params.queued.length) {
    lines.push(`  ... 还有 ${params.queued.length - end} 条`);
  }
  return lines;
}

export class ZhushouBanner extends Container {
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
    this.content.setText(formatZhushouWelcomePanel(width));
  }
}

export class ZhushouSessionPanel extends Container {
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
    gatewayLabel?: string;
    width?: number;
  }) {
    const width = Math.max(40, params.width ?? 120);
    const model = params.sessionInfo.model
      ? params.sessionInfo.modelProvider
        ? `${params.sessionInfo.modelProvider}/${params.sessionInfo.model}`
        : params.sessionInfo.model
      : "未知";
    const innerWidth = Math.max(20, width - 4);
    const wide = width >= 90;
    const toolsLine = ["shell", "files", "models", "memory", "skills", "mcp", "cron", "agents"].join(", ");
    const rightLines = formatZhushouSessionCommandLines({
      agentsCount: params.agents.length,
      gatewayLabel: params.gatewayLabel,
      rightWidth: Math.max(20, innerWidth - ZHUSHOU_HEADER_ART_WIDTH - 6),
      sessionInfo: params.sessionInfo,
      toolsLine,
    });

    const top = theme.panelBorder(`╭${"─".repeat(innerWidth)}╮`);
    const bottom = theme.panelBorder(`╰${"─".repeat(innerWidth)}╯`);
    const body: string[] = [];

    if (!wide) {
      for (const line of [
        ...ZHUSHOU_HEADER_ART.map((item) => theme.banner(truncateAnsi(item, ZHUSHOU_HEADER_ART_WIDTH))),
        "",
        theme.bold(theme.accent("助手")),
        theme.dim("自然语言"),
        `${theme.accent("▾ 示例")}`,
        ...ZHUSHOU_COMMANDS.map(
          ([command, description]) => `${theme.accent(command.padEnd(9))}${theme.dim(description)}`,
        ),
        "",
        `${theme.accent("▸ 可用工具")}`,
        theme.dim(`tools: ${toolsLine}`),
        `${theme.accent("▸ 可用技能")} ${theme.dim("(0)")}`,
        theme.dim("直接输入目标即可调用功能"),
      ]) {
        body.push(theme.panelBorder("│ ") + truncateAnsi(line, innerWidth - 1));
      }
      this.content.setText([top, ...body, bottom].map((line) => truncateAnsi(line, width)).join("\n"));
      return;
    }

    const artLines = ZHUSHOU_HEADER_ART.map((line) =>
      theme.banner(truncateAnsi(line, ZHUSHOU_HEADER_ART_WIDTH)),
    );
    const artWidth = ZHUSHOU_HEADER_ART_WIDTH;
    const divider = theme.panelBorder("│");
    const leftMeta = [
      "",
      `${theme.accent(`模型 ${shortModelLabel(model)}`)}${theme.dim(" · 助手")}`,
      theme.dim(process.cwd().replace(/\\/g, "/")),
      `${theme.dim("会话 ")}${theme.accent(params.sessionLabel)}`,
    ];
    const leftLines = [...artLines, ...leftMeta];
    const rowCount = Math.max(leftLines.length, rightLines.length);
    const rightWidth = Math.max(10, innerWidth - artWidth - 5);
    for (let i = 0; i < rowCount; i++) {
      const left = padVisible(leftLines[i] ?? "", artWidth + 2);
      const right = truncateAnsi(rightLines[i] ?? "", rightWidth);
      body.push(`${theme.panelBorder("│ ")}${left}${divider} ${right}`);
    }
    this.content.setText([top, ...body, bottom].map((line) => truncateAnsi(line, width)).join("\n"));
  }
}

export class ZhushouQueuedMessages extends Container {
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

function formatActivityStatus(status: string): string {
  const normalized = status.trim();
  const labels: Record<string, string> = {
    idle: "空闲",
    sending: "发送中",
    waiting: "等待中",
    streaming: "接收中",
    running: "运行中",
    steering: "重定向中",
    listening: "监听中",
    "voice unavailable": "语音不可用",
    connected: "已连接",
    disconnected: "已断开",
    error: "错误",
  };
  return labels[normalized] ?? normalized;
}

function centeredLine(text: string, width: number): string {
  const visible = visibleWidth(text);
  if (visible >= width) {
    return theme.bold(theme.accent(truncateAnsi(text, width)));
  }
  const left = Math.floor((width - visible) / 2);
  return `${" ".repeat(left)}${theme.bold(theme.accent(text))}`;
}

function formatZhushouSessionCommandLines(params: {
  agentsCount: number;
  gatewayLabel?: string;
  rightWidth: number;
  sessionInfo: SessionInfo;
  toolsLine: string;
}) {
  return [
    centeredLine("助手", params.rightWidth),
    theme.dim("自然语言"),
    "",
    `${theme.accent("▾ 示例")}`,
    ...ZHUSHOU_COMMANDS.map(
      ([command, description]) => `${theme.accent(command.padEnd(9))}${theme.dim(description)}`,
    ),
    "",
    `${theme.accent("▸ 可用工具")}`,
    `${theme.dim("tools: ")}${theme.fg(params.toolsLine)}`,
    `${theme.accent("▸ 可用技能")} ${theme.dim("(0)")}`,
    `${theme.accent("▸ 系统提示")} ${theme.dim("当前会话上下文")}`,
    `${theme.accent("▸ MCP 服务器")} ${theme.dim("connected")}`,
    "",
    theme.fg(
      `自然语言直达 · ${params.agentsCount} agents`,
    ),
    theme.dim(formatCompactionProgressLine(params.sessionInfo)),
    theme.dim("直接输入目标即可调用功能"),
  ];
}

function formatCompactionProgressLine(sessionInfo: SessionInfo) {
  const totalTokens =
    typeof sessionInfo.totalTokens === "number" ? sessionInfo.totalTokens : 0;
  const { bar, pct } = contextBar({
    total: totalTokens,
    context: sessionInfo.contextTokens,
  });
  const contextTokens =
    typeof sessionInfo.contextTokens === "number" ? sessionInfo.contextTokens : null;
  const tokens =
    contextTokens === null
      ? formatTokens(totalTokens, null)
      : `令牌 ${formatTokenCount(totalTokens)}/${formatTokenCount(contextTokens)}`;
  const count = Math.max(0, Math.floor(sessionInfo.compactionCount ?? 0));
  const checkpointCount = Math.max(0, Math.floor(sessionInfo.compactionCheckpointCount ?? 0));
  const countLabel = count > 0 ? ` · ${count} 次` : "";
  const checkpointLabel = checkpointCount > 0 ? ` · ${checkpointCount} 个检查点` : "";
  const pctLabel = `${pct ?? 0}%`;
  return `自动压缩 ${tokens} · [${bar}] ${pctLabel}${countLabel}${checkpointLabel}`;
}

function shortModelLabel(model: string): string {
  return model.split("/").pop()?.replace(/[-_]/g, " ").trim() || model;
}

export function shellPromptSymbol(input: string) {
  return input.trimStart().startsWith("!") ? "$" : ">";
}
