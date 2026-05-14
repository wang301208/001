import type { Command } from "commander";
import { backupVerifyCommand } from "../../commands/backup-verify.js";
import { backupCreateCommand } from "../../commands/backup.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

export function registerBackupCommand(program: Command) {
  const backup = program
    .command("backup")
    .description("创建和验证 zhushou 状态的本地备份归档")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/backup", "docs.zhushou.ai/cli/backup")}\n`,
    );

  backup
    .command("create")
    .description("写入配置、凭据、会话和工作空间的备份归档")
    .option("--output <path>", "归档路径或目标目录")
    .option("--json", "输出 JSON", false)
    .option("--dry-run", "打印备份计划但不写入归档", false)
    .option("--verify", "写入后验证归档", false)
    .option("--only-config", "仅备份活动的 JSON 配置文件", false)
    .option("--no-include-workspace", "从备份中排除工作空间目录")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          ["zhushou backup create", "在当前目录创建带时间戳的备份。"],
          [
            "zhushou backup create --output ~/Backups",
            "将归档写入现有备份目录。",
          ],
          [
            "zhushou backup create --dry-run --json",
            "预览归档计划但不写入任何文件。",
          ],
          [
            "zhushou backup create --verify",
            "创建归档并立即验证其清单和载荷布局。",
          ],
          [
            "zhushou backup create --no-include-workspace",
            "备份状态/配置，不含代理工作空间文件。",
          ],
          ["zhushou backup create --only-config", "仅备份活动的 JSON 配置文件。"],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await backupCreateCommand(defaultRuntime, {
          output: opts.output as string | undefined,
          json: Boolean(opts.json),
          dryRun: Boolean(opts.dryRun),
          verify: Boolean(opts.verify),
          onlyConfig: Boolean(opts.onlyConfig),
          includeWorkspace: opts.includeWorkspace as boolean,
        });
      });
    });

  backup
    .command("verify <archive>")
    .description("验证备份归档及其内嵌清单")
    .option("--json", "输出 JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          [
            "zhushou backup verify ./2026-03-09T00-00-00.000Z-zhushou-backup.tar.gz",
            "检查归档结构和清单是否完整。",
          ],
          [
            "zhushou backup verify ~/Backups/latest.tar.gz --json",
            "输出机器可读的验证结果。",
          ],
        ])}`,
    )
    .action(async (archive, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await backupVerifyCommand(defaultRuntime, {
          archive: archive as string,
          json: Boolean(opts.json),
        });
      });
    });
}
