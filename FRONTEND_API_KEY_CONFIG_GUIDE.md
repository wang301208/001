# 前端API密钥配置使用指南

## 📋 问题说明

您在前端设置页面中配置的API密钥**不会自动同步到后端**。这是因为：

1. **前端配置**：保存在浏览器的 `localStorage` 中，仅用于前端显示
2. **后端配置**：需要从 `auth-profiles.json` 文件中读取API密钥才能调用AI模型

这两个配置是**独立的**，需要手动同步。

---

## 🔧 解决方案（三选一）

### **方法1：使用自动配置脚本（推荐）**

我已为您创建了一个PowerShell脚本 [`configure-api-key.ps1`](file://g:\项目\-\configure-api-key.ps1)，可以一键配置API密钥。

#### **使用步骤：**

1. **打开PowerShell**

2. **运行配置脚本**（替换为您的实际API密钥）：
   ```powershell
   cd g:\项目\-
   .\configure-api-key.ps1 -Provider "openai" -ApiKey "sk-your-actual-api-key"
   ```

3. **重启网关服务**：
   ```powershell
   taskkill /F /IM node.exe
   node zhushou.mjs gateway --bind lan --port 3000
   ```

4. **验证配置**：查看日志中是否还有 `"No API key found"` 错误

---

### **方法2：手动编辑配置文件**

#### **步骤1：获取API密钥**

访问 [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)（或其他提供商），创建并复制API密钥。

#### **步骤2：编辑配置文件**

1. 打开文件：`C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`

2. 添加或更新以下配置：
   ```json
   {
     "version": 1,
     "profiles": {
       "openai:default": {
         "type": "api_key",
         "provider": "openai",
         "key": "sk-your-actual-api-key"
       }
     }
   }
   ```

3. 保存文件

#### **步骤3：重启网关服务**

```powershell
taskkill /F /IM node.exe
node zhushou.mjs gateway --bind lan --port 3000
```

---

### **方法3：使用前端设置页面的提示**

1. 访问前端设置页面：http://localhost:3000/settings

2. 在"远程模型配置"部分填写：
   - 模型提供商：`OpenAI`
   - API 端点 URL：`https://api.openai.com/v1`
   - API Key：您的API密钥
   - 模型名称：`gpt-4` 或其他

3. 点击"保存配置"按钮

4. 系统会：
   - ✅ 将配置保存到 localStorage
   - ✅ 复制JSON配置到剪贴板
   - ✅ 弹出配置说明对话框

5. 按照对话框中的说明，将配置粘贴到 `auth-profiles.json` 文件中

6. 重启网关服务

---

## 📝 支持的模型提供商

| 提供商 | Provider ID | 环境变量 |
|--------|-------------|----------|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| Google | `google` | `GOOGLE_API_KEY` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| Moonshot | `moonshot` | `MOONSHOT_API_KEY` |
| 其他 | 自定义 | 自定义 |

---

## ❓ 常见问题

### **Q1: 为什么前端配置不能直接生效？**

A: 因为前端和后端是两个独立的进程：
- 前端运行在浏览器中，只能访问浏览器的localStorage
- 后端运行在Node.js中，需要读取文件系统上的配置文件
- 两者之间没有自动同步机制

### **Q2: 配置后还需要重启服务吗？**

A: 是的，后端只在启动时读取一次配置文件。修改配置后必须重启网关服务。

### **Q3: 可以配置多个API密钥吗？**

A: 可以。在 `auth-profiles.json` 中添加多个profile：
```json
{
  "profiles": {
    "openai:primary": {
      "type": "api_key",
      "provider": "openai",
      "key": "sk-key-1"
    },
    "openai:backup": {
      "type": "api_key",
      "provider": "openai",
      "key": "sk-key-2"
    }
  }
}
```

### **Q4: 如何验证配置是否成功？**

A: 重启网关后，查看日志：
```powershell
Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 50 -Wait
```

如果配置成功，应该不再看到 `"No API key found for provider"` 错误。

### **Q5: API密钥有安全风险怎么办？**

A: 
1. 立即在提供商控制台撤销该密钥
2. 生成新的API密钥
3. 更新配置文件
4. 重启服务

建议使用环境变量或密钥管理服务来存储敏感的API密钥。

---

## 🎯 快速验证

配置完成后，执行以下步骤验证：

1. **检查配置文件**：
   ```powershell
   Test-Path "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"
   # 应该返回 True
   
   Get-Content "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"
   # 应该看到包含apiKey的配置
   ```

2. **重启网关服务**：
   ```powershell
   taskkill /F /IM node.exe
   node zhushou.mjs gateway --bind lan --port 3000
   ```

3. **查看日志**：
   ```powershell
   Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 50 -Wait
   ```
   
   应该不再看到 `"No API key found"` 错误。

4. **测试AI功能**：
   - 访问前端聊天页面
   - 发送一条消息
   - 观察是否能收到AI回复

---

## 📞 需要帮助？

如果遇到问题：

1. 检查API密钥格式是否正确（通常以 `sk-` 开头）
2. 确认配置文件路径正确
3. 验证JSON格式是否有效
4. 查看后端日志中的错误信息
5. 联系技术支持

---

**祝您配置顺利！** 🚀
