import type { EventBus } from "../event-bus/bus.js";

export type AgentReplica = {
  id: string;
  parentAgentId: string;
  createdAt: number;
  status: "starting" | "active" | "idle" | "draining" | "terminating" | "terminated";
  load: number;
  maxLoad: number;
  lastActivityAt: number;
  metadata: Record<string, unknown>;
  requestCount: number;
  errorCount: number;
};

export type ReplicaHealthReport = {
  replicaId: string;
  healthy: boolean;
  load: number;
  uptimeMs: number;
  errorRate: number;
  issues: string[];
};

export type AgentReplicator = {
  getReplicas(parentAgentId: string): AgentReplica[];
  getAllReplicas(): AgentReplica[];
  requestFork(parentAgentId: string, reason: string, metadata?: Record<string, unknown>): AgentReplica | null;
  terminateReplica(replicaId: string, reason?: string): void;
  drainReplica(replicaId: string): Promise<void>;
  rebalance(): { forked: string[]; terminated: string[]; drained: string[] };
  updateLoad(replicaId: string, load: number): void;
  recordRequest(replicaId: string, error?: boolean): void;
  healthCheck(): ReplicaHealthReport[];
  getStats(): { totalReplicas: number; activeReplicas: number; idleReplicas: number; totalForks: number; totalTerminations: number; avgLoad: number };
};

