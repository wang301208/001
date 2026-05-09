// Private runtime barrel for the bundled Zalo Personal extension.
// Keep this barrel thin and aligned with the local extension surface.

export * from "./api.js";
export { setZalouserRuntime } from "./src/runtime.js";
export type { ReplyPayload } from "assistant/plugin-sdk/reply-runtime";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelStatusIssue,
} from "assistant/plugin-sdk/channel-contract";
export type {
  AssistantConfig,
  GroupToolPolicyConfig,
  MarkdownTableMode,
} from "assistant/plugin-sdk/config-runtime";
export type {
  PluginRuntime,
  AnyAgentTool,
  ChannelPlugin,
  AssistantPluginToolContext,
} from "assistant/plugin-sdk/core";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  normalizeAccountId,
} from "assistant/plugin-sdk/core";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export {
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "assistant/plugin-sdk/config-runtime";
export {
  mergeAllowlist,
  summarizeMapping,
  formatAllowFromLowercase,
} from "assistant/plugin-sdk/allow-from";
export { resolveInboundMentionDecision } from "assistant/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "assistant/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "assistant/plugin-sdk/channel-reply-pipeline";
export { buildBaseAccountStatusSnapshot } from "assistant/plugin-sdk/status-helpers";
export { resolveSenderCommandAuthorization } from "assistant/plugin-sdk/command-auth";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "assistant/plugin-sdk/group-access";
export { loadOutboundMediaFromUrl } from "assistant/plugin-sdk/outbound-media";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveSendableOutboundReplyParts,
  sendPayloadWithChunkedTextAndMedia,
  type OutboundReplyPayload,
} from "assistant/plugin-sdk/reply-payload";
export { resolvePreferredAssistantTmpDir } from "assistant/plugin-sdk/browser-security-runtime";
