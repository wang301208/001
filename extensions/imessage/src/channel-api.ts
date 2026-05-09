import { formatTrimmedAllowFromEntries } from "assistant/plugin-sdk/channel-config-helpers";
import type { ChannelStatusIssue } from "assistant/plugin-sdk/channel-contract";
import { PAIRING_APPROVED_MESSAGE } from "assistant/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type AssistantConfig,
} from "assistant/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "assistant/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "assistant/plugin-sdk/status-helpers";
import {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./config-accessors.js";
import { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
};

export type { ChannelPlugin, ChannelStatusIssue, AssistantConfig };
