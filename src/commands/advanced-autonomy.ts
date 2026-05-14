/**
 * 高级自主 CLI 命令
 * 
 * 提供战略规划、资源调度、学习进化和协作协调的命令行接口
 */

import { Command } from "commander";
import {
  strategicPlanner,
  resourceScheduler,
  learningEngine,
  collaborationCoordinator,
} from "../governance/advanced-autonomy.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("cli-advanced-autonomy");

export function registerAdvancedAutonomyCommands(program: Command): void {
  const autonomyGroup = program
    .command("autonomy")
    .description("高级自治系统管理命令");

  // ==================== 战略规划命令 ====================

  const strategyGroup = autonomyGroup
    .command("strategy")
    .description("战略规划管理");

  strategyGroup
    .command("create-plan")
    .description("创建新的战略规划")
    .requiredOption("--name <name>", "规划名称")
    .option("--timeframe <months>", "时间范围（月）", "12")
    .action(async (options) => {
      log.info(`📋 创建战略规划: ${options.name}`);
      
      try {
        const plan = await strategicPlanner.createPlan(
          options.name,
          parseInt(options.timeframe)
        );
        
        log.info("\n✅ 战略规划创建成功！\n");
        log.info(`ID: ${plan.id}`);
        log.info(`名称: ${plan.name}`);
        log.info(`版本: ${plan.version}`);
        log.info(`目标数量: ${plan.goals.length}`);
        log.info(`路线图阶段: ${plan.roadmap.length}`);
        log.info(`\n资源分配:`);
        log.info(`  - 计算资源: ${plan.resourceAllocation.compute}%`);
        log.info(`  - 存储资源: ${plan.resourceAllocation.storage}%`);
        log.info(`  - 网络资源: ${plan.resourceAllocation.network}%`);
        log.info(`\n风险评估 (${plan.riskAssessment.length} 项):`);
        plan.riskAssessment.forEach((risk, i) => {
          log.info(`  ${i + 1}. ${risk.risk} (概率: ${risk.probability}, 影响: ${risk.impact})`);
        });
      } catch (error) {
        log.error("❌ 创建战略规划失败:", error);
        process.exit(1);
      }
    });

  strategyGroup
    .command("list-plans")
    .description("列出所有战略规划")
    .action(() => {
      const plans = strategicPlanner.getPlans();
      
      if (plans.length === 0) {
        log.info("📭 暂无战略规划");
        return;
      }
      
      log.info(`\n📊 战略规划列表 (${plans.length} 个):\n`);
      
      plans.forEach((plan, index) => {
        log.info(`${index + 1}. ${plan.name}`);
        log.info(`   ID: ${plan.id}`);
        log.info(`   版本: ${plan.version}`);
        log.info(`   目标数: ${plan.goals.length}`);
        log.info(`   创建时间: ${new Date(plan.createdAt).toLocaleString()}`);
        log.info(`   过期时间: ${new Date(plan.expiresAt).toLocaleString()}`);
        log.info();
      });
    });

  strategyGroup
    .command("show-goals")
    .description("显示活跃目标")
    .action(() => {
      const goals = strategicPlanner.getActiveGoals();
      
      if (goals.length === 0) {
        log.info("🎯 暂无活跃目标");
        return;
      }
      
      log.info(`\n🎯 活跃目标 (${goals.length} 个):\n`);
      
      goals.forEach((goal, index) => {
        const priorityStars = "⭐".repeat(Math.ceil(goal.priority / 2));
        log.info(`${index + 1}. ${goal.name} ${priorityStars}`);
        log.info(`   描述: ${goal.description}`);
        log.info(`   优先级: ${goal.priority}/10`);
        log.info(`   时间范围: ${goal.timeframe}`);
        log.info(`   状态: ${goal.status}`);
        log.info();
      });
    });

  // ==================== 资源调度命令 ====================

  const resourceGroup = autonomyGroup
    .command("resource")
    .description("资源调度管理");

  resourceGroup
    .command("stats")
    .description("显示资源使用统计")
    .action(() => {
      const stats = resourceScheduler.getResourceStats();
      
      log.info("\n📊 资源使用统计:\n");
      
      Object.entries(stats).forEach(([type, data]) => {
        const usageBar = "█".repeat(Math.round(data.usagePercent / 5)) + 
                        "░".repeat(20 - Math.round(data.usagePercent / 5));
        
        log.info(`${type.toUpperCase()}:`);
        log.info(`  [${usageBar}] ${data.usagePercent}%`);
        log.info(`  总量: ${data.total} | 已用: ${data.used} | 可用: ${data.available}`);
        log.info();
      });
    });

  resourceGroup
    .command("request")
    .description("请求资源分配")
    .requiredOption("--type <type>", "资源类型 (compute/memory/storage/network)")
    .requiredOption("--amount <amount>", "请求数量")
    .requiredOption("--priority <priority>", "优先级 (1-10)", "5")
    .option("--requester <requester>", "请求者", "unknown")
    .action(async (options) => {
      log.info(`🔄 请求资源: ${options.type} (${options.amount})`);
      
      try {
        const allocation = await resourceScheduler.requestResource({
          id: `req-${Date.now()}`,
          requester: options.requester,
          resourceType: options.type,
          amount: parseFloat(options.amount),
          priority: parseInt(options.priority),
        });
        
        log.info("\n✅ 资源分配成功！\n");
        log.info(`请求 ID: ${allocation.requestId}`);
        log.info(`分配数量: ${allocation.allocated}`);
        log.info(`开始时间: ${new Date(allocation.startTime).toLocaleString()}`);
        log.info(`状态: ${allocation.status}`);
      } catch (error) {
        log.error("❌ 资源请求失败:", error);
        process.exit(1);
      }
    });

  // ==================== 学习进化命令 ====================

  const learningGroup = autonomyGroup
    .command("learning")
    .description("学习进化管理");

  learningGroup
    .command("stats")
    .description("显示学习统计")
    .action(() => {
      const stats = learningEngine.getLearningStats();
      
      log.info("\n🧠 学习统计:\n");
      log.info(`总事件数: ${stats.totalEvents}`);
      log.info(`成功率: ${stats.successRate}%`);
      log.info(`平均质量: ${stats.averageQuality}/1.0`);
      
      if (stats.topInsights.length > 0) {
        log.info(`\n📚 前 ${stats.topInsights.length} 条洞察:`);
        stats.topInsights.forEach((insight, index) => {
          log.info(`  ${index + 1}. ${insight.insight} (出现 ${insight.count} 次)`);
        });
      }
    });

  learningGroup
    .command("rules")
    .description("显示适应规则")
    .action(() => {
      const rules = learningEngine.getAdaptationRules();
      
      if (rules.length === 0) {
        log.info("📜 暂无适应规则");
        return;
      }
      
      log.info(`\n📜 适应规则 (${rules.length} 个):\n`);
      
      rules.forEach((rule, index) => {
        log.info(`${index + 1}. 规则 ID: ${rule.id}`);
        log.info(`   触发次数: ${rule.triggerCount}`);
        log.info(`   成功率: ${Math.round(rule.successRate * 100)}%`);
        if (rule.lastTriggered) {
          log.info(`   最后触发: ${new Date(rule.lastTriggered).toLocaleString()}`);
        }
        log.info();
      });
    });

  // ==================== 协作协调命令 ====================

  const collaborationGroup = autonomyGroup
    .command("collaboration")
    .description("协作协调管理");

  collaborationGroup
    .command("stats")
    .description("显示协作统计")
    .action(() => {
      const stats = collaborationCoordinator.getCollaborationStats();
      
      log.info("\n🤝 协作统计:\n");
      log.info(`总任务数: ${stats.totalTasks}`);
      log.info(`成功率: ${stats.successRate}%`);
      log.info(`平均持续时间: ${stats.averageDuration}ms`);
      
      if (Object.keys(stats.agentUtilization).length > 0) {
        log.info(`\n👥 代理利用率:`);
        Object.entries(stats.agentUtilization).forEach(([agentId, utilization]) => {
          const bar = "█".repeat(Math.round(utilization / 5)) + 
                     "░".repeat(20 - Math.round(utilization / 5));
          log.info(`  ${agentId}: [${bar}] ${utilization.toFixed(1)}%`);
        });
      }
    });

  collaborationGroup
    .command("create-task")
    .description("创建协作任务")
    .requiredOption("--description <desc>", "任务描述")
    .requiredOption("--capabilities <caps>", "所需能力（逗号分隔）")
    .option("--priority <priority>", "优先级 (1-10)", "5")
    .action(async (options) => {
      log.info(`📝 创建协作任务: ${options.description}`);
      
      try {
        const task = await collaborationCoordinator.createTask({
          description: options.description,
          requiredCapabilities: options.capabilities.split(",").map((c: string) => c.trim()),
          priority: parseInt(options.priority),
        });
        
        log.info("\n✅ 协作任务创建成功！\n");
        log.info(`任务 ID: ${task.id}`);
        log.info(`描述: ${task.description}`);
        log.info(`所需能力: ${task.requiredCapabilities.join(", ")}`);
        log.info(`优先级: ${task.priority}/10`);
        log.info(`分配代理: ${task.assignedAgents.length > 0 ? task.assignedAgents.join(", ") : "无"}`);
        log.info(`状态: ${task.status}`);
      } catch (error) {
        log.error("❌ 创建任务失败:", error);
        process.exit(1);
      }
    });

  // ==================== 启动完整自治循环 ====================

  autonomyGroup
    .command("start-full-loop")
    .description("启动完整的自治循环（包括战略规划、资源调度、学习进化）")
    .option("--planning-interval <ms>", "规划更新间隔（毫秒）", String(7 * 24 * 60 * 60 * 1000))
    .action((options) => {
      log.info("🚀 启动完整自治循环...\n");
      
      // 启动定期战略规划
      strategicPlanner.startPeriodicPlanning(parseInt(options.planningInterval));
      log.info("✅ 战略规划引擎已启动");
      
      // TODO: 启动其他自治组件
      
      log.info("\n💡 提示: 使用以下命令监控系统状态:");
      log.info("  zhushou autonomy strategy list-plans");
      log.info("  zhushou autonomy resource stats");
      log.info("  zhushou autonomy learning stats");
      log.info("  zhushou autonomy collaboration stats");
      log.info("\n按 Ctrl+C 停止\n");
      
      // 保持进程运行
      process.on("SIGINT", () => {
        log.info("\n\n🛑 停止自治循环...");
        process.exit(0);
      });
    });

  // ==================== 显示自治状态概览 ====================

  autonomyGroup
    .command("status")
    .description("显示高级自治系统状态概览")
    .action(() => {
      log.info("\n🌟 高级自治系统状态概览\n");
      log.info("=" .repeat(60));
      
      // 战略规划状态
      const plans = strategicPlanner.getPlans();
      const goals = strategicPlanner.getActiveGoals();
      log.info(`\n📋 战略规划:`);
      log.info(`  活跃规划: ${plans.length} 个`);
      log.info(`  活跃目标: ${goals.length} 个`);
      
      // 资源调度状态
      const resourceStats = resourceScheduler.getResourceStats();
      log.info(`\n💻 资源调度:`);
      Object.entries(resourceStats).forEach(([type, data]) => {
        log.info(`  ${type}: ${data.usagePercent}% 使用率`);
      });
      
      // 学习进化状态
      const learningStats = learningEngine.getLearningStats();
      log.info(`\n🧠 学习进化:`);
      log.info(`  学习事件: ${learningStats.totalEvents} 个`);
      log.info(`  成功率: ${learningStats.successRate}%`);
      log.info(`  平均质量: ${learningStats.averageQuality}/1.0`);
      
      // 协作协调状态
      const collabStats = collaborationCoordinator.getCollaborationStats();
      log.info(`\n🤝 协作协调:`);
      log.info(`  总任务: ${collabStats.totalTasks} 个`);
      log.info(`  成功率: ${collabStats.successRate}%`);
      log.info(`  平均耗时: ${collabStats.averageDuration}ms`);
      
      log.info("\n" + "=".repeat(60));
      log.info("\n💡 提示: 使用子命令查看详细信息");
      log.info("  zhushou autonomy strategy --help");
      log.info("  zhushou autonomy resource --help");
      log.info("  zhushou autonomy learning --help");
      log.info("  zhushou autonomy collaboration --help\n");
    });
}
