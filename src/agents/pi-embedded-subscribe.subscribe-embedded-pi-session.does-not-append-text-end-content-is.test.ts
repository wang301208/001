import { describe, expect, it, vi } from "vitest";
import {
  createTextEndBlockReplyHarness,
  emitZhushouTextDelta,
  emitZhushouTextEnd,
} from "./pi-embedded-subscribe.e2e-harness.js";

describe("subscribeEmbeddedPiSession", () => {
  function setupTextEndSubscription() {
    const onBlockReply = vi.fn();
    const { emit, subscription } = createTextEndBlockReplyHarness({ onBlockReply });

    const emitDelta = (delta: string) => {
      emitZhushouTextDelta({ emit, delta });
    };

    const emitTextEnd = (content: string) => {
      emitZhushouTextEnd({ emit, content });
    };

    return { onBlockReply, subscription, emitDelta, emitTextEnd };
  }

  it.each([
    {
      name: "does not append when text_end content is a prefix of deltas",
      delta: "Hello world",
      content: "Hello",
      expected: "Hello world",
    },
    {
      name: "does not append when text_end content is already contained",
      delta: "Hello world",
      content: "world",
      expected: "Hello world",
    },
    {
      name: "appends suffix when text_end content extends deltas",
      delta: "Hello",
      content: "Hello world",
      expected: "Hello world",
    },
  ])("$name", async ({ delta, content, expected }) => {
    const { onBlockReply, subscription, emitDelta, emitTextEnd } = setupTextEndSubscription();

    emitDelta(delta);
    emitTextEnd(content);
    await Promise.resolve();

    await vi.waitFor(() => {
      expect(onBlockReply).toHaveBeenCalledTimes(1);
    });
    expect(subscription.zhushouTexts).toEqual([expected]);
  });
});
