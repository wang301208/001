import { randomUUID } from "node:crypto";
import type { Component, SelectItem, TUI } from "@mariozechner/pi-tui";
import { normalizeGroupActivation } from "../auto-reply/group-activation.js";
import {
  formatThinkingLevels,
  normalizeUsageDisplay,
  resolveResponseUsageMode,
} from "../auto-reply/thinking.js";
import type { SessionsPatchResult } from "../gateway/protocol/index.js";
import { formatRelativeTimestamp } from "../infra/format-time/format-relative.ts";
import { normalizeAgentId } from "../routing/session-key.js";
import type { ZhushouAction } from "./zhushou-actions.js";
import { ZHUSHOU_HELP_TEXT } from "./zhushou-style.js";
import type { ChatLog } from "./components/chat-log.js";
import {
  createFilterableSelectList,
  createSearchableSelectList,
  createSettingsList,
} from "./components/selectors.js";
import type {
  GatewayAgentsParallelBatch,
  GatewayAgentsParallelList,
  GatewayBusinessTaskCreateParams,
  GatewayBusinessTaskDuration,
  GatewayBusinessTaskPriority,
  GatewayBusinessTaskStatus,
  GatewayChatClient,
  GatewayMcpToolCallParams,
} from "./gateway-chat.js";
import { formatEffectiveToolsForTui, formatToolsCatalogForTui } from "./tool-capabilities.js";
import { sanitizeRenderableText } from "./tui-formatters.js";
import { formatStatusSummary } from "./tui-status-summary.js";
import type {
  AgentSummary,
  GatewayStatusSummary,
  TuiOptions,
  TuiStateAccess,
} from "./tui-types.js";

type CommandHandlerContext = {
  client: GatewayChatClient;
  chatLog: ChatLog;
  tui: TUI;
  opts: TuiOptions;
  state: TuiStateAccess;
  deliverDefault: boolean;
  openOverlay: (component: Component) => void;
  closeOverlay: () => void;
  refreshSessionInfo: () => Promise<void>;
  loadHistory: () => Promise<void>;
  setSession: (key: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  abortActive: () => Promise<void>;
  setActivityStatus: (text: string) => void;
  setToolsExpanded?: (expanded: boolean) => void;
  captureVoiceInput?: () => Promise<
    { ok: true; text: string; source: string } | { ok: false; message: string; setupHint: string }
  >;
  submitRobotInput?: (text: string) => void;
  formatSessionKey: (key: string) => string;
  applySessionInfoFromPatch: (result: SessionsPatchResult) => void;
  noteLocalRunId: (runId: string) => void;
  noteLocalBtwRunId?: (runId: string) => void;
  forgetLocalRunId?: (runId: string) => void;
  forgetLocalBtwRunId?: (runId: string) => void;
  toggleGovernancePanel?: () => void;
  requestExit: () => void;
  onUserMessage?: (text: string) => void;
};

function isBtwCommand(text: string): boolean {
  return /^\/btw(?::|\s|$)/i.test(text.trim());
}

const BUSINESS_TASK_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const BUSINESS_TASK_DURATION_LABELS: Record<string, string> = {
  short: "短期",
  medium: "中期",
  long: "长期",
};

const BUSINESS_TASK_PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const SKILL_STATE_LABELS: Record<string, string> = {
  disabled: "已禁用",
  ineligible: "不适用",
  ready: "就绪",
};

const PARALLEL_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  starting: "启动中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function labelValue(value: string | undefined, labels: Record<string, string>, fallback = "未知") {
  if (!value) {
    return fallback;
  }
  return labels[value] ?? value;
}

function buildExplicitToolInvocationMessage(toolName: string, goal: string): string {
  return [
    `调用工具 ${toolName}`,
    `请求工具: ${toolName}`,
    `用户目标: ${goal}`,
    "",
    "如果本会话可用，请通过正常函数调用运行时调用该工具。",
    "如果精确工具不可用，请先说明最接近的可用工具或能力，再执行后续动作。",
    "不要假装工具已被调用；必须依赖真实工具事件和结果。",
  ].join("\n");
}

function listEffectiveToolIds(result: { groups?: Array<{ tools?: Array<{ id?: string }> }> }) {
  return (result.groups ?? []).flatMap((group) =>
    (group.tools ?? [])
      .map((tool) => (typeof tool.id === "string" ? tool.id.trim() : ""))
      .filter(Boolean),
  );
}

function resolveRequestedToolName(requested: string, toolIds: string[]) {
  const normalized = requested.trim().toLowerCase();
  const exact = toolIds.find((id) => id.toLowerCase() === normalized);
  if (exact) {
    return { ok: true as const, toolName: exact };
  }

  const aliasTargets: Record<string, string[]> = {
    browse: ["browser"],
    browser: ["browser"],
    exec: ["exec"],
    fetch: ["web_fetch"],
    governance: ["governance"],
    message: ["message"],
    search: ["web_search", "memory_search", "x_search"],
    shell: ["exec"],
    spawn: ["sessions_spawn"],
    web: ["web_search", "web_fetch"],
  };
  const aliasCandidates = (aliasTargets[normalized] ?? []).filter((id) => toolIds.includes(id));
  if (aliasCandidates.length === 1) {
    return { ok: true as const, toolName: aliasCandidates[0] };
  }
  if (aliasCandidates.length > 1) {
    return { ok: false as const, reason: "ambiguous", candidates: aliasCandidates };
  }

  const containsCandidates = toolIds.filter((id) => id.toLowerCase().includes(normalized));
  if (containsCandidates.length === 1) {
    return { ok: true as const, toolName: containsCandidates[0] };
  }
  if (containsCandidates.length > 1) {
    return { ok: false as const, reason: "ambiguous", candidates: containsCandidates };
  }
  return { ok: false as const, reason: "missing", candidates: toolIds };
}

function parseGatewayActionParams(action: Extract<ZhushouAction, { type: "gateway.call" }>):
  | { ok: true; method: string; params?: unknown }
  | { ok: false; message: string } {
  if (!/^[a-zA-Z0-9_.:-]+$/.test(action.method)) {
    return { ok: false, message: "gateway-call 方法名包含无效字符" };
  }
  if (action.rawParams === undefined) {
    return action.params === undefined
      ? { ok: true, method: action.method }
      : { ok: true, method: action.method, params: action.params };
  }
  const rawParams = action.rawParams.trim();
  if (!rawParams) {
    return { ok: true, method: action.method };
  }
  try {
    return { ok: true, method: action.method, params: JSON.parse(rawParams) as unknown };
  } catch {
    return { ok: false, message: "gateway-call 参数必须是 JSON" };
  }
}

function parseJsonObject(raw: string, usage: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: usage };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: usage };
  }
}

function parseOptionalPositiveInteger(
  value: string,
  usage: string,
): { ok: true; value?: number } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return { ok: false, message: usage };
  }
  return { ok: true, value: parsed };
}

