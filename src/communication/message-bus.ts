/**
 * 助手统一消息总线
 * 
 * 提供统一的消息发布订阅系统，将所有渠道消息和治理层事件标准化
 */

import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import type { ChannelType } from '../channels/chat-type.js';

// ==================== 类型定义 ====================

/**
 * 事件类型枚举
 */
export type EventType =
  // 渠道消息事件
  | 'channel.message.inbound'      // 渠道入站消息
  | 'channel.message.outbound'     // 渠道出站消息
  | 'channel.message.deleted'      // 消息删除
  | 'channel.message.updated'      // 消息更新
  
  // 网关会话事件
  | 'gateway.session.created'      // 会话创建
  | 'gateway.session.closed'       // 会话关闭
  | 'gateway.session.activity'     // 会话活动
  
  // 治理层事件
  | 'governance.proposal.created'   // 提案创建
  | 'governance.proposal.updated'   // 提案更新
  | 'governance.sandbox.experiment.created'    // 沙盒实验创建
  | 'governance.sandbox.stage.changed'         // 沙盒阶段变更
  | 'governance.promotion.completed'           // 提升完成
  | 'governance.promotion.rejected'            // 提升拒绝
  | 'governance.freeze.activated'   // 冻结激活
  | 'governance.freeze.released'    // 冻结释放
  
  // Genesis Team 事件
  | 'genesis.sentinel.gap.detected'          // Sentinel 检测到缺口
  | 'genesis.archaeologist.analysis.completed' // Archaeologist 分析完成
  | 'genesis.tdd.candidate.built'            // TDD 候选方案构建完成
  | 'genesis.qa.validation.started'          // QA 验证开始
  | 'genesis.qa.validation.completed'        // QA 验证完成
  | 'genesis.publisher.promotion.completed'  // Publisher 提升完成
  
  // 系统事件
  | 'system.health.check'          // 健康检查
  | 'system.config.reload'         // 配置重载
  | 'system.plugin.loaded'         // 插件加载
  | 'system.error'                 // 系统错误
  | 'system.warning';              // 系统警告

/**
 * 事件来源
 */
export interface EventSource {
  type: 'channel' | 'gateway' | 'governance' | 'genesis' | 'system';
  id: string;
  name?: string;
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  correlationId?: string;
  traceId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  [key: string]: unknown;
}

/**
 * 总线事件
 */
export interface BusEvent {
  id: string;                    // 事件唯一ID
  type: EventType;               // 事件类型
  timestamp: number;             // 时间戳（毫秒）
  source: EventSource;           // 事件来源
  payload: unknown;              // 事件载荷
  metadata?: EventMetadata;      // 元数据
}

/**
 * 事件处理器
 */
export type EventHandler = (event: BusEvent) => void | Promise<void>;

/**
 * 事件模式（支持通配符）
 * 例如: 'governance.*', 'channel.message.*', '*'
 */
export type EventPattern = string;

/**
 * 订阅对象
 */
export interface Subscription {
  id: string;
  pattern: EventPattern;
  handler: EventHandler;
  unsubscribe: () => void;
}

/**
 * 历史过滤器
 */
export interface HistoryFilter {
  types?: EventType[];
  sources?: EventSource[];
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * 回放过滤器
 */
export interface ReplayFilter extends HistoryFilter {
  batchSize?: number;
  delayMs?: number;
}

/**
 * 广播过滤器
 */
export interface BroadcastFilter {
  excludeSubscriptions?: string[];
  includeOnlyTypes?: EventType[];
}

// ==================== 工具函数 ====================

/**
 * 生成唯一事件ID
 */
function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `evt_${timestamp}_${random}`;
}

/**
 * 生成唯一订阅ID
 */
function generateSubscriptionId(): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `sub_${random}`;
}

/**
 * 检查事件是否匹配模式
 * 支持通配符: 'governance.*', 'channel.message.*', '*'
 */
function matchesPattern(eventType: EventType, pattern: EventPattern): boolean {
  if (pattern === '*') {
    return true;
  }
  
  // 精确匹配
  if (pattern === eventType) {
    return true;
  }
  
  // 通配符匹配
  if (pattern.includes('*')) {
    // 将通配符转换为正则表达式
    // * 应该匹配任意字符（包括点号）
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // 转义点号
      .replace(/\*/g, '.+');   // * 匹配一个或多个任意字符
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }
  
  return false;
}

