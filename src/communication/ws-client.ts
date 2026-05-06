/**
 * WebSocket 客户端 SDK
 * 
 * 提供浏览器和 Node.js 环境的 WebSocket 客户端
 */

import {
  type WSMessage,
  type SubscribeMessage,
  type UnsubscribeMessage,
  type EventMessage,
  type HeartbeatMessage,
  type AuthMessage,
  type ErrorMessage,
  validateWSMessage,
  createSubscribeMessage,
  createUnsubscribeMessage,
  createHeartbeatMessage,
  createAuthMessage,
  deserializeMessage,
  serializeMessage,
} from './ws-protocol.js';
import type { BusEvent, EventHandler, EventPattern } from './message-bus.js';

// ==================== 类型定义 ====================

/**
 * 客户端选项
 */
export interface WSClientOptions {
  /** 自动重连 */
  autoReconnect?: boolean;
  
  /** 最大重连尝试次数 */
  maxReconnectAttempts?: number;
  
  /** 重连延迟（毫秒） */
  reconnectDelay?: number;
  
  /** 重连延迟增长倍数 */
  reconnectBackoffMultiplier?: number;
  
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  
  /** 连接超时（毫秒） */
  connectionTimeout?: number;
}

/**
 * 订阅对象
 */
export interface ClientSubscription {
  id: string;
  pattern: EventPattern;
  unsubscribe: () => void;
}

/**
 * 客户端状态
 */
export type ClientState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

/**
 * 事件处理器映射
 */
type EventHandlerMap = Map<string, Set<EventHandler>>;

// ==================== WebSocket 客户端实现 ====================

