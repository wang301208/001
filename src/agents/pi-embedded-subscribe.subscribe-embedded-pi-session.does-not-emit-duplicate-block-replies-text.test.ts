import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import {
  createStubSessionHarness,
  createTextEndBlockReplyHarness,
  emitZhushouTextDelta,
  emitZhushouTextEnd,
} from "./pi-embedded-subscribe.e2e-harness.js";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";

describe("subscribeEmbeddedPiSession", () => {
  it("does not emit duplicate block replies when text_end repeats", async () => {
    const onBlockReply = vi.fn();
    const { emit, subscription } = createTextEndBlockReplyHarness({ onBlockReply });

    emitZhushouTextDelta({ emit, delta: "Hello block" });
    emitZhushouTextEnd({ emit });
    emitZhushouTextEnd({ emit });
    await Promise.resolve();

    expect(onBlockReply).toHaveBeenCalledTimes(1);
    expect(subscription.zhushouTexts).toEqual(["Hello block"]);
  });
  it("does not duplicate zhushouTexts when message_end repeats", () => {
    const { session, emit } = createStubSessionHarness();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
    });

    const zhushouMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world" }],
    } as AssistantMessage;

    emit({ type: "message_end", message: zhushouMessage });
    emit({ type: "message_end", message: zhushouMessage });

    expect(subscription.zhushouTexts).toEqual(["Hello world"]);
  });
  it("does not duplicate zhushouTexts when message_end repeats with trailing whitespace changes", () => {
    const { session, emit } = createStubSessionHarness();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
    });

    const zhushouMessageWithNewline = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world\n" }],
    } as AssistantMessage;

    const zhushouMessageTrimmed = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world" }],
    } as AssistantMessage;

    emit({ type: "message_end", message: zhushouMessageWithNewline });
    emit({ type: "message_end", message: zhushouMessageTrimmed });

    expect(subscription.zhushouTexts).toEqual(["Hello world"]);
  });
  it("does not duplicate zhushouTexts when message_end repeats with reasoning blocks", () => {
    const { session, emit } = createStubSessionHarness();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
      reasoningMode: "on",
    });

    const zhushouMessage = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Because" },
        { type: "text", text: "Hello world" },
      ],
    } as AssistantMessage;

    emit({ type: "message_end", message: zhushouMessage });
    emit({ type: "message_end", message: zhushouMessage });

    expect(subscription.zhushouTexts).toEqual(["Hello world"]);
  });
  it("populates zhushouTexts for non-streaming models with chunking enabled", () => {
    // Non-streaming models (e.g. zai/glm-4.7): no text_delta events; message_end
    // must still populate zhushouTexts so providers can deliver a final reply.
    const { session, emit } = createStubSessionHarness();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
      blockReplyChunking: { minChars: 50, maxChars: 200 }, // Chunking enabled
    });

    // Simulate non-streaming model: only message_start and message_end, no text_delta
    emit({ type: "message_start", message: { role: "assistant" } });

    const zhushouMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Response from non-streaming model" }],
    } as AssistantMessage;

    emit({ type: "message_end", message: zhushouMessage });

    expect(subscription.zhushouTexts).toEqual(["Response from non-streaming model"]);
  });
});
