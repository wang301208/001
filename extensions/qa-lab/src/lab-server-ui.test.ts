import { describe, expect, it } from "vitest";
import { missingUiHtml } from "./lab-server-ui.js";

describe("qa-lab server ui helpers", () => {
  it("renders the removed browser UI placeholder html", () => {
    const html = missingUiHtml();

    expect(html).toContain("QA Lab browser UI removed");
    expect(html).toContain("terminal TUI");
    expect(html).toContain("assistant --tui");
  });
});
