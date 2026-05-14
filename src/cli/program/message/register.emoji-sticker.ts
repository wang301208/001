import type { Command } from "commander";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageEmojiCommands(message: Command, helpers: MessageCliHelpers) {
  const emoji = message.command("emoji").description("表情操作");

  helpers
    .withMessageBase(emoji.command("list").description("列出表情"))
    .option("--guild-id <id>", "Guild id (Discord)")
    .action(async (opts) => {
      await helpers.runMessageAction("emoji-list", opts);
    });

  helpers
    .withMessageBase(
      emoji
        .command("upload")
        .description("上传表情")
        .requiredOption("--guild-id <id>", "Guild id"),
    )
    .requiredOption("--emoji-name <name>", "Emoji name")
    .requiredOption("--media <path-or-url>", "Emoji media (path or URL)")
    .option("--role-ids <id>", "Role id (repeat)", collectOption, [] as string[])
    .action(async (opts) => {
      await helpers.runMessageAction("emoji-upload", opts);
    });
}

export function registerMessageStickerCommands(message: Command, helpers: MessageCliHelpers) {
  const sticker = message.command("sticker").description("贴纸操作");

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(sticker.command("send").description("发送贴纸")),
    )
    .requiredOption("--sticker-id <id>", "Sticker id (repeat)", collectOption)
    .option("-m, --message <text>", "Optional message body")
    .action(async (opts) => {
      await helpers.runMessageAction("sticker", opts);
    });

  helpers
    .withMessageBase(
      sticker
        .command("upload")
        .description("上传贴纸")
        .requiredOption("--guild-id <id>", "Guild id"),
    )
    .requiredOption("--sticker-name <name>", "Sticker name")
    .requiredOption("--sticker-desc <text>", "Sticker description")
    .requiredOption("--sticker-tags <tags>", "Sticker tags")
    .requiredOption("--media <path-or-url>", "Sticker media (path or URL)")
    .action(async (opts) => {
      await helpers.runMessageAction("sticker-upload", opts);
    });
}
