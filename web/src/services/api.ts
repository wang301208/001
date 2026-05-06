import type { GovernanceStatus } from '../types';
import { wsManager } from './ws-manager';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'frozen';
  role?: string;
  lastActive?: number;
}

export interface ChannelInfo {
  id: string;
  type: string;
  name: string;
  connected: boolean;
  status?: string;
  accountId?: string;
  lastActivity?: number;
}

export interface SessionInfo {
  id: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface TaskInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  createdAt: number;
  completedAt?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  status?: string;
}

export interface ConfigData {
  [key: string]: any;
}

export interface GovernanceProposalOperation {
  kind: 'write' | 'delete';
  path: string;
  content?: string;
}

export interface ProposalInfo {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  createdAt: number;
  updatedAt?: number;
  operations?: GovernanceProposalOperation[];
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function maxDefined(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => typeof value === 'number');
  return present.length > 0 ? Math.max(...present) : undefined;
}

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  return `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function mapProposalStatusToProjectStatus(status: string): 'proposed' | 'running' | 'completed' | 'failed' {
  if (status === 'approved') return 'running';
  if (status === 'applied') return 'completed';
  if (status === 'rejected') return 'failed';
  return 'proposed';
}

function mapTaskStatus(status: unknown): TaskInfo['status'] {
  switch (status) {
    case 'queued':
    case 'waiting':
    case 'blocked':
      return 'pending';
    case 'running':
      return 'running';
    case 'succeeded':
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'failed';
  }
}

function taskProgress(status: TaskInfo['status']): number {
  if (status === 'completed') return 100;
  if (status === 'failed' || status === 'cancelled') return 100;
  if (status === 'running') return 50;
  return 0;
}

function normalizeProposal(raw: any): ProposalInfo {
  const operations = asArray(raw?.operations).filter(
    (operation): operation is GovernanceProposalOperation =>
      isRecord(operation) &&
      (operation.kind === 'write' || operation.kind === 'delete') &&
      typeof operation.path === 'string',
  );
  return {
    id: String(raw?.id ?? ''),
    title: String(raw?.title ?? raw?.id ?? 'Untitled proposal'),
    description: asString(raw?.rationale) ?? asString(raw?.description),
    type: asString(raw?.type) ?? asString(raw?.category) ?? operations[0]?.kind ?? 'governance',
    status: String(raw?.status ?? 'pending'),
    createdAt: asNumber(raw?.createdAt) ?? Date.now(),
    updatedAt: asNumber(raw?.updatedAt),
    operations,
  };
}

export function adaptGovernanceStatus(raw: any): GovernanceStatus {
  if (isRecord(raw) && Array.isArray(raw.activeAgents)) {
    return {
      sovereigntyBoundary: Boolean(raw.sovereigntyBoundary),
      activeAgents: raw.activeAgents,
      evolutionProjects: asArray(raw.evolutionProjects),
      sandboxExperiments: asArray(raw.sandboxExperiments),
      freezeActive: Boolean(raw.freezeActive),
      freezeStatus: raw.freezeStatus,
    };
  }

  const organization = isRecord(raw?.organization) ? raw.organization : {};
  const enforcement = isRecord(raw?.enforcement) ? raw.enforcement : {};
  const sovereignty = isRecord(raw?.sovereignty) ? raw.sovereignty : {};
  const proposals = isRecord(raw?.proposals) ? raw.proposals : {};
  const proposalItems = asArray(proposals.items ?? proposals.proposals);
  const openIncidents = asNumber(sovereignty.open);
  const freezeActive = Boolean(enforcement.active);

  return {
    sovereigntyBoundary:
      typeof openIncidents === 'number' ? openIncidents === 0 : asArray(sovereignty.activeIncidentIds).length === 0,
    activeAgents: asArray(organization.agents).map((agent) => {
      const status = agent?.governance?.freezeActive ? 'frozen' : asString(agent?.status) ?? 'active';
      return {
        id: String(agent?.id ?? ''),
        name: asString(agent?.title) ?? asString(agent?.name) ?? String(agent?.id ?? 'unknown'),
        role: asString(agent?.layer) ?? asString(agent?.role) ?? 'unknown',
        status: status === 'inactive' || status === 'frozen' ? status : 'active',
      };
    }),
    evolutionProjects: proposalItems.map((proposal) => {
      const normalized = normalizeProposal(proposal);
      return {
        id: normalized.id,
        title: normalized.title,
        mutationClass: normalized.type,
        status: mapProposalStatusToProjectStatus(normalized.status),
        progress: normalized.status === 'applied' ? 100 : normalized.status === 'approved' ? 50 : 0,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
      };
    }),
    sandboxExperiments: asArray(raw?.sandboxExperiments),
    freezeActive,
    freezeStatus: freezeActive
      ? {
          active: true,
          reason: asString(enforcement.reasonCode) ?? asString(enforcement.message),
          activatedAt: asNumber(raw?.observedAt),
          affectedSubsystems: asArray(enforcement.denyTools ?? raw?.freezeTargets).filter(
            (entry): entry is string => typeof entry === 'string',
          ),
        }
      : undefined,
  };
}

export function normalizeChatMessage(raw: any, index = 0): any {
  const message = isRecord(raw?.message) ? raw.message : raw;
  const timestamp =
    asNumber(message?.timestamp) ??
    asNumber(message?.createdAt) ??
    (typeof message?.timestamp === 'string' ? Date.parse(message.timestamp) : undefined) ??
    Date.now();
  return {
    id: String(message?.id ?? raw?.messageId ?? `msg_${timestamp}_${index}`),
    role:
      message?.role === 'user' || message?.role === 'assistant' || message?.role === 'system'
        ? message.role
        : 'assistant',
    content: extractMessageContent(message?.content ?? message?.text ?? ''),
    timestamp,
  };
}

function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractMessageContent).filter(Boolean).join('\n');
  }
  if (isRecord(content)) {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
    if (Array.isArray(content.content)) return extractMessageContent(content.content);
  }
  return '';
}

function adaptChannelsStatus(raw: any): ChannelInfo[] {
  const channelsMap = isRecord(raw?.channels) ? raw.channels : {};
  const accountsMap = isRecord(raw?.channelAccounts) ? raw.channelAccounts : {};
  const defaultAccounts = isRecord(raw?.channelDefaultAccountId) ? raw.channelDefaultAccountId : {};
  const labels = isRecord(raw?.channelLabels) ? raw.channelLabels : {};
  const order = asArray(raw?.channelOrder).filter((entry): entry is string => typeof entry === 'string');
  const ids = Array.from(
    new Set([...order, ...Object.keys(channelsMap), ...Object.keys(accountsMap), ...Object.keys(labels)]),
  );

  return ids.map((id) => {
    const summary = isRecord(channelsMap[id]) ? channelsMap[id] : {};
    const accounts = asArray(accountsMap[id]);
    const defaultAccountId = asString(defaultAccounts[id]);
    const account =
      accounts.find((entry) => isRecord(entry) && entry.accountId === defaultAccountId) ??
      accounts.find(isRecord) ??
      {};
    const connected = Boolean(
      account.connected ?? account.running ?? summary.connected ?? summary.running ?? false,
    );
    const configured = Boolean(account.configured ?? summary.configured ?? false);
    return {
      id,
      type: asString(summary.type) ?? id,
      name: asString(labels[id]) ?? asString(summary.name) ?? id,
      connected,
      status:
        asString(account.healthState) ??
        asString(summary.healthState) ??
        asString(summary.status) ??
        (connected ? 'connected' : configured ? 'configured' : 'not_configured'),
      accountId: asString(account.accountId),
      lastActivity: maxDefined([
        asNumber(account.lastInboundAt),
        asNumber(account.lastOutboundAt),
        asNumber(account.lastConnectedAt),
        asNumber(account.lastRunActivityAt),
        asNumber(account.lastStartAt),
      ]),
    };
  });
}

function adaptSessionsList(raw: any): SessionInfo[] {
  return asArray(raw?.sessions ?? raw).map((session) => {
    const id = String(session?.key ?? session?.sessionKey ?? session?.id ?? session?.sessionId ?? '');
    const updatedAt = asNumber(session?.updatedAt) ?? asNumber(session?.createdAt) ?? Date.now();
    return {
      id,
      title:
        asString(session?.derivedTitle) ??
        asString(session?.displayName) ??
        asString(session?.label) ??
        asString(session?.subject) ??
        id,
      createdAt: asNumber(session?.createdAt) ?? asNumber(session?.startedAt) ?? updatedAt,
      updatedAt,
      messageCount: asNumber(session?.messageCount) ?? asArray(session?.messages).length,
    };
  });
}

function adaptAgentsList(raw: any): AgentInfo[] {
  return asArray(raw?.agents ?? raw).map((agent) => ({
    id: String(agent?.id ?? ''),
    name: asString(agent?.name) ?? asString(agent?.title) ?? String(agent?.id ?? 'unknown'),
    status: agent?.status === 'inactive' || agent?.status === 'frozen' ? agent.status : 'active',
    role: asString(agent?.role) ?? asString(agent?.layer),
    lastActive: asNumber(agent?.lastActive),
  }));
}

function adaptModelsList(raw: any): ModelInfo[] {
  return asArray(raw?.models ?? raw).map((model) => ({
    id: String(model?.id ?? model?.name ?? ''),
    name: String(model?.name ?? model?.id ?? ''),
    provider: String(model?.provider ?? 'unknown'),
    status: asString(model?.status),
  }));
}

function adaptTasks(raw: any, statusFilter?: string): TaskInfo[] {
  const entries = asArray(raw?.overview?.entries ?? raw?.entries);
  const tasks = entries
    .map((entry): TaskInfo | null => {
      const flow = entry?.latestFlow;
      if (!isRecord(flow)) return null;
      const status = mapTaskStatus(flow.status);
      const agentId = String(entry?.agentId ?? flow.agentId ?? 'unknown');
      const createdAt = asNumber(flow.createdAt) ?? asNumber(flow.updatedAt) ?? Date.now();
      return {
        id: `${agentId}:${String(flow.id ?? '')}`,
        name: asString(flow.goal) ?? asString(flow.currentStep) ?? asString(entry?.profile?.name) ?? agentId,
        status,
        progress: taskProgress(status),
        createdAt,
        completedAt: asNumber(flow.endedAt),
      };
    })
    .filter((task): task is TaskInfo => task !== null);

  return statusFilter ? tasks.filter((task) => task.status === statusFilter) : tasks;
}

class ApiService {
  private defaultTimeout = 15000;
  private defaultRetries = 2;
  private defaultRetryDelay = 1000;

  private async rpc<T = any>(method: string, params?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const retries = options?.retries ?? this.defaultRetries;
    const retryDelay = options?.retryDelay ?? this.defaultRetryDelay;
    let lastError = '';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (!wsManager.isConnected) {
          throw new Error('WebSocket is not connected');
        }

        const result = await wsManager.request(method, params ?? {}, timeout);
        return { success: true, data: result as T };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const retryable =
          attempt < retries &&
          !lastError.includes('not authenticated') &&
          !lastError.includes('not connected');

        if (retryable) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    console.error(`[ApiService] RPC failed [${method}]:`, lastError);
    return { success: false, error: lastError };
  }

  async getGovernanceStatus(): Promise<ApiResponse<GovernanceStatus>> {
    const response = await this.rpc<any>('governance.overview');
    if (!response.success) return response;
    return { success: true, data: adaptGovernanceStatus(response.data) };
  }

  async getAgents(): Promise<ApiResponse<AgentInfo[]>> {
    const response = await this.rpc<any>('agents.list');
    if (!response.success) return response;
    return { success: true, data: adaptAgentsList(response.data) };
  }

  async createProposal(proposal: {
    title: string;
    description?: string;
    type?: string;
    operations?: GovernanceProposalOperation[];
  }): Promise<ApiResponse<ProposalInfo>> {
    const operations = asArray(proposal.operations).filter(
      (operation): operation is GovernanceProposalOperation =>
        isRecord(operation) &&
        (operation.kind === 'write' || operation.kind === 'delete') &&
        typeof operation.path === 'string',
    );

    if (operations.length === 0) {
      return {
        success: false,
        error: 'governance.proposals.create requires at least one write/delete operation',
      };
    }

    const response = await this.rpc<any>('governance.proposals.create', {
      title: proposal.title,
      ...(proposal.description ? { rationale: proposal.description } : {}),
      operations,
    });
    if (!response.success) return response;
    return { success: true, data: normalizeProposal(response.data?.proposal ?? response.data) };
  }

  async listProposals(): Promise<ApiResponse<ProposalInfo[]>> {
    const response = await this.rpc<any>('governance.proposals.list');
    if (!response.success) return response;
    return { success: true, data: asArray(response.data?.proposals ?? response.data).map(normalizeProposal) };
  }

  async reviewProposal(
    proposalId: string,
    decision: 'approve' | 'reject',
    comment?: string,
  ): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.review', {
      proposalId,
      decision,
      decidedBy: 'web-console',
      ...(comment ? { decisionNote: comment } : {}),
    });
  }

  async applyProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.apply', {
      proposalId,
      appliedBy: 'web-console',
    });
  }

  async revertProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.revert', {
      proposalId,
      revertedBy: 'web-console',
    });
  }

  async voteProposal(proposalId: string, vote: 'approve' | 'reject'): Promise<ApiResponse<void>> {
    return this.reviewProposal(proposalId, vote);
  }

  async getChannels(): Promise<ApiResponse<ChannelInfo[]>> {
    const response = await this.rpc<any>('channels.status');
    if (!response.success) return response;
    return { success: true, data: adaptChannelsStatus(response.data) };
  }

  async connectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('channels.connect', { channel: channelId });
  }

  async disconnectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('channels.logout', { channel: channelId });
  }

  async getSessions(limit = 50): Promise<ApiResponse<SessionInfo[]>> {
    const response = await this.rpc<any>('sessions.list', {
      limit,
      includeDerivedTitles: true,
      includeLastMessage: true,
    });
    if (!response.success) return response;
    return { success: true, data: adaptSessionsList(response.data) };
  }

  async createSession(title?: string): Promise<ApiResponse<{ sessionId: string; key?: string; rawSessionId?: string }>> {
    const response = await this.rpc<any>('sessions.create', title ? { label: title } : {});
    if (!response.success) return response;
    const key = String(response.data?.key ?? response.data?.sessionKey ?? response.data?.sessionId ?? '');
    return {
      success: true,
      data: {
        sessionId: key,
        key,
        rawSessionId: asString(response.data?.sessionId),
      },
    };
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('sessions.delete', { key: sessionId });
  }

  async getSessionMessages(sessionId: string, limit = 100): Promise<ApiResponse<any[]>> {
    const response = await this.rpc<any>('chat.history', { sessionKey: sessionId, limit });
    if (!response.success) return response;
    return {
      success: true,
      data: asArray(response.data?.messages ?? response.data).map(normalizeChatMessage),
    };
  }

  async getChatHistory(sessionKey: string, limit = 200): Promise<ApiResponse<any>> {
    return this.rpc<any>('chat.history', { sessionKey, limit });
  }

  async sendMessage(sessionId: string, message: string): Promise<ApiResponse<any>> {
    return this.rpc<any>('chat.send', {
      sessionKey: sessionId,
      message,
      idempotencyKey: createIdempotencyKey(),
    });
  }

  async abortChat(sessionId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('chat.abort', { sessionKey: sessionId });
  }

  async getTasks(status?: string): Promise<ApiResponse<TaskInfo[]>> {
    const response = await this.rpc<any>('autonomy.overview', {});
    if (!response.success) return response;
    return { success: true, data: adaptTasks(response.data, status) };
  }

  async cancelTask(taskId: string): Promise<ApiResponse<void>> {
    const normalized = taskId.startsWith('be_') ? taskId.slice(3) : taskId;
    const separator = normalized.indexOf(':');
    if (separator <= 0 || separator === normalized.length - 1) {
      return { success: false, error: 'autonomy.cancel requires an encoded agentId:flowId task id' };
    }
    return this.rpc<void>('autonomy.cancel', {
      agentId: normalized.slice(0, separator),
      flowId: normalized.slice(separator + 1),
    });
  }

  async healthCheck(): Promise<ApiResponse<{ status: string; uptime: number }>> {
    const response = await this.rpc<any>('health');
    if (!response.success) return response;
    return {
      success: true,
      data: {
        ...response.data,
        status: asString(response.data?.status) ?? 'healthy',
        uptime: asNumber(response.data?.uptime) ?? asNumber(response.data?.uptimeMs) ?? 0,
      },
    };
  }

  async getSystemInfo(): Promise<ApiResponse<{
    version: string;
    uptime: number;
    memory: { used: number; total: number };
  }>> {
    const response = await this.rpc<any>('status');
    if (!response.success) return response;
    return {
      success: true,
      data: {
        version: asString(response.data?.runtimeVersion) ?? 'unknown',
        uptime: asNumber(response.data?.uptime) ?? asNumber(response.data?.uptimeMs) ?? 0,
        memory: {
          used: asNumber(response.data?.memory?.used) ?? 0,
          total: asNumber(response.data?.memory?.total) ?? 0,
        },
      },
    };
  }

  async restartSystem(): Promise<ApiResponse<void>> {
    return { success: false, error: 'system.restart is not supported by the gateway protocol' };
  }

  async getConfig(): Promise<ApiResponse<{ config: ConfigData; hash?: string; exists: boolean }>> {
    return this.rpc<{ config: ConfigData; hash?: string; exists: boolean }>('config.get', {});
  }

  async setConfig(config: ConfigData, baseHash?: string): Promise<ApiResponse<{ ok: boolean; config: ConfigData }>> {
    const params: Record<string, string> = {
      raw: JSON.stringify(config),
    };
    if (baseHash) {
      params.baseHash = baseHash;
    }
    return this.rpc<{ ok: boolean; config: ConfigData }>('config.set', params);
  }

  async getModels(): Promise<ApiResponse<ModelInfo[]>> {
    const response = await this.rpc<any>('models.list');
    if (!response.success) return response;
    return { success: true, data: adaptModelsList(response.data) };
  }

  async getToolsCatalog(): Promise<ApiResponse<any>> {
    return this.rpc<any>('tools.catalog', {});
  }

  async getUsageStatus(): Promise<ApiResponse<any>> {
    return this.rpc<any>('usage.status');
  }
}

export const apiService = new ApiService();

export function createApiService(): ApiService {
  return new ApiService();
}
