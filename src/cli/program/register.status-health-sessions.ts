import type { Command } from "commander";
import {
  autonomyActivateCommand,
  autonomyArchitectureReadinessCommand,
  autonomyBootstrapCommand,
  autonomyCapabilityInventoryCommand,
  autonomyCancelCommand,
  autonomyGovernanceReconcileCommand,
  autonomyGenesisPlanCommand,
  autonomyGovernanceCommand,
  autonomyHealCommand,
  autonomyHistoryCommand,
  autonomyListCommand,
  autonomyOverviewCommand,
  autonomyReplaySubmitCommand,
  autonomyLoopDisableCommand,
  autonomyLoopEnableCommand,
  autonomyLoopReconcileCommand,
  autonomyLoopShowCommand,
  autonomyShowCommand,
  autonomyStartCommand,
  autonomySuperviseCommand,
} from "../../commands/autonomy.js";
import { flowsCancelCommand, flowsListCommand, flowsShowCommand } from "../../commands/flows.js";
import {
  governanceAgentCommand,
  governanceCapabilityAssetRegistryCommand,
  governanceCapabilityInventoryCommand,
  governanceGenesisPlanCommand,
  governanceOverviewCommand,
  governanceTeamCommand,
  governanceProposalsApplyCommand,
  governanceProposalsApplyManyCommand,
  governanceProposalsCreateCommand,
  governanceProposalsListCommand,
  governanceProposalsReconcileCommand,
  governanceProposalsRevertCommand,
  governanceProposalsRevertManyCommand,
  governanceProposalsReviewCommand,
  governanceProposalsReviewManyCommand,
  governanceProposalsSynthesizeCommand,
} from "../../commands/governance.js";
import { healthCommand } from "../../commands/health.js";
import { sessionsCleanupCommand } from "../../commands/sessions-cleanup.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import {
  tasksAuditCommand,
  tasksCancelCommand,
  tasksListCommand,
  tasksMaintenanceCommand,
  tasksNotifyCommand,
  tasksShowCommand,
} from "../../commands/tasks.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { collectOption, parsePositiveIntOrUndefined } from "./helpers.js";

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error("--timeout 必须为正整数（毫秒）");
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

