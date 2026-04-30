import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerStatusHealthSessionsCommands } from "./register.status-health-sessions.js";

const mocks = vi.hoisted(() => ({
  autonomyActivateCommand: vi.fn(),
  autonomyArchitectureReadinessCommand: vi.fn(),
  autonomyBootstrapCommand: vi.fn(),
  autonomyCapabilityInventoryCommand: vi.fn(),
  autonomyCancelCommand: vi.fn(),
  autonomyGenesisPlanCommand: vi.fn(),
  autonomyGovernanceCommand: vi.fn(),
  autonomyGovernanceReconcileCommand: vi.fn(),
  autonomyHealCommand: vi.fn(),
  autonomyHistoryCommand: vi.fn(),
  autonomyListCommand: vi.fn(),
  autonomyOverviewCommand: vi.fn(),
  autonomyReplaySubmitCommand: vi.fn(),
  autonomySuperviseCommand: vi.fn(),
  autonomyLoopDisableCommand: vi.fn(),
  autonomyLoopEnableCommand: vi.fn(),
  autonomyLoopReconcileCommand: vi.fn(),
  autonomyLoopShowCommand: vi.fn(),
  autonomyShowCommand: vi.fn(),
  autonomyStartCommand: vi.fn(),
  governanceAgentCommand: vi.fn(),
  governanceCapabilityAssetRegistryCommand: vi.fn(),
  governanceTeamCommand: vi.fn(),
  governanceCapabilityInventoryCommand: vi.fn(),
  governanceGenesisPlanCommand: vi.fn(),
  governanceOverviewCommand: vi.fn(),
  governanceProposalsApplyCommand: vi.fn(),
  governanceProposalsApplyManyCommand: vi.fn(),
  governanceProposalsCreateCommand: vi.fn(),
  governanceProposalsListCommand: vi.fn(),
  governanceProposalsReconcileCommand: vi.fn(),
  governanceProposalsRevertCommand: vi.fn(),
  governanceProposalsRevertManyCommand: vi.fn(),
  governanceProposalsReviewCommand: vi.fn(),
  governanceProposalsReviewManyCommand: vi.fn(),
  governanceProposalsSynthesizeCommand: vi.fn(),
  statusCommand: vi.fn(),
  healthCommand: vi.fn(),
  sessionsCommand: vi.fn(),
  sessionsCleanupCommand: vi.fn(),
  tasksListCommand: vi.fn(),
  tasksAuditCommand: vi.fn(),
  tasksMaintenanceCommand: vi.fn(),
  tasksShowCommand: vi.fn(),
  tasksNotifyCommand: vi.fn(),
  tasksCancelCommand: vi.fn(),
  flowsListCommand: vi.fn(),
  flowsShowCommand: vi.fn(),
  flowsCancelCommand: vi.fn(),
  setVerbose: vi.fn(),
  runtime: {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  },
}));

