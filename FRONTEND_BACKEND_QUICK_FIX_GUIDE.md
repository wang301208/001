# 前后端 API 对齐 - 快速修复指南

**生成时间**: 2026-05-06  
**状态**: 可立即执行  
**预计完成时间**: 1-2天

---

## 📊 API 方法对照表

### ✅ 已实现的方法

| 前端调用 | 后端方法 | 文件位置 | 状态 |
|---------|---------|---------|------|
| `governance.overview` | ✅ `governance.overview` | `src/gateway/server-methods/governance.ts` | ⚠️ 数据结构不匹配 |
| `channels.status` | ✅ `channels.status` | `src/gateway/server-methods/channels.ts` | ⚠️ 需要适配器 |
| `channels.logout` | ✅ `channels.logout` | `src/gateway/server-methods/channels.ts` | ✅ 正常 |
| `agents.list` | ✅ `agents.list` | `src/gateway/server-methods/agents.ts` | ⚠️ 字段映射问题 |
| `sessions.list` | ✅ `sessions.list` | `src/gateway/server-methods/sessions.ts` | ✅ 正常 |
| `sessions.create` | ✅ `sessions.create` | `src/gateway/server-methods/sessions.ts` | ✅ 正常 |
| `sessions.delete` | ✅ `sessions.delete` | `src/gateway/server-methods/sessions.ts` | ✅ 正常 |
| `chat.send` | ✅ `chat.send` | `src/gateway/server-methods/chat.ts` | ✅ 正常 |
| `chat.abort` | ✅ `chat.abort` | `src/gateway/server-methods/chat.ts` | ✅ 正常 |
| `chat.history` | ✅ `chat.history` | `src/gateway/server-methods/chat.ts:1606` | ✅ 正常 |
| `models.list` | ✅ `models.list` | `src/gateway/server-methods/models.ts` | ✅ 正常 |
| `config.get` | ✅ `config.get` | `src/gateway/server-methods/config.ts` | ✅ 正常 |
| `config.set` | ✅ `config.set` | `src/gateway/server-methods/config.ts` | ✅ 正常 |
| `autonomy.list` | ✅ `autonomy.list` | `src/gateway/server-methods/autonomy.ts:176` | ✅ 正常 |
| `autonomy.cancel` | ✅ `autonomy.cancel` | `src/gateway/server-methods/autonomy.ts` | ✅ 正常 |
| `health` | ✅ `health` | `src/gateway/server-methods/health.ts` | ✅ 正常 |
| `gateway.identity.get` | ✅ `gateway.identity.get` | `src/gateway/server-methods/system.ts` | ✅ 正常 |
| `system.restart` | ✅ `system.restart` | `src/gateway/server-methods/system.ts` | ✅ 正常 |
| `governance.proposals.list` | ✅ `governance.proposals.list` | `src/gateway/server-methods/governance.ts` | ✅ 正常 |
| `governance.proposals.create` | ✅ `governance.proposals.create` | `src/gateway/server-methods/governance.ts` | ✅ 正常 |
| `governance.proposals.review` | ✅ `governance.proposals.review` | `src/gateway/server-methods/governance.ts` | ✅ 正常 |
| `governance.proposals.apply` | ✅ `governance.proposals.apply` | `src/gateway/server-methods/governance.ts` | ✅ 正常 |
| `governance.proposals.revert` | ✅ `governance.proposals.revert` | `src/gateway/server-methods/governance.ts` | ✅ 正常 |

---

### ❌ 缺失的方法

| 前端调用 | 后端状态 | 影响页面 | 优先级 | 解决方案 |
|---------|---------|---------|--------|---------|
| `channels.connect` | ❌ 不存在 | ChannelsPage | 🔴 高 | **立即实现** |
| `sessions.get` | ❌ 不存在 | ChatPage | 🟡 中 | 改用 `chat.history` |

---

## 🔧 立即修复任务

### 任务 1: 实现 channels.connect 方法

**优先级**: 🔴 高  
**负责人**: 后端开发  
**预计时间**: 1-2小时

#### 步骤

1. 在 `src/gateway/server-methods/channels.ts` 中添加 handler

```typescript
"channels.connect": async ({ params, respond, context }) => {
  // 验证参数
  const rawChannel = (params as { channel?: unknown }).channel;
  const channelId = typeof rawChannel === "string" ? normalizeChannelId(rawChannel) : null;
  
  if (!channelId) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, "invalid channels.connect channel"),
    );
    return;
  }
  
  // 获取渠道插件
  const plugin = getChannelPlugin(channelId);
  if (!plugin) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `Unknown channel: ${channelId}`),
    );
    return;
  }
  
  try {
    // 启动渠道
    await context.startChannel(channelId);
    
    // 返回成功
    respond(true, { 
      success: true, 
      channelId,
      message: `Channel ${channelId} connected successfully` 
    }, undefined);
  } catch (err) {
    respond(
      false, 
      undefined, 
      errorShape(ErrorCodes.UNAVAILABLE, `Failed to connect channel: ${formatForLog(err)}`)
    );
  }
}
```

