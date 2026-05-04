# 助手统一通讯层

## 📖 概述

助手的统一通讯层提供消息总线、消息标准化和事件持久化功能，将所有渠道消息和治理层事件统一管理。

## 🏗️ 架构

```
┌─────────────────────────────────────────────┐
│          MessageBus (消息总线)               │
│  - 发布/订阅模式                             │
│  - 通配符支持                                │
│  - 历史记录                                  │
│  - 事件回放                                  │
└──────────────┬──────────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
┌────▼─────┐      ┌──────▼──────┐
│ Channel  │      │ Governance  │
│ Messages │      │ Events      │
└────┬─────┘      └──────┬──────┘
     │                    │
     └─────────┬──────────┘
               │
     ┌─────────▼──────────┐
     │ MessageNormalizer  │
     │ (消息标准化器)      │
     └─────────┬──────────┘
               │
     ┌─────────▼──────────┐
     │   EventStore       │
     │ (事件持久化存储)    │
     └────────────────────┘
```

## 🚀 快速开始

### 1. 获取消息总线实例

```typescript
import { getMessageBus } from '@zhushou/communication';

const bus = getMessageBus();
```

### 2. 订阅事件

```typescript
// 订阅特定事件
bus.subscribe('channel.message.inbound', (event) => {
  console.log('收到入站消息:', event.payload);
});

// 使用通配符订阅一组事件
bus.subscribe('governance.*', (event) => {
  console.log('治理层事件:', event.type, event.payload);
});

// 订阅所有事件
bus.subscribe('*', (event) => {
  console.log('所有事件:', event.type);
});
```

### 3. 发布事件

```typescript
await bus.publish({
  type: 'channel.message.inbound',
  source: {
    type: 'channel',
    id: 'telegram-bot-1',
    name: 'Telegram',
  },
  payload: {
    text: 'Hello, World!',
    sender: 'user123',
  },
  metadata: {
    priority: 'normal',
    tags: ['message', 'inbound'],
  },
});
```

### 4. WebSocket 实时通信

#### 服务器端

```typescript
import http from 'node:http';
import { createWSServer, getMessageBus } from '@zhushou/communication';

// 创建 HTTP 服务器
const httpServer = http.createServer();

// 创建 WebSocket 服务器
const wsServer = createWSServer({
  httpServer,
  path: '/ws',
  authenticate: async (token) => {
    // 验证令牌
    return token === 'your-secret-token';
  },
});

// 启动 HTTP 服务器
httpServer.listen(18789, () => {
  console.log('WebSocket server running on ws://localhost:18789/ws');
});

// 将消息总线事件广播到 WebSocket 客户端
const bus = getMessageBus();
bus.subscribe('*', async (event) => {
  await wsServer.broadcast(event);
});
```

#### 客户端

```typescript
import { createWSClient } from '@zhushou/communication';

// 创建客户端
const client = createWSClient({
  autoReconnect: true,
  maxReconnectAttempts: 10,
});

// 连接服务器
await client.connect('ws://localhost:18789/ws', 'your-secret-token');

// 订阅事件
client.subscribe('governance.*', (event) => {
  console.log('收到治理层事件:', event.type);
});

// 订阅所有事件
client.subscribe('*', (event) => {
  console.log('收到事件:', event.type, event.payload);
});

// 断开连接
await client.disconnect();
```

### 5. 查询历史事件

```
// 获取最近 100 个事件
const history = bus.getHistory({ limit: 100 });

// 按类型过滤
const governanceEvents = bus.getHistory({
  types: ['governance.proposal.created', 'governance.sandbox.stage.changed'],
});

// 按时间范围过滤
const recentEvents = bus.getHistory({
  startTime: Date.now() - 3600000, // 最近 1 小时
  endTime: Date.now(),
});

// 分页
const page1 = bus.getHistory({ limit: 50, offset: 0 });
const page2 = bus.getHistory({ limit: 50, offset: 50 });
```

### 6. 回放历史事件

