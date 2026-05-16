import { describe, it, expect } from "vitest";
import { createAgentDagEngine } from "../src/gateway/agent-dag/engine.js";

describe("AgentDagEngine", () => {
  it("定义 DAG 并执行", async () => {
    const engine = createAgentDagEngine();
    const dagId = engine.defineDag({
      name: "simple-pipeline",
      nodes: [
        { id: "step1", type: "llm-call", config: { model: "gpt-4o" }, dependencies: [] },
        { id: "step2", type: "tool-call", config: { tool: "search" }, dependencies: ["step1"] },
        { id: "step3", type: "output", config: {}, dependencies: ["step2"] },
      ],
      entryPoint: "step1",
    });
    const execution = await engine.execute(dagId, { query: "test" });
    expect(execution.status).toBe("completed");
    expect(execution.results.has("step1")).toBe(true);
    expect(execution.results.has("step2")).toBe(true);
    expect(execution.results.has("step3")).toBe(true);
  });

  it("并行节点执行", async () => {
    const engine = createAgentDagEngine();
    const dagId = engine.defineDag({
      name: "parallel",
      nodes: [
        { id: "a", type: "llm-call", config: {}, dependencies: [] },
        { id: "b", type: "tool-call", config: {}, dependencies: [] },
        { id: "merge", type: "parallel", config: {}, dependencies: ["a", "b"] },
      ],
      entryPoint: "a",
    });
    const execution = await engine.execute(dagId, {});
    expect(execution.status).toBe("completed");
    expect(execution.results.has("merge")).toBe(true);
  });

  it("取消执行", async () => {
    const engine = createAgentDagEngine(async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return null;
    });
    const dagId = engine.defineDag({
      name: "slow",
      nodes: [
        { id: "slow", type: "llm-call", config: {}, dependencies: [], timeoutMs: 5000 },
      ],
      entryPoint: "slow",
    });
    const executionPromise = engine.execute(dagId, {});
    engine.cancel((await executionPromise).id);
  });

  it("条件分支", async () => {
    const engine = createAgentDagEngine();
    const dagId = engine.defineDag({
      name: "conditional",
      nodes: [
        { id: "check", type: "condition", config: {}, dependencies: [] },
        { id: "result", type: "output", config: {}, dependencies: ["check"] },
      ],
      entryPoint: "check",
    });
    const execution = await engine.execute(dagId, {});
    expect(execution.status).toBe("completed");
  });
});
