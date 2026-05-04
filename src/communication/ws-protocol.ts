/**
 * WebSocket 订阅协议定义
 * 
 * 定义客户端与服务器之间的消息格式
 */

import type { BusEvent } from './message-bus.js';

// ==================== 消息类型 ====================

/**
 * WebSocket 消息类型
 */
export type WSMessageType =
  | 'subscribe'      // 订阅请求
  | 'unsubscribe'    // 取消订阅
  | 'event'          // 事件推送
  | 'heartbeat'      // 心跳
  | 'error'          // 错误
  | 'auth'           // 认证
  | 'auth_response'; // 认证响应

// ==================== 基础消息接口 ====================

/**
 * WebSocket 基础消息
 */
export interface WSBaseMessage {
  type: WSMessageType;
  id?: string; // 请求ID（用于匹配请求和响应）
}

// ==================== 订阅相关消息 ====================

/**
 * 订阅请求
 */
export interface SubscribeMessage extends WSBaseMessage {
  type: 'subscribe';
  patterns: string[]; // 订阅模式列表，支持通配符
}

/**
 * 取消订阅请求
 */
export interface UnsubscribeMessage extends WSBaseMessage {
  type: 'unsubscribe';
  subscriptionIds: string[]; // 要取消的订阅ID列表
}

/**
 * 订阅确认
 */
export interface SubscribeResponse extends WSBaseMessage {
  type: 'auth_response'; // 复用 auth_response 类型
  success: boolean;
  subscriptionIds: string[]; // 新创建的订阅ID列表
  error?: string;
}

// ==================== 事件推送消息 ====================

/**
 * 事件推送消息
 */
export interface EventMessage extends WSBaseMessage {
  type: 'event';
  event: BusEvent;
}

// ==================== 心跳消息 ====================

/**
 * 心跳请求/响应
 */
export interface HeartbeatMessage extends WSBaseMessage {
  type: 'heartbeat';
  timestamp: number; // Unix 时间戳（毫秒）
}

// ==================== 认证消息 ====================

/**
 * 认证请求
 */
export interface AuthMessage extends WSBaseMessage {
  type: 'auth';
  token: string; // 认证令牌
}

/**
 * 认证响应
 */
export interface AuthResponse extends WSBaseMessage {
  type: 'auth_response';
  success: boolean;
  error?: string;
  expiresIn?: number; // 令牌过期时间（秒）
}

// ==================== 错误消息 ====================

/**
 * 错误码
 */
export type WSErrorCode =
  | 'INVALID_MESSAGE'      // 无效消息格式
  | 'AUTH_FAILED'          // 认证失败
  | 'AUTH_EXPIRED'         // 认证过期
  | 'SUBSCRIPTION_FAILED'  // 订阅失败
  | 'UNSUBSCRIPTION_FAILED' // 取消订阅失败
  | 'RATE_LIMITED'         // 速率限制
  | 'INTERNAL_ERROR';      // 内部错误

/**
 * 错误消息
 */
export interface ErrorMessage extends WSBaseMessage {
  type: 'error';
  code: WSErrorCode;
  message: string;
  details?: unknown;
}

// ==================== 联合类型 ====================

/**
 * 所有 WebSocket 消息类型
 */
export type WSMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | EventMessage
  | HeartbeatMessage
  | AuthMessage
  | AuthResponse
  | ErrorMessage;

// ==================== 工具函数 ====================

/**
 * 生成唯一消息ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `msg_${timestamp}_${random}`;
}

/**
 * 创建订阅消息
 */
export function createSubscribeMessage(patterns: string[]): SubscribeMessage {
  return {
    type: 'subscribe',
    id: generateMessageId(),
    patterns,
  };
}

/**
 * 创建取消订阅消息
 */
export function createUnsubscribeMessage(subscriptionIds: string[]): UnsubscribeMessage {
  return {
    type: 'unsubscribe',
    id: generateMessageId(),
    subscriptionIds,
  };
}

/**
 * 创建心跳消息
 */
export function createHeartbeatMessage(): HeartbeatMessage {
  return {
    type: 'heartbeat',
    id: generateMessageId(),
    timestamp: Date.now(),
  };
}

/**
 * 创建认证消息
 */
export function createAuthMessage(token: string): AuthMessage {
  return {
    type: 'auth',
    id: generateMessageId(),
    token,
  };
}

/**
 * 创建错误消息
 */
export function createErrorMessage(
  code: WSErrorCode,
  message: string,
  details?: unknown
): ErrorMessage {
  return {
    type: 'error',
    id: generateMessageId(),
    code,
    message,
    details,
  };
}

/**
 * 验证消息格式
 */
export function validateWSMessage(msg: unknown): msg is WSMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }
  
  const message = msg as Record<string, unknown>;
  
  // 必须有 type 字段
  if (typeof message.type !== 'string') {
    return false;
  }
  
  // 验证具体类型
  switch (message.type) {
    case 'subscribe':
      return Array.isArray(message.patterns);
    
    case 'unsubscribe':
      return Array.isArray(message.subscriptionIds);
    
    case 'event':
      return typeof message.event === 'object' && message.event !== null;
    
    case 'heartbeat':
      return typeof message.timestamp === 'number';
    
    case 'auth':
      return typeof message.token === 'string';
    
    case 'auth_response':
      return typeof message.success === 'boolean';
    
    case 'error':
      return typeof message.code === 'string' && typeof message.message === 'string';
    
    default:
      return false;
  }
}

/**
 * 序列化消息为 JSON 字符串
 */
export function serializeMessage(msg: WSMessage): string {
  return JSON.stringify(msg);
}

/**
 * 反序列化 JSON 字符串为消息
 */
export function deserializeMessage(json: string): WSMessage | null {
  try {
    const msg = JSON.parse(json);
    if (validateWSMessage(msg)) {
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}
