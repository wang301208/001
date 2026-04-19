import { createManagedTaskFlow, resetTaskFlowRegistryForTests, setFlowWaiting, finishFlow, failFlow } from "./src/tasks/task-flow-registry.ts";
const created = createManagedTaskFlow({ ownerKey: "agent:main:main", controllerId: "tests/continuation-defaults", goal: "Continue a blocked workflow" });
const waiting = setFlowWaiting({ flowId: created.flowId, expectedRevision: created.revision, waitJson: { kind: "external_input" } });
const finished = finishFlow({ flowId: created.flowId, expectedRevision: 1 });
const failed = failFlow({ flowId: created.flowId, expectedRevision: 2 });
console.log(JSON.stringify({ created, waiting, finished, failed }, null, 2));
resetTaskFlowRegistryForTests();
