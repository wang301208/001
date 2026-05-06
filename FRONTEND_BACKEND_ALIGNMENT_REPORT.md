# 前后端功能对比与对齐分析报告

**生成时间**: 2026-05-06  
**版本**: 1.0  
**状态**: 初稿

---

## 一、概述

本报告旨在梳理"助手"（Zhushou）项目的前后端功能对应关系，检查数据接口的一致性，发现并解决前后端交互中的问题。

### 技术栈

- **前端**: React + TypeScript + Vite + Mantine UI + Zustand
- **后端**: Node.js + TypeScript + WebSocket RPC
- **通信协议**: JSON-RPC over WebSocket

---

## 二、前端页面功能需求梳理

### 2.1 DashboardPage（仪表盘）

**功能需求**:
- 显示系统整体状态概览
- 展示渠道连接状态统计
- 显示运行任务数量
- 实时图表展示（趋势图、柱状图、饼图等）

**调用的 API**:
```typescript
// 1. 获取治理状态
apiService.getGovernanceStatus() 
  → RPC: governance.overview

// 2. 获取渠道列表
apiService.getChannels() 
  → RPC: channels.status

// 3. 健康检查
apiService.healthCheck() 
  → RPC: health
```

**期望的数据结构**:
```typescript
interface GovernanceStatus {
  sovereigntyBoundary: boolean;
  activeAgents: AgentNode[];
  evolutionProjects: EvolutionProject[];
  sandboxExperiments: SandboxExperiment[];
  freezeActive: boolean;
  freezeStatus?: FreezeStatus;
}

interface ChannelInfo {
  id: string;
  type: string;
  name: string;
  connected: boolean;
  status?: string;
}
```

---

### 2.2 ChatPage（聊天页面）

**功能需求**:
- 会话管理（创建、切换、删除）
- 消息发送与接收
- 实时消息推送
- 对话历史加载

**调用的 API**:
```typescript
// 1. 获取会话列表
apiService.getSessions(limit) 
  → RPC: sessions.list

// 2. 创建新会话
apiService.createSession(title) 
  → RPC: sessions.create

// 3. 获取会话消息
apiService.getSessionMessages(sessionId, limit) 
  → RPC: sessions.get (注意：此方法可能不存在)

// 4. 发送消息
apiService.sendMessage(sessionId, message) 
  → RPC: chat.send

// 5. 中止对话
apiService.abortChat(sessionId) 
  → RPC: chat.abort

// WebSocket 事件监听
wsManager.onEvent('session.message', callback)
```

---

### 2.3 ChannelsPage（渠道管理）

**功能需求**:
- 显示所有可用渠道列表
- 显示每个渠道的连接状态
- 支持连接/断开渠道
- 渠道配置管理

**调用的 API**:
```typescript
// 1. 获取渠道状态
apiService.getChannels() 
  → RPC: channels.status

// 2. 连接渠道
apiService.connectChannel(channelId) 
  → RPC: channels.connect (注意：此方法可能不存在)

// 3. 断开渠道
apiService.disconnectChannel(channelId) 
  → RPC: channels.logout
```

---

### 2.4 GovernancePage（治理监控）

**功能需求**:
- 显示代理拓扑图
- 显示演化项目列表
- 显示沙盒实验状态
- 显示冻结状态
- 提案管理（创建、审核、应用、回滚）

**调用的 API**:
```typescript
// 1. 获取治理概览
apiService.getGovernanceStatus() 
  → RPC: governance.overview

// 2. 获取提案列表
apiService.listProposals() 
  → RPC: governance.proposals.list

// 3. 创建提案
apiService.createProposal(proposal) 
  → RPC: governance.proposals.create

// 4. 审核提案
apiService.reviewProposal(proposalId, decision, comment) 
  → RPC: governance.proposals.review

// 5. 应用提案
apiService.applyProposal(proposalId) 
  → RPC: governance.proposals.apply

// 6. 回滚提案
apiService.revertProposal(proposalId) 
  → RPC: governance.proposals.revert

// WebSocket 实时更新
useGovernanceWebSocket()
```

