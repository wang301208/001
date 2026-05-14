import type { SessionEntry } from "../config/sessions/types.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

export type AcpSessionInteractionMode = "interactive" | "parent-owned-background";

type SessionInteractionEntry = Pick<SessionEntry, "spawnedBy" | "parentSessionKey" | "acp">;

export function resolveAcpSessionInteractionMode(
  entry?: SessionInteractionEntry | null,
): AcpSessionInteractionMode {
  // 父拥有的单次 ACP 会话是从另一个会话委派的后台工作。
  // 它们应通过父任务通知器回报，而非直接在面向
  // 用户的通道上发言。
  if (entry?.acp?.mode !== "oneshot") {
    return "interactive";
  }
  if (normalizeOptionalString(entry.spawnedBy) || normalizeOptionalString(entry.parentSessionKey)) {
    return "parent-owned-background";
  }
  return "interactive";
}

export function isParentOwnedBackgroundAcpSession(entry?: SessionInteractionEntry | null): boolean {
  return resolveAcpSessionInteractionMode(entry) === "parent-owned-background";
}
