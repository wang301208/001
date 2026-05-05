# 离线模式问题快速修复指南

## 🚨 问题症状

- ❌ 仪表盘显示"离线模式"
- ❌ WebSocket 状态为断开
- ❌ 聊天窗口发送消息无响应
- ❌ API 请求返回 401 Unauthorized

---

## ⚡ 30秒快速修复

### **方法 1：浏览器控制台（最快）**

1. 打开浏览器（访问 http://localhost:3000）
2. 按 **F12** 打开开发者工具
3. 切换到 **Console** 标签
4. 粘贴并执行以下代码：

```javascript
localStorage.setItem('gatewayToken', 'dev-token-123');
location.reload();
```

5. 等待页面刷新完成

✅ **完成！** 现在应该显示在线状态。

---

### **方法 2：SettingsPage 配置界面（推荐）**

1. 访问 **http://localhost:3000/settings**
2. 找到 **"网关认证"** 配置卡片（紫色钥匙图标）
3. 在密码输入框中输入：`dev-token-123`
4. 点击 **"保存令牌"** 按钮
5. 看到绿色成功提示后，**刷新页面**（F5）

✅ **完成！** 配置已保存并生效。

---

## 🔍 验证修复是否成功

### **1. 检查仪表盘状态**

访问：**http://localhost:3000/dashboard**

**预期结果**：
- ✅ WebSocket 状态卡片显示 **"已连接"**（绿色）
- ✅ 不再显示"离线模式"
- ✅ 渠道活跃度、任务执行等数据显示正常

### **2. 检查聊天功能**

访问：**http://localhost:3000/chat**

**测试步骤**：
1. 输入消息："你好"
2. 按 Enter 发送

**预期结果**：
- ✅ 用户消息立即显示（蓝色气泡）
- ✅ 显示"思考中..."指示器
- ✅ 1-3秒后显示AI响应（白色气泡）

### **3. 检查浏览器控制台**

按 **F12** → **Console** 标签

**预期日志**：
```
[Auth] 从 localStorage 加载令牌
[Auth] 认证初始化完成，令牌状态: 已配置
[useGovernanceWebSocket] 连接到: ws://localhost:3000/ws?token=dev-token-123
[useGovernanceWebSocket] 连接成功
```

---

## 🐛 如果仍然有问题

### **问题 1：仍然显示"离线模式"**

**排查步骤**：

1. **确认令牌已保存**
   ```javascript
   // 浏览器控制台
   console.log(localStorage.getItem('gatewayToken'));
   // 应该输出：dev-token-123
   ```

2. **确认网关服务正在运行**
   ```bash
   # PowerShell
   Get-Process node
   
   # 应该看到 node.exe 进程
   ```

3. **检查 WebSocket 连接**
   - 按 F12 → Network 标签
   - 筛选 "WS"（WebSocket）
   - 查看是否有 `ws://localhost:3000/ws?token=...` 连接
   - 状态应该是 **101 Switching Protocols**

4. **查看详细错误**
   - 按 F12 → Console 标签
   - 查找红色错误信息
   - 常见错误：
     - `401 Unauthorized` → 令牌错误或未配置
     - `Connection refused` → 网关服务未启动
     - `Invalid token` → 令牌格式错误

**解决方案**：
```bash
# 重启网关服务
taskkill /F /IM node.exe
$env:ZHUSHOU_GATEWAY_TOKEN="dev-token-123"
node zhushou.mjs gateway --bind lan --port 3000 --allow-unconfigured
```

然后刷新浏览器页面。

---

### **问题 2：聊天窗口发送消息后无响应**

**排查步骤**：

1. **检查 API 请求**
   - 按 F12 → Network 标签
   - 筛选 "XHR" 或 "Fetch"
   - 查找 `/api/sessions/.../messages` 请求
   - 查看状态码和响应

2. **检查 Authorization 头**
   - 点击失败的请求
   - 查看 **Headers** 标签
   - 确认有：`Authorization: Bearer dev-token-123`

3. **检查后端日志**
   ```bash
   # 查看最新日志
   Get-Content C:\tmp\zhushou\zhushou-2026-05-06.log -Tail 50
   ```

**常见原因**：
- ❌ AI 模型未配置（OpenAI API Key 缺失）
- ❌ 后端服务异常
- ❌ 网络连接问题

**解决方案**：
```bash
# 配置 OpenAI API Key
zhushou agents add main
# 按照提示输入 API Key
```

---

### **问题 3：保存令牌后刷新又失效**

