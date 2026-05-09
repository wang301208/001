export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "assistant/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "assistant/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "assistant/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "assistant/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "assistant/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "assistant/plugin-sdk/channel-location";
export { logInboundDrop, logTypingFailure } from "assistant/plugin-sdk/channel-logging";
export { resolveAckReaction } from "assistant/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "assistant/plugin-sdk/setup";
export type {
  AssistantConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "assistant/plugin-sdk/config-runtime";
export type { GroupToolPolicyConfig } from "assistant/plugin-sdk/config-runtime";
export type { WizardPrompter } from "assistant/plugin-sdk/matrix-runtime-shared";
export type { SecretInput } from "assistant/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "assistant/plugin-sdk/config-runtime";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "assistant/plugin-sdk/setup";
export type { RuntimeEnv } from "assistant/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "assistant/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "assistant/plugin-sdk/inbound-reply-dispatch";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "assistant/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "assistant/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "assistant/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "assistant/plugin-sdk/outbound-runtime";
export { resolveAgentIdFromSessionKey } from "assistant/plugin-sdk/routing";
export { chunkTextForOutbound } from "assistant/plugin-sdk/text-chunking";
export { createChannelReplyPipeline } from "assistant/plugin-sdk/channel-reply-pipeline";
export { loadOutboundMediaFromUrl } from "assistant/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "assistant/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "assistant/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "assistant/plugin-sdk/channel-targets";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "assistant/plugin-sdk/channel-policy";
export {
  formatZonedTimestamp,
  type PluginRuntime,
  type RuntimeLogger,
} from "assistant/plugin-sdk/matrix-runtime-shared";
export type { ReplyPayload } from "assistant/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from plugin-sdk/matrix.
// Re-exporting auth-precedence here makes Jiti try to define the same export twice.

export function buildTimeoutAbortSignal(params: { timeoutMs?: number; signal?: AbortSignal }): {
  signal?: AbortSignal;
  cleanup: () => void;
} {
  const { timeoutMs, signal } = params;
  if (!timeoutMs && !signal) {
    return { signal: undefined, cleanup: () => {} };
  }
  if (!timeoutMs) {
    return { signal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(controller.abort.bind(controller), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}
