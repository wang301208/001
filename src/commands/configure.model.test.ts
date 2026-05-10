import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

const mocks = vi.hoisted(() => ({
  promptAuthConfig: vi.fn(),
  promptCustomApiConfig: vi.fn(),
  promptDefaultModel: vi.fn(),
  promptModelAllowlist: vi.fn(),
}));

vi.mock("./configure.gateway-auth.js", () => ({
  promptAuthConfig: mocks.promptAuthConfig,
}));

vi.mock("./onboard-custom.js", () => ({
  promptCustomApiConfig: mocks.promptCustomApiConfig,
}));

vi.mock("./model-picker.js", async (importActual) => {
  const actual = await importActual<typeof import("./model-picker.js")>();
  return {
    ...actual,
    promptDefaultModel: mocks.promptDefaultModel,
    promptModelAllowlist: mocks.promptModelAllowlist,
  };
});

import { promptModelConfig } from "./configure.model.js";

function runtime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

function prompter(selection: string): WizardPrompter {
  return {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async () => {}),
    select: vi.fn(async () => selection),
    multiselect: vi.fn(async () => []),
    text: vi.fn(async () => ""),
    confirm: vi.fn(async () => true),
    progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
    showValidationErrors: vi.fn(async () => {}),
    showConfigDiff: vi.fn(async () => {}),
  } as WizardPrompter;
}

describe("promptModelConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a visible model configuration menu before provider discovery", async () => {
    const p = prompter("custom");
    mocks.promptCustomApiConfig.mockResolvedValue({
      config: {
        agents: { defaults: { model: { primary: "custom/demo" } } },
      },
    });

    const result = await promptModelConfig({}, runtime(), p);

    expect(p.note).toHaveBeenCalledWith(expect.stringContaining("远程模型"), "模型配置");
    expect(p.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "模型配置操作",
        options: expect.arrayContaining([
          expect.objectContaining({ value: "custom", label: "添加自定义远程模型" }),
          expect.objectContaining({ value: "auth", label: "配置提供商凭据" }),
          expect.objectContaining({ value: "default", label: "选择默认模型" }),
        ]),
      }),
    );
    expect(mocks.promptCustomApiConfig).toHaveBeenCalledOnce();
    expect(mocks.promptAuthConfig).not.toHaveBeenCalled();
    expect(result.agents?.defaults?.model).toEqual({ primary: "custom/demo" });
  });

  it("only enters provider auth setup after the user chooses credentials", async () => {
    const p = prompter("auth");
    mocks.promptAuthConfig.mockResolvedValue({
      models: { providers: { openai: { api: "openai-responses" } } },
    });

    const result = await promptModelConfig({}, runtime(), p);

    expect(mocks.promptAuthConfig).toHaveBeenCalledOnce();
    expect(mocks.promptCustomApiConfig).not.toHaveBeenCalled();
    expect(result.models?.providers?.openai?.api).toBe("openai-responses");
  });
});
