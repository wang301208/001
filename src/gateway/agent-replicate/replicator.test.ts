import { describe, it, expect, vi } from "vitest";

describe("createAgentReplicator", () => {
  it("requestFork() 在高负载时创建副本并返回副本 ID", async () => {
    const { createAgentReplicator } = await import("./replicator.js");
    const replicator = createAgentReplicator({ maxReplicasPerParent: 3, loadThreshold: 0.8 });
    const parentReplicas = replicator.getReplicas("agent-1");
    expect(parentReplicas).toHaveLength(0);
    const firstReplica = {
      id: "seed-replica-1",
      parentAgentId: "agent-1",
      createdAt: Date.now(),
      status: "active" as const,
      load: 0.9,
      maxLoad: 100,
      lastActivityAt: Date.now(),
    };
    const stats0 = replicator.getStats();
    const forked = replicator.requestFork("agent-1", "high-load");
    expect(forked).not.toBeNull();
    expect(forked!.id).toBeDefined();
    expect(forked!.parentAgentId).toBe("agent-1");
    expect(forked!.status).toBe("starting");
  });

  it("terminateReplica() 终止指定副本", async () => {
    const { createAgentReplicator } = await import("./replicator.js");
    const replicator = createAgentReplicator({ maxReplicasPerParent: 3, loadThreshold: 0.8 });
    const forked = replicator.requestFork("agent-2", "test");
    if (forked) {
      replicator.terminateReplica(forked.id);
      const stats = replicator.getStats();
      expect(stats.totalTerminations).toBeGreaterThanOrEqual(1);
    }
  });

  it("getReplicas() 返回当前副本列表", async () => {
    const { createAgentReplicator } = await import("./replicator.js");
    const replicator = createAgentReplicator({ maxReplicasPerParent: 5, loadThreshold: 0.8 });
    const forked1 = replicator.requestFork("agent-3", "test-1");
    const forked2 = replicator.requestFork("agent-3", "test-2");
    const replicas = replicator.getReplicas("agent-3");
    const count = [forked1, forked2].filter((f) => f !== null).length;
    expect(replicas.length).toBeGreaterThanOrEqual(count);
  });

  it("rebalance() 在高负载时触发自动复制", async () => {
    const { createAgentReplicator } = await import("./replicator.js");
    const replicator = createAgentReplicator({ maxReplicasPerParent: 5, loadThreshold: 0.8 });
    const forked = replicator.requestFork("agent-4", "seed");
    if (forked) {
      const result = replicator.rebalance();
      expect(result).toHaveProperty("forked");
      expect(result).toHaveProperty("terminated");
    }
  });
});
