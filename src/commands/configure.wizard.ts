import fsPromises from "node:fs/promises";
import nodePath from "node:path";
import { isDeepStrictEqual } from "node:util";
import { describeCodexNativeWebSearch } from "../agents/codex-native-web-search.shared.js";
import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot, replaceConfigFile, resolveGatewayPort } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { ConfigMutationConflictError } from "../config/mutate.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { note } from "../terminal/note.js";
import { isPlainObject, resolveUserPath } from "../utils.js";
import { PRODUCT_NAME } from "../wizard/assistant-constants.js";
import { createClackPrompter } from "../wizard/clack-prompter.js";
import { WizardCancelledError } from "../wizard/prompts.js";
import { createSnapshot, saveConfigSnapshot } from "../wizard/rollback.js";
import { resolveSetupSecretInputString } from "../wizard/setup.secret-input.js";
import {
  detectConfigConflicts,
  formatValidationResult,
  validateWizardConfig,
  validationResultToWizardIssues,
} from "../wizard/validation.js";
import { removeChannelConfigWizard } from "./configure.channels.js";
import { maybeInstallDaemon } from "./configure.daemon.js";
import { promptAuthConfig } from "./configure.gateway-auth.js";
import { promptGatewayConfig } from "./configure.gateway.js";
import type {
  ChannelsWizardMode,
  ConfigureWizardParams,
  WizardSection,
} from "./configure.shared.js";
import {
  CONFIGURE_SECTION_OPTIONS,
  confirm,
  intro,
  outro,
  select,
  text,
} from "./configure.shared.js";
import { formatHealthCheckFailure } from "./health-format.js";
import { healthCommand } from "./health.js";
import { noteChannelStatus, setupChannels } from "./onboard-channels.js";
import {
  applyWizardMetadata,
  DEFAULT_WORKSPACE,
  ensureWorkspaceAndSessions,
  guardCancel,
  probeGatewayReachable,
  resolveGatewayLinks,
  summarizeExistingConfig,
  waitForGatewayReachable,
} from "./onboard-helpers.js";
import { promptRemoteGatewayConfig } from "./onboard-remote.js";
import { setupSkills } from "./onboard-skills.js";

type ConfigureSectionChoice = WizardSection | "__continue";

function mergeWizardConfigOntoLatest(current: unknown, base: unknown, next: unknown): unknown {
  if (isDeepStrictEqual(next, base)) {
    return current;
  }
  if (isPlainObject(current) && isPlainObject(base) && isPlainObject(next)) {
    const merged: Record<string, unknown> = { ...current };
    const keys = new Set([...Object.keys(current), ...Object.keys(base), ...Object.keys(next)]);
    for (const key of keys) {
      const mergedValue = mergeWizardConfigOntoLatest(current[key], base[key], next[key]);
      if (mergedValue === undefined) {
        delete merged[key];
      } else {
        merged[key] = mergedValue;
      }
    }
    return merged;
  }
  return structuredClone(next);
}

async function resolveGatewaySecretInputForWizard(params: {
  cfg: OpenClawConfig;
  value: unknown;
  path: string;
}): Promise<string | undefined> {
  try {
    return await resolveSetupSecretInputString({
      config: params.cfg,
      value: params.value,
      path: params.path,
      env: process.env,
    });
  } catch {
    return undefined;
  }
}

async function runGatewayHealthCheck(params: {
  cfg: OpenClawConfig;
  runtime: RuntimeEnv;
  port: number;
}): Promise<void> {
  const localLinks = resolveGatewayLinks({
    bind: params.cfg.gateway?.bind ?? "loopback",
    port: params.port,
    customBindHost: params.cfg.gateway?.customBindHost,
  });
  const remoteUrl = params.cfg.gateway?.remote?.url?.trim();
  const wsUrl = params.cfg.gateway?.mode === "remote" && remoteUrl ? remoteUrl : localLinks.wsUrl;
  const configuredToken = await resolveGatewaySecretInputForWizard({
    cfg: params.cfg,
    value: params.cfg.gateway?.auth?.token,
    path: "gateway.auth.token",
  });
  const configuredPassword = await resolveGatewaySecretInputForWizard({
    cfg: params.cfg,
    value: params.cfg.gateway?.auth?.password,
    path: "gateway.auth.password",
  });
  const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? configuredToken;
  const password = process.env.OPENCLAW_GATEWAY_PASSWORD ?? configuredPassword;

  await waitForGatewayReachable({
    url: wsUrl,
    token,
    password,
    deadlineMs: 15_000,
  });

  try {
    await healthCommand({ json: false, timeoutMs: 10_000 }, params.runtime);
  } catch (err) {
    params.runtime.error(formatHealthCheckFailure(err));
    note(
      [
        "文档：",
        "https://docs.openclaw.ai/gateway/health",
        "https://docs.openclaw.ai/gateway/troubleshooting",
      ].join("\n"),
      "健康检查帮助",
    );
  }
}

