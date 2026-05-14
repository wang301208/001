import type { Command } from "commander";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePinCommands(message: Command, helpers: MessageCliHelpers) {
  const pins = [
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(message.command("pin").description("置顶消息")),
      )
      .requiredOption("--message-id <id>", "Message id")
      .action(async (opts) => {
        await helpers.runMessageAction("pin", opts);
      }),
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(message.command("unpin").description("取消置顶消息")),
      )
      .requiredOption("--message-id <id>", "消息 ID（或 MSTeams 的置顶消息资源 ID）")
      .option(
        "--pinned-message-id <id>",
        "置顶消息资源 ID（MSTeams：来自置顶或列出置顶，非聊天消息 ID）",
      )
      .action(async (opts) => {
        await helpers.runMessageAction("unpin", opts);
      }),
    helpers
      .withMessageBase(
        helpers.withRequiredMessageTarget(
          message.command("pins").description("列出置顶消息"),
        ),
      )
      .option("--limit <n>", "Result limit")
      .action(async (opts) => {
        await helpers.runMessageAction("list-pins", opts);
      }),
  ] as const;

  void pins;
}
