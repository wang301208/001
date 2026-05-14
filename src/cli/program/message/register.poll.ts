import type { Command } from "commander";
import { collectOption } from "../helpers.js";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessagePollCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(message.command("poll").description("发送投票")),
    )
    .requiredOption("--poll-question <text>", "Poll question")
    .option(
      "--poll-option <choice>",
      "投票选项（重复 2-12 次）",
      collectOption,
      [] as string[],
    )
    .option("--poll-multi", "允许多选", false)
    .option("--poll-duration-hours <n>", "投票时长（小时，Discord）")
    .option("--poll-duration-seconds <n>", "投票时长（秒，Telegram；5-600）")
    .option("--poll-anonymous", "发送匿名投票（Telegram）", false)
    .option("--poll-public", "发送非匿名投票（Telegram）", false)
    .option("-m, --message <text>", "可选消息正文")
    .option(
      "--silent",
      "静默发送投票不通知（Telegram + Discord 支持时）",
      false,
    )
    .option("--thread-id <id>", "话题 ID（Telegram 论坛主题 / Slack 话题 ts）")
    .action(async (opts) => {
      await helpers.runMessageAction("poll", opts);
    });
}
