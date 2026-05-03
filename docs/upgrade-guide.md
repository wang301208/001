# 升级指引

本文档说明如何从旧版配置（包含 `routing`、`providers`、`bot` 等旧版顶级字段）迁移到新版配置格式。

---

## 为什么需要迁移？

新版向导严格拒绝包含旧版字段的配置文件。这些字段在新版中不再被识别，若不迁移，向导将无法启动。

**需要迁移的旧版字段：**

| 旧版字段 | 替代路径 |
|----------|----------|
| `routing.allowFrom` | 各频道配置中的 `allowFrom` 字段 |
| `routing.*` | 网关/频道级别的路由配置 |
| `providers.*` | `auth.profiles.<id>` |
| `bot.name`、`bot.*` | `agents.defaults.*` |
| `agent.*` | `agents.*` |
| `memorySearch.*` | `agents.defaults.memorySearch.*` |
| `heartbeat.*` | `agents.defaults.heartbeat.*` 或 `channels.defaults.heartbeat.*` |
| `gateway.token` | `gateway.auth.token` |
| `gateway.password` | `gateway.auth.password` |
| `gateway.bind` 中的主机别名（如 `0.0.0.0`、`localhost`） | `gateway.bind=lan`、`loopback`、`custom`、`tailnet` 或 `auto` |
| `agents.*.sandbox.perSession` | `agents.*.sandbox.scope` |
| 顶级频道字段（如 `telegram.*`、`whatsapp.*`） | `channels.<channelId>.*` |
| `tools.web.search.<provider>.*` | `plugins.entries.<provider>.config.webSearch.*` |
| `tools.web.x_search.apiKey` | `plugins.entries.xai.config.webSearch.apiKey` |

---

## 迁移步骤

### 第一步：诊断当前配置

```bash
zhushou doctor
```

`doctor` 命令会扫描配置文件，列出所有旧版字段及推荐的替代路径。

### 第二步：自动修复（推荐）

```bash
zhushou doctor --fix
```

`--fix` 选项会自动将已知旧版字段迁移到新版路径。操作前会自动备份原始配置。

### 第三步：手动迁移（如需）

若自动修复无法覆盖所有情况，请手动编辑配置文件：

```bash
# 查看当前配置文件路径
zhushou config file

# 打开编辑器
$EDITOR ~/.zhushou/zhushou.json
```

**示例：迁移 `routing.allowFrom`**

旧版：
```json
{
  "routing": {
    "allowFrom": ["@user1", "@user2"]
  }
}
```

新版（在频道配置中指定）：
```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["@user1", "@user2"]
    }
  }
}
```

**示例：迁移 `providers`**

旧版：
```json
{
  "providers": {
    "openai": { "apiKey": "sk-..." }
  }
}
```

新版：
```json
{
  "auth": {
    "profiles": {
      "openai:default": {
        "provider": "openai",
        "mode": "apiKey"
      }
    }
  }
}
```

**示例：迁移 `bot`**

旧版：
```json
{
  "bot": {
    "name": "MyAssistant",
    "workspace": "/home/user/assistant"
  }
}
```

新版：
```json
{
  "agents": {
    "defaults": {
      "name": "MyAssistant",
      "workspace": "/home/user/assistant"
    }
  }
}
```

### 第四步：验证配置

迁移完成后，再次运行 `doctor` 确认无遗留问题：

```bash
zhushou doctor
```

### 第五步：重新运行向导

```bash
zhushou onboard
# 或仅配置特定章节：
zhushou configure
```

---

## 网络搜索配置迁移

旧版配置中，网络搜索通过环境变量（如 `BRAVE_API_KEY`）自动检测。新版需要在配置中显式指定提供商：

```bash
zhushou configure --section web
```

或在配置文件中手动添加：
```json
{
  "tools": {
    "web": {
      "search": {
        "enabled": true,
        "provider": "brave"
      }
    }
  },
  "plugins": {
    "entries": {
      "brave": {
        "enabled": true,
        "config": {
          "webSearch": {
            "apiKey": "your-brave-api-key"
          }
        }
      }
    }
  }
}
```

---

## 回滚策略

向导在修改已有配置前会自动创建快照（存储在 `~/.zhushou/.snapshots/`）。若迁移后出现问题，可通过以下方式回滚：

```bash
# 查看可用快照
zhushou config snapshots list

# 回滚到指定快照
zhushou config snapshots rollback <timestamp>
```

也可以手动从快照目录中复制旧配置内容。快照文件包含 `{ timestamp, label, config }`，请将其中的 `config` 对象写回配置文件：

```bash
ls ~/.zhushou/.snapshots/
```

---

## 常见问题

**Q: 迁移后 `zhushou onboard` 报 "检测到不支持的旧版配置字段"**

运行 `zhushou doctor` 查看具体的旧版字段，按上述步骤手动迁移后重试。

**Q: `doctor --fix` 提示 "无法自动迁移某字段"**

部分旧版字段没有直接等价的新版字段，需要根据实际需求手动决定是否保留（删除或重新在新版路径下配置）。

**Q: 配置向导是否继续识别旧字段或旧别名？**

不识别。向导只接受新项目语法；任何旧字段、旧别名或历史兼容路径都会被视为错误，需要删除或迁移到新版配置层级后再运行。
