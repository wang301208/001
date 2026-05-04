/**
 * 助手统一通讯层
 * 
 * 提供消息总线、消息标准化、事件持久化和 WebSocket 实时通信功能
 */

// 消息总线
export {
  MessageBus,
  type MessageBusOptions,
  type BusEvent,
  type EventType,
  type EventSource,
  type EventMetadata,
  type EventHandler,
  type EventPattern,
  type Subscription,
  type HistoryFilter,
  type ReplayFilter,
  type BroadcastFilter,
  getMessageBus,
  resetMessageBus,
  // 便捷函数
  publishChannelInboundMessage,
  publishChannelOutboundMessage,
  publishGovernanceProposal,
  publishSandboxStageChanged,
  publishFreezeActivated,
  publishSentinelGapDetected,
} from './message-bus.js';

// 消息标准化
export {
  MessageNormalizer,
  type NormalizedMessage,
  type MessageSender,
  type MessageContent,
  type MessageContentType,
  type MessageAttachment,
  type RawChannelMessage,
  getMessageNormalizer,
  resetMessageNormalizer,
} from './message-normalizer.js';

// 事件存储
export {
  type EventStore,
  type EventStoreOptions,
  type EventStoreStats,
  SQLiteEventStore,
  InMemoryEventStore,
  createEventStore,
} from './event-store.js';

// WebSocket 协议
export {
  type WSMessage,
  type WSMessageType,
  type SubscribeMessage,
  type UnsubscribeMessage,
  type EventMessage,
  type HeartbeatMessage,
  type AuthMessage,
  type AuthResponse,
  type ErrorMessage,
  type WSErrorCode,
  validateWSMessage,
  serializeMessage,
  deserializeMessage,
  generateMessageId,
  createSubscribeMessage,
  createUnsubscribeMessage,
  createHeartbeatMessage,
  createAuthMessage,
  createErrorMessage,
} from './ws-protocol.js';

// WebSocket 服务器
export {
  WSServer,
  type WSServerOptions,
  type WSServerStats,
  createWSServer,
} from './ws-server.js';

// WebSocket 客户端
export {
  WSClient,
  type WSClientOptions,
  type ClientSubscription,
  type ClientState,
  createWSClient,
} from './ws-client.js';
