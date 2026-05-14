import type { ChannelId } from "../../channels/plugins/channel-id.types.js";

export type OutboundDeliveryResult = {
  channel: Exclude<ChannelId, "none">;
  messageId: string;
  chatId?: string;
  channelId?: string;
  roomId?: string;
  conversationId?: string;
  timestamp?: number;
  toJid?: string;
  pollId?: string;
  // 渠道对接：将渠道特定字段暂存于此，以避免核心类型变动。
  meta?: Record<string, unknown>;
};
