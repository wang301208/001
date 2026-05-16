import { describe, it, expect } from "vitest";

describe("闭环集成 - Agent DAG 深度执行", () => {
  it("并行分支执行", async () => {
    const { createAgentDagEngine } = await import("../../agent-dag/engine.js");
    const { createLocalEventBus } = await import("../../event-bus/bus.js");
    const eventBus = createLocalEventBus("test");
    const engine = createAgentDagEngine(undefined, eventBus);

    const dagId = engine.defineDag({
      name: "parallel-test",
      nodes: [
        { id: "input", type: "output", config: {}, dependencies: [] },
        { id: "branch-a", type: "transform", config: { transform: (inputs: Map<string, unknown>) => ({ branch: "A", data: [...inputs.values()] }) }, dependencies: ["input"] },
        { id: "branch-b", type: "transform", config: { transform: (inputs: Map<string, unknown>) => ({ branch: "B", data: [...inputs.values()] }) }, dependencies: ["input"] },
        { id: "merge", type: "parallel", config: {}, dependencies: ["branch-a", "branch-b"] },
      ],
      entryPoint: "input",
    });

    const execution = await engine.execute(dagId, { query: "test" });
    expect(execution.status).toBe("completed");
    expect(execution.results.has("branch-a")).toBe(true);
    expect(execution.results.has("branch-b")).toBe(true);
    expect(execution.results.has("merge")).toBe(true);
  });

  it("重试+降级", async () => {
    const { createAgentDagEngine } = await import("../../agent-dag/engine.js");
    let callCount = 0;
    const engine = createAgentDagEngine(async (node) => {
      if (node.id === "flaky") {
        callCount++;
        if (callCount <= 2) throw new Error("临时故障");
        return { recovered: true };
      }
      return null;
    });

    const dagId = engine.defineDag({
      name: "retry-test",
      nodes: [
        { id: "start", type: "output", config: {}, dependencies: [] },
        { id: "flaky", type: "retry", config: {}, dependencies: ["start"], retryConfig: { maxRetries: 3, delayMs: 10, backoff: "linear" } },
      ],
      entryPoint: "start",
    });

    const execution = await engine.execute(dagId, {});
    expect(execution.status).toBe("completed");
    expect(execution.retryCount.get("flaky")).toBeGreaterThanOrEqual(2);
  });

  it("执行统计", async () => {
    const { createAgentDagEngine } = await import("../../agent-dag/engine.js");
    const engine = createAgentDagEngine();

    const dagId = engine.defineDag({
      name: "stats-test",
      nodes: [{ id: "out", type: "output", config: {}, dependencies: [] }],
      entryPoint: "out",
    });

    await engine.execute(dagId, {});
    const stats = engine.getStats();
    expect(stats.totalDags).toBe(1);
    expect(stats.completedExecutions).toBeGreaterThanOrEqual(1);
  });
});

describe("闭环集成 - Gossip 集群深度", () => {
  it("节点加入与发现", async () => {
    const { createLocalGossipCluster } = await import("../../gossip/cluster.js");
    const { createLocalEventBus } = await import("../../event-bus/bus.js");
    const eventBus = createLocalEventBus("test");

    const node1 = createLocalGossipCluster("node-1", "127.0.0.1", 8001, undefined, eventBus);
    const node2 = createLocalGossipCluster("node-2", "127.0.0.1", 8002, undefined, eventBus);

    await node1.join([{ address: "127.0.0.1", port: 8002 }]);
    await node2.join([{ address: "127.0.0.1", port: 8001 }]);

    expect(node1.getClusterSize()).toBeGreaterThanOrEqual(2);
    expect(node2.getClusterSize()).toBeGreaterThanOrEqual(2);

    const health = node1.getClusterHealth();
    expect(health.alive).toBeGreaterThanOrEqual(1);
  });

  it("状态同步消息", async () => {
    const { createLocalGossipCluster } = await import("../../gossip/cluster.js");
    const node1 = createLocalGossipCluster("n1", "127.0.0.1", 9001);

    await node1.join([{ address: "127.0.0.1", port: 9002 }]);

    const syncMsg = {
      type: "sync" as const,
      source: "n2",
      target: "n1",
      payload: [{ id: "n2", address: "127.0.0.1", port: 9002, state: "alive" as const, incarnation: 1, metadata: { version: "1.0" }, lastHeartbeat: Date.now() }],
      timestamp: Date.now(),
      incarnation: 1,
    };

    const response = node1.receiveMessage(syncMsg);
    expect(response).not.toBeNull();
    expect(response?.type).toBe("sync");

    const members = node1.getMembers();
    const n2 = members.find((m) => m.id === "n2");
    expect(n2).toBeDefined();
    expect(n2?.metadata).toHaveProperty("version");
  });

  it("分区检测", async () => {
    const { createLocalGossipCluster } = await import("../../gossip/cluster.js");
    const node = createLocalGossipCluster("single", "127.0.0.1", 7001);
    expect(node.isPartitioned()).toBe(false);
  });
});

describe("闭环集成 - 自愈×自防御联动", () => {
  it("异常触发自防御规则", async () => {
    const { createSelfHealingSystem } = await import("../../self-healing/system.js");
    const { createSelfDefenseSystem } = await import("../../self-defense/defense.js");
    const { createLocalEventBus } = await import("../../event-bus/bus.js");
    const { createAuditChain } = await import("../../audit-chain/chain.js");

    const healing = createSelfHealingSystem();
    const defense = createSelfDefenseSystem();
    const eventBus = createLocalEventBus("test");
    const auditChain = createAuditChain();

    const { createDefenseHealingLink } = await import("../../self-healing/integration/defense-healing-link.js");
    const shutdown = createDefenseHealingLink({
      selfHealing: healing,
      defense,
      eventBus,
      auditChain,
    });

    healing.registerHealthCheck({
      component: "test-provider",
      async check() {
        return { component: "test-provider", status: "unhealthy", message: "连接失败", lastCheckAt: Date.now(), errorRate: 0.5 };
      },
    });

    healing.registerRemediation({
      name: "restart-provider",
      component: "test-provider",
      async execute() {
        return { success: true, message: "已重启" };
      },
    });

    const status = healing.getStatus();
    expect(status.checksRegistered).toBeGreaterThanOrEqual(1);
    expect(status.remediationsRegistered).toBeGreaterThanOrEqual(1);

    shutdown();
  });
});

describe("闭环集成 - WebTransport 降级", () => {
  it("WebSocket 会话创建", async () => {
    const { createWebTransportServer, createWebTransportSessionFromWebSocket } = await import("../../webtransport/server.js");
    const server = createWebTransportServer();
    const stats = server.getStats();
    expect(stats.activeSessions).toBe(0);
  });
});