async function promptConfigureSection(
  runtime: RuntimeEnv,
  hasSelection: boolean,
): Promise<ConfigureSectionChoice> {
  return guardCancel(
    await select<ConfigureSectionChoice>({
      message: "选择要配置的章节",
      options: [
        ...CONFIGURE_SECTION_OPTIONS,
        {
          value: "__continue",
          label: "继续",
          hint: hasSelection ? "完成" : "暂时跳过",
        },
      ],
      initialValue: CONFIGURE_SECTION_OPTIONS[0]?.value,
    }),
    runtime,
  );
}

async function promptChannelMode(runtime: RuntimeEnv): Promise<ChannelsWizardMode> {
  return guardCancel(
    await select({
      message: "频道",
      options: [
        {
          value: "configure",
          label: "配置/关联",
          hint: "添加/更新频道；禁用未选中的账号",
        },
        {
          value: "remove",
          label: "移除频道配置",
          hint: "从配置文件中删除频道 Token/设置",
        },
      ],
      initialValue: "configure",
    }),
    runtime,
  ) as ChannelsWizardMode;
}

async function promptWebToolsConfig(
  nextConfig: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: ReturnType<typeof createClackPrompter>,
): Promise<OpenClawConfig> {
  type WebSearchConfig = NonNullable<NonNullable<OpenClawConfig["tools"]>["web"]>["search"];
  const existingSearch = nextConfig.tools?.web?.search;
  const existingFetch = nextConfig.tools?.web?.fetch;
  const { resolveSearchProviderOptions, setupSearch } = await import("./onboard-search.js");
  const { isCodexNativeWebSearchRelevant } = await import("../agents/codex-native-web-search.js");
  const searchProviderOptions = resolveSearchProviderOptions(nextConfig);

  note(
    [
      "网络搜索让你的助手能通过 web_search 工具在线查询信息。",
      "选择一个托管提供商后，支持 Codex 的模型也可使用 Codex 原生网络搜索。",
      "文档：https://docs.openclaw.ai/tools/web",
    ].join("\n"),
    "网络搜索",
  );

  const enableSearch = guardCancel(
    await confirm({
      message: "启用 web_search？",
      initialValue: existingSearch?.enabled ?? searchProviderOptions.length > 0,
    }),
    runtime,
  );

  let nextSearch: WebSearchConfig = {
    ...existingSearch,
    enabled: enableSearch,
  };
  let workingConfig = nextConfig;

  if (enableSearch) {
    const codexRelevant = isCodexNativeWebSearchRelevant({ config: nextConfig });
    let configureManagedProvider = true;

    if (codexRelevant) {
      note(
        [
          "支持 Codex 的模型可选择使用 Codex 原生网络搜索。",
          "托管 web_search 仍控制非 Codex 模型。",
          "如果未配置托管提供商，非 Codex 模型将依赖提供商自动检测，可能无法使用搜索。",
          ...(describeCodexNativeWebSearch(nextConfig)
            ? [describeCodexNativeWebSearch(nextConfig)!]
            : ["推荐模式：cached（缓存）。"]),
        ].join("\n"),
        "Codex 原生搜索",
      );

      const enableCodexNative = guardCancel(
        await confirm({
          message: "为支持 Codex 的模型启用原生 Codex 网络搜索？",
          initialValue: existingSearch?.openaiCodex?.enabled === true,
        }),
        runtime,
      );

      if (enableCodexNative) {
        const codexMode = guardCancel(
          await select({
            message: "Codex 原生网络搜索模式",
            options: [
              {
                value: "cached",
                label: "cached（推荐）",
                hint: "使用缓存的网页内容",
              },
              {
                value: "live",
                label: "live",
                hint: "允许实时外部网络访问",
              },
            ],
            initialValue: existingSearch?.openaiCodex?.mode ?? "cached",
          }),
          runtime,
        );
        nextSearch = {
          ...nextSearch,
          openaiCodex: {
            ...existingSearch?.openaiCodex,
            enabled: true,
            mode: codexMode,
          },
        };
        configureManagedProvider = guardCancel(
          await confirm({
            message: "现在配置或更换托管网络搜索提供商？",
            initialValue: Boolean(existingSearch?.provider),
          }),
          runtime,
        );
      } else {
        nextSearch = {
          ...nextSearch,
          openaiCodex: {
            ...existingSearch?.openaiCodex,
            enabled: false,
          },
        };
      }
    }

    if (searchProviderOptions.length === 0) {
      if (configureManagedProvider) {
        note(
          [
            "当前插件策略下没有可用的网络搜索提供商。",
            "启用插件或移除拒绝规则后重新运行配置。",
            "文档：https://docs.openclaw.ai/tools/web",
          ].join("\n"),
          "网络搜索",
        );
      }
      if (nextSearch.openaiCodex?.enabled !== true) {
        nextSearch = {
          ...existingSearch,
          enabled: false,
        };
      }
    } else if (configureManagedProvider) {
      workingConfig = await setupSearch(workingConfig, runtime, prompter);
      nextSearch = {
        ...workingConfig.tools?.web?.search,
        enabled: workingConfig.tools?.web?.search?.provider ? true : existingSearch?.enabled,
        openaiCodex: {
          ...existingSearch?.openaiCodex,
          ...(nextSearch.openaiCodex as Record<string, unknown> | undefined),
        },
      };
    }
  }

  const enableFetch = guardCancel(
    await confirm({
      message: "启用 web_fetch（无密钥 HTTP 抓取）？",
      initialValue: existingFetch?.enabled ?? true,
    }),
    runtime,
  );

  const nextFetch = {
    ...existingFetch,
    enabled: enableFetch,
  };

  return {
    ...workingConfig,
    tools: {
      ...workingConfig.tools,
      web: {
        ...workingConfig.tools?.web,
        search: nextSearch,
        fetch: nextFetch,
      },
    },
  };
}