function parseBusinessTaskStatus(value: string): GatewayBusinessTaskStatus | undefined {
  const normalized = value.trim().toLowerCase();
  return normalized === "pending" ||
    normalized === "running" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "cancelled"
    ? normalized
    : undefined;
}

function parseBusinessTaskDuration(value: string | undefined): GatewayBusinessTaskDuration {
  return value === "medium" || value === "long" ? value : "short";
}

function parseBusinessTaskPriority(value: string | undefined): GatewayBusinessTaskPriority {
  return value === "high" || value === "low" ? value : "medium";
}

function parseBusinessTaskCreateArgs(args: string):
  | { ok: true; params: GatewayBusinessTaskCreateParams }
  | { ok: false; message: string } {
  const parsed = parsePipeArgs(
    args,
    "用法: /task-create <name> | <goal> | <short|medium|long> | <high|medium|low>",
    2,
  );
  if (!parsed.ok) {
    return parsed;
  }
  const [name, goal, durationRaw, priorityRaw] = parsed.parts;
  if (!name || !goal) {
    return {
      ok: false,
      message: "用法: /task-create <name> | <goal> | <short|medium|long> | <high|medium|low>",
    };
  }
  return {
    ok: true,
    params: {
      name,
      goal,
      duration: parseBusinessTaskDuration(durationRaw),
      priority: parseBusinessTaskPriority(priorityRaw),
    },
  };
}

function parseRemoteModelsArgs(args: string):
  | { ok: true; params: { api: string; endpoint: string; provider?: string; apiKey?: string } }
  | { ok: false; message: string } {
  const [api = "", endpoint = "", provider = "", apiKey = ""] = args.split(/\s+/);
  if (!api || !endpoint) {
    return {
      ok: false,
      message: "用法: /remote-models <api> <endpoint> [provider] [apiKey]",
    };
  }
  return {
    ok: true,
    params: {
      api,
      endpoint,
      ...(provider ? { provider } : {}),
      ...(apiKey ? { apiKey } : {}),
    },
  };
}

function parseMcpActionParams(action: Extract<ZhushouAction, { type: "mcp.call" }>):
  | { ok: true; params: GatewayMcpToolCallParams }
  | { ok: false; message: string } {
  const name = action.name.trim();
  if (!name) {
    return { ok: false, message: "MCP 调用需要工具名和 JSON 参数" };
  }
  if (action.rawArguments === undefined) {
    return { ok: true, params: { name, arguments: action.arguments ?? {} } };
  }
  const rawArguments = action.rawArguments.trim();
  if (!rawArguments) {
    return { ok: true, params: { name, arguments: {} } };
  }
  const parsed = parseJsonObject(rawArguments, "mcp-call 参数必须是 JSON 对象");
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, params: { name, arguments: parsed.value } };
}

function formatGatewayCallResult(method: string, result: unknown): string {
  return `${method} 调用结果\n${JSON.stringify(result, null, 2)}`;
}

function isUnknownGatewayMethodError(message: string): boolean {
  return /unknown method/i.test(message);
}

async function formatGatewayCallFailureWithSuggestions(
  client: GatewayChatClient,
  method: string,
  err: unknown,
): Promise<string> {
  const message = sanitizeRenderableText(String(err));
  if (!isUnknownGatewayMethodError(message)) {
    return `gateway-call 失败: ${message}`;
  }
  try {
    const matches = await client.listGatewayMethods({ query: method });
    const suggestions = matches.methods.slice(0, 8).map((entry) => entry.name);
    if (suggestions.length === 0) {
      return `gateway-call 失败: ${message}\n未找到匹配的网关方法。使用 /methods 查看可用 RPC 方法。`;
    }
    return `gateway-call 失败: ${message}\n你可能想调用: ${suggestions.join(", ")}`;
  } catch {
    return `gateway-call 失败: ${message}\n使用 /methods 查看可用 RPC 方法。`;
  }
}

function formatGatewayMethodsForTui(result: {
  count: number;
  query?: string;
  methods: Array<{ name: string; category?: string; scope?: string }>;
}): string {
  const lines = [
    `网关 RPC 方法: ${result.count}`,
    ...(result.query ? [`查询: ${result.query}`] : []),
    ...result.methods.map((method) => {
      const meta = [method.category, method.scope].filter(Boolean).join(" / ");
      return meta ? `- ${method.name} (${meta})` : `- ${method.name}`;
    }),
  ];
  return lines.join("\n");
}

function formatGatewayMethodDescriptionForTui(result: {
  method: { name: string; category?: string; scope?: string };
  paramsSchema?: unknown;
  resultSchema?: unknown;
  exampleParams?: unknown;
  callTemplate: string;
}): string {
  const lines = [
    `网关 RPC 方法: ${result.method.name}`,
    `分类: ${result.method.category ?? "未知"}`,
    `权限域: ${result.method.scope ?? "未分类"}`,
    "",
    "参数 schema:",
    JSON.stringify(result.paramsSchema ?? {}, null, 2),
    "",
    "示例参数:",
    JSON.stringify(result.exampleParams ?? {}, null, 2),
    "",
    "调用模板:",
    result.callTemplate,
  ];
  if (result.resultSchema !== undefined) {
    lines.push("", "结果 schema:", JSON.stringify(result.resultSchema, null, 2));
  }
  return lines.join("\n");
}

function formatBusinessTasksForTui(result: {
  tasks?: Array<{
    id?: string;
    name?: string;
    status?: string;
    goal?: string;
    progress?: number;
    priority?: string;
    duration?: string;
  }>;
}): string {
  const tasks = result.tasks ?? [];
  if (tasks.length === 0) {
    return "业务任务: 0";
  }
  return [
    `业务任务: ${tasks.length}`,
    ...tasks.map((task) => {
      const meta = [
        task.status ? `[${labelValue(task.status, BUSINESS_TASK_STATUS_LABELS)}]` : "",
        typeof task.progress === "number" ? `${task.progress}%` : "",
        task.priority ? `优先级=${labelValue(task.priority, BUSINESS_TASK_PRIORITY_LABELS)}` : "",
        task.duration ? `周期=${labelValue(task.duration, BUSINESS_TASK_DURATION_LABELS)}` : "",
      ].filter(Boolean).join(" ");
      return `- ${task.id ?? "未知"} ${meta} ${task.name ?? ""}\n  ${task.goal ?? ""}`.trimEnd();
    }),
  ].join("\n");
}

function formatConfigForTui(result: { path?: string; raw?: string | null; hash?: string }): string {
  const lines = [`配置 ${result.path ?? "(未知路径)"}`];
  if (result.hash) {
    lines.push(`hash: ${result.hash}`);
  }
  if (typeof result.raw === "string") {
    lines.push(result.raw);
  }
  return lines.join("\n");
}

