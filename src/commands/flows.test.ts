import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import { createRunningTaskRun } from "../tasks/task-executor.js";
import {
  createManagedTaskFlow,
  resetTaskFlowRegistryForTests,
} from "../tasks/task-flow-registry.js";
import {
  resetTaskRegistryDeliveryRuntimeForTests,
  resetTaskRegistryForTests,
} from "../tasks/task-registry.js";
import { withTempDir } from "../test-helpers/temp-dir.js";
import {
  flowsCancelCommand,
  flowsListCommand,
  flowsRetryCommand,
  flowsShowCommand,
  shouldAutoRetryBlockedFlow,
} from "./flows.js";

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
}));

const ORIGINAL_STATE_DIR = process.env.ZHUSHOU_STATE_DIR;

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

async function withTaskFlowCommandStateDir(run: (root: string) => Promise<void>): Promise<void> {
  await withTempDir({ prefix: "zhushou-flows-command-" }, async (root) => {
    process.env.ZHUSHOU_STATE_DIR = root;
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
    try {
      await run(root);
    } finally {
      resetTaskRegistryDeliveryRuntimeForTests();
      resetTaskRegistryForTests({ persist: false });
      resetTaskFlowRegistryForTests({ persist: false });
    }
  });
}

describe("flows commands", () => {
  afterEach(() => {
    if (ORIGINAL_STATE_DIR === undefined) {
      delete process.env.ZHUSHOU_STATE_DIR;
    } else {
      process.env.ZHUSHOU_STATE_DIR = ORIGINAL_STATE_DIR;
    }
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
  });

  it("lists TaskFlows as JSON with linked tasks and summaries", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Inspect a PR cluster",
        status: "blocked",
        blockedSummary: "Waiting on child task",
        createdAt: 100,
        updatedAt: 100,
      });

      createRunningTaskRun({
        runtime: "acp",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        parentFlowId: flow.flowId,
        childSessionKey: "agent:main:child",
        runId: "run-child-1",
        label: "Inspect PR 123",
        task: "Inspect PR 123",
        startedAt: 100,
        lastEventAt: 100,
      });

      const runtime = createRuntime();
      await flowsListCommand({ json: true, status: "blocked" }, runtime);

      const payload = JSON.parse(String(vi.mocked(runtime.log).mock.calls[0]?.[0])) as {
        count: number;
        status: string | null;
        flows: Array<{
          flowId: string;
          continuationDecision?: { action: string; reason: string; autoRetryEligible?: boolean };
          tasks: Array<{ runId?: string; label?: string }>;
          taskSummary: { total: number; active: number };
        }>;
      };

      expect(payload).toMatchObject({
        count: 1,
        status: "blocked",
        flows: [
          {
            flowId: flow.flowId,
            continuationDecision: {
              action: "report",
              reason:
                "Waiting on child task Auto-retry is not allowed for this blocker; review and intervene manually.",
              autoRetryEligible: false,
            },
            taskSummary: {
              total: 1,
              active: 1,
            },
            tasks: [
              {
                runId: "run-child-1",
                label: "Inspect PR 123",
              },
            ],
          },
        ],
      });
    });
  });

  it("shows one TaskFlow with linked task details in text mode", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Investigate a flaky queue",
        status: "blocked",
        currentStep: "spawn_child",
        blockedSummary: "Waiting on child task output",
        createdAt: 100,
        updatedAt: 100,
      });

      createRunningTaskRun({
        runtime: "subagent",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        parentFlowId: flow.flowId,
        childSessionKey: "agent:main:child",
        runId: "run-child-2",
        label: "Collect logs",
        task: "Collect logs",
        startedAt: 100,
        lastEventAt: 100,
      });

      const runtime = createRuntime();
      await flowsShowCommand({ lookup: flow.flowId, json: false }, runtime);

      const output = vi
        .mocked(runtime.log)
        .mock.calls.map(([line]) => String(line))
        .join("\n");
      expect(output).toContain("TaskFlow:");
      expect(output).toContain(`flowId: ${flow.flowId}`);
      expect(output).toContain("status: blocked");
      expect(output).toContain("goal: Investigate a flaky queue");
      expect(output).toContain("currentStep: spawn_child");
      expect(output).toContain("nextAction: resume");
      expect(output).toContain("nextReason: Waiting on child task output Auto-retry is allowed for this blocker.");
      expect(output).toContain("autoRetryEligible: yes");
      expect(output).toContain("owner: agent:main:main");
      expect(output).toContain("state: Waiting on child task output");
      expect(output).toContain("Linked tasks:");
      expect(output).toContain("run-child-2");
      expect(output).toContain("Collect logs");
      expect(output).not.toContain("syncMode:");
      expect(output).not.toContain("controllerId:");
      expect(output).not.toContain("revision:");
      expect(output).not.toContain("blockedTaskId:");
      expect(output).not.toContain("blockedSummary:");
      expect(output).not.toContain("wait:");
    });
  });

  it("sanitizes TaskFlow text output before printing to the terminal", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const unsafeOwnerKey = "agent:main:\u001b[31mowner";
      const flow = createManagedTaskFlow({
        ownerKey: unsafeOwnerKey,
        controllerId: "tests/flows-command",
        goal: "Investigate\nqueue\tstate",
        status: "blocked",
        currentStep: "spawn\u001b[2K_child",
        blockedSummary: "Waiting\u001b[31m on child\nforged: yes",
        createdAt: 100,
        updatedAt: 100,
      });

      createRunningTaskRun({
        runtime: "subagent",
        ownerKey: unsafeOwnerKey,
        scopeKind: "session",
        parentFlowId: flow.flowId,
        childSessionKey: "agent:main:child",
        runId: "run-child-3",
        label: "Collect\nlogs\u001b[2K",
        task: "Collect logs",
        startedAt: 100,
        lastEventAt: 100,
      });

      const runtime = createRuntime();
      await flowsShowCommand({ lookup: flow.flowId, json: false }, runtime);

      const lines = vi.mocked(runtime.log).mock.calls.map(([line]) => String(line));
      expect(lines).toContain("goal: Investigate\\nqueue\\tstate");
      expect(lines).toContain("currentStep: spawn_child");
      expect(lines).toContain("owner: agent:main:owner");
      expect(lines).toContain("state: Waiting on child\\nforged: yes");
      expect(
        lines.some((line) => line.includes("run-child-3") && line.includes("Collect\\nlogs")),
      ).toBe(true);
      expect(lines.join("\n")).not.toContain("\u001b[");
    });
  });

  it("retries a blocked TaskFlow as a queued child task", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Retry blocked work",
        status: "blocked",
        blockedSummary: "Writable session required.",
        createdAt: 100,
        updatedAt: 100,
      });

      const blockedTask = createRunningTaskRun({
        runtime: "acp",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        parentFlowId: flow.flowId,
        childSessionKey: "agent:main:child",
        runId: "run-blocked-child",
        label: "Inspect PR 123",
        task: "Inspect PR 123",
        startedAt: 100,
        lastEventAt: 100,
      });

      const runtime = createRuntime();
      // Simulate a blocked terminal child before retrying.
      const { markTaskTerminalById } = await import("../tasks/task-registry.js");
      markTaskTerminalById({
        taskId: blockedTask.taskId,
        status: "succeeded",
        terminalOutcome: "blocked",
        endedAt: 150,
        terminalSummary: "Writable session required.",
      });

      await flowsRetryCommand({ lookup: flow.flowId }, runtime);

      expect(vi.mocked(runtime.error)).not.toHaveBeenCalled();
      expect(vi.mocked(runtime.exit)).not.toHaveBeenCalled();
      const output = String(vi.mocked(runtime.log).mock.calls[0]?.[0]);
      expect(output).toContain("Retried");
      expect(output).toContain(flow.flowId);
      expect(output).toContain("queued task");
      expect(output).toContain("status queued");
    });
  });

  it("detects when a blocked flow is eligible for automatic retry", () => {
    const retryable = createManagedTaskFlow({
      ownerKey: "agent:main:main",
      controllerId: "tests/flows-command",
      goal: "Retry blocked work",
      status: "blocked",
      blockedSummary: "Writable session required.",
      createdAt: 100,
      updatedAt: 100,
    });
    const exhausted = createManagedTaskFlow({
      ownerKey: "agent:main:main",
      controllerId: "tests/flows-command",
      goal: "Retry blocked work",
      status: "blocked",
      blockedSummary: "Writable session required.",
      stateJson: {
        autoRetry: {
          attempts: 2,
        },
      },
      createdAt: 101,
      updatedAt: 101,
    });
    const nonRetryableReason = createManagedTaskFlow({
      ownerKey: "agent:main:main",
      controllerId: "tests/flows-command",
      goal: "Retry blocked work",
      status: "blocked",
      blockedSummary: "Waiting on child task output.",
      createdAt: 102,
      updatedAt: 102,
    });
    const waiting = createManagedTaskFlow({
      ownerKey: "agent:main:main",
      controllerId: "tests/flows-command",
      goal: "Wait for external input",
      status: "waiting",
      currentStep: "Waiting for webhook",
      createdAt: 103,
      updatedAt: 103,
    });

    expect(shouldAutoRetryBlockedFlow(retryable)).toBe(true);
    expect(shouldAutoRetryBlockedFlow(exhausted)).toBe(false);
    expect(shouldAutoRetryBlockedFlow(nonRetryableReason)).toBe(false);
    expect(shouldAutoRetryBlockedFlow(waiting)).toBe(false);
  });

  it("reports budget exhaustion in the continuation reason for blocked flows", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Retry blocked work",
        status: "blocked",
        blockedSummary: "Writable session required.",
        stateJson: {
          autoRetry: {
            attempts: 2,
          },
        },
        createdAt: 100,
        updatedAt: 100,
      });

      const runtime = createRuntime();
      await flowsShowCommand({ lookup: flow.flowId, json: false }, runtime);

      const output = vi
        .mocked(runtime.log)
        .mock.calls.map(([line]) => String(line))
        .join("\n");
      expect(output).toContain("nextAction: report");
      expect(output).toContain("autoRetryEligible: no");
      expect(output).toContain("Auto-retry budget exhausted; report or intervene manually.");
    });
  });

  it("reports non-retryable blockers for manual intervention", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Wait for child output",
        status: "blocked",
        blockedSummary: "Waiting on child task output.",
        createdAt: 100,
        updatedAt: 100,
      });

      const runtime = createRuntime();
      await flowsShowCommand({ lookup: flow.flowId, json: false }, runtime);

      const output = vi
        .mocked(runtime.log)
        .mock.calls.map(([line]) => String(line))
        .join("\n");
      expect(output).toContain("nextAction: report");
      expect(output).toContain("autoRetryEligible: no");
      expect(output).toContain("Auto-retry is not allowed for this blocker; review and intervene manually.");
    });
  });

  it("cancels a managed TaskFlow with no active children", async () => {
    await withTaskFlowCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/flows-command",
        goal: "Stop detached work",
        status: "running",
        createdAt: 100,
        updatedAt: 100,
      });

      const runtime = createRuntime();
      await flowsCancelCommand({ lookup: flow.flowId }, runtime);

      expect(vi.mocked(runtime.error)).not.toHaveBeenCalled();
      expect(vi.mocked(runtime.exit)).not.toHaveBeenCalled();
      expect(String(vi.mocked(runtime.log).mock.calls[0]?.[0])).toContain("Cancelled");
      expect(String(vi.mocked(runtime.log).mock.calls[0]?.[0])).toContain(flow.flowId);
      expect(String(vi.mocked(runtime.log).mock.calls[0]?.[0])).toContain("cancelled");
    });
  });
});
