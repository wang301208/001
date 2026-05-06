# Phase 1 修复 - 快速测试指南

**目标**: 验证所有修复是否正常工作  
**预计时间**: 30分钟

---

## 🚀 步骤 1: 重启服务

### 停止当前服务
```powershell
# 方法 1: 使用任务管理器
taskkill /F /IM node.exe

# 方法 2: 如果知道 PID
taskkill /F /PID <PID>
```

### 启动网关服务
```powershell
cd g:\项目\-
node zhushou.mjs gateway --bind lan --port 3000
```

**预期输出**:
```
✓ HTTP server listening on http://0.0.0.0:3000
✓ Gateway ready
```

---

## 🧪 步骤 2: 重新构建前端

```powershell
cd web
pnpm build
```

**预期输出**:
```
✓ built in XXXms
```

---

## 🌐 步骤 3: 浏览器测试

打开浏览器，访问 http://localhost:3000

### 测试 1: DashboardPage (仪表盘)

**操作步骤**:
1. 点击左侧菜单 "Dashboard"
2. 观察页面加载

**验证点**:
- ✅ 页面正常加载，无白屏
- ✅ 显示治理状态卡片
- ✅ 显示活跃代理列表（如果有）
- ✅ 显示演化项目列表（如果有）
- ✅ 显示冻结状态（如果激活）
- ✅ 浏览器控制台无错误

**常见问题**:
- ❌ 如果显示空白：检查 WebSocket 连接
- ❌ 如果显示错误：查看控制台错误信息

---

### 测试 2: ChannelsPage (渠道管理)

**操作步骤**:
1. 点击左侧菜单 "Channels"
2. 观察渠道列表
3. 选择一个未连接的渠道
4. 点击 "连接" 按钮

**验证点**:
- ✅ 渠道列表正常显示
- ✅ 点击 "连接" 后显示加载状态
- ✅ 连接成功后显示成功提示
- ✅ 渠道状态更新为 "已连接"
- ✅ 浏览器控制台无错误

**调试技巧**:
```javascript
// 在浏览器控制台中执行
console.log('Testing channels.connect...');
// 观察 Network 标签中的 WebSocket 消息
```

**预期 WebSocket 消息**:
```json
// 请求
{
  "id": "xxx",
  "method": "channels.connect",
  "params": {
    "channel": "telegram"
  }
}

// 响应
{
  "id": "xxx",
  "result": {
    "success": true,
    "channelId": "telegram",
    "message": "Channel telegram connected successfully"
  }
}
```

---

### 测试 3: ChatPage (聊天页面)

**操作步骤**:
1. 点击左侧菜单 "Chat"
2. 等待页面加载
3. 观察历史消息加载
4. 发送一条测试消息
5. 观察回复

**验证点**:
- ✅ 页面正常加载
- ✅ 历史消息正确显示（如果有）
- ✅ 可以输入消息
- ✅ 发送消息后显示在聊天窗口
- ✅ 收到 AI 回复
- ✅ 浏览器控制台无错误

**调试技巧**:
```javascript
// 在浏览器控制台中执行
// 检查 chat.history API 调用
console.log('Checking chat.history...');
```

**预期 WebSocket 消息**:
```json
// 请求
{
  "id": "xxx",
  "method": "chat.history",
  "params": {
    "sessionKey": "session-xxx",
    "limit": 50
  }
}

// 响应
{
  "id": "xxx",
  "result": {
    "sessionKey": "session-xxx",
    "sessionId": "xxx",
    "messages": [...],
    "thinkingLevel": "...",
    "fastMode": false,
    "verboseLevel": "..."
  }
}
```

---

### 测试 4: GovernancePage (治理页面)

**操作步骤**:
1. 点击左侧菜单 "Governance"
2. 观察治理概览
3. 查看代理拓扑图（如果有）
4. 查看提案列表（如果有）

**验证点**:
- ✅ 页面正常加载
- ✅ 显示治理概览数据
- ✅ 代理列表正确显示
- ✅ 演化项目正确显示
- ✅ 冻结状态正确显示
- ✅ 浏览器控制台无错误

**数据验证**:
检查返回的数据结构是否符合前端期望：
```typescript
interface GovernanceStatus {
  sovereigntyBoundary: boolean;  // ✅ 应该有
  activeAgents: AgentNode[];     // ✅ 应该有
  evolutionProjects: EvolutionProject[];  // ✅ 应该有
  sandboxExperiments: SandboxExperiment[];  // ⚠️ 当前为空数组
  freezeActive: boolean;         // ✅ 应该有
  freezeStatus?: FreezeStatus;   // ✅ 可选
}
```

