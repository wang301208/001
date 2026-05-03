export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "zhushou/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "zhushou/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "zhushou/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "zhushou/plugin-sdk/channel-core";
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
} from "zhushou/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "zhushou/plugin-sdk/channel-location";
export { logInboundDrop, logTypingFailure } from "zhushou/plugin-sdk/channel-logging";
export { resolveAckReaction } from "zhushou/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "zhushou/plugin-sdk/setup";
export type {
  ZhushouConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "zhushou/plugin-sdk/config-runtime";
export type { GroupToolPolicyConfig } from "zhushou/plugin-sdk/config-runtime";
export type { WizardPrompter } from "zhushou/plugin-sdk/matrix-runtime-shared";
export type { SecretInput } from "zhushou/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "zhushou/plugin-sdk/config-runtime";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "zhushou/plugin-sdk/setup";
export type { RuntimeEnv } from "zhushou/plugin-sdk/runtime";
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
} from "zhushou/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "zhushou/plugin-sdk/inbound-reply-dispatch";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "zhushou/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "zhushou/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "zhushou/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "zhushou/plugin-sdk/outbound-runtime";
export { resolveAgentIdFromSessionKey } from "zhushou/plugin-sdk/routing";
export { chunkTextForOutbound } from "zhushou/plugin-sdk/text-chunking";
export { createChannelReplyPipeline } from "zhushou/plugin-sdk/channel-reply-pipeline";
export { loadOutboundMediaFromUrl } from "zhushou/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "zhushou/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "zhushou/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "zhushou/plugin-sdk/channel-targets";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "zhushou/plugin-sdk/channel-policy";
export {
  formatZonedTimestamp,
  type PluginRuntime,
  type RuntimeLogger,
} from "zhushou/plugin-sdk/matrix-runtime-shared";
export type { ReplyPayload } from "zhushou/plugin-sdk/reply-runtime";
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