// ==================== 消息总线实现 ====================

/**
 * 消息总线选项
 */
export interface MessageBusOptions {
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 持久化存储路径 */
  persistencePath?: string;
  /** 最大历史事件数 */
  maxHistorySize?: number;
  /** 事件过期时间（毫秒） */
  eventTTL?: number;
}

/**
 * 消息总线类
 * 
 * 提供统一的消息发布订阅系统
 */
export class MessageBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, Subscription>;
  private history: BusEvent[];
  private options: Required<MessageBusOptions>;
  private persistenceStore?: any; // TODO: 实现持久化存储
  
  constructor(options: MessageBusOptions = {}) {
    this.emitter = new EventEmitter();
    this.subscriptions = new Map();
    this.history = [];
    
    // 默认选项
    this.options = {
      enablePersistence: options.enablePersistence ?? false,
      persistencePath: options.persistencePath ?? './state/message-bus',
      maxHistorySize: options.maxHistorySize ?? 10000,
      eventTTL: options.eventTTL ?? 24 * 60 * 60 * 1000, // 24小时
    };
    
    // 设置最大监听器数量
    this.emitter.setMaxListeners(1000);
  }
  
  /**
   * 发布事件
   */
  async publish(event: Omit<BusEvent, 'id' | 'timestamp'> & { timestamp?: number }): Promise<void> {
    const busEvent: BusEvent = {
      ...event,
      id: generateEventId(),
      timestamp: event.timestamp ?? Date.now(),
    };
    
    // 添加到历史记录
    this.addToHistory(busEvent);
    
    // 持久化（如果启用）
    if (this.options.enablePersistence) {
      await this.persistEvent(busEvent);
    }
    
    // 触发所有匹配的订阅者
    this.emitToSubscribers(busEvent);
    
    // 也触发原生 EventEmitter（用于内部使用）
    this.emitter.emit(busEvent.type, busEvent);
  }
  
  /**
   * 订阅事件
   */
  subscribe(pattern: EventPattern, handler: EventHandler): Subscription {
    const subscription: Subscription = {
      id: generateSubscriptionId(),
      pattern,
      handler,
      unsubscribe: () => this.unsubscribe(subscription.id),
    };
    
    this.subscriptions.set(subscription.id, subscription);
    
    return subscription;
  }
  
  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }
  
  /**
   * 获取历史事件
   */
  getHistory(filter: HistoryFilter = {}): BusEvent[] {
    let events = [...this.history];
    
    // 按类型过滤
    if (filter.types && filter.types.length > 0) {
      events = events.filter(e => filter.types!.includes(e.type));
    }
    
    // 按来源过滤
    if (filter.sources && filter.sources.length > 0) {
      events = events.filter(e => 
        filter.sources!.some(s => 
          s.type === e.source.type && s.id === e.source.id
        )
      );
    }
    
    // 按时间范围过滤
    if (filter.startTime) {
      events = events.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      events = events.filter(e => e.timestamp <= filter.endTime!);
    }
    
    // 排序（最新的在前）
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return events.slice(offset, offset + limit);
  }
  
  /**
   * 回放历史事件
   */
  async replay(filter: ReplayFilter, handler: EventHandler): Promise<void> {
    const events = this.getHistory(filter);
    const batchSize = filter.batchSize ?? 100;
    const delayMs = filter.delayMs ?? 0;
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      for (const event of batch) {
        await handler(event);
        
        // 延迟（如果需要）
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  }
  
  /**
   * 清理过期事件
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.options.eventTTL;
    
    this.history = this.history.filter(e => e.timestamp > cutoff);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalEvents: this.history.length,
      activeSubscriptions: this.subscriptions.size,
      eventTypes: this.getEventTypeCounts(),
    };
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 添加到历史记录
   */
  private addToHistory(event: BusEvent): void {
    this.history.push(event);
    
    // 限制历史记录大小
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }
  
  /**
   * 持久化事件
   */
  private async persistEvent(event: BusEvent): Promise<void> {
    // TODO: 实现持久化逻辑
    // 可以保存到 SQLite、LanceDB 或文件系统
    console.log('[MessageBus] Persisting event:', event.id);
  }
  
  /**
   * 触发订阅者
   */
  private emitToSubscribers(event: BusEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (matchesPattern(event.type, subscription.pattern)) {
        try {
          const result = subscription.handler(event);
          
          // 如果是 Promise，捕获错误
          if (result instanceof Promise) {
            result.catch(err => {
              console.error(`[MessageBus] Error in subscriber ${subscription.id}:`, err);
            });
          }
        } catch (err) {
          console.error(`[MessageBus] Error in subscriber ${subscription.id}:`, err);
        }
      }
    }
  }
  
  /**
   * 获取事件类型计数
   */
  private getEventTypeCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of this.history) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    
    return counts;
  }
}

