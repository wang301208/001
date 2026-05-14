import { describe, expect, it, vi } from "vitest";
import {
  createTextEndBlockReplyHarness,
  emitZhushouTextDelta,
  emitZhushouTextEnd,
} from "./pi-embedded-subscribe.e2e-harness.js";

describe("subscribeEmbeddedPiSession", () => {
  it("does not duplicate when text_end repeats full content", async () => {
    const onBlockReply = vi.fn();
    const { emit, subscription } = createTextEndBlockReplyHarness({ onBlockReply });

    emitZhushouTextDelta({ emit, delta: "Good morning!" });
    emitZhushouTextEnd({ emit, content: "Good morning!" });
    await Promise.resolve();

    await vi.waitFor(() => {
      expect(onBlockReply).toHaveBeenCalledTimes(1);
    });
    expect(subscription.zhushouTexts).toEqual(["Good morning!"]);
  });
  it("does not duplicate block chunks when text_end repeats full content", async () => {
    const onBlockReply = vi.fn();
    const { emit } = createTextEndBlockReplyHarness({
      onBlockReply,
      blockReplyChunking: {
        minChars: 5,
        maxChars: 40,
        breakPreference: "newline",
      },
    });

    const fullText = "First line\nSecond line\nThird line\n";

    emitZhushouTextDelta({ emit, delta: fullText });
    await Promise.resolve();

    const callsAfterDelta = onBlockReply.mock.calls.length;
    expect(callsAfterDelta).toBeGreaterThan(0);

    emitZhushouTextEnd({ emit, content: fullText });
    await Promise.resolve();

    expect(onBlockReply).toHaveBeenCalledTimes(callsAfterDelta);
  });
});
