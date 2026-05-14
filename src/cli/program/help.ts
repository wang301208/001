import type { Command } from "commander";
import { resolveCommitHash } from "../../infra/git-commit.js";
import { formatDocsLink } from "../../terminal/links.js";
import { isRich, theme } from "../../terminal/theme.js";
import { escapeRegExp } from "../../utils.js";
import { PRODUCT_NAME } from "../../wizard/zhushou-constants.js";
import { hasFlag, hasRootVersionAlias } from "../argv.js";
import { formatCliBannerLine, hasEmittedCliBanner } from "../banner.js";
import { replaceCliName, resolveCliName } from "../cli-name.js";
import { CLI_LOG_LEVEL_VALUES, parseCliLogLevelOption } from "../log-level-option.js";
import type { ProgramContext } from "./context.js";
import { getCoreCliCommandsWithSubcommands } from "./core-command-descriptors.js";
import { getSubCliCommandsWithSubcommands } from "./subcli-descriptors.js";

const CLI_NAME = resolveCliName();
const CLI_NAME_PATTERN = escapeRegExp(CLI_NAME);
const ROOT_COMMANDS_WITH_SUBCOMMANDS = new Set([
  ...getCoreCliCommandsWithSubcommands(),
  ...getSubCliCommandsWithSubcommands(),
]);
const ROOT_COMMANDS_HINT =
  "提示：带 * 后缀的命令有子命令。运行 <command> --help 查看详情。";

const EXAMPLES = [
  ["zhushou --tui", "打开 zhushou 终端 UI。"],
  ["zhushou models --help", "显示 models 命令的详细帮助。"],
  [
    "zhushou channels login --verbose",
    "关联个人 WhatsApp Web 并显示 QR 码 + 连接日志。",
  ],
  [
    'zhushou message send --target +15555550123 --message "Hi" --json',
    "通过 Web 会话发送并输出 JSON 结果。",
  ],
  ["zhushou gateway --port 18789", "在本地运行 WebSocket 网络适配器。"],
  [
    "zhushou --dev gateway",
    "运行开发网络适配器（隔离状态/配置），地址 ws://127.0.0.1:19001。",
  ],
  ["zhushou gateway --force", "终止占用默认适配器端口的进程，然后启动。"],
  ["zhushou gateway ...", "通过 WebSocket 控制网络适配器。"],
  [
    'zhushou agent --to +15555550123 --message "Run summary" --deliver',
    "通过网关直接与代理对话；可选发送 WhatsApp 回复。",
  ],
  [
    'zhushou message send --channel telegram --target @mychat --message "Hi"',
    "通过 Telegram 机器人发送。",
  ],
] as const;

export function configureProgramHelp(program: Command, ctx: ProgramContext) {
  program
    .name(CLI_NAME)
    .description("")
    .version(ctx.programVersion)
    .option(
      "--container <name>",
      "在运行中的 Podman/Docker 容器 <name> 内运行 CLI（默认：环境变量 ZHUSHOU_CONTAINER）",
    )
    .option(
      "--dev",
      "开发配置：在 ~/.zhushou-dev 下隔离状态，默认网关端口 19001，并偏移衍生端口（浏览器/画布）",
    )
    .option(
      "--profile <name>",
      "使用命名配置（在 ~/.zhushou-<name> 下隔离 ZHUSHOU_STATE_DIR/ZHUSHOU_CONFIG_PATH）",
    )
    .option(
      "--log-level <level>",
      `全局日志级别覆盖（文件 + 控制台，${CLI_LOG_LEVEL_VALUES}）`,
      parseCliLogLevelOption,
    );

  program.option("--tui", "从根命令打开终端 UI", false);
  program.option("--no-color", "禁用 ANSI 颜色", false);
  program.helpOption("-h, --help", "显示命令帮助");
  program.helpCommand("help [command]", "显示命令帮助");

  program.configureHelp({
    // 按字母顺序排列选项和子命令
    sortSubcommands: true,
    sortOptions: true,
    optionTerm: (option) => theme.option(option.flags),
    subcommandTerm: (cmd) => {
      const isRootCommand = cmd.parent === program;
      const hasSubcommands = isRootCommand && ROOT_COMMANDS_WITH_SUBCOMMANDS.has(cmd.name());
      return theme.command(hasSubcommands ? `${cmd.name()} *` : cmd.name());
    },
  });

  const formatHelpOutput = (str: string) => {
    let output = str;
    const isRootHelp = new RegExp(
      `^Usage:\\s+${CLI_NAME_PATTERN}\\s+\\[options\\]\\s+\\[command\\]\\s*$`,
      "m",
    ).test(output);
    if (isRootHelp && /^Commands:/m.test(output)) {
      output = output.replace(/^Commands:/m, `Commands:\n  ${theme.muted(ROOT_COMMANDS_HINT)}`);
    }

    return output
      .replace(/^Usage:/gm, theme.heading("Usage:"))
      .replace(/^Options:/gm, theme.heading("Options:"))
      .replace(/^Commands:/gm, theme.heading("Commands:"));
  };

  program.configureOutput({
    writeOut: (str) => {
      process.stdout.write(formatHelpOutput(str));
    },
    writeErr: (str) => {
      process.stderr.write(formatHelpOutput(str));
    },
    outputError: (str, write) => write(theme.error(str)),
  });

  if (
    hasFlag(process.argv, "-V") ||
    hasFlag(process.argv, "--version") ||
    hasRootVersionAlias(process.argv)
  ) {
    const commit = resolveCommitHash({ moduleUrl: import.meta.url });
    console.log(
      commit ? `${PRODUCT_NAME} ${ctx.programVersion} (${commit})` : `${PRODUCT_NAME} ${ctx.programVersion}`,
    );
    process.exit(0);
  }

  program.addHelpText("beforeAll", () => {
    if (hasEmittedCliBanner()) {
      return "";
    }
    const rich = isRich();
    const line = formatCliBannerLine(ctx.programVersion, { richTty: rich });
    return `\n${line}\n`;
  });

  const fmtExamples = EXAMPLES.map(
    ([cmd, desc]) => `  ${theme.command(replaceCliName(cmd, CLI_NAME))}\n    ${theme.muted(desc)}`,
  ).join("\n");

  program.addHelpText("afterAll", ({ command }) => {
    if (command !== program) {
      return "";
    }
    const docs = formatDocsLink("/cli", "docs.zhushou.ai/cli");
    return `\n${theme.heading("示例：")}\n${fmtExamples}\n\n${theme.muted("文档：")} ${docs}\n`;
  });
}