---

### 2.5 SettingsPage（设置页面）

**功能需求**:
- 模型配置管理
- 系统配置管理
- 认证令牌管理
- 通知设置
- 外观设置

**调用的 API**:
```typescript
// 1. 获取模型列表
apiService.getModels() 
  → RPC: models.list

// 2. 获取配置
apiService.getConfig() 
  → RPC: config.get

// 3. 设置配置
apiService.setConfig(config, baseHash) 
  → RPC: config.set

// 4. 获取系统信息
apiService.getSystemInfo() 
  → RPC: gateway.identity.get

// 5. 重启系统
apiService.restartSystem() 
  → RPC: system.restart
```

---

## 三、后端 API 接口清单

### 3.1 核心 RPC 方法

根据 `src/gateway/server-methods-list.ts`，后端提供以下方法：

#### 系统与配置
- `health` - 健康检查
- `status` - 系统状态
- `usage.status` - 使用统计
- `usage.cost` - 成本统计
- `config.get` - 获取配置
- `config.set` - 设置配置
- `config.apply` - 应用配置
- `config.patch` - 补丁配置
- `gateway.identity.get` - 网关身份信息

#### 渠道管理
- `channels.status` - 获取渠道状态
- `channels.logout` - 登出渠道账户

#### 模型与工具
- `models.list` - 获取模型列表
- `models.authStatus` - 模型认证状态
- `tools.catalog` - 工具目录
- `tools.effective` - 有效工具

#### Agent 管理
- `agents.list` - 获取 Agent 列表
- `agents.create` - 创建 Agent
- `agents.update` - 更新 Agent
- `agents.delete` - 删除 Agent
- `agents.files.list` - 列出 Agent 文件
- `agents.files.get` - 获取 Agent 文件
- `agents.files.set` - 设置 Agent 文件

#### 会话管理
- `sessions.list` - 列出会话
- `sessions.create` - 创建会话
- `sessions.send` - 发送消息到会话
- `sessions.abort` - 中止会话
- `sessions.patch` - 修补会话
- `sessions.reset` - 重置会话
- `sessions.delete` - 删除会话
- `sessions.compact` - 压缩会话

#### 聊天功能
- `chat.history` - 聊天历史
- `chat.abort` - 中止聊天
- `chat.send` - 发送聊天消息

#### 治理功能
- `governance.overview` - 治理概览
- `governance.agent` - Agent 治理信息
- `governance.team` - Team 治理信息
- `governance.capability.inventory` - 能力清单
- `governance.capability.assetRegistry` - 资产注册表
- `governance.genesis.plan` - Genesis 计划
- `governance.proposals.list` - 提案列表
- `governance.proposals.synthesize` - 合成提案
- `governance.proposals.reconcile` - 协调提案
- `governance.proposals.create` - 创建提案
- `governance.proposals.review` - 审核提案
- `governance.proposals.reviewMany` - 批量审核
- `governance.proposals.apply` - 应用提案
- `governance.proposals.applyMany` - 批量应用
- `governance.proposals.revert` - 回滚提案
- `governance.proposals.revertMany` - 批量回滚

#### 自治功能
- `autonomy.list` - 列出自治任务
- `autonomy.overview` - 自治概览
- `autonomy.capability.inventory` - 能力清单
- `autonomy.genesis.plan` - Genesis 计划
- `autonomy.heal` - 自愈
- `autonomy.supervise` - 监督
- `autonomy.activate` - 激活
- `autonomy.history` - 历史
- `autonomy.governance.proposals` - 治理提案
- `autonomy.governance.reconcile` - 治理协调
- `autonomy.show` - 显示详情
- `autonomy.start` - 启动
- `autonomy.replay.submit` - 提交回放
- `autonomy.cancel` - 取消
- `autonomy.loop.show` - 显示循环
- `autonomy.loop.upsert` - 插入/更新循环
- `autonomy.loop.reconcile` - 协调循环
- `autonomy.loop.remove` - 移除循环

