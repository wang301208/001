import { describe, expect, it } from "vitest";
import { stripAnsi } from "../terminal/ansi.js";
import {
  ASSISTANT_HELP_TEXT,
  formatAssistantWelcomePanel,
  formatAssistantStatusRule,
} from "./assistant-style.js";

const oldBrands = ["Her" + "mes", "No" + "us", "Open" + "Claw", "open" + "claw"];

function expectNoOldBrand(text: string) {
  for (const brand of oldBrands) {
    expect(text).not.toContain(brand);
  }
}

describe("assistant terminal branding", () => {
  it("renders a wide welcome panel with art on the left and commands on the right", () => {
    const output = stripAnsi(formatAssistantWelcomePanel(110));
    const lines = output.split("\n");

    expect(output).toContain("助手");
    expect(output).toContain("/help");
    expect(output).toContain("/status");
    expect(output).toContain("/model");
    expectNoOldBrand(output);
    expect(lines.some((line) => line.includes("助手") && line.includes("/help"))).toBe(true);
  });

  it("stacks the welcome panel on narrow terminals", () => {
    const output = stripAnsi(formatAssistantWelcomePanel(48));
    const lines = output.split("\n");
    const artLine = lines.findIndex((line) => line.includes("助手"));
    const commandLine = lines.findIndex((line) => line.includes("/help"));

    expect(artLine).toBeGreaterThanOrEqual(0);
    expect(commandLine).toBeGreaterThan(artLine);
  });

  it("keeps help text branded as assistant commands only", () => {
    expect(ASSISTANT_HELP_TEXT).toContain("助手命令");
    expect(ASSISTANT_HELP_TEXT).toContain("/help");
    expectNoOldBrand(ASSISTANT_HELP_TEXT);
  });

  it("keeps the compact status rule free from old branding", () => {
    const output = stripAnsi(
      formatAssistantStatusRule({
        activityStatus: "idle",
        connectionStatus: "connected",
        sessionInfo: { model: "local-model", modelProvider: "local" },
        agentLabel: "main",
        sessionLabel: "main",
        width: 120,
      }),
    );

    expectNoOldBrand(output);
  });
});
