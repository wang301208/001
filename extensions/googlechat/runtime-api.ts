// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "assistant/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "assistant/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "assistant/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "assistant/plugin-sdk/channel-contract";
export { missingTargetError } from "assistant/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "assistant/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "assistant/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "assistant/plugin-sdk/channel-reply-pipeline";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveDmGroupAccessWithLists,
  resolveSenderScopedGroupPolicy,
} from "assistant/plugin-sdk/channel-policy";
export { PAIRING_APPROVED_MESSAGE } from "assistant/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "assistant/plugin-sdk/config-runtime";
export { fetchRemoteMedia, resolveChannelMediaMaxBytes } from "assistant/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "assistant/plugin-sdk/outbound-media";
export type { PluginRuntime } from "assistant/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "assistant/plugin-sdk/ssrf-runtime";
export {
  GoogleChatConfigSchema,
  type GoogleChatAccountConfig,
  type GoogleChatConfig,
} from "assistant/plugin-sdk/googlechat-runtime-shared";
export { extractToolSend } from "assistant/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "assistant/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "assistant/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "assistant/plugin-sdk/webhook-path";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "assistant/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "assistant/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
