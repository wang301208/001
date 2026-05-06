# 🔑 API密钥配置快速指南

## ⚡ 最快速的配置方法

```powershell
cd g:\项目\-
.\configure-api-key.ps1 -Provider "openai" -ApiKey "sk-your-actual-api-key"
taskkill /F /IM node.exe
node zhushou.mjs gateway --bind lan --port 3000
```

---

## 📋 支持的模型提供商

| 提供商 | Provider ID | 获取地址 |
|--------|-------------|----------|
| OpenAI | `openai` | https://platform.openai.com/api-keys |
| Anthropic | `anthropic` | https://console.anthropic.com/settings/keys |
| Google | `google` | https://makersuite.google.com/app/apikey |
| DeepSeek | `deepseek` | https://platform.deepseek.com/api_keys |
| Moonshot | `moonshot` | https://platform.moonshot.cn/console/api-keys |

---

## 🔧 三种配置方法

### **方法1：自动脚本（推荐）**

```powershell
.\configure-api-key.ps1 -Provider "openai" -ApiKey "sk-xxx"
```

### **方法2：前端设置页面**

1. 访问 http://localhost:3000/settings
2. 填写远程模型配置
3. 点击"保存配置"
4. 按提示手动编辑配置文件

### **方法3：手动编辑**

编辑文件：`C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`

```json
{
  "version": 1,
  "profiles": {
    "openai:default": {
      "type": "api_key",
      "provider": "openai",
      "key": "sk-your-api-key"
    }
  }
}
```

---

## ✅ 验证配置

```powershell
# 1. 检查配置文件是否存在
Test-Path "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"

# 2. 查看配置内容
Get-Content "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"

# 3. 重启服务并查看日志
taskkill /F /IM node.exe
node zhushou.mjs gateway --bind lan --port 3000
```

如果配置成功，日志中不应再出现 `"No API key found"` 错误。

---

## ❓ 常见问题

**Q: 为什么前端配置不生效？**  
A: 前端配置保存在浏览器localStorage，后端需要读取文件系统中的配置文件，两者不会自动同步。

**Q: 配置后必须重启服务吗？**  
A: 是的，后端只在启动时读取一次配置文件。

**Q: 可以配置多个API密钥吗？**  
A: 可以，在配置文件中添加多个profile即可。

---

📖 **详细文档**: [FRONTEND_API_KEY_CONFIG_GUIDE.md](./FRONTEND_API_KEY_CONFIG_GUIDE.md)
