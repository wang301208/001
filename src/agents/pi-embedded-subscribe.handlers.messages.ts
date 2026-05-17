import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { resolveSendableOutboundReplyParts } from "zhushou/plugin-sdk/reply-payload";
import { parseReplyDirectives } from "../auto-reply/reply/reply-directives.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { createInlineCodeState } from "../markdown/code-spans.js";
import {
  parseZhushouTextSignature,
  resolveZhushouMessagePhase,
  type ZhushouPhase,
} from "../shared/chat-message-content.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import {
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison,
} from "./pi-embedded-helpers.js";
import type { BlockReplyPayload } from "./pi-embedded-payloads.js";
import type {
  EmbeddedPiSubscribeContext,
  EmbeddedPiSubscribeState,
} from "./pi-embedded-subscribe.handlers.types.js";
import { isPromiseLike } from "./pi-embedded-subscribe.promise.js";
import { appendRawStream } from "./pi-embedded-subscribe.raw-stream.js";
import {
  extractZhushouText,
  extractZhushouThinking,
  extractZhushouVisibleText,
  extractThinkingFromTaggedStream,
  extractThinkingFromTaggedText,
  formatReasoningMessage,
  promoteThinkingTagsToBlocks,
} from "./pi-embedded-utils.js";

const stripTrailingDirective = (text: string): string => {
  const openIndex = text.lastIndexOf("[[");
  if (openIndex < 0) {
    if (text.endsWith("[")) {
      return text.slice(0, -1);
    }
    return text;
  }
  const closeIndex = text.indexOf("]]", openIndex + 2);
  if (closeIndex >= 0) {
    return text;
  }
  return text.slice(0, openIndex);
};

const coerceText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? "";
    } catch {
      return "";
    }
  }
  return "";
};

function shouldSuppressZhushouVisibleOutput(message: AgentMessage | undefined): boolean {
  return resolveZhushouMessagePhase(message) === "commentary";
}

function resolveZhushouStreamItemId(params: {
  contentIndex?: unknown;
  message: AgentMessage | undefined;
}): string | undefined {
  const content = (params.message as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const contentIndex =
    typeof params.contentIndex === "number" &&
    Number.isInteger(params.contentIndex) &&
    params.contentIndex >= 0
      ? params.contentIndex
      : undefined;
  const candidateBlocks =
    contentIndex !== undefined ? [content[contentIndex]] : content.toReversed();
  for (const block of candidateBlocks) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as { type?: unknown; textSignature?: unknown };
    if (record.type !== "text") {
      continue;
    }
    const signature = parseZhushouTextSignature(record.textSignature);
    if (signature?.id) {
      return signature.id;
    }
  }
  return undefined;
}

function emitReasoningEnd(ctx: EmbeddedPiSubscribeContext) {
  if (!ctx.state.reasoningStreamOpen) {
    return;
  }
  ctx.state.reasoningStreamOpen = false;
  void ctx.params.onReasoningEnd?.();
}

function openReasoningStream(ctx: EmbeddedPiSubscribeContext) {
  ctx.state.reasoningStreamOpen = true;
}

function shouldSuppressDeterministicApprovalOutput(
  state: Pick<
    EmbeddedPiSubscribeState,
    "deterministicApprovalPromptPending" | "deterministicApprovalPromptSent"
  >,
): boolean {
  return state.deterministicApprovalPromptPending || state.deterministicApprovalPromptSent;
}

function appendBlockReplyChunk(ctx: EmbeddedPiSubscribeContext, chunk: string) {
  if (ctx.blockChunker) {
    ctx.blockChunker.append(chunk);
    return;
  }
  ctx.state.blockBuffer += chunk;
}

function replaceBlockReplyBuffer(ctx: EmbeddedPiSubscribeContext, text: string) {
  if (ctx.blockChunker) {
    ctx.blockChunker.reset();
    ctx.blockChunker.append(text);
    return;
  }
  ctx.state.blockBuffer = text;
}

function resolveZhushouTextChunk(params: {
  evtType: "text_delta" | "text_start" | "text_end";
  delta: string;
  content: string;
  accumulatedText: string;
}): string {
  const { evtType, delta, content, accumulatedText } = params;
  if (evtType === "text_delta") {
    return delta;
  }
  if (delta) {
    return delta;
  }
  if (!content) {
    return "";
  }
  // KNOWN: Some providers resend full content on `text_end`.
  // We only append a suffix (or nothing) to keep output monotonic.
  if (content.startsWith(accumulatedText)) {
    return content.slice(accumulatedText.length);
  }
  if (accumulatedText.startsWith(content)) {
    return "";
  }
  if (!accumulatedText.includes(content)) {
    return content;
  }
  return "";
}

