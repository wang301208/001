import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { createSubscribedSessionHarness } from "./pi-embedded-subscribe.e2e-harness.js";

type ZhushouMessageWithPhase = AssistantMessage & {
  phase?: "commentary" | "final_answer";
};

describe("subscribeEmbeddedPiSession", () => {
  it("suppresses commentary-phase zhushou messages before tool use", () => {
    const onBlockReply = vi.fn();
    const onPartialReply = vi.fn();
    const { emit, subscription } = createSubscribedSessionHarness({
      runId: "run",
      onBlockReply,
      onPartialReply,
      blockReplyBreak: "message_end",
    });

    const commentaryMessage = {
      role: "assistant",
      phase: "commentary",
      content: [{ type: "text", text: "Need send." }],
      stopReason: "toolUse",
    } as ZhushouMessageWithPhase;

    emit({ type: "message_start", message: commentaryMessage });
    emit({ type: "message_end", message: commentaryMessage });

    expect(onBlockReply).not.toHaveBeenCalled();
    expect(onPartialReply).not.toHaveBeenCalled();
    expect(subscription.zhushouTexts).toEqual([]);
  });

  it("suppresses commentary when phase is only present in textSignature metadata", () => {
    const onBlockReply = vi.fn();
    const onPartialReply = vi.fn();
    const { emit, subscription } = createSubscribedSessionHarness({
      runId: "run",
      onBlockReply,
      onPartialReply,
      blockReplyBreak: "message_end",
    });

    const commentaryMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Need send.",
          textSignature: JSON.stringify({ v: 1, id: "msg_sig", phase: "commentary" }),
        },
      ],
      stopReason: "toolUse",
    } as AssistantMessage;

    emit({ type: "message_start", message: commentaryMessage });
    emit({
      type: "message_update",
      message: commentaryMessage,
      zhushouMessageEvent: { type: "text_delta", delta: "Need send." },
    });
    emit({ type: "message_end", message: commentaryMessage });

    expect(onBlockReply).not.toHaveBeenCalled();
    expect(onPartialReply).not.toHaveBeenCalled();
    expect(subscription.zhushouTexts).toEqual([]);
  });
});
