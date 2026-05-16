export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export type ComponentHealth = {
  component: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  errorRate?: number;
  lastCheckAt: number;
  metadata?: Record<string, unknown>;
};

export type AnomalyEvent = {
  id: string;
  component: string;
  type: AnomalyType;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: number;
  autoRemediated: boolean;
  remediationAction?: string;
  metadata?: Record<string, unknown>;
};

export type AnomalyType =
  | "high_latency"
  | "error_rate_spike"
  | "connection_failure"
  | "memory_pressure"
  | "model_unavailable"
  | "channel_disconnected"
  | "circuit_breaker_open"
  | "config_drift"
  | "cost_overrun"
  | "custom";