#### 其他功能
- `cron.*` - 定时任务管理
- `node.*` - 节点管理
- `device.*` - 设备管理
- `wizard.*` - 向导
- `talk.*` - 语音功能
- `tts.*` - 文本转语音
- `skills.*` - 技能管理
- `update.*` - 更新管理
- `secrets.*` - 密钥管理
- `doctor.*` - 诊断工具

---

### 3.2 WebSocket 事件

后端通过 WebSocket 推送以下事件：

- `connect.challenge` - 连接挑战
- `agent` - Agent 事件
- `chat` - 聊天事件
- `session.message` - 会话消息
- `session.tool` - 会话工具调用
- `sessions.changed` - 会话变更
- `presence` - 在线状态
- `tick` - 心跳
- `talk.mode` - 语音模式变更
- `shutdown` - 关闭
- `health` - 健康状态
- `heartbeat` - 心跳
- `cron` - 定时任务事件
- `node.pair.requested` - 节点配对请求
- `node.pair.resolved` - 节点配对结果
- `node.invoke.request` - 节点调用请求
- `device.pair.requested` - 设备配对请求
- `device.pair.resolved` - 设备配对结果
- `voicewake.changed` - 语音唤醒变更
- `exec.approval.requested` - 执行审批请求
- `exec.approval.resolved` - 执行审批结果
- `plugin.approval.requested` - 插件审批请求
- `plugin.approval.resolved` - 插件审批结果
- `update.available` - 更新可用

---

## 四、数据结构对比分析

### 4.1 GovernanceStatus 类型对比

#### 前端定义 (`web/src/types/index.ts`)

```typescript
interface GovernanceStatus {
  sovereigntyBoundary: boolean;
  activeAgents: AgentNode[];
  evolutionProjects: EvolutionProject[];
  sandboxExperiments: SandboxExperiment[];
  freezeActive: boolean;
  freezeStatus?: FreezeStatus;
}

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'frozen';
  children?: AgentNode[];
}

interface EvolutionProject {
  id: string;
  title: string;
  mutationClass: string;
  status: 'proposed' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt?: number;
}

interface SandboxExperiment {
  id: string;
  universeId: string;
  title: string;
  status: 'proposed' | 'provisioning' | 'running' | 'observing' | 'completed' | 'rejected' | 'promoted' | 'rolled_back';
  stages: ExperimentStage[];
  createdAt: number;
  updatedAt?: number;
}

interface FreezeStatus {
  active: boolean;
  reason?: string;
  activatedAt?: number;
  affectedSubsystems: string[];
}
```

#### 后端返回 (`src/governance/control-plane.ts`)

```typescript
type GovernanceOverviewResult = {
  observedAt: number;
  charterDir: string;
  discovered: boolean;
  proposals: GovernanceProposalLedger;
  audit: {
    summary: AuditStreamSummary;
    recentFacts: AuditFactRecord[];
    recentGovernanceFacts: AuditFactRecord[];
  };
  documents: {
    constitution: GovernanceCharterDocumentStatus;
    sovereigntyPolicy: GovernanceCharterDocumentStatus;
    evolutionPolicy: GovernanceCharterDocumentStatus;
  };
  artifactPaths: string[];
  missingArtifactPaths: string[];
  reservedAuthorities: string[];
  automaticEnforcementActions: string[];
  freezeTargets: string[];
  sovereignty: {
    open: number;
    resolved: number;
    freezeActive: boolean;
    incidents: GovernanceSovereigntyIncident[];
    // ... 更多字段
  };
  enforcement: GovernanceEnforcementSummary;
  organization: GovernanceOrganizationRecord;
  findings: SecurityAuditFinding[];
};

type GovernanceOrganizationRecord = {
  charterDir: string;
  discovered: boolean;
  agentCount: number;
  teamCount: number;
  agents: GovernanceCharterAgentRecord[];
  teams: GovernanceCharterTeamRecord[];
};

type GovernanceEnforcementSummary = {
  active: boolean;
  reasonCode?: string;
  message?: string;
  details: string[];
  freezeTargets?: string[];
  activeSovereigntyIncidentIds: string[];
  activeSovereigntyFreezeIncidentIds: string[];
};
```

