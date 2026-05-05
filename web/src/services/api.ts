/**
 * 前端 API 服务层
 * 
 * 提供与后端网关的 HTTP API 交互
 */

import type { GovernanceStatus } from '../types';

// ==================== 类型定义 ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'frozen';
  lastActive?: number;
}

export interface ChannelInfo {
  id: string;
  type: string;
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

// ==================== API 客户端 ====================

class ApiService {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = '', token: string | null = null) {
    this.baseUrl = baseUrl || this.getDefaultBaseUrl();
    this.token = token;
  }

  /**
   * 获取默认的基础 URL
   */
  private getDefaultBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return 'http://localhost:3000';
  }

  /**
   * 设置认证令牌
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      // 添加认证令牌
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      console.error(`[ApiService] 请求失败 [${options.method || 'GET'} ${path}]:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==================== 治理层 API ====================

  /**
   * 获取治理状态
   */
  async getGovernanceStatus(): Promise<ApiResponse<GovernanceStatus>> {
    return this.request<GovernanceStatus>('/api/governance/status');
  }

  /**
   * 获取代理列表
   */
  async getAgents(): Promise<ApiResponse<AgentInfo[]>> {
    return this.request<AgentInfo[]>('/api/agents');
  }

  /**
   * 创建提案
   */
  async createProposal(proposal: {
    title: string;
    description: string;
    type: string;
  }): Promise<ApiResponse<{ proposalId: string }>> {
    return this.request<{ proposalId: string }>('/api/governance/proposals', {
      method: 'POST',
      body: JSON.stringify(proposal),
    });
  }

  /**
   * 投票
   */
  async voteProposal(proposalId: string, vote: 'approve' | 'reject'): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/governance/proposals/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    });
  }

  // ==================== 渠道 API ====================

  /**
   * 获取渠道列表
   */
  async getChannels(): Promise<ApiResponse<ChannelInfo[]>> {
    return this.request<ChannelInfo[]>('/api/channels');
  }

  /**
   * 连接渠道
   */
  async connectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/channels/${channelId}/connect`, {
      method: 'POST',
    });
  }

  /**
   * 断开渠道
   */
  async disconnectChannel(channelId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/channels/${channelId}/disconnect`, {
      method: 'POST',
    });
  }

  // ==================== 会话 API ====================

  /**
   * 获取会话列表
   */
  async getSessions(limit: number = 50): Promise<ApiResponse<SessionInfo[]>> {
    return this.request<SessionInfo[]>(`/api/sessions?limit=${limit}`);
  }

  /**
   * 创建新会话
   */
  async createSession(title?: string): Promise<ApiResponse<{ sessionId: string }>> {
    return this.request<{ sessionId: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取会话消息
   */
  async getSessionMessages(sessionId: string, limit: number = 100): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/api/sessions/${sessionId}/messages?limit=${limit}`);
  }

  /**
   * 发送消息
   */
  async sendMessage(sessionId: string, message: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: message }),
    });
  }

  // ==================== 任务 API ====================

  /**
   * 获取任务列表
   */
  async getTasks(status?: string): Promise<ApiResponse<TaskInfo[]>> {
    const query = status ? `?status=${status}` : '';
    return this.request<TaskInfo[]>(`/api/tasks${query}`);
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
  }

  // ==================== 系统 API ====================

  /**
   * 健康检查
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; uptime: number }>> {
    return this.request<{ status: string; uptime: number }>('/api/health');
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<ApiResponse<{
    version: string;
    uptime: number;
    memory: { used: number; total: number };
  }>> {
    return this.request<any>('/api/system/info');
  }

  /**
   * 重启系统
   */
  async restartSystem(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/system/restart', {
      method: 'POST',
    });
  }
}

// ==================== 导出单例 ====================

export const apiService = new ApiService();

/**
 * 创建新的 API 服务实例
 */
export function createApiService(baseUrl?: string, token?: string | null): ApiService {
  return new ApiService(baseUrl, token);
}
