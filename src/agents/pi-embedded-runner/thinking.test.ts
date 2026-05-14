import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { castAgentMessage, castAgentMessages } from "../test-helpers/agent-message-fixtures.js";
import {
  assessLastZhushouMessage,
  dropThinkingBlocks,
  isZhushouMessageWithContent,
  sanitizeThinkingForRecovery,
  wrapAnthropicStreamWithRecovery,
} from "./thinking.js";

type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;

function dropSingleZhushouContent(content: Array<Record<string, unknown>>) {
  const messages: AgentMessage[] = [
    castAgentMessage({
      role: "assistant",
      content,
    }),
  ];

  const result = dropThinkingBlocks(messages);
  return {
    zhushou: result[0] as Extract<AgentMessage, { role: "assistant" }>,
    messages,
    result,
  };
}

describe("isZhushouMessageWithContent", () => {
  it("accepts zhushou messages with array content and rejects others", () => {
    const zhushou = castAgentMessage({
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    });
    const user = castAgentMessage({ role: "user", content: "hi" });
    const malformed = castAgentMessage({ role: "assistant", content: "not-array" });

    expect(isZhushouMessageWithContent(zhushou)).toBe(true);
    expect(isZhushouMessageWithContent(user)).toBe(false);
    expect(isZhushouMessageWithContent(malformed)).toBe(false);
  });
});

describe("dropThinkingBlocks", () => {
  it("returns the original reference when no thinking blocks are present", () => {
    const messages: AgentMessage[] = [
      castAgentMessage({ role: "user", content: "hello" }),
      castAgentMessage({ role: "assistant", content: [{ type: "text", text: "world" }] }),
    ];

    const result = dropThinkingBlocks(messages);
    expect(result).toBe(messages);
  });

  it("preserves thinking blocks when the zhushou message is the latest zhushou turn", () => {
    const { zhushou, messages, result } = dropSingleZhushouContent([
      { type: "thinking", thinking: "internal" },
      { type: "text", text: "final" },
    ]);
    expect(result).toBe(messages);
    expect(zhushou.content).toEqual([
      { type: "thinking", thinking: "internal" },
      { type: "text", text: "final" },
    ]);
  });

  it("preserves a latest zhushou turn even when all content blocks are thinking", () => {
    const { zhushou } = dropSingleZhushouContent([
      { type: "thinking", thinking: "internal-only" },
    ]);
    expect(zhushou.content).toEqual([{ type: "thinking", thinking: "internal-only" }]);
  });

  it("preserves thinking blocks in the latest zhushou message", () => {
    const messages: AgentMessage[] = [
      castAgentMessage({ role: "user", content: "first" }),
      castAgentMessage({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "old" },
          { type: "text", text: "old text" },
        ],
      }),
      castAgentMessage({ role: "user", content: "second" }),
      castAgentMessage({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "latest", thinkingSignature: "sig_latest" },
          { type: "text", text: "latest text" },
        ],
      }),
    ];

    const result = dropThinkingBlocks(messages);
    const firstZhushou = result[1] as Extract<AgentMessage, { role: "assistant" }>;
    const latestZhushou = result[3] as Extract<AgentMessage, { role: "assistant" }>;

    expect(firstZhushou.content).toEqual([{ type: "text", text: "old text" }]);
    expect(latestZhushou.content).toEqual([
      { type: "thinking", thinking: "latest", thinkingSignature: "sig_latest" },
      { type: "text", text: "latest text" },
    ]);
  });
});

