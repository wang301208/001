import { completeSimple, getModel } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import {
  createSingleUserPromptMessage,
  extractNonEmptyZhushouText,
  isLiveTestEnabled,
} from "./live-test-helpers.js";

const ZAI_KEY = process.env.ZAI_API_KEY ?? process.env.Z_AI_API_KEY ?? "";
const LIVE = isLiveTestEnabled(["ZAI_LIVE_TEST"]);

const describeLive = LIVE && ZAI_KEY ? describe : describe.skip;

async function expectModelReturnsZhushouText(modelId: "glm-5" | "glm-4.7") {
  const model = getModel("zai", modelId);
  const res = await completeSimple(
    model,
    {
      messages: createSingleUserPromptMessage(),
    },
    { apiKey: ZAI_KEY, maxTokens: 64 },
  );
  const text = extractNonEmptyZhushouText(res.content);
  expect(text.length).toBeGreaterThan(0);
}

describeLive("zai live", () => {
  it("returns zhushou text", async () => {
    await expectModelReturnsZhushouText("glm-5");
  }, 20000);

  it("glm-4.7 returns zhushou text", async () => {
    await expectModelReturnsZhushouText("glm-4.7");
  }, 20000);
});
