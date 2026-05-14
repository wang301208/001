import { redactIdentifier } from "../../logging/redact-identifier.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { sanitizeForConsole } from "../console-sanitize.js";
import type { AuthProfileFailureReason, ProfileUsageStats } from "./types.js";

const observationLog = createSubsystemLogger("agent/embedded");

export function logAuthProfileFailureStateChange(params: {
  runId?: string;
  profileId: string;
  provider: string;
  reason: AuthProfileFailureReason;
  previous: ProfileUsageStats | undefined;
  next: ProfileUsageStats;
  now: number;
}): void {
  const windowType =
    params.reason === "billing" || params.reason === "auth_permanent" ? "disabled" : "cooldown";
  const previousCooldownUntil = params.previous?.cooldownUntil;
  const previousDisabledUntil = params.previous?.disabledUntil;
  // 活跃的冷却/禁用窗口是不可变的；记录此次更新
  // 是否复用了现有窗口而非扩展它。
  const windowReused =
    windowType === "disabled"
      ? typeof previousDisabledUntil === "number" &&
        Number.isFinite(previousDisabledUntil) &&
        previousDisabledUntil > params.now &&
        previousDisabledUntil === params.next.disabledUntil
      : typeof previousCooldownUntil === "number" &&
        Number.isFinite(previousCooldownUntil) &&
        previousCooldownUntil > params.now &&
        previousCooldownUntil === params.next.cooldownUntil;
  const safeProfileId = redactIdentifier(params.profileId, { len: 12 });
  const safeRunId = sanitizeForConsole(params.runId) ?? "-";
  const safeProvider = sanitizeForConsole(params.provider) ?? "-";

  observationLog.warn("认证配置文件故障状态已更新", {
    event: "auth_profile_failure_state_updated",
    tags: ["error_handling", "auth_profiles", windowType],
    runId: params.runId,
    profileId: safeProfileId,
    provider: params.provider,
    reason: params.reason,
    windowType,
    windowReused,
    previousErrorCount: params.previous?.errorCount,
    errorCount: params.next.errorCount,
    previousCooldownUntil,
    cooldownUntil: params.next.cooldownUntil,
    previousDisabledUntil,
    disabledUntil: params.next.disabledUntil,
    previousDisabledReason: params.previous?.disabledReason,
    disabledReason: params.next.disabledReason,
    failureCounts: params.next.failureCounts,
    consoleMessage:
      `认证配置文件故障状态已更新: runId=${safeRunId} profile=${safeProfileId} provider=${safeProvider} ` +
      `原因=${params.reason} 窗口=${windowType} 复用=${String(windowReused)}`,
  });
}
