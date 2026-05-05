/**
 * 因果关系引擎演示脚本
 * 
 * 展示因果关系引擎的核心功能
 */

import { CausalGraph } from "../src/governance/causality-engine.js";

function demo() {
  console.log("=".repeat(80));
  console.log("🧠 因果关系引擎演示");
  console.log("=".repeat(80));
  console.log();

  const graph = new CausalGraph();

  // ==================== 场景1: 系统故障诊断 ====================
  console.log("📋 场景1: 系统故障根因分析\n");

  // 创建故障传播链
  graph.addEvent({
    id: "memory-leak",
    timestamp: 1000,
    type: "error",
    description: "模块X存在内存泄漏",
    actor: "garbage-collector",
    causes: [],
    effects: [],
    strength: "strong",
    confidence: 0.95,
    metadata: {
      tags: ["performance", "critical"],
      priority: "critical",
    },
  });

  graph.addEvent({
    id: "high-memory-usage",
    timestamp: 2000,
    type: "state_change",
    description: "内存使用率达到95%",
    causes: ["memory-leak"],
    effects: [],
    strength: "strong",
    confidence: 0.9,
  });

  graph.addEvent({
    id: "slow-response",
    timestamp: 3000,
    type: "error",
    description: "API响应时间超过5秒",
    causes: ["high-memory-usage"],
    effects: [],
    strength: "moderate",
    confidence: 0.8,
  });

  graph.addEvent({
    id: "user-complaints",
    timestamp: 4000,
    type: "observation",
    description: "用户报告系统缓慢",
    causes: ["slow-response"],
    effects: [],
    strength: "moderate",
    confidence: 0.75,
  });

  // 执行根因分析
  const analysis = graph.analyzeRootCause("user-complaints");

  console.log(`目标事件: user-complaints`);
  console.log(`置信度: ${(analysis.confidence * 100).toFixed(1)}%\n`);

  console.log(`根因 (${analysis.rootCauses.length}个):\n`);
  analysis.rootCauses.forEach((rc, index) => {
    console.log(`${index + 1}. ${rc.explanation}`);
    console.log(`   距离: ${rc.distance} 步`);
    console.log(`   强度: ${(rc.strength * 100).toFixed(1)}%`);
    console.log();
  });

  console.log(`建议:\n`);
  analysis.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`);
  });

  console.log("\n" + "-".repeat(80) + "\n");

  // ==================== 场景2: 决策影响预测 ====================
  console.log("📋 场景2: 决策影响预测\n");

  const decisionGraph = new CausalGraph();

  decisionGraph.addEvent({
    id: "upgrade-database",
    timestamp: 1000,
    type: "decision",
    description: "决定升级数据库到v5.0",
    actor: "tech-lead",
    causes: [],
    effects: ["migration-required", "performance-improvement"],
    strength: "strong",
    confidence: 0.9,
  });

  decisionGraph.addEvent({
    id: "migration-required",
    timestamp: 2000,
    type: "action",
    description: "需要执行数据迁移",
    causes: ["upgrade-database"],
    effects: [],
    strength: "strong",
    confidence: 0.95,
  });

  decisionGraph.addEvent({
    id: "performance-improvement",
    timestamp: 3000,
    type: "state_change",
    description: "查询性能提升40%",
    causes: ["upgrade-database"],
    effects: [],
    strength: "moderate",
    confidence: 0.7,
  });

  const inference = decisionGraph.inferEffects("upgrade-database");

  console.log(`前提事件: upgrade-database`);
  console.log(`推理置信度: ${(inference.confidence * 100).toFixed(1)}%\n`);

  console.log(`可能的结果 (${inference.possibleEffects.length}个):\n`);
  inference.possibleEffects.forEach((effect, index) => {
    console.log(`${index + 1}. ${effect.description}`);
    console.log(`   概率: ${(effect.probability * 100).toFixed(1)}%`);
    if (effect.timeframe) {
      console.log(`   时间范围: ${effect.timeframe}`);
    }
    console.log();
  });

  console.log(`推理解释:\n${inference.reasoning}\n`);

  console.log("-".repeat(80) + "\n");

  // ==================== 场景3: 反事实推理 ====================
  console.log("📋 场景3: 反事实推理\n");

  const counterfactualGraph = new CausalGraph();

  counterfactualGraph.addEvent({
    id: "security-patch",
    timestamp: 1000,
    type: "action",
    description: "应用安全补丁CVE-2026-001",
    actor: "security-team",
    causes: [],
    effects: ["vulnerability-fixed"],
    strength: "strong",
    confidence: 0.95,
  });

  counterfactualGraph.addEvent({
    id: "vulnerability-fixed",
    timestamp: 2000,
    type: "state_change",
    description: "漏洞已修复",
    causes: ["security-patch"],
    effects: [],
    strength: "strong",
    confidence: 0.9,
  });

  const counterfactual = counterfactualGraph.analyzeCounterfactual(
    "security-patch",
    "如果没有应用安全补丁"
  );

  console.log(`原始事件: security-patch`);
  console.log(`假设场景: ${counterfactual.hypotheticalScenario}\n`);

  console.log(`预测结果:`);
  console.log(`  会发生改变: ${counterfactual.predictedOutcome.wouldHappen ? "是" : "否"}`);
  console.log(`  概率: ${(counterfactual.predictedOutcome.probability * 100).toFixed(1)}%`);
  console.log(`  解释: ${counterfactual.predictedOutcome.explanation}\n`);

  if (counterfactual.predictedOutcome.alternativeEvents.length > 0) {
    console.log(`替代事件:\n`);
    counterfactual.predictedOutcome.alternativeEvents.forEach((alt, index) => {
      console.log(`  ${index + 1}. ${alt}`);
    });
    console.log();
  }

  console.log(`关键依赖 (${counterfactual.keyDependencies.length}个):\n`);
  counterfactual.keyDependencies.forEach((dep, index) => {
    console.log(`  ${index + 1}. ${dep}`);
  });

  console.log(`\n置信度: ${(counterfactual.confidence * 100).toFixed(1)}%`);

  console.log("\n" + "-".repeat(80) + "\n");

  // ==================== 场景4: 路径分析 ====================
  console.log("📋 场景4: 因果路径分析\n");

  const pathGraph = new CausalGraph();

  // 创建多条路径
  pathGraph.addEvent({
    id: "user-login",
    timestamp: 1000,
    type: "action",
    description: "用户登录",
    causes: [],
    effects: ["auth-success"],
    strength: "strong",
    confidence: 0.95,
  });

  pathGraph.addEvent({
    id: "auth-success",
    timestamp: 2000,
    type: "reaction",
    description: "认证成功",
    causes: ["user-login"],
    effects: ["session-created", "admin-access"],
    strength: "strong",
    confidence: 0.9,
  });

  pathGraph.addEvent({
    id: "session-created",
    timestamp: 3000,
    type: "state_change",
    description: "会话创建",
    causes: ["auth-success"],
    effects: ["data-access"],
    strength: "strong",
    confidence: 0.85,
  });

  pathGraph.addEvent({
    id: "data-access",
    timestamp: 4000,
    type: "action",
    description: "访问数据",
    causes: ["session-created"],
    effects: ["data-export"],
    strength: "moderate",
    confidence: 0.8,
  });

  pathGraph.addEvent({
    id: "admin-access",
    timestamp: 3000,
    type: "action",
    description: "管理员面板访问",
    causes: ["auth-success"],
    effects: ["data-export"],
    strength: "moderate",
    confidence: 0.75,
  });

  pathGraph.addEvent({
    id: "data-export",
    timestamp: 5000,
    type: "action",
    description: "数据导出",
    causes: ["data-access", "admin-access"],
    effects: [],
    strength: "moderate",
    confidence: 0.8,
  });

  const paths = pathGraph.findAllPaths("user-login", "data-export");

  console.log(`从 user-login 到 data-export 的路径:\n`);
  console.log(`找到 ${paths.length} 条路径:\n`);

  paths.forEach((path, index) => {
    console.log(`${index + 1}. 路径: ${path.path.join(" → ")}`);
    console.log(`   长度: ${path.length}`);
    console.log(`   总强度: ${(path.totalStrength * 100).toFixed(1)}%`);
    console.log();
  });

  console.log("-".repeat(80) + "\n");

  // ==================== 统计信息 ====================
  console.log("📊 因果图统计信息\n");

  const stats = pathGraph.getStats();

  console.log(`总事件数: ${stats.totalEvents}`);
  console.log(`总边数: ${stats.totalEdges}`);
  console.log(`平均度数: ${stats.avgDegree.toFixed(2)}`);
  console.log(`最大深度: ${stats.maxDepth}`);
  console.log(`连通分量: ${stats.connectedComponents}`);
  console.log(`\n事件类型分布:`);
  
  for (const [type, count] of Object.entries(stats.eventTypeDistribution)) {
    if (count > 0) {
      console.log(`  - ${type}: ${count}`);
    }
  }

  console.log(`\n时间范围:`);
  console.log(`  - 最早: ${new Date(stats.timeRange.earliest).toISOString()}`);
  console.log(`  - 最晚: ${new Date(stats.timeRange.latest).toISOString()}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ 演示完成！");
  console.log("=".repeat(80));
}

demo();
