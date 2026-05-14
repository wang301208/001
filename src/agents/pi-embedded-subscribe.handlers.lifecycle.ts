import { emitAgentEvent } from "../infra/agent-events.js";
import { createInlineCodeState } from "../markdown/code-spans.js";
import {
  buildApiErrorObservationFields,
  buildTextObservationFields,
  sanitizeForConsole,
} from "./pi-embedded-error-observation.js";
import { classifyFailoverReason, formatZhushouErrorText } from "./pi-embedded-helpers.js";
import { isIncompleteTerminalZhushouTurn } from "./pi-embedded-runner/run/incomplete-turn.js";
import {
  consumePendingToolMediaReply,
  hasZhushouVisibleReply,
} from "./pi-embedded-subscribe.handlers.messages.js";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { isPromiseLike } from "./pi-embedded-subscribe.promise.js";
import { isZhushouMessage } from "./pi-embedded-utils.js";

export {
  handleAutoCompactionEnd,
  handleAutoCompactionStart,
} from "./pi-embedded-subscribe.handlers.compaction.js";

export function handleAgentStart(ctx: EmbeddedPiSubscribeContext) {
  ctx.log.debug(`embedded run agent start: runId=${ctx.params.runId}`);
  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "lifecycle",
    data: {
      phase: "start",
      startedAt: Date.now(),
    },
  });
  void ctx.params.onAgentEvent?.({
    stream: "lifecycle",
    data: { phase: "start" },
  });
}

