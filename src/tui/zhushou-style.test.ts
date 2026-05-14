import { describe, expect, it } from "vitest";
import { visibleWidth } from "@mariozechner/pi-tui";
import { stripAnsi } from "../terminal/ansi.js";
import {
  ZHUSHOU_HELP_TEXT,
  ZhushouSessionPanel,
  formatZhushouWelcomePanel,
  formatZhushouStatusRule,
} from "./zhushou-style.js";

const oldBrands = ["Her" + "mes", "No" + "us", "Open" + "Claw", "open" + "claw"];

function expectNoOldBrand(text: string) {
  for (const brand of oldBrands) {
    expect(text).not.toContain(brand);
  }
}

describe("zhushou terminal branding", () => {
  it("renders a wide welcome panel with art on the left and natural-language examples on the right", () => {
    const output = stripAnsi(formatZhushouWelcomePanel(110));
    const lines = output.split("\n");

    expect(output).toContain("助手");
    expect(output).toContain("查看状态");
    expect(output).toContain("切换模型");
    expect(output).not.toContain("/help");
    expect(output).not.toContain("/status");
    expectNoOldBrand(output);
    expect(lines.some((line) => line.includes("⣠⣤⡴⠒⠒") && line.includes("助手"))).toBe(true);
    expect(lines.some((line) => line.trimStart().startsWith("⠀⠀") && line.includes("查看状态"))).toBe(true);
  });

  it("renders the session panel as a Hermes-style left-art/right-command layout", () => {
    const renderedPanel = new ZhushouSessionPanel();
    renderedPanel.update({
      agentLabel: "main (助手)",
      sessionLabel: "main",
      sessionInfo: {
        model: "longcat-2.0-preview",
        modelProvider: "custom",
        totalTokens: 42,
        contextTokens: 128000,
      },
      agents: [{ id: "main", name: "助手" }],
      gatewayLabel: "stdio://local-gateway",
      width: 112,
    });

    const text = stripAnsi(renderedPanel.render(112).join("\n"));
    const lines = text.split("\n");

    expect(lines[0]).toContain("╭");
    expect(text).toContain("助手");
    expect(text).toContain("▾ 示例");
    expect(lines.some((line) => line.includes("查看状态") && line.includes("查看当前状态"))).toBe(true);
    expect(text).toContain("▸ 可用工具");
    expect(text).toContain("▸ 可用技能");
    expect(text).toContain("直接输入目标即可调用功能");
    expect(text).toContain("自然语言直达");
    expect(text).not.toContain("113 tools");
    expect(text).not.toContain("/help");
    expect(text).not.toContain("网关 stdio://local-gateway");
    expect(text).toContain("自动压缩");
    expect(text).toContain("[----------] 0%");
    expect(lines.some((line) => line.includes("⣠⣤⡴⠒⠒") && line.includes("助手"))).toBe(true);
    expect(lines.some((line) => line.includes("模型 longcat 2.0 preview"))).toBe(true);
    expect(lines.some((line) => line.includes("会话 main"))).toBe(true);
    expectNoOldBrand(text);
  });

  it("keeps the session panel within narrow terminal width", () => {
    const width = 80;
    const renderedPanel = new ZhushouSessionPanel();

    renderedPanel.update({
      agentLabel: "main (助手)",
      sessionLabel: "main",
      sessionInfo: {
        model: "longcat-2.0-preview",
        modelProvider: "custom",
        totalTokens: 42,
        contextTokens: 128000,
      },
      agents: [{ id: "main", name: "助手" }],
      gatewayLabel: "stdio://local-gateway",
      width,
    });

    for (const line of renderedPanel.render(width)) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  });

  it("shows context compaction progress when token usage is known", () => {
    const renderedPanel = new ZhushouSessionPanel();
    renderedPanel.update({
      agentLabel: "main (助手)",
      sessionLabel: "main",
      sessionInfo: {
        model: "longcat-2.0-preview",
        modelProvider: "custom",
        totalTokens: 64000,
        contextTokens: 128000,
        compactionCount: 2,
      },
      agents: [{ id: "main", name: "助手" }],
      gatewayLabel: "stdio://local-gateway",
      width: 112,
    });

    const text = stripAnsi(renderedPanel.render(112).join("\n"));

    expect(text).toContain("自动压缩");
    expect(text).toContain("[#####-----] 50%");
    expect(text).toContain("2 次");
    expect(text).not.toContain("网关 stdio://local-gateway");
  });

  it("shows auto-compaction progress instead of an unknown token placeholder", () => {
    const renderedPanel = new ZhushouSessionPanel();
    renderedPanel.update({
      agentLabel: "main (助手)",
      sessionLabel: "main",
      sessionInfo: {
        model: "longcat-2.0-preview",
        modelProvider: "custom",
        totalTokens: null,
        contextTokens: 128000,
      },
      agents: [{ id: "main", name: "助手" }],
      gatewayLabel: "stdio://local-gateway",
      width: 112,
    });

    const text = stripAnsi(renderedPanel.render(112).join("\n"));

    expect(text).toContain("自动压缩");
    expect(text).toContain("令牌 0/128k");
    expect(text).toContain("[----------] 0%");
    expect(text).not.toContain("令牌 ?/128k");
    expect(text).not.toContain("网关 stdio://local-gateway");
  });

  it("stacks the welcome panel on narrow terminals", () => {
    const output = stripAnsi(formatZhushouWelcomePanel(48));
    const lines = output.split("\n");
    const artLine = lines.findIndex((line) => line.includes("助手"));
    const commandLine = lines.findIndex((line) => line.includes("查看状态"));

    expect(artLine).toBeGreaterThanOrEqual(0);
    expect(commandLine).toBeGreaterThan(artLine);
  });

  it("keeps help text branded as zhushou commands only", () => {
    expect(ZHUSHOU_HELP_TEXT).toContain("助手自然语言交互");
    expect(ZHUSHOU_HELP_TEXT).not.toContain("/help");
    expectNoOldBrand(ZHUSHOU_HELP_TEXT);
  });

  it("keeps the compact status rule free from old branding", () => {
    const output = stripAnsi(
      formatZhushouStatusRule({
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
