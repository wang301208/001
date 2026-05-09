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
  AssistantConfig,
  AssistantPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "assistant/plugin-sdk/core";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "assistant/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "assistant/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "assistant/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "assistant/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "assistant/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "assistant/plugin-sdk/channel-reply-pipeline";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "assistant/plugin-sdk/config-runtime";
export { loadSessionStore, resolveSessionStoreEntry } from "assistant/plugin-sdk/config-runtime";
export { readJsonFileWithFallback } from "assistant/plugin-sdk/json-store";
export { createPersistentDedupe } from "assistant/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "assistant/plugin-sdk/routing";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "assistant/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