// ==================== 单例实例 ====================

/**
 * 全局消息总线实例
 */
let globalMessageBus: MessageBus | null = null;

/**
 * 获取全局消息总线实例
 */
export function getMessageBus(): MessageBus {
  if (!globalMessageBus) {
    globalMessageBus = new MessageBus({
      enablePersistence: true,
      maxHistorySize: 50000,
    });
  }
  
  return globalMessageBus;
}

/**
 * 重置全局消息总线（用于测试）
 */
export function resetMessageBus(): void {
  globalMessageBus = null;
}

// ==================== 便捷函数 ====================

/**
 * 发布渠道入站消息事件
 */
export async function publishChannelInboundMessage(
  channelId: string,
  message: any,
  channelType: ChannelType
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'channel.message.inbound',
    source: {
      type: 'channel',
      id: channelId,
      name: channelType,
    },
    payload: message,
    metadata: {
      priority: 'normal',
      tags: ['channel', 'inbound'],
    },
  });
}

/**
 * 发布渠道出站消息事件
 */
export async function publishChannelOutboundMessage(
  channelId: string,
  message: any,
  channelType: ChannelType
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'channel.message.outbound',
    source: {
      type: 'channel',
      id: channelId,
      name: channelType,
    },
    payload: message,
    metadata: {
      priority: 'normal',
      tags: ['channel', 'outbound'],
    },
  });
}

/**
 * 发布治理层提案事件
 */
export async function publishGovernanceProposal(
  proposalId: string,
  proposal: any
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'governance.proposal.created',
    source: {
      type: 'governance',
      id: 'proposal-system',
      name: 'Proposal System',
    },
    payload: { proposalId, proposal },
    metadata: {
      priority: 'high',
      tags: ['governance', 'proposal'],
      correlationId: proposalId,
    },
  });
}

/**
 * 发布沙盒实验阶段变更事件
 */
export async function publishSandboxStageChanged(
  universeId: string,
  fromStage: string,
  toStage: string
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'governance.sandbox.stage.changed',
    source: {
      type: 'governance',
      id: universeId,
      name: `Sandbox ${universeId}`,
    },
    payload: { universeId, fromStage, toStage },
    metadata: {
      priority: 'high',
      tags: ['governance', 'sandbox'],
      correlationId: universeId,
    },
  });
}

/**
 * 发布冻结激活事件
 */
export async function publishFreezeActivated(
  reason: string,
  affectedSubsystems: string[]
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'governance.freeze.activated',
    source: {
      type: 'governance',
      id: 'sovereignty-auditor',
      name: 'Sovereignty Auditor',
    },
    payload: { reason, affectedSubsystems, activatedAt: Date.now() },
    metadata: {
      priority: 'critical',
      tags: ['governance', 'freeze', 'security'],
    },
  });
}

/**
 * 发布 Sentinel 检测到缺口事件
 */
export async function publishSentinelGapDetected(
  gapId: string,
  gapDescription: string
): Promise<void> {
  const bus = getMessageBus();
  
  await bus.publish({
    type: 'genesis.sentinel.gap.detected',
    source: {
      type: 'genesis',
      id: 'sentinel',
      name: 'Sentinel',
    },
    payload: { gapId, gapDescription, detectedAt: Date.now() },
    metadata: {
      priority: 'high',
      tags: ['genesis', 'sentinel', 'gap'],
      correlationId: gapId,
    },
  });
}