/**
 * WebSocket 客户端类
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private options: Required<WSClientOptions>;
  private state: ClientState = 'disconnected';
  private handlers: EventHandlerMap = new Map();
  private subscriptions: Map<string, EventPattern> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionTimeoutTimer?: NodeJS.Timeout;
  
  constructor(options: WSClientOptions = {}) {
    this.url = '';
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectDelay: options.reconnectDelay ?? 1000,
      reconnectBackoffMultiplier: options.reconnectBackoffMultiplier ?? 2,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000,
    };
  }
  
  /**
   * 连接到服务器
   */
  async connect(url: string, token: string): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.warn('[WSClient] Already connected or connecting');
      return;
    }
    
    this.url = url;
    this.token = token;
    this.state = 'connecting';
    
    return new Promise((resolve, reject) => {
      try {
        // 创建 WebSocket 连接
        this.ws = new WebSocket(url);
        
        // 设置连接超时
        this.connectionTimeoutTimer = setTimeout(() => {
          if (this.state === 'connecting') {
            this.cleanup();
            reject(new Error('Connection timeout'));
          }
        }, this.options.connectionTimeout);
        
        // 设置事件处理器
        this.ws.onopen = () => {
          this.handleOpen(resolve);
        };
        
        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error: Event) => {
          this.handleError(error);
          reject(new Error('WebSocket connection error'));
        };
        
        this.ws.onclose = (event: CloseEvent) => {
          this.handleClose(event);
        };
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }
  
  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.state = 'closed';
    this.stopReconnect();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    
    this.handlers.clear();
    this.subscriptions.clear();
  }
  
  /**
   * 订阅事件
   */
  subscribe(pattern: EventPattern, handler: EventHandler): ClientSubscription {
    // 注册本地处理器
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
    }
    this.handlers.get(pattern)!.add(handler);
    
    // 如果已连接，发送订阅请求
    if (this.state === 'connected' && this.ws) {
      const subMsg = createSubscribeMessage([pattern]);
      this.send(subMsg);
      
      // 记录订阅
      this.subscriptions.set(subMsg.id!, pattern);
    }
    
    // 返回订阅对象
    const subscription: ClientSubscription = {
      id: `client_sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      pattern,
      unsubscribe: () => {
        // 移除本地处理器
        const handlers = this.handlers.get(pattern);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.handlers.delete(pattern);
          }
        }
        
        // 如果已连接，发送取消订阅请求
        if (this.state === 'connected' && this.ws) {
          const unsubMsg = createUnsubscribeMessage([subscription.id]);
          this.send(unsubMsg);
        }
      },
    };
    
    return subscription;
  }
  
  /**
   * 获取当前状态
   */
  getState(): ClientState {
    return this.state;
  }
  
  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 处理连接打开
   */
  private handleOpen(resolve: () => void): void {
    clearTimeout(this.connectionTimeoutTimer);
    this.state = 'connected';
    this.reconnectAttempts = 0;
    
    console.log('[WSClient] Connected');
    
    // 发送认证
    if (this.token) {
      const authMsg = createAuthMessage(this.token);
      this.send(authMsg);
    }
    
    // 重新订阅之前的事件
    this.resubscribe();
    
    // 启动心跳
    this.startHeartbeat();
    
    resolve();
  }
  
  /**
   * 处理收到的消息
   */
  private handleMessage(data: unknown): void {
    const message = deserializeMessage(typeof data === 'string' ? data : String(data));
    
    if (!message) {
      console.error('[WSClient] Invalid message received');
      return;
    }
    
    switch (message.type) {
      case 'event':
        this.handleEvent(message);
        break;
      
      case 'auth_response':
        this.handleAuthResponse(message);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      
      case 'error':
        this.handleError(message);
        break;
    }
  }
  
  /**
   * 处理事件消息
   */
  private handleEvent(message: EventMessage): void {
    const event = message.event;
    
    // 查找匹配的处理器
    for (const [pattern, handlers] of this.handlers.entries()) {
      if (this.matchesPattern(event.type, pattern)) {
        for (const handler of handlers) {
          try {
            handler(event);
          } catch (err) {
            console.error('[WSClient] Error in event handler:', err);
          }
        }
      }
    }
  }
  
  /**
   * 处理认证响应
   */
  private handleAuthResponse(message: any): void {
    if (message.success) {
      console.log('[WSClient] Authenticated');
    } else {
      console.error('[WSClient] Authentication failed:', message.error);
    }
  }
  
  /**
   * 处理心跳
   */
  private handleHeartbeat(message: HeartbeatMessage): void {
    // 收到服务器心跳响应，无需特殊处理
  }
  
  /**
   * 处理错误消息
   */
  private handleError(message: ErrorMessage | Event): void {
    if ('code' in message) {
      console.error(`[WSClient] Error (${message.code}): ${message.message}`);
    } else {
      console.error('[WSClient] WebSocket error:', message);
    }
  }
  
  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[WSClient] Connection closed (code: ${event.code}, reason: ${event.reason})`);
    
    this.cleanup();
    
    // 如果不是主动关闭，尝试重连
    if (this.state !== 'closed' && this.options.autoReconnect) {
      this.attemptReconnect();
    }
  }
  
  /**
   * 发送消息
   */
  private send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const json = serializeMessage(message);
      this.ws.send(json);
    }
  }
  
  /**
   * 重新订阅
   */
  private resubscribe(): void {
    // 收集所有唯一的模式
    const patterns = new Set(this.handlers.keys());
    
    if (patterns.size > 0) {
      const subMsg = createSubscribeMessage(Array.from(patterns));
      this.send(subMsg);
    }
  }
  
  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws) {
        const heartbeatMsg = createHeartbeatMessage();
        this.send(heartbeatMsg);
      }
    }, this.options.heartbeatInterval);
  }
  
  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
  
  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('[WSClient] Max reconnection attempts reached');
      this.state = 'disconnected';
      return;
    }
    
    this.state = 'reconnecting';
    this.reconnectAttempts++;
    
    const delay = this.options.reconnectDelay * 
      Math.pow(this.options.reconnectBackoffMultiplier, this.reconnectAttempts - 1);
    
    console.log(`[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url, this.token || '').catch((err) => {
        console.error('[WSClient] Reconnection failed:', err);
      });
    }, delay);
  }
  
  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
  
  /**
   * 清理资源
   */
  private cleanup(): void {
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = undefined;
    }
    
    this.ws = null;
  }
  
  /**
   * 检查事件类型是否匹配模式
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }
    
    if (pattern === eventType) {
      return true;
    }
    
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.+');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(eventType);
    }
    
    return false;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 WebSocket 客户端
 */
export function createWSClient(options: WSClientOptions = {}): WSClient {
  return new WSClient(options);
}
