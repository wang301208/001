import { resolveChannelGroupRequireMention } from "assistant/plugin-sdk/channel-policy";
import type { AssistantConfig } from "assistant/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: AssistantConfig;
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
