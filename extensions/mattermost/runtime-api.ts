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
  ZhushouConfig,
  ZhushouPluginApi,
  PluginRuntime,
} from "zhushou/plugin-sdk/core";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
export type { ReplyPayload } from "zhushou/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "zhushou/plugin-sdk/command-auth";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "zhushou/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "zhushou/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "zhushou/plugin-sdk/channel-status";
export { createAccountStatusSink } from "zhushou/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "zhushou/plugin-sdk/agent-media-payload";
export {
  buildModelsProviderData,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "zhushou/plugin-sdk/command-auth";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  loadSessionStore,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveStorePath,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "zhushou/plugin-sdk/config-runtime";
export { formatInboundFromLabel } from "zhushou/plugin-sdk/channel-inbound";
export { logInboundDrop } from "zhushou/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "zhushou/plugin-sdk/channel-pairing";
export {
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
} from "zhushou/plugin-sdk/channel-policy";
export { evaluateSenderGroupAccessForPolicy } from "zhushou/plugin-sdk/group-access";
export { createChannelReplyPipeline } from "zhushou/plugin-sdk/channel-reply-pipeline";
export { logTypingFailure } from "zhushou/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "zhushou/plugin-sdk/outbound-media";
export { rawDataToString } from "zhushou/plugin-sdk/browser-node-runtime";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "zhushou/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "zhushou/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "zhushou/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "zhushou/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "zhushou/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "zhushou/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "zhushou/plugin-sdk/media-runtime";
export { normalizeProviderId } from "zhushou/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
