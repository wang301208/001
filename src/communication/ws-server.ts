/**
 * WebSocket 实时通信服务器
 * 
 * 提供基于 WebSocket 的实时事件推送功能
 */

import http from 'node:http';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { getMessageBus, type BusEvent, type EventPattern } from './message-bus.js';
import {
  type WSMessage,
  type SubscribeMessage,
  type UnsubscribeMessage,
  type AuthMessage,
  type HeartbeatMessage,
  validateWSMessage,
  serializeMessage,
  createErrorMessage,
  generateMessageId,
} from './ws-protocol.js';

// ==================== 类型定义 ====================

/**
 * WebSocket 连接信息
 */
interface WSConnection {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  subscriptions: Map<string, EventPattern>; // subscriptionId -> pattern
  lastHeartbeat: number;
  createdAt: number;
  remoteAddress?: string;
}

/**
 * WebSocket 服务器选项
 */
export interface WSServerOptions {
  /** HTTP 服务器实例 */
  httpServer?: http.Server;
  
  /** WebSocket 路径 */
  path?: string;
  
  /** 认证令牌验证函数 */
  authenticate?: (token: string) => Promise<boolean>;
  
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  
  /** 心跳超时时间（毫秒） */
  heartbeatTimeout?: number;
  
  /** 最大连接数 */
  maxConnections?: number;
  
  /** 是否允许跨域 */
  allowOrigins?: string[];
  
  /** 消息总线实例 */
  messageBus?: ReturnType<typeof getMessageBus>;
}

/**
 * WebSocket 服务器统计信息
 */
export interface WSServerStats {
  totalConnections: number;
  authenticatedConnections: number;
  totalSubscriptions: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

// ==================== WebSocket 服务器实现 ====================

/**
 * WebSocket 服务器类
 */
export class WSServer {
  private wss: WebSocketServer;
  private connections: Map<string, WSConnection>;
  private options: Required<WSServerOptions>;
  private heartbeatTimer?: NodeJS.Timeout;
  private stats: WSServerStats;
  private messageBus: ReturnType<typeof getMessageBus>;
  
  constructor(options: WSServerOptions = {}) {
    this.connections = new Map();
    this.stats = {
      totalConnections: 0,
      authenticatedConnections: 0,
      totalSubscriptions: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
    };
    
    this.options = {
      httpServer: options.httpServer,
      path: options.path ?? '/ws',
      authenticate: options.authenticate ?? this.defaultAuthenticate.bind(this),
      heartbeatInterval: options.heartbeatInterval ?? 30000, // 30秒
      heartbeatTimeout: options.heartbeatTimeout ?? 60000,   // 60秒
      maxConnections: options.maxConnections ?? 1000,
      allowOrigins: options.allowOrigins ?? ['*'],
      messageBus: options.messageBus ?? getMessageBus(),
    };
    
    this.messageBus = this.options.messageBus;
    
    // 初始化 WebSocket 服务器
    this.wss = new WebSocketServer({
      server: this.options.httpServer,
      path: this.options.path,
      maxPayload: 1024 * 1024, // 1MB
    });
    
    // 设置事件处理器
    this.setupEventHandlers();
    
    // 启动心跳检测
    this.startHeartbeat();
    
    console.log(`[WSServer] Initialized on path: ${this.options.path}`);
  }
  
  /**
   * 关闭服务器
   */
  async close(): Promise<void> {
    // 停止心跳检测
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // 关闭所有连接
    for (const conn of this.connections.values()) {
      conn.ws.close(1001, 'Server shutting down');
    }
    
    // 关闭 WebSocket 服务器
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
    
    console.log('[WSServer] Closed');
  }
  
  /**
   * 获取统计信息
   */
  getStats(): WSServerStats {
    return { ...this.stats };
  }
  
