// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "assistant/plugin-sdk/channel-location";
export type { PluginRuntime, RuntimeLogger } from "assistant/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "assistant/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, AssistantConfig } from "assistant/plugin-sdk/config-runtime";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "assistant/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "assistant/plugin-sdk/channel-reply-options-runtime";
export { formatLocationText, toLocationContext } from "assistant/plugin-sdk/channel-location";
export { getAgentScopedMediaLocalRoots } from "assistant/plugin-sdk/agent-media-payload";
export { logInboundDrop, logTypingFailure } from "assistant/plugin-sdk/channel-logging";
export { resolveAckReaction } from "assistant/plugin-sdk/channel-feedback";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "assistant/plugin-sdk/channel-targets";