function formatConfigPatchForTui(result: { changedPaths?: string[]; noop?: boolean }): string {
  if (result.noop) {
    return "配置补丁: 无变更";
  }
  const changed = result.changedPaths?.length ? result.changedPaths.join(", ") : "未知";
  return `配置补丁已应用: ${changed}`;
}

function formatLogsTailForTui(result: { lines?: string[]; cursor?: number; file?: string }): string {
  const lines = result.lines ?? [];
  return [
    `日志尾部: ${lines.length}`,
    ...(result.file ? [`文件: ${result.file}`] : []),
    ...lines,
  ].join("\n");
}

function formatRemoteModelsForTui(result: {
  models?: Array<{ id?: string; name?: string; provider?: string }>;
}): string {
  const models = result.models ?? [];
  return [
    `远程模型: ${models.length}`,
    ...models.slice(0, 50).map((model) => {
      const provider = model.provider ? `${model.provider}/` : "";
      return `- ${provider}${model.id ?? model.name ?? "未知"}`;
    }),
  ].join("\n");
}

function formatSkillsStatusForTui(result: {
  workspaceDir?: string;
  skills?: Array<{ name?: string; skillKey?: string; eligible?: boolean; disabled?: boolean }>;
  entries?: Array<{ name?: string; status?: string }>;
}): string {
  const skills: Array<{
    name?: string;
    skillKey?: string;
    eligible?: boolean;
    disabled?: boolean;
    status?: string;
  }> = result.skills ?? result.entries ?? [];
  return [
    `技能状态: ${skills.length}`,
    ...(result.workspaceDir ? [`工作区: ${result.workspaceDir}`] : []),
    ...skills.slice(0, 30).map((skill) => {
      const name = skill.name ?? skill.skillKey ?? "未知";
      const state = "status" in skill && skill.status
        ? skill.status
        : skill.disabled
          ? "disabled"
          : skill.eligible === false
            ? "ineligible"
            : "ready";
      return `- ${name} [${labelValue(state, SKILL_STATE_LABELS)}]`;
    }),
  ].join("\n");
}

function formatSkillsSearchForTui(result: {
  results?: Array<{ slug?: string; displayName?: string; score?: number; summary?: string }>;
}): string {
  const results = result.results ?? [];
  return [
    `技能搜索: ${results.length}`,
    ...results.slice(0, 20).map((entry) => {
      const score = typeof entry.score === "number" ? ` score=${entry.score}` : "";
      return `- ${entry.slug ?? entry.displayName ?? "未知"}${score} ${entry.displayName ?? ""}`.trimEnd();
    }),
  ].join("\n");
}

function formatAgentFilesForTui(result: {
  files?: Array<{ name?: string; exists?: boolean; size?: number; updatedAtMs?: number }>;
}): string {
  const files = result.files ?? [];
  return [
    `代理文件: ${files.length}`,
    ...files.map((file) => {
      const meta = [file.exists === false ? "缺失" : "存在", typeof file.size === "number" ? `${file.size}b` : ""]
        .filter(Boolean)
        .join(" ");
      return `- ${file.name ?? "未知"} ${meta}`.trimEnd();
    }),
  ].join("\n");
}

function formatAgentFileForTui(result: { file?: { name?: string; content?: string } }): string {
  return [`代理文件 ${result.file?.name ?? "未知"}`, result.file?.content ?? ""].join("\n");
}

function formatMcpToolsForTui(result: {
  tools?: Array<{ name?: string; description?: string; server?: string }>;
  errors?: Array<{ server?: string; message?: string }>;
}): string {
  const tools = result.tools ?? [];
  return [
    `MCP 工具: ${tools.length}`,
    ...tools.map((tool) => {
      const server = tool.server ? ` 服务=${tool.server}` : "";
      const description = tool.description ? ` - ${tool.description}` : "";
      return `- ${tool.name ?? "未知"}${server}${description}`;
    }),
    ...((result.errors ?? []).length ? ["错误:"] : []),
    ...(result.errors ?? []).map((error) => `- ${error.server ?? "未知"} ${error.message ?? ""}`.trimEnd()),
  ].join("\n");
}

function formatMcpCallForTui(toolName: string, result: unknown): string {
  return `MCP 调用 ${toolName}\n${JSON.stringify(result, null, 2)}`;
}

function formatExperienceSearchForTui(result: {
  query: string;
  results: Array<{ type: string; id: string; summary: string; score: number; source?: string }>;
}): string {
  const lines = [
    `经验搜索: ${result.query}`,
    `匹配: ${result.results.length}`,
    ...result.results.slice(0, 12).map((entry) => {
      const source = entry.source ? ` 来源=${entry.source}` : "";
      return `- [${entry.type}] ${entry.id} score=${entry.score}${source}\n  ${entry.summary}`;
    }),
  ];
  return lines.join("\n");
}

function formatExperienceSummaryForTui(result: {
  counts: { events: number; skillCandidates: number; selfModelFacts?: number };
  recentEvents?: Array<{ id: string; kind?: string; summary: string }>;
  recentSkillCandidates?: Array<{ id: string; title: string; status: string }>;
}): string {
  return [
    "经验摘要",
    `事件: ${result.counts.events}`,
    `技能候选: ${result.counts.skillCandidates}`,
    `自我模型事实: ${result.counts.selfModelFacts ?? 0}`,
    ...((result.recentEvents ?? []).length ? ["", "最近事件:"] : []),
    ...(result.recentEvents ?? []).slice(0, 8).map((event) =>
      `- ${event.id} ${event.kind ? `[${event.kind}] ` : ""}${event.summary}`
    ),
    ...((result.recentSkillCandidates ?? []).length ? ["", "最近技能候选:"] : []),
    ...(result.recentSkillCandidates ?? []).slice(0, 8).map((candidate) =>
      `- ${candidate.id} [${candidate.status}] ${candidate.title}`
    ),
  ].join("\n");
}

function formatSessionRecallForTui(result: {
  query: string;
  backend: string;
  summary: string;
  hits: Array<{ id: string; path: string; snippet: string; score: number; role?: string }>;
}): string {
  return [
    `会话回忆: ${result.query}`,
    `后端: ${result.backend}`,
    result.summary,
    ...((result.hits ?? []).length ? ["", "命中:"] : []),
    ...(result.hits ?? []).slice(0, 8).map((hit) => {
      const role = hit.role ? ` 角色=${hit.role}` : "";
      return `- ${hit.id} score=${hit.score}${role}\n  ${hit.snippet}`;
    }),
  ].join("\n");
}

function formatSkillCandidatesForTui(result: {
  candidates: Array<{ id: string; title: string; status: string; trigger?: string; steps?: string[] }>;
}): string {
  return [
    `技能候选: ${result.candidates.length}`,
    ...result.candidates.map((candidate) => {
      const steps = candidate.steps?.length ? ` 步骤=${candidate.steps.join(" -> ")}` : "";
      const trigger = candidate.trigger ? ` 触发=${candidate.trigger}` : "";
      return `- ${candidate.id} [${candidate.status}] ${candidate.title}${trigger}${steps}`;
    }),
  ].join("\n");
}