#### 🔴 不匹配点分析

| 前端字段 | 后端字段 | 状态 | 说明 |
|---------|---------|------|------|
| `sovereigntyBoundary` | `sovereignty.open > 0` | ❌ 不匹配 | 前端需要布尔值，后端是对象 |
| `activeAgents` | `organization.agents` | ❌ 不匹配 | 结构和字段完全不同 |
| `evolutionProjects` | `proposals` | ❌ 缺失 | 后端没有直接对应的字段 |
| `sandboxExperiments` | - | ❌ 缺失 | 需要从 sandbox-universe 状态获取 |
| `freezeActive` | `enforcement.active` | ✅ 可映射 | 路径不同但语义一致 |
| `freezeStatus` | `enforcement` | ⚠️ 部分匹配 | 需要转换格式 |

---

### 4.2 ChannelInfo 类型对比

#### 前端定义 (`web/src/services/api.ts`)

```typescript
interface ChannelInfo {
  id: string;
  type: string;
  name: string;
  connected: boolean;
  status?: string;
}
```

#### 后端返回 (`src/gateway/server-methods/channels.ts`)

```typescript
// channels.status 返回的 payload 结构
{
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels: Record<string, string>;
  channelSystemImages: Record<string, string>;
  channelMeta: Record<string, unknown>;
  channels: Record<string, unknown>;  // 每个渠道的摘要
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
}

// ChannelAccountSnapshot 结构
type ChannelAccountSnapshot = {
  accountId: string;
  configured: boolean;
  connected: boolean;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  lastProbeAt?: number;
  errors?: string[];
  warnings?: string[];
  // ... 更多字段
};
```

#### 🟡 不匹配点分析

| 前端字段 | 后端字段 | 状态 | 说明 |
|---------|---------|------|------|
| `id` | 需要从 `channelAccounts` 键推导 | ⚠️ 需转换 | 后端以对象形式返回 |
| `type` | 渠道 ID 即为类型 | ✅ 可映射 | - |
| `name` | `channelLabels[id]` | ⚠️ 需转换 | 需要从标签映射中获取 |
| `connected` | `channelAccounts[id][0].connected` | ⚠️ 需转换 | 需要从账户快照中提取 |
| `status` | 需要计算 | ❌ 缺失 | 后端无直接字段 |

---

### 4.3 AgentInfo 类型对比

#### 前端定义 (`web/src/services/api.ts`)

```typescript
interface AgentInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'frozen';
  role?: string;
  lastActive?: number;
}
```

#### 后端返回 (`src/shared/session-types.ts`)

```typescript
type GatewayAgentRow = {
  id: string;
  name?: string;
  identity?: GatewayAgentIdentity;
  workspace?: string;
  model?: GatewayAgentModel;
  configured?: boolean;
  charterDeclared?: boolean;
  charterTitle?: string;
  charterLayer?: string;
  governance?: GatewayAgentGovernance;
  governanceContract?: GatewayAgentGovernanceContract;
};

type GatewayAgentIdentity = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
};

type GatewayAgentGovernance = {
  charterDeclared: boolean;
  charterTitle?: string;
  charterLayer?: string;
  freezeActive: boolean;
  freezeReasonCode?: string;
  // ... 更多字段
};
```

#### 🟡 不匹配点分析

| 前端字段 | 后端字段 | 状态 | 说明 |
|---------|---------|------|------|
| `id` | `id` | ✅ 匹配 | - |
| `name` | `identity.name` 或 `name` | ⚠️ 需转换 | 优先级需要明确 |
| `status` | 需要从 `governance.freezeActive` 推导 | ❌ 缺失 | 后端无直接状态字段 |
| `role` | `charterLayer` 或 `governance.charterLayer` | ⚠️ 需转换 | 字段名不同 |
| `lastActive` | - | ❌ 缺失 | 后端未提供此字段 |

