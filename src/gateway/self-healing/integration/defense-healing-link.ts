import type { SelfHealingSystem, AnomalyEvent } from "../self-healing/system.js";
import type { SelfDefenseSystem, DefenseEvent } from "../self-defense/defense.js";
import type { EventBus } from "../event-bus/bus.js";
import type { AuditChain } from "../audit-chain/chain.js";

export type DefenseHealingLinkConfig = {
  blockOnConnectionFailure?: boolean;
  blockOnErrorRateSpike?: boolean;
  rateLimitOnHighLatency?: boolean;
  anomalyCooldownMs?: number;
  maxBlocksPerMinute?: number;
};

export function createDefenseHealingLink(params: {
  selfHealing: SelfHealingSystem;
  defense: SelfDefenseSystem;
  eventBus: EventBus;
  auditChain?: AuditChain;
  config?: DefenseHealingLinkConfig;
}): () => void {
  const cfg = params.config ?? {};
  const blockOnConnectionFailure = cfg.blockOnConnectionFailure ?? true;
  const blockOnErrorRateSpike = cfg.blockOnErrorRateSpike ?? true;
  const rateLimitOnHighLatency = cfg.rateLimitOnHighLatency ?? true;
  const anomalyCooldownMs = cfg.anomalyCooldownMs ?? 30_000;
  const maxBlocksPerMinute = cfg.maxBlocksPerMinute ?? 10;

  const recentBlocks: number[] = [];

  function shouldBlock(): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    while (recentBlocks.length > 0 && recentBlocks[0] < cutoff) {
      recentBlocks.shift();
    }
    return recentBlocks.length < maxBlocksPerMinute;
  }

  params.selfHealing.registerRemediation({
    name: "defense-escalation",
    component: "gateway",
    cooldownMs: anomalyCooldownMs,
    async execute() {
      const anomalies = params.selfHealing.getAnomalies();
      const recent = anomalies.filter((a) => a.detectedAt > Date.now() - anomalyCooldownMs);
      if (recent.length === 0) {
        return { success: false, message: "无最近异常" };
      }

      let actionsTaken = 0;

      for (const anomaly of recent) {
        if (!shouldBlock()) {
          break;
        }

        if (anomaly.type === "connection_failure" && blockOnConnectionFailure) {
          params.defense.addRule({
            name: `auto-block-${anomaly.component}-${Date.now()}`,
            evaluate: (ind) => ({
              triggered: ind.errorRate > 0.05,
              severity: 0.8,
              reason: `自愈联动：${anomaly.component} 连接失败`,
            }),
            action: "block",
            cooldownMs: anomalyCooldownMs,
          });
          recentBlocks.push(Date.now());
          actionsTaken++;
          params.eventBus.publish("defense-healing.escalation", {
            anomaly: anomaly.id,
            action: "block",
            component: anomaly.component,
            reason: anomaly.description,
          });
        }

        if (anomaly.type === "error_rate_spike" && blockOnErrorRateSpike) {
          params.defense.addRule({
            name: `auto-rate-limit-${anomaly.component}-${Date.now()}`,
            evaluate: (ind) => ({
              triggered: ind.errorRate > 0.05,
              severity: 0.6,
              reason: `自愈联动：${anomaly.component} 错误率飙升`,
            }),
            action: "rate-limit",
            cooldownMs: anomalyCooldownMs,
          });
          actionsTaken++;
          params.eventBus.publish("defense-healing.escalation", {
            anomaly: anomaly.id,
            action: "rate-limit",
            component: anomaly.component,
            reason: anomaly.description,
          });
        }

        if (anomaly.type === "high_latency" && rateLimitOnHighLatency) {
          params.defense.addRule({
            name: `auto-throttle-${anomaly.component}-${Date.now()}`,
            evaluate: (ind) => ({
              triggered: ind.requestRate > 50,
              severity: 0.5,
              reason: `自愈联动：${anomaly.component} 高延迟限流`,
            }),
            action: "rate-limit",
            cooldownMs: anomalyCooldownMs,
          });
          actionsTaken++;
          params.eventBus.publish("defense-healing.escalation", {
            anomaly: anomaly.id,
            action: "throttle",
            component: anomaly.component,
            reason: anomaly.description,
          });
        }
      }

      if (actionsTaken > 0) {
        params.auditChain?.append({
          actor: "defense-healing-link",
          action: "anomaly-escalation",
          resource: "gateway",
          outcome: "success",
          metadata: { anomaliesTriggered: recent.length, actionsTaken },
        });
        return { success: true, message: `触发 ${actionsTaken} 项自防御规则` };
      }

      return { success: false, message: "无匹配的自防御策略" };
    },
  });

  const unsubDefenseEvents = params.eventBus.subscribe("defense.blocked", async (msg) => {
    const payload = msg.payload as Record<string, unknown>;
    params.selfHealing.registerHealthCheck({
      component: `blocked-ip-${payload.ip ?? "unknown"}`,
      async check() {
        const blocks = params.defense.getActiveBlocks();
        const ipBlocked = blocks.some((b) => b.ip === (payload.ip ?? ""));
        return {
          component: `blocked-ip-${payload.ip ?? "unknown"}`,
          status: ipBlocked ? "unhealthy" : "healthy",
          message: ipBlocked ? `IP ${payload.ip} 被封禁` : `IP ${payload.ip} 已解封`,
          lastCheckAt: Date.now(),
        };
      },
      intervalMs: 60_000,
    });
  });

  const unsubAnomalyEvents = params.eventBus.subscribe("defense-healing.escalation", async (msg) => {
    const payload = msg.payload as Record<string, unknown>;
    params.auditChain?.append({
      actor: "defense-healing-link",
      action: String(payload.action ?? "escalation"),
      resource: String(payload.component ?? "unknown"),
      outcome: "success",
      metadata: payload,
    });
  });

  return () => {
    unsubDefenseEvents();
    unsubAnomalyEvents();
  };
}
