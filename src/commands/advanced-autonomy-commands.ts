/**
 * 高级自主 CLI 命令注册
 * 
 * 将高级自主功能集成到CLI系统中
 */

import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import {
  strategicPlanner,
  resourceScheduler,
  learningEngine,
  collaborationCoordinator,
} from "../governance/advanced-autonomy.js";

export function registerAdvancedAutonomyCommands(program: Command, runtime: RuntimeEnv): void {
  const autonomyGroup = program.command("advanced-autonomy").description("高级自治系统管理");

  // ==================== 战略规划命令 ====================

  const strategyGroup = autonomyGroup.command("strategy").description("战略规划管理");

  strategyGroup
    .command("create-plan")
    .description("创建新的战略规划")
    .requiredOption("--name <name>", "规划名称")
    .option("--timeframe <months>", "时间范围（月）", "12")
    .action(async (options) => {
      console.log(`📋 创建战略规划: ${options.name}`);
      
      try {
        const plan = await strategicPlanner.createPlan(
          options.name,
          parseInt(options.timeframe)
        );
        
        console.log("\n✅ 战略规划创建成功！\n");
        console.log(`ID: ${plan.id}`);
        console.log(`名称: ${plan.name}`);
        console.log(`版本: ${plan.version}`);
        console.log(`目标数量: ${plan.goals.length}`);
        console.log(`路线图阶段: ${plan.roadmap.length}`);
        console.log(`\n资源分配:`);
        console.log(`  - 计算资源: ${plan.resourceAllocation.compute}%`);
        console.log(`  - 存储资源: ${plan.resourceAllocation.storage}%`);
        console.log(`  - 网络资源: ${plan.resourceAllocation.network}%`);
        console.log(`\n风险评估 (${plan.riskAssessment.length} 项):`);
        plan.riskAssessment.forEach((risk, i) => {
          console.log(`  ${i + 1}. ${risk.risk} (概率: ${risk.probability}, 影响: ${risk.impact})`);
        });
      } catch (error) {
        console.error("❌ 创建战略规划失败:", error);
        runtime.exit(1);
      }
    });

  strategyGroup
    .command("list-plans")
    .description("列出所有战略规划")
    .action(() => {
      const plans = strategicPlanner.getPlans();
      
      if (plans.length === 0) {
        console.log("📭 暂无战略规划");
        return;
      }
      
      console.log(`\n📊 战略规划列表 (${plans.length} 个):\n`);
      
      plans.forEach((plan, index) => {
        console.log(`${index + 1}. ${plan.name}`);
        console.log(`   ID: ${plan.id}`);
        console.log(`   版本: ${plan.version}`);
        console.log(`   目标数: ${plan.goals.length}`);
        console.log(`   创建时间: ${new Date(plan.createdAt).toLocaleString()}`);
        console.log(`   过期时间: ${new Date(plan.expiresAt).toLocaleString()}`);
        console.log();
      });
    });

  strategyGroup
    .command("show-goals")
    .description("显示活跃目标")
    .action(() => {
      const goals = strategicPlanner.getActiveGoals();
      
      if (goals.length === 0) {
        console.log("🎯 暂无活跃目标");
        return;
      }
      
      console.log(`\n🎯 活跃目标 (${goals.length} 个):\n`);
      
      goals.forEach((goal, index) => {
        const priorityStars = "⭐".repeat(Math.ceil(goal.priority / 2));
        console.log(`${index + 1}. ${goal.name} ${priorityStars}`);
        console.log(`   描述: ${goal.description}`);
        console.log(`   优先级: ${goal.priority}/10`);
        console.log(`   时间范围: ${goal.timeframe}`);
        console.log(`   状态: ${goal.status}`);
        console.log();
      });
    });

  // ==================== 资源调度命令 ====================

  const resourceGroup = autonomyGroup.command("resource").description("资源调度管理");

  resourceGroup
    .command("stats")
    .description("显示资源使用统计")
    .action(() => {
      const stats = resourceScheduler.getResourceStats();
      
      console.log("\n📊 资源使用统计:\n");
      
      Object.entries(stats).forEach(([type, data]) => {
        const usageBar = "█".repeat(Math.round(data.usagePercent / 5)) + 
                        "░".repeat(20 - Math.round(data.usagePercent / 5));
        
        console.log(`${type.toUpperCase()}:`);
        console.log(`  [${usageBar}] ${data.usagePercent}%`);
        console.log(`  总量: ${data.total} | 已用: ${data.used} | 可用: ${data.available}`);
        console.log();
      });
    });

  // ==================== 学习进化命令 ====================

  const learningGroup = autonomyGroup.command("learning").description("学习进化管理");

  learningGroup
    .command("stats")
    .description("显示学习统计")
    .action(() => {
      const stats = learningEngine.getLearningStats();
      
      console.log("\n🧠 学习统计:\n");
      console.log(`总事件数: ${stats.totalEvents}`);
      console.log(`成功率: ${stats.successRate}%`);
      console.log(`平均质量: ${stats.averageQuality}/1.0`);
      
      if (stats.topInsights.length > 0) {
        console.log(`\n📚 前 ${stats.topInsights.length} 条洞察:`);
        stats.topInsights.forEach((insight, index) => {
          console.log(`  ${index + 1}. ${insight.insight} (出现 ${insight.count} 次)`);
        });
      }
    });

  learningGroup
    .command("rules")
    .description("显示适应规则")
    .action(() => {
      const rules = learningEngine.getAdaptationRules();
      
      if (rules.length === 0) {
        console.log("📜 暂无适应规则");
        return;
      }
      
      console.log(`\n📜 适应规则 (${rules.length} 个):\n`);
      
      rules.forEach((rule, index) => {
        console.log(`${index + 1}. 规则 ID: ${rule.id}`);
        console.log(`   触发次数: ${rule.triggerCount}`);
        console.log(`   成功率: ${Math.round(rule.successRate * 100)}%`);
        if (rule.lastTriggered) {
          console.log(`   最后触发: ${new Date(rule.lastTriggered).toLocaleString()}`);
        }
        console.log();
      });
    });

  // ==================== 协作协调命令 ====================

  const collaborationGroup = autonomyGroup.command("collaboration").description("协作协调管理");

  collaborationGroup
    .command("stats")
    .description("显示协作统计")
    .action(() => {
      const stats = collaborationCoordinator.getCollaborationStats();
      
      console.log("\n🤝 协作统计:\n");
      console.log(`总任务数: ${stats.totalTasks}`);
      console.log(`成功率: ${stats.successRate}%`);
      console.log(`平均持续时间: ${stats.averageDuration}ms`);
      
      if (Object.keys(stats.agentUtilization).length > 0) {
        console.log(`\n👥 代理利用率:`);
        Object.entries(stats.agentUtilization).forEach(([agentId, utilization]) => {
          const bar = "█".repeat(Math.round(utilization / 5)) + 
                     "░".repeat(20 - Math.round(utilization / 5));
          console.log(`  ${agentId}: [${bar}] ${utilization.toFixed(1)}%`);
        });
      }
    });

  // ==================== 启动完整自治循环 ====================

  autonomyGroup
    .command("start-full-loop")
    .description("启动完整的自治循环（包括战略规划、资源调度、学习进化）")
    .option("--planning-interval <ms>", "规划更新间隔（毫秒）", String(7 * 24 * 60 * 60 * 1000))
    .action((options) => {
      console.log("🚀 启动完整自治循环...\n");
      
      // 启动定期战略规划
      strategicPlanner.startPeriodicPlanning(parseInt(options.planningInterval));
      console.log("✅ 战略规划引擎已启动");
      
      console.log("\n💡 提示: 使用以下命令监控系统状态:");
      console.log("  zhushou advanced-autonomy strategy list-plans");
      console.log("  zhushou advanced-autonomy resource stats");
      console.log("  zhushou advanced-autonomy learning stats");
      console.log("  zhushou advanced-autonomy collaboration stats");
      console.log("\n按 Ctrl+C 停止\n");
      
      // 保持进程运行
      process.on("SIGINT", () => {
        console.log("\n\n🛑 停止自治循环...");
        process.exit(0);
      });
    });

  // ==================== 显示自治状态概览 ====================

  autonomyGroup
    .command("status")
    .description("显示高级自治系统状态概览")
    .action(() => {
      console.log("\n🌟 高级自治系统状态概览\n");
      console.log("=".repeat(60));
      
      // 战略规划状态
      const plans = strategicPlanner.getPlans();
      const goals = strategicPlanner.getActiveGoals();
      console.log(`\n📋 战略规划:`);
      console.log(`  活跃规划: ${plans.length} 个`);
      console.log(`  活跃目标: ${goals.length} 个`);
      
      // 资源调度状态
      const resourceStats = resourceScheduler.getResourceStats();
      console.log(`\n💻 资源调度:`);
      Object.entries(resourceStats).forEach(([type, data]) => {
        console.log(`  ${type}: ${data.usagePercent}% 使用率`);
      });
      
      // 学习进化状态
      const learningStats = learningEngine.getLearningStats();
      console.log(`\n🧠 学习进化:`);
      console.log(`  学习事件: ${learningStats.totalEvents} 个`);
      console.log(`  成功率: ${learningStats.successRate}%`);
      console.log(`  平均质量: ${learningStats.averageQuality}/1.0`);
      
      // 协作协调状态
      const collabStats = collaborationCoordinator.getCollaborationStats();
      console.log(`\n🤝 协作协调:`);
      console.log(`  总任务: ${collabStats.totalTasks} 个`);
      console.log(`  成功率: ${collabStats.successRate}%`);
      console.log(`  平均耗时: ${collabStats.averageDuration}ms`);
      
      console.log("\n" + "=".repeat(60));
      console.log("\n💡 提示: 使用子命令查看详细信息");
      console.log("  zhushou advanced-autonomy strategy --help");
      console.log("  zhushou advanced-autonomy resource --help");
      console.log("  zhushou advanced-autonomy learning --help");
      console.log("  zhushou advanced-autonomy collaboration --help\n");
    });
}