  /**
   * 广播事件给所有订阅者
   */
  async broadcast(event: BusEvent): Promise<void> {
    const subscribers = this.findSubscribers(event.type);
    
    for (const conn of subscribers) {
      this.sendToConnection(conn, {
        type: 'event',
        id: generateMessageId(),
        event,
      });
    }
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
    
    this.wss.on('error', (err: Error) => {
      console.error('[WSServer] Error:', err);
      this.stats.errors++;
    });
  }
  
  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // 检查连接数限制
    if (this.connections.size >= this.options.maxConnections) {
      ws.close(1013, 'Too many connections');
      return;
    }
    
    // 检查跨域
    if (!this.checkOrigin(req)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }
    
    // 创建连接对象
    const connId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const connection: WSConnection = {
      id: connId,
      ws,
      authenticated: false,
      subscriptions: new Map(),
      lastHeartbeat: Date.now(),
      createdAt: Date.now(),
      remoteAddress: req.socket.remoteAddress,
    };
    
    this.connections.set(connId, connection);
    this.stats.totalConnections++;
    
    console.log(`[WSServer] New connection: ${connId} from ${connection.remoteAddress}`);
    
    // 设置消息处理器
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connection, data);
    });
    
    // 设置关闭处理器
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(connection, code, reason.toString());
    });
    
    // 设置错误处理器
    ws.on('error', (err: Error) => {
      console.error(`[WSServer] Connection error (${connId}):`, err);
      this.stats.errors++;
    });
    
    // 发送欢迎消息
    this.sendToConnection(connection, {
      type: 'auth_response',
      id: generateMessageId(),
      success: false,
      error: 'Please authenticate first',
    });
  }
  
  /**
   * 处理收到的消息
   */
  private handleMessage(connection: WSConnection, data: WebSocket.Data): void {
    this.stats.messagesReceived++;
    
    // 解析消息
    let message: WSMessage | null = null;
    try {
      const json = data.toString();
      message = JSON.parse(json);
      
      if (!validateWSMessage(message)) {
        this.sendError(connection, 'INVALID_MESSAGE', 'Invalid message format');
        return;
      }
    } catch (err) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Failed to parse message');
      return;
    }
    
    // 根据消息类型处理
    switch (message.type) {
      case 'auth':
        this.handleAuth(connection, message);
        break;
      
      case 'subscribe':
        this.handleSubscribe(connection, message);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscribe(connection, message);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(connection, message);
        break;
      
      default:
        this.sendError(connection, 'INVALID_MESSAGE', `Unknown message type: ${message.type}`);
    }
  }
  
  /**
   * 处理认证
   */
  private async handleAuth(connection: WSConnection, message: AuthMessage): Promise<void> {
    try {
      const isValid = await this.options.authenticate(message.token);
      
      if (isValid) {
        connection.authenticated = true;
        this.stats.authenticatedConnections++;
        
        this.sendToConnection(connection, {
          type: 'auth_response',
          id: message.id,
          success: true,
        });
        
        console.log(`[WSServer] Connection authenticated: ${connection.id}`);
      } else {
        this.sendError(connection, 'AUTH_FAILED', 'Invalid token', {
          id: message.id,
        });
        
        // 关闭未认证的连接
        setTimeout(() => {
          if (!connection.authenticated) {
            connection.ws.close(1008, 'Authentication failed');
          }
        }, 5000);
      }
    } catch (err) {
      console.error('[WSServer] Auth error:', err);
      this.sendError(connection, 'INTERNAL_ERROR', 'Authentication failed');
    }
  }
  
  /**
   * 处理订阅
   */
  private handleSubscribe(connection: WSConnection, message: SubscribeMessage): void {
    if (!connection.authenticated) {
      this.sendError(connection, 'AUTH_FAILED', 'Not authenticated', {
        id: message.id,
      });
      return;
    }
    
    const subscriptionIds: string[] = [];
    
    for (const pattern of message.patterns) {
      const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      connection.subscriptions.set(subId, pattern);
      subscriptionIds.push(subId);
      this.stats.totalSubscriptions++;
    }
    
    // 确认订阅
    this.sendToConnection(connection, {
      type: 'auth_response',
      id: message.id,
      success: true,
      subscriptionIds,
    });
    
    console.log(`[WSServer] Subscribed ${subscriptionIds.length} patterns for ${connection.id}`);
  }
  
  /**
   * 处理取消订阅
   */
  private handleUnsubscribe(connection: WSConnection, message: UnsubscribeMessage): void {
    if (!connection.authenticated) {
      this.sendError(connection, 'AUTH_FAILED', 'Not authenticated', {
        id: message.id,
      });
      return;
    }
    
    let removedCount = 0;
    
    for (const subId of message.subscriptionIds) {
      if (connection.subscriptions.delete(subId)) {
        removedCount++;
        this.stats.totalSubscriptions--;
      }
    }
    
    // 确认取消订阅
    this.sendToConnection(connection, {
      type: 'auth_response',
      id: message.id,
      success: true,
    });
    
    console.log(`[WSServer] Unsubscribed ${removedCount} patterns for ${connection.id}`);
  }
  
  /**
   * 处理心跳
   */
  private handleHeartbeat(connection: WSConnection, message: HeartbeatMessage): void {
    connection.lastHeartbeat = Date.now();
    
    // 回复心跳
    this.sendToConnection(connection, {
      type: 'heartbeat',
      id: message.id,
      timestamp: Date.now(),
    });
  }
  
  /**
   * 处理连接关闭
   */
  private handleClose(connection: WSConnection, code: number, reason: string): void {
    // 清理订阅
    this.stats.totalSubscriptions -= connection.subscriptions.size;
    connection.subscriptions.clear();
    
    // 移除连接
    this.connections.delete(connection.id);
    this.stats.totalConnections--;
    
    if (connection.authenticated) {
      this.stats.authenticatedConnections--;
    }
    
    console.log(`[WSServer] Connection closed: ${connection.id} (code: ${code}, reason: ${reason})`);
  }
  
  /**
   * 发送消息到连接
   */
  private sendToConnection(connection: WSConnection, message: WSMessage): void {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        const json = serializeMessage(message);
        connection.ws.send(json);
        this.stats.messagesSent++;
      } catch (err) {
        console.error(`[WSServer] Failed to send message to ${connection.id}:`, err);
        this.stats.errors++;
      }
    }
  }
  
  /**
   * 发送错误消息
   */
  private sendError(
    connection: WSConnection,
    code: Parameters<typeof createErrorMessage>[0],
    message: string,
    extra?: Record<string, unknown>
  ): void {
    const errorMsg = createErrorMessage(code, message);
    
    if (extra) {
      Object.assign(errorMsg, extra);
    }
    
    this.sendToConnection(connection, errorMsg);
  }
  
  /**
   * 查找订阅者
   */
  private findSubscribers(eventType: string): WSConnection[] {
    const subscribers: WSConnection[] = [];
    
    for (const conn of this.connections.values()) {
      if (!conn.authenticated) continue;
      
      for (const pattern of conn.subscriptions.values()) {
        if (this.matchesPattern(eventType, pattern)) {
          subscribers.push(conn);
          break; // 避免重复添加
        }
      }
    }
    
    return subscribers;
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
  
  /**
   * 检查跨域
   */
  private checkOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    
    if (!origin) {
      return true; // 非浏览器请求
    }
    
    if (this.options.allowOrigins.includes('*')) {
      return true;
    }
    
    return this.options.allowOrigins.includes(origin);
  }
  
  /**
   * 默认认证函数
   */
  private async defaultAuthenticate(token: string): Promise<boolean> {
    // 简单实现：检查令牌是否为空
    // 实际应用中应该查询数据库或调用认证服务
    return token.length > 0;
  }
  
  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.heartbeatTimeout;
      
      for (const conn of this.connections.values()) {
        if (now - conn.lastHeartbeat > timeout) {
          // 心跳超时，关闭连接
          console.log(`[WSServer] Heartbeat timeout for ${conn.id}`);
          conn.ws.close(1001, 'Heartbeat timeout');
        } else {
          // 发送心跳 ping
          if (conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.ping();
          }
        }
      }
    }, this.options.heartbeatInterval);
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 WebSocket 服务器
 */
export function createWSServer(options: WSServerOptions = {}): WSServer {
  return new WSServer(options);
}
