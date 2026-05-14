import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ZhushouConfig } from "../../../config/types.zhushou.js";
import { sanitizeForLog } from "../../../terminal/ansi.js";
import type { AuthProfileFailureReason } from "../../auth-profiles.js";
import { FailoverError, resolveFailoverStatus } from "../../failover-error.js";
import {
  formatZhushouErrorText,
  formatBillingErrorMessage,
  isTimeoutErrorMessage,
  type FailoverReason,
} from "../../pi-embedded-helpers.js";
import {
  mergeRetryFailoverReason,
  resolveRunFailoverDecision,
  type ZhushouFailoverDecision,
} from "./failover-policy.js";

type ZhushouFailoverOutcome =
  | {
      action: "continue_normal";
      overloadProfileRotations: number;
    }
  | {
      action: "retry";
      overloadProfileRotations: number;
      lastRetryFailoverReason: FailoverReason | null;
      retryKind?: "same_model_idle_timeout";
    }
  | {
      action: "throw";
      overloadProfileRotations: number;
      error: FailoverError;
    };

export async function handleZhushouFailover(params: {
  initialDecision: ZhushouFailoverDecision;
  aborted: boolean;
  externalAbort: boolean;
  fallbackConfigured: boolean;
  failoverFailure: boolean;
  failoverReason: FailoverReason | null;
  timedOut: boolean;
  idleTimedOut: boolean;
  timedOutDuringCompaction: boolean;
  allowSameModelIdleTimeoutRetry: boolean;
  zhushouProfileFailureReason: AuthProfileFailureReason | null;
  lastProfileId?: string;
  modelId: string;
  provider: string;
  activeErrorContext: { provider: string; model: string };
  lastZhushou: AssistantMessage | undefined;
  config: ZhushouConfig | undefined;
  sessionKey?: string;
  authFailure: boolean;
  rateLimitFailure: boolean;
  billingFailure: boolean;
  cloudCodeAssistFormatError: boolean;
  isProbeSession: boolean;
  overloadProfileRotations: number;
  overloadProfileRotationLimit: number;
  previousRetryFailoverReason: FailoverReason | null;
  logZhushouFailoverDecision: (
    decision: "rotate_profile" | "fallback_model" | "surface_error",
    extra?: { status?: number },
  ) => void;
  warn: (message: string) => void;
  maybeMarkAuthProfileFailure: (failure: {
    profileId?: string;
    reason?: AuthProfileFailureReason | null;
    modelId?: string;
  }) => Promise<void>;
  maybeEscalateRateLimitProfileFallback: (params: {
    failoverProvider: string;
    failoverModel: string;
    logFallbackDecision: (decision: "fallback_model", extra?: { status?: number }) => void;
  }) => void;
  maybeBackoffBeforeOverloadFailover: (reason: FailoverReason | null) => Promise<void>;
  advanceAuthProfile: () => Promise<boolean>;
}): Promise<ZhushouFailoverOutcome> {
  let overloadProfileRotations = params.overloadProfileRotations;
  let decision = params.initialDecision;
  const sameModelIdleTimeoutRetry = (): ZhushouFailoverOutcome => {
    params.warn(
      `[llm-idle-timeout] ${sanitizeForLog(params.provider)}/${sanitizeForLog(params.modelId)} produced no reply before the idle watchdog; retrying same model`,
    );
    return {
      action: "retry",
      overloadProfileRotations,
      retryKind: "same_model_idle_timeout",
      lastRetryFailoverReason: mergeRetryFailoverReason({
        previous: params.previousRetryFailoverReason,
        failoverReason: params.failoverReason,
        timedOut: true,
      }),
    };
  };

  if (decision.action === "rotate_profile") {
    if (params.lastProfileId) {
      const reason = params.timedOut ? "timeout" : params.zhushouProfileFailureReason;
      await params.maybeMarkAuthProfileFailure({
        profileId: params.lastProfileId,
        reason,
        modelId: params.modelId,
      });
      if (params.timedOut && !params.isProbeSession) {
        params.warn(`Profile ${params.lastProfileId} timed out. Trying next account...`);
      }
      if (params.cloudCodeAssistFormatError) {
        params.warn(
          `Profile ${params.lastProfileId} hit Cloud Code Assist format error. Tool calls will be sanitized on retry.`,
        );
      }
    }

    if (params.failoverReason === "overloaded") {
      overloadProfileRotations += 1;
      if (
        overloadProfileRotations > params.overloadProfileRotationLimit &&
        params.fallbackConfigured
      ) {
        const status = resolveFailoverStatus("overloaded");
        params.warn(
          `overload profile rotation cap reached for ${sanitizeForLog(params.provider)}/${sanitizeForLog(params.modelId)} after ${overloadProfileRotations} rotations; escalating to model fallback`,
        );
        params.logZhushouFailoverDecision("fallback_model", { status });
        return {
          action: "throw",
          overloadProfileRotations,
          error: new FailoverError(
            "The AI service is temporarily overloaded. Please try again in a moment.",
            {
              reason: "overloaded",
              provider: params.activeErrorContext.provider,
              model: params.activeErrorContext.model,
              profileId: params.lastProfileId,
              status,
            },
          ),
        };
      }
    }

    if (params.failoverReason === "rate_limit") {
      params.maybeEscalateRateLimitProfileFallback({
        failoverProvider: params.activeErrorContext.provider,
        failoverModel: params.activeErrorContext.model,
        logFallbackDecision: params.logZhushouFailoverDecision,
      });
    }

    const rotated = await params.advanceAuthProfile();
    if (rotated) {
      params.logZhushouFailoverDecision("rotate_profile");
      await params.maybeBackoffBeforeOverloadFailover(params.failoverReason);
      return {
        action: "retry",
        overloadProfileRotations,
        lastRetryFailoverReason: mergeRetryFailoverReason({
          previous: params.previousRetryFailoverReason,
          failoverReason: params.failoverReason,
          timedOut: params.timedOut,
        }),
      };
    }
    if (params.idleTimedOut && params.allowSameModelIdleTimeoutRetry) {
      return sameModelIdleTimeoutRetry();
    }

    decision = resolveRunFailoverDecision({
      stage: "zhushou",
      aborted: params.aborted,
      externalAbort: params.externalAbort,
      fallbackConfigured: params.fallbackConfigured,
      failoverFailure: params.failoverFailure,
      failoverReason: params.failoverReason,
      timedOut: params.timedOut,
      timedOutDuringCompaction: params.timedOutDuringCompaction,
      profileRotated: true,
    });
  }

  if (decision.action === "fallback_model") {
    await params.maybeBackoffBeforeOverloadFailover(params.failoverReason);
    const message =
      (params.lastZhushou
        ? formatZhushouErrorText(params.lastZhushou, {
            cfg: params.config,
            sessionKey: params.sessionKey,
            provider: params.activeErrorContext.provider,
            model: params.activeErrorContext.model,
          })
        : undefined) ||
      params.lastZhushou?.errorMessage?.trim() ||
      (params.timedOut
        ? "LLM request timed out."
        : params.rateLimitFailure
          ? "LLM request rate limited."
          : params.billingFailure
            ? formatBillingErrorMessage(
                params.activeErrorContext.provider,
                params.activeErrorContext.model,
              )
            : params.authFailure
              ? "LLM request unauthorized."
              : "LLM request failed.");
    const status =
      resolveFailoverStatus(decision.reason) ?? (isTimeoutErrorMessage(message) ? 408 : undefined);
    params.logZhushouFailoverDecision("fallback_model", { status });
    return {
      action: "throw",
      overloadProfileRotations,
      error: new FailoverError(message, {
        reason: decision.reason,
        provider: params.activeErrorContext.provider,
        model: params.activeErrorContext.model,
        profileId: params.lastProfileId,
        status,
      }),
    };
  }

  if (decision.action === "surface_error") {
    if (!params.externalAbort && params.idleTimedOut && params.allowSameModelIdleTimeoutRetry) {
      return sameModelIdleTimeoutRetry();
    }
    params.logZhushouFailoverDecision("surface_error");
  }

  return {
    action: "continue_normal",
    overloadProfileRotations,
  };
}