export function resolveSilentReplyFallbackText(params: {
  text: unknown;
  messagingToolSentTexts: string[];
}): string {
  const text = coerceText(params.text);
  const trimmed = text.trim();
  if (trimmed !== SILENT_REPLY_TOKEN) {
    return text;
  }
  const fallback = coerceText(params.messagingToolSentTexts.at(-1)).trim();
  if (!fallback) {
    return text;
  }
  return fallback;
}

function clearPendingToolMedia(
  state: Pick<EmbeddedPiSubscribeState, "pendingToolMediaUrls" | "pendingToolAudioAsVoice">,
) {
  state.pendingToolMediaUrls = [];
  state.pendingToolAudioAsVoice = false;
}

export function consumePendingToolMediaIntoReply(
  state: Pick<EmbeddedPiSubscribeState, "pendingToolMediaUrls" | "pendingToolAudioAsVoice">,
  payload: BlockReplyPayload,
): BlockReplyPayload {
  if (payload.isReasoning) {
    return payload;
  }
  if (state.pendingToolMediaUrls.length === 0 && !state.pendingToolAudioAsVoice) {
    return payload;
  }
  const mergedMediaUrls = Array.from(
    new Set([...(payload.mediaUrls ?? []), ...state.pendingToolMediaUrls]),
  );
  const mergedPayload: BlockReplyPayload = {
    ...payload,
    mediaUrls: mergedMediaUrls.length ? mergedMediaUrls : undefined,
    audioAsVoice: payload.audioAsVoice || state.pendingToolAudioAsVoice || undefined,
  };
  clearPendingToolMedia(state);
  return mergedPayload;
}

export function consumePendingToolMediaReply(
  state: Pick<EmbeddedPiSubscribeState, "pendingToolMediaUrls" | "pendingToolAudioAsVoice">,
): BlockReplyPayload | null {
  if (state.pendingToolMediaUrls.length === 0 && !state.pendingToolAudioAsVoice) {
    return null;
  }
  const payload: BlockReplyPayload = {
    mediaUrls: state.pendingToolMediaUrls.length
      ? Array.from(new Set(state.pendingToolMediaUrls))
      : undefined,
    audioAsVoice: state.pendingToolAudioAsVoice || undefined,
  };
  clearPendingToolMedia(state);
  return payload;
}

export function hasZhushouVisibleReply(params: {
  text?: string;
  mediaUrls?: string[];
  mediaUrl?: string;
  audioAsVoice?: boolean;
}): boolean {
  return resolveSendableOutboundReplyParts(params).hasContent || Boolean(params.audioAsVoice);
}

export function buildZhushouStreamData(params: {
  text?: string;
  delta?: string;
  replace?: boolean;
  mediaUrls?: string[];
  mediaUrl?: string;
  phase?: ZhushouPhase;
}): {
  text: string;
  delta: string;
  replace?: true;
  mediaUrls?: string[];
  phase?: ZhushouPhase;
} {
  const mediaUrls = resolveSendableOutboundReplyParts(params).mediaUrls;
  return {
    text: params.text ?? "",
    delta: params.delta ?? "",
    replace: params.replace ? true : undefined,
    mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    phase: params.phase,
  };
}

function isTranscriptOnlyZhushouZhushouMessage(message: AgentMessage | undefined): boolean {
  if (!message || message.role !== "assistant") {
    return false;
  }
  const provider = normalizeOptionalString(message.provider) ?? "";
  const model = normalizeOptionalString(message.model) ?? "";
  return provider === "zhushou" && (model === "delivery-mirror" || model === "gateway-injected");
}

export function handleMessageStart(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant" || isTranscriptOnlyZhushouZhushouMessage(msg)) {
    return;
  }

  // KNOWN: Resetting at `text_end` is unsafe (late/duplicate end events).
  // ASSUME: `message_start` is the only reliable boundary for “new zhushou message begins”.
  // Start-of-message is a safer reset point than message_end: some providers
  // may deliver late text_end updates after message_end, which would otherwise
  // re-trigger block replies.
  ctx.resetZhushouMessageState(ctx.state.zhushouTexts.length);
  // Use zhushou message_start as the earliest "writing" signal for typing.
  void ctx.params.onZhushouMessageStart?.();
}

