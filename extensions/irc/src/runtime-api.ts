// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "assistant/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "assistant/plugin-sdk/channel-core";
export type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
export type { PluginRuntime } from "assistant/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "assistant/plugin-sdk/config-runtime";
export type { OutboundReplyPayload } from "assistant/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "assistant/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "assistant/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "assistant/plugin-sdk/channel-status";
export { createChannelPairingController } from "assistant/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "assistant/plugin-sdk/channel-lifecycle";
export {
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "assistant/plugin-sdk/channel-policy";
export { resolveControlCommandGate } from "assistant/plugin-sdk/command-auth";
export { dispatchInboundReplyWithBase } from "assistant/plugin-sdk/inbound-reply-dispatch";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "assistant/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "assistant/plugin-sdk/config-runtime";
export { logInboundDrop } from "assistant/plugin-sdk/channel-inbound";
