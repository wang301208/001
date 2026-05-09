# 快速入门

目标：从安装到第一次对话控制在两分钟内，路径清晰，不依赖 Web 前端。

## 1. 安装

```bash
pnpm install
pnpm build
```

验证快速入门资产：

```bash
pnpm quickstart:smoke
```

如果已经安装为全局命令，后续使用 `assistant`。如果在源码仓库内运行，使用 `pnpm start -- <command>`。

## 2. 设置

交互式快速设置：

```bash
assistant onboard --flow quickstart
```

源码仓库运行：

```bash
pnpm start -- onboard --flow quickstart
```

无交互最小初始化示例：

```bash
assistant onboard --flow quickstart --non-interactive --accept-risk --auth-choice skip --skip-channels --skip-skills --skip-daemon --skip-ui
```

远程或自定义 OpenAI 兼容模型示例：

```bash
assistant onboard --flow quickstart --auth-choice custom-api-key --custom-base-url https://api.example.com/v1 --custom-api-key "$API_KEY" --custom-model-id provider/model
```

设置后检查：

```bash
assistant config file
assistant config validate
assistant models status
```

## 3. 第一次对话

打开 TUI：

```bash
assistant tui
```

直接发送第一条消息：

```bash
assistant tui --message "你好，介绍一下你能做什么"
```

源码仓库运行：

```bash
pnpm start -- tui --message "你好，介绍一下你能做什么"
```

## 4. 两分钟路径

本地源码路径：

```bash
pnpm install
pnpm build
pnpm start -- onboard --flow quickstart
pnpm start -- tui --message "你好"
```

全局命令路径：

```bash
assistant onboard --flow quickstart
assistant tui --message "你好"
```

## 5. 常见问题

`node assistant.mjs --help` 提示缺少 `dist/entry.(m)js` 时，说明当前是未构建源码树。执行：

```bash
pnpm install
pnpm build
```

模型不可用时，先检查：

```bash
assistant models status --probe
assistant config get agents.defaults.model
assistant config get models.providers
```

TUI 无响应时，先检查：

```bash
assistant doctor
assistant gateway status
assistant logs
```
