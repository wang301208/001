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

---

## 迁移步骤

### 第一步：诊断当前配置

```bash
openclaw doctor
```

`doctor` 命令会扫描配置文件，列出所有旧版字段及推荐的替代路径。

### 第二步：自动修复（推荐）

```bash
openclaw doctor --fix
```

`--fix` 选项会自动将已知旧版字段迁移到新版路径。操作前会自动备份原始配置。

### 第三步：手动迁移（如需）

若自动修复无法覆盖所有情况，请手动编辑配置文件：

```bash
# 查看当前配置文件路径
openclaw config path

# 打开编辑器
$EDITOR ~/.openclaw/openclaw.json
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
openclaw doctor
```

### 第五步：重新运行向导

```bash
openclaw onboard
# 或仅配置特定章节：
openclaw configure
```

---

## 网络搜索配置迁移

旧版配置中，网络搜索通过环境变量（如 `BRAVE_API_KEY`）自动检测。新版需要在配置中显式指定提供商：

```bash
openclaw configure --section web
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

向导在修改配置前会自动创建快照（存储在 `~/.openclaw/.snapshots/`）。若迁移后出现问题，可通过以下方式回滚：

```bash
# 查看可用快照
openclaw config snapshots list

# 回滚到指定快照
openclaw config snapshots rollback <timestamp>
```

也可以手动从快照目录中复制旧配置文件：

```bash
ls ~/.openclaw/.snapshots/
cp ~/.openclaw/.snapshots/config-snapshot-<timestamp>-<label>.json \
   ~/.openclaw/openclaw.json
```

---

## 常见问题

**Q: 迁移后 `openclaw onboard` 报 "检测到不支持的旧版配置字段"**

运行 `openclaw doctor` 查看具体的旧版字段，按上述步骤手动迁移后重试。

**Q: `doctor --fix` 提示 "无法自动迁移某字段"**

部分旧版字段没有直接等价的新版字段，需要根据实际需求手动决定是否保留（删除或重新在新版路径下配置）。

**Q: 环境变量 `OPENCLAW_*` 是否需要修改？**

不需要。环境变量名称未发生变化，所有现有的 `OPENCLAW_GATEWAY_TOKEN`、`OPENCLAW_GATEWAY_PASSWORD` 等环境变量继续有效。
