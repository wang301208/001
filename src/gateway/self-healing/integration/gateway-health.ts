import type { SelfHealingSystem } from "../system.js";
import { createSelfHealingSystem } from "../system.js";
import type { AiGateway } from "../../ai-gateway/gateway.js";
import type { EventBus } from "../../event-bus/bus.js";
import type { SemanticCache } from "../../semantic-cache/cache.js";
import type { AuditChain } from "../../audit-chain/chain.js";

export type GatewayHealthDeps = {
  aiGateway?: AiGateway;
  eventBus?: EventBus;
  semanticCache?: SemanticCache;
  auditChain?: AuditChain;
  getHttpServerStats?: () => { activeConnections: number; totalRequests: number; avgLatencyMs: number };
  getWsServerStats?: () => { activeConnections: number; totalMessages: number };
};

export function createGatewaySelfHealing(deps?: GatewayHealthDeps): SelfHealingSystem {
  const system = createSelfHealingSystem({
    anomalyThresholds: {
      latencyMs: 10_000,
      errorRate: 0.15,
      memoryPressurePercent: 85,
    },
    onAnomaly: (event) => {
      console.error(`[self-healing] 异常: ${event.type} @ ${event.component} [${event.severity}]: ${event.description}`);
    },
    onRemediation: (component, action, success) => {
      console.log(`[self-healing] 修复: ${action} @ ${component} → ${success ? "成功" : "失败"}`);
    },
  });

  system.registerHealthCheck({
    component: "gateway",
    intervalMs: 5_000,
    check: async () => {
      const httpStats = deps?.getHttpServerStats?.();
      return {
        component: "gateway",
        status: "healthy",
        latencyMs: httpStats?.avgLatencyMs ?? 0,
        lastCheckAt: Date.now(),
        metadata: httpStats,
      };
    },
  });

  system.registerHealthCheck({
    component: "memory",
    intervalMs: 10_000,
    check: async () => {
      const mem = process.memoryUsage();
      const pressurePercent = (mem.heapUsed / mem.heapLimit) * 100;
      return {
        component: "memory",
        status: pressurePercent > 90 ? "unhealthy" : pressurePercent > 70 ? "degraded" : "healthy",
        message: `堆: ${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(mem.heapLimit / 1024 / 1024).toFixed(0)}MB`,
        lastCheckAt: Date.now(),
        metadata: { pressurePercent, heapUsedMb: mem.heapUsed / 1024 / 1024, rssMb: mem.rss / 1024 / 1024, externalMb: mem.external / 1024 / 1024 },
      };
    },
  });

  system.registerRemediation({
    name: "gc-and-evict",
    component: "memory",
    cooldownMs: 30_000,
    maxAttempts: 3,
    execute: async () => {
      if (typeof globalThis.gc === "function") {
        globalThis.gc();
      }
      return { success: true, message: "已执行GC" };
    },
  });

  if (deps?.aiGateway) {
    system.registerHealthCheck({
      component: "ai-gateway",
      intervalMs: 15_000,
      check: async () => {
        const health = deps.aiGateway!.getProviderHealth();
        const providers = Object.values(health);
        const allDown = providers.length > 0 && providers.every((p) => !p.available);
        const someDown = providers.some((p) => !p.available);
        return {
          component: "ai-gateway",
          status: allDown ? "unhealthy" : someDown ? "degraded" : "healthy",
          message: `${providers.filter((p) => p.available).length}/${providers.length} 提供商可用`,
          lastCheckAt: Date.now(),
        };
      },
    });

    system.registerRemediation({
      name: "reset-circuit-breakers",
      component: "ai-gateway",
      cooldownMs: 60_000,
      maxAttempts: 1,
      execute: async () => {
        return { success: true, message: "熔断器将通过半开状态自动恢复" };
      },
    });
  }

  if (deps?.eventBus) {
    system.registerHealthCheck({
      component: "event-bus",
      intervalMs: 30_000,
      check: async () => {
        const stats = deps.eventBus!.getStats();
        return {
          component: "event-bus",
          status: "healthy",
          message: `${stats.activeSubscriptions} 订阅, ${stats.published} 已发布`,
          lastCheckAt: Date.now(),
          metadata: stats,
        };
      },
    });
  }

  if (deps?.semanticCache) {
    system.registerHealthCheck({
      component: "semantic-cache",
      intervalMs: 60_000,
      check: async () => {
        const stats = deps.semanticCache!.getStats();
        const unhealthy = stats.hitRate < 0.05 && stats.totalEntries > 100;
        return {
          component: "semantic-cache",
          status: unhealthy ? "degraded" : "healthy",
          message: `${stats.totalEntries} 条目, 命中率 ${(stats.hitRate * 100).toFixed(1)}%`,
          lastCheckAt: Date.now(),
          metadata: stats,
        };
      },
    });

    system.registerRemediation({
      name: "clear-low-quality-cache",
      component: "semantic-cache",
      cooldownMs: 120_000,
      execute: async () => {
        const stats = deps.semanticCache!.getStats();
        if (stats.hitRate < 0.05 && stats.totalEntries > 50) {
          deps.semanticCache!.clear();
          return { success: true, message: "已清理低质量缓存" };
        }
        return { success: false, message: "缓存质量可接受" };
      },
    });
  }

  if (deps?.getWsServerStats) {
    system.registerHealthCheck({
      component: "websocket",
      intervalMs: 15_000,
      check: async () => {
        const wsStats = deps.getWsServerStats!();
        return {
          component: "websocket",
          status: "healthy",
          message: `${wsStats.activeConnections} 活跃连接`,
          lastCheckAt: Date.now(),
          metadata: wsStats,
        };
      },
    });
  }

  return system;
}
