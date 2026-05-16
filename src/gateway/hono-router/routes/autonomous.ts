import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { AutonomousOrchestrator } from "../../autonomous-orchestrator/orchestrator.js";
import type { AuditChain } from "../../audit-chain/chain.js";
import type { SelfDefenseSystem } from "../../self-defense/defense.js";
import type { ConfigEvolution } from "../../config-evolution/evolution.js";
import type { SemanticCache } from "../../semantic-cache/cache.js";
import type { CostGovernance } from "../../cost-governance/governance.js";

export type AutonomousEndpointDeps = {
  orchestrator?: AutonomousOrchestrator;
  auditChain?: AuditChain;
  defense?: SelfDefenseSystem;
  configEvolution?: ConfigEvolution;
  semanticCache?: SemanticCache;
  costGovernance?: CostGovernance;
};

export function registerAutonomousRoutes(app: Hono<GatewayHonoEnv>, deps: AutonomousEndpointDeps): void {
  app.get("/autonomous/status", (c) => {
    if (!deps.orchestrator) {
      return c.json({ enabled: false, reason: "自治系统未启动" }, 200);
    }
    const status = deps.orchestrator.getStatus();
    return c.json({
      enabled: true,
      running: status.running,
      startedAt: status.startedAt,
      uptimeMs: status.uptimeMs,
      modules: status.modules,
    });
  });

  app.get("/autonomous/modules", (c) => {
    if (!deps.orchestrator) {
      return c.json({ modules: {} }, 200);
    }
    const modules = deps.orchestrator.getModules();
    const result: Record<string, { active: boolean; info?: Record<string, unknown> }> = {};

    if (modules.selfHealing) {
      result.selfHealing = { active: true, info: { checks: modules.selfHealing.getChecks().length } };
    }
    if (modules.eventBus) {
      result.eventBus = { active: true, info: { name: "zhushou-autonomous" } };
    }
    if (modules.semanticCache) {
      result.semanticCache = { active: true, info: modules.semanticCache.getStats() };
    }
    if (modules.costGovernance) {
      result.costGovernance = { active: true };
    }
    if (modules.preheater) {
      result.preheater = { active: true };
    }
    if (modules.knowledgeBuilder) {
      result.knowledgeBuilder = { active: true };
    }
    if (modules.aiRouter) {
      result.aiRouter = { active: true, info: { providers: Object.keys(modules.aiRouter.getMetrics()).length } };
    }
    if (modules.gossipCluster) {
      result.gossipCluster = { active: true };
    }

    return c.json({ modules: result });
  });

  app.get("/autonomous/audit", (c) => {
    if (!deps.auditChain) {
      return c.json({ entries: [], total: 0 }, 200);
    }
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Number(c.req.query("offset") ?? 0);
    const allEntries = deps.auditChain.getEntries();
    const entries = allEntries.slice(offset, offset + limit);
    return c.json({
      entries,
      total: allEntries.length,
      rootHash: deps.auditChain.getRootHash(),
      integrity: deps.auditChain.verify(),
    });
  });

  app.get("/autonomous/audit/:id", (c) => {
    if (!deps.auditChain) {
      return c.json({ error: { message: "审计链未启用" } }, 404);
    }
    const id = c.req.param("id");
    const entry = deps.auditChain.getEntry(id);
    if (!entry) {
      return c.json({ error: { message: "审计条目未找到" } }, 404);
    }
    const proof = deps.auditChain.merkleProof(id);
    return c.json({ entry, proof });
  });

  app.get("/autonomous/defense", (c) => {
    if (!deps.defense) {
      return c.json({ enabled: false }, 200);
    }
    return c.json({
      enabled: true,
      stats: deps.defense.getStats(),
      activeBlocks: deps.defense.getActiveBlocks(),
    });
  });

  app.get("/autonomous/cache", (c) => {
    if (!deps.semanticCache) {
      return c.json({ enabled: false }, 200);
    }
    return c.json({
      enabled: true,
      stats: deps.semanticCache.getStats(),
    });
  });

  app.get("/autonomous/cost", (c) => {
    if (!deps.costGovernance) {
      return c.json({ enabled: false }, 200);
    }
    const tenantId = c.req.query("tenant") ?? "default";
    return c.json({
      enabled: true,
      quota: deps.costGovernance.getTenantQuota(tenantId),
      dailyReport: deps.costGovernance.getDailyReport(tenantId),
      suggestions: deps.costGovernance.getCostOptimizationSuggestions(tenantId),
    });
  });
}