---

## 五、发现的问题与建议

### 5.1 🔴 严重问题

#### 问题 1: GovernanceStatus 数据结构完全不匹配

**问题描述**:
前端期望的简化结构与后端返回的复杂结构差异巨大，导致 DashboardPage 和 GovernancePage 无法正确显示数据。

**影响范围**:
- DashboardPage 无法显示正确的治理状态
- GovernancePage 的代理拓扑图、演化项目、沙盒实验无法渲染

**解决方案**:

**方案 A（推荐）**: 在后端添加适配器层

在 `src/gateway/server-methods/governance.ts` 中添加适配函数：

```typescript
function adaptGovernanceOverviewForFrontend(
  overview: GovernanceOverviewResult
): any {
  return {
    sovereigntyBoundary: overview.sovereignty.open > 0,
    activeAgents: overview.organization.agents.map(agent => ({
      id: agent.id,
      name: agent.title || agent.id,
      role: agent.layer || 'unknown',
      status: agent.governance?.freezeActive ? 'frozen' : 'active',
    })),
    evolutionProjects: extractEvolutionProjectsFromProposals(overview.proposals),
    sandboxExperiments: loadSandboxExperimentsFromState(overview.stateDir),
    freezeActive: overview.enforcement.active,
    freezeStatus: overview.enforcement.active ? {
      active: true,
      reason: overview.enforcement.reasonCode,
      activatedAt: overview.observedAt,
      affectedSubsystems: overview.enforcement.freezeTargets || [],
    } : undefined,
  };
}
```

然后在 `governance.overview` 处理器中使用：

```typescript
"governance.overview": ({ params, respond }) => {
  if (!assertValidParams(params, validateGovernanceOverviewParams, "governance.overview", respond)) {
    return;
  }
  const overview = getGovernanceOverview({ /* ... */ });
  const adapted = adaptGovernanceOverviewForFrontend(overview);
  respond(true, adapted, undefined);
}
```

**方案 B**: 修改前端类型定义

更新 `web/src/types/index.ts` 以匹配后端实际返回的数据结构，但这会导致前端代码大量修改。

**建议**: 采用方案 A，因为：
1. 保持前端类型简洁易懂
2. 后端适配器可以处理复杂的业务逻辑
3. 便于后续扩展和维护

---

#### 问题 2: 缺少关键 API 方法

**问题描述**:
前端调用了一些后端可能未实现或命名不一致的方法：

1. `channels.connect` - 前端用于连接渠道，但后端只有 `channels.logout`
2. `sessions.get` - 前端用于获取会话消息，但后端只有 `sessions.list` 和 `sessions.send`
3. `autonomy.list` - 前端用于获取任务列表，需要确认是否存在

**影响范围**:
- ChannelsPage 无法连接渠道
- ChatPage 无法加载历史消息
- DashboardPage 无法显示任务列表

**解决方案**:

**A. 实现 channels.connect 方法**

在 `src/gateway/server-methods/channels.ts` 中添加：

