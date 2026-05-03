import type { ReplyToMode } from "zhushou/plugin-sdk/config-runtime";
import type { ReplyThreadingPolicy } from "zhushou/plugin-sdk/reply-reference";
import { resolveBatchedReplyThreadingPolicy } from "zhushou/plugin-sdk/reply-reference";

type ReplyThreadingContext = {
  ReplyThreading?: ReplyThreadingPolicy;
};

export function applyImplicitReplyBatchGate<T extends object>(
  ctx: T,
  replyToMode: ReplyToMode,
  isBatched: boolean,
) {
  const replyThreading = resolveBatchedReplyThreadingPolicy(replyToMode, isBatched);
  if (!replyThreading) {
    return;
  }
  (ctx as T & ReplyThreadingContext).ReplyThreading = replyThreading;
}
