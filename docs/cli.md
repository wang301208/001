# CLI 与 TUI

助手以 CLI 和终端 TUI 为主入口。源码仓库内使用 `pnpm start -- <command>`，构建或安装后使用 `zhushou <command>`。

## 根命令

```bash
zhushou --help
zhushou setup --wizard
zhushou onboard --flow quickstart
zhushou configure
zhushou config validate
zhushou doctor
zhushou status
```

## 模型

```bash
zhushou models status
zhushou models status --probe
zhushou models list --all
zhushou models list --provider openai
zhushou models set openai/gpt-4.1
zhushou models auth login --provider openai
zhushou models auth paste-token --provider anthropic
```

## TUI

启动：

```bash
zhushou tui
zhushou tui --session main
zhushou tui --message "总结当前项目"
zhushou tui --history-limit 200
```

默认模式会由 TUI 进程启动本地 Python gateway 子进程，并通过 stdin/stdout JSON-RPC 通信。只有传入 `--url` 时才连接远端 Gateway WebSocket。

```bash
zhushou tui --url ws://127.0.0.1:3000
```

## TUI 自然语言直达

TUI 内只需要直接输入自然语言目标。系统会判断这是聊天、任务执行、功能调用、MCP 调用、本地命令还是后端 RPC，并映射到对应能力。

```text
查看状态
打开设置
列出任务
创建任务 修复模型 | 修复远程模型调用 | long | high
切换模型 longat/LongCat-Flash-Lite
列出当前可调用工具
调用接口 business.tasks.list {"status":"running"}
调用MCP工具 probe__echo {"text":"hello"}
执行本地命令 pnpm test
搜索过去对话 部署失败
更新用户模型 喜欢直接执行
开始语音
```

输入以 `/` 或 `!` 开头的旧式快捷入口会被拦截，并提示改用自然语言。

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
直接输入目标即可调用功能
```

## 个性与身份

显示身份可配置：

```bash
zhushou config set ui.zhushou.name 助手
zhushou config set ui.zhushou.avatar 助
```

智能体人格和系统提示可通过 `systemPromptOverride` 控制：

```bash
zhushou config set agents.defaults.systemPromptOverride "你是助手，回答直接、清晰、可执行。"
```

也可为单个代理配置：

```bash
zhushou config set agents.list.0.systemPromptOverride "你是项目维护代理，优先修复构建和测试。"
```

## 会话

```bash
zhushou sessions
zhushou sessions --agent main
zhushou sessions --all-agents
zhushou sessions cleanup --dry-run
zhushou sessions cleanup --enforce
```

TUI 内：

```text
列出会话
切换会话 main
新建会话
重置会话
回忆会话 部署失败
```

## 任务与治理

```bash
zhushou tasks list
zhushou tasks show <task-id>
zhushou governance status
zhushou autonomy status
```

TUI 内：

```text
列出任务
创建任务 检查构建状态 | 检查构建状态 | short | high
查看治理状态
```