const autonomyActivateCommand = mocks.autonomyActivateCommand;
const autonomyArchitectureReadinessCommand = mocks.autonomyArchitectureReadinessCommand;
const autonomyBootstrapCommand = mocks.autonomyBootstrapCommand;
const autonomyCapabilityInventoryCommand = mocks.autonomyCapabilityInventoryCommand;
const autonomyCancelCommand = mocks.autonomyCancelCommand;
const autonomyGenesisPlanCommand = mocks.autonomyGenesisPlanCommand;
const autonomyGovernanceCommand = mocks.autonomyGovernanceCommand;
const autonomyGovernanceReconcileCommand = mocks.autonomyGovernanceReconcileCommand;
const autonomyHealCommand = mocks.autonomyHealCommand;
const autonomyHistoryCommand = mocks.autonomyHistoryCommand;
const autonomyListCommand = mocks.autonomyListCommand;
const autonomyOverviewCommand = mocks.autonomyOverviewCommand;
const autonomyReplaySubmitCommand = mocks.autonomyReplaySubmitCommand;
const autonomySuperviseCommand = mocks.autonomySuperviseCommand;
const autonomyLoopDisableCommand = mocks.autonomyLoopDisableCommand;
const autonomyLoopEnableCommand = mocks.autonomyLoopEnableCommand;
const autonomyLoopReconcileCommand = mocks.autonomyLoopReconcileCommand;
const autonomyLoopShowCommand = mocks.autonomyLoopShowCommand;
const autonomyShowCommand = mocks.autonomyShowCommand;
const autonomyStartCommand = mocks.autonomyStartCommand;
const governanceAgentCommand = mocks.governanceAgentCommand;
const governanceCapabilityAssetRegistryCommand = mocks.governanceCapabilityAssetRegistryCommand;
const governanceTeamCommand = mocks.governanceTeamCommand;
const governanceCapabilityInventoryCommand = mocks.governanceCapabilityInventoryCommand;
const governanceGenesisPlanCommand = mocks.governanceGenesisPlanCommand;
const governanceOverviewCommand = mocks.governanceOverviewCommand;
const governanceProposalsApplyCommand = mocks.governanceProposalsApplyCommand;
const governanceProposalsApplyManyCommand = mocks.governanceProposalsApplyManyCommand;
const governanceProposalsCreateCommand = mocks.governanceProposalsCreateCommand;
const governanceProposalsListCommand = mocks.governanceProposalsListCommand;
const governanceProposalsReconcileCommand = mocks.governanceProposalsReconcileCommand;
const governanceProposalsRevertCommand = mocks.governanceProposalsRevertCommand;
const governanceProposalsRevertManyCommand = mocks.governanceProposalsRevertManyCommand;
const governanceProposalsReviewCommand = mocks.governanceProposalsReviewCommand;
const governanceProposalsReviewManyCommand = mocks.governanceProposalsReviewManyCommand;
const governanceProposalsSynthesizeCommand = mocks.governanceProposalsSynthesizeCommand;
const statusCommand = mocks.statusCommand;
const healthCommand = mocks.healthCommand;
const sessionsCommand = mocks.sessionsCommand;
const sessionsCleanupCommand = mocks.sessionsCleanupCommand;
const tasksListCommand = mocks.tasksListCommand;
const tasksAuditCommand = mocks.tasksAuditCommand;
const tasksMaintenanceCommand = mocks.tasksMaintenanceCommand;
const tasksShowCommand = mocks.tasksShowCommand;
const tasksNotifyCommand = mocks.tasksNotifyCommand;
const tasksCancelCommand = mocks.tasksCancelCommand;
const flowsListCommand = mocks.flowsListCommand;
const flowsShowCommand = mocks.flowsShowCommand;
const flowsCancelCommand = mocks.flowsCancelCommand;
const setVerbose = mocks.setVerbose;
const runtime = mocks.runtime;

vi.mock("../../commands/status.js", () => ({
  statusCommand: mocks.statusCommand,
}));

vi.mock("../../commands/autonomy.js", () => ({
  autonomyActivateCommand: mocks.autonomyActivateCommand,
  autonomyArchitectureReadinessCommand: mocks.autonomyArchitectureReadinessCommand,
  autonomyBootstrapCommand: mocks.autonomyBootstrapCommand,
  autonomyCapabilityInventoryCommand: mocks.autonomyCapabilityInventoryCommand,
  autonomyCancelCommand: mocks.autonomyCancelCommand,
  autonomyGenesisPlanCommand: mocks.autonomyGenesisPlanCommand,
  autonomyGovernanceCommand: mocks.autonomyGovernanceCommand,
  autonomyGovernanceReconcileCommand: mocks.autonomyGovernanceReconcileCommand,
  autonomyHealCommand: mocks.autonomyHealCommand,
  autonomyHistoryCommand: mocks.autonomyHistoryCommand,
  autonomyListCommand: mocks.autonomyListCommand,
  autonomyOverviewCommand: mocks.autonomyOverviewCommand,
  autonomyReplaySubmitCommand: mocks.autonomyReplaySubmitCommand,
  autonomySuperviseCommand: mocks.autonomySuperviseCommand,
  autonomyLoopDisableCommand: mocks.autonomyLoopDisableCommand,
  autonomyLoopEnableCommand: mocks.autonomyLoopEnableCommand,
  autonomyLoopReconcileCommand: mocks.autonomyLoopReconcileCommand,
  autonomyLoopShowCommand: mocks.autonomyLoopShowCommand,
  autonomyShowCommand: mocks.autonomyShowCommand,
  autonomyStartCommand: mocks.autonomyStartCommand,
}));

