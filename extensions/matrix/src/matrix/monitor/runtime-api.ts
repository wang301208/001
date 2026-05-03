// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "zhushou/plugin-sdk/channel-location";
export type { PluginRuntime, RuntimeLogger } from "zhushou/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "zhushou/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "zhushou/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "zhushou/plugin-sdk/channel-reply-options-runtime";
export { formatLocationText, toLocationContext } from "zhushou/plugin-sdk/channel-location";
export { getAgentScopedMediaLocalRoots } from "zhushou/plugin-sdk/agent-media-payload";
export { logInboundDrop, logTypingFailure } from "zhushou/plugin-sdk/channel-logging";
export { resolveAckReaction } from "zhushou/plugin-sdk/channel-feedback";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "zhushou/plugin-sdk/channel-targets";
