import type { Command } from "commander";
import {
  CONFIGURE_WIZARD_SECTIONS,
  configureCommandFromSectionsArg,
} from "../../commands/configure.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerConfigureCommand(program: Command) {
  program
    .command("configure")
    .description("交互式配置凭据、频道、网关和代理默认值")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/configure", "docs.zhushou.ai/cli/configure")}\n`,
    )
    .option(
      "--section <section>",
      `配置分区（可重复）。选项：${CONFIGURE_WIZARD_SECTIONS.join(", ")}`,
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await configureCommandFromSectionsArg(opts.section, defaultRuntime);
      });
    });
}
