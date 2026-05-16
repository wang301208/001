import { createHash } from "node:crypto";

export type TwinSnapshot = {
  id: string;
  timestamp: number;
  component: string;
  state: Record<string, unknown>;
  metrics: Record<string, number>;
  checksum: string;
  parentId: string | null;
  tags: string[];
};

export type SimulationResult = {
  success: boolean;
  snapshotId: string;
  predictedMetrics: Record<string, number>;
  violations: string[];
  confidence: number;
  recommendation: string;
};

export type RollbackResult = {
  success: boolean;
  fromSnapshotId: string;
  toSnapshotId: string;
  revertedKeys: string[];
  timestamp: number;
};

export type DigitalTwin = {
  captureSnapshot(component: string, state: Record<string, unknown>, metrics: Record<string, number>, opts?: { tags?: string[] }): TwinSnapshot;
  simulate(snapshotId: string, change: Record<string, unknown>): SimulationResult;
  validateChange(component: string, change: Record<string, unknown>): { safe: boolean; risks: string[]; recommendation: string };
  getSnapshots(component?: string): TwinSnapshot[];
  compareSnapshots(id1: string, id2: string): { metricDiff: Record<string, number>; stateDiff: string[] };
  rollback(snapshotId: string, current?: Record<string, unknown>): RollbackResult;
  verifyIntegrity(snapshotId: string): { valid: boolean; expectedChecksum: string; actualChecksum: string };
  getLatestSnapshot(component: string): TwinSnapshot | undefined;
  pruneSnapshots(component: string, keepCount: number): number;
};

