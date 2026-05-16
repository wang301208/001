import type { EventBus } from "../event-bus/bus.js";

export type DagNode = {
  id: string;
  type: "llm-call" | "tool-call" | "condition" | "parallel" | "transform" | "output" | "retry" | "fallback";
  config: Record<string, unknown>;
  dependencies: string[];
  timeoutMs?: number;
  retryConfig?: { maxRetries: number; delayMs: number; backoff?: "linear" | "exponential" };
  fallbackNode?: string;
};

export type DagExecution = {
  id: string;
  dagId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "partial";
  results: Map<string, unknown>;
  errors: Map<string, string>;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  nodeStatus: Map<string, "pending" | "running" | "completed" | "failed" | "skipped">;
  retryCount: Map<string, number>;
};

export type DagDefinition = {
  id: string;
  name: string;
  description?: string;
  nodes: DagNode[];
  entryPoint: string;
};

export type AgentDagEngine = {
  defineDag(dag: Omit<DagDefinition, "id">): string;
  execute(dagId: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<DagExecution>;
  cancel(executionId: string): void;
  getDag(dagId: string): DagDefinition | undefined;
  listDags(): DagDefinition[];
  getExecution(executionId: string): DagExecution | undefined;
  getStats(): { totalDags: number; totalExecutions: number; activeExecutions: number; completedExecutions: number; failedExecutions: number };
};

export function createAgentDagEngine(
  executor?: (node: DagNode, inputs: Map<string, unknown>) => Promise<unknown>,
  eventBus?: EventBus,
): AgentDagEngine {
  const dags = new Map<string, DagDefinition>();
  const executions = new Map<string, DagExecution>();
  let totalCompleted = 0;
  let totalFailed = 0;

  const defaultExecutor = async (node: DagNode, inputs: Map<string, unknown>): Promise<unknown> => {
    switch (node.type) {
      case "llm-call":
        return { role: "assistant", content: `[DAG LLM: ${node.config.model ?? "default"}]`, model: node.config.model };
      case "tool-call":
        return { tool: node.config.tool, result: `[tool: ${node.config.tool}]` };
      case "condition": {
        const condition = node.config.condition as ((inputs: Map<string, unknown>) => boolean) | undefined;
        return { branch: condition ? condition(inputs) : true };
      }
      case "parallel":
        return { parallelResults: [...inputs.values()] };
      case "transform": {
        const transformFn = node.config.transform as ((inputs: Map<string, unknown>) => unknown) | undefined;
        return transformFn ? transformFn(inputs) : { transformed: true, input: [...inputs.values()] };
      }
      case "output":
        return [...inputs.values()];
      case "retry":
        return [...inputs.values()].pop();
      case "fallback":
        return { fallback: true, originalError: node.config.originalError };
      default:
        return null;
    }
  };

  const nodeExecutor = executor ?? defaultExecutor;

  function topologicalSort(nodes: DagNode[]): string[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const result: string[] = [];

    function visit(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodeMap.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }
      result.push(id);
    }

    for (const node of nodes) {
      visit(node.id);
    }
    return result;
  }

  function findParallelGroups(nodes: DagNode[], order: string[]): string[][] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const groups: string[][] = [];
    const assigned = new Set<string>();

    for (const nodeId of order) {
      if (assigned.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const sameDeps = order.filter((id) => {
        if (assigned.has(id) || id === nodeId) return false;
        const other = nodeMap.get(id);
        if (!other) return false;
        if (other.dependencies.length !== node.dependencies.length) return false;
        return node.dependencies.every((d) => other.dependencies.includes(d));
      });

      const group = [nodeId, ...sameDeps];
      groups.push(group);
      for (const id of group) {
        assigned.add(id);
      }
    }

    return groups;
  }

  async function executeNodeWithRetry(
    node: DagNode,
    inputs: Map<string, unknown>,
    execution: DagExecution,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const maxRetries = node.retryConfig?.maxRetries ?? 0;
    const delayMs = node.retryConfig?.delayMs ?? 1000;
    const backoff = node.retryConfig?.backoff ?? "exponential";
    let lastError: Error | null = null;
    let attempt = 0;

    for (; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new Error("Cancelled");

      try {
        execution.nodeStatus.set(node.id, "running");
        execution.retryCount.set(node.id, attempt);

        const timeoutMs = node.timeoutMs ?? 30_000;
        const result = await Promise.race([
          nodeExecutor(node, inputs),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Node ${node.id} timed out after ${timeoutMs}ms`)), timeoutMs),
          ),
        ]);

        execution.nodeStatus.set(node.id, "completed");
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const waitMs = backoff === "exponential" ? delayMs * Math.pow(2, attempt) : delayMs * (attempt + 1);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }

    if (node.fallbackNode) {
      execution.nodeStatus.set(node.id, "failed");
      execution.errors.set(node.id, lastError?.message ?? "unknown error");

      const fallbackNode = dags.get(execution.dagId)?.nodes.find((n) => n.id === node.fallbackNode);
      if (fallbackNode) {
        try {
          const fallbackResult = await nodeExecutor(
            { ...fallbackNode, config: { ...fallbackNode.config, originalError: lastError?.message } },
            inputs,
          );
          execution.nodeStatus.set(node.id, "completed");
          return fallbackResult;
        } catch {
          // fallback also failed
        }
      }
    }

    execution.nodeStatus.set(node.id, "failed");
    execution.errors.set(node.id, lastError?.message ?? "unknown error");
    throw lastError!;
  }

  return {
    defineDag(dag) {
      const id = crypto.randomUUID();
      dags.set(id, { ...dag, id });
      return id;
    },

    async execute(dagId, input, signal) {
      const dag = dags.get(dagId);
      if (!dag) throw new Error(`DAG ${dagId} not found`);

      const executionId = crypto.randomUUID();
      const execution: DagExecution = {
        id: executionId,
        dagId,
        status: "running",
        results: new Map(),
        errors: new Map(),
        startedAt: Date.now(),
        nodeStatus: new Map(dag.nodes.map((n) => [n.id, "pending" as const])),
        retryCount: new Map(),
      };
      executions.set(executionId, execution);

      const order = topologicalSort(dag.nodes);
      const nodeMap = new Map(dag.nodes.map((n) => [n.id, n]));
      const parallelGroups = findParallelGroups(dag.nodes, order);

      try {
        execution.results.set("__input__", input);

        eventBus?.publish("dag.execution.started", { executionId, dagId });

        for (const group of parallelGroups) {
          if (signal?.aborted) {
            execution.status = "cancelled";
            break;
          }

          if (group.length === 1) {
            const nodeId = group[0];
            const node = nodeMap.get(nodeId);
            if (!node) continue;

            const depsFailed = node.dependencies.some((depId) => execution.nodeStatus.get(depId) === "failed");
            if (depsFailed) {
              execution.nodeStatus.set(nodeId, "skipped");
              continue;
            }

            const inputs = new Map<string, unknown>();
            for (const depId of node.dependencies) {
              const depResult = execution.results.get(depId);
              if (depResult !== undefined) inputs.set(depId, depResult);
            }

            const result = await executeNodeWithRetry(node, inputs, execution, signal);
            execution.results.set(nodeId, result);

            eventBus?.publish("dag.node.completed", { executionId, nodeId, type: node.type });
          } else {
            const results = await Promise.allSettled(
              group.map(async (nodeId) => {
                const node = nodeMap.get(nodeId);
                if (!node) return { nodeId, success: false, error: "node not found" };

                const depsFailed = node.dependencies.some((depId) => execution.nodeStatus.get(depId) === "failed");
                if (depsFailed) {
                  execution.nodeStatus.set(nodeId, "skipped");
                  return { nodeId, success: true, result: null };
                }

                const inputs = new Map<string, unknown>();
                for (const depId of node.dependencies) {
                  const depResult = execution.results.get(depId);
                  if (depResult !== undefined) inputs.set(depId, depResult);
                }

                try {
                  const result = await executeNodeWithRetry(node, inputs, execution, signal);
                  execution.results.set(nodeId, result);
                  return { nodeId, success: true, result };
                } catch (err) {
                  return { nodeId, success: false, error: String(err) };
                }
              }),
            );

            const allSuccess = results.every((r) => r.status === "fulfilled" && r.value.success);
            if (!allSuccess) {
              for (const r of results) {
                if (r.status === "fulfilled" && !r.value.success) {
                  eventBus?.publish("dag.node.failed", {
                    executionId,
                    nodeId: r.value.nodeId,
                    error: r.value.error,
                  });
                }
              }
            }
          }
        }

        const hasFailedNodes = [...execution.nodeStatus.values()].some((s) => s === "failed");
        const hasCompletedNodes = [...execution.nodeStatus.values()].some((s) => s === "completed");

        if (execution.status !== "cancelled") {
          if (hasFailedNodes && hasCompletedNodes) {
            execution.status = "partial";
          } else if (hasFailedNodes) {
            execution.status = "failed";
          } else {
            execution.status = "completed";
          }
        }
        execution.completedAt = Date.now();

        if (execution.status === "completed") totalCompleted++;
        else if (execution.status === "failed") totalFailed++;

        eventBus?.publish("dag.execution.completed", {
          executionId,
          dagId,
          status: execution.status,
          durationMs: execution.completedAt - (execution.startedAt ?? execution.completedAt),
        });
      } catch (err) {
        execution.status = "failed";
        execution.error = err instanceof Error ? err.message : String(err);
        execution.completedAt = Date.now();
        totalFailed++;

        eventBus?.publish("dag.execution.failed", { executionId, dagId, error: execution.error });
      }

      return execution;
    },

    cancel(executionId) {
      const execution = executions.get(executionId);
      if (execution && execution.status === "running") {
        execution.status = "cancelled";
        execution.completedAt = Date.now();
      }
    },

    getDag(dagId) {
      return dags.get(dagId);
    },

    listDags() {
      return [...dags.values()];
    },

    getExecution(executionId) {
      return executions.get(executionId);
    },

    getStats() {
      return {
        totalDags: dags.size,
        totalExecutions: executions.size,
        activeExecutions: [...executions.values()].filter((e) => e.status === "running").length,
        completedExecutions: totalCompleted,
        failedExecutions: totalFailed,
      };
    },
  };
}