```
// 回放所有历史事件
await bus.replay({}, (event) => {
  console.log('回放事件:', event.type);
});

// 带延迟的回放（用于演示或测试）
await bus.replay(
  { delayMs: 100, batchSize: 10 },
  (event) => {
    console.log('回放事件:', event.type);
  }
);
```

## 📦 模块说明

### MessageBus (消息总线)

核心消息发布订阅系统。

**主要功能**:
- ✅ 发布/订阅模式
- ✅ 通配符支持 (`governance.*`, `*`)
- ✅ 历史记录（可配置大小）
- ✅ 事件回放
- ✅ 统计信息
- ✅ 自动清理过期事件

**API**:
```typescript
class MessageBus {
  publish(event): Promise<void>
  subscribe(pattern, handler): Subscription
  unsubscribe(subscriptionId): void
  getHistory(filter): BusEvent[]
  replay(filter, handler): Promise<void>
  cleanup(): void
  getStats(): Stats
}
```

### MessageNormalizer (消息标准化器)

将不同渠道的消息格式统一为标准化的 `NormalizedMessage` 格式。

**支持的渠道**:
- Matrix
- Slack
- Discord
- Telegram
- WhatsApp
- 飞书 (Feishu)
- LINE

**使用示例**:
```typescript
import { getMessageNormalizer } from '@zhushou/communication';

const normalizer = getMessageNormalizer();

// 标准化 Telegram 消息
const normalized = normalizer.normalize(rawTelegramMessage, 'telegram');

console.log(normalized.content.text);
console.log(normalized.sender.name);
console.log(normalized.attachments);
```

### EventStore (事件持久化存储)

将事件持久化到 SQLite 或内存存储。

**实现**:
- `SQLiteEventStore`: 基于 better-sqlite3 的持久化存储
- `InMemoryEventStore`: 内存存储（用于测试）

**使用示例**:
```typescript
import { createEventStore } from '@zhushou/communication';

const store = await createEventStore({
  storagePath: './state/events.db',
  maxEvents: 100000,
  enableIndexing: true,
});

// 存储事件
await store.store(event);

// 查询事件
const events = await store.query({
  types: ['governance.*'],
  limit: 50,
});

// 获取统计信息
const stats = await store.getStats();
```

## 🎯 事件类型

### 渠道消息事件
- `channel.message.inbound` - 渠道入站消息
- `channel.message.outbound` - 渠道出站消息
- `channel.message.deleted` - 消息删除
- `channel.message.updated` - 消息更新

### 网关会话事件
- `gateway.session.created` - 会话创建
- `gateway.session.closed` - 会话关闭
- `gateway.session.activity` - 会话活动

### 治理层事件
- `governance.proposal.created` - 提案创建
- `governance.proposal.updated` - 提案更新
- `governance.sandbox.experiment.created` - 沙盒实验创建
- `governance.sandbox.stage.changed` - 沙盒阶段变更
- `governance.promotion.completed` - 提升完成
- `governance.promotion.rejected` - 提升拒绝
- `governance.freeze.activated` - 冻结激活
- `governance.freeze.released` - 冻结释放

### Genesis Team 事件
- `genesis.sentinel.gap.detected` - Sentinel 检测到缺口
- `genesis.archaeologist.analysis.completed` - Archaeologist 分析完成
- `genesis.tdd.candidate.built` - TDD 候选方案构建完成
- `genesis.qa.validation.started` - QA 验证开始
- `genesis.qa.validation.completed` - QA 验证完成
- `genesis.publisher.promotion.completed` - Publisher 提升完成

### 系统事件
- `system.health.check` - 健康检查
- `system.config.reload` - 配置重载
- `system.plugin.loaded` - 插件加载
- `system.error` - 系统错误
- `system.warning` - 系统警告

## 🔧 便捷函数