export function handleMessageUpdate(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage; zhushouMessageEvent?: unknown },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant" || isTranscriptOnlyZhushouZhushouMessage(msg)) {
    return;
  }

  ctx.noteLastZhushou(msg);
  const suppressVisibleZhushouOutput = shouldSuppressZhushouVisibleOutput(msg);
  if (suppressVisibleZhushouOutput) {
    return;
  }
  const suppressDeterministicApprovalOutput = shouldSuppressDeterministicApprovalOutput(ctx.state);

  const zhushouEvent = evt.zhushouMessageEvent;
  const zhushouPhase = resolveZhushouMessagePhase(msg);
  const zhushouRecord =
    zhushouEvent && typeof zhushouEvent === "object"
      ? (zhushouEvent as Record<string, unknown>)
      : undefined;
  const evtType = typeof zhushouRecord?.type === "string" ? zhushouRecord.type : "";

  if (evtType === "thinking_start" || evtType === "thinking_delta" || evtType === "thinking_end") {
    if (evtType === "thinking_start" || evtType === "thinking_delta") {
      openReasoningStream(ctx);
    }
    const thinkingDelta = typeof zhushouRecord?.delta === "string" ? zhushouRecord.delta : "";
    const thinkingContent =
      typeof zhushouRecord?.content === "string" ? zhushouRecord.content : "";
    appendRawStream({
      ts: Date.now(),
      event: "zhushou_thinking_stream",
      runId: ctx.params.runId,
      sessionId: (ctx.params.session as { id?: string }).id,
      evtType,
      delta: thinkingDelta,
      content: thinkingContent,
    });
    if (ctx.state.streamReasoning) {
      // Prefer full partial-message thinking when available; fall back to event payloads.
      const partialThinking = extractZhushouThinking(msg);
      ctx.emitReasoningStream(partialThinking || thinkingContent || thinkingDelta);
    }
    if (evtType === "thinking_end") {
      if (!ctx.state.reasoningStreamOpen) {
        openReasoningStream(ctx);
      }
      emitReasoningEnd(ctx);
    }
    return;
  }

  if (evtType !== "text_delta" && evtType !== "text_start" && evtType !== "text_end") {
    return;
  }

  const delta = typeof zhushouRecord?.delta === "string" ? zhushouRecord.delta : "";
  const content = typeof zhushouRecord?.content === "string" ? zhushouRecord.content : "";

  appendRawStream({
    ts: Date.now(),
    event: "zhushou_text_stream",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    evtType,
    delta,
    content,
  });

  const chunk = resolveZhushouTextChunk({
    evtType,
    delta,
    content,
    accumulatedText: ctx.state.deltaBuffer,
  });

  const partialZhushou =
    zhushouRecord?.partial && typeof zhushouRecord.partial === "object"
      ? (zhushouRecord.partial as AssistantMessage)
      : msg;
  const deliveryPhase = resolveZhushouMessagePhase(partialZhushou);
  const streamItemId = resolveZhushouStreamItemId({
    contentIndex: zhushouRecord?.contentIndex,
    message: partialZhushou,
  });
  if (deliveryPhase && streamItemId) {
    const previousStreamItemId = ctx.state.lastZhushouStreamItemId;
    if (previousStreamItemId && previousStreamItemId !== streamItemId) {
      void ctx.flushBlockReplyBuffer({ zhushouMessageIndex: ctx.state.zhushouMessageIndex });
      ctx.resetZhushouMessageState(ctx.state.zhushouTexts.length);
      void ctx.params.onZhushouMessageStart?.();
    }
    ctx.state.lastZhushouStreamItemId = streamItemId;
  }
  if (deliveryPhase === "commentary") {
    return;
  }
  const phaseAwareVisibleText = coerceText(extractZhushouVisibleText(partialZhushou)).trim();
  const shouldUsePhaseAwareBlockReply = Boolean(deliveryPhase);

  if (chunk) {
    ctx.state.deltaBuffer += chunk;
    if (!shouldUsePhaseAwareBlockReply) {
      appendBlockReplyChunk(ctx, chunk);
    }
  }

  if (ctx.state.streamReasoning) {
    // Handle partial <think> tags: stream whatever reasoning is visible so far.
    ctx.emitReasoningStream(extractThinkingFromTaggedStream(ctx.state.deltaBuffer));
  }
  const next =
    phaseAwareVisibleText ||
    (deliveryPhase === "final_answer"
      ? ""
      : ctx
          .stripBlockTags(ctx.state.deltaBuffer, {
            thinking: false,
            final: false,
            inlineCode: createInlineCodeState(),
          })
          .trim());
  if (next) {
    const wasThinking = ctx.state.partialBlockState.thinking;
    const visibleDelta = chunk ? ctx.stripBlockTags(chunk, ctx.state.partialBlockState) : "";
    if (!wasThinking && ctx.state.partialBlockState.thinking) {
      openReasoningStream(ctx);
    }
    // Detect when thinking block ends (</think> tag processed)
    if (wasThinking && !ctx.state.partialBlockState.thinking) {
      emitReasoningEnd(ctx);
    }
    const parsedDelta = visibleDelta ? ctx.consumePartialReplyDirectives(visibleDelta) : null;
    const parsedFull = parseReplyDirectives(stripTrailingDirective(next));
    const cleanedText = parsedFull.text;
    const { mediaUrls, hasMedia } = resolveSendableOutboundReplyParts(parsedDelta ?? {});
    const hasAudio = Boolean(parsedDelta?.audioAsVoice);
    const previousCleaned = ctx.state.lastStreamedZhushouCleaned ?? "";

    let shouldEmit = false;
    let deltaText = "";
    let replace = false;
    if (!hasZhushouVisibleReply({ text: cleanedText, mediaUrls, audioAsVoice: hasAudio })) {
      shouldEmit = false;
    } else {
      replace = Boolean(previousCleaned && !cleanedText.startsWith(previousCleaned));
      deltaText = replace ? "" : cleanedText.slice(previousCleaned.length);
      shouldEmit = replace
        ? cleanedText !== previousCleaned || hasMedia || hasAudio
        : Boolean(deltaText || hasMedia || hasAudio);
    }

    if (shouldUsePhaseAwareBlockReply) {
      if (replace) {
        ctx.state.blockBuffer = "";
        ctx.blockChunker?.reset();
      }
      const blockReplyChunk = replace ? cleanedText : deltaText;
      if (blockReplyChunk) {
        appendBlockReplyChunk(ctx, blockReplyChunk);
      }

      if (evtType === "text_end" && !ctx.state.lastBlockReplyText && cleanedText) {
        replaceBlockReplyBuffer(ctx, cleanedText);
      }
    }

    ctx.state.lastStreamedZhushou = next;
    ctx.state.lastStreamedZhushouCleaned = cleanedText;

    if (ctx.params.silentExpected || suppressDeterministicApprovalOutput) {
      shouldEmit = false;
    }

    if (shouldEmit) {
      const data = buildZhushouStreamData({
        text: cleanedText,
        delta: deltaText,
        replace,
        mediaUrls,
        phase: zhushouPhase,
      });
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: "zhushou",
        data,
      });
      void ctx.params.onAgentEvent?.({
        stream: "zhushou",
        data,
      });
      ctx.state.emittedZhushouUpdate = true;
      if (ctx.params.onPartialReply && ctx.state.shouldEmitPartialReplies) {
        void ctx.params.onPartialReply(data);
      }
    }
  }

  if (
    !ctx.params.silentExpected &&
    !suppressDeterministicApprovalOutput &&
    ctx.params.onBlockReply &&
    ctx.blockChunking &&
    ctx.state.blockReplyBreak === "text_end"
  ) {
    ctx.blockChunker?.drain({ force: false, emit: ctx.emitBlockChunk });
  }

  if (
    !ctx.params.silentExpected &&
    !suppressDeterministicApprovalOutput &&
    evtType === "text_end" &&
    ctx.state.blockReplyBreak === "text_end"
  ) {
    const zhushouMessageIndex = ctx.state.zhushouMessageIndex;
    void Promise.resolve()
      .then(() => ctx.flushBlockReplyBuffer({ zhushouMessageIndex }))
      .catch((err) => {
        ctx.log.debug(`text_end block reply flush failed: ${String(err)}`);
      });
  }
}

