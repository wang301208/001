import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import {
  createStubSessionHarness,
  emitZhushouTextDelta,
  emitZhushouTextEnd,
} from "./pi-embedded-subscribe.e2e-harness.js";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";

function createBlockReplyHarness(blockReplyBreak: "message_end" | "text_end") {
  const { session, emit } = createStubSessionHarness();
  const onBlockReply = vi.fn();
  subscribeEmbeddedPiSession({
    session,
    runId: "run",
    onBlockReply,
    blockReplyBreak,
  });
  return { emit, onBlockReply };
}

async function emitMessageToolLifecycle(params: {
  emit: (evt: unknown) => void;
  toolCallId: string;
  message: string;
  result: unknown;
}) {
  params.emit({
    type: "tool_execution_start",
    toolName: "message",
    toolCallId: params.toolCallId,
    args: { action: "send", to: "+1555", message: params.message },
  });
  // Wait for async handler to complete.
  await Promise.resolve();
  params.emit({
    type: "tool_execution_end",
    toolName: "message",
    toolCallId: params.toolCallId,
    isError: false,
    result: params.result,
  });
}

function emitZhushouMessageEnd(
  emit: (evt: unknown) => void,
  text: string,
  overrides?: Partial<AssistantMessage>,
) {
  const zhushouMessage = {
    role: "assistant",
    content: [{ type: "text", text }],
    ...overrides,
  } as AssistantMessage;
  emit({ type: "message_end", message: zhushouMessage });
}

function emitZhushouTextEndBlock(emit: (evt: unknown) => void, text: string) {
  emit({ type: "message_start", message: { role: "assistant" } });
  emitZhushouTextDelta({ emit, delta: text });
  emitZhushouTextEnd({ emit });
}

describe("subscribeEmbeddedPiSession", () => {
  it("suppresses message_end block replies when the message tool already sent", async () => {
    const { emit, onBlockReply } = createBlockReplyHarness("message_end");

    const messageText = "This is the answer.";
    await emitMessageToolLifecycle({
      emit,
      toolCallId: "tool-message-1",
      message: messageText,
      result: "ok",
    });
    emitZhushouMessageEnd(emit, messageText);
    await Promise.resolve();

    expect(onBlockReply).not.toHaveBeenCalled();
  });
  it("does not suppress message_end replies when message tool reports error", async () => {
    const { emit, onBlockReply } = createBlockReplyHarness("message_end");

    const messageText = "Please retry the send.";
    await emitMessageToolLifecycle({
      emit,
      toolCallId: "tool-message-err",
      message: messageText,
      result: { details: { status: "error" } },
    });
    emitZhushouMessageEnd(emit, messageText);
    await vi.waitFor(() => {
      expect(onBlockReply).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores delivery-mirror zhushou messages", async () => {
    const { emit, onBlockReply } = createBlockReplyHarness("message_end");

    emitZhushouMessageEnd(emit, "Mirrored transcript text", {
      provider: "zhushou",
      model: "delivery-mirror",
    });
    await Promise.resolve();

    expect(onBlockReply).not.toHaveBeenCalled();
  });

  it("ignores gateway-injected zhushou messages", async () => {
    const { emit, onBlockReply } = createBlockReplyHarness("message_end");

    emitZhushouMessageEnd(emit, "Injected transcript text", {
      provider: "zhushou",
      model: "gateway-injected",
    });
    await Promise.resolve();

    expect(onBlockReply).not.toHaveBeenCalled();
  });

  it("clears block reply state on message_start", async () => {
    const { emit, onBlockReply } = createBlockReplyHarness("text_end");
    emitZhushouTextEndBlock(emit, "OK");
    await Promise.resolve();
    expect(onBlockReply).toHaveBeenCalledTimes(1);

    // New zhushou message with identical output should still emit.
    emitZhushouTextEndBlock(emit, "OK");
    await Promise.resolve();
    expect(onBlockReply).toHaveBeenCalledTimes(2);
  });
});