export function handleAgentEnd(ctx: EmbeddedPiSubscribeContext): void | Promise<void> {
  const lastZhushou = ctx.state.lastZhushou;
  const isError = isZhushouMessage(lastZhushou) && lastZhushou.stopReason === "error";
  let lifecycleErrorText: string | undefined;
  const hasZhushouVisibleText =
    Array.isArray(ctx.state.zhushouTexts) &&
    ctx.state.zhushouTexts.some((text) => hasZhushouVisibleReply({ text }));
  const hadDeterministicSideEffect =
    ctx.state.hadDeterministicSideEffect === true ||
    (ctx.state.messagingToolSentTexts?.length ?? 0) > 0 ||
    (ctx.state.messagingToolSentMediaUrls?.length ?? 0) > 0 ||
    (ctx.state.successfulCronAdds ?? 0) > 0;
  const incompleteTerminalZhushou = isIncompleteTerminalZhushouTurn({
    hasZhushouVisibleText,
    lastZhushou: isZhushouMessage(lastZhushou) ? lastZhushou : null,
  });
  const replayInvalid =
    ctx.state.replayState.replayInvalid || incompleteTerminalZhushou ? true : undefined;
  const derivedWorkingTerminalState = isError
    ? "blocked"
    : replayInvalid && !hasZhushouVisibleText && !hadDeterministicSideEffect
      ? "abandoned"
      : ctx.state.livenessState;
  const livenessState =
    ctx.state.livenessState === "working" ? derivedWorkingTerminalState : ctx.state.livenessState;

  if (isError && lastZhushou) {
    const friendlyError = formatZhushouErrorText(lastZhushou, {
      cfg: ctx.params.config,
      sessionKey: ctx.params.sessionKey,
      provider: lastZhushou.provider,
      model: lastZhushou.model,
    });
    const rawError = lastZhushou.errorMessage?.trim();
    const failoverReason = classifyFailoverReason(rawError ?? "", {
      provider: lastZhushou.provider,
    });
    const errorText = (friendlyError || lastZhushou.errorMessage || "LLM request failed.").trim();
    const observedError = buildApiErrorObservationFields(rawError, {
      provider: lastZhushou.provider,
    });
    const safeErrorText =
      buildTextObservationFields(errorText, {
        provider: lastZhushou.provider,
      }).textPreview ?? "LLM request failed.";
    lifecycleErrorText = safeErrorText;
    const safeRunId = sanitizeForConsole(ctx.params.runId) ?? "-";
    const safeModel = sanitizeForConsole(lastZhushou.model) ?? "unknown";
    const safeProvider = sanitizeForConsole(lastZhushou.provider) ?? "unknown";
    const safeRawErrorPreview = sanitizeForConsole(observedError.rawErrorPreview);
    const rawErrorConsoleSuffix = safeRawErrorPreview ? ` rawError=${safeRawErrorPreview}` : "";
    ctx.log.warn("embedded run agent end", {
      event: "embedded_run_agent_end",
      tags: ["error_handling", "lifecycle", "agent_end", "zhushou_error"],
      runId: ctx.params.runId,
      isError: true,
      error: safeErrorText,
      failoverReason,
      model: lastZhushou.model,
      provider: lastZhushou.provider,
      ...observedError,
      consoleMessage: `embedded run agent end: runId=${safeRunId} isError=true model=${safeModel} provider=${safeProvider} error=${safeErrorText}${rawErrorConsoleSuffix}`,
    });
  } else {
    ctx.log.debug(`embedded run agent end: runId=${ctx.params.runId} isError=${isError}`);
  }

  const emitLifecycleTerminal = () => {
    if (isError) {
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: "lifecycle",
        data: {
          phase: "error",
          error: lifecycleErrorText ?? "LLM request failed.",
          ...(livenessState ? { livenessState } : {}),
          ...(replayInvalid ? { replayInvalid } : {}),
          endedAt: Date.now(),
        },
      });
      void ctx.params.onAgentEvent?.({
        stream: "lifecycle",
        data: {
          phase: "error",
          error: lifecycleErrorText ?? "LLM request failed.",
          ...(livenessState ? { livenessState } : {}),
          ...(replayInvalid ? { replayInvalid } : {}),
        },
      });
      return;
    }
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "lifecycle",
      data: {
        phase: "end",
        ...(livenessState ? { livenessState } : {}),
        ...(replayInvalid ? { replayInvalid } : {}),
        endedAt: Date.now(),
      },
    });
    void ctx.params.onAgentEvent?.({
      stream: "lifecycle",
      data: {
        phase: "end",
        ...(livenessState ? { livenessState } : {}),
        ...(replayInvalid ? { replayInvalid } : {}),
      },
    });
  };

  const finalizeAgentEnd = () => {
    ctx.state.blockState.thinking = false;
    ctx.state.blockState.final = false;
    ctx.state.blockState.inlineCode = createInlineCodeState();

    if (ctx.state.pendingCompactionRetry > 0) {
      ctx.resolveCompactionRetry();
    } else {
      ctx.maybeResolveCompactionWait();
    }
  };

  const flushPendingMediaAndChannel = () => {
    const pendingToolMediaReply = consumePendingToolMediaReply(ctx.state);
    if (pendingToolMediaReply && hasZhushouVisibleReply(pendingToolMediaReply)) {
      ctx.emitBlockReply(pendingToolMediaReply);
    }

    const postMediaFlushResult = ctx.flushBlockReplyBuffer();
    if (isPromiseLike<void>(postMediaFlushResult)) {
      return postMediaFlushResult.then(() => {
        const onBlockReplyFlushResult = ctx.params.onBlockReplyFlush?.();
        if (isPromiseLike<void>(onBlockReplyFlushResult)) {
          return onBlockReplyFlushResult;
        }
        return undefined;
      });
    }

    const onBlockReplyFlushResult = ctx.params.onBlockReplyFlush?.();
    if (isPromiseLike<void>(onBlockReplyFlushResult)) {
      return onBlockReplyFlushResult;
    }
    return undefined;
  };

  let lifecycleTerminalEmitted = false;
  const emitLifecycleTerminalOnce = () => {
    if (lifecycleTerminalEmitted) {
      return;
    }
    lifecycleTerminalEmitted = true;
    emitLifecycleTerminal();
  };

  try {
    const flushBlockReplyBufferResult = ctx.flushBlockReplyBuffer();
    finalizeAgentEnd();
    const flushPendingMediaAndChannelResult = isPromiseLike<void>(flushBlockReplyBufferResult)
      ? Promise.resolve(flushBlockReplyBufferResult).then(() => flushPendingMediaAndChannel())
      : flushPendingMediaAndChannel();

    if (isPromiseLike<void>(flushPendingMediaAndChannelResult)) {
      return Promise.resolve(flushPendingMediaAndChannelResult).finally(() => {
        emitLifecycleTerminalOnce();
      });
    }
  } catch (error) {
    emitLifecycleTerminalOnce();
    throw error;
  }

  emitLifecycleTerminalOnce();
  return undefined;
}
