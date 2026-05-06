# 前后端功能对齐 - 执行摘要

**生成时间**: 2026-05-06  
**优先级**: 🔴 高  
**预计修复时间**: 1-2天（紧急修复）+ 3-5天（短期优化）

---

## 🎯 核心问题

### 1. 🔴 GovernanceStatus 数据结构完全不匹配

**影响**: DashboardPage 和 GovernancePage 无法正确显示数据

**前端期望**:
```typescript
{
  sovereigntyBoundary: boolean,
  activeAgents: AgentNode[],
  evolutionProjects: EvolutionProject[],
  sandboxExperiments: SandboxExperiment[],
  freezeActive: boolean,
  freezeStatus?: FreezeStatus
}
```

**后端返回**: 复杂的 `GovernanceOverviewResult` 对象，包含 `organization`、`enforcement`、`sovereignty` 等嵌套结构

**解决方案**: 在后端添加适配器层，将复杂结构转换为前端期望的简化格式

**文件**: `src/gateway/server-methods/governance.ts`

---

### 2. 🔴 缺失关键 API 方法

| 前端调用 | 后端状态 | 影响页面 | 优先级 |
|---------|---------|---------|--------|
| `channels.connect` | ❌ 不存在 | ChannelsPage | 🔴 高 |
| `sessions.get` | ❌ 不存在（可用 `chat.history` 替代） | ChatPage | 🔴 高 |
| `autonomy.list` | ⚠️ 需确认 | DashboardPage | 🟡 中 |

**解决方案**: 
- 实现 `channels.connect` 方法
- 修改前端使用 `chat.history` 或实现 `sessions.get`
- 确认 `autonomy.list` 是否存在

---

### 3. 🟡 WebSocket 事件通配符支持不明确

**问题**: 前端使用 `wsManager.onEvent('session.*')`，但后端可能不支持通配符

**影响**: ChatPage 可能无法接收实时消息

**解决方案**: 
- 方案A（推荐）: 在后端实现通配符匹配
- 方案B: 前端改用精确事件名称

---

## 📋 立即行动清单

### Phase 1: 紧急修复（1-2天）

#### ✅ 任务 1: 实现 GovernanceStatus 适配器

**负责人**: 后端开发  
**文件**: `src/gateway/server-methods/governance.ts`  
**预计时间**: 2-3小时

**步骤**:
1. 添加 `adaptGovernanceOverviewForFrontend()` 函数
2. 提取演化项目数据
3. 加载沙盒实验状态
4. 修改 `governance.overview` handler 使用适配器

**代码示例**:
```typescript
function adaptGovernanceOverviewForFrontend(overview: GovernanceOverviewResult) {
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

---

#### ✅ 任务 2: 实现 channels.connect 方法

**负责人**: 后端开发  
**文件**: `src/gateway/server-methods/channels.ts`  
**预计时间**: 1-2小时

**步骤**:
1. 添加 `channels.connect` handler
2. 调用渠道插件的连接逻辑
3. 返回连接状态

**代码示例**:
```typescript
"channels.connect": async ({ params, respond, context }) => {
  const channelId = normalizeChannelId(params.channelId);
  const plugin = getChannelPlugin(channelId);
  
  if (!plugin) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Unknown channel: ${channelId}`));
    return;
  }
  
  await context.startChannel(channelId);
  respond(true, { success: true, channelId }, undefined);
}
```

---

#### ✅ 任务 3: 解决 sessions.get 问题

**负责人**: 前端开发  
**文件**: `web/src/pages/ChatPage.tsx`, `web/src/services/api.ts`  
**预计时间**: 1小时

**选项 A**（推荐）: 修改前端使用 `chat.history`

```typescript
// 修改前
const messagesResponse = await apiService.getSessionMessages(sessionId, 50);

// 修改后
const messagesResponse = await apiService.rpc('chat.history', { sessionId, limit: 50 });
```

**选项 B**: 在后端实现 `sessions.get`

---

#### ✅ 任务 4: 验证 autonomy.list 存在性

**负责人**: 后端开发  
**文件**: `src/gateway/server-methods/autonomy.ts`  
**预计时间**: 30分钟

**步骤**:
1. 检查文件中是否有 `"autonomy.list"` handler
2. 如果不存在，添加实现
3. 确认返回格式符合前端期望

---

### Phase 2: 测试与验证（1天）

#### ✅ 任务 5: 端到端测试

**负责人**: 测试工程师  
**预计时间**: 4-6小时

**测试用例**:
1. DashboardPage 能正确显示治理状态
2. ChannelsPage 能连接/断开渠道
3. ChatPage 能发送/接收消息、加载历史
4. GovernancePage 能显示代理拓扑、提案列表
5. SettingsPage 能获取模型列表、配置信息

---

## 📊 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 适配器逻辑复杂导致bug | 中 | 高 | 编写单元测试，逐步验证 |
| WebSocket 通配符实现困难 | 低 | 中 | 先采用精确匹配作为临时方案 |
| 后端修改影响其他功能 | 中 | 高 | 回归测试，确保向后兼容 |
| 前端类型定义更新遗漏 | 低 | 中 | 使用 TypeScript 严格模式，编译检查 |

---

## 🎯 成功标准

完成紧急修复后，系统应满足：

- ✅ DashboardPage 能正确显示所有统计数据和图表
- ✅ ChannelsPage 能查看渠道状态并执行连接/断开操作
- ✅ ChatPage 能创建会话、发送消息、接收实时推送、加载历史
- ✅ GovernancePage 能显示治理概览、提案列表、代理拓扑
- ✅ SettingsPage 能查看和修改配置、管理模型
- ✅ 所有 API 调用都有明确的错误处理和用户提示
- ✅ WebSocket 连接稳定，能接收实时更新

---

## 📝 后续优化建议

完成紧急修复后，建议继续实施以下优化：

### 中期优化（1-2周）
1. 统一错误响应格式
2. 完善前端类型定义
3. 添加 WebSocket 事件文档
4. 为仪表盘添加 WebSocket 实时更新（替代轮询）

### 长期改进（2-4周）
1. 实现分页支持
2. 添加 API 版本控制
3. 性能优化（缓存、懒加载）
4. 完整的集成测试套件

---

## 📞 联系方式

如有疑问或需要协助，请联系：
- 后端开发团队: [联系方式]
- 前端开发团队: [联系方式]
- 技术负责人: [联系方式]

---

**附录**: 详细分析报告请参见 [`FRONTEND_BACKEND_ALIGNMENT_REPORT.md`](./FRONTEND_BACKEND_ALIGNMENT_REPORT.md)
