import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/config.js";
import { assertExplicitGatewayAuthModeWhenBothConfigured } from "../gateway/auth-mode-policy.js";
import { resolveGatewayInteractiveSurfaceAuth } from "../gateway/auth-surface-resolution.js";
import {
  buildGatewayConnectionDetails,
  ensureExplicitGatewayAuth,
  resolveExplicitGatewayAuth,
} from "../gateway/call.js";
import { GatewayClient } from "../gateway/client.js";
import { isLoopbackHost } from "../gateway/net.js";
import {
  GATEWAY_CLIENT_CAPS,
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
} from "../gateway/protocol/client-info.js";
import {
  type HelloOk,
  PROTOCOL_VERSION,
  type AgentsParallelBatchResult,
  type AgentsParallelCancelParams,
  type AgentsParallelListParams,
  type AgentsParallelListResult,
  type AgentsParallelStartParams,
  type AgentsParallelStatusParams,
  type SessionsListParams,
  type SessionsPatchResult,
  type SessionsPatchParams,
  type AgentsFilesGetParams,
  type AgentsFilesGetResult,
  type AgentsFilesListParams,
  type AgentsFilesListResult,
  type AgentsFilesSetParams,
  type AgentsFilesSetResult,
  type ConfigGetParams,
  type ConfigPatchParams,
  type LogsTailParams,
  type LogsTailResult,
  type ModelsRemoteListParams,
  type SkillsSearchParams,
  type SkillsSearchResult,
  type SkillsStatusParams,
  type ToolsCatalogParams,
  type ToolsCatalogResult,
  type ToolsEffectiveParams,
  type ToolsEffectiveResult,
  type GatewayMethodsParams,
  type GatewayMethodsResult,
  type GatewayMethodDescribeResult,
  type ExperienceCaptureParams,
  type ExperienceSearchParams,
  type ExperienceSessionRecallParams,
  type ExperienceSummaryParams,
  type SkillCandidatesCreateParams,
  type SkillCandidatesExportAgentSkillParams,
  type SkillCandidatesListParams,
  type SkillUsageRecordParams,
  type StrategyMemoryCaptureParams,
  type StrategyMemoryAdvanceParams,
  type StrategyMemoryDueParams,
  type SelfModelGetParams,
  type SelfModelUpdateParams,
  type UserModelDialecticParams,
  type UserModelUpdateParams,
} from "../gateway/protocol/index.js";
import { formatErrorMessage } from "../infra/errors.js";
import { VERSION } from "../version.js";
import { StdioGatewayTransport } from "./stdio-gateway-transport.js";
import type { ResponseUsageMode, SessionInfo, SessionScope } from "./tui-types.js";

export type GatewayConnectionOptions = {
  url?: string;
  token?: string;
  password?: string;
};

export type ChatSendOptions = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  timeoutMs?: number;
  runId?: string;
};

export type SessionSteerOptions = {
  sessionKey: string;
  message: string;
  thinking?: string;
  timeoutMs?: number;
  runId?: string;
};

export type SessionSteerResult = {
  runId?: string;
  interruptedActiveRun?: boolean;
  [key: string]: unknown;
};

export type GatewayEvent = {
  event: string;
  payload?: unknown;
  seq?: number;
};

type ResolvedGatewayConnection = {
  kind?: "websocket";
  url: string;
  token?: string;
  password?: string;
  allowInsecureLocalOperatorUi?: boolean;
};

type ResolvedStdioConnection = {
  kind: "stdio";
  display: string;
};

