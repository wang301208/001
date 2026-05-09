// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  AssistantConfig,
  AssistantPluginApi,
  PluginRuntime,
} from "assistant/plugin-sdk/core";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export type { ReplyPayload } from "assistant/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "assistant/plugin-sdk/command-auth";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "assistant/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "assistant/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "assistant/plugin-sdk/channel-status";
export { createAccountStatusSink } from "assistant/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "assistant/plugin-sdk/agent-media-payload";
export {
  buildModelsProviderData,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "assistant/plugin-sdk/command-auth";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  loadSessionStore,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveStorePath,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "assistant/plugin-sdk/config-runtime";
export { formatInboundFromLabel } from "assistant/plugin-sdk/channel-inbound";
export { logInboundDrop } from "assistant/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "assistant/plugin-sdk/channel-pairing";
export {
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
} from "assistant/plugin-sdk/channel-policy";
export { evaluateSenderGroupAccessForPolicy } from "assistant/plugin-sdk/group-access";
export { createChannelReplyPipeline } from "assistant/plugin-sdk/channel-reply-pipeline";
export { logTypingFailure } from "assistant/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "assistant/plugin-sdk/outbound-media";
export { rawDataToString } from "assistant/plugin-sdk/browser-node-runtime";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "assistant/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "assistant/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "assistant/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "assistant/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "assistant/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "assistant/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "assistant/plugin-sdk/media-runtime";
export { normalizeProviderId } from "assistant/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
