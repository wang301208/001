// Private runtime barrel for the bundled Zalo Personal extension.
// Keep this barrel thin and aligned with the local extension surface.

export * from "./api.js";
export { setZalouserRuntime } from "./src/runtime.js";
export type { ReplyPayload } from "zhushou/plugin-sdk/reply-runtime";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelStatusIssue,
} from "zhushou/plugin-sdk/channel-contract";
export type {
  ZhushouConfig,
  GroupToolPolicyConfig,
  MarkdownTableMode,
} from "zhushou/plugin-sdk/config-runtime";
export type {
  PluginRuntime,
  AnyAgentTool,
  ChannelPlugin,
  OpenClawPluginToolContext,
} from "zhushou/plugin-sdk/core";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  normalizeAccountId,
} from "zhushou/plugin-sdk/core";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export {
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "zhushou/plugin-sdk/config-runtime";
export {
  mergeAllowlist,
  summarizeMapping,
  formatAllowFromLowercase,
} from "zhushou/plugin-sdk/allow-from";
export { resolveInboundMentionDecision } from "zhushou/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "zhushou/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "zhushou/plugin-sdk/channel-reply-pipeline";
export { buildBaseAccountStatusSnapshot } from "zhushou/plugin-sdk/status-helpers";
export { resolveSenderCommandAuthorization } from "zhushou/plugin-sdk/command-auth";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "zhushou/plugin-sdk/group-access";
export { loadOutboundMediaFromUrl } from "zhushou/plugin-sdk/outbound-media";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveSendableOutboundReplyParts,
  sendPayloadWithChunkedTextAndMedia,
  type OutboundReplyPayload,
} from "zhushou/plugin-sdk/reply-payload";
export { resolvePreferredOpenClawTmpDir } from "zhushou/plugin-sdk/browser-security-runtime";
