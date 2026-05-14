import type { Command } from "commander";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageDiscordAdminCommands(message: Command, helpers: MessageCliHelpers) {
  const role = message.command("role").description("角色操作");
  helpers
    .withMessageBase(
      role.command("info").description("列出角色").requiredOption("--guild-id <id>", "Guild id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-info", opts);
    });

  helpers
    .withMessageBase(
      role
        .command("add")
        .description("为成员添加角色")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id")
        .requiredOption("--role-id <id>", "Role id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-add", opts);
    });

  helpers
    .withMessageBase(
      role
        .command("remove")
        .description("移除成员角色")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id")
        .requiredOption("--role-id <id>", "Role id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("role-remove", opts);
    });

  const channel = message.command("channel").description("频道操作");
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(channel.command("info").description("获取频道信息")),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("channel-info", opts);
    });

  helpers
    .withMessageBase(
      channel
        .command("list")
        .description("列出频道")
        .requiredOption("--guild-id <id>", "Guild id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("channel-list", opts);
    });

  const member = message.command("member").description("成员操作");
  helpers
    .withMessageBase(
      member
        .command("info")
        .description("获取成员信息")
        .requiredOption("--user-id <id>", "User id"),
    )
    .option("--guild-id <id>", "Guild id (Discord)")
    .action(async (opts) => {
      await helpers.runMessageAction("member-info", opts);
    });

  const voice = message.command("voice").description("语音操作");
  helpers
    .withMessageBase(
      voice
        .command("status")
        .description("获取语音状态")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("voice-status", opts);
    });

  const event = message.command("event").description("事件操作");
  helpers
    .withMessageBase(
      event
        .command("list")
        .description("列出定时事件")
        .requiredOption("--guild-id <id>", "Guild id"),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("event-list", opts);
    });

  helpers
    .withMessageBase(
      event
        .command("create")
        .description("创建定时事件")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--event-name <name>", "Event name")
        .requiredOption("--start-time <iso>", "Event start time"),
    )
    .option("--end-time <iso>", "Event end time")
    .option("--desc <text>", "Event description")
    .option("--channel-id <id>", "Channel id")
    .option("--location <text>", "Event location")
    .option("--event-type <stage|external|voice>", "Event type")
    .option("--image <url>", "Cover image URL or local file path")
    .action(async (opts) => {
      await helpers.runMessageAction("event-create", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("timeout")
        .description("对成员禁言")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id"),
    )
    .option("--duration-min <n>", "Timeout duration minutes")
    .option("--until <iso>", "Timeout until")
    .option("--reason <text>", "管理原因")
    .action(async (opts) => {
      await helpers.runMessageAction("timeout", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("kick")
        .description("踢出成员")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id"),
    )
    .option("--reason <text>", "Moderation reason")
    .action(async (opts) => {
      await helpers.runMessageAction("kick", opts);
    });

  helpers
    .withMessageBase(
      message
        .command("ban")
        .description("封禁成员")
        .requiredOption("--guild-id <id>", "Guild id")
        .requiredOption("--user-id <id>", "User id"),
    )
    .option("--reason <text>", "Moderation reason")
    .option("--delete-days <n>", "封禁删除消息天数")
    .action(async (opts) => {
      await helpers.runMessageAction("ban", opts);
    });
}
