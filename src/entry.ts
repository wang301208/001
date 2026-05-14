#!/usr/bin/env node
import { spawn } from "node:child_process";
import { enableCompileCache } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isRootHelpInvocation, isRootVersionInvocation } from "./cli/argv.js";
import { parseCliContainerArgs, resolveCliContainerTarget } from "./cli/container-target.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";
import { resolveExplicitTuiFastPathOptions } from "./cli/tui-fast-path.js";
import { normalizeWindowsArgv } from "./cli/windows-argv.js";
import { buildCliRespawnPlan } from "./entry.respawn.js";
import { isTruthyEnvValue, normalizeEnv } from "./infra/env.js";
import { isMainModule } from "./infra/is-main.js";
import { ensureZhushouExecMarkerOnProcess } from "./infra/zhushou-exec-env.js";
import { installProcessWarningFilter } from "./infra/warning-filter.js";
import { attachChildProcessBridge } from "./process/child-process-bridge.js";

const ENTRY_WRAPPER_PAIRS = [
  { wrapperBasename: "zhushou.mjs", entryBasename: "entry.js" },
  { wrapperBasename: "zhushou.js", entryBasename: "entry.js" },
] as const;

function shouldForceReadOnlyAuthStore(argv: string[]): boolean {
  const tokens = argv.slice(2).filter((token) => token.length > 0 && !token.startsWith("-"));
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === "secrets" && tokens[index + 1] === "audit") {
      return true;
    }
  }
  return false;
}

// 守卫：仅当此文件为主模块时运行入口点逻辑。
// 打包器可能在 dist/index.js 为实际入口点时将 entry.js 作为共享依赖导入；
// 没有此守卫，下方的顶级代码
// 会再次调用 runCli，启动重复的网关，导致端口锁定失败
// 并崩溃进程。
if (
  !isMainModule({
    currentFile: fileURLToPath(import.meta.url),
    wrapperEntryPairs: [...ENTRY_WRAPPER_PAIRS],
  })
) {
  // 作为依赖导入 — 跳过所有入口点副作用。
} else {
  const { installGaxiosFetchCompat } = await import("./infra/gaxios-fetch-compat.js");

  await installGaxiosFetchCompat();
  process.title = "zhushou";
  ensureZhushouExecMarkerOnProcess();
  installProcessWarningFilter();
  normalizeEnv();
  if (!isTruthyEnvValue(process.env.NODE_DISABLE_COMPILE_CACHE)) {
    try {
      enableCompileCache();
    } catch {
      // 尽力而为；绝不阻塞启动。
    }
  }

  if (shouldForceReadOnlyAuthStore(process.argv)) {
    process.env.ZHUSHOU_AUTH_STORE_READONLY = "1";
  }

  if (process.argv.includes("--no-color")) {
    process.env.NO_COLOR = "1";
    process.env.FORCE_COLOR = "0";
  }

  function ensureCliRespawnReady(): boolean {
    const plan = buildCliRespawnPlan();
    if (!plan) {
      return false;
    }

    const child = spawn(process.execPath, plan.argv, {
      stdio: "inherit",
      env: plan.env,
    });

    attachChildProcessBridge(child);

    child.once("exit", (code, signal) => {
      if (signal) {
        process.exitCode = 1;
        return;
      }
      process.exit(code ?? 1);
    });

    child.once("error", (error) => {
      console.error(
        "[zhushou] 重新启动 CLI 失败：",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exit(1);
    });

    // 父进程不得继续运行 CLI。
    return true;
  }

  function tryHandleRootVersionFastPath(argv: string[]): boolean {
    if (resolveCliContainerTarget(argv)) {
      return false;
    }
    if (!isRootVersionInvocation(argv)) {
      return false;
    }
    Promise.all([
      import("./version.js"),
      import("./infra/git-commit.js"),
      import("./wizard/zhushou-constants.js"),
    ])
      .then(([{ VERSION }, { resolveCommitHash }, { PRODUCT_NAME }]) => {
        const commit = resolveCommitHash({ moduleUrl: import.meta.url });
        console.log(
          commit ? `${PRODUCT_NAME} ${VERSION} (${commit})` : `${PRODUCT_NAME} ${VERSION}`,
        );
        process.exit(0);
      })
      .catch((error) => {
        console.error(
          "[zhushou] 解析版本失败：",
          error instanceof Error ? (error.stack ?? error.message) : error,
        );
        process.exitCode = 1;
      });
    return true;
  }

  process.argv = normalizeWindowsArgv(process.argv);

  if (!ensureCliRespawnReady()) {
    const parsedContainer = parseCliContainerArgs(process.argv);
    if (!parsedContainer.ok) {
      console.error(`[zhushou] ${parsedContainer.error}`);
      process.exit(2);
    }

    const parsed = parseCliProfileArgs(parsedContainer.argv);
    if (!parsed.ok) {
      // 保持简单；Commander 在我们剥离标志后会处理丰富的帮助/错误。
      console.error(`[zhushou] ${parsed.error}`);
      process.exit(2);
    }

    const containerTargetName = resolveCliContainerTarget(process.argv);
    if (containerTargetName && parsed.profile) {
      console.error("[zhushou] --container 不能与 --profile/--dev 同时使用");
      process.exit(2);
    }

    if (parsed.profile) {
      applyCliProfileEnv({ profile: parsed.profile });
      // 保持 Commander 和临时 argv 检查一致。
      process.argv = parsed.argv;
    }

    const explicitTuiOptions = resolveExplicitTuiFastPathOptions(process.argv);
    if (explicitTuiOptions) {
      const { assertSupportedRuntime } = await import("./infra/runtime-guard.js");
      assertSupportedRuntime();
      const { runTui } = await import("./tui/tui.js");
      await runTui(explicitTuiOptions);
    } else if (!tryHandleRootVersionFastPath(process.argv)) {
      runMainOrRootHelp(process.argv);
    }
  }
}

export function tryHandleRootHelpFastPath(
  argv: string[],
  deps: {
    outputRootHelp?: () => void | Promise<void>;
    onError?: (error: unknown) => void;
    env?: NodeJS.ProcessEnv;
  } = {},
): boolean {
  if (resolveCliContainerTarget(argv, deps.env)) {
    return false;
  }
  if (!isRootHelpInvocation(argv)) {
    return false;
  }
  const handleError =
    deps.onError ??
    ((error: unknown) => {
      console.error(
        "[zhushou] 显示帮助失败：",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
  if (deps.outputRootHelp) {
    Promise.resolve()
      .then(() => deps.outputRootHelp?.())
      .catch(handleError);
    return true;
  }
  import("./cli/root-help-metadata.js")
    .then(async ({ outputPrecomputedRootHelpText }) => {
      if (outputPrecomputedRootHelpText()) {
        return;
      }
      const { outputRootHelp } = await import("./cli/program/root-help.js");
      await outputRootHelp();
    })
    .catch(handleError);
  return true;
}

function runMainOrRootHelp(argv: string[]): void {
  if (tryHandleRootHelpFastPath(argv)) {
    return;
  }
  import("./cli/run-main.js")
    .then(({ runCli }) => runCli(argv))
    .catch((error) => {
      console.error(
        "[zhushou] 启动 CLI 失败：",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
}
