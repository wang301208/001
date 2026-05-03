import { resolveChannelGroupRequireMention } from "zhushou/plugin-sdk/channel-policy";
import type { ZhushouConfig } from "zhushou/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: ZhushouConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