2. 在 `src/gateway/server-methods-list.ts` 的 `BASE_METHODS` 数组中添加 `"channels.connect"`

3. 测试连接功能

---

### 任务 2: 修改前端使用 chat.history 替代 sessions.get

**优先级**: 🟡 中  
**负责人**: 前端开发  
**预计时间**: 30分钟

#### 步骤

1. 修改 `web/src/services/api.ts`

```typescript
// 删除或注释掉 getSessionMessages 方法
// async getSessionMessages(sessionId: string, limit: number = 100): Promise<ApiResponse<any[]>> {
//   return this.rpc<any[]>('sessions.get', { sessionId, limit });
// }

// 添加新方法或使用现有的 rpc 方法
async getChatHistory(sessionKey: string, limit: number = 200): Promise<ApiResponse<any>> {
  return this.rpc<any>('chat.history', { sessionKey, limit });
}
```

2. 修改 `web/src/pages/ChatPage.tsx`

```typescript
// 修改前
const messagesResponse = await apiService.getSessionMessages(currentSessionId, 50);

// 修改后
const messagesResponse = await apiService.getChatHistory(currentSessionId, 50);

// 或者直接使用 rpc
const messagesResponse = await apiService.rpc('chat.history', { 
  sessionKey: currentSessionId, 
  limit: 50 
});
```

---

### 任务 3: 实现 GovernanceStatus 适配器

**优先级**: 🔴 高  
**负责人**: 后端开发  
**预计时间**: 2-3小时

#### 步骤

1. 在 `src/gateway/server-methods/governance.ts` 中添加适配函数

```typescript
import type { GovernanceOverviewResult } from "../../governance/control-plane.js";
import { loadSandboxUniverseStateSync } from "../../governance/sandbox-universe.js";

function adaptGovernanceOverviewForFrontend(overview: GovernanceOverviewResult): any {
  // 提取代理节点
  const activeAgents = overview.organization.agents.map(agent => ({
    id: agent.id,
    name: agent.title || agent.id,
    role: agent.layer || 'unknown',
    status: agent.governance?.freezeActive ? 'frozen' : 'active',
  }));
  
  // 提取演化项目（从提案中）
  const evolutionProjects = extractEvolutionProjectsFromProposals(overview.proposals);
  
  // 加载沙盒实验
  const sandboxExperiments = loadSandboxExperimentsFromState(overview.stateDir);
  
  // 构建冻结状态
  const freezeStatus = overview.enforcement.active ? {
    active: true,
    reason: overview.enforcement.reasonCode,
    activatedAt: overview.observedAt,
    affectedSubsystems: overview.enforcement.freezeTargets || [],
  } : undefined;
  
  return {
    sovereigntyBoundary: overview.sovereignty.open > 0,
    activeAgents,
    evolutionProjects,
    sandboxExperiments,
    freezeActive: overview.enforcement.active,
    freezeStatus,
  };
}

function extractEvolutionProjectsFromProposals(proposals: any): any[] {
  // 从提案 ledger 中提取演化项目
  // 这里需要根据实际的 proposals 结构进行转换
  if (!proposals || !proposals.items) {
    return [];
  }
  
  return proposals.items
    .filter((p: any) => p.type === 'evolution' || p.category === 'evolution')
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      mutationClass: p.mutationClass || 'unknown',
      status: mapProposalStatusToProjectStatus(p.status),
      progress: calculateProjectProgress(p),
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt,
    }));
}

function mapProposalStatusToProjectStatus(proposalStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'proposed',
    'approved': 'running',
    'applied': 'completed',
    'rejected': 'failed',
  };
  return statusMap[proposalStatus] || 'proposed';
}

function calculateProjectProgress(proposal: any): number {
  // 根据提案状态计算进度
  switch (proposal.status) {
    case 'pending': return 0;
    case 'approved': return 50;
    case 'applied': return 100;
    case 'rejected': return 0;
    default: return 0;
  }
}

function loadSandboxExperimentsFromState(stateDir: string): any[] {
  // 从 sandbox-universe 状态加载实验
  try {
    // 这里需要根据实际的 sandbox-universe 存储结构进行读取
    // 简化版本，实际实现需要读取文件系统
    return [];
  } catch (err) {
    console.error('Failed to load sandbox experiments:', err);
    return [];
  }
}
```

2. 修改 `governance.overview` handler

```typescript
"governance.overview": ({ params, respond }) => {
  if (!assertValidParams(params, validateGovernanceOverviewParams, "governance.overview", respond)) {
    return;
  }
  
  const overview = getGovernanceOverview({
    cfg: loadConfig(),
    // ... 其他参数
  });
  
  // 使用适配器转换数据
  const adapted = adaptGovernanceOverviewForFrontend(overview);
  
  respond(true, adapted, undefined);
}
```

---

### 任务 4: 实现 channels.status 适配器（可选）

如果 `channels.status` 返回的格式与前端期望不符，可以添加适配器。

**优先级**: 🟡 中  
**预计时间**: 1-2小时

#### 当前返回格式