**可能原因**：
- 浏览器隐私模式/无痕模式
- Cookie/LocalStorage 被禁用
- 浏览器扩展拦截

**解决方案**：

1. **退出隐私模式**
   - 使用正常浏览器窗口

2. **检查存储权限**
   ```javascript
   // 浏览器控制台
   try {
     localStorage.setItem('test', '123');
     localStorage.removeItem('test');
     console.log('LocalStorage 可用');
   } catch (e) {
     console.error('LocalStorage 不可用:', e);
   }
   ```

3. **禁用相关扩展**
   - 隐私保护扩展
   - Cookie 清理扩展
   - 广告拦截器

---

## 📋 完整配置清单

### **必需配置**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 网关令牌 | `dev-token-123` | 与启动网关时的 `ZHUSHOU_GATEWAY_TOKEN` 一致 |
| 网关地址 | `http://localhost:3000` | 默认本地地址 |
| WebSocket 端点 | `/ws` | 自动附加令牌参数 |

### **可选配置**

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| OpenAI API Key | 未配置 | 用于 AI 对话功能 |
| 远程模型端点 | `https://api.openai.com/v1` | 可自定义 |
| 模型名称 | `gpt-4` | 可切换其他模型 |

---

## 🎯 最佳实践

### **1. 生产环境配置**

```bash
# 1. 生成强随机令牌
$RANDOM_TOKEN = [System.Guid]::NewGuid().ToString()
Write-Host "生成的令牌: $RANDOM_TOKEN"

# 2. 启动网关时使用强令牌
$env:ZHUSHOU_GATEWAY_TOKEN=$RANDOM_TOKEN
node zhushou.mjs gateway --bind lan --port 3000

# 3. 在前端配置相同令牌
# SettingsPage → 输入 $RANDOM_TOKEN → 保存
```

### **2. 多设备同步**

如果需要在多个设备上访问：

1. **获取本机 IP**
   ```bash
   ipconfig | Select-String "IPv4"
   ```

2. **在其他设备上访问**
   ```
   http://<本机IP>:3000
   ```

3. **配置相同令牌**
   - 每个设备都需要在 SettingsPage 配置相同的令牌

### **3. 定期更换令牌**

**安全建议**：
- 每 30 天更换一次令牌
- 使用强随机字符串
- 不要共享令牌

**更换步骤**：
1. 生成新令牌
2. 重启网关服务（使用新令牌）
3. 在所有前端设备上更新令牌
4. 清除旧令牌

---

## 📞 技术支持

### **常用调试命令**

```bash
# 1. 检查网关服务状态
Get-Process node | Select-Object Id, StartTime

# 2. 查看网关日志
Get-Content C:\tmp\zhushou\zhushou-2026-05-06.log -Tail 100

# 3. 检查端口占用
netstat -ano | findstr :3000

# 4. 测试 API 连通性
curl http://localhost:3000/api/health

# 5. 测试 WebSocket 连接
wscat -c ws://localhost:3000/ws?token=dev-token-123
```

### **日志位置**

| 日志类型 | 路径 |
|---------|------|
| 网关日志 | `C:\tmp\zhushou\zhushou-YYYY-MM-DD.log` |
| 前端控制台 | 浏览器 F12 → Console |
| 网络请求 | 浏览器 F12 → Network |

### **联系支持**

如果以上方法都无法解决问题：

1. **收集诊断信息**
   ```bash
   # 系统信息
   systeminfo | Select-String "OS Name", "OS Version"
   
   # Node.js 版本
   node --version
   
   # 网关版本
   node zhushou.mjs --version
   
   # 最近日志
   Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 200 > diagnostic.log
   ```

2. **提交问题报告**
   - 包含诊断信息
   - 描述具体问题
   - 附上截图（如有）

---

## ✨ 总结

### **快速修复步骤**

1. ✅ 打开浏览器控制台（F12）
2. ✅ 执行：`localStorage.setItem('gatewayToken', 'dev-token-123'); location.reload();`
3. ✅ 等待页面刷新
4. ✅ 验证仪表盘显示"已连接"
5. ✅ 测试聊天窗口发送消息

### **预防建议**

- 💾 定期备份配置
- 🔒 使用强令牌
- 🔄 定期更换令牌
- 📝 记录配置信息

### **核心要点**

🎯 **离线模式的根本原因**：未配置网关认证令牌  
⚡ **最快解决方法**：浏览器控制台一行代码  
🛡️ **最佳实践**：通过 SettingsPage 配置并定期更换  

现在您的系统应该已经完全恢复正常！🚀