```typescript
"channels.connect": async ({ params, respond, context }) => {
  // 实现渠道连接逻辑
  const channelId = params.channelId;
  const plugin = getChannelPlugin(channelId);
  
  if (!plugin) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Unknown channel: ${channelId}`));
    return;
  }
  
  // 启动渠道
  await context.startChannel(channelId);
  
  respond(true, { success: true }, undefined);
}
```

**B. 实现 sessions.get 或使用现有方法**

选项 1: 添加新方法 `sessions.get`

```typescript
"sessions.get": async ({ params, respond }) => {
  const sessionId = params.sessionId;
  const limit = params.limit || 100;
  
  // 从文件系统或数据库加载会话消息
  const messages = await loadSessionMessages(sessionId, limit);
  
  respond(true, messages, undefined);
}
```

选项 2: 使用现有的 `chat.history` 方法

修改前端调用：
```typescript
// 从 sessions.get 改为 chat.history
const response = await apiService.rpc('chat.history', { sessionId, limit });
```

**C. 确认 autonomy.list 的实现**

检查 `src/gateway/server-methods/autonomy.ts` 中是否已实现：

```bash
grep -n '"autonomy.list"' src/gateway/server-methods/autonomy.ts
```

如果未实现，需要添加相应的处理器。

---

#### 问题 3: WebSocket 事件订阅机制不明确

**问题描述**:
前端使用 `wsManager.onEvent('session.*')` 监听事件，但后端事件命名规范需要确认是否支持通配符。

**影响范围**:
- ChatPage 可能无法接收实时消息
- 其他页面的实时更新功能可能失效

**解决方案**:

**A. 在后端实现通配符支持**

修改 `src/gateway/ws-log.ts` 或相关 WebSocket 处理逻辑，支持通配符匹配：

```typescript
function matchesPattern(eventType: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(eventType);
  }
  return eventType === pattern;
}
```

**B. 前端改用精确匹配**

修改前端代码，使用具体的事件名称：

```typescript
// 从 session.* 改为具体事件
wsManager.onEvent('session.message', callback);
wsManager.onEvent('session.tool', callback);
```

**建议**: 采用方案 A，因为通配符更灵活，便于后续扩展。

---

### 5.2 🟡 中等问题

#### 问题 4: 错误处理不一致

**问题描述**:
前端期望统一的 `ApiResponse<T>` 格式 `{success, data?, error?}`，但后端 RPC 方法直接使用 `respond(success, data, error)`，可能导致格式不一致。

**影响范围**:
- 所有 API 调用的错误处理
- 用户体验（错误提示不准确）

**解决方案**:

在 `web/src/services/api.ts` 的 `rpc` 方法中已经做了封装，但需要确保所有后端方法都正确使用 `respond`：

```typescript
// 后端标准响应格式
respond(true, data, undefined);  // 成功
respond(false, undefined, errorShape(code, message));  // 失败
```

检查所有 handler 是否遵循此规范。

---

#### 问题 5: 缺少分页支持

**问题描述**:
`sessions.list`、`agents.list` 等方法可能需要分页参数，但前端未实现分页 UI。

**影响范围**:
- 大数据量时性能问题
- 用户体验（一次性加载过多数据）

**解决方案**:

**A. 后端添加分页参数**

修改 handlers 支持 `limit` 和 `offset` 参数：

```typescript
"sessions.list": ({ params, respond }) => {
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  
  const sessions = listSessions(limit, offset);
  respond(true, sessions, undefined);
}
```

**B. 前端添加分页 UI**

在相应页面添加分页组件（Mantine UI 提供 Pagination 组件）。

---

#### 问题 6: 实时数据更新机制不完善

**问题描述**:
DashboardPage 使用定时轮询而非 WebSocket 实时更新，导致数据延迟和资源浪费。

**影响范围**:
- DashboardPage 数据实时性
- 服务器负载

**解决方案**:

为仪表盘数据添加 WebSocket 订阅支持：

**A. 后端添加治理状态更新事件**

在 `src/gateway/server-broadcast.ts` 中添加：

```typescript
export function broadcastGovernanceUpdate(overview: GovernanceOverviewResult) {
  broadcastToSubscribers('governance.update', adaptGovernanceOverviewForFrontend(overview));
}
```

**B. 前端订阅更新**

修改 `web/src/hooks/useGovernanceWebSocket.ts`：

```typescript
useEffect(() => {
  const unsub = wsManager.onEvent('governance.update', (event) => {
    if (event.payload) {
      setGovernanceStatus(event.payload);
    }
  });
  return unsub;
}, []);
```

---

### 5.3 🟢 轻微问题

#### 问题 7: 类型定义不完整

**问题描述**:
前端类型定义缺少可选字段和嵌套结构，可能导致运行时错误。

**解决方案**:

完善 `web/src/types/index.ts`，根据后端实际返回的数据结构补充字段。

---

#### 问题 8: 缺少加载状态管理

**问题描述**:
部分页面缺少骨架屏或加载指示器，用户体验不佳。

**解决方案**:

统一使用 `LoadingState` 和 `Skeleton` 组件：

```tsx
import { Skeleton } from '@mantine/core';
import { LoadingState } from '../components/ui/LoadingState';