export async function runConfigureWizard(
  opts: ConfigureWizardParams,
  runtime: RuntimeEnv = defaultRuntime,
) {
  try {
    intro(opts.command === "update" ? `${PRODUCT_NAME} 更新向导` : `${PRODUCT_NAME} 配置`);
    const prompter = createClackPrompter();

    const snapshot = await readConfigFileSnapshot();
    let currentBaseHash = snapshot.hash;
    const baseConfig: OpenClawConfig = snapshot.valid
      ? (snapshot.sourceConfig ?? snapshot.config)
      : {};

    if (snapshot.exists) {
      const title = snapshot.valid ? "检测到已有配置" : "配置无效";
      note(summarizeExistingConfig(baseConfig), title);
      if (!snapshot.valid && snapshot.issues.length > 0) {
        note(
          [
            ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
            "",
            "文档：https://docs.openclaw.ai/gateway/configuration",
          ].join("\n"),
          "配置问题",
        );
      }
      if (!snapshot.valid) {
        outro(
          `配置无效。请运行 \`${formatCliCommand("openclaw doctor")}\` 修复后重新配置。`,
        );
        runtime.exit(1);
        return;
      }

      // Strict validation: reject configs with legacy fields before allowing edits.
      const validationResult = validateWizardConfig(baseConfig, {
        legacyIssues: snapshot.legacyIssues,
      });
      if (!validationResult.valid) {
        note(formatValidationResult(validationResult), "配置校验失败");
        outro(
          `检测到不支持的旧版配置字段。请运行 \`${formatCliCommand("openclaw doctor")}\` 迁移后重试。`,
        );
        runtime.exit(1);
        return;
      }

      // Show detected conflicts as a non-blocking advisory note.
      const conflicts = detectConfigConflicts(baseConfig);
      if (conflicts.length > 0) {
        await prompter.showValidationErrors(
          conflicts.map((c) => ({
            path: c.paths.join(", "),
            message: c.message,
            severity: "conflict" as const,
          })),
          "配置冲突检测",
        );
      }
    }

    let rollbackSnapshotPath: string | undefined;
    const ensureRollbackSnapshot = async () => {
      if (rollbackSnapshotPath || !snapshot.exists || !snapshot.valid) {
        return;
      }
      rollbackSnapshotPath = await saveConfigSnapshot(
        createSnapshot(baseConfig, "before-configure-wizard"),
      );
    };

    const localUrl = "ws://127.0.0.1:18789";
    const baseLocalProbeToken = await resolveGatewaySecretInputForWizard({
      cfg: baseConfig,
      value: baseConfig.gateway?.auth?.token,
      path: "gateway.auth.token",
    });
    const baseLocalProbePassword = await resolveGatewaySecretInputForWizard({
      cfg: baseConfig,
      value: baseConfig.gateway?.auth?.password,
      path: "gateway.auth.password",
    });
    const localProbe = await probeGatewayReachable({
      url: localUrl,
      token: process.env.OPENCLAW_GATEWAY_TOKEN ?? baseLocalProbeToken,
      password: process.env.OPENCLAW_GATEWAY_PASSWORD ?? baseLocalProbePassword,
    });
    const remoteUrl = normalizeOptionalString(baseConfig.gateway?.remote?.url) ?? "";
    const baseRemoteProbeToken = await resolveGatewaySecretInputForWizard({
      cfg: baseConfig,
      value: baseConfig.gateway?.remote?.token,
      path: "gateway.remote.token",
    });
    const remoteProbe = remoteUrl
      ? await probeGatewayReachable({
          url: remoteUrl,
          token: baseRemoteProbeToken,
        })
      : null;

    const mode = guardCancel(
      await select({
        message: "网关运行在哪里？",
        options: [
          {
            value: "local",
            label: "本地（此机器）",
            hint: localProbe.ok
              ? `网关可达（${localUrl}）`
              : `未检测到网关（${localUrl}）`,
          },
          {
            value: "remote",
            label: "远程（仅信息配置）",
            hint: !remoteUrl
              ? "尚未配置远程 URL"
              : remoteProbe?.ok
                ? `网关可达（${remoteUrl}）`
                : `已配置但不可达（${remoteUrl}）`,
          },
        ],
      }),
      runtime,
    );

    if (mode === "remote") {
      let remoteConfig = await promptRemoteGatewayConfig(baseConfig, prompter);
      remoteConfig = applyWizardMetadata(remoteConfig, {
        command: opts.command,
        mode,
      });
      const validationResult = validateWizardConfig(remoteConfig);
      if (!validationResult.valid) {
        await prompter.showValidationErrors(
          validationResultToWizardIssues(validationResult),
          "写入前配置校验",
        );
        outro(
          `配置存在不支持的旧字段或冲突。请运行 \`${formatCliCommand("openclaw doctor")}\` 修复后重试。`,
        );
        runtime.exit(1);
        return;
      }
      await ensureRollbackSnapshot();
      await replaceConfigFile({
        nextConfig: remoteConfig,
        ...(currentBaseHash !== undefined ? { baseHash: currentBaseHash } : {}),
      });
      currentBaseHash = undefined;
      logConfigUpdated(runtime);
      outro("远程网关配置完成。");
      return;
    }

    let nextConfig = { ...baseConfig };
    let mergeBaseConfig = structuredClone(baseConfig);
    let didSetGatewayMode = false;
    if (nextConfig.gateway?.mode !== "local") {
      nextConfig = {
        ...nextConfig,
        gateway: {
          ...nextConfig.gateway,
          mode: "local",
        },
      };
      didSetGatewayMode = true;
    }
    let workspaceDir =
      nextConfig.agents?.defaults?.workspace ??
      baseConfig.agents?.defaults?.workspace ??
      DEFAULT_WORKSPACE;
    let gatewayPort = resolveGatewayPort(baseConfig);

    const persistConfig = async (): Promise<boolean> => {
      nextConfig = applyWizardMetadata(nextConfig, {
        command: opts.command,
        mode,
      });

      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const validationResult = validateWizardConfig(nextConfig);
        if (!validationResult.valid) {
          await prompter.showValidationErrors(
            validationResultToWizardIssues(validationResult),
            "写入前配置校验",
          );
          outro(
            `配置存在不支持的旧字段或冲突。请运行 \`${formatCliCommand("openclaw doctor")}\` 修复后重试。`,
          );
          runtime.exit(1);
          return false;
        }

        try {
          await ensureRollbackSnapshot();
          await replaceConfigFile({
            nextConfig,
            ...(currentBaseHash !== undefined ? { baseHash: currentBaseHash } : {}),
          });

          const freshSnapshot = await readConfigFileSnapshot();
          currentBaseHash = freshSnapshot.hash ?? undefined;
          mergeBaseConfig = structuredClone(nextConfig);

          logConfigUpdated(runtime);
          return true;
        } catch (err) {
          if (err instanceof ConfigMutationConflictError && attempt < maxRetries - 1) {
            const freshSnapshot = await readConfigFileSnapshot();
            currentBaseHash = freshSnapshot.hash ?? undefined;
            const diskConfig = freshSnapshot.valid
              ? (freshSnapshot.sourceConfig ?? freshSnapshot.config)
              : {};
            nextConfig = mergeWizardConfigOntoLatest(
              diskConfig,
              mergeBaseConfig,
              nextConfig,
            ) as OpenClawConfig;
            continue;
          }
          throw err;
        }
      }
      return false;
    };

    const configureWorkspace = async () => {
      const workspaceInput = guardCancel(
        await text({
          message: "工作区目录",
          initialValue: workspaceDir,
        }),
        runtime,
      );
      workspaceDir = resolveUserPath(
        normalizeOptionalString(workspaceInput ?? "") || DEFAULT_WORKSPACE,
      );
      if (!snapshot.exists) {
        const indicators = ["MEMORY.md", "memory", ".git"].map((name) =>
          nodePath.join(workspaceDir, name),
        );
        const hasExistingContent = (
          await Promise.all(
            indicators.map(async (candidate) => {
              try {
                await fsPromises.access(candidate);
                return true;
              } catch {
                return false;
              }
            }),
          )
        ).some(Boolean);
        if (hasExistingContent) {
          note(
            [
              `在 ${workspaceDir} 检测到已有工作区`,
              "现有文件将被保留。缺失的模板可能会被创建，但不会被覆盖。",
            ].join("\n"),
            "已有工作区",
          );
        }
      }
      nextConfig = {
        ...nextConfig,
        agents: {
          ...nextConfig.agents,
          defaults: {
            ...nextConfig.agents?.defaults,
            workspace: workspaceDir,
          },
        },
      };
      await ensureWorkspaceAndSessions(workspaceDir, runtime);
    };

    const configureChannelsSection = async () => {
      await noteChannelStatus({ cfg: nextConfig, prompter });
      const channelMode = await promptChannelMode(runtime);
      if (channelMode === "configure") {
        nextConfig = await setupChannels(nextConfig, runtime, prompter, {
          allowDisable: true,
          allowSignalInstall: true,
          skipConfirm: true,
          skipStatusNote: true,
        });
      } else {
        nextConfig = await removeChannelConfigWizard(nextConfig, runtime);
      }
    };

    const promptDaemonPort = async () => {
      const portInput = guardCancel(
        await text({
          message: "服务安装用网关端口",
          initialValue: String(gatewayPort),
          validate: (value) => (Number.isFinite(Number(value)) ? undefined : "无效端口"),
        }),
        runtime,
      );
      gatewayPort = Number.parseInt(portInput, 10);
    };

    if (opts.sections) {
      const selected = opts.sections;
      if (!selected || selected.length === 0) {
        outro("未选择任何变更。");
        return;
      }

      if (selected.includes("workspace")) {
        await configureWorkspace();
      }

      if (selected.includes("model")) {
        nextConfig = await promptAuthConfig(nextConfig, runtime, prompter);
      }

      if (selected.includes("web")) {
        nextConfig = await promptWebToolsConfig(nextConfig, runtime, prompter);
      }

      if (selected.includes("gateway")) {
        const gateway = await promptGatewayConfig(nextConfig, runtime);
        nextConfig = gateway.config;
        gatewayPort = gateway.port;
      }

      if (selected.includes("channels")) {
        await configureChannelsSection();
      }

      if (selected.includes("plugins")) {
        const { configurePluginConfig } = await import("../wizard/setup.plugin-config.js");
        nextConfig = await configurePluginConfig({
          config: nextConfig,
          prompter,
          workspaceDir: resolveUserPath(workspaceDir),
        });
      }

      if (selected.includes("skills")) {
        const wsDir = resolveUserPath(workspaceDir);
        nextConfig = await setupSkills(nextConfig, wsDir, runtime, prompter);
      }

      if (!(await persistConfig())) {
        return;
      }

      if (selected.includes("daemon")) {
        if (!selected.includes("gateway")) {
          await promptDaemonPort();
        }

        await maybeInstallDaemon({ runtime, port: gatewayPort });
      }

      if (selected.includes("health")) {
        await runGatewayHealthCheck({ cfg: nextConfig, runtime, port: gatewayPort });
      }
    } else {
      let ranSection = false;
      let didConfigureGateway = false;

      while (true) {
        const choice = await promptConfigureSection(runtime, ranSection);
        if (choice === "__continue") {
          break;
        }
        ranSection = true;

        if (choice === "workspace") {
          await configureWorkspace();
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "model") {
          nextConfig = await promptAuthConfig(nextConfig, runtime, prompter);
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "web") {
          nextConfig = await promptWebToolsConfig(nextConfig, runtime, prompter);
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "gateway") {
          const gateway = await promptGatewayConfig(nextConfig, runtime);
          nextConfig = gateway.config;
          gatewayPort = gateway.port;
          didConfigureGateway = true;
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "channels") {
          await configureChannelsSection();
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "plugins") {
          const { configurePluginConfig } = await import("../wizard/setup.plugin-config.js");
          nextConfig = await configurePluginConfig({
            config: nextConfig,
            prompter,
            workspaceDir: resolveUserPath(workspaceDir),
          });
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "skills") {
          const wsDir = resolveUserPath(workspaceDir);
          nextConfig = await setupSkills(nextConfig, wsDir, runtime, prompter);
          if (!(await persistConfig())) {
            return;
          }
        }

        if (choice === "daemon") {
          if (!didConfigureGateway) {
            await promptDaemonPort();
          }
          await maybeInstallDaemon({
            runtime,
            port: gatewayPort,
          });
        }

        if (choice === "health") {
          await runGatewayHealthCheck({ cfg: nextConfig, runtime, port: gatewayPort });
        }
      }

      if (!ranSection) {
        if (didSetGatewayMode) {
          if (!(await persistConfig())) {
            return;
          }
          outro("网关模式已设置为本地。");
          return;
        }
        outro("未选择任何变更。");
        return;
      }
    }

    const bind = nextConfig.gateway?.bind ?? "loopback";
    const links = resolveGatewayLinks({
      bind,
      port: gatewayPort,
      customBindHost: nextConfig.gateway?.customBindHost,
    });
    const newPassword =
      process.env.OPENCLAW_GATEWAY_PASSWORD ??
      (await resolveGatewaySecretInputForWizard({
        cfg: nextConfig,
        value: nextConfig.gateway?.auth?.password,
        path: "gateway.auth.password",
      }));
    const oldPassword =
      process.env.OPENCLAW_GATEWAY_PASSWORD ??
      (await resolveGatewaySecretInputForWizard({
        cfg: baseConfig,
        value: baseConfig.gateway?.auth?.password,
        path: "gateway.auth.password",
      }));
    const token =
      process.env.OPENCLAW_GATEWAY_TOKEN ??
      (await resolveGatewaySecretInputForWizard({
        cfg: nextConfig,
        value: nextConfig.gateway?.auth?.token,
        path: "gateway.auth.token",
      }));

    let gatewayProbe = await probeGatewayReachable({
      url: links.wsUrl,
      token,
      password: newPassword,
    });
    if (!gatewayProbe.ok && newPassword !== oldPassword && oldPassword) {
      gatewayProbe = await probeGatewayReachable({
        url: links.wsUrl,
        token,
        password: oldPassword,
      });
    }
    const gatewayStatusLine = gatewayProbe.ok
      ? "网关：可达"
      : `网关：未检测到${gatewayProbe.detail ? `（${gatewayProbe.detail}）` : ""}`;

    note(
      [
        `终端界面：${formatCliCommand("openclaw tui")}`,
        `网关 WS：${links.wsUrl}`,
        gatewayStatusLine,
        "文档：https://docs.openclaw.ai/gateway",
      ].join("\n"),
      "终端",
    );

    outro("配置完成。");
  } catch (err) {
    if (err instanceof WizardCancelledError) {
      runtime.exit(1);
      return;
    }
    throw err;
  }
}
