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
import { helpText, parseCommand } from "./commands.js";
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
import { formatRobotControlHelp } from "./robot-control.js";
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
};

function isBtwCommand(text: string): boolean {
  return /^\/btw(?::|\s|$)/i.test(text.trim());
}

function buildExplicitToolInvocationMessage(toolName: string, goal: string): string {
  return [
    `调用工具 ${toolName}`,
    `Tool requested: ${toolName}`,
    `User goal: ${goal}`,
    "",
    "Use the requested tool through the normal function-calling runtime if it is available in this session.",
    "If that exact tool is unavailable, explain the closest available tool or capability before taking action.",
    "Do not pretend the tool was called; rely on real tool events and results.",
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

function parseGatewayCallArgs(args: string):
  | { ok: true; method: string; params?: unknown }
  | { ok: false; message: string } {
  const trimmed = args.trim();
  if (!trimmed) {
    return { ok: false, message: "usage: /gateway-call <method> [json_params]" };
  }
  const [method, ...rest] = trimmed.split(/\s+/);
  if (!/^[a-zA-Z0-9_.:-]+$/.test(method)) {
    return { ok: false, message: "gateway-call method contains invalid characters" };
  }
  const rawParams = rest.join(" ").trim();
  if (!rawParams) {
    return { ok: true, method };
  }
  try {
    return { ok: true, method, params: JSON.parse(rawParams) as unknown };
  } catch {
    return { ok: false, message: "gateway-call params must be JSON" };
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
    "usage: /task-create <name> | <goal> | <short|medium|long> | <high|medium|low>",
    2,
  );
  if (!parsed.ok) {
    return parsed;
  }
  const [name, goal, durationRaw, priorityRaw] = parsed.parts;
  if (!name || !goal) {
    return {
      ok: false,
      message: "usage: /task-create <name> | <goal> | <short|medium|long> | <high|medium|low>",
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
      message: "usage: /remote-models <api> <endpoint> [provider] [apiKey]",
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

function parseMcpCallArgs(args: string):
  | { ok: true; params: GatewayMcpToolCallParams }
  | { ok: false; message: string } {
  const trimmed = args.trim();
  if (!trimmed) {
    return { ok: false, message: "usage: /mcp-call <tool_name> [json_arguments]" };
  }
  const [name = "", ...rest] = trimmed.split(/\s+/);
  if (!name) {
    return { ok: false, message: "usage: /mcp-call <tool_name> [json_arguments]" };
  }
  const rawArguments = rest.join(" ").trim();
  if (!rawArguments) {
    return { ok: true, params: { name, arguments: {} } };
  }
  const parsed = parseJsonObject(rawArguments, "mcp-call arguments must be a JSON object");
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, params: { name, arguments: parsed.value } };
}

function formatGatewayCallResult(method: string, result: unknown): string {
  return `${method} result\n${JSON.stringify(result, null, 2)}`;
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
    return `gateway-call failed: ${message}`;
  }
  try {
    const matches = await client.listGatewayMethods({ query: method });
    const suggestions = matches.methods.slice(0, 8).map((entry) => entry.name);
    if (suggestions.length === 0) {
      return `gateway-call failed: ${message}\nNo matching gateway methods found. Use /methods to inspect available RPC methods.`;
    }
    return `gateway-call failed: ${message}\nDid you mean: ${suggestions.join(", ")}`;
  } catch {
    return `gateway-call failed: ${message}\nUse /methods to inspect available RPC methods.`;
  }
}

function formatGatewayMethodsForTui(result: {
  count: number;
  query?: string;
  methods: Array<{ name: string; category?: string; scope?: string }>;
}): string {
  const lines = [
    `Gateway RPC methods: ${result.count}`,
    ...(result.query ? [`query: ${result.query}`] : []),
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
    `Gateway RPC method: ${result.method.name}`,
    `category: ${result.method.category ?? "unknown"}`,
    `scope: ${result.method.scope ?? "unclassified"}`,
    "",
    "Params schema:",
    JSON.stringify(result.paramsSchema ?? {}, null, 2),
    "",
    "Example params:",
    JSON.stringify(result.exampleParams ?? {}, null, 2),
    "",
    "Call template:",
    result.callTemplate,
  ];
  if (result.resultSchema !== undefined) {
    lines.push("", "Result schema:", JSON.stringify(result.resultSchema, null, 2));
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
    return "business tasks: 0";
  }
  return [
    `business tasks: ${tasks.length}`,
    ...tasks.map((task) => {
      const meta = [
        task.status ? `[${task.status}]` : "",
        typeof task.progress === "number" ? `${task.progress}%` : "",
        task.priority ? `priority=${task.priority}` : "",
        task.duration ? `duration=${task.duration}` : "",
      ].filter(Boolean).join(" ");
      return `- ${task.id ?? "unknown"} ${meta} ${task.name ?? ""}\n  ${task.goal ?? ""}`.trimEnd();
    }),
  ].join("\n");
}

function formatConfigForTui(result: { path?: string; raw?: string | null; hash?: string }): string {
  const lines = [`config ${result.path ?? "(unknown path)"}`];
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
    return "config patched: noop";
  }
  const changed = result.changedPaths?.length ? result.changedPaths.join(", ") : "unknown";
  return `config patched: ${changed}`;
}

function formatLogsTailForTui(result: { lines?: string[]; cursor?: number; file?: string }): string {
  const lines = result.lines ?? [];
  return [
    `logs tail: ${lines.length}`,
    ...(result.file ? [`file: ${result.file}`] : []),
    ...lines,
  ].join("\n");
}

function formatRemoteModelsForTui(result: {
  models?: Array<{ id?: string; name?: string; provider?: string }>;
}): string {
  const models = result.models ?? [];
  return [
    `remote models: ${models.length}`,
    ...models.slice(0, 50).map((model) => {
      const provider = model.provider ? `${model.provider}/` : "";
      return `- ${provider}${model.id ?? model.name ?? "unknown"}`;
    }),
  ].join("\n");
}

function formatSkillsStatusForTui(result: {
  workspaceDir?: string;
  skills?: Array<{ name?: string; skillKey?: string; eligible?: boolean; disabled?: boolean }>;
  entries?: Array<{ name?: string; status?: string }>;
}): string {
  const skills = result.skills ?? result.entries ?? [];
  return [
    `skills status: ${skills.length}`,
    ...(result.workspaceDir ? [`workspace: ${result.workspaceDir}`] : []),
    ...skills.slice(0, 30).map((skill) => {
      const name = skill.name ?? skill.skillKey ?? "unknown";
      const state = "status" in skill && skill.status
        ? skill.status
        : skill.disabled
          ? "disabled"
          : skill.eligible === false
            ? "ineligible"
            : "ready";
      return `- ${name} [${state}]`;
    }),
  ].join("\n");
}

function formatSkillsSearchForTui(result: {
  results?: Array<{ slug?: string; displayName?: string; score?: number; summary?: string }>;
}): string {
  const results = result.results ?? [];
  return [
    `skill search: ${results.length}`,
    ...results.slice(0, 20).map((entry) => {
      const score = typeof entry.score === "number" ? ` score=${entry.score}` : "";
      return `- ${entry.slug ?? entry.displayName ?? "unknown"}${score} ${entry.displayName ?? ""}`.trimEnd();
    }),
  ].join("\n");
}

function formatAgentFilesForTui(result: {
  files?: Array<{ name?: string; exists?: boolean; size?: number; updatedAtMs?: number }>;
}): string {
  const files = result.files ?? [];
  return [
    `agent files: ${files.length}`,
    ...files.map((file) => {
      const meta = [file.exists === false ? "missing" : "exists", typeof file.size === "number" ? `${file.size}b` : ""]
        .filter(Boolean)
        .join(" ");
      return `- ${file.name ?? "unknown"} ${meta}`.trimEnd();
    }),
  ].join("\n");
}

function formatAgentFileForTui(result: { file?: { name?: string; content?: string } }): string {
  return [`agent file ${result.file?.name ?? "unknown"}`, result.file?.content ?? ""].join("\n");
}

function formatMcpToolsForTui(result: {
  tools?: Array<{ name?: string; description?: string; server?: string }>;
  errors?: Array<{ server?: string; message?: string }>;
}): string {
  const tools = result.tools ?? [];
  return [
    `MCP tools: ${tools.length}`,
    ...tools.map((tool) => {
      const server = tool.server ? ` server=${tool.server}` : "";
      const description = tool.description ? ` - ${tool.description}` : "";
      return `- ${tool.name ?? "unknown"}${server}${description}`;
    }),
    ...((result.errors ?? []).length ? ["errors:"] : []),
    ...(result.errors ?? []).map((error) => `- ${error.server ?? "unknown"} ${error.message ?? ""}`.trimEnd()),
  ].join("\n");
}

function formatMcpCallForTui(toolName: string, result: unknown): string {
  return `MCP call ${toolName}\n${JSON.stringify(result, null, 2)}`;
}

function formatExperienceSearchForTui(result: {
  query: string;
  results: Array<{ type: string; id: string; summary: string; score: number; source?: string }>;
}): string {
  const lines = [
    `experience search: ${result.query}`,
    `matches: ${result.results.length}`,
    ...result.results.slice(0, 12).map((entry) => {
      const source = entry.source ? ` source=${entry.source}` : "";
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
    "experience summary",
    `events: ${result.counts.events}`,
    `skill candidates: ${result.counts.skillCandidates}`,
    `self model facts: ${result.counts.selfModelFacts ?? 0}`,
    ...((result.recentEvents ?? []).length ? ["", "recent events:"] : []),
    ...(result.recentEvents ?? []).slice(0, 8).map((event) =>
      `- ${event.id} ${event.kind ? `[${event.kind}] ` : ""}${event.summary}`
    ),
    ...((result.recentSkillCandidates ?? []).length ? ["", "recent skill candidates:"] : []),
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
    `session recall: ${result.query}`,
    `backend: ${result.backend}`,
    result.summary,
    ...((result.hits ?? []).length ? ["", "hits:"] : []),
    ...(result.hits ?? []).slice(0, 8).map((hit) => {
      const role = hit.role ? ` role=${hit.role}` : "";
      return `- ${hit.id} score=${hit.score}${role}\n  ${hit.snippet}`;
    }),
  ].join("\n");
}

function formatSkillCandidatesForTui(result: {
  candidates: Array<{ id: string; title: string; status: string; trigger?: string; steps?: string[] }>;
}): string {
  return [
    `skill candidates: ${result.candidates.length}`,
    ...result.candidates.map((candidate) => {
      const steps = candidate.steps?.length ? ` steps=${candidate.steps.join(" -> ")}` : "";
      const trigger = candidate.trigger ? ` trigger=${candidate.trigger}` : "";
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
      message: "usage: /skill-candidate-create <title> | <trigger> | <step1, step2>",
    };
  }
  const [title, trigger, stepsRaw] = parts;
  const steps = stepsRaw.split(/[,;，；]/).map((step) => step.trim()).filter(Boolean);
  if (!title || !trigger || steps.length === 0) {
    return {
      ok: false,
      message: "usage: /skill-candidate-create <title> | <trigger> | <step1, step2>",
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
      message: "usage: /agents-parallel <agent: goal | agent: goal>",
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
      message: "usage: /agents-parallel <agent: goal | agent: goal>",
    };
  }
  return { ok: true, tasks };
}

function formatAgentsParallelBatchForTui(batch: GatewayAgentsParallelBatch): string {
  const counts = batch.counts;
  return [
    `parallel batch ${batch.batchId}`,
    `status=${batch.status} total=${counts.total} queued=${counts.queued} starting=${counts.starting} running=${counts.running} failed=${counts.failed} cancelled=${counts.cancelled}`,
    ...batch.tasks.map((task) => {
      const agent = task.agentId ? ` agent=${task.agentId}` : "";
      const run = task.runId ? ` run=${task.runId}` : "";
      const session = task.sessionKey ? ` session=${task.sessionKey}` : "";
      const error = task.error ? ` error=${task.error}` : "";
      return `- ${task.id} [${task.status}]${agent}${run}${session}${error}\n  ${task.goal}`;
    }),
  ].join("\n");
}

function formatAgentsParallelListForTui(result: GatewayAgentsParallelList): string {
  if (result.batches.length === 0) {
    return "parallel batches: 0";
  }
  return [
    `parallel batches: ${result.batches.length}`,
    ...result.batches.map((batch) => {
      const counts = batch.counts;
      return `- ${batch.batchId} status=${batch.status} total=${counts.total} running=${counts.running} failed=${counts.failed} cancelled=${counts.cancelled}`;
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
        chatLog.addSystem("no models available");
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
          chatLog.addSystem(`model set to ${value}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`model set failed: ${String(err)}`);
        }
      });
    } catch (err) {
      chatLog.addSystem(`model list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openAgentSelector = async () => {
    await refreshAgents();
    if (state.agents.length === 0) {
      chatLog.addSystem("no agents found");
      tui.requestRender();
      return;
    }
    const items = state.agents.map((agent: AgentSummary) => ({
      value: agent.id,
      label: agent.name ? `${agent.id} (${agent.name})` : agent.id,
      description: agent.id === state.agentDefaultId ? "default" : "",
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
        // Avoid redundant "title (key)" when title matches key
        const label = title && title !== formattedKey ? `${title} (${formattedKey})` : formattedKey;
        // Build description: time + message preview
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
      chatLog.addSystem(`sessions list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openSettings = () => {
    const items = [
      {
        id: "tools",
        label: "Tool output",
        currentValue: state.toolsExpanded ? "expanded" : "collapsed",
        values: ["collapsed", "expanded"],
      },
      {
        id: "thinking",
        label: "Show thinking",
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
      chatLog.addSystem("usage: /steer <instruction>");
      return;
    }
    if (!state.isConnected) {
      chatLog.addSystem("not connected to gateway - steer not sent");
      setActivityStatus("disconnected");
      return;
    }
    if (!state.activeChatRunId) {
      chatLog.addSystem("no active run to steer");
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
      chatLog.addSystem(`steer failed: ${sanitizeRenderableText(String(err))}`);
      setActivityStatus("error");
    }
  };

  const handleCommand = async (raw: string) => {
    const { name, args } = parseCommand(raw);
    if (!name) {
      return;
    }
    switch (name) {
      case "help":
        chatLog.addSystem(
          helpText({
            provider: state.sessionInfo.modelProvider,
            model: state.sessionInfo.model,
          }),
        );
        break;
      case "robot":
        chatLog.addSystem(formatRobotControlHelp());
        break;
      case "voice": {
        if (args === "status") {
          chatLog.addSystem(
            captureVoiceInput
              ? "voice input: configured. Use /voice, /listen, or Ctrl+Y to speak once."
              : "voice input: not wired in this TUI runtime.",
          );
          break;
        }
        if (!captureVoiceInput || !submitRobotInput) {
          chatLog.addSystem("voice input is not available in this TUI runtime");
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
        chatLog.addSystem(`voice -> ${result.text}`);
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
          chatLog.addSystem("status: unknown response");
        } catch (err) {
          chatLog.addSystem(`status failed: ${String(err)}`);
        }
        break;
      case "gateway-call":
      case "rpc": {
        const parsed = parseGatewayCallArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.callGatewayMethod(parsed.method, parsed.params);
          chatLog.addSystem(formatGatewayCallResult(parsed.method, result));
        } catch (err) {
          chatLog.addSystem(
            await formatGatewayCallFailureWithSuggestions(client, parsed.method, err),
          );
        }
        break;
      }
      case "tasks":
      case "task-list": {
        const status = args ? parseBusinessTaskStatus(args) : undefined;
        if (args && !status) {
          chatLog.addSystem("usage: /tasks [pending|running|completed|failed|cancelled]");
          break;
        }
        try {
          const result = await client.listBusinessTasks(status ? { status } : {});
          chatLog.addSystem(formatBusinessTasksForTui(result));
        } catch (err) {
          chatLog.addSystem(`business tasks failed: ${sanitizeRenderableText(String(err))}`);
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
          chatLog.addSystem(`created task: ${result.task.id}\n${result.task.name}`);
        } catch (err) {
          chatLog.addSystem(`task create failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "task-update": {
        const parsed = parsePipeArgs(
          args,
          "usage: /task-update <id> | <status> | <progress> | <error>",
          2,
        );
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [id, statusRaw, progressRaw, error] = parsed.parts;
        const status = parseBusinessTaskStatus(statusRaw);
        if (!status) {
          chatLog.addSystem("usage: /task-update <id> | <pending|running|completed|failed|cancelled> | <progress> | <error>");
          break;
        }
        const progress = progressRaw ? Number.parseInt(progressRaw, 10) : undefined;
        if (progressRaw && (!Number.isFinite(progress) || (progress ?? 0) < 0 || (progress ?? 0) > 100)) {
          chatLog.addSystem("task progress must be 0-100");
          break;
        }
        try {
          const result = await client.updateBusinessTask({
            id,
            status,
            ...(typeof progress === "number" ? { progress } : {}),
            ...(error ? { error } : {}),
          });
          chatLog.addSystem(`updated task: ${result.task.id}\n${result.task.status}`);
        } catch (err) {
          chatLog.addSystem(`task update failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "task-delete":
        if (!args) {
          chatLog.addSystem("usage: /task-delete <id>");
          break;
        }
        try {
          const result = await client.deleteBusinessTask({ id: args });
          chatLog.addSystem(`deleted task: ${result.task.id}`);
        } catch (err) {
          chatLog.addSystem(`task delete failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "config":
        try {
          const result = await client.getConfig({});
          chatLog.addSystem(formatConfigForTui(result));
        } catch (err) {
          chatLog.addSystem(`config failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "config-patch":
        if (!args) {
          chatLog.addSystem("usage: /config-patch <json_object>");
          break;
        }
        try {
          const result = await client.patchConfig({ raw: args });
          chatLog.addSystem(formatConfigPatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`config patch failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "logs": {
        const parsed = parseOptionalPositiveInteger(args, "usage: /logs [limit]");
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
          chatLog.addSystem(`logs failed: ${sanitizeRenderableText(String(err))}`);
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
          chatLog.addSystem(`remote models failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skills":
        try {
          const result = await client.getSkillsStatus({});
          chatLog.addSystem(formatSkillsStatusForTui(result));
        } catch (err) {
          chatLog.addSystem(`skills status failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "skill-search":
        try {
          const result = await client.searchSkills(args ? { query: args } : {});
          chatLog.addSystem(formatSkillsSearchForTui(result));
        } catch (err) {
          chatLog.addSystem(`skill search failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-files":
        try {
          const result = await client.listAgentFiles({ agentId: args || state.currentAgentId });
          chatLog.addSystem(formatAgentFilesForTui(result));
        } catch (err) {
          chatLog.addSystem(`agent files failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-file":
        if (!args) {
          chatLog.addSystem("usage: /agent-file <name>");
          break;
        }
        try {
          const result = await client.getAgentFile({ agentId: state.currentAgentId, name: args });
          chatLog.addSystem(formatAgentFileForTui(result));
        } catch (err) {
          chatLog.addSystem(`agent file failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agent-file-set": {
        const parsed = parsePipeArgs(args, "usage: /agent-file-set <name> | <content>", 2);
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
          chatLog.addSystem(`agent file saved: ${result.file.name}`);
        } catch (err) {
          chatLog.addSystem(`agent file save failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "mcp-tools":
        try {
          const result = await client.listMcpTools({});
          chatLog.addSystem(formatMcpToolsForTui(result));
        } catch (err) {
          chatLog.addSystem(`MCP tools failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "mcp-call": {
        const parsed = parseMcpCallArgs(args);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        try {
          const result = await client.callMcpTool(parsed.params);
          chatLog.addSystem(formatMcpCallForTui(parsed.params.name, result));
        } catch (err) {
          chatLog.addSystem(`MCP call failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "capabilities":
      case "abilities":
      case "tools-catalog":
        try {
          const result = await client.getToolsCatalog({
            agentId: state.currentAgentId,
            includePlugins: true,
          });
          chatLog.addSystem(formatToolsCatalogForTui(result, { query: args }));
        } catch (err) {
          chatLog.addSystem(`capabilities failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "gateway-methods":
        try {
          const result = await client.listGatewayMethods(args ? { query: args } : {});
          chatLog.addSystem(formatGatewayMethodsForTui(result));
        } catch (err) {
          chatLog.addSystem(`gateway methods failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "gateway-method":
        if (!args) {
          chatLog.addSystem("usage: /method <gateway_method>");
          break;
        }
        try {
          const result = await client.describeGatewayMethod(args);
          chatLog.addSystem(formatGatewayMethodDescriptionForTui(result));
        } catch (err) {
          chatLog.addSystem(`gateway method failed: ${sanitizeRenderableText(String(err))}`);
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
          chatLog.addSystem(`effective tools failed: ${sanitizeRenderableText(String(err))}`);
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
          chatLog.addSystem(`agents parallel failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "agents-parallel-status":
        if (!args) {
          chatLog.addSystem("usage: /agents-parallel-status <batchId>");
          break;
        }
        try {
          const result = await client.getAgentsParallelStatus({ batchId: args });
          chatLog.addSystem(formatAgentsParallelBatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`agents parallel status failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "agents-parallel-list": {
        const parsedLimit = args ? Number.parseInt(args, 10) : undefined;
        if (args && (!Number.isFinite(parsedLimit) || (parsedLimit ?? 0) < 1)) {
          chatLog.addSystem("usage: /agents-parallel-list [limit]");
          break;
        }
        try {
          const result = await client.listAgentsParallel(parsedLimit ? { limit: parsedLimit } : {});
          chatLog.addSystem(formatAgentsParallelListForTui(result));
        } catch (err) {
          chatLog.addSystem(`agents parallel list failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "agents-parallel-cancel":
        if (!args) {
          chatLog.addSystem("usage: /agents-parallel-cancel <batchId>");
          break;
        }
        try {
          const result = await client.cancelAgentsParallel({ batchId: args });
          chatLog.addSystem(formatAgentsParallelBatchForTui(result));
        } catch (err) {
          chatLog.addSystem(`agents parallel cancel failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-capture":
        if (!args) {
          chatLog.addSystem("usage: /experience-capture <summary>");
          break;
        }
        try {
          const result = await client.captureExperience({
            kind: "lesson",
            summary: args,
            source: "tui",
            sessionKey: state.currentSessionKey,
          });
          chatLog.addSystem(`captured experience: ${result.event.id}\n${result.event.summary}`);
        } catch (err) {
          chatLog.addSystem(`experience capture failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-search":
        if (!args) {
          chatLog.addSystem("usage: /experience-search <query>");
          break;
        }
        try {
          const result = await client.searchExperience({ query: args });
          chatLog.addSystem(formatExperienceSearchForTui(result));
        } catch (err) {
          chatLog.addSystem(`experience search failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "session-recall":
        if (!args) {
          chatLog.addSystem("usage: /session-recall <query>");
          break;
        }
        try {
          const result = await client.recallSessionMemory({ query: args });
          chatLog.addSystem(formatSessionRecallForTui(result));
        } catch (err) {
          chatLog.addSystem(`session recall failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "experience-summary":
        try {
          const result = await client.getExperienceSummary({});
          chatLog.addSystem(formatExperienceSummaryForTui(result));
        } catch (err) {
          chatLog.addSystem(`experience summary failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "skill-candidates":
        try {
          const result = await client.listSkillCandidates({});
          chatLog.addSystem(formatSkillCandidatesForTui(result));
        } catch (err) {
          chatLog.addSystem(`skill candidates failed: ${sanitizeRenderableText(String(err))}`);
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
            `created skill candidate: ${result.candidate.id}\n${result.candidate.title}`,
          );
        } catch (err) {
          chatLog.addSystem(`skill candidate create failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skill-usage-record": {
        const parsed = parsePipeArgs(
          args,
          "usage: /skill-usage-record <candidateId> | <outcome> | <observation1, observation2>",
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
            `recorded skill usage: ${result.usage.id}\nimproved candidate: ${result.candidate.id}`,
          );
        } catch (err) {
          chatLog.addSystem(`skill usage record failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "skill-export":
        if (!args) {
          chatLog.addSystem("usage: /skill-export <candidateId>");
          break;
        }
        try {
          const result = await client.exportSkillCandidate({ candidateId: args });
          chatLog.addSystem(`exported skill: ${result.name}\n${result.skillPath}`);
        } catch (err) {
          chatLog.addSystem(`skill export failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "strategy-memory": {
        const parsed = parsePipeArgs(args, "usage: /strategy-memory <title> | <objective>", 2);
        if (!parsed.ok) {
          chatLog.addSystem(parsed.message);
          break;
        }
        const [title, objective] = parsed.parts;
        try {
          const result = await client.captureStrategicMemory({ title, objective });
          chatLog.addSystem(`captured strategic memory: ${result.memory.id}\n${result.memory.title}`);
        } catch (err) {
          chatLog.addSystem(`strategy memory failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      }
      case "strategy-due":
        try {
          const result = await client.listDueStrategicPushes({});
          chatLog.addSystem([
            `strategic pushes due: ${result.pushes.length}`,
            ...result.pushes.map((push) => `- ${push.id} [${push.cadence}] ${push.prompt}`),
          ].join("\n"));
        } catch (err) {
          chatLog.addSystem(`strategy due failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "strategy-advance":
        if (!args) {
          chatLog.addSystem("usage: /strategy-advance <strategyId>");
          break;
        }
        try {
          const result = await client.advanceStrategicMemory({ id: args });
          chatLog.addSystem(`advanced strategic memory: ${result.memory.id}`);
        } catch (err) {
          chatLog.addSystem(`strategy advance failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "self-model":
        try {
          const result = await client.getSelfModel({});
          chatLog.addSystem(`self model\n${JSON.stringify(result.selfModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`self model failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "self-model-update":
        if (!args) {
          chatLog.addSystem("usage: /self-model-update <pattern>");
          break;
        }
        try {
          const result = await client.updateSelfModel({ learnedPatterns: [args] });
          chatLog.addSystem(`self model updated\n${JSON.stringify(result.selfModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`self model update failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "user-model-update":
        if (!args) {
          chatLog.addSystem("usage: /user-model-update <preference>");
          break;
        }
        try {
          const result = await client.updateUserModel({ preferences: [args] });
          chatLog.addSystem(`user model updated\n${JSON.stringify(result.userModel, null, 2)}`);
        } catch (err) {
          chatLog.addSystem(`user model update failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "user-model":
        if (!args) {
          chatLog.addSystem("usage: /user-model <query>");
          break;
        }
        try {
          const result = await client.queryUserModel({ query: args });
          chatLog.addSystem(
            `user model dialectic\n${result.answer}\n${JSON.stringify(result.hypotheses ?? [], null, 2)}`,
          );
        } catch (err) {
          chatLog.addSystem(`user model failed: ${sanitizeRenderableText(String(err))}`);
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
            chatLog.addSystem(`model set to ${args}`);
            applySessionInfoFromPatch(result);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`model set failed: ${String(err)}`);
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
          chatLog.addSystem(`usage: /think <${levels}>`);
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            thinkingLevel: args,
          });
          chatLog.addSystem(`thinking set to ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`think failed: ${String(err)}`);
        }
        break;
      case "verbose":
        if (!args) {
          chatLog.addSystem("usage: /verbose <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            verboseLevel: args,
          });
          chatLog.addSystem(`verbose set to ${args}`);
          applySessionInfoFromPatch(result);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`verbose failed: ${String(err)}`);
        }
        break;
      case "trace":
        if (!args) {
          chatLog.addSystem("usage: /trace <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            traceLevel: args,
          });
          chatLog.addSystem(`trace set to ${args}`);
          applySessionInfoFromPatch(result);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`trace failed: ${String(err)}`);
        }
        break;
      case "fast":
        if (!args || args === "status") {
          chatLog.addSystem(`fast mode: ${state.sessionInfo.fastMode ? "on" : "off"}`);
          break;
        }
        if (args !== "on" && args !== "off") {
          chatLog.addSystem("usage: /fast <status|on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            fastMode: args === "on",
          });
          chatLog.addSystem(`fast mode ${args === "on" ? "enabled" : "disabled"}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`fast failed: ${String(err)}`);
        }
        break;
      case "reasoning":
        if (!args) {
          chatLog.addSystem("usage: /reasoning <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            reasoningLevel: args,
          });
          chatLog.addSystem(`reasoning set to ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`reasoning failed: ${String(err)}`);
        }
        break;
      case "usage": {
        const normalized = args ? normalizeUsageDisplay(args) : undefined;
        if (args && !normalized) {
          chatLog.addSystem("usage: /usage <off|tokens|full>");
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
          chatLog.addSystem(`usage footer: ${next}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`usage failed: ${String(err)}`);
        }
        break;
      }
      case "elevated":
        if (!args) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        if (!["on", "off", "ask", "full"].includes(args)) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            elevatedLevel: args,
          });
          chatLog.addSystem(`elevated set to ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`elevated failed: ${String(err)}`);
        }
        break;
      case "activation":
        if (!args) {
          chatLog.addSystem("usage: /activation <mention|always>");
          break;
        }
        const activation = normalizeGroupActivation(args);
        if (!activation) {
          chatLog.addSystem("usage: /activation <mention|always>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            groupActivation: activation,
          });
          chatLog.addSystem(`activation set to ${activation}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`activation failed: ${String(err)}`);
        }
        break;
      case "new":
        try {
          // Clear token counts immediately to avoid stale display (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          // Generate unique session key to isolate this TUI client (#39217)
          // This ensures /new creates a fresh session that doesn't broadcast
          // to other connected TUI clients sharing the original session key.
          const uniqueKey = `tui-${randomUUID()}`;
          await setSession(uniqueKey);
          chatLog.addSystem(`new session: ${uniqueKey}`);
        } catch (err) {
          chatLog.addSystem(`new session failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "reset":
        try {
          // Clear token counts immediately to avoid stale display (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          await client.resetSession(state.currentSessionKey, name);
          chatLog.addSystem(`session ${state.currentSessionKey} reset`);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`reset failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "abort":
        await abortActive();
        break;
      case "steer":
        await steerActiveRun(args);
        break;
      case "invoke-tool":
      case "use-tool": {
        const [toolName, ...goalParts] = args.split(/\s+/);
        const goal = goalParts.join(" ").trim();
        if (!toolName || !goal) {
          chatLog.addSystem("usage: /invoke-tool <tool_name> <goal>");
          break;
        }
        try {
          const effective = await client.getEffectiveTools({
            sessionKey: state.currentSessionKey,
            agentId: state.currentAgentId,
          });
          const toolIds = listEffectiveToolIds(effective);
          const resolvedTool = resolveRequestedToolName(toolName, toolIds);
          if (!resolvedTool.ok) {
            const suggestions = resolvedTool.candidates.slice(0, 12).join(", ") || "none";
            if (resolvedTool.reason === "ambiguous") {
              chatLog.addSystem(`tool "${toolName}" is ambiguous. Candidates: ${suggestions}`);
              break;
            }
            chatLog.addSystem(
              `tool "${toolName}" is not available in this session. Available tools: ${suggestions}`,
            );
            break;
          }
          await sendMessage(buildExplicitToolInvocationMessage(resolvedTool.toolName, goal));
          break;
        } catch (err) {
          chatLog.addSystem(`tool availability check failed: ${sanitizeRenderableText(String(err))}`);
          break;
        }
      }
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
          chatLog.addSystem(`tools failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "governance":
      case "gov": {
        toggleGovernancePanel?.();
        break;
      }
      case "exit":
      case "quit":
        requestExit();
        break;
      default:
        await sendMessage(raw);
        break;
    }
    tui.requestRender();
  };

  const sendMessage = async (text: string) => {
    if (!state.isConnected) {
      chatLog.addSystem("not connected to gateway - message not sent");
      setActivityStatus("disconnected");
      tui.requestRender();
      return;
    }
    const isBtw = isBtwCommand(text);
    const runId = randomUUID();
    try {
      if (!isBtw) {
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
      chatLog.addSystem(`${isBtw ? "btw failed" : "send failed"}: ${String(err)}`);
      if (!isBtw) {
        setActivityStatus("error");
      }
      tui.requestRender();
    }
  };

  return {
    handleCommand,
    sendMessage,
    openModelSelector,
    openAgentSelector,
    openSessionSelector,
    openSettings,
    setAgent,
  };
}