function parseSkillCandidateCreateArgs(args: string):
  | { ok: true; title: string; trigger: string; steps: string[] }
  | { ok: false; message: string } {
  const parts = args.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) {
    return {
      ok: false,
      message: "用法: /skill-candidate-create <title> | <trigger> | <step1, step2>",
    };
  }
  const [title, trigger, stepsRaw] = parts;
  const steps = stepsRaw.split(/[,;，；]/).map((step) => step.trim()).filter(Boolean);
  if (!title || !trigger || steps.length === 0) {
    return {
      ok: false,
      message: "用法: /skill-candidate-create <title> | <trigger> | <step1, step2>",
    };
  }
  return { ok: true, title, trigger, steps };
}

function parsePipeArgs(
  args: string,
  usage: string,
  minParts: number,
): { ok: true; parts: string[] } | { ok: false; message: string } {
  const parts = args.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < minParts) {
    return { ok: false, message: usage };
  }
  return { ok: true, parts };
}

function parseAgentsParallelArgs(args: string):
  | { ok: true; tasks: Array<{ agentId?: string; goal: string }> }
  | { ok: false; message: string } {
  const segments = args.split("|").map((part) => part.trim()).filter(Boolean);
  if (segments.length < 2) {
    return {
      ok: false,
      message: "用法: /agents-parallel <agent: goal | agent: goal>",
    };
  }
  const tasks = segments.map((segment) => {
    const match = segment.match(/^([a-zA-Z0-9_.-]+)\s*:\s*(.+)$/);
    if (match) {
      return { agentId: normalizeAgentId(match[1] ?? ""), goal: (match[2] ?? "").trim() };
    }
    return { goal: segment };
  }).filter((task) => task.goal);
  if (tasks.length < 2) {
    return {
      ok: false,
      message: "用法: /agents-parallel <agent: goal | agent: goal>",
    };
  }
  return { ok: true, tasks };
}

function formatAgentsParallelBatchForTui(batch: GatewayAgentsParallelBatch): string {
  const counts = batch.counts;
  return [
    `并行批次 ${batch.batchId}`,
    `状态=${labelValue(batch.status, PARALLEL_STATUS_LABELS)} 总数=${counts.total} 排队=${counts.queued} 启动=${counts.starting} 运行=${counts.running} 失败=${counts.failed} 取消=${counts.cancelled}`,
    ...batch.tasks.map((task) => {
      const agent = task.agentId ? ` 代理=${task.agentId}` : "";
      const run = task.runId ? ` 运行=${task.runId}` : "";
      const session = task.sessionKey ? ` 会话=${task.sessionKey}` : "";
      const error = task.error ? ` 错误=${task.error}` : "";
      return `- ${task.id} [${labelValue(task.status, PARALLEL_STATUS_LABELS)}]${agent}${run}${session}${error}\n  ${task.goal}`;
    }),
  ].join("\n");
}

function formatAgentsParallelListForTui(result: GatewayAgentsParallelList): string {
  if (result.batches.length === 0) {
    return "并行批次: 0";
  }
  return [
    `并行批次: ${result.batches.length}`,
    ...result.batches.map((batch) => {
      const counts = batch.counts;
      return `- ${batch.batchId} 状态=${labelValue(batch.status, PARALLEL_STATUS_LABELS)} 总数=${counts.total} 运行=${counts.running} 失败=${counts.failed} 取消=${counts.cancelled}`;
    }),
  ].join("\n");
}

