import { describe, expect, it } from "vitest";
import { extractZhushouText as extractChatHistoryZhushouText } from "./chat-history-text.js";
import { extractZhushouText as extractSessionZhushouText } from "./session-message-text.js";

function zhushouTextPart(id: string, phase: string, text: string) {
  return {
    type: "text",
    text,
    textSignature: JSON.stringify({ v: 1, id, phase }),
  };
}

function zhushouMessage(...content: ReturnType<typeof zhushouTextPart>[]) {
  return {
    role: "assistant",
    content,
  };
}

const zhushouTextExtractors = [
  ["chat history", extractChatHistoryZhushouText],
  ["session message", extractSessionZhushouText],
] as const;

describe("phase-aware zhushou text helpers", () => {
  it("fails soft for malformed inputs", () => {
    for (const message of [null, 42, "broken history entry"]) {
      expect(extractChatHistoryZhushouText(message)).toBeUndefined();
      expect(extractSessionZhushouText(message)).toBeUndefined();
    }
  });

  for (const [label, extractZhushouText] of zhushouTextExtractors) {
    it(`prefers final_answer text over commentary in ${label} helpers`, () => {
      const message = zhushouMessage(
        zhushouTextPart("commentary", "commentary", "Need verify healthy."),
        zhushouTextPart("final", "final_answer", "Health check completed successfully."),
      );

      expect(extractZhushouText(message)).toBe("Health check completed successfully.");
    });

    it(`preserves spaces across split final_answer blocks in ${label} helpers`, () => {
      const message = zhushouMessage(
        zhushouTextPart("commentary", "commentary", "Need verify healthy."),
        zhushouTextPart("final_1", "final_answer", "Hi "),
        zhushouTextPart("final_2", "final_answer", "<think>secret</think>there"),
      );

      expect(extractZhushouText(message)).toBe("Hi there");
    });
  }

  it("does not fall back to commentary when an explicit final_answer is empty", () => {
    const message = zhushouMessage(
      zhushouTextPart("commentary", "commentary", "Need simpler use cat overwrite full file."),
      zhushouTextPart("final", "final_answer", "   "),
    );

    expect(extractChatHistoryZhushouText(message)).toBeUndefined();
  });
});