if (loading) {
  return <LoadingState message="加载中..." />;
}

// 或使用骨架屏
<Skeleton height={200} radius="md" />
```

---

## 六、具体完善建议

### 6.1 立即修复（高优先级）

#### A. 实现 GovernanceStatus 适配器

**文件**: `src/gateway/server-methods/governance.ts`

**步骤**:
1. 添加 `adaptGovernanceOverviewForFrontend` 函数
2. 添加辅助函数 `extractEvolutionProjectsFromProposals`
3. 添加辅助函数 `loadSandboxExperimentsFromState`
4. 修改 `governance.overview` handler 使用适配器

**预计工作量**: 2-3 小时

---

#### B. 验证并修复 channels.status 返回格式

**文件**: `src/gateway/server-methods/channels.ts`

**步骤**:
1. 检查当前返回格式是否符合前端期望
2. 如果不符，添加适配器或直接修改返回结构
3. 确保包含 `id`, `type`, `name`, `connected`, `status` 字段

**预计工作量**: 1-2 小时

---

#### C. 实现缺失的 API 方法

**文件**: 
- `src/gateway/server-methods/channels.ts` - 添加 `channels.connect`
- `src/gateway/server-methods/sessions.ts` - 添加 `sessions.get` 或使用 `chat.history`
- `src/gateway/server-methods/autonomy.ts` - 确认 `autonomy.list` 存在

**预计工作量**: 3-4 小时

---

### 6.2 短期优化（中优先级）

#### A. 统一错误响应格式

**文件**: `web/src/services/api.ts`

**步骤**:
1. 确保 `rpc` 方法正确处理所有错误情况
2. 添加更详细的错误日志
3. 区分网络错误、认证错误、业务错误

**预计工作量**: 2 小时

---

#### B. 添加 WebSocket 事件文档

**文件**: `docs/WEBSOCKET_EVENTS.md`

**内容**:
- 所有可用的 WebSocket 事件列表
- 每个事件的 payload 格式
- 订阅示例
- 最佳实践

**预计工作量**: 3-4 小时

---

#### C. 完善前端类型定义

**文件**: `web/src/types/index.ts`

**步骤**:
1. 根据后端实际返回更新类型定义
2. 添加注释说明字段含义
3. 使用联合类型提高类型安全性

**预计工作量**: 2-3 小时

---

### 6.3 长期改进（低优先级）

#### A. 为仪表盘添加 WebSocket 实时更新

**文件**: 
- `src/gateway/server-broadcast.ts`
- `web/src/hooks/useRealTimeChartData.ts`

**步骤**:
1. 后端定期广播治理状态更新
2. 前端订阅并更新状态
3. 移除定时轮询

**预计工作量**: 4-6 小时

---

#### B. 实现分页支持

**文件**: 多个文件和组件

**步骤**:
1. 后端 API 添加分页参数
2. 前端添加分页 UI 组件
3. 更新状态管理

**预计工作量**: 6-8 小时

---

#### C. 添加 API 版本控制

**文件**: 后端路由和前端服务

**步骤**:
1. 为 API 添加版本号前缀（如 `/v1/rpc`）
2. 实现向后兼容策略
3. 添加弃用警告

**预计工作量**: 8-12 小时

---

## 七、实施计划

### Phase 1: 紧急修复（1-2天）

**目标**: 解决阻塞性问题，确保基本功能可用

**任务**:
1. ✅ 实现 GovernanceStatus 适配器
2. ✅ 验证并修复 channels.status 返回格式
3. ✅ 实现缺失的 API 方法（channels.connect, sessions.get）
4. ✅ 测试所有页面的基本功能

**验收标准**:
- DashboardPage 能正确显示治理状态
- ChannelsPage 能连接/断开渠道
- ChatPage 能发送/接收消息
- GovernancePage 能显示基本信息

---

### Phase 2: 数据对齐（3-5天）

**目标**: 统一前后端数据格式，提高稳定性

**任务**:
1. ✅ 统一所有 API 的响应格式
2. ✅ 完善前端类型定义
3. ✅ 添加错误处理中间件
4. ✅ 编写单元测试

**验收标准**:
- 所有 API 调用都有明确的类型定义
- 错误处理一致且用户友好
- 单元测试覆盖率达到 80%

---

### Phase 3: 功能增强（1-2周）

**目标**: 提升用户体验和系统性能

**任务**:
1. ✅ 为仪表盘添加 WebSocket 实时更新
2. ✅ 实现分页支持
3. ✅ 添加加载状态和骨架屏
4. ✅ 优化性能（缓存、懒加载等）

**验收标准**:
- 仪表盘数据实时更新延迟 < 1秒
- 大数据量列表支持分页
- 所有页面都有合适的加载状态

---

### Phase 4: 文档与测试（3-5天）

**目标**: 完善文档，确保可维护性

**任务**:
1. ✅ 编写 API 文档
2. ✅ 编写 WebSocket 事件文档
3. ✅ 添加集成测试
4. ✅ 代码审查和优化

**验收标准**:
- API 文档完整且准确
- WebSocket 事件文档清晰易懂
- 集成测试覆盖主要场景
- 代码质量符合规范

---

## 八、总结

### 8.1 主要发现

1. **数据结构不匹配**: 特别是 `GovernanceStatus`，前后端差异巨大
2. **API 方法缺失**: 部分前端调用的方法未实现或命名不一致
3. **响应格式不统一**: 需要统一的 `ApiResponse` 封装
4. **实时性不足**: 缺少 WebSocket 实时更新支持
5. **类型定义不完整**: 前端类型定义需要完善

### 8.2 核心建议

1. **优先解决数据结构不匹配问题**: 在后端添加适配器层
2. **补全缺失的 API 方法**: 确保前后端接口一致
3. **统一错误处理**: 提高用户体验
4. **增强实时性**: 利用 WebSocket 实现实时更新
5. **完善文档**: 便于后续开发和维护

### 8.3 预期收益

完成上述改进后，系统将具备：
- ✅ 稳定的前后端数据交互
- ✅ 清晰的 API 文档和类型定义
- ✅ 良好的用户体验（实时更新、加载状态、错误提示）
- ✅ 易于维护和扩展的代码结构

---

## 附录

### A. 相关文件清单

**前端文件**:
- `web/src/types/index.ts` - 类型定义
- `web/src/services/api.ts` - API 服务
- `web/src/services/ws-manager.ts` - WebSocket 管理
- `web/src/pages/*.tsx` - 页面组件
- `web/src/hooks/*.ts` - 自定义 Hooks

**后端文件**:
- `src/gateway/server-methods-list.ts` - RPC 方法列表
- `src/gateway/server-methods/governance.ts` - 治理方法
- `src/gateway/server-methods/channels.ts` - 渠道方法
- `src/gateway/server-methods/agents.ts` - Agent 方法
- `src/gateway/server-methods/autonomy.ts` - 自治方法
- `src/gateway/server-broadcast.ts` - 广播机制
- `src/governance/control-plane.ts` - 治理控制平面

### B. 参考文档

- [WebSocket 事件规范](docs/WEBSOCKET_EVENTS.md) - 待创建
- [API 设计指南](docs/API_DESIGN_GUIDE.md) - 待创建
- [类型定义规范](docs/TYPE_DEFINITION_GUIDE.md) - 待创建

---

**报告结束**
