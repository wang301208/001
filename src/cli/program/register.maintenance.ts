import type { Command } from "commander";
import { doctorCommand } from "../../commands/doctor.js";
import { resetCommand } from "../../commands/reset.js";
import { uninstallCommand } from "../../commands/uninstall.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerMaintenanceCommands(program: Command) {
  program
    .command("doctor")
    .description("健康检查 + 快速修复网关和频道")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/doctor", "docs.zhushou.ai/cli/doctor")}\n`,
    )
    .option("--no-workspace-suggestions", "禁用工作空间记忆系统建议", false)
    .option("--yes", "接受默认值而不提示", false)
    .option("--repair", "应用推荐修复而不提示", false)
    .option("--fix", "应用推荐修复（--repair 的别名）", false)
    .option("--force", "应用激进修复（覆盖自定义服务配置）", false)
    .option("--non-interactive", "无提示运行（仅安全迁移）", false)
    .option("--generate-gateway-token", "生成并配置网关令牌", false)
    .option("--deep", "扫描系统服务以查找额外网关安装", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await doctorCommand(defaultRuntime, {
          workspaceSuggestions: opts.workspaceSuggestions,
          yes: Boolean(opts.yes),
          repair: Boolean(opts.repair) || Boolean(opts.fix),
          force: Boolean(opts.force),
          nonInteractive: Boolean(opts.nonInteractive),
          generateGatewayToken: Boolean(opts.generateGatewayToken),
          deep: Boolean(opts.deep),
        });
        defaultRuntime.exit(0);
      });
    });

  program
    .command("reset")
    .description("重置本地配置/状态（保留 CLI 安装）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/reset", "docs.zhushou.ai/cli/reset")}\n`,
    )
    .option("--scope <scope>", "config|config+creds+sessions|full（默认：交互式提示）")
    .option("--yes", "跳过确认提示", false)
    .option("--non-interactive", "禁用提示（需要 --scope + --yes）", false)
    .option("--dry-run", "打印操作但不删除文件", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await resetCommand(defaultRuntime, {
          scope: opts.scope,
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });

  program
    .command("uninstall")
    .description("卸载网关服务 + 本地数据（CLI 保留）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/uninstall", "docs.zhushou.ai/cli/uninstall")}\n`,
    )
    .option("--service", "移除网关服务", false)
    .option("--state", "移除状态 + 配置", false)
    .option("--workspace", "移除工作空间目录", false)
    .option("--app", "移除 macOS 应用", false)
    .option("--all", "移除服务 + 状态 + 工作空间 + 应用", false)
    .option("--yes", "跳过确认提示", false)
    .option("--non-interactive", "禁用提示（需要 --yes）", false)
    .option("--dry-run", "打印操作但不删除文件", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await uninstallCommand(defaultRuntime, {
          service: Boolean(opts.service),
          state: Boolean(opts.state),
          workspace: Boolean(opts.workspace),
          app: Boolean(opts.app),
          all: Boolean(opts.all),
          yes: Boolean(opts.yes),
          nonInteractive: Boolean(opts.nonInteractive),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });
}
