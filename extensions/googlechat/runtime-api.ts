// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "zhushou/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "zhushou/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "zhushou/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "zhushou/plugin-sdk/channel-contract";
export { missingTargetError } from "zhushou/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "zhushou/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "zhushou/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "zhushou/plugin-sdk/channel-reply-pipeline";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveDmGroupAccessWithLists,
  resolveSenderScopedGroupPolicy,
} from "zhushou/plugin-sdk/channel-policy";
export { PAIRING_APPROVED_MESSAGE } from "zhushou/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "zhushou/plugin-sdk/config-runtime";
export { fetchRemoteMedia, resolveChannelMediaMaxBytes } from "zhushou/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "zhushou/plugin-sdk/outbound-media";
export type { PluginRuntime } from "zhushou/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "zhushou/plugin-sdk/ssrf-runtime";
export {
  GoogleChatConfigSchema,
  type GoogleChatAccountConfig,
  type GoogleChatConfig,
} from "zhushou/plugin-sdk/googlechat-runtime-shared";
export { extractToolSend } from "zhushou/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "zhushou/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "zhushou/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "zhushou/plugin-sdk/webhook-path";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "zhushou/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "zhushou/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