export function createCommandHandlers(context: CommandHandlerContext) {
  const {
    client,
    chatLog,
    tui,
    opts,
    state,
    deliverDefault,
    openOverlay,
    closeOverlay,
    refreshSessionInfo,
    loadHistory,
    setSession,
    refreshAgents,
    abortActive,
    setActivityStatus,
    setToolsExpanded,
    captureVoiceInput,
    submitRobotInput,
    formatSessionKey,
    applySessionInfoFromPatch,
    noteLocalBtwRunId,
    forgetLocalRunId,
    forgetLocalBtwRunId,
    toggleGovernancePanel,
    requestExit,
  } = context;

  const setAgent = async (id: string) => {
    state.currentAgentId = normalizeAgentId(id);
    await setSession("");
  };

  const closeOverlayAndRender = () => {
    closeOverlay();
    tui.requestRender();
  };

  const openSelector = (
    selector: {
      onSelect?: (item: SelectItem) => void;
      onCancel?: () => void;
    },
    onSelect: (value: string) => Promise<void>,
  ) => {
    selector.onSelect = (item) => {
      void (async () => {
        await onSelect(item.value);
        closeOverlayAndRender();
      })();
    };
    selector.onCancel = closeOverlayAndRender;
    openOverlay(selector as Component);
    tui.requestRender();
  };

  const openModelSelector = async () => {
    try {
      const models = await client.listModels();
      if (models.length === 0) {
        chatLog.addSystem("没有可用模型");
        tui.requestRender();
        return;
      }
      const items = models.map((model) => ({
        value: `${model.provider}/${model.id}`,
        label: `${model.provider}/${model.id}`,
        description: model.name && model.name !== model.id ? model.name : "",
      }));
      const selector = createSearchableSelectList(items, 9);
      openSelector(selector, async (value) => {
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            model: value,
          });
          chatLog.addSystem(`模型已设置为 ${value}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`模型设置失败: ${String(err)}`);
        }
      });
    } catch (err) {
      chatLog.addSystem(`模型列表获取失败: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openAgentSelector = async () => {
    await refreshAgents();
    if (state.agents.length === 0) {
      chatLog.addSystem("未找到代理");
      tui.requestRender();
      return;
    }
    const items = state.agents.map((agent: AgentSummary) => ({
      value: agent.id,
      label: agent.name ? `${agent.id} (${agent.name})` : agent.id,
      description: agent.id === state.agentDefaultId ? "默认" : "",
    }));
    const selector = createSearchableSelectList(items, 9);
    openSelector(selector, async (value) => {
      await setAgent(value);
    });
  };

  const openSessionSelector = async () => {
    try {
      const result = await client.listSessions({
        includeGlobal: false,
        includeUnknown: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
        agentId: state.currentAgentId,
      });
      const items = result.sessions.map((session) => {
        const title = session.derivedTitle ?? session.displayName;
        const formattedKey = formatSessionKey(session.key);
        // 标题与键匹配时避免冗余的 "title (key)"
        const label = title && title !== formattedKey ? `${title} (${formattedKey})` : formattedKey;
        // 构建描述：时间 + 消息预览
        const timePart = session.updatedAt
          ? formatRelativeTimestamp(session.updatedAt, { dateFallback: true, fallback: "" })
          : "";
        const preview = session.lastMessagePreview?.replace(/\s+/g, " ").trim();
        const description =
          timePart && preview ? `${timePart} - ${preview}` : (preview ?? timePart);
        return {
          value: session.key,
          label,
          description,
          searchText: [
            session.displayName,
            session.label,
            session.subject,
            session.sessionId,
            session.key,
            session.lastMessagePreview,
          ]
            .filter(Boolean)
            .join(" "),
        };
      });
      const selector = createFilterableSelectList(items, 9);
      openSelector(selector, async (value) => {
        await setSession(value);
      });
    } catch (err) {
      chatLog.addSystem(`会话列表获取失败: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openSettings = () => {
    const items = [
      {
        id: "tools",
        label: "工具输出",
        currentValue: state.toolsExpanded ? "expanded" : "collapsed",
        values: ["collapsed", "expanded"],
      },
      {
        id: "thinking",
        label: "显示思考",
        currentValue: state.showThinking ? "on" : "off",
        values: ["off", "on"],
      },
    ];
    const settings = createSettingsList(
      items,
      (id, value) => {
        if (id === "tools") {
          state.toolsExpanded = value === "expanded";
          chatLog.setToolsExpanded(state.toolsExpanded);
        }
        if (id === "thinking") {
          state.showThinking = value === "on";
          void loadHistory();
        }
        tui.requestRender();
      },
      () => {
        closeOverlay();
        tui.requestRender();
      },
    );
    openOverlay(settings);
    tui.requestRender();
  };

  const steerActiveRun = async (instruction: string) => {
    const message = instruction.trim();
    if (!message) {
      chatLog.addSystem("用法: /steer <instruction>");
      return;
    }
    if (!state.isConnected) {
      chatLog.addSystem("未连接到网关，重定向未发送");
      setActivityStatus("disconnected");
      return;
    }
    if (!state.activeChatRunId) {
      chatLog.addSystem("当前没有可重定向的运行");
      return;
    }

    const runId = randomUUID();
    try {
      chatLog.addUser(`/steer ${message}`);
      state.pendingOptimisticUserMessage = true;
      state.activeChatRunId = runId;
      setActivityStatus("steering");
      tui.requestRender();
      const result = await client.steerSession({
        sessionKey: state.currentSessionKey,
        message,
        thinking: opts.thinking,
        timeoutMs: opts.timeoutMs,
        runId,
      });
      const nextRunId = typeof result.runId === "string" && result.runId.trim() ? result.runId : runId;
      state.activeChatRunId = nextRunId;
      setActivityStatus("waiting");
    } catch (err) {
      forgetLocalRunId?.(runId);
      state.pendingOptimisticUserMessage = false;
      state.activeChatRunId = null;
      chatLog.addSystem(`重定向失败: ${sanitizeRenderableText(String(err))}`);
      setActivityStatus("error");
    }
  };

  const callGatewayAction = async (action: Extract<ZhushouAction, { type: "gateway.call" }>) => {
    const parsed = parseGatewayActionParams(action);
    if (!parsed.ok) {
      chatLog.addSystem(parsed.message);
      return;
    }
    try {
      const result = await client.callGatewayMethod(parsed.method, parsed.params);
      chatLog.addSystem(formatGatewayCallResult(parsed.method, result));
    } catch (err) {
      chatLog.addSystem(
        await formatGatewayCallFailureWithSuggestions(client, parsed.method, err),
      );
    }
  };

  const callMcpAction = async (action: Extract<ZhushouAction, { type: "mcp.call" }>) => {
    const parsed = parseMcpActionParams(action);
    if (!parsed.ok) {
      chatLog.addSystem(parsed.message);
      return;
    }
    try {
      const result = await client.callMcpTool(parsed.params);
      chatLog.addSystem(formatMcpCallForTui(parsed.params.name, result));
    } catch (err) {
      chatLog.addSystem(`MCP 调用失败: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const invokeToolAction = async (action: Extract<ZhushouAction, { type: "tool.invoke" }>) => {
    const toolName = action.toolName.trim();
    const goal = action.goal.trim();
    if (!toolName || !goal) {
      chatLog.addSystem("工具调用需要工具名和目标");
      return;
    }
    try {
      const effective = await client.getEffectiveTools({
        sessionKey: state.currentSessionKey,
        agentId: state.currentAgentId,
      });
      const toolIds = listEffectiveToolIds(effective);
      const resolvedTool = resolveRequestedToolName(toolName, toolIds);
      if (!resolvedTool.ok) {
        const suggestions = resolvedTool.candidates.slice(0, 12).join(", ") || "无";
        if (resolvedTool.reason === "ambiguous") {
          chatLog.addSystem(`工具 "${toolName}" 不明确。候选: ${suggestions}`);
          return;
        }
        chatLog.addSystem(
          `工具 "${toolName}" 在当前会话不可用。可用工具: ${suggestions}`,
        );
        return;
      }
      await sendMessage(buildExplicitToolInvocationMessage(resolvedTool.toolName, goal));
    } catch (err) {
      chatLog.addSystem(`工具可用性检查失败: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const handleAction = async (action: ZhushouAction) => {
    switch (action.type) {
      case "gateway.call":
        await callGatewayAction(action);
        break;
      case "mcp.call":
        await callMcpAction(action);
        break;
      case "tool.invoke":
        await invokeToolAction(action);
        break;
      case "tui.operation":
        await executeTuiOperation(
          action.operation.replace(/^\//, "").trim(),
          action.args ?? "",
          action.raw ?? [action.operation, action.args].filter(Boolean).join(" "),
        );
        return;
      case "shell.run":
        chatLog.addSystem("本地命令动作需要由 TUI 本地 shell 运行器执行");
        break;
    }
    tui.requestRender();
  };

  const executeTuiOperation = async (name: string, args: string, fallbackMessage?: string) => {
    if (!name) {
      return;
    }
    switch (name) {
      case "help":
        chatLog.addSystem(ZHUSHOU_HELP_TEXT);
        break;
      case "voice": {
        if (args === "status") {
          chatLog.addSystem(
            captureVoiceInput
              ? "语音输入: 已配置。按 Ctrl+Y 或直接说“开始语音输入”。"
              : "语音输入: 当前 TUI 运行时未接入。",
          );
          break;
        }
        if (!captureVoiceInput || !submitRobotInput) {
          chatLog.addSystem("当前 TUI 运行时不可用语音输入");
          break;
        }
        setActivityStatus("listening");
        tui.requestRender();
        const result = await captureVoiceInput();
        if (!result.ok) {
          chatLog.addSystem(`${result.message}\n${result.setupHint}`);
          setActivityStatus("voice unavailable");
          break;
        }
        chatLog.addSystem(`语音 -> ${result.text}`);
        submitRobotInput(result.text);
        break;
      }
      case "gateway-status":
        try {
          const status = await client.getGatewayStatus();
          if (typeof status === "string") {
            chatLog.addSystem(status);
            break;
          }
          if (status && typeof status === "object") {
            const lines = formatStatusSummary(status as GatewayStatusSummary);
            for (const line of lines) {
              chatLog.addSystem(line);
            }
            break;
          }
          chatLog.addSystem("状态: 未知响应");
        } catch (err) {
          chatLog.addSystem(`状态获取失败: ${String(err)}`);
        }
        break;
      case "tasks":
      {
        const status = args ? parseBusinessTaskStatus(args) : undefined;
        if (args && !status) {
          chatLog.addSystem("用法: /tasks [pending|running|completed|failed|cancelled]");
          break;
        }
        try {
          const result = await client.listBusinessTasks(status ? { status } : {});
          chatLog.addSystem(formatBusinessTasksForTui(result));
        } catch (err) {
          chatLog.addSystem(`业务任务获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "task-create": {
        const parsed = parseBusinessTaskCreateArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.createBusinessTask(parsed.params);
          chatLog.addSystem(`任务已创建: ${result.task.id}\n${result.task.name}`);
        } catch (err) {
          chatLog.addSystem(`任务创建失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "task-update": {
        const parsed = parsePipeArgs(
          args,
          "用法: /task-update <id> | <status> | <progress> | <error>",
          2,
        );
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [id, statusRaw, progressRaw, error] = parsed.parts;
        const status = parseBusinessTaskStatus(statusRaw);
        if (!status) {
          chatLog.addSystem("用法: /task-update <id> | <pending|running|completed|failed|cancelled> | <progress> | <error>");
          break;
        }
        const progress = progressRaw ? Number.parseInt(progressRaw, 10) : undefined;
        if (progressRaw && (!Number.isFinite(progress) || (progress ?? 0) < 0 || (progress ?? 0) > 100)) {
          chatLog.addSystem("任务进度必须在 0-100 之间");
          break;
        }
        try {
          const result = await client.updateBusinessTask({
            id,
            status,
            ...(typeof progress === "number" ? { progress } : {}),
            ...(error ? { error } : {}),
          });
          chatLog.addSystem(`任务已更新: ${result.task.id}\n${labelValue(result.task.status, BUSINESS_TASK_STATUS_LABELS)}`);
        } catch (err) {
          chatLog.addSystem(`任务更新失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "task-delete":
        if (!args) {
          chatLog.addSystem("用法: /task-delete <id>");
          break;
        }
        try {
          const result = await client.deleteBusinessTask({ id: args });
          chatLog.addSystem(`任务已删除: ${result.task.id}`);
        } catch (err) {
          chatLog.addSystem(`任务删除失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "config":
        try {
          const result = await client.getConfig({});
          chatLog.addSystem(formatConfigForTui(result));
        } catch (err) {
          chatLog.addSystem(`配置读取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "config-patch":
        if (!args) {
          chatLog.addSystem("用法: /config-patch <json_object>");
          break;
        }
        try {
          const result = await client.patchConfig({ raw: args });
          chatLog.addSystem(formatConfigPatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`配置补丁失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "logs": {
        const parsed = parseOptionalPositiveInteger(args, "用法: /logs [limit]");
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.tailLogs(
            typeof parsed.value === "number" ? { limit: parsed.value } : {},
          );
          chatLog.addSystem(formatLogsTailForTui(result));
        } catch (err) {
          chatLog.addSystem(`日志读取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "remote-models": {
        const parsed = parseRemoteModelsArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.listRemoteModels(parsed.params as never);
          chatLog.addSystem(formatRemoteModelsForTui(result));
        } catch (err) {
          chatLog.addSystem(`远程模型探测失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skills":
        try {
          const result = await client.getSkillsStatus({});
          chatLog.addSystem(formatSkillsStatusForTui(result));
        } catch (err) {
          chatLog.addSystem(`技能状态获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "skill-search":
        try {
          const result = await client.searchSkills(args ? { query: args } : {});
          chatLog.addSystem(formatSkillsSearchForTui(result));
        } catch (err) {
          chatLog.addSystem(`技能搜索失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-files":
        try {
          const result = await client.listAgentFiles({ agentId: args || state.currentAgentId });
          chatLog.addSystem(formatAgentFilesForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理文件列表获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-file":
        if (!args) {
          chatLog.addSystem("用法: /agent-file <name>");
          break;
        }
        try {
          const result = await client.getAgentFile({ agentId: state.currentAgentId, name: args });
          chatLog.addSystem(formatAgentFileForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理文件读取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-file-set": {
        const parsed = parsePipeArgs(args, "用法: /agent-file-set <name> | <content>", 2);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [name, ...contentParts] = parsed.parts;
        const content = contentParts.join(" | ");
        try {
          const result = await client.setAgentFile({
            agentId: state.currentAgentId,
            name,
            content,
          });
          chatLog.addSystem(`代理文件已保存: ${result.file.name}`);
        } catch (err) {
          chatLog.addSystem(`代理文件保存失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "mcp-tools":
        try {
          const result = await client.listMcpTools({});
          chatLog.addSystem(formatMcpToolsForTui(result));
        } catch (err) {
          chatLog.addSystem(`MCP 工具获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "capabilities":
      case "tools-catalog":
        try {
          const result = await client.getToolsCatalog({
            agentId: state.currentAgentId,
            includePlugins: true,
          });
          chatLog.addSystem(formatToolsCatalogForTui(result, { query: args }));
        } catch (err) {
          chatLog.addSystem(`能力目录获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "gateway-methods":
        try {
          const result = await client.listGatewayMethods(args ? { query: args } : {});
          chatLog.addSystem(formatGatewayMethodsForTui(result));
        } catch (err) {
          chatLog.addSystem(`网关方法列表获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "gateway-method":
        if (!args) {
          chatLog.addSystem("用法: /method <gateway_method>");
          break;
        }
        try {
          const result = await client.describeGatewayMethod(args);
          chatLog.addSystem(formatGatewayMethodDescriptionForTui(result));
        } catch (err) {
          chatLog.addSystem(`网关方法说明获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "tools-effective":
        try {
          const result = await client.getEffectiveTools({
            sessionKey: state.currentSessionKey,
            agentId: state.currentAgentId,
          });
          chatLog.addSystem(formatEffectiveToolsForTui(result));
        } catch (err) {
          chatLog.addSystem(`可用工具获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agents-parallel": {
        const parsed = parseAgentsParallelArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.startAgentsParallel({
            parentSessionKey: state.currentSessionKey,
            tasks: parsed.tasks,
          });
          chatLog.addSystem(formatAgentsParallelBatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理并行启动失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "agents-parallel-status":
        if (!args) {
          chatLog.addSystem("用法: /agents-parallel-status <batchId>");
          break;
        }
        try {
          const result = await client.getAgentsParallelStatus({ batchId: args });
          chatLog.addSystem(formatAgentsParallelBatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理并行状态获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agents-parallel-list": {
        const parsedLimit = args ? Number.parseInt(args, 10) : undefined;
        if (args && (!Number.isFinite(parsedLimit) || (parsedLimit ?? 0) < 1)) {
          chatLog.addSystem("用法: /agents-parallel-list [limit]");
          break;
        }
        try {
          const result = await client.listAgentsParallel(parsedLimit ? { limit: parsedLimit } : {});
          chatLog.addSystem(formatAgentsParallelListForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理并行列表获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "agents-parallel-cancel":
        if (!args) {
          chatLog.addSystem("用法: /agents-parallel-cancel <batchId>");
          break;
        }
        try {
          const result = await client.cancelAgentsParallel({ batchId: args });
          chatLog.addSystem(formatAgentsParallelBatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`代理并行取消失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-capture":
        if (!args) {
          chatLog.addSystem("用法: /experience-capture <summary>");
          break;
        }
        try {
          const result = await client.captureExperience({
            kind: "lesson",
            summary: args,
            source: "tui",
            sessionKey: state.currentSessionKey,
          });
          chatLog.addSystem(`经验已保存: ${result.event.id}\n${result.event.summary}`);
        } catch (err) {
          chatLog.addSystem(`经验保存失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-search":
        if (!args) {
          chatLog.addSystem("用法: /experience-search <query>");
          break;
        }
        try {
          const result = await client.searchExperience({ query: args });
          chatLog.addSystem(formatExperienceSearchForTui(result));
        } catch (err) {
          chatLog.addSystem(`经验搜索失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "session-recall":
        if (!args) {
          chatLog.addSystem("用法: /session-recall <query>");
          break;
        }
        try {
          const result = await client.recallSessionMemory({ query: args });
          chatLog.addSystem(formatSessionRecallForTui(result));
        } catch (err) {
          chatLog.addSystem(`会话回忆失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-summary":
        try {
          const result = await client.getExperienceSummary({});
          chatLog.addSystem(formatExperienceSummaryForTui(result));
        } catch (err) {
          chatLog.addSystem(`经验摘要获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "skill-candidates":
        try {
          const result = await client.listSkillCandidates({});
          chatLog.addSystem(formatSkillCandidatesForTui(result));
        } catch (err) {
          chatLog.addSystem(`技能候选获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "skill-candidate-create": {
        const parsed = parseSkillCandidateCreateArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.createSkillCandidate({
            title: parsed.title,
            trigger: parsed.trigger,
            steps: parsed.steps,
          });
          chatLog.addSystem(
            `技能候选已创建: ${result.candidate.id}\n${result.candidate.title}`,
          );
        } catch (err) {
          chatLog.addSystem(`技能候选创建失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skill-usage-record": {
        const parsed = parsePipeArgs(
          args,
          "用法: /skill-usage-record <candidateId> | <outcome> | <observation1, observation2>",
          2,
        );
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [candidateId, outcome, observationsRaw = ""] = parsed.parts;
        try {
          const result = await client.recordSkillUsage({
            candidateId,
            outcome,
            observations: observationsRaw.split(/[,;锛岋紱]/).map((item) => item.trim()).filter(Boolean),
          });
          chatLog.addSystem(
            `技能使用已记录: ${result.usage.id}\n已改进候选: ${result.candidate.id}`,
          );
        } catch (err) {
          chatLog.addSystem(`技能使用记录失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skill-export":
        if (!args) {
          chatLog.addSystem("用法: /skill-export <candidateId>");
          break;
        }
        try {
          const result = await client.exportSkillCandidate({ candidateId: args });
          chatLog.addSystem(`技能已导出: ${result.name}\n${result.skillPath}`);
        } catch (err) {
          chatLog.addSystem(`技能导出失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "strategy-memory": {
        const parsed = parsePipeArgs(args, "用法: /strategy-memory <title> | <objective>", 2);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [title, objective] = parsed.parts;
        try {
          const result = await client.captureStrategicMemory({ title, objective });
          chatLog.addSystem(`战略记忆已保存: ${result.memory.id}\n${result.memory.title}`);
        } catch (err) {
          chatLog.addSystem(`战略记忆保存失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "strategy-due":
        try {
          const result = await client.listDueStrategicPushes({});
          chatLog.addSystem([
            `到期战略推进: ${result.pushes.length}`,
            ...result.pushes.map((push) => `- ${push.id} [${push.cadence}] ${push.prompt}`),
          ].join("\n"));
        } catch (err) {
          chatLog.addSystem(`到期战略推进获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "strategy-advance":
        if (!args) {
          chatLog.addSystem("用法: /strategy-advance <strategyId>");
          break;
        }
        try {
          const result = await client.advanceStrategicMemory({ id: args });
          chatLog.addSystem(`战略记忆已推进: ${result.memory.id}`);
        } catch (err) {
          chatLog.addSystem(`战略推进失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "self-model":
        try {
          const result = await client.getSelfModel({});
          chatLog.addSystem(`自我模型\n${JSON.stringify(result.selfModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`自我模型获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "self-model-update":
        if (!args) {
          chatLog.addSystem("用法: /self-model-update <pattern>");
          break;
        }
        try {
          const result = await client.updateSelfModel({ learnedPatterns: [args] });
          chatLog.addSystem(`自我模型已更新\n${JSON.stringify(result.selfModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`自我模型更新失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "user-model-update":
        if (!args) {
          chatLog.addSystem("用法: /user-model-update <preference>");
          break;
        }
        try {
          const result = await client.updateUserModel({ preferences: [args] });
          chatLog.addSystem(`用户模型已更新\n${JSON.stringify(result.userModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`用户模型更新失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "user-model":
        if (!args) {
          chatLog.addSystem("用法: /user-model <query>");
          break;
        }
        try {
          const result = await client.queryUserModel({ query: args });
          chatLog.addSystem(
            `用户模型辩证\n${result.answer}\n${JSON.stringify(result.hypotheses ?? [], null, 2)}`,
          );
        } catch (err) {
          chatLog.addSystem(`用户模型查询失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent":
        if (!args) {
          await openAgentSelector();
        } else {
          await setAgent(args);
        }
        break;
      case "agents":
        await openAgentSelector();
        break;
      case "session":
        if (!args) {
          await openSessionSelector();
        } else {
          await setSession(args);
        }
        break;
      case "sessions":
        await openSessionSelector();
        break;
      case "model":
        if (!args) {
          await openModelSelector();
        } else {
          try {
            const result = await client.patchSession({
              key: state.currentSessionKey,
              model: args,
            });
            chatLog.addSystem(`模型已设置为 ${args}`);
            applySessionInfoFromPatch(result);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`模型设置失败: ${String(err)}`);
          }
        }
        break;
      case "models":
        await openModelSelector();
        break;
      case "think":
        if (!args) {
          const levels = formatThinkingLevels(
            state.sessionInfo.modelProvider,
            state.sessionInfo.model,
            "|",
          );
          chatLog.addSystem(`用法: /think <${levels}>`);
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            thinkingLevel: args,
          });
          chatLog.addSystem(`思考强度已设置为 ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`思考强度设置失败: ${String(err)}`);
        }
        break;
      case "verbose":
        if (!args) {
          chatLog.addSystem("用法: /verbose <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            verboseLevel: args,
          });
          chatLog.addSystem(`详细输出已设置为 ${args}`);
          applySessionInfoFromPatch(result);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`详细输出设置失败: ${String(err)}`);
        }
        break;
      case "trace":
        if (!args) {
          chatLog.addSystem("用法: /trace <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            traceLevel: args,
          });
          chatLog.addSystem(`追踪已设置为 ${args}`);
          applySessionInfoFromPatch(result);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`追踪设置失败: ${String(err)}`);
        }
        break;
      case "fast":
        if (!args || args === "status") {
          chatLog.addSystem(`快速模式: ${state.sessionInfo.fastMode ? "开启" : "关闭"}`);
          break;
        }
        if (args !== "on" && args !== "off") {
          chatLog.addSystem("用法: /fast <status|on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            fastMode: args === "on",
          });
          chatLog.addSystem(`快速模式已${args === "on" ? "开启" : "关闭"}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`快速模式设置失败: ${String(err)}`);
        }
        break;
      case "reasoning":
        if (!args) {
          chatLog.addSystem("用法: /reasoning <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            reasoningLevel: args,
          });
          chatLog.addSystem(`推理已设置为 ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`推理设置失败: ${String(err)}`);
        }
        break;
      case "usage": {
        const normalized = args ? normalizeUsageDisplay(args) : undefined;
        if (args && !normalized) {
          chatLog.addSystem("用法: /usage <off|tokens|full>");
          break;
        }
        const currentRaw = state.sessionInfo.responseUsage;
        const current = resolveResponseUsageMode(currentRaw);
        const next =
          normalized ?? (current === "off" ? "tokens" : current === "tokens" ? "full" : "off");
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            responseUsage: next === "off" ? null : next,
          });
          chatLog.addSystem(`用量行: ${next}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`用量行设置失败: ${String(err)}`);
        }
        break;
      }
      case "elevated":
        if (!args) {
          chatLog.addSystem("用法: /elevated <on|off|ask|full>");
          break;
        }
        if (!["on", "off", "ask", "full"].includes(args)) {
          chatLog.addSystem("用法: /elevated <on|off|ask|full>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            elevatedLevel: args,
          });
          chatLog.addSystem(`提升权限已设置为 ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`提升权限设置失败: ${String(err)}`);
        }
        break;
      case "activation":
        if (!args) {
          chatLog.addSystem("用法: /activation <mention|always>");
          break;
        }
        const activation = normalizeGroupActivation(args);
        if (!activation) {
          chatLog.addSystem("用法: /activation <mention|always>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            groupActivation: activation,
          });
          chatLog.addSystem(`激活方式已设置为 ${activation}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`激活方式设置失败: ${String(err)}`);
        }
        break;
      case "new":
        try {
          // 立即清除令牌计数以避免过期显示 (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          // 生成唯一会话键以隔离此 TUI 客户端 (#39217)
          // 这确保 /new 创建的新会话不会广播
          // 到共享原始会话键的其他已连接 TUI 客户端。
          const uniqueKey = `tui-${randomUUID()}`;
          await setSession(uniqueKey);
          chatLog.addSystem(`新会话: ${uniqueKey}`);
        } catch (err) {
          chatLog.addSystem(`新建会话失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "reset":
        try {
          // 立即清除令牌计数以避免过期显示 (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          await client.resetSession(state.currentSessionKey, name);
          chatLog.addSystem(`会话 ${state.currentSessionKey} 已重置`);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`重置失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "abort":
        await abortActive();
        break;
      case "steer":
        await steerActiveRun(args);
        break;
      case "settings":
        openSettings();
        break;
      case "tools":
        if (args === "expanded" || args === "on" || args === "open") {
          setToolsExpanded?.(true);
          break;
        }
        if (args === "collapsed" || args === "off" || args === "close") {
          setToolsExpanded?.(false);
          break;
        }
        const effectiveToolsQuery = args === "compact" || args === "verbose" ? "" : args;
        try {
          const result = await client.getEffectiveTools({
            sessionKey: state.currentSessionKey,
            agentId: state.currentAgentId,
          });
          chatLog.addSystem(
            formatEffectiveToolsForTui(result, {
              limitPerGroup: args === "verbose" ? 50 : 8,
              query: effectiveToolsQuery,
            }),
          );
        } catch (err) {
          chatLog.addSystem(`工具获取失败: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "governance": {
        toggleGovernancePanel?.();
        break;
      }
      case "exit":
        requestExit();
        break;
      default:
        await sendMessage(fallbackMessage ?? [name, args].filter(Boolean).join(" "));
        break;
    }
    tui.requestRender();
  };

  const sendMessage = async (text: string) => {
    if (!state.isConnected) {
      chatLog.addSystem("未连接到网关，消息未发送");
      setActivityStatus("disconnected");
      tui.requestRender();
      return;
    }
    const isBtw = isBtwCommand(text);
    const runId = randomUUID();
    try {
      if (!isBtw) {
        context.onUserMessage?.(text);
        chatLog.addUser(text);
        state.pendingOptimisticUserMessage = true;
        state.activeChatRunId = runId;
        setActivityStatus("sending");
      } else {
        noteLocalBtwRunId?.(runId);
      }
      tui.requestRender();
      await client.sendChat({
        sessionKey: state.currentSessionKey,
        message: text,
        thinking: opts.thinking,
        deliver: deliverDefault,
        timeoutMs: opts.timeoutMs,
        runId,
      });
      if (!isBtw) {
        setActivityStatus("waiting");
        tui.requestRender();
      }
    } catch (err) {
      if (isBtw) {
        forgetLocalBtwRunId?.(runId);
      }
      if (!isBtw && state.activeChatRunId) {
        forgetLocalRunId?.(state.activeChatRunId);
      }
      if (!isBtw) {
        state.pendingOptimisticUserMessage = false;
        state.activeChatRunId = null;
      }
      chatLog.addSystem(`${isBtw ? "后台任务失败" : "发送失败"}: ${String(err)}`);
      if (!isBtw) {
        setActivityStatus("error");
      }
      tui.requestRender();
    }
  };

  return {
    handleAction,
    sendMessage,
    openModelSelector,
    openAgentSelector,
    openSessionSelector,
    openSettings,
    setAgent,
  };
}
