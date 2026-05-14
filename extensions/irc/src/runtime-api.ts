// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "zhushou/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "zhushou/plugin-sdk/channel-core";
export type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
export type { PluginRuntime } from "zhushou/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "zhushou/plugin-sdk/config-runtime";
export type { OutboundReplyPayload } from "zhushou/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "zhushou/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "zhushou/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "zhushou/plugin-sdk/channel-status";
export { createChannelPairingController } from "zhushou/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "zhushou/plugin-sdk/channel-lifecycle";
export {
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "zhushou/plugin-sdk/channel-policy";
export { resolveControlCommandGate } from "zhushou/plugin-sdk/command-auth";
export { dispatchInboundReplyWithBase } from "zhushou/plugin-sdk/inbound-reply-dispatch";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "zhushou/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "zhushou/plugin-sdk/config-runtime";
export { logInboundDrop } from "zhushou/plugin-sdk/channel-inbound";
