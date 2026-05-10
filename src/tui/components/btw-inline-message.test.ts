import { describe, expect, it } from "vitest";
import { BtwInlineMessage } from "./btw-inline-message.js";

describe("btw inline message", () => {
  it("renders the BTW question, answer, and dismiss hint inline", () => {
    const message = new BtwInlineMessage({
      question: "17 * 19 等于多少？",
      text: "323",
    });

    const rendered = message.render(80).join("\n");
    expect(rendered).toContain("顺便问一下：17 * 19 等于多少？");
    expect(rendered).toContain("323");
    expect(rendered).toContain("按 Enter 或 Esc 关闭");
  });
});
