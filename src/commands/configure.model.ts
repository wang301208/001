import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { promptAuthConfig } from "./configure.gateway-auth.js";
import {
  applyModelAllowlist,
  applyModelFallbacksFromSelection,
  applyPrimaryModel,
  promptDefaultModel,
  promptModelAllowlist,
} from "./model-picker.js";
import { promptCustomApiConfig } from "./onboard-custom.js";

type ModelConfigAction = "custom" | "auth" | "default" | "allowlist" | "skip";

export async function promptModelConfig(
  cfg: ZhushouConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<ZhushouConfig> {
  await prompter.note(
    [
      "这里用于配置远程模型、提供商凭据、默认模型和模型选择列表。",
      "如果只是接入自定义远程模型，请选择“添加自定义远程模型”。",
    ].join("\n"),
    "模型配置",
  );

  const action = await prompter.select<ModelConfigAction>({
    message: "模型配置操作",
    options: [
      {
        value: "custom",
        label: "添加自定义远程模型",
        hint: "填写 Base URL、API Key、模型名称并保存为默认模型",
      },
      {
        value: "auth",
        label: "配置提供商凭据",
        hint: "OpenAI、插件提供商、OAuth 或 API Key",
      },
      {
        value: "default",
        label: "选择默认模型",
        hint: "从已有模型目录中设置助手默认模型",
      },
      {
        value: "allowlist",
        label: "配置模型列表",
        hint: "控制 /model 可选模型，并同步回退模型",
      },
      {
        value: "skip",
        label: "暂不修改",
      },
    ],
    initialValue: "custom",
  });

  if (action === "custom") {
    const customResult = await promptCustomApiConfig({ prompter, runtime, config: cfg });
    return customResult.config;
  }

  if (action === "auth") {
    return await promptAuthConfig(cfg, runtime, prompter);
  }

  if (action === "default") {
    let next = cfg;
    const modelSelection = await promptDefaultModel({
      config: next,
      prompter,
      allowKeep: true,
      ignoreAllowlist: true,
      includeProviderPluginSetups: true,
      workspaceDir: resolveDefaultAgentWorkspaceDir(),
      runtime,
      message: "默认模型",
    });
    if (modelSelection.config) {
      next = modelSelection.config;
    }
    if (modelSelection.model) {
      next = applyPrimaryModel(next, modelSelection.model);
    }
    return next;
  }

  if (action === "allowlist") {
    const allowlistSelection = await promptModelAllowlist({
      config: cfg,
      prompter,
      message: "模型列表（多选）",
    });
    if (!allowlistSelection.models) {
      return cfg;
    }
    let next = applyModelAllowlist(cfg, allowlistSelection.models);
    next = applyModelFallbacksFromSelection(next, allowlistSelection.models);
    return next;
  }

  return cfg;
}
