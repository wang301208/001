import { createManagedTaskFlow, getTaskFlowById, resetTaskFlowRegistryForTests } from "./src/tasks/task-flow-registry.ts";
import { createRunningTaskRun } from "./src/tasks/task-executor.ts";
import { findLatestTaskForFlowId, markTaskTerminalById, resetTaskRegistryDeliveryRuntimeForTests, resetTaskRegistryForTests } from "./src/tasks/task-registry.ts";
const flow = createManagedTaskFlow({ ownerKey: "agent:main:main", controllerId: "tests/task-registry", goal: "Retry blocked work", status: "running", createdAt: 100, updatedAt: 100 });
const child = createRunningTaskRun({ runtime: "acp", ownerKey: "agent:main:main", scopeKind: "session", parentFlowId: flow.flowId, childSessionKey: "agent:main:child", runId: "run-registry-blocked", label: "Inspect PR 123", task: "Inspect PR 123", startedAt: 100, lastEventAt: 100 });
markTaskTerminalById({ taskId: child.taskId, status: "succeeded", terminalOutcome: "blocked", endedAt: 150, terminalSummary: "Writable session required." });
console.log(JSON.stringify({ flow: getTaskFlowById(flow.flowId), latest: findLatestTaskForFlowId(flow.flowId) }, null, 2));
resetTaskRegistryDeliveryRuntimeForTests(); resetTaskRegistryForTests({ persist: false }); resetTaskFlowRegistryForTests({ persist: false });