vi.mock("../../commands/governance.js", () => ({
  governanceAgentCommand: mocks.governanceAgentCommand,
  governanceCapabilityAssetRegistryCommand: mocks.governanceCapabilityAssetRegistryCommand,
  governanceTeamCommand: mocks.governanceTeamCommand,
  governanceCapabilityInventoryCommand: mocks.governanceCapabilityInventoryCommand,
  governanceGenesisPlanCommand: mocks.governanceGenesisPlanCommand,
  governanceOverviewCommand: mocks.governanceOverviewCommand,
  governanceProposalsApplyCommand: mocks.governanceProposalsApplyCommand,
  governanceProposalsApplyManyCommand: mocks.governanceProposalsApplyManyCommand,
  governanceProposalsCreateCommand: mocks.governanceProposalsCreateCommand,
  governanceProposalsListCommand: mocks.governanceProposalsListCommand,
  governanceProposalsReconcileCommand: mocks.governanceProposalsReconcileCommand,
  governanceProposalsRevertCommand: mocks.governanceProposalsRevertCommand,
  governanceProposalsRevertManyCommand: mocks.governanceProposalsRevertManyCommand,
  governanceProposalsReviewCommand: mocks.governanceProposalsReviewCommand,
  governanceProposalsReviewManyCommand: mocks.governanceProposalsReviewManyCommand,
  governanceProposalsSynthesizeCommand: mocks.governanceProposalsSynthesizeCommand,
}));

vi.mock("../../commands/health.js", () => ({
  healthCommand: mocks.healthCommand,
}));

vi.mock("../../commands/sessions.js", () => ({
  sessionsCommand: mocks.sessionsCommand,
}));

vi.mock("../../commands/sessions-cleanup.js", () => ({
  sessionsCleanupCommand: mocks.sessionsCleanupCommand,
}));

vi.mock("../../commands/tasks.js", () => ({
  tasksListCommand: mocks.tasksListCommand,
  tasksAuditCommand: mocks.tasksAuditCommand,
  tasksMaintenanceCommand: mocks.tasksMaintenanceCommand,
  tasksShowCommand: mocks.tasksShowCommand,
  tasksNotifyCommand: mocks.tasksNotifyCommand,
  tasksCancelCommand: mocks.tasksCancelCommand,
}));

vi.mock("../../commands/flows.js", () => ({
  flowsListCommand: mocks.flowsListCommand,
  flowsShowCommand: mocks.flowsShowCommand,
  flowsCancelCommand: mocks.flowsCancelCommand,
}));

vi.mock("../../globals.js", () => ({
  setVerbose: mocks.setVerbose,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: mocks.runtime,
}));

