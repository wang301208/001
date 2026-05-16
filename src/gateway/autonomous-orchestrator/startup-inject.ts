import type { ZhushouConfig } from "../../config/types.zhushou.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type AutonomousStartupResult = {
  orchestrator: import("../autonomous-orchestrator/orchestrator.js").AutonomousOrchestrator;
  auditChain: import("../audit-chain/chain.js").AuditChain;
  defense: import("../self-defense/defense.js").SelfDefenseSystem;
  configEvolution: import("../config-evolution/evolution.js").ConfigEvolution;
};

export async function injectAutonomousModules(params: {
  cfg: ZhushouConfig;
  log: SubsystemLogger;
  enabled?: boolean;
}): Promise<AutonomousStartupResult | null> {
  if (params.enabled === false) {
    params.log.info("自治系统已禁用 (ZHUSHOU_AUTONOMOUS_ENABLED=false)");
    return null;
  }

  const isExplicitlyEnabled = process.env.ZHUSHOU_AUTONOMOUS_ENABLED === "true";
  const isNotExplicitlyDisabled = process.env.ZHUSHOU_AUTONOMOUS_ENABLED !== "false";
  if (!isExplicitlyEnabled && !isNotExplicitlyDisabled) {
    return null;
  }

  params.log.info("启动自治系统...");

  const { createAutonomousOrchestrator } = await import("../autonomous-orchestrator/orchestrator.js");
  const { createAuditChain } = await import("../audit-chain/chain.js");
  const { createSelfDefenseSystem } = await import("../self-defense/defense.js");
  const { createConfigEvolution } = await import("../config-evolution/evolution.js");

  const orchestrator = createAutonomousOrchestrator({
    enableSelfHealing: true,
    enableEventBus: true,
    enableSemanticCache: true,
    enableCostGovernance: true,
    enableKnowledgeBuilder: true,
    enablePredictivePreheater: true,
    cacheSimilarityThreshold: 0.92,
    preheaterThreshold: 0.7,
  });

  const auditChain = createAuditChain();

  const defense = createSelfDefenseSystem({
    blockDurationMs: 300_000,
    maxActiveBlocks: 1000,
  });

  const configEvolution = createConfigEvolution();

  configEvolution.registerParameter({
    path: "gateway.maxConcurrentRequests",
    currentValue: 100,
    minValue: 10,
    maxValue: 1000,
    step: 10,
    impact: "high",
  });

  configEvolution.registerParameter({
    path: "gateway.requestTimeoutMs",
    currentValue: 60_000,
    minValue: 5_000,
    maxValue: 300_000,
    step: 5_000,
    impact: "medium",
  });

  configEvolution.registerParameter({
    path: "gateway.cacheTtlMs",
    currentValue: 300_000,
    minValue: 10_000,
    maxValue: 3_600_000,
    step: 30_000,
    impact: "low",
  });

  auditChain.append({
    actor: "system",
    action: "autonomous-startup",
    resource: "gateway",
    outcome: "success",
    metadata: { modules: "orchestrator,audit-chain,defense,config-evolution" },
  });

  await orchestrator.start();

  params.log.info("自治系统启动完成");

  return { orchestrator, auditChain, defense, configEvolution };
}

export async function shutdownAutonomousModules(
  modules: AutonomousStartupResult,
  log: SubsystemLogger,
): Promise<void> {
  log.info("关闭自治系统...");

  modules.auditChain.append({
    actor: "system",
    action: "autonomous-shutdown",
    resource: "gateway",
    outcome: "success",
  });

  await modules.orchestrator.stop();
  log.info("自治系统已关闭");
}
