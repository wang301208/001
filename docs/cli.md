# CLI 与 TUI

助手以 CLI 和终端 TUI 为主入口。源码仓库内使用 `pnpm start -- <command>`，构建或安装后使用 `assistant <command>`。

## 根命令

```bash
assistant --help
assistant setup --wizard
assistant onboard --flow quickstart
assistant configure
assistant config validate
assistant doctor
assistant status
```

## 模型

```bash
assistant models status
assistant models status --probe
assistant models list --all
assistant models list --provider openai
assistant models set openai/gpt-4.1
assistant models auth login --provider openai
assistant models auth paste-token --provider anthropic
```

## TUI

启动：

```bash
assistant tui
assistant tui --session main
assistant tui --message "总结当前项目"
assistant tui --history-limit 200
```

默认模式会由 TUI 进程启动本地 Python gateway 子进程，并通过 stdin/stdout JSON-RPC 通信。只有传入 `--url` 时才连接远端 Gateway WebSocket。

```bash
assistant tui --url ws://127.0.0.1:3000
```

## TUI 斜杠命令

常用命令：

```text
/help
/robot
/gateway-status
/capabilities
/tools-effective
/model
/models
/session
/sessions
/new
/reset
/voice
/tasks
/config
/logs
/skills
/mcp-tools
/mcp-call
/experience-search
/session-recall
/self-model
/user-model
```

自然语言控制可通过 `/robot` 查看提示。语音入口使用 `/voice`，成功识别后会作为普通自然语言消息提交。

## 按键绑定

```text
Ctrl+C      清空 / 中断 / 退出
Ctrl+D      退出
Ctrl+L      打开模型选择器
Ctrl+G      打开代理选择器
Ctrl+P      打开会话选择器
Ctrl+O      展开或收起工具输出
Ctrl+T      显示或隐藏思考过程
Alt+Enter   运行中追加后续任务
Alt+Up      提交最早的排队消息
Shift+Tab   显示或隐藏治理面板
!<cmd>      执行本地命令
/help       查看命令
```

## 个性与身份

显示身份可配置：

```bash
assistant config set ui.assistant.name 助手
assistant config set ui.assistant.avatar 助
```

智能体人格和系统提示可通过 `systemPromptOverride` 控制：

```bash
assistant config set agents.defaults.systemPromptOverride "你是助手，回答直接、清晰、可执行。"
```

也可为单个代理配置：

```bash
assistant config set agents.list.0.systemPromptOverride "你是项目维护代理，优先修复构建和测试。"
```

## 会话

```bash
assistant sessions
assistant sessions --agent main
assistant sessions --all-agents
assistant sessions cleanup --dry-run
assistant sessions cleanup --enforce
```

TUI 内：

```text
/sessions
/session main
/new
/reset
/session-recall 部署失败
```

## 任务与治理

```bash
assistant tasks list
assistant tasks show <task-id>
assistant governance status
assistant autonomy status
```

TUI 内：

```text
/tasks
/task-create {"goal":"检查构建状态","kind":"short"}
/governance
```