```typescript
{
  ts: number,
  channelOrder: string[],
  channelLabels: Record<string, string>,
  channels: Record<string, unknown>,
  channelAccounts: Record<string, ChannelAccountSnapshot[]>,
  // ... 更多字段
}
```

#### 前端期望格式

```typescript
[
  {
    id: string,
    type: string,
    name: string,
    connected: boolean,
    status?: string
  }
]
```

#### 适配方案

在 `src/gateway/server-methods/channels.ts` 中添加适配函数：

```typescript
function adaptChannelsStatusForFrontend(payload: any): any[] {
  const channels: any[] = [];
  
  for (const channelId of payload.channelOrder || []) {
    const accounts = payload.channelAccounts[channelId] || [];
    const firstAccount = accounts[0];
    const label = payload.channelLabels[channelId] || channelId;
    
    channels.push({
      id: channelId,
      type: channelId,
      name: label,
      connected: firstAccount?.connected || false,
      status: computeChannelStatus(firstAccount),
    });
  }
  
  return channels;
}

function computeChannelStatus(account: any): string {
  if (!account) return 'unknown';
  if (!account.configured) return 'not_configured';
  if (account.errors?.length > 0) return 'error';
  if (account.warnings?.length > 0) return 'warning';
  if (account.connected) return 'connected';
  return 'disconnected';
}
```

然后修改 handler：

```typescript
"channels.status": async ({ params, respond, context }) => {
  // ... 现有逻辑
  
  const payload = { /* ... */ };
  
  // 检查是否需要适配
  const frontendMode = (params as { frontend?: boolean }).frontend === true;
  
  if (frontendMode) {
    respond(true, adaptChannelsStatusForFrontend(payload), undefined);
  } else {
    respond(true, payload, undefined);
  }
}
```

或者在前端处理：

```typescript
// web/src/services/api.ts
async getChannels(): Promise<ApiResponse<ChannelInfo[]>> {
  const response = await this.rpc<any>('channels.status');
  
  if (!response.success || !response.data) {
    return response as ApiResponse<ChannelInfo[]>;
  }
  
  // 适配数据
  const adapted = adaptChannelsData(response.data);
  return { success: true, data: adapted };
}

function adaptChannelsData(raw: any): ChannelInfo[] {
  const channels: ChannelInfo[] = [];
  
  for (const channelId of raw.channelOrder || []) {
    const accounts = raw.channelAccounts[channelId] || [];
    const firstAccount = accounts[0];
    const label = raw.channelLabels[channelId] || channelId;
    
    channels.push({
      id: channelId,
      type: channelId,
      name: label,
      connected: firstAccount?.connected || false,
      status: computeChannelStatus(firstAccount),
    });
  }
  
  return channels;
}
```

**建议**: 采用前端适配方案，因为这样更灵活，且不影响其他可能的后端消费者。

---

## 📝 实施检查清单

### 后端任务

- [ ] 实现 `channels.connect` 方法
- [ ] 在 `server-methods-list.ts` 中注册新方法
- [ ] 实现 `GovernanceStatus` 适配器
- [ ] （可选）实现 `channels.status` 适配器
- [ ] 运行后端测试
- [ ] 重启网关服务

### 前端任务

- [ ] 修改 `api.ts` 添加/更新方法
- [ ] 修改 `ChatPage.tsx` 使用 `chat.history`
- [ ] （可选）实现 `channels.status` 前端适配器
- [ ] 更新 TypeScript 类型定义
- [ ] 运行前端构建
- [ ] 测试所有页面功能

### 测试任务

- [ ] 测试 DashboardPage 数据加载
- [ ] 测试 ChannelsPage 连接/断开功能
- [ ] 测试 ChatPage 消息收发和历史加载
- [ ] 测试 GovernancePage 治理状态显示
- [ ] 测试 SettingsPage 配置管理
- [ ] 验证 WebSocket 实时更新
- [ ] 检查错误处理和用户提示

---

## 🎯 验收标准

完成上述任务后，系统应满足：

1. ✅ **DashboardPage**: 能正确显示治理状态、渠道统计、任务数量
2. ✅ **ChannelsPage**: 能查看渠道列表，执行连接/断开操作
3. ✅ **ChatPage**: 能创建会话、发送消息、接收实时推送、加载历史消息
4. ✅ **GovernancePage**: 能显示治理概览、代理拓扑、提案列表
5. ✅ **SettingsPage**: 能查看和修改配置、管理模型
6. ✅ **无控制台错误**: 浏览器控制台无类型错误或 API 调用失败
7. ✅ **用户体验**: 所有操作都有合适的加载状态和错误提示

---

## 📞 支持

如有问题，请参考：
- 详细分析报告: [`FRONTEND_BACKEND_ALIGNMENT_REPORT.md`](./FRONTEND_BACKEND_ALIGNMENT_REPORT.md)
- 执行摘要: [`FRONTEND_BACKEND_ALIGNMENT_EXECUTIVE_SUMMARY.md`](./FRONTEND_BACKEND_ALIGNMENT_EXECUTIVE_SUMMARY.md)

---

**最后更新**: 2026-05-06  
**版本**: 1.0