### 渠道消息
```typescript
import { 
  publishChannelInboundMessage,
  publishChannelOutboundMessage,
} from '@zhushou/communication';

// 发布入站消息
await publishChannelInboundMessage(
  'telegram-bot-1',
  { text: 'Hello' },
  'telegram'
);

// 发布出站消息
await publishChannelOutboundMessage(
  'telegram-bot-1',
  { text: 'Hi there!' },
  'telegram'
);
```

### 治理层事件
```typescript
import {
  publishGovernanceProposal,
  publishSandboxStageChanged,
  publishFreezeActivated,
  publishSentinelGapDetected,
} from '@zhushou/communication';

// 发布提案事件
await publishGovernanceProposal('prop-123', {
  title: 'New Feature',
  description: 'Add new capability',
});

// 发布沙盒阶段变更
await publishSandboxStageChanged(
  'universe-456',
  'proposed',
  'provisioning'
);

// 发布冻结激活
await publishFreezeActivated(
  'Security breach detected',
  ['evolution', 'capability']
);

// 发布 Sentinel 缺口检测
await publishSentinelGapDetected(
  'gap-789',
  'Missing error handling in module X'
);
```

## 📊 统计信息

```
const stats = bus.getStats();

console.log('总事件数:', stats.totalEvents);
console.log('活跃订阅:', stats.activeSubscriptions);
console.log('事件类型分布:', stats.eventTypes);
```

输出示例:
```
总事件数: 1234
活跃订阅: 5
事件类型分布:
  - channel.message.inbound: 500
  - governance.proposal.created: 50
  - system.health.check: 684
```

## ⚙️ 配置选项

### MessageBus 选项
```typescript
const bus = new MessageBus({
  enablePersistence: true,        // 是否启用持久化
  persistencePath: './state/bus', // 持久化路径
  maxHistorySize: 50000,          // 最大历史记录数
  eventTTL: 24 * 60 * 60 * 1000,  // 事件过期时间（24小时）
});
```

### EventStore 选项
```typescript
const store = await createEventStore({
  storagePath: './state/events.db', // 存储路径
  maxEvents: 100000,                // 最大事件数
  enableIndexing: true,             // 是否启用索引
  indexFields: ['type', 'timestamp'], // 索引字段
});
```

## 🧪 测试

运行验证脚本:
```
npx tsx src/communication/verify-message-bus.ts
```

运行单元测试:
```
pnpm test src/communication/message-bus.test.ts
```

## 📝 最佳实践

### 1. 使用有意义的订阅模式

```
// ✅ 好：精确订阅
bus.subscribe('governance.freeze.activated', handler);

// ✅ 好：相关事件组
bus.subscribe('governance.*', handler);

// ❌ 避免：过于宽泛的订阅（除非必要）
bus.subscribe('*', handler);
```

### 2. 处理异步错误

```
bus.subscribe('test.event', async (event) => {
  try {
    await processEvent(event);
  } catch (err) {
    console.error('处理事件失败:', err);
  }
});
```

### 3. 及时取消订阅

```
const subscription = bus.subscribe('test.event', handler);

// 当不再需要时
subscription.unsubscribe();
```

### 4. 使用元数据进行追踪

```
await bus.publish({
  type: 'test.event',
  source: { type: 'system', id: 'test' },
  payload: {},
  metadata: {
    correlationId: 'req-123',  // 关联ID
    traceId: 'trace-456',      // 追踪ID
    priority: 'high',          // 优先级
    tags: ['important'],       // 标签
  },
});
```

### 5. 定期清理过期事件

```
// 每天清理一次
setInterval(() => {
  bus.cleanup();
}, 24 * 60 * 60 * 1000);
```

## 🔮 未来计划

- [x] WebSocket 实时推送 ✅ **已完成**
- [x] 客户端 SDK ✅ **已完成**
- [ ] 事件流式处理
- [ ] 高级查询（全文搜索）
- [ ] 事件聚合和统计
- [ ] 可视化 Dashboard

## 📚 相关文档

- [通讯层与前端重构方案](./communication-and-frontend-refactor-plan.md)
- [制度化系统重构方案](./institutional-system-refactor-plan.md)
