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
    defaultRuntime.error("--timeout must be a positive integer (milliseconds)");
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
    .description("Show channel health and recent session recipients")
    .option("--json", "Output JSON instead of text", false)
    .option("--all", "Full diagnosis (read-only, pasteable)", false)
    .option("--usage", "Show model provider usage/quota snapshots", false)
    .option("--deep", "Probe channels (WhatsApp Web + Telegram + Discord + Slack + Signal)", false)
    .option("--timeout <ms>", "Probe timeout in milliseconds", "10000")
    .option("--verbose", "Verbose logging", false)
    .option("--debug", "Alias for --verbose", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw status", "Show channel health + session summary."],
          ["openclaw status --all", "Full diagnosis (read-only)."],
          ["openclaw status --json", "Machine-readable output."],
          ["openclaw status --usage", "Show model provider usage/quota snapshots."],
          [
            "openclaw status --deep",
            "Run channel probes (WA + Telegram + Discord + Slack + Signal).",
          ],
          ["openclaw status --deep --timeout 5000", "Tighten probe timeout."],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/status", "docs.openclaw.ai/cli/status")}\n`,
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
    .description("Fetch health from the running gateway")
    .option("--json", "Output JSON instead of text", false)
    .option("--timeout <ms>", "Connection timeout in milliseconds", "10000")
    .option("--verbose", "Verbose logging", false)
    .option("--debug", "Alias for --verbose", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/health", "docs.openclaw.ai/cli/health")}\n`,
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
    .description("List stored conversation sessions")
    .option("--json", "Output as JSON", false)
    .option("--verbose", "Verbose logging", false)
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to inspect (default: configured default agent)")
    .option("--all-agents", "Aggregate sessions across all configured agents", false)
    .option("--active <minutes>", "Only show sessions updated within the past N minutes")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw sessions", "List all sessions."],
          ["openclaw sessions --agent work", "List sessions for one agent."],
          ["openclaw sessions --all-agents", "Aggregate sessions across agents."],
          ["openclaw sessions --active 120", "Only last 2 hours."],
          ["openclaw sessions --json", "Machine-readable output."],
          ["openclaw sessions --store ./tmp/sessions.json", "Use a specific session store."],
        ])}\n\n${theme.muted(
          "Shows token usage per session when the agent reports it; set agents.defaults.contextTokens to cap the window and show %.",
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/sessions", "docs.openclaw.ai/cli/sessions")}\n`,
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
    .description("Run session-store maintenance now")
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to maintain (default: configured default agent)")
    .option("--all-agents", "Run maintenance across all configured agents", false)
    .option("--dry-run", "Preview maintenance actions without writing", false)
    .option("--enforce", "Apply maintenance even when configured mode is warn", false)
    .option(
      "--fix-missing",
      "Remove store entries whose transcript files are missing (bypasses age/count retention)",
      false,
    )
    .option("--active-key <key>", "Protect this session key from budget-eviction")
    .option("--json", "Output JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw sessions cleanup --dry-run", "Preview stale/cap cleanup."],
          [
            "openclaw sessions cleanup --dry-run --fix-missing",
            "Also preview pruning entries with missing transcript files.",
          ],
          ["openclaw sessions cleanup --enforce", "Apply maintenance now."],
          ["openclaw sessions cleanup --agent work --dry-run", "Preview one agent store."],
          ["openclaw sessions cleanup --all-agents --dry-run", "Preview all agent stores."],
          [
            "openclaw sessions cleanup --enforce --store ./tmp/sessions.json",
            "Use a specific store.",
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
    .description("Inspect durable background tasks and TaskFlow state")
    .option("--json", "Output as JSON", false)
    .option("--runtime <name>", "Filter by kind (subagent, acp, cron, cli)")
    .option(
      "--status <name>",
      "Filter by status (queued, running, succeeded, failed, timed_out, cancelled, lost)",
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
    .description("List tracked background tasks")
    .option("--json", "Output as JSON", false)
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
    .description("Show stale or broken background tasks and TaskFlows")
    .option("--json", "Output as JSON", false)
    .option("--severity <level>", "Filter by severity (warn, error)")
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
    .description("Preview or apply tasks and TaskFlow maintenance")
    .option("--json", "Output as JSON", false)
    .option("--apply", "Apply reconciliation, cleanup stamping, and pruning", false)
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
    .description("Show one background task by task id, run id, or session key")
    .argument("<lookup>", "Task id, run id, or session key")
    .option("--json", "Output as JSON", false)
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
    .description("Set task notify policy")
    .argument("<lookup>", "Task id, run id, or session key")
    .argument("<notify>", "Notify policy (done_only, state_changes, silent)")
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
    .description("Cancel a running background task")
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
    .description("Inspect durable TaskFlow state under tasks");

  tasksFlowCmd
    .command("list")
    .description("List tracked TaskFlows")
    .option("--json", "Output as JSON", false)
    .option(
      "--status <name>",
      "Filter by status (queued, running, waiting, blocked, succeeded, failed, cancelled, lost)",
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
    .description("Show one TaskFlow by flow id or owner key")
    .argument("<lookup>", "Flow id or owner key")
    .option("--json", "Output as JSON", false)
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
    .description("Cancel a running TaskFlow")
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
    .description("Inspect organizational charter and governance control-plane state")
    .option("--json", "Output as JSON", false)
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
    .description("Show governance charter status, freeze posture, and findings")
    .option("--json", "Output as JSON", false)
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
    .description("Show one agent's charter role and effective governance contract")
    .argument("<agentId>", "Agent id")
    .option("--json", "Output as JSON", false)
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
    .description("Show one team's charter blueprint and resolved member governance posture")
    .argument("<teamId>", "Team id")
    .option("--json", "Output as JSON", false)
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
    .description("Show the governed governance capability inventory")
    .argument("[agentIds...]", "Agent ids to scope the inventory to")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "Output as JSON", false)
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
    .description("Show the governed capability asset registry and registry drift")
    .argument("[agentIds...]", "Agent ids to scope the registry comparison to")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "Output as JSON", false)
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
    .description("Plan governance genesis-team work from governed capability gaps")
    .argument("[agentIds...]", "Agent ids to focus the genesis plan on")
    .option("--team-id <id>", "Genesis team id to plan for")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "Output as JSON", false)
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
    .description("Inspect and mutate the governance proposal ledger")
    .option("--json", "Output as JSON", false)
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
    .description("List governance proposals with optional status filtering")
    .option("--json", "Output as JSON", false)
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
    .description("Synthesize pending governance proposals from deterministic charter findings")
    .argument(
      "[agentIds...]",
      "Governance agent ids (defaults to founder, strategist, and librarian)",
    )
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .argument("<proposalId>", "Proposal id")
    .requiredOption("--decision <decision>", "Decision (approve, reject)")
    .option("--decided-by <id>", "Reviewer id (default: cli)")
    .option("--note <text>", "Decision note")
    .option("--json", "Output as JSON", false)
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
    .option("--fail-fast", "Stop on first batch error", false)
    .option("--json", "Output as JSON", false)
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
    .argument("<proposalId>", "Proposal id")
    .option("--applied-by <id>", "Actor id recorded in the apply audit (default: cli)")
    .option("--json", "Output as JSON", false)
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
    .option("--fail-fast", "Stop on first batch error", false)
    .option("--json", "Output as JSON", false)
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
    .argument("<proposalId>", "Proposal id")
    .option("--reverted-by <id>", "Actor id recorded in the revert audit (default: cli)")
    .option("--json", "Output as JSON", false)
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
    .option("--fail-fast", "Stop on first batch error", false)
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .option("--json", "Output as JSON", false)
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
    .description("Synthesize pending governance proposals from deterministic charter findings")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to founder and strategist)")
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--json", "Output as JSON", false)
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
    .description("Reconcile deterministic governance proposals through the autonomy runtime")
    .argument(
      "[agentIds...]",
      "Autonomy profile ids (defaults to founder, strategist, and librarian)",
    )
    .option("--workspace <dir>", "Workspace scope to inspect (repeatable)", collectOption, [])
    .option("--mode <mode>", "Reconcile mode (apply_safe, force_apply_all)")
    .option("--note <text>", "Decision note recorded on auto-approved proposals")
    .option("--json", "Output as JSON", false)
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
    .description("Show one autonomy profile")
    .argument("<agentId>", "Autonomy profile id")
    .option("--json", "Output as JSON", false)
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
    .description("Start a managed autonomy flow")
    .argument("<agentId>", "Autonomy profile id")
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
    .option("--json", "Output as JSON", false)
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
    .description("Cancel a managed autonomy flow")
    .argument("<agentId>", "Autonomy profile id")
    .option("--flow-id <id>", "Cancel a specific managed flow instead of the latest one")
    .option("--session-key <key>", "Override the owner session key for the managed flow")
    .option("--json", "Output as JSON", false)
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
    .description("Inspect and submit managed sandbox replay evidence");

  autonomyReplayCmd
    .command("submit")
    .description("Submit sandbox replay evidence for a managed autonomy flow")
    .argument("<agentId>", "Autonomy profile id")
    .option("--flow-id <id>", "Target a specific managed flow instead of the latest one")
    .requiredOption("--replay <verdict>", "Replay verdict (pass, fail)")
    .requiredOption("--qa <verdict>", "QA verdict (pass, fail)")
    .option("--audit <verdict>", "Audit verdict (pass, fail)")
    .option("--session-key <key>", "Override the owner session key for the managed flow")
    .option("--json", "Output as JSON", false)
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
    .description("Inspect and control scheduled autonomy loops");

  autonomyLoopCmd
    .command("show")
    .description("Show the scheduled autonomy loop for one profile")
    .argument("<agentId>", "Autonomy profile id")
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "Output as JSON", false)
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
    .description("Enable or update the scheduled autonomy loop for one profile")
    .argument("<agentId>", "Autonomy profile id")
    .option("--every-ms <ms>", "Loop interval in milliseconds")
    .option(
      "--workspace <dir>",
      "Workspace scope to attach to the loop (repeatable)",
      collectOption,
      [],
    )
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "Output as JSON", false)
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
    .description("Reconcile scheduled autonomy loops against the governed profile set")
    .argument("[agentIds...]", "Autonomy profile ids (defaults to all managed profiles)")
    .option(
      "--workspace <dir>",
      "Workspace scope to reconcile against (repeatable)",
      collectOption,
      [],
    )
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "Output as JSON", false)
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
    .description("Disable the scheduled autonomy loop for one profile")
    .argument("<agentId>", "Autonomy profile id")
    .option("--job-id <id>", "Disable a specific loop job instead of all managed loop jobs")
    .option("--session-key <key>", "Override the owner session key for autonomy operations")
    .option("--json", "Output as JSON", false)
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