type GatewayTransport = {
  start: () => void;
  stop: () => void;
  request: <T = Record<string, unknown>>(method: string, params?: unknown) => Promise<T>;
  onEvent?: (evt: GatewayEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

function throwGatewayAuthResolutionError(reason: string): never {
  throw new Error(
    [
      reason,
      "修复方式：设置 ASSISTANT_GATEWAY_TOKEN/ASSISTANT_GATEWAY_PASSWORD，传入 --token/--password，",
      "或修复该凭据配置的密钥提供器。",
    ].join("\n"),
  );
}

export type GatewaySessionList = {
  ts: number;
  path: string;
  count: number;
  defaults?: {
    model?: string | null;
    modelProvider?: string | null;
    contextTokens?: number | null;
  };
  sessions: Array<
    Pick<
      SessionInfo,
      | "thinkingLevel"
      | "fastMode"
      | "verboseLevel"
      | "reasoningLevel"
      | "model"
      | "contextTokens"
      | "inputTokens"
      | "outputTokens"
      | "totalTokens"
      | "totalTokensFresh"
      | "compactionCount"
      | "compactionCheckpointCount"
      | "modelProvider"
      | "displayName"
    > & {
      key: string;
      sessionId?: string;
      updatedAt?: number | null;
      fastMode?: boolean;
      sendPolicy?: string;
      responseUsage?: ResponseUsageMode;
      label?: string;
      provider?: string;
      groupChannel?: string;
      space?: string;
      subject?: string;
      chatType?: string;
      lastProvider?: string;
      lastTo?: string;
      lastAccountId?: string;
      derivedTitle?: string;
      lastMessagePreview?: string;
    }
  >;
};

export type GatewayAgentsList = {
  defaultId: string;
  mainKey: string;
  scope: SessionScope;
  agents: Array<{
    id: string;
    name?: string;
  }>;
};

export type GatewayAgentsParallelBatch = AgentsParallelBatchResult;
export type GatewayAgentsParallelList = AgentsParallelListResult;

export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export type GatewayExperienceCaptureResult = {
  event: { id: string; kind: string; summary: string };
};

export type GatewayExperienceSearchResult = {
  query: string;
  results: Array<{
    type: string;
    id: string;
    summary: string;
    score: number;
    source?: string;
    tags?: string[];
  }>;
};

export type GatewaySessionRecallResult = {
  query: string;
  backend: string;
  summary: string;
  hits: Array<{ id: string; path: string; snippet: string; score: number; role?: string }>;
};

export type GatewayExperienceSummaryResult = {
  counts: { events: number; skillCandidates: number; selfModelFacts?: number };
  recentEvents?: Array<{ id: string; summary: string; kind?: string }>;
  recentSkillCandidates?: Array<{ id: string; title: string; status: string }>;
  selfModel?: unknown;
};

export type GatewaySkillCandidatesResult = {
  candidates: Array<{ id: string; title: string; status: string; trigger?: string; steps?: string[] }>;
};

export type GatewaySkillCandidateCreateResult = {
  candidate: { id: string; title: string; status: string };
};

export type GatewaySkillUsageRecordResult = {
  usage: { id: string; candidateId: string; outcome: string; observations: string[] };
  candidate: { id: string; title: string; status: string; tags?: string[]; steps?: string[] };
};

export type GatewaySkillExportResult = {
  name: string;
  directory: string;
  skillPath: string;
  content: string;
};

export type GatewayStrategyMemoryResult = {
  memory: { id: string; title: string; objective: string; cadence: string; nextPushAt: number };
};

export type GatewayStrategyDueResult = {
  pushes: Array<{ id: string; title: string; prompt: string; cadence: string; nextPushAt: number }>;
};

export type GatewaySelfModelResult = {
  selfModel: unknown;
};

export type GatewayUserModelResult = {
  userModel?: unknown;
  query?: string;
  answer?: string;
  hypotheses?: Array<{
    claim: string;
    confidence: number;
    supportingEvidence: string[];
    contradictingEvidence: string[];
  }>;
  model?: unknown;
};

export type GatewayBusinessTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type GatewayBusinessTaskDuration = "short" | "medium" | "long";
export type GatewayBusinessTaskPriority = "high" | "medium" | "low";

export type GatewayBusinessTask = {
  id: string;
  agentId?: string;
  name: string;
  goal: string;
  status: GatewayBusinessTaskStatus;
  progress?: number;
  duration?: GatewayBusinessTaskDuration;
  priority?: GatewayBusinessTaskPriority;
  group?: string;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  error?: string;
  [key: string]: unknown;
};

export type GatewayBusinessTasksListParams = {
  status?: GatewayBusinessTaskStatus;
  limit?: number;
};

export type GatewayBusinessTasksListResult = {
  tasks: GatewayBusinessTask[];
};

export type GatewayBusinessTaskCreateParams = {
  name: string;
  goal: string;
  agentId?: string;
  duration?: GatewayBusinessTaskDuration;
  priority?: GatewayBusinessTaskPriority;
  group?: string;
  business?: Record<string, unknown>;
};

export type GatewayBusinessTaskResult = {
  task: GatewayBusinessTask;
  autonomyStarted?: boolean;
  error?: string;
};

export type GatewayBusinessTaskUpdateParams = {
  id: string;
  status?: GatewayBusinessTaskStatus;
  progress?: number;
  error?: string;
};

export type GatewayBusinessTaskDeleteParams = {
  id: string;
};

export type GatewayConfigGetResult = {
  path?: string;
  raw?: string | null;
  config?: unknown;
  hash?: string;
  [key: string]: unknown;
};

export type GatewayConfigPatchResult = {
  ok: boolean;
  path?: string;
  changedPaths?: string[];
  noop?: boolean;
  config?: unknown;
  [key: string]: unknown;
};

export type GatewayRemoteModelsResult = {
  models: GatewayModelChoice[];
};

export type GatewaySkillsStatusResult = {
  workspaceDir?: string;
  managedSkillsDir?: string;
  skills?: Array<{
    name?: string;
    skillKey?: string;
    description?: string;
    source?: string;
    eligible?: boolean;
    disabled?: boolean;
  }>;
  entries?: Array<{
    name?: string;
    status?: string;
    description?: string;
  }>;
  [key: string]: unknown;
};

export type GatewayMcpToolsListParams = {
  server?: string;
  serverName?: string;
};

export type GatewayMcpToolsListResult = {
  count?: number;
  tools: Array<{
    name: string;
    server?: string;
    tool?: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  errors?: Array<{ server?: string; message?: string }>;
};

export type GatewayMcpToolCallParams = {
  name: string;
  server?: string;
  serverName?: string;
  tool?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  args?: Record<string, unknown>;
};

export type GatewayMcpToolCallResult = {
  name?: string;
  server?: string;
  tool?: string;
  result?: unknown;
  [key: string]: unknown;
};

export class GatewayChatClient {
  private transport: GatewayTransport;
  private readyPromise: Promise<void>;
  private resolveReady?: () => void;
  readonly connection: ResolvedGatewayConnection | ResolvedStdioConnection;
  hello?: HelloOk;

  onEvent?: (evt: GatewayEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  constructor(connection: ResolvedGatewayConnection | ResolvedStdioConnection) {
    this.connection = connection;

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    if (connection.kind === "stdio") {
      this.transport = new StdioGatewayTransport();
      this.transport.onConnected = () => {
        this.resolveReady?.();
        this.onConnected?.();
      };
      this.transport.onEvent = (evt) => {
        this.onEvent?.(evt);
      };
      this.transport.onDisconnected = (reason) => {
        this.readyPromise = new Promise((resolve) => {
          this.resolveReady = resolve;
        });
        this.onDisconnected?.(reason);
      };
      this.transport.onGap = (info) => {
        this.onGap?.(info);
      };
      return;
    }

    this.transport = new GatewayClient({
      url: connection.url,
      token: connection.token,
      password: connection.password,
      clientName: GATEWAY_CLIENT_NAMES.TUI,
      clientDisplayName: "assistant-tui",
      clientVersion: VERSION,
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.UI,
      deviceIdentity: connection.allowInsecureLocalOperatorUi ? null : undefined,
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      instanceId: randomUUID(),
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      onHelloOk: (hello) => {
        this.hello = hello;
        this.resolveReady?.();
        this.onConnected?.();
      },
      onEvent: (evt) => {
        this.onEvent?.({
          event: evt.event,
          payload: evt.payload,
          seq: evt.seq,
        });
      },
      onClose: (_code, reason) => {
        // Reset so waitForReady() blocks again until the next successful reconnect.
        this.readyPromise = new Promise((resolve) => {
          this.resolveReady = resolve;
        });
        this.onDisconnected?.(reason);
      },
      onGap: (info) => {
        this.onGap?.(info);
      },
    });
  }

  static async connect(opts: GatewayConnectionOptions): Promise<GatewayChatClient> {
    if (!opts.url?.trim()) {
      return new GatewayChatClient({
        kind: "stdio",
        display: "stdio://local-gateway",
      });
    }
    const connection = await resolveGatewayConnection(opts);
    return new GatewayChatClient({ ...connection, kind: "websocket" });
  }

  start() {
    this.transport.start();
  }

  stop() {
    this.transport.stop();
  }

  async waitForReady() {
    await this.readyPromise;
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    const runId = opts.runId ?? randomUUID();
    await this.transport.request("chat.send", {
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      idempotencyKey: runId,
    });
    return { runId };
  }

  async steerSession(opts: SessionSteerOptions): Promise<SessionSteerResult> {
    const runId = opts.runId ?? randomUUID();
    return await this.transport.request<SessionSteerResult>("sessions.steer", {
      key: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      timeoutMs: opts.timeoutMs,
      idempotencyKey: runId,
    });
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    return await this.transport.request<{ ok: boolean; aborted: boolean }>("chat.abort", {
      sessionKey: opts.sessionKey,
      runId: opts.runId,
    });
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    return await this.transport.request("chat.history", {
      sessionKey: opts.sessionKey,
      limit: opts.limit,
    });
  }

  async listSessions(opts?: SessionsListParams) {
    return await this.transport.request<GatewaySessionList>("sessions.list", {
      limit: opts?.limit,
      activeMinutes: opts?.activeMinutes,
      includeGlobal: opts?.includeGlobal,
      includeUnknown: opts?.includeUnknown,
      includeDerivedTitles: opts?.includeDerivedTitles,
      includeLastMessage: opts?.includeLastMessage,
      agentId: opts?.agentId,
    });
  }

  async listAgents() {
    return await this.transport.request<GatewayAgentsList>("agents.list", {});
  }

  async startAgentsParallel(
    params: AgentsParallelStartParams,
  ): Promise<GatewayAgentsParallelBatch> {
    return await this.transport.request<GatewayAgentsParallelBatch>(
      "agents.parallel.start",
      params,
    );
  }

  async getAgentsParallelStatus(
    params: AgentsParallelStatusParams,
  ): Promise<GatewayAgentsParallelBatch> {
    return await this.transport.request<GatewayAgentsParallelBatch>(
      "agents.parallel.status",
      params,
    );
  }

  async listAgentsParallel(params: AgentsParallelListParams = {}): Promise<GatewayAgentsParallelList> {
    return await this.transport.request<GatewayAgentsParallelList>(
      "agents.parallel.list",
      params,
    );
  }

  async cancelAgentsParallel(
    params: AgentsParallelCancelParams,
  ): Promise<GatewayAgentsParallelBatch> {
    return await this.transport.request<GatewayAgentsParallelBatch>(
      "agents.parallel.cancel",
      params,
    );
  }

  async patchSession(opts: SessionsPatchParams): Promise<SessionsPatchResult> {
    return await this.transport.request<SessionsPatchResult>("sessions.patch", opts);
  }

  async resetSession(key: string, reason?: "new" | "reset") {
    return await this.transport.request("sessions.reset", {
      key,
      ...(reason ? { reason } : {}),
    });
  }

  async getGatewayStatus() {
    return await this.transport.request("status");
  }

  async getToolsCatalog(opts: ToolsCatalogParams = {}): Promise<ToolsCatalogResult> {
    return await this.transport.request<ToolsCatalogResult>("tools.catalog", {
      agentId: opts.agentId,
      includePlugins: opts.includePlugins,
    });
  }

  async getEffectiveTools(opts: ToolsEffectiveParams): Promise<ToolsEffectiveResult> {
    return await this.transport.request<ToolsEffectiveResult>("tools.effective", {
      sessionKey: opts.sessionKey,
      agentId: opts.agentId,
    });
  }

  async listGatewayMethods(opts: GatewayMethodsParams = {}): Promise<GatewayMethodsResult> {
    return await this.transport.request<GatewayMethodsResult>("gateway.methods", {
      query: opts.query,
    });
  }

  async describeGatewayMethod(method: string): Promise<GatewayMethodDescribeResult> {
    return await this.transport.request<GatewayMethodDescribeResult>("gateway.method.describe", {
      method,
    });
  }

  async captureExperience(
    params: ExperienceCaptureParams,
  ): Promise<GatewayExperienceCaptureResult> {
    return await this.transport.request<GatewayExperienceCaptureResult>("experience.capture", params);
  }

  async searchExperience(params: ExperienceSearchParams): Promise<GatewayExperienceSearchResult> {
    return await this.transport.request<GatewayExperienceSearchResult>("experience.search", params);
  }

  async recallSessionMemory(
    params: ExperienceSessionRecallParams,
  ): Promise<GatewaySessionRecallResult> {
    return await this.transport.request<GatewaySessionRecallResult>(
      "experience.sessionRecall",
      params,
    );
  }

  async getExperienceSummary(
    params: ExperienceSummaryParams = {},
  ): Promise<GatewayExperienceSummaryResult> {
    return await this.transport.request<GatewayExperienceSummaryResult>(
      "experience.summary",
      params,
    );
  }

  async listSkillCandidates(
    params: SkillCandidatesListParams = {},
  ): Promise<GatewaySkillCandidatesResult> {
    return await this.transport.request<GatewaySkillCandidatesResult>(
      "skill.candidates.list",
      params,
    );
  }

  async createSkillCandidate(
    params: SkillCandidatesCreateParams,
  ): Promise<GatewaySkillCandidateCreateResult> {
    return await this.transport.request<GatewaySkillCandidateCreateResult>(
      "skill.candidates.create",
      params,
    );
  }

  async recordSkillUsage(params: SkillUsageRecordParams): Promise<GatewaySkillUsageRecordResult> {
    return await this.transport.request<GatewaySkillUsageRecordResult>(
      "skill.usage.record",
      params,
    );
  }

  async exportSkillCandidate(
    params: SkillCandidatesExportAgentSkillParams,
  ): Promise<GatewaySkillExportResult> {
    return await this.transport.request<GatewaySkillExportResult>(
      "skill.candidates.exportAgentSkill",
      params,
    );
  }

  async captureStrategicMemory(
    params: StrategyMemoryCaptureParams,
  ): Promise<GatewayStrategyMemoryResult> {
    return await this.transport.request<GatewayStrategyMemoryResult>(
      "strategy.memory.capture",
      params,
    );
  }

  async listDueStrategicPushes(
    params: StrategyMemoryDueParams = {},
  ): Promise<GatewayStrategyDueResult> {
    return await this.transport.request<GatewayStrategyDueResult>(
      "strategy.memory.due",
      params,
    );
  }

  async advanceStrategicMemory(
    params: StrategyMemoryAdvanceParams,
  ): Promise<GatewayStrategyMemoryResult> {
    return await this.transport.request<GatewayStrategyMemoryResult>(
      "strategy.memory.advance",
      params,
    );
  }

  async getSelfModel(params: SelfModelGetParams = {}): Promise<GatewaySelfModelResult> {
    return await this.transport.request<GatewaySelfModelResult>("self.model.get", params);
  }

  async updateSelfModel(params: SelfModelUpdateParams): Promise<GatewaySelfModelResult> {
    return await this.transport.request<GatewaySelfModelResult>("self.model.update", params);
  }

  async updateUserModel(params: UserModelUpdateParams): Promise<GatewayUserModelResult> {
    return await this.transport.request<GatewayUserModelResult>("user.model.update", params);
  }

  async queryUserModel(params: UserModelDialecticParams): Promise<GatewayUserModelResult> {
    return await this.transport.request<GatewayUserModelResult>("user.model.dialectic", params);
  }

  async listBusinessTasks(
    params: GatewayBusinessTasksListParams = {},
  ): Promise<GatewayBusinessTasksListResult> {
    return await this.transport.request<GatewayBusinessTasksListResult>(
      "business.tasks.list",
      params,
    );
  }

  async createBusinessTask(
    params: GatewayBusinessTaskCreateParams,
  ): Promise<GatewayBusinessTaskResult> {
    return await this.transport.request<GatewayBusinessTaskResult>(
      "business.tasks.create",
      params,
    );
  }

  async updateBusinessTask(
    params: GatewayBusinessTaskUpdateParams,
  ): Promise<GatewayBusinessTaskResult> {
    return await this.transport.request<GatewayBusinessTaskResult>(
      "business.tasks.update",
      params,
    );
  }

  async deleteBusinessTask(
    params: GatewayBusinessTaskDeleteParams,
  ): Promise<GatewayBusinessTaskResult> {
    return await this.transport.request<GatewayBusinessTaskResult>(
      "business.tasks.delete",
      params,
    );
  }

  async getConfig(params: ConfigGetParams = {}): Promise<GatewayConfigGetResult> {
    return await this.transport.request<GatewayConfigGetResult>("config.get", params);
  }

  async patchConfig(params: ConfigPatchParams): Promise<GatewayConfigPatchResult> {
    return await this.transport.request<GatewayConfigPatchResult>("config.patch", params);
  }

  async tailLogs(params: LogsTailParams = {}): Promise<LogsTailResult> {
    return await this.transport.request<LogsTailResult>("logs.tail", params);
  }

  async listRemoteModels(params: ModelsRemoteListParams): Promise<GatewayRemoteModelsResult> {
    return await this.transport.request<GatewayRemoteModelsResult>("models.remoteList", params);
  }

  async getSkillsStatus(params: SkillsStatusParams = {}): Promise<GatewaySkillsStatusResult> {
    return await this.transport.request<GatewaySkillsStatusResult>("skills.status", params);
  }

  async searchSkills(params: SkillsSearchParams = {}): Promise<SkillsSearchResult> {
    return await this.transport.request<SkillsSearchResult>("skills.search", params);
  }

  async listAgentFiles(params: AgentsFilesListParams): Promise<AgentsFilesListResult> {
    return await this.transport.request<AgentsFilesListResult>("agents.files.list", params);
  }

  async getAgentFile(params: AgentsFilesGetParams): Promise<AgentsFilesGetResult> {
    return await this.transport.request<AgentsFilesGetResult>("agents.files.get", params);
  }

  async setAgentFile(params: AgentsFilesSetParams): Promise<AgentsFilesSetResult> {
    return await this.transport.request<AgentsFilesSetResult>("agents.files.set", params);
  }

  async listMcpTools(
    params: GatewayMcpToolsListParams = {},
  ): Promise<GatewayMcpToolsListResult> {
    return await this.transport.request<GatewayMcpToolsListResult>("mcp.tools.list", params);
  }

  async callMcpTool(params: GatewayMcpToolCallParams): Promise<GatewayMcpToolCallResult> {
    return await this.transport.request<GatewayMcpToolCallResult>("mcp.tools.call", params);
  }

  async callGatewayMethod(method: string, params?: unknown): Promise<unknown> {
    return await this.transport.request(method, params);
  }

  async listModels(): Promise<GatewayModelChoice[]> {
    const res = await this.transport.request("models.list");
    return Array.isArray(res?.models) ? res.models : [];
  }
}

export async function resolveGatewayConnection(
  opts: GatewayConnectionOptions,
): Promise<ResolvedGatewayConnection> {
  const config = loadConfig();
  const env = process.env;
  const gatewayAuthMode = config.gateway?.auth?.mode;
  const isRemoteMode = config.gateway?.mode === "remote";

  const urlOverride =
    typeof opts.url === "string" && opts.url.trim().length > 0 ? opts.url.trim() : undefined;
  const explicitAuth = resolveExplicitGatewayAuth({ token: opts.token, password: opts.password });
  ensureExplicitGatewayAuth({
    urlOverride,
    urlOverrideSource: "cli",
    explicitAuth,
    errorHint: "修复方式：使用 --url 时请同时传入 --token 或 --password。",
  });
  const url = buildGatewayConnectionDetails({
    config,
    ...(urlOverride ? { url: urlOverride } : {}),
  }).url;
  const allowInsecureLocalOperatorUi = (() => {
    if (config.gateway?.controlUi?.allowInsecureAuth !== true) {
      return false;
    }
    try {
      return isLoopbackHost(new URL(url).hostname);
    } catch {
      return false;
    }
  })();

  if (urlOverride) {
    return {
      url,
      token: explicitAuth.token,
      password: explicitAuth.password,
      allowInsecureLocalOperatorUi,
    };
  }

  if (isRemoteMode) {
    const resolved = await resolveGatewayInteractiveSurfaceAuth({
      config,
      env,
      explicitAuth,
      surface: "remote",
    });
    if (resolved.failureReason) {
      throwGatewayAuthResolutionError(resolved.failureReason);
    }
    return {
      url,
      token: resolved.token,
      password: resolved.password,
      allowInsecureLocalOperatorUi: false,
    };
  }

  if (gatewayAuthMode === "none" || gatewayAuthMode === "trusted-proxy") {
    const resolved = await resolveGatewayInteractiveSurfaceAuth({
      config,
      env,
      explicitAuth,
      surface: "local",
    });
    return {
      url,
      token: resolved.token,
      password: resolved.password,
      allowInsecureLocalOperatorUi,
    };
  }

  try {
    assertExplicitGatewayAuthModeWhenBothConfigured(config);
  } catch (err) {
    throwGatewayAuthResolutionError(formatErrorMessage(err));
  }

  const resolved = await resolveGatewayInteractiveSurfaceAuth({
    config,
    env,
    explicitAuth,
    surface: "local",
  });
  if (resolved.failureReason) {
    throwGatewayAuthResolutionError(resolved.failureReason);
  }
  return {
    url,
    token: resolved.token,
    password: resolved.password,
    allowInsecureLocalOperatorUi,
  };
}
