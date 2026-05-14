import type { Command } from "commander";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import {
  agentsAddCommand,
  agentsBindingsCommand,
  agentsBindCommand,
  agentsDeleteCommand,
  agentsListCommand,
  agentsSetIdentityCommand,
  agentsUnbindCommand,
} from "../../commands/agents.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { hasExplicitOptions } from "../command-options.js";
import { createDefaultDeps } from "../deps.js";
import { formatHelpExamples } from "../help-format.js";
import { collectOption } from "./helpers.js";

export function registerAgentCommands(program: Command, args: { agentChannelOptions: string }) {
  program
    .command("agent")
    .description("通过网关运行代理交互（使用 --local 进行内嵌模式）")
    .requiredOption("-m, --message <text>", "代理消息正文")
    .option("-t, --to <number>", "E.164 格式的接收者号码，用于派生会话密钥")
    .option("--session-id <id>", "使用显式会话 ID")
    .option("--agent <id>", "代理 ID（覆盖路由绑定）")
    .option("--thinking <level>", "思考级别：off | minimal | low | medium | high | xhigh")
    .option("--verbose <on|off>", "持久化代理详细级别用于该会话")
    .option(
      "--channel <channel>",
      `投递频道：${args.agentChannelOptions}（省略则使用主会话频道）`,
    )
    .option("--reply-to <target>", "投递目标覆盖（与会话路由分开）")
    .option("--reply-channel <channel>", "投递频道覆盖（与路由分开）")
    .option("--reply-account <id>", "投递账号 ID 覆盖")
    .option(
      "--local",
      "在本地运行内嵌代理（需要 shell 中有模型提供商 API 密钥）",
      false,
    )
    .option("--deliver", "将代理回复发送回所选频道", false)
    .option("--json", "以 JSON 格式输出结果", false)
    .option(
      "--timeout <seconds>",
      "覆盖代理命令超时（秒，默认 600 或配置值）",
    )
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例：")}
${formatHelpExamples([
  ['zhushou agent --to +15555550123 --message "status update"', "启动新会话。"],
  ['zhushou agent --agent ops --message "Summarize logs"', "使用指定代理。"],
  [
    'zhushou agent --session-id 1234 --message "Summarize inbox" --thinking medium',
    "以指定思考级别访问会话。",
  ],
  [
    'zhushou agent --to +15555550123 --message "Trace logs" --verbose on --json',
    "启用详细日志和 JSON 输出。",
  ],
  ['zhushou agent --to +15555550123 --message "Summon reply" --deliver', "投递回复。"],
  [
    'zhushou agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"',
    "将回复发送到不同的频道/目标。",
  ],
])}

${theme.muted("文档：")} ${formatDocsLink("/cli/agent", "docs.zhushou.ai/cli/agent")}`,
    )
    .action(async (opts) => {
      const verboseLevel =
        typeof opts.verbose === "string" ? normalizeLowercaseStringOrEmpty(opts.verbose) : "";
      setVerbose(verboseLevel === "on");
      // Build default deps (keeps parity with other commands; future-proofing).
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(opts, defaultRuntime, deps);
      });
    });

  const agents = program
    .command("agents")
    .description("管理隔离代理（工作空间 + 认证 + 路由）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/agents", "docs.zhushou.ai/cli/agents")}\n`,
    );

  agents
    .command("list")
    .description("列出已配置的代理")
    .option("--json", "输出 JSON 而非文本", false)
    .option("--bindings", "包含路由绑定", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsListCommand(
          { json: Boolean(opts.json), bindings: Boolean(opts.bindings) },
          defaultRuntime,
        );
      });
    });

  agents
    .command("bindings")
    .description("列出路由绑定")
    .option("--agent <id>", "按代理 ID 筛选")
    .option("--json", "输出 JSON 而非文本", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsBindingsCommand(
          {
            agent: opts.agent as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("bind")
    .description("为代理添加路由绑定")
    .option("--agent <id>", "代理 ID（默认为当前默认代理）")
    .option(
      "--bind <channel[:accountId]>",
      "要添加的绑定（可重复）。若省略 accountId，则由频道默认值/钩子解析。",
      collectOption,
      [],
    )
    .option("--json", "输出 JSON 摘要", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsBindCommand(
          {
            agent: opts.agent as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("unbind")
    .description("移除代理的路由绑定")
    .option("--agent <id>", "代理 ID（默认为当前默认代理）")
    .option("--bind <channel[:accountId]>", "要移除的绑定（可重复）", collectOption, [])
    .option("--all", "移除该代理的所有绑定", false)
    .option("--json", "输出 JSON 摘要", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsUnbindCommand(
          {
            agent: opts.agent as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            all: Boolean(opts.all),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("add [name]")
    .description("添加新的隔离代理")
    .option("--workspace <dir>", "新代理的工作空间目录")
    .option("--model <id>", "该代理的模型 ID")
    .option("--agent-dir <dir>", "该代理的状态目录")
    .option("--bind <channel[:accountId]>", "路由频道绑定（可重复）", collectOption, [])
    .option("--non-interactive", "禁用提示；需要 --workspace", false)
    .option("--json", "输出 JSON 摘要", false)
    .action(async (name, opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasFlags = hasExplicitOptions(command, [
          "workspace",
          "model",
          "agentDir",
          "bind",
          "nonInteractive",
        ]);
        await agentsAddCommand(
          {
            name: typeof name === "string" ? name : undefined,
            workspace: opts.workspace as string | undefined,
            model: opts.model as string | undefined,
            agentDir: opts.agentDir as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            json: Boolean(opts.json),
          },
          defaultRuntime,
          { hasFlags },
        );
      });
    });

  agents
    .command("set-identity")
    .description("更新代理身份（名称/主题/表情/头像）")
    .option("--agent <id>", "要更新的代理 ID")
    .option("--workspace <dir>", "用于定位代理 + IDENTITY.md 的工作空间目录")
    .option("--identity-file <path>", "显式 IDENTITY.md 路径")
    .option("--from-identity", "从 IDENTITY.md 读取值", false)
    .option("--name <name>", "身份名称")
    .option("--theme <theme>", "身份主题")
    .option("--emoji <emoji>", "身份表情")
    .option("--avatar <value>", "身份头像（工作空间路径、http(s) URL 或 data URI）")
    .option("--json", "输出 JSON 摘要", false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例：")}
${formatHelpExamples([
  ['zhushou agents set-identity --agent main --name "助手" --emoji "🤖"', "设置名称 + 表情。"],
  ["zhushou agents set-identity --agent main --avatar avatars/zhushou.png", "设置头像路径。"],
  [
    "zhushou agents set-identity --workspace ~/.zhushou/workspace --from-identity",
    "从 IDENTITY.md 加载。",
  ],
  [
    "zhushou agents set-identity --identity-file ~/.zhushou/workspace/IDENTITY.md --agent main",
    "使用指定的 IDENTITY.md。",
  ],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsSetIdentityCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            identityFile: opts.identityFile as string | undefined,
            fromIdentity: Boolean(opts.fromIdentity),
            name: opts.name as string | undefined,
            theme: opts.theme as string | undefined,
            emoji: opts.emoji as string | undefined,
            avatar: opts.avatar as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("delete <id>")
    .description("删除代理并清理工作空间/状态")
    .option("--force", "跳过确认", false)
    .option("--json", "输出 JSON 摘要", false)
    .action(async (id, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsDeleteCommand(
          {
            id: String(id),
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await agentsListCommand({}, defaultRuntime);
    });
  });
}
