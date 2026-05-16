import type { ComponentHealth, AnomalyEvent, HealthStatus } from "./types.js";

export type HealthCheck = {
  component: string;
  check(): Promise<ComponentHealth>;
  intervalMs?: number;
};

export type RemediationAction = {
  name: string;
  component: string;
  execute(): Promise<{ success: boolean; message: string }>;
  cooldownMs?: number;
  maxAttempts?: number;
};

export type SelfHealingSystem = {
  start(): void;
  stop(): void;
  registerHealthCheck(check: HealthCheck): void;
  registerRemediation(action: RemediationAction): void;
  getHealth(): Record<string, ComponentHealth>;
  getAnomalies(): AnomalyEvent[];
  getStatus(): { running: boolean; checksRegistered: number; remediationsRegistered: number; anomaliesDetected: number; autoRemediationsExecuted: number };
};

export function createSelfHealingSystem(
  opts?: {
    anomalyThresholds?: { latencyMs?: number; errorRate?: number; memoryPressurePercent?: number };
    onAnomaly?: (event: AnomalyEvent) => void;
    onRemediation?: (component: string, action: string, success: boolean) => void;
  },
): SelfHealingSystem {
  const healthChecks = new Map<string, HealthCheck>();
  const remediations = new Map<string, RemediationAction>();
  const healthState = new Map<string, ComponentHealth>();
  const anomalies: AnomalyEvent[] = [];
  const checkIntervals: ReturnType<typeof setInterval>[] = [];
  const lastRemediationTime = new Map<string, number>();

  const thresholds = {
    latencyMs: opts?.anomalyThresholds?.latencyMs ?? 10_000,
    errorRate: opts?.anomalyThresholds?.errorRate ?? 0.1,
    memoryPressurePercent: opts?.anomalyThresholds?.memoryPressurePercent ?? 90,
  };

  let running = false;
  let autoRemediationsExecuted = 0;

  function detectAnomalies(health: ComponentHealth): AnomalyEvent | null {
    if (health.status === "unhealthy") {
      return createAnomaly(health.component, "connection_failure", "high", `${health.component} is unhealthy: ${health.message ?? "unknown"}`);
    }
    if (health.latencyMs && health.latencyMs > thresholds.latencyMs) {
      return createAnomaly(health.component, "high_latency", "medium", `${health.component} latency ${health.latencyMs}ms exceeds threshold ${thresholds.latencyMs}ms`);
    }
    if (health.errorRate && health.errorRate > thresholds.errorRate) {
      return createAnomaly(health.component, "error_rate_spike", "high", `${health.component} error rate ${(health.errorRate * 100).toFixed(1)}% exceeds threshold ${(thresholds.errorRate * 100).toFixed(1)}%`);
    }
    if (health.component === "memory" && health.metadata?.pressurePercent && health.metadata.pressurePercent as number > thresholds.memoryPressurePercent) {
      return createAnomaly("memory", "memory_pressure", "critical", `Memory pressure ${health.metadata.pressurePercent}% exceeds ${thresholds.memoryPressurePercent}%`);
    }
    return null;
  }

  function createAnomaly(
    component: string,
    type: AnomalyEvent["type"],
    severity: AnomalyEvent["severity"],
    description: string,
  ): AnomalyEvent {
    return {
      id: crypto.randomUUID(),
      component,
      type,
      severity,
      description,
      detectedAt: Date.now(),
      autoRemediated: false,
    };
  }

  async function attemptRemediation(anomaly: AnomalyEvent): Promise<boolean> {
    const action = remediations.get(anomaly.component);
    if (!action) {return false;}

    const now = Date.now();
    const cooldown = action.cooldownMs ?? 60_000;
    const lastTime = lastRemediationTime.get(anomaly.component) ?? 0;
    if (now - lastTime < cooldown) {return false;}

    try {
      lastRemediationTime.set(anomaly.component, now);
      const result = await action.execute();
      autoRemediationsExecuted++;
      anomaly.autoRemediated = result.success;
      anomaly.remediationAction = action.name;
      opts?.onRemediation?.(anomaly.component, action.name, result.success);
      return result.success;
    } catch {
      return false;
    }
  }

  async function runCheck(check: HealthCheck): Promise<void> {
    try {
      const health = await check.check();
      healthState.set(health.component, health);

      const anomaly = detectAnomalies(health);
      if (anomaly) {
        anomalies.push(anomaly);
        opts?.onAnomaly?.(anomaly);
        await attemptRemediation(anomaly);
      }
    } catch (err) {
      healthState.set(check.component, {
        component: check.component,
        status: "unknown",
        message: err instanceof Error ? err.message : String(err),
        lastCheckAt: Date.now(),
      });
    }
  }

  return {
    start() {
      if (running) {return;}
      running = true;
      for (const check of healthChecks.values()) {
        void runCheck(check);
        const interval = setInterval(() => void runCheck(check), check.intervalMs ?? 10_000);
        checkIntervals.push(interval);
      }
    },

    stop() {
      running = false;
      for (const interval of checkIntervals) {
        clearInterval(interval);
      }
      checkIntervals.length = 0;
    },

    registerHealthCheck(check) {
      healthChecks.set(check.component, check);
    },

    registerRemediation(action) {
      remediations.set(action.component, action);
    },

    getHealth() {
      return Object.fromEntries(healthState);
    },

    getAnomalies() {
      return anomalies.slice(-100);
    },

    getStatus() {
      return {
        running,
        checksRegistered: healthChecks.size,
        remediationsRegistered: remediations.size,
        anomaliesDetected: anomalies.length,
        autoRemediationsExecuted,
      };
    },
  };
}
