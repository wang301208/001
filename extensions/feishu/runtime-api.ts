// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  ZhushouConfig,
  ZhushouPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "zhushou/plugin-sdk/core";
export type { ZhushouConfig as ClawdbotConfig } from "zhushou/plugin-sdk/core";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "zhushou/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "zhushou/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "zhushou/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "zhushou/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "zhushou/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "zhushou/plugin-sdk/channel-reply-pipeline";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "zhushou/plugin-sdk/config-runtime";
export { loadSessionStore, resolveSessionStoreEntry } from "zhushou/plugin-sdk/config-runtime";
export { readJsonFileWithFallback } from "zhushou/plugin-sdk/json-store";
export { createPersistentDedupe } from "zhushou/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "zhushou/plugin-sdk/routing";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "zhushou/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