function computeChecksum(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export function createDigitalTwin(): DigitalTwin {
  const snapshots = new Map<string, TwinSnapshot>();
  const componentLatest = new Map<string, string>();

  return {
    captureSnapshot(component, state, metrics, opts) {
      const id = crypto.randomUUID();
      const parentId = componentLatest.get(component) ?? null;
      const checksum = computeChecksum({ component, state, metrics });
      const snapshot: TwinSnapshot = {
        id,
        timestamp: Date.now(),
        component,
        state: { ...state },
        metrics: { ...metrics },
        checksum,
        parentId,
        tags: opts?.tags ?? [],
      };
      snapshots.set(id, snapshot);
      componentLatest.set(component, id);
      return snapshot;
    },

    simulate(snapshotId, change) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        return { success: false, snapshotId, predictedMetrics: {}, violations: ["快照未找到"], confidence: 0, recommendation: "请先创建快照" };
      }

      const predictedMetrics = { ...snapshot.metrics };
      const violations: string[] = [];

      for (const [key, value] of Object.entries(change)) {
        if (key.includes("memory") && typeof value === "number" && value > 2048) {
          violations.push(`内存分配 ${value}MB 超过安全阈值 2048MB`);
        }
        if (key.includes("timeout") && typeof value === "number" && value < 1000) {
          violations.push(`超时 ${value}ms 过短，可能导致请求截断`);
        }
        if (key.includes("concurrency") && typeof value === "number" && value > 1000) {
          violations.push(`并发 ${value} 过高，可能导致资源耗尽`);
        }
        if (key.includes("rate") && typeof value === "number" && value > 10_000) {
          violations.push(`速率 ${value}/min 过高，可能触发限流`);
        }
      }

      const scaleFactor = (change.scaleFactor as number) ?? 1;
      const loadMultiplier = (change.loadMultiplier as number) ?? 1;
      predictedMetrics.predictedLatencyMs = (snapshot.metrics.p99LatencyMs ?? 1000) * scaleFactor;
      predictedMetrics.predictedErrorRate = (snapshot.metrics.errorRate ?? 0.01) * loadMultiplier;
      predictedMetrics.predictedThroughput = (snapshot.metrics.throughput ?? 100) / scaleFactor;

      if (predictedMetrics.predictedErrorRate > 0.5) {
        violations.push("预测错误率超过 50%");
      }
      if (predictedMetrics.predictedLatencyMs > 10_000) {
        violations.push("预测延迟超过 10 秒");
      }

      const recommendation = violations.length === 0
        ? "变更安全，建议执行"
        : violations.length <= 2
          ? "存在风险，建议灰度发布并密切监控"
          : "高风险变更，建议先在测试环境充分验证";

      return {
        success: violations.length === 0,
        snapshotId,
        predictedMetrics,
        violations,
        confidence: violations.length === 0 ? 0.9 : Math.max(0, 1 - violations.length * 0.15),
        recommendation,
      };
    },

    validateChange(component, change) {
      const componentSnapshots = [...snapshots.values()].filter((s) => s.component === component);
      const risks: string[] = [];

      if (componentSnapshots.length === 0) {
        risks.push("无历史快照，无法验证变更影响");
      }

      for (const [key, value] of Object.entries(change)) {
        if (typeof value === "number" && value < 0) {
          risks.push(`${key} 值为负数，可能不合法`);
        }
      }

      const latest = componentSnapshots[componentSnapshots.length - 1];
      if (latest && change.concurrency && typeof change.concurrency === "number") {
        const currentConcurrency = latest.state.concurrency as number | undefined;
        if (currentConcurrency && change.concurrency > currentConcurrency * 3) {
          risks.push(`并发从 ${currentConcurrency} 增至 ${change.concurrency}，增幅超过 3x`);
        }
      }

      const recommendation = risks.length > 0
        ? "建议先在测试环境验证，再逐步灰度发布"
        : "变更看起来安全，可以执行";

      return { safe: risks.length === 0, risks, recommendation };
    },

    getSnapshots(component) {
      const all = [...snapshots.values()];
      if (component) {
        return all.filter((s) => s.component === component);
      }
      return all;
    },

    compareSnapshots(id1, id2) {
      const s1 = snapshots.get(id1);
      const s2 = snapshots.get(id2);
      if (!s1 || !s2) {
        return { metricDiff: {}, stateDiff: [] };
      }

      const metricDiff: Record<string, number> = {};
      for (const key of new Set([...Object.keys(s1.metrics), ...Object.keys(s2.metrics)])) {
        metricDiff[key] = (s2.metrics[key] ?? 0) - (s1.metrics[key] ?? 0);
      }

      const stateDiff: string[] = [];
      for (const key of new Set([...Object.keys(s1.state), ...Object.keys(s2.state)])) {
        if (JSON.stringify(s1.state[key]) !== JSON.stringify(s2.state[key])) {
          stateDiff.push(key);
        }
      }

      return { metricDiff, stateDiff };
    },

    rollback(snapshotId, current) {
      const target = snapshots.get(snapshotId);
      if (!target) {
        return { success: false, fromSnapshotId: "current", toSnapshotId: snapshotId, revertedKeys: [], timestamp: Date.now() };
      }

      const revertedKeys: string[] = [];
      if (current) {
        for (const key of Object.keys(current)) {
          if (!(key in target.state)) {
            revertedKeys.push(key);
          }
        }
      }
      for (const key of Object.keys(target.state)) {
        if (current && JSON.stringify(current[key]) !== JSON.stringify(target.state[key])) {
          revertedKeys.push(key);
        }
      }

      const rollbackSnapshot = this.captureSnapshot(
        target.component,
        target.state,
        target.metrics,
        { tags: ["rollback", `from-${snapshotId}`] },
      );

      return {
        success: true,
        fromSnapshotId: "current",
        toSnapshotId: rollbackSnapshot.id,
        revertedKeys,
        timestamp: Date.now(),
      };
    },

    verifyIntegrity(snapshotId) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        return { valid: false, expectedChecksum: "", actualChecksum: "" };
      }
      const actual = computeChecksum({ component: snapshot.component, state: snapshot.state, metrics: snapshot.metrics });
      return {
        valid: actual === snapshot.checksum,
        expectedChecksum: snapshot.checksum,
        actualChecksum: actual,
      };
    },

    getLatestSnapshot(component) {
      const id = componentLatest.get(component);
      return id ? snapshots.get(id) : undefined;
    },

    pruneSnapshots(component, keepCount) {
      const all = [...snapshots.values()]
        .filter((s) => s.component === component)
        .sort((a, b) => b.timestamp - a.timestamp);

      let pruned = 0;
      for (let i = keepCount; i < all.length; i++) {
        snapshots.delete(all[i].id);
        pruned++;
      }
      return pruned;
    },
  };
}
