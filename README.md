# 助手

助手是一个本地优先的智能体运行时，提供 CLI、终端 TUI、模型接入、会话、技能、MCP、任务和治理能力。

## 快速入门

要求：Node.js 22.14+、pnpm 10+。

```bash
pnpm install
pnpm build
pnpm quickstart:smoke
```

初始化配置：

```bash
zhushou onboard --flow quickstart
```

如果从源码仓库运行，也可以使用：

```bash
pnpm start -- onboard --flow quickstart
```

开始第一次对话：

```bash
zhushou tui
```

或直接发送第一条消息：

```bash
zhushou tui --message "你好，介绍一下你能做什么"
```

源码运行等价命令：

```bash
pnpm start -- tui --message "你好，介绍一下你能做什么"
```

## 常用命令

```bash
zhushou --help
zhushou onboard --flow quickstart
zhushou configure
zhushou models status
zhushou models list --all
zhushou tui
zhushou sessions
zhushou doctor
```

## 文档

- [快速入门](docs/quickstart.md)
- [CLI 与 TUI](docs/cli.md)
- [配置](docs/configuration.md)
- [分支与交付规范](docs/branch-policy.md)

## 配置位置

默认状态目录是 `~/.zhushou`，默认配置文件是 `~/.wang301208/zhushou.json`。

可用环境变量覆盖：

```bash
ZHUSHOU_STATE_DIR=/path/to/state
ZHUSHOU_CONFIG_PATH=/path/to/zhushou.json
```