---

### 测试 5: SettingsPage (设置页面)

**操作步骤**:
1. 点击左侧菜单 "Settings"
2. 查看配置信息
3. （可选）修改配置

**验证点**:
- ✅ 页面正常加载
- ✅ 配置信息正确显示
- ✅ 可以修改配置（如果有权限）
- ✅ 浏览器控制台无错误

---

## 🔍 步骤 4: 检查浏览器控制台

打开浏览器开发者工具 (F12)，切换到 "Console" 标签

**应该看到的日志**:
```
[ApiService] RPC 调用成功 [governance.overview]
[ApiService] RPC 调用成功 [channels.status]
[ApiService] RPC 调用成功 [chat.history]
```

**不应该看到的错误**:
```
❌ Failed to load resource
❌ WebSocket connection failed
❌ TypeError: Cannot read property 'xxx' of undefined
❌ Unhandled Promise rejection
```

---

## 📊 步骤 5: 检查 Network 标签

在浏览器开发者工具中切换到 "Network" 标签，过滤 "WS" (WebSocket)

**验证点**:
- ✅ WebSocket 连接成功建立
- ✅ 可以看到 RPC 请求和响应
- ✅ 没有失败的请求

**关键 RPC 调用**:
1. `governance.overview` - Dashboard 和 Governance 页面
2. `channels.status` - Channels 页面
3. `channels.connect` - 连接渠道时
4. `chat.history` - Chat 页面加载历史
5. `sessions.list` - Chat 页面加载会话列表

---

## 🐛 问题排查

### 问题 1: WebSocket 连接失败

**症状**: 页面显示 "WebSocket 未连接"

**解决方案**:
1. 确认网关服务正在运行
2. 检查端口是否正确 (3000)
3. 检查防火墙设置
4. 查看后端日志是否有错误

### 问题 2: channels.connect 调用失败

**症状**: 点击 "连接" 按钮后显示错误

**调试步骤**:
1. 打开浏览器控制台
2. 查看错误信息
3. 检查 WebSocket 消息格式

**常见错误**:
```
"invalid channels.connect channel"  // 渠道 ID 无效
"Unknown channel: xxx"              // 渠道插件未安装
"Failed to connect channel"         // 启动渠道时出错
```

### 问题 3: chat.history 返回空消息

**症状**: Chat 页面显示空白

**可能原因**:
1. 会话中没有历史消息
2. sessionKey 不正确
3. API 调用参数错误

**解决方案**:
1. 发送一条新消息创建历史
2. 检查 sessionKey 格式
3. 查看 Network 标签中的请求参数

### 问题 4: governance.overview 数据结构错误

**症状**: Dashboard 或 Governance 页面显示错误

**调试步骤**:
1. 在浏览器控制台中执行：
   ```javascript
   // 手动调用 API
   const response = await fetch('/api/rpc', {
     method: 'POST',
     body: JSON.stringify({
       method: 'governance.overview',
       params: {}
     })
   });
   console.log(await response.json());
   ```
2. 检查返回的数据结构
3. 确认适配器是否正确工作

---

## ✅ 验收清单

完成所有测试后，勾选以下项目：

- [ ] DashboardPage 正常显示
- [ ] ChannelsPage 可以连接渠道
- [ ] ChatPage 可以加载历史和发送消息
- [ ] GovernancePage 正常显示治理数据
- [ ] SettingsPage 正常显示配置
- [ ] 浏览器控制台无错误
- [ ] WebSocket 连接稳定
- [ ] 所有 RPC 调用成功

---

## 📞 需要帮助？

如果遇到问题：

1. **查看后端日志**: `\tmp\zhushou\zhushou-2026-05-06.log`
2. **查看浏览器控制台**: F12 -> Console
3. **查看 Network 标签**: F12 -> Network -> WS
4. **参考文档**: 
   - [`PHASE1_COMPLETION_REPORT.md`](./PHASE1_COMPLETION_REPORT.md)
   - [`FRONTEND_BACKEND_QUICK_FIX_GUIDE.md`](./FRONTEND_BACKEND_QUICK_FIX_GUIDE.md)

---

**测试完成时间**: ___________  
**测试结果**: □ 全部通过  □ 部分通过  □ 失败  
**备注**: ___________________________________