describe("sanitizeThinkingForRecovery", () => {
  it("drops the latest zhushou message when the thinking block is unsigned", () => {
    const messages = castAgentMessages([
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "partial" }],
      },
    ]);

    const result = sanitizeThinkingForRecovery(messages);
    expect(result.messages).toEqual([messages[0]]);
    expect(result.prefill).toBe(false);
  });

  it("preserves later turns when dropping an incomplete zhushou message", () => {
    const messages = castAgentMessages([
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "partial" }],
      },
      { role: "user", content: "follow up" },
    ]);

    const result = sanitizeThinkingForRecovery(messages);
    expect(result.messages).toEqual([messages[0], messages[2]]);
    expect(result.prefill).toBe(false);
  });

  it("marks signed thinking without text as a prefill recovery case", () => {
    const messages = castAgentMessages([
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "complete", thinkingSignature: "sig" }],
      },
    ]);

    const result = sanitizeThinkingForRecovery(messages);
    expect(result.messages).toBe(messages);
    expect(result.prefill).toBe(true);
  });

  it("marks signed thinking with an empty text block as incomplete text", () => {
    const message = castAgentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "complete", thinkingSignature: "sig" },
        { type: "text", text: "" },
      ],
    });

    expect(assessLastZhushouMessage(message)).toBe("incomplete-text");
  });

  it("treats partial text after signed thinking as valid", () => {
    const message = castAgentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "complete", thinkingSignature: "sig" },
        { type: "text", text: "Here is my answ" },
      ],
    });

    expect(assessLastZhushouMessage(message)).toBe("valid");
  });

  it("treats non-string text blocks as incomplete text when thinking is signed", () => {
    const message = castAgentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "complete", thinkingSignature: "sig" },
        { type: "text", text: { bad: true } },
      ],
    });

    expect(assessLastZhushouMessage(message)).toBe("incomplete-text");
  });
});

describe("wrapAnthropicStreamWithRecovery", () => {
  const anthropicThinkingError = new Error(
    "thinking or redacted_thinking blocks in the latest zhushou message cannot be modified",
  );

  it("retries once when the request is rejected before streaming", async () => {
    let callCount = 0;
    const wrapped = wrapAnthropicStreamWithRecovery(
      (() => {
        callCount += 1;
        return Promise.reject(anthropicThinkingError);
      }) as Parameters<typeof wrapAnthropicStreamWithRecovery>[0],
      { id: "test-session" },
    );

    await expect(
      wrapped(
        {} as never,
        {
          messages: castAgentMessages([
            {
              role: "assistant",
              content: [{ type: "thinking", thinking: "secret", thinkingSignature: "sig" }],
            },
          ]),
        } as never,
        {} as never,
      ),
    ).rejects.toBe(anthropicThinkingError);
    expect(callCount).toBe(2);
  });

  it("does not retry when the stream fails after yielding a chunk", async () => {
    let callCount = 0;
    const wrapped = wrapAnthropicStreamWithRecovery(
      (() => {
        callCount += 1;
        return (async function* failingStream() {
          yield "chunk";
          throw anthropicThinkingError;
        })();
      }) as unknown as Parameters<typeof wrapAnthropicStreamWithRecovery>[0],
      { id: "test-session" },
    );

    const chunks: unknown[] = [];
    const response = wrapped({} as never, { messages: [] } as never, {} as never) as {
      result: () => Promise<unknown>;
    } & AsyncIterable<unknown>;
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["chunk"]);
    await expect(response.result()).rejects.toBe(anthropicThinkingError);
    expect(callCount).toBe(1);
  });

  it("does not retry non-Anthropic-thinking errors", async () => {
    const rateLimitError = new Error("rate limit exceeded");
    let callCount = 0;
    const wrapped = wrapAnthropicStreamWithRecovery(
      (() => {
        callCount += 1;
        return Promise.reject(rateLimitError);
      }) as Parameters<typeof wrapAnthropicStreamWithRecovery>[0],
      { id: "test-session" },
    );

    await expect(wrapped({} as never, { messages: [] } as never, {} as never)).rejects.toBe(
      rateLimitError,
    );
    expect(callCount).toBe(1);
  });

  it("preserves result() for synchronous event streams", async () => {
    const finalMessage = castAgentMessage({
      role: "assistant",
      content: [{ type: "text", text: "done" }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    }) as AssistantMessage;

    const wrapped = wrapAnthropicStreamWithRecovery(
      (() => {
        const stream = createAssistantMessageEventStream();
        queueMicrotask(() => {
          stream.push({ type: "start", partial: finalMessage });
          stream.push({ type: "done", reason: "stop", message: finalMessage });
          stream.end();
        });
        return stream;
      }) as Parameters<typeof wrapAnthropicStreamWithRecovery>[0],
      { id: "test-session" },
    );

    const response = wrapped({} as never, { messages: [] } as never, {} as never) as {
      result: () => Promise<unknown>;
    } & AsyncIterable<unknown>;
    const events: unknown[] = [];
    for await (const event of response) {
      events.push(event);
    }

    await expect(response.result()).resolves.toEqual(finalMessage);
    expect(events).toHaveLength(2);
  });
});
