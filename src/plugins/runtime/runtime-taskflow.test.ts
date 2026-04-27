import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTaskFlowById } from "../../tasks/task-flow-registry.js";
import { getTaskById } from "../../tasks/task-registry.js";
import {
  installRuntimeTaskDeliveryMock,
  resetRuntimeTaskTestState,
} from "./runtime-task-test-harness.js";
import { createRuntimeTaskFlow } from "./runtime-taskflow.js";

afterEach(() => {
  resetRuntimeTaskTestState({ persist: false });
});

describe("runtime TaskFlow", () => {
  beforeEach(() => {
    installRuntimeTaskDeliveryMock();
  });

  it("binds managed TaskFlow operations to a session key", () => {
    const runtime = createRuntimeTaskFlow();
    const taskFlow = runtime.bindSession({
      sessionKey: "agent:main:main",
      requesterOrigin: {
        channel: "telegram",
        to: "telegram:123",
      },
    });

    const created = taskFlow.createManaged({
      controllerId: "tests/runtime-taskflow",
      goal: "Triage inbox",
      currentStep: "classify",
      stateJson: { lane: "inbox" },
    });

    expect(created).toMatchObject({
      syncMode: "managed",
      ownerKey: "agent:main:main",
      controllerId: "tests/runtime-taskflow",
      requesterOrigin: {
        channel: "telegram",
        to: "telegram:123",
      },
      goal: "Triage inbox",
    });
    expect(taskFlow.get(created.flowId)?.flowId).toBe(created.flowId);
    expect(taskFlow.findLatest()?.flowId).toBe(created.flowId);
    expect(taskFlow.resolve("agent:main:main")?.flowId).toBe(created.flowId);
  });

  it("binds TaskFlows from trusted tool context", () => {
    const runtime = createRuntimeTaskFlow();
    const taskFlow = runtime.fromToolContext({
      sessionKey: "agent:main:main",
      deliveryContext: {
        channel: "discord",
        to: "channel:123",
        threadId: "thread:456",
      },
    });

    const created = taskFlow.createManaged({
      controllerId: "tests/runtime-taskflow",
      goal: "Review queue",
    });

    expect(created.requesterOrigin).toMatchObject({
      channel: "discord",
      to: "channel:123",
      threadId: "thread:456",
    });
  });

  it("rejects tool contexts without a bound session key", () => {
    const runtime = createRuntimeTaskFlow();
    expect(() =>
      runtime.fromToolContext({
        sessionKey: undefined,
        deliveryContext: undefined,
      }),
    ).toThrow("TaskFlow runtime requires tool context with a sessionKey.");
  });

  it("keeps TaskFlow reads owner-scoped and runs child tasks under the bound TaskFlow", () => {
    const runtime = createRuntimeTaskFlow();
    const ownerTaskFlow = runtime.bindSession({
      sessionKey: "agent:main:main",
    });
    const otherTaskFlow = runtime.bindSession({
      sessionKey: "agent:main:other",
    });

    const created = ownerTaskFlow.createManaged({
      controllerId: "tests/runtime-taskflow",
      goal: "Inspect PR batch",
    });

    expect(otherTaskFlow.get(created.flowId)).toBeUndefined();
    expect(otherTaskFlow.list()).toEqual([]);

    const child = ownerTaskFlow.runTask({
      flowId: created.flowId,
      runtime: "acp",
      childSessionKey: "agent:main:subagent:child",
      runId: "runtime-taskflow-child",
      task: "Inspect PR 1",
      status: "running",
      startedAt: 10,
      lastEventAt: 10,
    });

    expect(child).toMatchObject({
      created: true,
      flow: expect.objectContaining({
        flowId: created.flowId,
      }),
      task: expect.objectContaining({
        parentFlowId: created.flowId,
        ownerKey: "agent:main:main",
        runId: "runtime-taskflow-child",
      }),
    });
    if (!child.created) {
      throw new Error("expected child task creation to succeed");
    }
    expect(getTaskById(child.task.taskId)).toMatchObject({
      parentFlowId: created.flowId,
      ownerKey: "agent:main:main",
    });
    expect(getTaskFlowById(created.flowId)).toMatchObject({
      flowId: created.flowId,
    });
    expect(ownerTaskFlow.getTaskSummary(created.flowId)).toMatchObject({
      total: 1,
      active: 1,
    });
  });

  it("projects managed autonomy and execution state through first-class runtime helpers", () => {
    const runtime = createRuntimeTaskFlow();
    const taskFlow = runtime.bindSession({
      sessionKey: "agent:main:managed-execution",
    });

    const created = taskFlow.createManaged({
      controllerId: "runtime.autonomy/executor",
      goal: "Deliver the governed outcome",
      currentStep: "execution.goal_intake",
      stateJson: {
        autonomy: {
          agentId: "executor",
          controllerId: "runtime.autonomy/executor",
          goal: "Deliver the governed outcome",
          currentStep: "execution.goal_intake",
          workspaceDirs: ["/tmp/workspace"],
          primaryWorkspaceDir: "/tmp/workspace",
        },
      },
    });

    expect(taskFlow.getManagedAutonomy(created.flowId)).toMatchObject({
      agentId: "executor",
      controllerId: "runtime.autonomy/executor",
      workspaceDirs: ["/tmp/workspace"],
    });

    const updated = taskFlow.setManagedExecution({
      flowId: created.flowId,
      expectedRevision: created.revision,
      currentStep: "execution.capability_selection",
      execution: {
        kind: "execution_system",
        goalContract: {
          goal: "Deliver the governed outcome",
          layer: "execution",
          authorityLevel: "high",
        },
        taskGraph: [
          {
            id: "goal_intake",
            title: "Goal Intake",
            dependsOn: [],
            output: "goal_contract",
          },
          {
            id: "capability_selection",
            title: "Capability Selection",
            dependsOn: ["goal_intake"],
            output: "execution_plan",
          },
        ],
        executionPlan: {
          phases: [
            {
              id: "goal_intake",
              title: "Goal Intake",
              dependsOn: [],
              output: "goal_contract",
            },
            {
              id: "capability_selection",
              title: "Capability Selection",
              dependsOn: ["goal_intake"],
              output: "execution_plan",
            },
          ],
          runtimeHooks: ["src/tasks/task-registry.ts"],
          collaborators: ["qa", "librarian"],
        },
        capabilityRequest: {
          status: "recommended",
          focusGapIds: ["capability_inventory.skills_missing"],
          handoffTeamId: "genesis_team",
          reason: "delivery confidence is reduced without additional governed skills",
          blockers: [],
        },
        observedCapabilityGaps: ["capability_inventory.skills_missing: No governed skill assets"],
        genesisPlan: {
          teamId: "genesis_team",
          mode: "repair",
          focusGapIds: ["capability_inventory.skills_missing"],
          blockers: [],
        },
      },
    });

    expect(updated.applied).toBe(true);
    if (!updated.applied) {
      throw new Error("expected execution projection update to apply");
    }
    expect(taskFlow.getManagedExecution(created.flowId)).toMatchObject({
      kind: "execution_system",
      capabilityRequest: {
        handoffTeamId: "genesis_team",
      },
      executionPlan: {
        collaborators: ["qa", "librarian"],
      },
    });
    expect(getTaskFlowById(created.flowId)?.currentStep).toBe("execution.capability_selection");
  });
});
