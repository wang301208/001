# OpenAI API密钥配置指南

## ⚠️ 当前问题

您的助手系统缺少OpenAI API密钥，导致AI代理无法工作。

**错误信息**：
```
Error: No API key found for provider "openai"
Auth store: C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json
```

---

## 🔧 解决方案（三选一）

### **方法1：通过CLI配置（最简单）**

```bash
zhushou agents add main
```

执行后会提示您输入API密钥，按照指引操作即可。

---

### **方法2：手动创建认证文件**

#### **步骤1：获取您的OpenAI API密钥**

1. 访问 [OpenAI API Keys页面](https://platform.openai.com/api-keys)
2. 登录您的OpenAI账户
3. 点击 "Create new secret key"
4. 复制生成的密钥（格式：`sk-...`）

⚠️ **重要**：请妥善保管您的API密钥，不要泄露给他人！

#### **步骤2：创建认证文件**

在PowerShell中执行以下命令（替换 `YOUR_API_KEY` 为您的实际密钥）：

```powershell
$apiKey = "sk-your-actual-api-key-here"

$config = @{
    profiles = @{
        openai = @{
            apiKey = $apiKey
            provider = "openai"
        }
    }
}

$config | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json" -Encoding UTF8

Write-Host "✅ API密钥已配置成功！" -ForegroundColor Green
```

#### **步骤3：验证配置**

```powershell
Get-Content "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"
```

应该看到类似以下内容：
```json
{
  "profiles": {
    "openai": {
      "apiKey": "sk-...",
      "provider": "openai"
    }
  }
}
```

---

### **方法3：设置环境变量**

如果您不想创建配置文件，可以设置环境变量：

#### **临时设置（当前会话有效）**

```powershell
$env:OPENAI_API_KEY="sk-your-actual-api-key-here"
```

#### **永久设置**

1. **打开系统环境变量设置**
   ```powershell
   sysdm.cpl
   ```

2. **切换到"高级"标签 → 点击"环境变量"**

3. **在"用户变量"或"系统变量"中添加**：
   - 变量名：`OPENAI_API_KEY`
   - 变量值：`sk-your-actual-api-key-here`

4. **重启网关服务使配置生效**
   ```powershell
   taskkill /F /IM node.exe
   node zhushou.mjs gateway --bind lan --port 3000 --allow-unconfigured
   ```

---

## ✅ 验证配置是否成功

### **方法1：查看日志**

重启网关后，查看日志是否还有API密钥错误：

```powershell
Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 50 -Wait
```

如果配置成功，应该不再看到：
```
No API key found for provider "openai"
```

### **方法2：测试AI代理**

尝试触发一个需要AI代理的任务，观察是否能正常执行。

### **方法3：检查认证文件**

```powershell
Test-Path "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"
```

应该返回 `True`。

---

## 📝 常见问题

### **Q1: 如何获取OpenAI API密钥？**

A: 访问 [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)，登录后创建新密钥。

### **Q2: API密钥有费用吗？**

A: 是的，使用OpenAI API需要付费。您可以在 [OpenAI计费页面](https://platform.openai.com/usage) 查看使用情况。

### **Q3: 可以使用其他模型提供商吗？**

A: 可以。助手支持多个模型提供商，包括：
- OpenAI (gpt-4, gpt-3.5-turbo, etc.)
- Anthropic (claude-*)
- Google (gemini-*)
- 本地模型 (ollama, etc.)

配置方式类似，只需在 `auth-profiles.json` 中添加对应的配置。

### **Q4: 配置文件的位置在哪里？**

A: `C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`

### **Q5: 配置后需要重启服务吗？**

A: 是的，建议重启网关服务以使配置生效：
```powershell
taskkill /F /IM node.exe
node zhushou.mjs gateway --bind lan --port 3000 --allow-unconfigured
```

---

## 🎯 下一步

配置完API密钥后，您的助手系统将能够：

✅ **执行AI代理任务** - 调用GPT模型进行智能决策
✅ **运行定时任务** - cron任务可以正常执行
✅ **自治循环工作** - 完整的自我组织、自我修复能力
✅ **实时状态监控** - WebSocket连接正常，仪表盘显示完整数据

---

## 📞 需要帮助？

如果配置过程中遇到问题，请检查：

1. **API密钥格式是否正确** - 应该以 `sk-` 开头
2. **文件路径是否正确** - `C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`
3. **JSON格式是否有效** - 可以使用在线JSON验证工具检查
4. **文件编码是否为UTF-8** - PowerShell的 `Out-File -Encoding UTF8` 会确保正确编码

祝您配置顺利！🚀
