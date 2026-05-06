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
  status: 'pending' | 'running' | 'completed' | 'failed';
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

export interface ProposalInfo {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  createdAt: number;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class ApiService {
  private defaultTimeout = 15000;
  private defaultRetries = 2;
  private defaultRetryDelay = 1000;

  private async rpc<T = any>(method: string, params?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const retries = options?.retries ?? this.defaultRetries;
    const retryDelay = options?.retryDelay ?? this.defaultRetryDelay;

    let lastError: string = '';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (!wsManager.isConnected) {
          throw new Error('WebSocket 未连接，请检查后端服务是否运行');
        }

        const result = await wsManager.request(method, params, timeout);
        return { success: true, data: result as T };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < retries && !lastError.includes('未认证') && !lastError.includes('未连接')) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
    }

    console.error(`[ApiService] RPC 调用失败 [${method}]:`, lastError);
    return { success: false, error: lastError };
  }

  async getGovernanceStatus(): Promise<ApiResponse<GovernanceStatus>> {
    return this.rpc<GovernanceStatus>('governance.overview');
  }

  async getAgents(): Promise<ApiResponse<AgentInfo[]>> {
    return this.rpc<AgentInfo[]>('agents.list');
  }

  async createProposal(proposal: {
    title: string;
    description: string;
    type: string;
  }): Promise<ApiResponse<ProposalInfo>> {
    return this.rpc<ProposalInfo>('governance.proposals.create', proposal);
  }

  async listProposals(): Promise<ApiResponse<ProposalInfo[]>> {
    return this.rpc<ProposalInfo[]>('governance.proposals.list');
  }

  async reviewProposal(proposalId: string, decision: 'approve' | 'reject', comment?: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.review', { proposalId, decision, comment });
  }

  async applyProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.apply', { proposalId });
  }

  async revertProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('governance.proposals.revert', { proposalId });
  }

  async voteProposal(proposalId: string, vote: 'approve' | 'reject'): Promise<ApiResponse<void>> {
    return this.reviewProposal(proposalId, vote);
  }

  async getChannels(): Promise<ApiResponse<ChannelInfo[]>> {
    return this.rpc<ChannelInfo[]>('channels.status');
  }

  async connectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('channels.connect', { channelId });
  }

  async disconnectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('channels.logout', { channelId });
  }

  async getSessions(limit: number = 50): Promise<ApiResponse<SessionInfo[]>> {
    return this.rpc<SessionInfo[]>('sessions.list', { limit });
  }

  async createSession(title?: string): Promise<ApiResponse<{ sessionId: string }>> {
    return this.rpc<{ sessionId: string }>('sessions.create', { title });
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('sessions.delete', { sessionId });
  }

  async getSessionMessages(sessionId: string, limit: number = 100): Promise<ApiResponse<any[]>> {
    // 使用 chat.history 替代 sessions.get
    const response = await this.rpc<any>('chat.history', { sessionKey: sessionId, limit });
    
    if (response.success && response.data) {
      // chat.history 返回的是 { messages: [...] } 结构
      return { success: true, data: response.data.messages || [] };
    }
    
    return response;
  }

  async getChatHistory(sessionKey: string, limit: number = 200): Promise<ApiResponse<any>> {
    // 直接使用 chat.history API，返回完整响应
    return this.rpc<any>('chat.history', { sessionKey, limit });
  }

  async sendMessage(sessionId: string, message: string): Promise<ApiResponse<any>> {
    return this.rpc<any>('chat.send', { sessionId, content: message });
  }

  async abortChat(sessionId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('chat.abort', { sessionId });
  }

  async getTasks(status?: string): Promise<ApiResponse<TaskInfo[]>> {
    return this.rpc<TaskInfo[]>('autonomy.list', { status });
  }

  async cancelTask(taskId: string): Promise<ApiResponse<void>> {
    return this.rpc<void>('autonomy.cancel', { taskId });
  }

  async healthCheck(): Promise<ApiResponse<{ status: string; uptime: number }>> {
    return this.rpc<{ status: string; uptime: number }>('health');
  }

  async getSystemInfo(): Promise<ApiResponse<{
    version: string;
    uptime: number;
    memory: { used: number; total: number };
  }>> {
    return this.rpc<any>('gateway.identity.get');
  }

  async restartSystem(): Promise<ApiResponse<void>> {
    return this.rpc<void>('system.restart');
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
    return this.rpc<ModelInfo[]>('models.list');
  }

  async getToolsCatalog(): Promise<ApiResponse<any[]>> {
    return this.rpc<any[]>('tools.catalog');
  }

  async getUsageStatus(): Promise<ApiResponse<any>> {
    return this.rpc<any>('usage.status');
  }
}

export const apiService = new ApiService();

export function createApiService(): ApiService {
  return new ApiService();
}
