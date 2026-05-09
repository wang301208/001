import { resolveChannelGroupRequireMention } from "assistant/plugin-sdk/channel-policy";
import { resolveExactLineGroupConfigKey, type AssistantConfig } from "./channel-api.js";

type LineGroupContext = {
  cfg: AssistantConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveLineGroupRequireMention(params: LineGroupContext): boolean {
  const exactGroupId = resolveExactLineGroupConfigKey({
    cfg: params.cfg,
    accountId: params.accountId,
    groupId: params.groupId,
  });
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "line",
    groupId: exactGroupId ?? params.groupId,
    accountId: params.accountId,
  });
}
