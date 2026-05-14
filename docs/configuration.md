# 配置

助手的默认状态目录是 `~/.zhushou`，默认配置文件是 `~/.wang301208/zhushou.json`。

可用环境变量覆盖：

```bash
ZHUSHOU_STATE_DIR=/path/to/state
ZHUSHOU_CONFIG_PATH=/path/to/zhushou.json
```

查看与校验：

```bash
zhushou config file
zhushou config validate
zhushou config schema
zhushou config get agents.defaults.model
zhushou config get models.providers
```

## 配置命令

```bash
zhushou config get <path>
zhushou config set <path> <value>
zhushou config unset <path>
zhushou config file
zhushou config schema
zhushou config validate
zhushou config snapshots list
zhushou config snapshots rollback <timestamp>
```

复杂值使用 JSON：

```bash
zhushou config set agents.defaults.model '{"primary":"openai/gpt-4.1","fallbacks":["anthropic/claude-sonnet-4"]}'
```

## 模型 Provider

模型 provider 位于 `models.providers`。每个 provider 包含 `baseUrl`、`api`、认证信息和模型列表。

支持的 API 类型包括：

```text
openai-completions
openai-responses
openai-codex-responses
anthropic-messages
google-generative-ai
github-copilot
bedrock-converse-stream
ollama
azure-openai-responses
```

最小 OpenAI 兼容配置：

```json
{
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "api": "openai-responses",
        "apiKey": { "source": "env", "id": "OPENAI_API_KEY" },
        "models": [
          {
            "id": "gpt-4.1",
            "name": "GPT-4.1",
            "api": "openai-responses",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 1048576,
            "maxTokens": 32768
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "openai/gpt-4.1"
    }
  }
}
```

Ollama 示例：

```json
{
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://127.0.0.1:11434",
        "api": "ollama",
        "models": [
          {
            "id": "llama3.1",
            "name": "Llama 3.1",
            "api": "ollama",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "ollama/llama3.1"
    }
  }
}
```

## Agent 默认项

常用路径：

```text
agents.defaults.model
agents.defaults.imageModel
agents.defaults.workspace
agents.defaults.repoRoot
agents.defaults.systemPromptOverride
agents.defaults.skills
agents.defaults.contextTokens
agents.defaults.timeoutSeconds
agents.defaults.memorySearch
agents.defaults.contextInjection
```

单代理覆盖：

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "name": "助手",
        "default": true,
        "model": "openai/gpt-4.1",
        "workspace": "G:/项目/-",
        "systemPromptOverride": "你是助手，优先给出可执行结果。"
      }
    ]
  }
}
```

## Gateway 与 TUI

默认 Gateway 端口是 `3000`。TUI 默认使用本地嵌入式 stdio gateway，不需要额外 URL。

常用路径：

```text
gateway.port
gateway.bind
gateway.auth
gateway.remote.url
gateway.remote.token
```

远端 gateway：

```bash
zhushou tui --url ws://127.0.0.1:3000
```

## MCP

MCP 配置位于 `mcp`。常用检查命令：

```bash
zhushou mcp --help
zhushou tui
```

TUI 内：

```text
列出 MCP 工具
调用MCP工具 <tool> <json>
```

## 发现所有选项

配置 schema 是最终来源：

```bash
zhushou config schema
```

也可以搜索源码类型：

```text
src/config/types.zhushou.ts
src/config/types.models.ts
src/config/types.agent-defaults.ts
src/config/types.agents.ts
src/config/schema.help.ts
```
