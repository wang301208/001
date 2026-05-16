import type { ConfigEvolution } from "../config-evolution/evolution.js";
import type { EventBus, EventBusMessage } from "../event-bus/bus.js";
import type { AuditChain } from "../audit-chain/chain.js";

export type MetricsIntegrationConfig = {
  adaptIntervalMs?: number;
  maxLatencyMs?: number;
  maxErrorRate?: number;
  minThroughput?: number;
};

export function createMetricsIntegration(params: {
  configEvolution: ConfigEvolution;
  eventBus: EventBus;
  auditChain?: AuditChain;
  config?: MetricsIntegrationConfig;
}): () => void {
  const adaptIntervalMs = params.config?.adaptIntervalMs ?? 60_000;
  const maxLatencyMs = params.config?.maxLatencyMs ?? 5000;
  const maxErrorRate = params.config?.maxErrorRate ?? 0.3;
  const minThroughput = params.config?.minThroughput ?? 10;

  const metricsWindow: { p99LatencyMs: number; avgLatencyMs: number; errorRate: number; throughput: number }[] = [];
  const windowSize = 10;

  const unsubMetrics = params.eventBus.subscribe("metrics.request", async (msg: EventBusMessage) => {
    const payload = msg.payload as Record<string, unknown>;
    const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : 0;
    const status = typeof payload.status === "number" ? payload.status : 200;

    const latest = metricsWindow[metricsWindow.length - 1];
    if (!latest || metricsWindow.length === 0) {
      metricsWindow.push({
        p99LatencyMs: durationMs,
        avgLatencyMs: durationMs,
        errorRate: status >= 400 ? 1 : 0,
        throughput: 1,
      });
    } else {
      latest.avgLatencyMs = (latest.avgLatencyMs * latest.throughput + durationMs) / (latest.throughput + 1);
      latest.p99LatencyMs = Math.max(latest.p99LatencyMs, durationMs);
      if (status >= 400) {
        latest.errorRate = (latest.errorRate * latest.throughput + 1) / (latest.throughput + 1);
      }
      latest.throughput++;
    }
  });

  const unsubCost = params.eventBus.subscribe("cost.request", async (msg: EventBusMessage) => {
    params.auditChain?.append({
      actor: "cost-governance",
      action: "cost-record",
      resource: String((msg.payload as Record<string, unknown>).model ?? "unknown"),
      outcome: "success",
      metadata: msg.payload as Record<string, unknown>,
    });
  });

  const unsubDefense = params.eventBus.subscribe("defense.blocked", async (msg: EventBusMessage) => {
    params.auditChain?.append({
      actor: "self-defense",
      action: "request-blocked",
      resource: String((msg.payload as Record<string, unknown>).ip ?? "unknown"),
      outcome: "denied",
      metadata: msg.payload as Record<string, unknown>,
    });
  });

  const adaptTimer = setInterval(() => {
    if (metricsWindow.length === 0) return;

    const aggregated = {
      p99LatencyMs: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      throughput: 0,
    };

    for (const w of metricsWindow) {
      aggregated.p99LatencyMs = Math.max(aggregated.p99LatencyMs, w.p99LatencyMs);
      aggregated.avgLatencyMs += w.avgLatencyMs;
      aggregated.errorRate += w.errorRate;
      aggregated.throughput += w.throughput;
    }

    aggregated.avgLatencyMs /= metricsWindow.length;
    aggregated.errorRate /= metricsWindow.length;
    aggregated.throughput = aggregated.throughput / (adaptIntervalMs / 1000);

    if (metricsWindow.length >= windowSize) {
      metricsWindow.shift();
    }

    const result = params.configEvolution.evaluateAndAdapt(aggregated);

    if (aggregated.p99LatencyMs > maxLatencyMs || aggregated.errorRate > maxErrorRate) {
      params.eventBus.publish("config.adaptation", {
        trigger: aggregated.p99LatencyMs > maxLatencyMs ? "high-latency" : "high-error-rate",
        metrics: aggregated,
        newConfig: result.parameters,
        fitness: result.fitness,
      });
    }

    if (aggregated.throughput < minThroughput) {
      params.eventBus.publish("config.adaptation", {
        trigger: "low-throughput",
        metrics: aggregated,
        newConfig: result.parameters,
        fitness: result.fitness,
      });
    }
  }, adaptIntervalMs);

  return () => {
    unsubMetrics();
    unsubCost();
    unsubDefense();
    clearInterval(adaptTimer);
  };
}