describe("registerStatusHealthSessionsCommands", () => {
  async function runCli(args: string[]) {
    const program = new Command();
    registerStatusHealthSessionsCommands(program);
    await program.parseAsync(args, { from: "user" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    runtime.exit.mockImplementation(() => {});
    autonomyActivateCommand.mockResolvedValue(undefined);
    autonomyArchitectureReadinessCommand.mockResolvedValue(undefined);
    autonomyCapabilityInventoryCommand.mockResolvedValue(undefined);
    autonomyCancelCommand.mockResolvedValue(undefined);
    autonomyGenesisPlanCommand.mockResolvedValue(undefined);
    autonomyGovernanceCommand.mockResolvedValue(undefined);
    autonomyGovernanceReconcileCommand.mockResolvedValue(undefined);
    autonomyHealCommand.mockResolvedValue(undefined);
    autonomyHistoryCommand.mockResolvedValue(undefined);
    autonomyListCommand.mockResolvedValue(undefined);
    autonomyOverviewCommand.mockResolvedValue(undefined);
    autonomyReplaySubmitCommand.mockResolvedValue(undefined);
    autonomySuperviseCommand.mockResolvedValue(undefined);
    autonomyLoopDisableCommand.mockResolvedValue(undefined);
    autonomyLoopEnableCommand.mockResolvedValue(undefined);
    autonomyLoopReconcileCommand.mockResolvedValue(undefined);
    autonomyLoopShowCommand.mockResolvedValue(undefined);
    autonomyShowCommand.mockResolvedValue(undefined);
    autonomyStartCommand.mockResolvedValue(undefined);
    governanceAgentCommand.mockResolvedValue(undefined);
    governanceCapabilityAssetRegistryCommand.mockResolvedValue(undefined);
    governanceTeamCommand.mockResolvedValue(undefined);
    governanceCapabilityInventoryCommand.mockResolvedValue(undefined);
    governanceGenesisPlanCommand.mockResolvedValue(undefined);
    governanceOverviewCommand.mockResolvedValue(undefined);
    governanceProposalsApplyCommand.mockResolvedValue(undefined);
    governanceProposalsApplyManyCommand.mockResolvedValue(undefined);
    governanceProposalsCreateCommand.mockResolvedValue(undefined);
    governanceProposalsListCommand.mockResolvedValue(undefined);
    governanceProposalsReconcileCommand.mockResolvedValue(undefined);
    governanceProposalsRevertCommand.mockResolvedValue(undefined);
    governanceProposalsRevertManyCommand.mockResolvedValue(undefined);
    governanceProposalsReviewCommand.mockResolvedValue(undefined);
    governanceProposalsReviewManyCommand.mockResolvedValue(undefined);
    governanceProposalsSynthesizeCommand.mockResolvedValue(undefined);
    statusCommand.mockResolvedValue(undefined);
    healthCommand.mockResolvedValue(undefined);
    sessionsCommand.mockResolvedValue(undefined);
    sessionsCleanupCommand.mockResolvedValue(undefined);
    tasksListCommand.mockResolvedValue(undefined);
    tasksAuditCommand.mockResolvedValue(undefined);
    tasksMaintenanceCommand.mockResolvedValue(undefined);
    tasksShowCommand.mockResolvedValue(undefined);
    tasksNotifyCommand.mockResolvedValue(undefined);
    tasksCancelCommand.mockResolvedValue(undefined);
    flowsListCommand.mockResolvedValue(undefined);
    flowsShowCommand.mockResolvedValue(undefined);
    flowsCancelCommand.mockResolvedValue(undefined);
  });

  it("runs status command with timeout and debug-derived verbose", async () => {
    await runCli([
      "status",
      "--json",
      "--all",
      "--deep",
      "--usage",
      "--debug",
      "--timeout",
      "5000",
    ]);

    expect(setVerbose).toHaveBeenCalledWith(true);
    expect(statusCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        all: true,
        deep: true,
        usage: true,
        timeoutMs: 5000,
        verbose: true,
      }),
      runtime,
    );
  });

  it("rejects invalid status timeout without calling status command", async () => {
    await runCli(["status", "--timeout", "nope"]);

    expect(runtime.error).toHaveBeenCalledWith(
      "--timeout must be a positive integer (milliseconds)",
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(statusCommand).not.toHaveBeenCalled();
  });

  it("runs health command with parsed timeout", async () => {
    await runCli(["health", "--json", "--timeout", "2500", "--verbose"]);

    expect(setVerbose).toHaveBeenCalledWith(true);
    expect(healthCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        timeoutMs: 2500,
        verbose: true,
      }),
      runtime,
    );
  });

  it("rejects invalid health timeout without calling health command", async () => {
    await runCli(["health", "--timeout", "0"]);

    expect(runtime.error).toHaveBeenCalledWith(
      "--timeout must be a positive integer (milliseconds)",
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(healthCommand).not.toHaveBeenCalled();
  });

  it("runs sessions command with forwarded options", async () => {
    await runCli([
      "sessions",
      "--json",
      "--verbose",
      "--store",
      "/tmp/sessions.json",
      "--active",
      "120",
    ]);

    expect(setVerbose).toHaveBeenCalledWith(true);
    expect(sessionsCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        store: "/tmp/sessions.json",
        active: "120",
      }),
      runtime,
    );
  });

  it("runs sessions command with --agent forwarding", async () => {
    await runCli(["sessions", "--agent", "work"]);

    expect(sessionsCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "work",
        allAgents: false,
      }),
      runtime,
    );
  });

  it("runs sessions command with --all-agents forwarding", async () => {
    await runCli(["sessions", "--all-agents"]);

    expect(sessionsCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        allAgents: true,
      }),
      runtime,
    );
  });

  it("runs sessions cleanup subcommand with forwarded options", async () => {
    await runCli([
      "sessions",
      "cleanup",
      "--store",
      "/tmp/sessions.json",
      "--dry-run",
      "--enforce",
      "--fix-missing",
      "--active-key",
      "agent:main:main",
      "--json",
    ]);

    expect(sessionsCleanupCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        store: "/tmp/sessions.json",
        agent: undefined,
        allAgents: false,
        dryRun: true,
        enforce: true,
        fixMissing: true,
        activeKey: "agent:main:main",
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy history with filters", async () => {
    await runCli([
      "autonomy",
      "history",
      "founder",
      "--workspace",
      "/tmp/autonomy-a",
      "--workspace",
      "/tmp/autonomy-b",
      "--limit",
      "5",
      "--mode",
      "heal",
      "--source",
      "manual",
      "--json",
    ]);

    expect(autonomyHistoryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder"],
        workspaceDirs: ["/tmp/autonomy-a", "/tmp/autonomy-b"],
        limit: 5,
        mode: "heal",
        source: "manual",
        json: true,
      }),
      runtime,
    );
  });

  it("forwards parent-level all-agents to cleanup subcommand", async () => {
    await runCli(["sessions", "--all-agents", "cleanup", "--dry-run"]);

    expect(sessionsCleanupCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        allAgents: true,
      }),
      runtime,
    );
  });

  it("runs tasks list from the parent command", async () => {
    await runCli(["tasks", "--json", "--runtime", "acp", "--status", "running"]);

    expect(tasksListCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        runtime: "acp",
        status: "running",
      }),
      runtime,
    );
  });

  it("runs tasks show subcommand with lookup forwarding", async () => {
    await runCli(["tasks", "show", "run-123", "--json"]);

    expect(tasksShowCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: "run-123",
        json: true,
      }),
      runtime,
    );
  });

  it("runs tasks maintenance subcommand with apply forwarding", async () => {
    await runCli(["tasks", "--json", "maintenance", "--apply"]);

    expect(tasksMaintenanceCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        apply: true,
      }),
      runtime,
    );
  });

  it("runs tasks audit subcommand with filters", async () => {
    await runCli([
      "tasks",
      "--json",
      "audit",
      "--severity",
      "error",
      "--code",
      "stale_running",
      "--limit",
      "5",
    ]);

    expect(tasksAuditCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        severity: "error",
        code: "stale_running",
        limit: 5,
      }),
      runtime,
    );
  });

  it("routes tasks flow commands through the TaskFlow handlers", async () => {
    await runCli(["tasks", "flow", "list", "--json", "--status", "blocked"]);
    expect(flowsListCommand).toHaveBeenCalledWith(expect.any(Object), runtime);

    await runCli(["tasks", "flow", "show", "flow-123", "--json"]);
    expect(flowsShowCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: "flow-123",
      }),
      runtime,
    );

    await runCli(["tasks", "flow", "cancel", "flow-123"]);
    expect(flowsCancelCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: "flow-123",
      }),
      runtime,
    );
  });

  it("runs tasks notify subcommand with lookup and policy forwarding", async () => {
    await runCli(["tasks", "notify", "run-123", "state_changes"]);

    expect(tasksNotifyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: "run-123",
        notify: "state_changes",
      }),
      runtime,
    );
  });

  it("runs tasks cancel subcommand with lookup forwarding", async () => {
    await runCli(["tasks", "cancel", "run-123"]);

    expect(tasksCancelCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup: "run-123",
      }),
      runtime,
    );
  });

  it("runs autonomy list from the parent command", async () => {
    await runCli(["autonomy", "--json", "--session-key", "agent:control:main"]);

    expect(autonomyListCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        sessionKey: "agent:control:main",
      }),
      runtime,
    );
  });

  it("runs governance overview from the parent command", async () => {
    await runCli(["governance", "--json"]);

    expect(governanceOverviewCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance agent with the forwarded agent id", async () => {
    await runCli(["governance", "agent", "founder", "--json"]);

    expect(governanceAgentCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "founder",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance team with the forwarded team id", async () => {
    await runCli(["governance", "team", "genesis_team", "--json"]);

    expect(governanceTeamCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "genesis_team",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance capabilities with forwarded scope", async () => {
    await runCli([
      "governance",
      "capabilities",
      "founder",
      "librarian",
      "--workspace",
      "/tmp/workspace-a",
      "--workspace",
      "/tmp/workspace-b",
      "--json",
    ]);

    expect(governanceCapabilityInventoryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "librarian"],
        workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance genesis plan with forwarded scope", async () => {
    await runCli([
      "governance",
      "genesis-plan",
      "founder",
      "--team-id",
      "genesis_team",
      "--workspace",
      "/tmp/workspace-a",
      "--json",
    ]);

    expect(governanceGenesisPlanCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder"],
        teamId: "genesis_team",
        workspaceDirs: ["/tmp/workspace-a"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals list from the parent command", async () => {
    await runCli(["governance", "proposals", "--status", "pending", "--limit", "5", "--json"]);

    expect(governanceProposalsListCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        limit: 5,
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals create with forwarded operation input", async () => {
    await runCli([
      "governance",
      "proposals",
      "create",
      "--title",
      "Create founder charter",
      "--created-by-agent",
      "founder",
      "--ops-file",
      "./proposal.json",
      "--json",
    ]);

    expect(governanceProposalsCreateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Create founder charter",
        createdByAgentId: "founder",
        operationsFile: "./proposal.json",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals reconcile with forwarded control-plane inputs", async () => {
    await runCli([
      "governance",
      "proposals",
      "reconcile",
      "founder",
      "librarian",
      "--workspace",
      "/tmp/workspace-a",
      "--workspace",
      "/tmp/workspace-b",
      "--mode",
      "force_apply_all",
      "--created-by-agent",
      "founder",
      "--created-by-session",
      "agent:founder:main",
      "--decided-by",
      "founder",
      "--note",
      "Escalate all deterministic governance repairs.",
      "--applied-by",
      "founder",
      "--json",
    ]);

    expect(governanceProposalsReconcileCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "librarian"],
        workspaceDirs: ["/tmp/workspace-a", "/tmp/workspace-b"],
        mode: "force_apply_all",
        createdByAgentId: "founder",
        createdBySessionKey: "agent:founder:main",
        decidedBy: "founder",
        decisionNote: "Escalate all deterministic governance repairs.",
        appliedBy: "founder",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals review with forwarded decision input", async () => {
    await runCli([
      "governance",
      "proposals",
      "review",
      "gpr-1",
      "--decision",
      "approve",
      "--decided-by",
      "architect",
      "--note",
      "Ship it",
      "--json",
    ]);

    expect(governanceProposalsReviewCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "gpr-1",
        decision: "approve",
        decidedBy: "architect",
        decisionNote: "Ship it",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals review-many with forwarded batch selection", async () => {
    await runCli([
      "governance",
      "proposals",
      "review-many",
      "--status",
      "pending",
      "--limit",
      "3",
      "--decision",
      "approve",
      "--decided-by",
      "architect",
      "--fail-fast",
      "--json",
    ]);

    expect(governanceProposalsReviewManyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        limit: 3,
        decision: "approve",
        decidedBy: "architect",
        continueOnError: false,
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals apply with forwarded actor input", async () => {
    await runCli([
      "governance",
      "proposals",
      "apply",
      "gpr-1",
      "--applied-by",
      "architect",
      "--json",
    ]);

    expect(governanceProposalsApplyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "gpr-1",
        appliedBy: "architect",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals apply-many with explicit proposal ids", async () => {
    await runCli([
      "governance",
      "proposals",
      "apply-many",
      "gpr-1",
      "gpr-2",
      "--applied-by",
      "architect",
      "--json",
    ]);

    expect(governanceProposalsApplyManyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalIds: ["gpr-1", "gpr-2"],
        appliedBy: "architect",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals revert with forwarded actor input", async () => {
    await runCli([
      "governance",
      "proposals",
      "revert",
      "gpr-1",
      "--reverted-by",
      "architect",
      "--json",
    ]);

    expect(governanceProposalsRevertCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "gpr-1",
        revertedBy: "architect",
        json: true,
      }),
      runtime,
    );
  });

  it("runs governance proposals revert-many with forwarded batch filters", async () => {
    await runCli([
      "governance",
      "proposals",
      "revert-many",
      "--status",
      "applied",
      "--limit",
      "2",
      "--reverted-by",
      "architect",
      "--fail-fast",
      "--json",
    ]);

    expect(governanceProposalsRevertManyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "applied",
        limit: 2,
        revertedBy: "architect",
        continueOnError: false,
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy show with forwarded agent id", async () => {
    await runCli(["autonomy", "show", "founder", "--json"]);

    expect(autonomyShowCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "founder",
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy overview with forwarded profile set", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "overview",
      "founder",
      "strategist",
      "--workspace",
      "/tmp/overview-a",
      "--workspace",
      "/tmp/overview-b",
      "--json",
    ]);

    expect(autonomyOverviewCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/overview-a", "/tmp/overview-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy heal with the forwarded profile set", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "heal",
      "founder",
      "strategist",
      "--workspace",
      "/tmp/fleet-a",
      "--workspace",
      "/tmp/fleet-b",
      "--json",
    ]);

    expect(autonomyHealCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/fleet-a", "/tmp/fleet-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy supervise with the forwarded governance and refresh controls", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "supervise",
      "founder",
      "strategist",
      "--team-id",
      "genesis_team",
      "--workspace",
      "/tmp/fleet-a",
      "--workspace",
      "/tmp/fleet-b",
      "--governance-mode",
      "force_apply_all",
      "--note",
      "Escalate the supervisor pass.",
      "--no-restart-blocked",
      "--no-capabilities",
      "--no-genesis",
      "--no-history",
      "--json",
    ]);

    expect(autonomySuperviseCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        teamId: "genesis_team",
        workspaceDirs: ["/tmp/fleet-a", "/tmp/fleet-b"],
        governanceMode: "force_apply_all",
        decisionNote: "Escalate the supervisor pass.",
        restartBlockedFlows: false,
        includeCapabilityInventory: false,
        includeGenesisPlan: false,
        recordHistory: false,
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy bootstrap with the forwarded governance and readiness controls", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "bootstrap",
      "founder",
      "strategist",
      "--team-id",
      "genesis_team",
      "--workspace",
      "/tmp/fleet-a",
      "--workspace",
      "/tmp/fleet-b",
      "--governance-mode",
      "apply_safe",
      "--note",
      "Prepare continuous autonomy.",
      "--no-restart-blocked",
      "--no-capabilities",
      "--no-genesis",
      "--no-history",
      "--json",
    ]);

    expect(autonomyBootstrapCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        teamId: "genesis_team",
        workspaceDirs: ["/tmp/fleet-a", "/tmp/fleet-b"],
        governanceMode: "apply_safe",
        decisionNote: "Prepare continuous autonomy.",
        restartBlockedFlows: false,
        includeCapabilityInventory: false,
        includeGenesisPlan: false,
        recordHistory: false,
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy activate with governed maximum-autonomy defaults", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "activate",
      "founder",
      "strategist",
      "--team-id",
      "genesis_team",
      "--workspace",
      "/tmp/fleet-a",
      "--workspace",
      "/tmp/fleet-b",
      "--note",
      "Activate governed maximum autonomy.",
      "--json",
    ]);

    expect(autonomyActivateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        teamId: "genesis_team",
        workspaceDirs: ["/tmp/fleet-a", "/tmp/fleet-b"],
        governanceMode: "apply_safe",
        decisionNote: "Activate governed maximum autonomy.",
        restartBlockedFlows: true,
        includeCapabilityInventory: true,
        includeGenesisPlan: true,
        recordHistory: true,
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy capabilities with forwarded workspace scope", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "capabilities",
      "founder",
      "strategist",
      "--workspace",
      "/tmp/cap-a",
      "--workspace",
      "/tmp/cap-b",
      "--json",
    ]);

    expect(autonomyCapabilityInventoryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/cap-a", "/tmp/cap-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy genesis-plan with forwarded workspace scope and team", async () => {
    await runCli([
      "autonomy",
      "genesis-plan",
      "founder",
      "--team-id",
      "genesis",
      "--workspace",
      "/tmp/genesis-a",
      "--workspace",
      "/tmp/genesis-b",
      "--json",
    ]);

    expect(autonomyGenesisPlanCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder"],
        teamId: "genesis",
        workspaceDirs: ["/tmp/genesis-a", "/tmp/genesis-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy start with override options", async () => {
    await runCli([
      "autonomy",
      "start",
      "strategist",
      "--goal",
      "Review strategy failures",
      "--controller-id",
      "runtime.autonomy/strategist/manual",
      "--current-step",
      "review-history",
      "--workspace",
      "/tmp/flow-a",
      "--workspace",
      "/tmp/flow-b",
      "--notify",
      "silent",
      "--status",
      "queued",
      "--seed-runtime",
      "cli",
      "--seed-status",
      "running",
      "--seed-label",
      "Manual seed",
      "--seed-body",
      "Seed task body",
      "--no-seed-task",
      "--json",
    ]);

    expect(autonomyStartCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "strategist",
        json: true,
        goal: "Review strategy failures",
        controllerId: "runtime.autonomy/strategist/manual",
        currentStep: "review-history",
        workspaceDirs: ["/tmp/flow-a", "/tmp/flow-b"],
        notifyPolicy: "silent",
        status: "queued",
        seedTaskEnabled: false,
        seedTaskRuntime: "cli",
        seedTaskStatus: "running",
        seedTaskLabel: "Manual seed",
        seedTaskTask: "Seed task body",
      }),
      runtime,
    );
  });

  it("runs autonomy cancel with the forwarded flow id", async () => {
    await runCli([
      "autonomy",
      "cancel",
      "founder",
      "--flow-id",
      "flow-123",
      "--session-key",
      "agent:founder:thread-9",
      "--json",
    ]);

    expect(autonomyCancelCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "founder",
        flowId: "flow-123",
        sessionKey: "agent:founder:thread-9",
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy replay submit with explicit verdicts", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:librarian:main",
      "replay",
      "submit",
      "librarian",
      "--flow-id",
      "flow-123",
      "--replay",
      "pass",
      "--qa",
      "fail",
      "--audit",
      "pass",
      "--json",
    ]);

    expect(autonomyReplaySubmitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "librarian",
        sessionKey: "agent:librarian:main",
        flowId: "flow-123",
        replayPassed: true,
        qaPassed: false,
        auditPassed: true,
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy loop show with forwarded session key", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:founder:thread-9",
      "loop",
      "show",
      "founder",
      "--json",
    ]);

    expect(autonomyLoopShowCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "founder",
        sessionKey: "agent:founder:thread-9",
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy loop enable with forwarded interval", async () => {
    await runCli([
      "autonomy",
      "loop",
      "enable",
      "strategist",
      "--every-ms",
      "7200000",
      "--workspace",
      "/tmp/loop-a",
      "--workspace",
      "/tmp/loop-b",
      "--json",
    ]);

    expect(autonomyLoopEnableCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "strategist",
        everyMs: 7_200_000,
        workspaceDirs: ["/tmp/loop-a", "/tmp/loop-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy loop reconcile for the provided profile set", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "loop",
      "reconcile",
      "founder",
      "strategist",
      "--workspace",
      "/tmp/reconcile-a",
      "--workspace",
      "/tmp/reconcile-b",
      "--json",
    ]);

    expect(autonomyLoopReconcileCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "strategist"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/reconcile-a", "/tmp/reconcile-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy governance with workspace scope forwarding", async () => {
    await runCli([
      "autonomy",
      "governance",
      "founder",
      "--workspace",
      "/tmp/governance-a",
      "--workspace",
      "/tmp/governance-b",
      "--json",
    ]);

    expect(autonomyGovernanceCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder"],
        workspaceDirs: ["/tmp/governance-a", "/tmp/governance-b"],
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy governance-reconcile with workspace scope and reconcile mode forwarding", async () => {
    await runCli([
      "autonomy",
      "--session-key",
      "agent:control:main",
      "governance-reconcile",
      "founder",
      "librarian",
      "--workspace",
      "/tmp/governance-a",
      "--workspace",
      "/tmp/governance-b",
      "--mode",
      "apply_safe",
      "--note",
      "Auto-apply safe governance repairs.",
      "--json",
    ]);

    expect(autonomyGovernanceReconcileCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ["founder", "librarian"],
        sessionKey: "agent:control:main",
        workspaceDirs: ["/tmp/governance-a", "/tmp/governance-b"],
        mode: "apply_safe",
        decisionNote: "Auto-apply safe governance repairs.",
        json: true,
      }),
      runtime,
    );
  });

  it("runs autonomy loop disable with forwarded job id", async () => {
    await runCli([
      "autonomy",
      "loop",
      "disable",
      "librarian",
      "--job-id",
      "loop-job-7",
      "--json",
    ]);

    expect(autonomyLoopDisableCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "librarian",
        jobId: "loop-job-7",
        json: true,
      }),
      runtime,
    );
  });

  it("does not register the legacy top-level flows command", () => {
    const program = new Command();
    registerStatusHealthSessionsCommands(program);

    expect(program.commands.find((command) => command.name() === "flows")).toBeUndefined();
  });
});
