import type { Command } from "commander";
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageSendCommand(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers
        .withRequiredMessageTarget(
          message
            .command("send")
            .description("发送消息")
            .option("-m, --message <text>", "消息正文（除非设置了 --media 则必需）"),
        )
        .option(
          "--media <path-or-url>",
          "附加媒体（图片/音频/视频/文档）。接受本地路径或 URL。",
        )
        .option(
          "--interactive <json>",
          "共享交互载荷 JSON（按钮/选择由支持的频道原生渲染）",
        )
        .option(
          "--buttons <json>",
          "Telegram 内联键盘按钮 JSON（按钮行数组）",
        )
        .option("--components <json>", "Discord 组件载荷 JSON")
        .option("--card <json>", "自适应卡片 JSON 对象（频道支持时）")
        .option("--reply-to <id>", "回复消息 ID")
        .option("--thread-id <id>", "话题 ID（Telegram 论坛话题）")
        .option("--gif-playback", "将视频媒体作为 GIF 播放（仅 WhatsApp）。", false)
        .option(
          "--force-document",
          "以文档形式发送媒体以避免 Telegram 压缩（仅 Telegram）。适用于图片和 GIF。",
          false,
        )
        .option(
          "--silent",
          "静默发送消息不通知（Telegram + Discord）",
          false,
        ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("send", opts);
    });
}