export function handleMessageEnd(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
): void | Promise<void> {
  const msg = evt.message;
  if (msg?.role !== "assistant" || isTranscriptOnlyZhushouZhushouMessage(msg)) {
    return;
  }

  const zhushouMessage = msg;
  const zhushouPhase = resolveZhushouMessagePhase(zhushouMessage);
  const suppressVisibleZhushouOutput = shouldSuppressZhushouVisibleOutput(zhushouMessage);
  const suppressDeterministicApprovalOutput = shouldSuppressDeterministicApprovalOutput(ctx.state);
  ctx.noteLastZhushou(zhushouMessage);
  ctx.recordZhushouUsage((zhushouMessage as { usage?: unknown }).usage);
  if (suppressVisibleZhushouOutput) {
    return;
  }
  promoteThinkingTagsToBlocks(zhushouMessage);

  const rawText = coerceText(extractZhushouText(zhushouMessage));
  const rawVisibleText = coerceText(extractZhushouVisibleText(zhushouMessage));
  appendRawStream({
    ts: Date.now(),
    event: "zhushou_message_end",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    rawText,
    rawThinking: extractZhushouThinking(zhushouMessage),
  });

  const text = resolveSilentReplyFallbackText({
    text: ctx.stripBlockTags(rawVisibleText, { thinking: false, final: false }),
    messagingToolSentTexts: ctx.state.messagingToolSentTexts,
  });
  const rawThinking =
    ctx.state.includeReasoning || ctx.state.streamReasoning
      ? extractZhushouThinking(zhushouMessage) || extractThinkingFromTaggedText(rawText)
      : "";
  const formattedReasoning = rawThinking ? formatReasoningMessage(rawThinking) : "";
  const trimmedText = text.trim();
  const parsedText = trimmedText ? parseReplyDirectives(stripTrailingDirective(trimmedText)) : null;
  let cleanedText = parsedText?.text ?? "";
  let { mediaUrls, hasMedia } = resolveSendableOutboundReplyParts(parsedText ?? {});

  const finalizeMessageEnd = () => {
    ctx.state.deltaBuffer = "";
    ctx.state.blockBuffer = "";
    ctx.blockChunker?.reset();
    ctx.state.blockState.thinking = false;
    ctx.state.blockState.final = false;
    ctx.state.blockState.inlineCode = createInlineCodeState();
    ctx.state.lastStreamedZhushou = undefined;
    ctx.state.lastStreamedZhushouCleaned = undefined;
    ctx.state.reasoningStreamOpen = false;
  };

  const previousStreamedText = ctx.state.lastStreamedZhushouCleaned ?? "";
  const shouldReplaceFinalStream = Boolean(
    previousStreamedText && cleanedText && !cleanedText.startsWith(previousStreamedText),
  );
  const didTextChangeWithinCurrentMessage = Boolean(
    previousStreamedText && cleanedText !== previousStreamedText,
  );
  const finalStreamDelta = shouldReplaceFinalStream
    ? ""
    : cleanedText.slice(previousStreamedText.length);

  if (
    !ctx.params.silentExpected &&
    !suppressDeterministicApprovalOutput &&
    (cleanedText || hasMedia) &&
    (!ctx.state.emittedZhushouUpdate ||
      shouldReplaceFinalStream ||
      didTextChangeWithinCurrentMessage ||
      hasMedia)
  ) {
    const data = buildZhushouStreamData({
      text: cleanedText,
      delta: finalStreamDelta,
      replace: shouldReplaceFinalStream,
      mediaUrls,
      phase: zhushouPhase,
    });
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "zhushou",
      data,
    });
    void ctx.params.onAgentEvent?.({
      stream: "zhushou",
      data,
    });
    ctx.state.emittedZhushouUpdate = true;
    ctx.state.lastStreamedZhushouCleaned = cleanedText;
  }

  const silentExpectedWithoutSentinel =
    ctx.params.silentExpected && !isSilentReplyText(trimmedText, SILENT_REPLY_TOKEN);
  const finalZhushouText = silentExpectedWithoutSentinel ? "" : text;
  const addedDuringMessage = ctx.state.zhushouTexts.length > ctx.state.zhushouTextBaseline;
  const chunkerHasBuffered = ctx.blockChunker?.hasBuffered() ?? false;
  ctx.finalizeZhushouTexts({
    text: finalZhushouText,
    addedDuringMessage,
    chunkerHasBuffered,
  });

  const onBlockReply = ctx.params.onBlockReply;
  const shouldEmitReasoning = Boolean(
    !ctx.params.silentExpected &&
    !suppressDeterministicApprovalOutput &&
    ctx.state.includeReasoning &&
    formattedReasoning &&
    onBlockReply &&
    formattedReasoning !== ctx.state.lastReasoningSent,
  );
  const shouldEmitReasoningBeforeAnswer =
    shouldEmitReasoning && ctx.state.blockReplyBreak === "message_end" && !addedDuringMessage;
  const maybeEmitReasoning = () => {
    if (!shouldEmitReasoning || !formattedReasoning) {
      return;
    }
    ctx.state.lastReasoningSent = formattedReasoning;
    ctx.emitBlockReply({ text: formattedReasoning, isReasoning: true });
  };

  if (shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoning();
  }

  const emitSplitResultAsBlockReply = (
    splitResult: ReturnType<typeof ctx.consumeReplyDirectives> | null | undefined,
  ) => {
    if (!splitResult || !onBlockReply) {
      return;
    }
    const {
      text: cleanedText,
      mediaUrls,
      audioAsVoice,
      replyToId,
      replyToTag,
      replyToCurrent,
    } = splitResult;
    // Emit if there's content OR audioAsVoice flag (to propagate the flag).
    if (hasZhushouVisibleReply({ text: cleanedText, mediaUrls, audioAsVoice })) {
      ctx.emitBlockReply({
        text: cleanedText,
        mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
        audioAsVoice,
        replyToId,
        replyToTag,
        replyToCurrent,
      });
    }
  };

  const hasBufferedBlockReply = ctx.blockChunker
    ? ctx.blockChunker.hasBuffered()
    : ctx.state.blockBuffer.length > 0;

  if (
    !ctx.params.silentExpected &&
    !suppressDeterministicApprovalOutput &&
    text &&
    onBlockReply &&
    (ctx.state.blockReplyBreak === "message_end" ||
      hasBufferedBlockReply ||
      text !== ctx.state.lastBlockReplyText)
  ) {
    if (hasBufferedBlockReply && ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (text !== ctx.state.lastBlockReplyText) {
      // Guard: for text_end channels, if text_end already delivered content
      // (lastBlockReplyText is set), skip this safety send. The text comparison
      // here uses a different stripping pipeline (stripBlockTags with reset state)
      // than emitBlockChunk (stripBlockTags with running blockState +
      // stripDowngradedToolCallText), which can false-positive. When text_end
      // didn't deliver (e.g. commentary suppressed, provider skipped text_end),
      // lastBlockReplyText is still null and message_end must deliver.
      if (ctx.state.blockReplyBreak === "text_end" && ctx.state.lastBlockReplyText != null) {
        ctx.log.debug(
          `Skipping message_end safety send for text_end channel - content already delivered via text_end`,
        );
      } else {
        // Check for duplicates before emitting (same logic as emitBlockChunk).
        const normalizedText = normalizeTextForComparison(text);
        if (
          isMessagingToolDuplicateNormalized(
            normalizedText,
            ctx.state.messagingToolSentTextsNormalized,
          )
        ) {
          ctx.log.debug(
            `Skipping message_end block reply - already sent via messaging tool: ${text.slice(0, 50)}...`,
          );
        } else {
          ctx.state.lastBlockReplyText = text;
          emitSplitResultAsBlockReply(ctx.consumeReplyDirectives(text, { final: true }));
        }
      }
    }
  }

  if (!shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoning();
  }
  if (!ctx.params.silentExpected && ctx.state.streamReasoning && rawThinking) {
    ctx.emitReasoningStream(rawThinking);
  }

  if (!ctx.params.silentExpected && ctx.state.blockReplyBreak === "text_end" && onBlockReply) {
    emitSplitResultAsBlockReply(ctx.consumeReplyDirectives("", { final: true }));
  }

  if (
    !ctx.params.silentExpected &&
    ctx.state.blockReplyBreak === "message_end" &&
    ctx.params.onBlockReplyFlush
  ) {
    const flushBlockReplyBufferResult = ctx.flushBlockReplyBuffer();
    if (isPromiseLike<void>(flushBlockReplyBufferResult)) {
      return flushBlockReplyBufferResult
        .then(() => {
          const onBlockReplyFlushResult = ctx.params.onBlockReplyFlush?.();
          if (isPromiseLike<void>(onBlockReplyFlushResult)) {
            return onBlockReplyFlushResult;
          }
          return undefined;
        })
        .finally(() => {
          finalizeMessageEnd();
        });
    }
    const onBlockReplyFlushResult = ctx.params.onBlockReplyFlush();
    if (isPromiseLike<void>(onBlockReplyFlushResult)) {
      return onBlockReplyFlushResult.finally(() => {
        finalizeMessageEnd();
      });
    }
  }

  finalizeMessageEnd();
  return undefined;
}