async function runWithVerboseAndTimeout(
  opts: { verbose?: boolean; debug?: boolean; timeout?: unknown },
  action: (params: { verbose: boolean; timeoutMs: number | undefined }) => Promise<void>,
): Promise<void> {
  const verbose = resolveVerbose(opts);
  setVerbose(verbose);
  const timeoutMs = parseTimeoutMs(opts.timeout);
  if (timeoutMs === null) {
    return;
  }
  await runCommandWithRuntime(defaultRuntime, async () => {
    await action({ verbose, timeoutMs });
  });
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description("显示频道健康状态和最近的会话接收者")
    .option("--json", "输出 JSON 而非文本", false)
    .option("--all", "完整诊断（只读，可粘贴）", false)
    .option("--usage", "显示模型提供商用量/配额快照", false)
    .option("--deep", "探测频道（WhatsApp Web + Telegram + Discord + Slack + Signal）", false)
    .option("--timeout <ms>", "探测超时（毫秒）", "10000")
    .option("--verbose", "详细日志", false)
    .option("--debug", "--verbose 的别名", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          ["zhushou status", "显示频道健康 + 会话摘要。"],
          ["zhushou status --all", "完整诊断（只读）。"],
          ["zhushou status --json", "机器可读输出。"],
          ["zhushou status --usage", "显示模型提供商用量/配额快照。"],
          [
            "zhushou status --deep",
            "运行频道探测（WA + Telegram + Discord + Slack + Signal）。",
          ],
          ["zhushou status --deep --timeout 5000", "缩短探测超时。"],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/status", "docs.zhushou.ai/cli/status")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description("从运行中的网关获取健康状态")
    .option("--json", "输出 JSON 而非文本", false)
    .option("--timeout <ms>", "连接超时（毫秒）", "10000")
    .option("--verbose", "详细日志", false)
    .option("--debug", "--verbose 的别名", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/health", "docs.zhushou.ai/cli/health")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  const sessionsCmd = program
    .command("sessions")
    .description("列出已存储的对话会话")
    .option("--json", "输出 JSON", false)
    .option("--verbose", "详细日志", false)
    .option("--store <path>", "会话存储路径（默认：从配置解析）")
    .option("--agent <id>", "要检查的代理 ID（默认：配置的默认代理）")
    .option("--all-agents", "聚合所有已配置代理的会话", false)
    .option("--active <minutes>", "仅显示在过去 N 分钟内更新的会话")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          ["zhushou sessions", "列出所有会话。"],
          ["zhushou sessions --agent work", "列出一个代理的会话。"],
          ["zhushou sessions --all-agents", "聚合所有代理的会话。"],
          ["zhushou sessions --active 120", "仅显示最近 2 小时。"],
          ["zhushou sessions --json", "机器可读输出。"],
          ["zhushou sessions --store ./tmp/sessions.json", "使用指定的会话存储。"],
        ])}\n\n${theme.muted(
          "当代理报告时会显示每个会话的令牌用量；设置 agents.defaults.contextTokens 以限制窗口并显示百分比。",
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/sessions", "docs.zhushou.ai/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          agent: opts.agent as string | undefined,
          allAgents: Boolean(opts.allAgents),
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
  sessionsCmd.enablePositionalOptions();

  sessionsCmd
    .command("cleanup")
    .description("立即运行会话存储维护")
    .option("--store <path>", "会话存储路径（默认：从配置解析）")
    .option("--agent <id>", "要维护的代理 ID（默认：配置的默认代理）")
    .option("--all-agents", "对所有已配置代理运行维护", false)
    .option("--dry-run", "预览维护操作但不写入", false)
    .option("--enforce", "即使配置模式为 warn 也应用维护", false)
    .option(
      "--fix-missing",
      "移除转录文件缺失的存储条目（绕过年龄/计数保留）",
      false,
    )
    .option("--active-key <key>", "保护此会话密钥不被预算驱逐")
    .option("--json", "输出 JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          ["zhushou sessions cleanup --dry-run", "预览过期/超限清理。"],
          [
            "zhushou sessions cleanup --dry-run --fix-missing",
            "同时预览修剪缺失转录文件的条目。",
          ],
          ["zhushou sessions cleanup --enforce", "立即应用维护。"],
          ["zhushou sessions cleanup --agent work --dry-run", "预览一个代理存储。"],
          ["zhushou sessions cleanup --all-agents --dry-run", "预览所有代理存储。"],
          [
            "zhushou sessions cleanup --enforce --store ./tmp/sessions.json",
            "使用指定的存储。",
          ],
        ])}`,
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            store?: string;
            agent?: string;
            allAgents?: boolean;
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sessionsCleanupCommand(
          {
            store: (opts.store as string | undefined) ?? parentOpts?.store,
            agent: (opts.agent as string | undefined) ?? parentOpts?.agent,
            allAgents: Boolean(opts.allAgents || parentOpts?.allAgents),
            dryRun: Boolean(opts.dryRun),
            enforce: Boolean(opts.enforce),
            fixMissing: Boolean(opts.fixMissing),
            activeKey: opts.activeKey as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  const tasksCmd = program
    .command("tasks")
    .description("检查持久化后台任务和 TaskFlow 状态")
    .option("--json", "输出 JSON", false)
    .option("--runtime <name>", "按类型筛选（subagent、acp、cron、cli）")
    .option(
      "--status <name>",
      "按状态筛选（queued、running、succeeded、failed、timed_out、cancelled、lost）",
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksListCommand(
          {
            json: Boolean(opts.json),
            runtime: opts.runtime as string | undefined,
            status: opts.status as string | undefined,
          },
          defaultRuntime,
        );
      });
    });
  tasksCmd.enablePositionalOptions();

  tasksCmd
    .command("list")
    .description("列出已追踪的后台任务")
    .option("--json", "输出 JSON", false)
    .option("--runtime <name>", "Filter by kind (subagent, acp, cron, cli)")
    .option(
      "--status <name>",
      "Filter by status (queued, running, succeeded, failed, timed_out, cancelled, lost)",
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            runtime?: string;
            status?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksListCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            runtime: (opts.runtime as string | undefined) ?? parentOpts?.runtime,
            status: (opts.status as string | undefined) ?? parentOpts?.status,
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("audit")
    .description("显示过期或异常的后台任务和 TaskFlow")
    .option("--json", "输出 JSON", false)
    .option("--severity <level>", "按严重程度筛选（warn、error）")
    .option(
      "--code <name>",
      "Filter by finding code (stale_queued, stale_running, lost, delivery_failed, missing_cleanup, inconsistent_timestamps, restore_failed, stale_waiting, stale_blocked, cancel_stuck, missing_linked_tasks, blocked_task_missing)",
    )
    .option("--limit <n>", "Limit displayed findings")
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksAuditCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            severity: opts.severity as "warn" | "error" | undefined,
            code: opts.code as
              | "stale_queued"
              | "stale_running"
              | "lost"
              | "delivery_failed"
              | "missing_cleanup"
              | "inconsistent_timestamps"
              | "restore_failed"
              | "stale_waiting"
              | "stale_blocked"
              | "cancel_stuck"
              | "missing_linked_tasks"
              | "blocked_task_missing"
              | undefined,
            limit: parsePositiveIntOrUndefined(opts.limit),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("maintenance")
    .description("预览或应用任务和 TaskFlow 维护")
    .option("--json", "输出 JSON", false)
    .option("--apply", "应用对账、清理标记和修剪", false)
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksMaintenanceCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            apply: Boolean(opts.apply),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("show")
    .description("按任务 ID、运行 ID 或会话密钥显示一个后台任务")
    .argument("<lookup>", "任务 ID、运行 ID 或会话密钥")
    .option("--json", "输出 JSON", false)
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksShowCommand(
          {
            lookup,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("notify")
    .description("设置任务通知策略")
    .argument("<lookup>", "Task id, run id, or session key")
    .argument("<notify>", "通知策略（done_only、state_changes、silent）")
    .action(async (lookup, notify) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksNotifyCommand(
          {
            lookup,
            notify: notify as "done_only" | "state_changes" | "silent",
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("cancel")
    .description("取消运行中的后台任务")
    .argument("<lookup>", "Task id, run id, or session key")
    .action(async (lookup) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksCancelCommand(
          {
            lookup,
          },
          defaultRuntime,
        );
      });
    });

  const tasksFlowCmd = tasksCmd
    .command("flow")
    .description("检查任务下的持久化 TaskFlow 状态");

  tasksFlowCmd
    .command("list")
    .description("列出已追踪的 TaskFlow")
    .option("--json", "输出 JSON", false)
    .option(
      "--status <name>",
      "按状态筛选（queued、running、waiting、blocked、succeeded、failed、cancelled、lost）",
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsListCommand(
          {
            json: Boolean(opts.json),
            status: opts.status as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  tasksFlowCmd
    .command("show")
    .description("按流 ID 或所有者密钥显示一个 TaskFlow")
    .argument("<lookup>", "流 ID 或所有者密钥")
    .option("--json", "输出 JSON", false)
    .action(async (lookup, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsShowCommand(
          {
            lookup,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  tasksFlowCmd
    .command("cancel")
    .description("取消运行中的 TaskFlow")
    .argument("<lookup>", "Flow id or owner key")
    .action(async (lookup) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsCancelCommand(
          {
            lookup,
          },
          defaultRuntime,
        );
      });
    });

  const governanceCmd = program
    .command("governance")
    .description("检查组织章程和治理控制面状态")
    .option("--json", "输出 JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceOverviewCommand(
          {
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });
  governanceCmd.enablePositionalOptions();

  governanceCmd
    .command("overview")
    .description("显示治理章程状态、冻结姿态和发现")
    .option("--json", "输出 JSON", false)
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceOverviewCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceCmd
    .command("agent")
    .description("显示代理的章程角色和有效治理契约")
    .argument("<agentId>", "代理 ID")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceAgentCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceCmd
    .command("team")
    .description("显示团队的章程蓝图和已解析的成员治理姿态")
    .argument("<teamId>", "团队 ID")
    .option("--json", "输出 JSON", false)
    .action(async (teamId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceTeamCommand(
          {
            teamId,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceCmd
    .command("capabilities")
    .description("显示受治理的能力清单")
    .argument("[agentIds...]", "限定清单范围的代理 ID")
    .option("--workspace <dir>", "要检查的工作空间范围（可重复）", collectOption, [])
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceCapabilityInventoryCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  governanceCmd
    .command("asset-registry")
    .description("显示受治理的能力资产注册表和注册表漂移")
    .argument("[agentIds...]", "限定注册表比较范围的代理 ID")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceCapabilityAssetRegistryCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  governanceCmd
    .command("genesis-plan")
    .description("从受治理的能力缺口规划治理创始团队工作")
    .argument("[agentIds...]", "创始计划聚焦的代理 ID")
    .option("--team-id <id>", "要规划的创始团队 ID")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceGenesisPlanCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  const governanceProposalsCmd = governanceCmd
    .command("proposals")
    .description("检查和变更治理提案账本")
    .option("--json", "输出 JSON", false)
    .option("--status <status>", "按状态筛选（pending、approved、rejected、applied）")
    .option("--limit <n>", "最多返回的提案数")
    .action(async (opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit 必须为正整数");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsListCommand(
          {
            status: opts.status as string | undefined,
            ...(limit !== undefined ? { limit } : {}),
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });
  governanceProposalsCmd.enablePositionalOptions();

  governanceProposalsCmd
    .command("list")
    .description("列出治理提案（可选状态筛选）")
    .option("--json", "输出 JSON", false)
    .option("--status <status>", "Filter by status (pending, approved, rejected, applied)")
    .option("--limit <n>", "Maximum proposals to return")
    .action(async (opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit must be a positive integer");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            status?: string;
            limit?: string;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const parentLimit = parsePositiveIntOrUndefined(parentOpts?.limit);
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsListCommand(
          {
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            ...(limit !== undefined
              ? { limit }
              : parentLimit !== undefined
                ? { limit: parentLimit }
                : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("synthesize")
    .description("从确定性章程发现合成待处理的治理提案")
    .argument(
      "[agentIds...]",
      "Governance agent ids (defaults to founder, strategist, and librarian)",
    )
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsSynthesizeCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("reconcile")
    .description("Review and apply deterministic governance proposals through the control plane")
    .argument(
      "[agentIds...]",
      "Governance agent ids (defaults to founder, strategist, and librarian)",
    )
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--mode <mode>", "Reconcile mode (apply_safe, force_apply_all)")
    .option("--created-by-agent <id>", "Actor agent id recorded on synthesized proposals")
    .option("--created-by-session <key>", "Actor session key recorded on synthesized proposals")
    .option("--decided-by <id>", "Reviewer id recorded on auto-approved proposals")
    .option("--note <text>", "Decision note recorded on auto-approved proposals")
    .option("--applied-by <id>", "Actor id recorded on auto-applied proposals")
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsReconcileCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            mode: opts.mode as string | undefined,
            createdByAgentId: opts.createdByAgent as string | undefined,
            createdBySessionKey: opts.createdBySession as string | undefined,
            decidedBy: opts.decidedBy as string | undefined,
            decisionNote: opts.note as string | undefined,
            appliedBy: opts.appliedBy as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("create")
    .description("Create a pending governance proposal from JSON operations")
    .requiredOption("--title <text>", "Proposal title")
    .option("--rationale <text>", "Proposal rationale")
    .option("--created-by-agent <id>", "Actor agent id recorded in the proposal")
    .option("--created-by-session <key>", "Actor session key recorded in the proposal")
    .option("--ops-json <json>", "Inline JSON array or object with an operations field")
    .option("--ops-file <path>", "Path to a JSON file containing operations")
    .option("--json", "输出 JSON", false)
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsCreateCommand(
          {
            title: opts.title as string,
            rationale: opts.rationale as string | undefined,
            createdByAgentId: opts.createdByAgent as string | undefined,
            createdBySessionKey: opts.createdBySession as string | undefined,
            operationsJson: opts.opsJson as string | undefined,
            operationsFile: opts.opsFile as string | undefined,
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("review")
    .description("Approve or reject a governance proposal")
    .argument("<proposalId>", "提案 ID")
    .requiredOption("--decision <decision>", "Decision (approve, reject)")
    .option("--decided-by <id>", "Reviewer id (default: cli)")
    .option("--note <text>", "Decision note")
    .option("--json", "输出 JSON", false)
    .action(async (proposalId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsReviewCommand(
          {
            proposalId,
            decision: opts.decision as string,
            decidedBy: opts.decidedBy as string | undefined,
            decisionNote: opts.note as string | undefined,
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("review-many")
    .description("Review multiple governance proposals by explicit ids or filtered status")
    .argument("[proposalIds...]", "Proposal ids to review explicitly")
    .requiredOption("--decision <decision>", "Decision (approve, reject)")
    .option("--status <status>", "Filter by status (pending, approved, rejected, applied)")
    .option("--limit <n>", "Maximum proposals to review")
    .option("--decided-by <id>", "Reviewer id (default: cli)")
    .option("--note <text>", "Decision note")
    .option("--fail-fast", "首批错误时停止", false)
    .option("--json", "输出 JSON", false)
    .action(async (proposalIds, opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit must be a positive integer");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            status?: string;
            limit?: string;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const parentLimit = parsePositiveIntOrUndefined(parentOpts?.limit);
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsReviewManyCommand(
          {
            ...(Array.isArray(proposalIds) && proposalIds.length > 0 ? { proposalIds } : {}),
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            ...(limit !== undefined
              ? { limit }
              : parentLimit !== undefined
                ? { limit: parentLimit }
                : {}),
            decision: opts.decision as string,
            decidedBy: opts.decidedBy as string | undefined,
            decisionNote: opts.note as string | undefined,
            ...(opts.failFast ? { continueOnError: false } : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("apply")
    .description("Apply an approved governance proposal to governance/charter")
    .argument("<proposalId>", "提案 ID")
    .option("--applied-by <id>", "Actor id recorded in the apply audit (default: cli)")
    .option("--json", "输出 JSON", false)
    .action(async (proposalId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsApplyCommand(
          {
            proposalId,
            appliedBy: opts.appliedBy as string | undefined,
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("apply-many")
    .description("Apply multiple governance proposals by explicit ids or filtered status")
    .argument("[proposalIds...]", "Proposal ids to apply explicitly")
    .option("--status <status>", "Filter by status (pending, approved, rejected, applied)")
    .option("--limit <n>", "Maximum proposals to apply")
    .option("--applied-by <id>", "Actor id recorded in the apply audit (default: cli)")
    .option("--fail-fast", "首批错误时停止", false)
    .option("--json", "输出 JSON", false)
    .action(async (proposalIds, opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit must be a positive integer");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            status?: string;
            limit?: string;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const parentLimit = parsePositiveIntOrUndefined(parentOpts?.limit);
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsApplyManyCommand(
          {
            ...(Array.isArray(proposalIds) && proposalIds.length > 0 ? { proposalIds } : {}),
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            ...(limit !== undefined
              ? { limit }
              : parentLimit !== undefined
                ? { limit: parentLimit }
                : {}),
            appliedBy: opts.appliedBy as string | undefined,
            ...(opts.failFast ? { continueOnError: false } : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("revert")
    .description("Revert a previously applied governance proposal")
    .argument("<proposalId>", "提案 ID")
    .option("--reverted-by <id>", "Actor id recorded in the revert audit (default: cli)")
    .option("--json", "输出 JSON", false)
    .action(async (proposalId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsRevertCommand(
          {
            proposalId,
            revertedBy: opts.revertedBy as string | undefined,
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  governanceProposalsCmd
    .command("revert-many")
    .description("Revert multiple applied governance proposals by explicit ids or filtered status")
    .argument("[proposalIds...]", "Proposal ids to revert explicitly")
    .option("--status <status>", "Filter by status (pending, approved, rejected, applied)")
    .option("--limit <n>", "Maximum proposals to revert")
    .option("--reverted-by <id>", "Actor id recorded in the revert audit (default: cli)")
    .option("--fail-fast", "首批错误时停止", false)
    .option("--json", "输出 JSON", false)
    .action(async (proposalIds, opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit must be a positive integer");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            status?: string;
            limit?: string;
          }
        | undefined;
      const rootOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
          }
        | undefined;
      const parentLimit = parsePositiveIntOrUndefined(parentOpts?.limit);
      await runCommandWithRuntime(defaultRuntime, async () => {
        await governanceProposalsRevertManyCommand(
          {
            ...(Array.isArray(proposalIds) && proposalIds.length > 0 ? { proposalIds } : {}),
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            ...(limit !== undefined
              ? { limit }
              : parentLimit !== undefined
                ? { limit: parentLimit }
                : {}),
            revertedBy: opts.revertedBy as string | undefined,
            ...(opts.failFast ? { continueOnError: false } : {}),
            json: Boolean(opts.json || parentOpts?.json || rootOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  const autonomyCmd = program
    .command("autonomy")
    .description("Inspect and launch managed autonomy profiles")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyListCommand(
          {
            json: Boolean(opts.json),
            sessionKey: opts.sessionKey as string | undefined,
          },
          defaultRuntime,
        );
      });
    });
  autonomyCmd.enablePositionalOptions();

  autonomyCmd
    .command("list")
    .description("List available autonomy profiles")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyListCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("overview")
    .description("Show fleet-wide autonomy loop and flow convergence status")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyOverviewCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("capabilities")
    .description("Show the governed autonomy capability inventory")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyCapabilityInventoryCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("genesis-plan")
    .description("Plan genesis-team work from capability gaps and governed scope")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyGenesisPlanCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("heal")
    .description("Heal fleet-wide autonomy loops and managed flow continuity")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--workspace <dir>", "Workspace scope to operate on (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyHealCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("supervise")
    .description(
      "Run an end-to-end autonomy supervisor pass across heal, governance, and genesis planning",
    )
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to operate on (repeatable)", collectOption, [])
    .option("--governance-mode <mode>", "Governance mode (none, apply_safe, force_apply_all)")
    .option("--note <text>", "Decision note recorded on governance reconciliation")
    .option("--no-restart-blocked", "Do not restart blocked managed flows")
    .option("--no-capabilities", "Skip capability inventory refresh")
    .option("--no-genesis", "Skip genesis plan refresh")
    .option("--no-history", "Do not persist supervisor heal history")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomySuperviseCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            restartBlockedFlows: opts.restartBlocked as boolean | undefined,
            governanceMode: opts.governanceMode as
              | "none"
              | "apply_safe"
              | "force_apply_all"
              | undefined,
            decisionNote: opts.note as string | undefined,
            includeCapabilityInventory: opts.capabilities as boolean | undefined,
            includeGenesisPlan: opts.genesis as boolean | undefined,
            recordHistory: opts.history as boolean | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("bootstrap")
    .description("Prepare the autonomy fleet for continuous operation and report readiness")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to operate on (repeatable)", collectOption, [])
    .option("--governance-mode <mode>", "Governance mode (none, apply_safe, force_apply_all)")
    .option("--note <text>", "Decision note recorded on governance reconciliation")
    .option("--no-restart-blocked", "Do not restart blocked managed flows")
    .option("--no-capabilities", "Skip capability inventory refresh")
    .option("--no-genesis", "Skip genesis plan refresh")
    .option("--no-history", "Do not persist bootstrap heal history")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyBootstrapCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            restartBlockedFlows: opts.restartBlocked as boolean | undefined,
            governanceMode: opts.governanceMode as
              | "none"
              | "apply_safe"
              | "force_apply_all"
              | undefined,
            decisionNote: opts.note as string | undefined,
            includeCapabilityInventory: opts.capabilities as boolean | undefined,
            includeGenesisPlan: opts.genesis as boolean | undefined,
            recordHistory: opts.history as boolean | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("activate")
    .description(
      "Activate governed maximum autonomy by repairing loops, checking readiness, and refreshing capability evidence",
    )
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to operate on (repeatable)", collectOption, [])
    .option(
      "--governance-mode <mode>",
      "Governance mode (defaults to apply_safe; allowed: none, apply_safe, force_apply_all)",
    )
    .option("--note <text>", "Decision note recorded on governance reconciliation")
    .option("--no-restart-blocked", "Do not restart blocked managed flows")
    .option("--no-capabilities", "Skip capability inventory refresh")
    .option("--no-genesis", "Skip genesis plan refresh")
    .option("--no-history", "Do not persist activation heal history")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyActivateCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            restartBlockedFlows: opts.restartBlocked as boolean | undefined,
            governanceMode:
              (opts.governanceMode as "none" | "apply_safe" | "force_apply_all" | undefined) ??
              "apply_safe",
            decisionNote: opts.note as string | undefined,
            includeCapabilityInventory: opts.capabilities as boolean | undefined,
            includeGenesisPlan: opts.genesis as boolean | undefined,
            recordHistory: opts.history as boolean | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("architecture")
    .description("Verify strong-autonomy architecture readiness against the target document")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to operate on (repeatable)", collectOption, [])
    .option("--governance-mode <mode>", "Governance mode (none, apply_safe, force_apply_all)")
    .option("--note <text>", "Decision note recorded on governance reconciliation")
    .option("--no-restart-blocked", "Do not restart blocked managed flows")
    .option("--no-capabilities", "Skip capability inventory refresh")
    .option("--no-genesis", "Skip genesis plan refresh")
    .option("--no-history", "Do not persist architecture readiness heal history")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyArchitectureReadinessCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            teamId: opts.teamId as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            restartBlockedFlows: opts.restartBlocked as boolean | undefined,
            governanceMode: opts.governanceMode as
              | "none"
              | "apply_safe"
              | "force_apply_all"
              | undefined,
            decisionNote: opts.note as string | undefined,
            includeCapabilityInventory: opts.capabilities as boolean | undefined,
            includeGenesisPlan: opts.genesis as boolean | undefined,
            recordHistory: opts.history as boolean | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("history")
    .description("Show persistent autonomy maintenance history")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option("--workspace <dir>", "Workspace scope to filter by (repeatable)", collectOption, [])
    .option("--limit <n>", "Maximum number of events to return")
    .option("--mode <mode>", "Filter by mode (heal, reconcile)")
    .option("--source <source>", "Filter by source (manual, startup, supervisor)")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const limit = parsePositiveIntOrUndefined(opts.limit);
      if (opts.limit !== undefined && limit === undefined) {
        defaultRuntime.error("--limit must be a positive integer");
        defaultRuntime.exit(1);
        return;
      }
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyHistoryCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            ...(limit !== undefined ? { limit } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            mode: opts.mode as "heal" | "reconcile" | undefined,
            source: opts.source as "manual" | "startup" | "supervisor" | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("governance")
    .description("从确定性章程发现合成待处理的治理提案")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to founder and strategist)")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyGovernanceCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("governance-reconcile")
    .description("通过自治运行时对账确定性治理提案")
    .argument(
      "[agentIds...]",
      "Autonomy profile ids (defaults to founder, strategist, and librarian)",
    )
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--mode <mode>", "Reconcile mode (apply_safe, force_apply_all)")
    .option("--note <text>", "Decision note recorded on auto-approved proposals")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyGovernanceReconcileCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            mode: opts.mode as "apply_safe" | "force_apply_all" | undefined,
            decisionNote: opts.note as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("show")
    .description("显示一个自治配置")
    .argument("<agentId>", "自治配置 ID")
    .option("--json", "输出 JSON", false)
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyShowCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("start")
    .description("启动托管自治流")
    .argument("<agentId>", "自治配置 ID")
    .option("--goal <text>", "Override the flow goal")
    .option("--controller-id <id>", "Override the autonomy controller id")
    .option("--current-step <step>", "Override the current flow step")
    .option(
      "--workspace <dir>",
      "Workspace scope to bind into the managed flow (repeatable)",
      collectOption,
      [],
    )
    .option("--notify <policy>", "Notify policy (done_only, state_changes, silent)")
    .option("--status <status>", "Initial flow status (queued, running)")
    .option("--session-key <key>", "Override the owner session key for the managed flow")
    .option("--seed-runtime <runtime>", "Seed task runtime (subagent, acp, cli, cron)")
    .option("--seed-status <status>", "Seed task status (queued, running)")
    .option("--seed-label <text>", "Override the seed task label")
    .option("--seed-body <text>", "Override the seed task body")
    .option("--no-seed-task", "Disable automatic seed task creation")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyStartCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            goal: opts.goal as string | undefined,
            controllerId: opts.controllerId as string | undefined,
            currentStep: opts.currentStep as string | undefined,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
            notifyPolicy: opts.notify as "done_only" | "state_changes" | "silent" | undefined,
            status: opts.status as "queued" | "running" | undefined,
            seedTaskEnabled: typeof opts.seedTask === "boolean" ? opts.seedTask : undefined,
            seedTaskRuntime: opts.seedRuntime as "subagent" | "acp" | "cli" | "cron" | undefined,
            seedTaskStatus: opts.seedStatus as "queued" | "running" | undefined,
            seedTaskLabel: opts.seedLabel as string | undefined,
            seedTaskTask: opts.seedBody as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyCmd
    .command("cancel")
    .description("取消托管自治流")
    .argument("<agentId>", "自治配置 ID")
    .option("--flow-id <id>", "Cancel a specific managed flow instead of the latest one")
    .option("--session-key <key>", "Override the owner session key for the managed flow")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyCancelCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            flowId: opts.flowId as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  const autonomyReplayCmd = autonomyCmd
    .command("replay")
    .description("检查和提交托管沙箱回放证据");

  autonomyReplayCmd
    .command("submit")
    .description("为托管自治流提交沙箱回放证据")
    .argument("<agentId>", "自治配置 ID")
    .option("--flow-id <id>", "Target a specific managed flow instead of the latest one")
    .requiredOption("--replay <verdict>", "Replay verdict (pass, fail)")
    .requiredOption("--qa <verdict>", "QA verdict (pass, fail)")
    .option("--audit <verdict>", "Audit verdict (pass, fail)")
    .option("--session-key <key>", "Override the owner session key for the managed flow")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parseVerdict = (value: unknown, flag: string): boolean | null => {
        if (value === "pass") {
          return true;
        }
        if (value === "fail") {
          return false;
        }
        defaultRuntime.error(`${flag} must be either 'pass' or 'fail'`);
        defaultRuntime.exit(1);
        return null;
      };
      const replayPassed = parseVerdict(opts.replay, "--replay");
      const qaPassed = parseVerdict(opts.qa, "--qa");
      const auditPassed =
        opts.audit === undefined ? undefined : parseVerdict(opts.audit, "--audit");
      if (
        replayPassed === null ||
        qaPassed === null ||
        (opts.audit !== undefined && auditPassed === null)
      ) {
        return;
      }
      const normalizedAuditPassed: boolean | undefined =
        auditPassed === null ? undefined : auditPassed;
      const parentOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyReplaySubmitCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            flowId: opts.flowId as string | undefined,
            replayPassed,
            qaPassed,
            ...(normalizedAuditPassed !== undefined ? { auditPassed: normalizedAuditPassed } : {}),
          },
          defaultRuntime,
        );
      });
    });

  const autonomyLoopCmd = autonomyCmd
    .command("loop")
    .description("检查和控制定时自治循环");

  autonomyLoopCmd
    .command("show")
    .description("显示一个配置的定时自治循环")
    .argument("<agentId>", "自治配置 ID")
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyLoopShowCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
          },
          defaultRuntime,
        );
      });
    });

  autonomyLoopCmd
    .command("enable")
    .description("启用或更新一个配置的定时自治循环")
    .argument("<agentId>", "自治配置 ID")
    .option("--every-ms <ms>", "Loop interval in milliseconds")
    .option(
      "--workspace <dir>",
      "Workspace scope to attach to the loop (repeatable)",
      collectOption,
      [],
    )
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyLoopEnableCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            everyMs: parsePositiveIntOrUndefined(opts.everyMs),
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyLoopCmd
    .command("reconcile")
    .description("对照受治理的配置集对账定时自治循环")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option(
      "--workspace <dir>",
      "Workspace scope to reconcile against (repeatable)",
      collectOption,
      [],
    )
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "输出 JSON", false)
    .action(async (agentIds, opts, command) => {
      const parentOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyLoopReconcileCommand(
          {
            ...(Array.isArray(agentIds) && agentIds.length > 0 ? { agentIds } : {}),
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            workspaceDirs: Array.isArray(opts.workspace) ? (opts.workspace as string[]) : undefined,
          },
          defaultRuntime,
        );
      });
    });

  autonomyLoopCmd
    .command("disable")
    .description("禁用一个配置的定时自治循环")
    .argument("<agentId>", "自治配置 ID")
    .option("--job-id <id>", "Disable a specific loop job instead of all managed loop jobs")
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "输出 JSON", false)
    .action(async (agentId, opts, command) => {
      const parentOpts = command.parent?.parent?.opts() as
        | {
            json?: boolean;
            sessionKey?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await autonomyLoopDisableCommand(
          {
            agentId,
            json: Boolean(opts.json || parentOpts?.json),
            sessionKey: (opts.sessionKey as string | undefined) ?? parentOpts?.sessionKey,
            jobId: opts.jobId as string | undefined,
          },
          defaultRuntime,
        );
      });
    });
}
