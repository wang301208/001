import fs from "node:fs/promises";
import path from "node:path";
import { describeCodexNativeWebSearch } from "../agents/codex-native-web-search.shared.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "../commands/daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
} from "../commands/daemon-runtime.js";
import { resolveGatewayInstallToken } from "../commands/gateway-install-token.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { healthCommand } from "../commands/health.js";
import {
  probeGatewayReachable,
  waitForGatewayReachable,
  resolveGatewayLinks,
} from "../commands/onboard-helpers.js";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { describeGatewayServiceRestart, resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { formatErrorMessage } from "../infra/errors.js";
import type { RuntimeEnv } from "../runtime.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { runTui } from "../tui/tui.js";
import { resolveUserPath } from "../utils.js";
import { listConfiguredWebSearchProviders } from "../web-search/runtime.js";
import { PRODUCT_NAME } from "./assistant-constants.js";
import type { WizardPrompter } from "./prompts.js";
import { setupWizardShellCompletion } from "./setup.completion.js";
import { resolveSetupSecretInputString } from "./setup.secret-input.js";
import type { GatewayWizardSettings, WizardFlow } from "./setup.types.js";

type FinalizeOnboardingOptions = {
  flow: WizardFlow;
  opts: OnboardOptions;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  workspaceDir: string;
  settings: GatewayWizardSettings;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

export async function finalizeSetupWizard(
  options: FinalizeOnboardingOptions,
): Promise<{ launchedTui: boolean }> {
  const { flow, opts, nextConfig, settings, prompter, runtime } = options;
  let gatewayProbe: { ok: boolean; detail?: string } = { ok: true };

  const withWizardProgress = async <T>(
    label: string,
    options: { doneMessage?: string | (() => string | undefined) },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(
        typeof options.doneMessage === "function" ? options.doneMessage() : options.doneMessage,
      );
    }
  };

  const systemdAvailable =
    process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === "linux" && !systemdAvailable) {
    await prompter.note(
      "Systemd 用户服务不可用，跳过 linger 检查和服务安装。",
      "Systemd",
    );
  }

  if (process.platform === "linux" && systemdAvailable) {
    const { ensureSystemdUserLingerInteractive } = await import("../commands/systemd-linger.js");
    await ensureSystemdUserLingerInteractive({
      runtime,
      prompter: {
        confirm: prompter.confirm,
        note: prompter.note,
      },
      reason:
        "Linux 安装默认使用 systemd 用户服务。未启用 linger 时，systemd 会在用户登出/空闲后关闭用户会话并终止网关进程。",
      requireConfirm: false,
    });
  }

  const explicitInstallDaemon =
    typeof opts.installDaemon === "boolean" ? opts.installDaemon : undefined;
  let installDaemon: boolean;
  if (explicitInstallDaemon !== undefined) {
    installDaemon = explicitInstallDaemon;
  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;
  } else if (flow === "quickstart") {
    installDaemon = true;
  } else {
    installDaemon = await prompter.confirm({
      message: "安装网关服务（推荐）",
      initialValue: true,
    });
  }

  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
    await prompter.note(
      "Systemd 用户服务不可用；跳过服务安装。请使用容器监控程序或 `docker compose up -d`。",
      "网关服务",
    );
    installDaemon = false;
  }

  if (installDaemon) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "网关服务运行时",
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });
    if (flow === "quickstart") {
      await prompter.note(
        "QuickStart 使用 Node 作为网关服务运行时（稳定且受支持）。",
        "网关服务运行时",
      );
    }
    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });
    let restartWasScheduled = false;
    if (loaded) {
      const action = await prompter.select({
        message: "网关服务已安装",
        options: [
          { value: "restart", label: "重启" },
          { value: "reinstall", label: "重新安装" },
          { value: "skip", label: "跳过" },
        ],
      });
      if (action === "restart") {
        let restartDoneMessage = "网关服务已重启。";
        await withWizardProgress(
          "网关服务",
          { doneMessage: () => restartDoneMessage },
          async (progress) => {
            progress.update("正在重启网关服务…");
            const restartResult = await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
            const restartStatus = describeGatewayServiceRestart("Gateway", restartResult);
            restartDoneMessage = restartStatus.progressMessage;
            restartWasScheduled = restartStatus.scheduled;
          },
        );
      } else if (action === "reinstall") {
        await withWizardProgress(
          "网关服务",
          { doneMessage: "网关服务已卸载。" },
          async (progress) => {
            progress.update("正在卸载网关服务…");
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (
      !loaded ||
      (!restartWasScheduled && loaded && !(await service.isLoaded({ env: process.env })))
    ) {
      const progress = prompter.progress("网关服务");
      let installError: string | null = null;
      try {
        progress.update("正在准备网关服务…");
        const tokenResolution = await resolveGatewayInstallToken({
          config: nextConfig,
          env: process.env,
        });
        for (const warning of tokenResolution.warnings) {
          await prompter.note(warning, "网关服务");
        }
        if (tokenResolution.unavailableReason) {
          installError = [
            "网关安装被阻止：",
            tokenResolution.unavailableReason,
            "请修复网关认证配置/Token 输入后重新运行设置。",
          ].join(" ");
        } else {
          const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan(
            {
              env: process.env,
              port: settings.port,
              runtime: daemonRuntime,
              warn: (message, title) => prompter.note(message, title),
              config: nextConfig,
            },
          );

          progress.update("正在安装网关服务…");
          await service.install({
            env: process.env,
            stdout: process.stdout,
            programArguments,
            workingDirectory,
            environment,
          });
        }
      } catch (err) {
        installError = formatErrorMessage(err);
      } finally {
        progress.stop(
          installError ? "网关服务安装失败。" : "网关服务安装完成。",
        );
      }
      if (installError) {
        await prompter.note(`网关服务安装失败：${installError}`, "网关");
        await prompter.note(gatewayInstallErrorHint(), "网关");
      }
    }
  }

  if (!opts.skipHealth) {
    const probeLinks = resolveGatewayLinks({
      bind: nextConfig.gateway?.bind ?? "loopback",
      port: settings.port,
      customBindHost: nextConfig.gateway?.customBindHost,
    });
    gatewayProbe = await waitForGatewayReachable({
      url: probeLinks.wsUrl,
      token: settings.gatewayToken,
      deadlineMs: 15_000,
    });
    if (gatewayProbe.ok) {
      try {
        await healthCommand({ json: false, timeoutMs: 10_000 }, runtime);
      } catch (err) {
        runtime.error(formatHealthCheckFailure(err));
        await prompter.note(
          [
            "文档：",
            "https://docs.openclaw.ai/gateway/health",
            "https://docs.openclaw.ai/gateway/troubleshooting",
          ].join("\n"),
          "健康检查帮助",
        );
      }
    } else if (installDaemon) {
      runtime.error(
        formatHealthCheckFailure(
          new Error(
            gatewayProbe.detail ?? `网关在 ${probeLinks.wsUrl} 未变为可达状态`,
          ),
        ),
      );
      await prompter.note(
        [
          "文档：",
          "https://docs.openclaw.ai/gateway/health",
          "https://docs.openclaw.ai/gateway/troubleshooting",
        ].join("\n"),
        "健康检查帮助",
      );
    } else {
      await prompter.note(
        [
          "尚未检测到网关。",
          "本次设置未安装网关服务，因此不期望后台网关已运行。",
          `立即启动：${formatCliCommand("openclaw gateway run")}`,
          `或重新运行：${formatCliCommand("openclaw onboard --install-daemon")}`,
          `下次跳过探测：${formatCliCommand("openclaw onboard --skip-health")}`,
        ].join("\n"),
        "网关",
      );
    }
  }

  await prompter.note(
    [
      "添加节点以获取更多功能：",
      "- macOS 应用（系统通知）",
      "- iOS 应用（相机/画布）",
      "- Android 应用（相机/画布）",
    ].join("\n"),
    "可选应用",
  );

  const links = resolveGatewayLinks({
    bind: settings.bind,
    port: settings.port,
    customBindHost: settings.customBindHost,
  });
  let resolvedGatewayPassword = "";
  if (settings.authMode === "password") {
    try {
      resolvedGatewayPassword =
        (await resolveSetupSecretInputString({
          config: nextConfig,
          value: nextConfig.gateway?.auth?.password,
          path: "gateway.auth.password",
          env: process.env,
        })) ?? "";
    } catch (error) {
      await prompter.note(
        [
          "无法解析 gateway.auth.password SecretRef 以获取设置认证信息。",
          formatErrorMessage(error),
        ].join("\n"),
        "网关认证",
      );
    }
  }

  if (opts.skipHealth || !gatewayProbe.ok) {
    gatewayProbe = await probeGatewayReachable({
      url: links.wsUrl,
      token: settings.authMode === "token" ? settings.gatewayToken : undefined,
      password: settings.authMode === "password" ? resolvedGatewayPassword : "",
    });
  }
  const gatewayStatusLine = gatewayProbe.ok
    ? "网关：可达"
    : `网关：未检测到${gatewayProbe.detail ? `（${gatewayProbe.detail}）` : ""}`;
  const bootstrapPath = path.join(
    resolveUserPath(options.workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  await prompter.note(
    [
      `终端界面：${formatCliCommand("openclaw tui")}`,
      `网关 WS：${links.wsUrl}`,
      gatewayStatusLine,
      "文档：https://docs.openclaw.ai/gateway",
    ]
      .filter(Boolean)
      .join("\n"),
    "终端",
  );

  let hatchChoice: "tui" | "later" | null = null;
  let launchedTui = false;

  if (!opts.skipUi && gatewayProbe.ok) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "这是定义你的助手个性的关键步骤。",
          "请花些时间认真填写。",
          "告诉它的越多，体验越好。",
          '我们将发送："Wake up, my friend!"',
        ].join("\n"),
        "启动终端界面（最佳选项！）",
      );
    }

    await prompter.note(
      [
        "网关 Token：网关和终端客户端的共享认证凭据。",
        "存储位置：$OPENCLAW_CONFIG_PATH（默认：~/.openclaw/openclaw.json）中的 gateway.auth.token，或 OPENCLAW_GATEWAY_TOKEN 环境变量。",
        `查看 Token：${formatCliCommand("openclaw config get gateway.auth.token")}`,
        `生成 Token：${formatCliCommand("openclaw doctor --generate-gateway-token")}`,
        `随时打开终端界面：${formatCliCommand("openclaw tui")}`,
      ].join("\n"),
      "Token",
    );

    hatchChoice = await prompter.select({
      message: "如何启动你的助手？",
      options: [
        { value: "tui", label: "在终端界面中启动（推荐）" },
        { value: "later", label: "稍后再说" },
      ],
      initialValue: "tui",
    });

    if (hatchChoice === "tui") {
      restoreTerminalState("pre-setup tui", { resumeStdinIfPaused: true });
      await runTui({
        url: links.wsUrl,
        token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        password: settings.authMode === "password" ? resolvedGatewayPassword : "",
        deliver: false,
        message: hasBootstrap ? "Wake up, my friend!" : undefined,
      });
      launchedTui = true;
    } else {
      await prompter.note(
        `准备好后运行：${formatCliCommand("openclaw tui")}`,
        "稍后",
      );
    }
  } else if (opts.skipUi) {
    await prompter.note("跳过终端界面提示。", "终端");
  }

  await prompter.note(
    [
      "请备份你的助手工作区。",
      "文档：https://docs.openclaw.ai/concepts/agent-workspace",
    ].join("\n"),
    "工作区备份",
  );

  await prompter.note(
    `在计算机上运行 AI 代理存在风险 — 请加固你的配置：https://docs.openclaw.ai/security`,
    "安全",
  );

  await setupWizardShellCompletion({ flow, prompter });

  const codexNativeSummary = describeCodexNativeWebSearch(nextConfig);
  const webSearchProvider = nextConfig.tools?.web?.search?.provider;
  const webSearchEnabled = nextConfig.tools?.web?.search?.enabled;
  const configuredSearchProviders = listConfiguredWebSearchProviders({ config: nextConfig });
  if (webSearchProvider) {
    const { resolveExistingKey, hasExistingKey, hasKeyInEnv } =
      await import("../commands/onboard-search.js");
    const entry = configuredSearchProviders.find((e) => e.id === webSearchProvider);
    const label = entry?.label ?? webSearchProvider;
    const storedKey = entry ? resolveExistingKey(nextConfig, webSearchProvider) : undefined;
    const keyConfigured = entry ? hasExistingKey(nextConfig, webSearchProvider) : false;
    const envAvailable = entry ? hasKeyInEnv(entry) : false;
    const hasKey = keyConfigured || envAvailable;
    const keySource = storedKey
      ? "API Key：已存储在配置中。"
      : keyConfigured
        ? "API Key：通过 SecretRef 配置。"
        : envAvailable
          ? `API Key：通过 ${entry?.envVars.join(" / ")} 环境变量提供。`
          : undefined;
    if (!entry) {
      await prompter.note(
        [
          `已选择网络搜索提供商 ${label}，但在当前插件策略下不可用。`,
          "web_search 将无法使用，直到该提供商被重新启用或选择其他提供商。",
          `  ${formatCliCommand("openclaw configure --section web")}`,
          "",
          "文档：https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else if (webSearchEnabled !== false && hasKey) {
      await prompter.note(
        [
          "网络搜索已启用，你的助手可在需要时在线查找信息。",
          "",
          `提供商：${label}`,
          ...(keySource ? [keySource] : []),
          "文档：https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else if (!hasKey) {
      await prompter.note(
        [
          `已选择提供商 ${label}，但未找到 API Key。`,
          "web_search 将无法使用，直到添加 API Key。",
          `  ${formatCliCommand("openclaw configure --section web")}`,
          "",
          `获取 API Key：${entry?.signupUrl ?? "https://docs.openclaw.ai/tools/web"}`,
          "文档：https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    } else {
      await prompter.note(
        [
          `网络搜索（${label}）已配置但被禁用。`,
          `重新启用：${formatCliCommand("openclaw configure --section web")}`,
          "",
          "文档：https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "网络搜索",
      );
    }
  } else {
    await prompter.note(
      [
        "已跳过网络搜索。可稍后启用：",
        `  ${formatCliCommand("openclaw configure --section web")}`,
        "",
        "文档：https://docs.openclaw.ai/tools/web",
      ].join("\n"),
      "网络搜索",
    );
  }

  if (codexNativeSummary) {
    await prompter.note(
      [
        codexNativeSummary,
        "仅用于支持 Codex 的模型。",
        "文档：https://docs.openclaw.ai/tools/web",
      ].join("\n"),
      "Codex 原生搜索",
    );
  }

  await prompter.note(
    `接下来做什么：https://openclaw.ai/showcase（"用户正在构建什么"）。`,
    "接下来",
  );

  await prompter.outro(
    `初始化完成。运行 ${formatCliCommand("openclaw tui")} 启动${PRODUCT_NAME}。`,
  );

  return { launchedTui };
}
