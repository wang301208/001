export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "zhushou/plugin-sdk/channel-inbound";
export { hasControlCommand } from "zhushou/plugin-sdk/command-detection";
export { recordPendingHistoryEntryIfEnabled } from "zhushou/plugin-sdk/reply-history";
export { parseActivationCommand } from "zhushou/plugin-sdk/reply-runtime";
export { normalizeE164 } from "../../text-runtime.js";
