export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "assistant/plugin-sdk/channel-inbound";
export { hasControlCommand } from "assistant/plugin-sdk/command-detection";
export { recordPendingHistoryEntryIfEnabled } from "assistant/plugin-sdk/reply-history";
export { parseActivationCommand } from "assistant/plugin-sdk/reply-runtime";
export { normalizeE164 } from "../../text-runtime.js";
