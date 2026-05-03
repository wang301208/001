import { formatCliCommand } from "../cli/command-format.js";
import type {
  AuthChoice,
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import { readConfigFileSnapshot, resolveGatewayPort, writeConfigFile } from "../config/config.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeSecretInputString } from "../config/types.secrets.js";
import { formatErrorMessage } from "../infra/errors.js";
import {
  buildPluginCompatibilityNotices,
  formatPluginCompatibilityNotice,
} from "../plugins/status.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { PRODUCT_NAME } from "./assistant-constants.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";
import { createSnapshot, saveConfigSnapshot } from "./rollback.js";
import { resolveSetupSecretInputString } from "./setup.secret-input.js";
import type { QuickstartGatewayDefaults, WizardFlow } from "./setup.types.js";
import { applyTemplate, findTemplate, templateSelectOptions } from "./templates.js";
import {
  detectConfigConflicts,
  formatValidationResult,
  validateWizardConfig,
  validationResultToWizardIssues,
} from "./validation.js";

async function resolveAuthChoiceModelSelectionPolicy(params: {
  authChoice: string;
  config: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  resolvePreferredProviderForAuthChoice: (params: {
    choice: string;
    config?: OpenClawConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }) => Promise<string | undefined>;
}): Promise<{
  preferredProvider?: string;
  promptWhenAuthChoiceProvided: boolean;
  allowKeepCurrent: boolean;
}> {
  const preferredProvider = await params.resolvePreferredProviderForAuthChoice({
    choice: params.authChoice,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });

  const { resolvePluginProviders, resolveProviderPluginChoice } =
    await import("../plugins/provider-auth-choice.runtime.js");
  const providers = resolvePluginProviders({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    mode: "setup",
  });
  const resolvedChoice = resolveProviderPluginChoice({
    providers,
    choice: params.authChoice,
  });
  const matchedProvider =
    resolvedChoice?.provider ??
    (() => {
      const preferredId = preferredProvider?.trim();
      if (!preferredId) {
        return undefined;
      }
      return providers.find(
        (provider) => typeof provider.id === "string" && provider.id.trim() === preferredId,
      );
    })();
  const setupPolicy =
    resolvedChoice?.wizard?.modelSelection ?? matchedProvider?.wizard?.setup?.modelSelection;

  return {
    preferredProvider,
    promptWhenAuthChoiceProvided: setupPolicy?.promptWhenAuthChoiceProvided === true,
    allowKeepCurrent: setupPolicy?.allowKeepCurrent ?? true,
  };
}

async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
}) {
  if (params.opts.acceptRisk === true) {
    return;
  }

  await params.prompter.note(
    [
      "安全须知 — 请仔细阅读。",
      "",
      `${PRODUCT_NAME} 目前处于测试阶段，请预期可能存在不稳定性。`,
      `默认情况下，${PRODUCT_NAME} 是单用户个人代理，只有一个可信操作者边界。`,
      "启用工具后，代理可以读取文件并执行操作。",
      "恶意提示词可能诱导代理执行危险行为。",
      "",
      `${PRODUCT_NAME} 默认不具备多租户隔离能力。`,
      "若多名用户共用同一个启用了工具的代理，他们将共享该代理的操作权限。",
      "",
      "如果您不熟悉安全加固和访问控制，请勿将代理暴露给不可信的输入来源。",
      "开启工具或将代理对外暴露前，请寻求有经验的人员协助。",
      "",
      "推荐安全基线：",
      "- 配置配对/白名单 + 提及门控（mention gating）。",
      "- 多用户/共享收件箱：拆分信任边界（分别使用独立网关/凭据，最好使用独立 OS 用户/主机）。",
      "- 沙箱 + 最小权限工具。",
      "- 共享收件箱：隔离 DM 会话（session.dmScope: per-channel-peer），并最小化工具访问权限。",
      "- 将密钥保存在代理可访问文件系统之外。",
      "- 对于带工具或不可信收件箱的代理，使用最强可用模型。",
      "",
      "定期运行安全审计：",
      `${formatCliCommand("openclaw security audit --deep")}`,
      `${formatCliCommand("openclaw security audit --fix")}`,
      "",
      "安全文档：https://docs.openclaw.ai/gateway/security",
    ].join("\n"),
    "安全须知",
  );

  const ok = await params.prompter.confirm({
    message: "我理解这是个人代理，共享/多用户场景需要额外安全加固。继续？",
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError("risk not accepted");
  }
}

export async function runSetupWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  const onboardHelpers = await import("../commands/onboard-helpers.js");
  onboardHelpers.printWizardHeader(runtime);
  await prompter.intro(`${PRODUCT_NAME} 设置`);
  await requireRiskAcknowledgement({ opts, prompter });

  const snapshot = await readConfigFileSnapshot();
  let baseConfig: OpenClawConfig = snapshot.valid
    ? snapshot.exists
      ? (snapshot.sourceConfig ?? snapshot.config)
      : {}
    : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(onboardHelpers.summarizeExistingConfig(baseConfig), "配置无效");
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "文档：https://docs.openclaw.ai/gateway/configuration",
        ].join("\n"),
        "配置问题",
      );
    }
    await prompter.outro(
      `配置无效。请运行 \`${formatCliCommand("openclaw doctor")}\` 修复后重新执行设置。`,
    );
    runtime.exit(1);
    return;
  }

  // Strict validation: reject configs that contain legacy fields unsupported by this version.
  if (snapshot.exists && snapshot.valid) {
    const validationResult = validateWizardConfig(baseConfig, {
      legacyIssues: snapshot.legacyIssues,
    });
    if (!validationResult.valid) {
      const formatted = formatValidationResult(validationResult);
      await prompter.note(formatted, "配置校验失败");
      await prompter.outro(
        `检测到不支持的旧版配置字段。请运行 \`${formatCliCommand("openclaw doctor")}\` 迁移后重试。`,
      );
      runtime.exit(1);
      return;
    }

    // Show conflicts as warnings before proceeding (non-blocking — wizard will auto-resolve them).
    const conflicts = detectConfigConflicts(baseConfig);
    if (conflicts.length > 0) {
      await prompter.showValidationErrors(
        conflicts.map((c) => ({ path: c.paths.join(", "), message: c.message, severity: "conflict" as const })),
        "配置冲突检测",
      );
    }
  }

  const rollbackBaseConfig = structuredClone(baseConfig);
  let rollbackSnapshotPath: string | undefined;
  const ensureRollbackSnapshot = async () => {
    if (rollbackSnapshotPath || !snapshot.exists || !snapshot.valid) {
      return;
    }
    rollbackSnapshotPath = await saveConfigSnapshot(
      createSnapshot(rollbackBaseConfig, "before-setup-wizard"),
    );
  };

  const validateBeforeWrite = async (config: OpenClawConfig): Promise<boolean> => {
    const validationResult = validateWizardConfig(config);
    if (validationResult.valid) {
      return true;
    }
    await prompter.showValidationErrors(
      validationResultToWizardIssues(validationResult),
      "写入前配置校验",
    );
    await prompter.outro(
      `配置存在不支持的旧字段或冲突。请运行 \`${formatCliCommand("openclaw doctor")}\` 修复后重试。`,
    );
    runtime.exit(1);
    return false;
  };

  const persistWizardConfig = async (config: OpenClawConfig): Promise<boolean> => {
    if (!(await validateBeforeWrite(config))) {
      return false;
    }
    await ensureRollbackSnapshot();
    await writeConfigFile(config);
    return true;
  };

  const compatibilityNotices = snapshot.valid
    ? buildPluginCompatibilityNotices({ config: baseConfig })
    : [];
  if (compatibilityNotices.length > 0) {
    await prompter.note(
      [
        `当前配置中检测到 ${compatibilityNotices.length} 条插件兼容性提示。`,
        ...compatibilityNotices
          .slice(0, 4)
          .map((notice) => `- ${formatPluginCompatibilityNotice(notice)}`),
        ...(compatibilityNotices.length > 4
          ? [`- ... 另有 ${compatibilityNotices.length - 4} 条`]
          : []),
        "",
        `检查：${formatCliCommand("openclaw doctor")}`,
        `详情：${formatCliCommand("openclaw plugins inspect --all")}`,
      ].join("\n"),
      "插件兼容性",
    );
  }

  const quickstartHint = `稍后可通过 ${formatCliCommand("openclaw configure")} 修改详细配置。`;
  const manualHint = "配置端口、网络绑定、Tailscale 及认证选项。";
  const explicitFlowRaw = opts.flow?.trim();
  const normalizedExplicitFlow = explicitFlowRaw === "manual" ? "advanced" : explicitFlowRaw;
  if (
    normalizedExplicitFlow &&
    normalizedExplicitFlow !== "quickstart" &&
    normalizedExplicitFlow !== "advanced"
  ) {
    runtime.error("--flow 参数无效（可选值：quickstart、manual 或 advanced）。");
    runtime.exit(1);
    return;
  }
  const explicitFlow: WizardFlow | undefined =
    normalizedExplicitFlow === "quickstart" || normalizedExplicitFlow === "advanced"
      ? normalizedExplicitFlow
      : undefined;
  let flow: WizardFlow =
    explicitFlow ??
    (await prompter.select({
      message: "选择设置模式",
      options: [
        { value: "quickstart", label: "快速设置（QuickStart）", hint: quickstartHint },
        { value: "advanced", label: "手动配置（Manual）", hint: manualHint },
      ],
      initialValue: "quickstart",
    }));

  if (opts.mode === "remote" && flow === "quickstart") {
    await prompter.note(
      "快速设置仅支持本地网关，已自动切换至手动配置模式。",
      "QuickStart",
    );
    flow = "advanced";
  }

  if (snapshot.exists) {
    await prompter.note(
      onboardHelpers.summarizeExistingConfig(baseConfig),
      "检测到已有配置",
    );

    const action = await prompter.select({
      message: "配置处理方式",
      options: [
        { value: "keep", label: "保留现有值" },
        { value: "modify", label: "更新值" },
        { value: "reset", label: "重置" },
      ],
    });

    if (action === "reset") {
      const workspaceDefault =
        baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE;
      const resetScope = (await prompter.select({
        message: "重置范围",
        options: [
          { value: "config", label: "仅重置配置" },
          {
            value: "config+creds+sessions",
            label: "配置 + 凭据 + 会话",
          },
          {
            value: "full",
            label: "完全重置（配置 + 凭据 + 会话 + 工作区）",
          },
        ],
      })) as ResetScope;
      await onboardHelpers.handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
    }
  }

  let appliedInitializationTemplate = false;
  if (Object.keys(baseConfig).length === 0) {
    if (flow === "quickstart") {
      const minimalTemplate = findTemplate("minimal");
      if (minimalTemplate) {
        baseConfig = applyTemplate(baseConfig, minimalTemplate);
        appliedInitializationTemplate = true;
      }
    } else {
      const templateId = await prompter.select({
        message: "选择初始化模板",
        options: templateSelectOptions(),
        initialValue: opts.mode === "remote" ? "remote-gateway" : "minimal",
      });
      if (templateId !== "__skip__") {
        const template = findTemplate(templateId);
        if (template) {
          baseConfig = applyTemplate(baseConfig, template);
          appliedInitializationTemplate = true;
        }
      }
    }
  }

  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting =
      !appliedInitializationTemplate &&
      (typeof baseConfig.gateway?.port === "number" ||
        baseConfig.gateway?.bind !== undefined ||
        baseConfig.gateway?.auth?.mode !== undefined ||
        baseConfig.gateway?.auth?.token !== undefined ||
        baseConfig.gateway?.auth?.password !== undefined ||
        baseConfig.gateway?.customBindHost !== undefined ||
        baseConfig.gateway?.tailscale?.mode !== undefined);

    const bindRaw = baseConfig.gateway?.bind;
    const bind =
      bindRaw === "loopback" ||
      bindRaw === "lan" ||
      bindRaw === "auto" ||
      bindRaw === "custom" ||
      bindRaw === "tailnet"
        ? bindRaw
        : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (
      baseConfig.gateway?.auth?.mode === "token" ||
      baseConfig.gateway?.auth?.mode === "password"
    ) {
      authMode = baseConfig.gateway.auth.mode;
    } else if (baseConfig.gateway?.auth?.token) {
      authMode = "token";
    } else if (baseConfig.gateway?.auth?.password) {
      authMode = "password";
    }

    const tailscaleRaw = baseConfig.gateway?.tailscale?.mode;
    const tailscaleMode =
      tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
        ? tailscaleRaw
        : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  if (flow === "quickstart") {
    const formatBind = (value: "loopback" | "lan" | "auto" | "custom" | "tailnet") => {
      if (value === "loopback") {
        return "本地回环（127.0.0.1）";
      }
      if (value === "lan") {
        return "局域网（LAN）";
      }
      if (value === "custom") {
        return "自定义 IP";
      }
      if (value === "tailnet") {
        return "Tailnet（Tailscale IP）";
      }
      return "自动";
    };
    const formatAuth = (value: GatewayAuthChoice) => {
      if (value === "token") {
        return "Token（默认）";
      }
      return "密码";
    };
    const formatTailscale = (value: "off" | "serve" | "funnel") => {
      if (value === "off") {
        return "关闭";
      }
      if (value === "serve") {
        return "Serve";
      }
      return "Funnel";
    };
    const quickstartLines = quickstartGateway.hasExisting
      ? [
          "保留当前网关配置：",
          `网关端口：${quickstartGateway.port}`,
          `网关绑定：${formatBind(quickstartGateway.bind)}`,
          ...(quickstartGateway.bind === "custom" && quickstartGateway.customBindHost
            ? [`自定义 IP：${quickstartGateway.customBindHost}`]
            : []),
          `网关认证：${formatAuth(quickstartGateway.authMode)}`,
          `Tailscale 暴露：${formatTailscale(quickstartGateway.tailscaleMode)}`,
          "直接进入频道配置。",
        ]
      : [
          `网关端口：${quickstartGateway.port}`,
          "网关绑定：本地回环（127.0.0.1）",
          "网关认证：Token（默认）",
          "Tailscale 暴露：关闭",
          "直接进入频道配置。",
        ];
    await prompter.note(quickstartLines.join("\n"), "QuickStart");
  }

  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  let localGatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const resolvedGatewayToken = await resolveSetupSecretInputString({
      config: baseConfig,
      value: baseConfig.gateway?.auth?.token,
      path: "gateway.auth.token",
      env: process.env,
    });
    if (resolvedGatewayToken) {
      localGatewayToken = resolvedGatewayToken;
    }
  } catch (error) {
    await prompter.note(
      [
        "无法解析 gateway.auth.token SecretRef（用于设置探测）。",
        formatErrorMessage(error),
      ].join("\n"),
      "网关认证",
    );
  }
  let localGatewayPassword = process.env.OPENCLAW_GATEWAY_PASSWORD;
  try {
    const resolvedGatewayPassword = await resolveSetupSecretInputString({
      config: baseConfig,
      value: baseConfig.gateway?.auth?.password,
      path: "gateway.auth.password",
      env: process.env,
    });
    if (resolvedGatewayPassword) {
      localGatewayPassword = resolvedGatewayPassword;
    }
  } catch (error) {
    await prompter.note(
      [
        "无法解析 gateway.auth.password SecretRef（用于设置探测）。",
        formatErrorMessage(error),
      ].join("\n"),
      "网关认证",
    );
  }

  const localProbe = await onboardHelpers.probeGatewayReachable({
    url: localUrl,
    token: localGatewayToken,
    password: localGatewayPassword,
  });
  const remoteUrl = baseConfig.gateway?.remote?.url?.trim() ?? "";
  let remoteGatewayToken = normalizeSecretInputString(baseConfig.gateway?.remote?.token);
  try {
    const resolvedRemoteGatewayToken = await resolveSetupSecretInputString({
      config: baseConfig,
      value: baseConfig.gateway?.remote?.token,
      path: "gateway.remote.token",
      env: process.env,
    });
    if (resolvedRemoteGatewayToken) {
      remoteGatewayToken = resolvedRemoteGatewayToken;
    }
  } catch (error) {
    await prompter.note(
      [
        "无法解析 gateway.remote.token SecretRef（用于设置探测）。",
        formatErrorMessage(error),
      ].join("\n"),
      "网关认证",
    );
  }
  const remoteProbe = remoteUrl
    ? await onboardHelpers.probeGatewayReachable({
        url: remoteUrl,
        token: remoteGatewayToken,
      })
    : null;

  const mode =
    opts.mode ??
    (flow === "quickstart"
      ? "local"
      : ((await prompter.select({
          message: "要设置什么？",
          options: [
            {
              value: "local",
              label: "本地网关（此机器）",
              hint: localProbe.ok
                ? `网关可达（${localUrl}）`
                : `未检测到网关（${localUrl}）`,
            },
            {
              value: "remote",
              label: "远程网关（仅信息配置）",
              hint: !remoteUrl
                ? "尚未配置远程 URL"
                : remoteProbe?.ok
                  ? `网关可达（${remoteUrl}）`
                  : `已配置但不可达（${remoteUrl}）`,
            },
          ],
        })) as OnboardMode));

  if (mode === "remote") {
    const { promptRemoteGatewayConfig } = await import("../commands/onboard-remote.js");
    const { logConfigUpdated } = await import("../config/logging.js");
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter, {
      secretInputMode: opts.secretInputMode,
    });
    nextConfig = onboardHelpers.applyWizardMetadata(nextConfig, { command: "onboard", mode });
    if (!(await persistWizardConfig(nextConfig))) {
      return;
    }
    logConfigUpdated(runtime);
    await prompter.outro("远程网关配置完成。");
    return;
  }

  const workspaceInput =
    opts.workspace ??
    (flow === "quickstart"
      ? (baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE)
      : await prompter.text({
          message: "工作区目录",
          initialValue: baseConfig.agents?.defaults?.workspace ?? onboardHelpers.DEFAULT_WORKSPACE,
        }));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || onboardHelpers.DEFAULT_WORKSPACE);

  const { applyLocalSetupWorkspaceConfig } = await import("../commands/onboard-config.js");
  let nextConfig: OpenClawConfig = applyLocalSetupWorkspaceConfig(baseConfig, workspaceDir);

  const authChoiceFromPrompt = opts.authChoice === undefined;
  let authChoice: AuthChoice | undefined = opts.authChoice;
  if (authChoiceFromPrompt) {
    const { ensureAuthProfileStore } = await import("../agents/auth-profiles.runtime.js");
    const { promptAuthChoiceGrouped } = await import("../commands/auth-choice-prompt.js");
    const authStore = ensureAuthProfileStore(undefined, {
      allowKeychainPrompt: false,
    });
    authChoice = await promptAuthChoiceGrouped({
      prompter,
      store: authStore,
      includeSkip: true,
      config: nextConfig,
      workspaceDir,
    });
  }
  if (authChoice === undefined) {
    throw new WizardCancelledError("auth choice is required");
  }

  if (authChoice === "custom-api-key") {
    const { promptCustomApiConfig } = await import("../commands/onboard-custom.js");
    const customResult = await promptCustomApiConfig({
      prompter,
      runtime,
      config: nextConfig,
      secretInputMode: opts.secretInputMode,
    });
    nextConfig = customResult.config;
  } else if (authChoice === "skip") {
    if (authChoiceFromPrompt) {
      const { applyPrimaryModel, promptDefaultModel } = await import("../commands/model-picker.js");
      const modelSelection = await promptDefaultModel({
        config: nextConfig,
        prompter,
        allowKeep: true,
        ignoreAllowlist: true,
        includeProviderPluginSetups: true,
        workspaceDir,
        runtime,
      });
      if (modelSelection.config) {
        nextConfig = modelSelection.config;
      }
      if (modelSelection.model) {
        nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
      }

      const { warnIfModelConfigLooksOff } = await import("../commands/auth-choice.js");
      await warnIfModelConfigLooksOff(nextConfig, prompter);
    }
  } else {
    const { applyAuthChoice, resolvePreferredProviderForAuthChoice, warnIfModelConfigLooksOff } =
      await import("../commands/auth-choice.js");
    const { applyPrimaryModel, promptDefaultModel } = await import("../commands/model-picker.js");
    const authResult = await applyAuthChoice({
      authChoice,
      config: nextConfig,
      prompter,
      runtime,
      setDefaultModel: true,
      opts: {
        tokenProvider: opts.tokenProvider,
        token: opts.authChoice === "apiKey" && opts.token ? opts.token : undefined,
      },
    });
    nextConfig = authResult.config;
    if (authResult.agentModelOverride) {
      nextConfig = applyPrimaryModel(nextConfig, authResult.agentModelOverride);
    }

    const authChoiceModelSelectionPolicy = await resolveAuthChoiceModelSelectionPolicy({
      authChoice,
      config: nextConfig,
      workspaceDir,
      resolvePreferredProviderForAuthChoice,
    });
    const shouldPromptModelSelection =
      authChoiceFromPrompt || authChoiceModelSelectionPolicy?.promptWhenAuthChoiceProvided;
    if (shouldPromptModelSelection) {
      const modelSelection = await promptDefaultModel({
        config: nextConfig,
        prompter,
        allowKeep: authChoiceModelSelectionPolicy?.allowKeepCurrent ?? true,
        ignoreAllowlist: true,
        includeProviderPluginSetups: true,
        preferredProvider: authChoiceModelSelectionPolicy?.preferredProvider,
        workspaceDir,
        runtime,
      });
      if (modelSelection.config) {
        nextConfig = modelSelection.config;
      }
      if (modelSelection.model) {
        nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
      }
    }

    await warnIfModelConfigLooksOff(nextConfig, prompter);
  }

  const { configureGatewayForSetup } = await import("./setup.gateway-config.js");
  const gateway = await configureGatewayForSetup({
    flow,
    baseConfig,
    nextConfig,
    localPort,
    quickstartGateway,
    secretInputMode: opts.secretInputMode,
    prompter,
    runtime,
  });
  nextConfig = gateway.nextConfig;
  const settings = gateway.settings;

  if (opts.skipChannels ?? opts.skipProviders) {
    await prompter.note("跳过频道设置。", "频道");
  } else {
    const { listChannelPlugins } = await import("../channels/plugins/index.js");
    const { setupChannels } = await import("../commands/onboard-channels.js");
    const quickstartAllowFromChannels =
      flow === "quickstart"
        ? listChannelPlugins()
            .filter((plugin) => plugin.meta.quickstartAllowFrom)
            .map((plugin) => plugin.id)
        : [];
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      forceAllowFromChannels: quickstartAllowFromChannels,
      skipDmPolicyPrompt: flow === "quickstart",
      skipConfirm: flow === "quickstart",
      quickstartDefaults: flow === "quickstart",
      secretInputMode: opts.secretInputMode,
    });
  }

  if (!(await persistWizardConfig(nextConfig))) {
    return;
  }
  const { logConfigUpdated } = await import("../config/logging.js");
  logConfigUpdated(runtime);
  await onboardHelpers.ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  if (opts.skipSearch) {
    await prompter.note("跳过搜索设置。", "搜索");
  } else {
    const { setupSearch } = await import("../commands/onboard-search.js");
    nextConfig = await setupSearch(nextConfig, runtime, prompter, {
      quickstartDefaults: flow === "quickstart",
      secretInputMode: opts.secretInputMode,
    });
  }

  if (opts.skipSkills) {
    await prompter.note("跳过技能设置。", "技能");
  } else {
    const { setupSkills } = await import("../commands/onboard-skills.js");
    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  if (flow !== "quickstart") {
    const { setupPluginConfig } = await import("./setup.plugin-config.js");
    nextConfig = await setupPluginConfig({
      config: nextConfig,
      prompter,
      workspaceDir,
    });
  }

  const { setupInternalHooks } = await import("../commands/onboard-hooks.js");
  nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);

  nextConfig = onboardHelpers.applyWizardMetadata(nextConfig, { command: "onboard", mode });
  if (!(await persistWizardConfig(nextConfig))) {
    return;
  }

  const { finalizeSetupWizard } = await import("./setup.finalize.js");
  const { launchedTui } = await finalizeSetupWizard({
    flow,
    opts,
    baseConfig,
    nextConfig,
    workspaceDir,
    settings,
    prompter,
    runtime,
  });
  if (launchedTui) {
    return;
  }
}