export function createAgentReplicator(
  opts?: {
    maxReplicasPerParent?: number;
    loadThreshold?: number;
    idleTimeoutMs?: number;
    drainTimeoutMs?: number;
    maxErrorRate?: number;
  },
  eventBus?: EventBus,
): AgentReplicator {
  const replicas = new Map<string, AgentReplica>();
  const maxPerParent = opts?.maxReplicasPerParent ?? 3;
  const loadThreshold = opts?.loadThreshold ?? 0.8;
  const idleTimeout = opts?.idleTimeoutMs ?? 300_000;
  const drainTimeout = opts?.drainTimeoutMs ?? 30_000;
  const maxErrorRate = opts?.maxErrorRate ?? 0.5;
  let totalForks = 0;
  let totalTerminations = 0;

  function emit(event: string, data: Record<string, unknown>) {
    eventBus?.publish(`replicator.${event}`, data);
  }

  return {
    getReplicas(parentAgentId) {
      return [...replicas.values()].filter((r) => r.parentAgentId === parentAgentId);
    },

    getAllReplicas() {
      return [...replicas.values()];
    },

    requestFork(parentAgentId, reason, metadata) {
      const parentReplicas = this.getReplicas(parentAgentId);
      if (parentReplicas.length >= maxPerParent) {
        emit("fork-denied", { parentAgentId, reason: "max-replicas-reached", count: parentReplicas.length });
        return null;
      }

      const hasHighLoad = parentReplicas.some((r) => r.status === "active" && r.load >= loadThreshold);
      const isFirstReplica = parentReplicas.length === 0;
      if (!hasHighLoad && !isFirstReplica) {
        return null;
      }

      const replica: AgentReplica = {
        id: crypto.randomUUID(),
        parentAgentId,
        createdAt: Date.now(),
        status: "starting",
        load: 0,
        maxLoad: 100,
        lastActivityAt: Date.now(),
        metadata: metadata ?? {},
        requestCount: 0,
        errorCount: 0,
      };
      replicas.set(replica.id, replica);
      totalForks++;

      emit("fork", { replicaId: replica.id, parentAgentId, reason });

      setTimeout(() => {
        if (replicas.has(replica.id) && replica.status === "starting") {
          replica.status = "active";
          emit("ready", { replicaId: replica.id, parentAgentId });
        }
      }, 100);

      return replica;
    },

    terminateReplica(replicaId, reason = "manual") {
      const replica = replicas.get(replicaId);
      if (!replica) return;

      replica.status = "terminating";
      emit("terminating", { replicaId, parentAgentId: replica.parentAgentId, reason });

      setTimeout(() => {
        replica.status = "terminated";
        replicas.delete(replicaId);
        totalTerminations++;
        emit("terminated", { replicaId, parentAgentId: replica.parentAgentId, reason });
      }, 100);
    },

    async drainReplica(replicaId) {
      const replica = replicas.get(replicaId);
      if (!replica) return;

      replica.status = "draining";
      emit("draining", { replicaId, parentAgentId: replica.parentAgentId });

      const start = Date.now();
      await new Promise((resolve) => {
        const check = setInterval(() => {
          const r = replicas.get(replicaId);
          if (!r || r.requestCount === 0 || Date.now() - start > drainTimeout) {
            clearInterval(check);
            resolve(undefined);
          }
        }, 1000);
      });

      this.terminateReplica(replicaId, "drained");
    },

    rebalance() {
      const forked: string[] = [];
      const terminated: string[] = [];
      const drained: string[] = [];
      const now = Date.now();

      for (const replica of replicas.values()) {
        if (replica.status === "active") {
          const idle = now - replica.lastActivityAt > idleTimeout;
          const lowLoad = replica.load < 0.1;
          const highErrorRate = replica.requestCount > 10 && (replica.errorCount / replica.requestCount) > maxErrorRate;

          if (idle && lowLoad) {
            this.terminateReplica(replica.id, "idle-timeout");
            terminated.push(replica.id);
          } else if (highErrorRate) {
            drained.push(replica.id);
            void this.drainReplica(replica.id);
          }
        }
      }

      const parentsByLoad = new Map<string, number>();
      for (const replica of replicas.values()) {
        if (replica.status === "active") {
          const current = parentsByLoad.get(replica.parentAgentId) ?? 0;
          parentsByLoad.set(replica.parentAgentId, Math.max(current, replica.load));
        }
      }

      for (const [parentId, load] of parentsByLoad) {
        if (load >= loadThreshold) {
          const forkedReplica = this.requestFork(parentId, "auto-rebalance");
          if (forkedReplica) {
            forked.push(forkedReplica.id);
          }
        }
      }

      if (forked.length > 0 || terminated.length > 0 || drained.length > 0) {
        emit("rebalance", { forked: forked.length, terminated: terminated.length, drained: drained.length });
      }

      return { forked, terminated, drained };
    },

    updateLoad(replicaId, load) {
      const replica = replicas.get(replicaId);
      if (replica) {
        replica.load = Math.max(0, Math.min(1, load));
        replica.lastActivityAt = Date.now();
        if (replica.load < 0.1 && replica.status === "active") {
          replica.status = "idle";
        } else if (replica.load >= 0.1 && replica.status === "idle") {
          replica.status = "active";
        }
      }
    },

    recordRequest(replicaId, error) {
      const replica = replicas.get(replicaId);
      if (replica) {
        replica.requestCount++;
        if (error) replica.errorCount++;
        replica.lastActivityAt = Date.now();
      }
    },

    healthCheck() {
      const reports: ReplicaHealthReport[] = [];
      const now = Date.now();

      for (const replica of replicas.values()) {
        if (replica.status === "terminated") continue;
        const issues: string[] = [];
        const errorRate = replica.requestCount > 0 ? replica.errorCount / replica.requestCount : 0;

        if (replica.status === "starting" && now - replica.createdAt > 30_000) {
          issues.push("启动超时");
        }
        if (errorRate > maxErrorRate) {
          issues.push(`错误率 ${(errorRate * 100).toFixed(0)}% 超过阈值`);
        }
        if (replica.load >= 1.0) {
          issues.push("满载");
        }

        reports.push({
          replicaId: replica.id,
          healthy: issues.length === 0 && replica.status !== "terminating",
          load: replica.load,
          uptimeMs: now - replica.createdAt,
          errorRate,
          issues,
        });
      }

      return reports;
    },

    getStats() {
      const all = [...replicas.values()];
      const active = all.filter((r) => r.status === "active");
      const idle = all.filter((r) => r.status === "idle");
      const avgLoad = active.length > 0 ? active.reduce((s, r) => s + r.load, 0) / active.length : 0;

      return {
        totalReplicas: all.filter((r) => r.status !== "terminated").length,
        activeReplicas: active.length,
        idleReplicas: idle.length,
        totalForks,
        totalTerminations,
        avgLoad,
      };
    },
  };
}
