import { formatTrimmedAllowFromEntries } from "zhushou/plugin-sdk/channel-config-helpers";
import type { ChannelStatusIssue } from "zhushou/plugin-sdk/channel-contract";
import { PAIRING_APPROVED_MESSAGE } from "zhushou/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type ZhushouConfig,
} from "zhushou/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "zhushou/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "zhushou/plugin-sdk/status-helpers";
import {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./config-accessors.js";
import { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";

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

export type { ChannelPlugin, ChannelStatusIssue, ZhushouConfig };
