# OpenAI API密钥配置指南

## 📋 问题诊断

系统日志显示以下错误：
```
Error: No API key found for provider "openai"
Auth store: C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json
```

这导致：
- ❌ AI代理无法调用模型
- ❌ 定时任务执行失败
- ❌ 所有需要AI的功能无法使用

---

## 🔧 解决方案

### **步骤1：获取OpenAI API密钥**

1. 访问 [OpenAI API Keys页面](https://platform.openai.com/api-keys)
2. 登录您的OpenAI账户
3. 点击 **"Create new secret key"**
4. 复制生成的密钥（格式：`sk-...`）

> ⚠️ **重要：** 请妥善保管您的API密钥，不要泄露给他人！

---

### **步骤2：配置API密钥**

我已为您创建了认证文件模板。请按以下步骤操作：

#### **方法A：手动编辑（推荐）**

1. 打开文件：`C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`

2. 将 `"sk-your-api-key-here"` 替换为您的真实API密钥

   **示例：**
   ```json
   {
       "profiles": {
           "openai": {
               "provider": "openai",
               "apiKey": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
           }
       }
   }
   ```

3. 保存文件

#### **方法B：使用PowerShell命令**

在PowerShell中执行（替换 `YOUR_API_KEY` 为您的真实密钥）：

```powershell
$config = @{
    profiles = @{
        openai = @{
            apiKey = "YOUR_API_KEY"
            provider = "openai"
        }
    }
}
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json" -Encoding UTF8
```

---

### **步骤3：重启网关服务**

配置完成后，需要重启网关服务使配置生效：

```powershell
# 停止当前服务
taskkill /F /IM node.exe

# 重新启动网关
cd g:\项目\-
node zhushou.mjs gateway --bind lan --port 3000
```

---

### **步骤4：验证配置**

1. 查看启动日志，确认不再出现 `"No API key found"` 错误
2. 触发一个需要AI代理的任务
3. 观察任务是否正常执行

---

## 📝 配置文件说明

**文件位置：** `C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`

**文件格式：**
```json
{
    "profiles": {
        "openai": {
            "provider": "openai",
            "apiKey": "sk-..."
        }
    }
}
```

**支持的提供商：**
- `openai` - OpenAI GPT系列
- `anthropic` - Anthropic Claude系列
- `google` - Google Gemini系列
- 更多提供商请参考系统文档

---

## ❓ 常见问题

### **Q1: 如何测试API密钥是否有效？**

运行以下命令测试：
```powershell
curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_API_KEY"
```

如果返回模型列表，说明密钥有效。

### **Q2: 可以使用多个API密钥吗？**

可以。在配置文件中添加多个profile：
```json
{
    "profiles": {
        "openai-primary": {
            "provider": "openai",
            "apiKey": "sk-..."
        },
        "openai-backup": {
            "provider": "openai",
            "apiKey": "sk-..."
        }
    }
}
```

### **Q3: API密钥有安全风险怎么办？**

1. 立即在OpenAI控制台撤销该密钥
2. 生成新的API密钥
3. 更新配置文件
4. 重启服务

### **Q4: 免费额度用完了怎么办？**

1. 升级到付费账户
2. 或配置其他提供商的API密钥作为备选
3. 系统会自动回退到可用的模型

---

## 🚀 下一步

配置完成后，您可以：

1. ✅ 测试AI代理功能
2. ✅ 检查定时任务是否正常执行
3. ✅ 查看系统日志确认无错误
4. ✅ 探索更多AI功能

---

## 📞 需要帮助？

如果遇到问题：
1. 检查日志文件中的错误信息
2. 确认API密钥格式正确（以 `sk-` 开头）
3. 验证网络连接正常
4. 联系技术支持

---

**祝您使用愉快！** 🎉
