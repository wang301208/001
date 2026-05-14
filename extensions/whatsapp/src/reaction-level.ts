import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import {
  resolveReactionLevel,
  type ReactionLevel,
  type ResolvedReactionLevel,
} from "zhushou/plugin-sdk/text-runtime";
import { resolveMergedWhatsAppAccountConfig } from "./account-config.js";

export type WhatsAppReactionLevel = ReactionLevel;
export type ResolvedWhatsAppReactionLevel = ResolvedReactionLevel;

/** Resolve the effective reaction level and its implications for WhatsApp. */
export function resolveWhatsAppReactionLevel(params: {
  cfg: ZhushouConfig;
  accountId?: string;
}): ResolvedWhatsAppReactionLevel {
  const account = resolveMergedWhatsAppAccountConfig({
    cfg: params.cfg,
    accountId: params.accountId,
  });
  return resolveReactionLevel({
    value: account.reactionLevel,
    defaultLevel: "minimal",
    invalidFallback: "minimal",
  });
}
