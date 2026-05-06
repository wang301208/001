## 🚀 快速开始

### 1. 配置 API 密钥

系统默认使用 OpenAI 模型，需要先配置 API 密钥才能使用 AI 功能。

#### **方法一：使用自动配置脚本（推荐）**

```powershell
cd g:\项目\-
.\configure-api-key.ps1 -Provider "openai" -ApiKey "sk-your-actual-api-key"
```

#### **方法二：手动编辑配置文件**

编辑 `C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json`：

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

详细配置指南请查看 [FRONTEND_API_KEY_CONFIG_GUIDE.md](./FRONTEND_API_KEY_CONFIG_GUIDE.md)

### 2. 启动网关服务
