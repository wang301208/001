import { describe, expect, it, vi } from "vitest";
import {
  createReasoningFinalAnswerMessage,
  createStubSessionHarness,
  emitZhushouTextDelta,
  emitZhushouTextEnd,
} from "./pi-embedded-subscribe.e2e-harness.js";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";

describe("subscribeEmbeddedPiSession", () => {
  it("keeps zhushouTexts to the final answer when block replies are disabled", () => {
    const { session, emit } = createStubSessionHarness();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
      reasoningMode: "on",
    });

    emit({ type: "message_start", message: { role: "assistant" } });
    emitZhushouTextDelta({ emit, delta: "Final " });
    emitZhushouTextDelta({ emit, delta: "answer" });
    emitZhushouTextEnd({ emit });

    const zhushouMessage = createReasoningFinalAnswerMessage();

    emit({ type: "message_end", message: zhushouMessage });

    expect(subscription.zhushouTexts).toEqual(["Final answer"]);
  });
  it("suppresses partial replies when reasoning is enabled and block replies are disabled", () => {
    const { session, emit } = createStubSessionHarness();

    const onPartialReply = vi.fn();

    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: "run",
      reasoningMode: "on",
      onPartialReply,
    });

    emit({ type: "message_start", message: { role: "assistant" } });
    emitZhushouTextDelta({ emit, delta: "Draft " });
    emitZhushouTextDelta({ emit, delta: "reply" });

    expect(onPartialReply).not.toHaveBeenCalled();

    const zhushouMessage = createReasoningFinalAnswerMessage();

    emit({ type: "message_end", message: zhushouMessage });
    emitZhushouTextEnd({ emit, content: "Draft reply" });

    expect(onPartialReply).not.toHaveBeenCalled();
    expect(subscription.zhushouTexts).toEqual(["Final answer"]);
  });
});
