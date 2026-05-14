/**
 * Level 5 完全自治 CLI 命令
 * 
 * 提供最后5%自主能力的命令行接口
 */

import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import {
  autonomousStrategyAdjuster,
  enhancedSelfHealingEngine,
  crossSystemCoordinator,
  creativeProblemSolver,
} from "../governance/level5-autonomy.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("commands:level5-autonomy-commands");

export function registerLevel5AutonomyCommands(program: Command, runtime: RuntimeEnv): void {
  const level5Group = program.command("level5").description("Level 5 完全自治系统管理");

  // ==================== 自主战略调整命令 ====================

  const strategyGroup = level5Group.command("strategy").description("自主战略调整");

  strategyGroup
    .command("start-monitoring")
    .description("启动自主战略监控（自动检测环境信号并调整战略）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(60 * 60 * 1000))
    .action((options) => {
      log.info("🚀 启动自主战略监控...\n");
      
      autonomousStrategyAdjuster.startAutonomousMonitoring(parseInt(options.interval));
      
      log.info("✅ 自主战略监控已启动");
      log.info(`   检查间隔: ${parseInt(options.interval) / 1000 / 60} 分钟`);
      log.info("\n💡 系统将自动：");
      log.info("  - 检测环境信号（性能、资源、机会）");
      log.info("  - 自动调整战略目标");
      log.info("  - 通知战略变更");
      log.info("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        log.info("\n\n🛑 停止自主战略监控...");
        process.exit(0);
      });
    });

  strategyGroup
    .command("history")
    .description("查看战略调整历史")
    .action(() => {
      const history = autonomousStrategyAdjuster.getAdjustmentHistory();
      
      if (history.length === 0) {
        log.info("📭 暂无战略调整历史");
        return;
      }
      
      log.info(`\n📊 战略调整历史 (${history.length} 次):\n`);
      
      history.forEach((adj, index) => {
        log.info(`${index + 1}. ${adj.id}`);
        log.info(`   触发信号: ${adj.trigger.type} (${adj.trigger.severity})`);
        log.info(`   描述: ${adj.trigger.description}`);
        log.info(`   调整数量: ${adj.adjustments.length}`);
        log.info(`   状态: ${adj.status}`);
        log.info(`   执行时间: ${new Date(adj.executedAt).toLocaleString()}`);
        log.info(`   理由: ${adj.rationale}`);
        log.info();
      });
    });

  // ==================== 自我修复命令 ====================

  const healingGroup = level5Group.command("healing").description("自我修复系统");

  healingGroup
    .command("start-monitoring")
    .description("启动自主健康监控（自动检测和修复问题）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(5 * 60 * 1000))
    .action((options) => {
      log.info("🏥 启动自主健康监控...\n");
      
      enhancedSelfHealingEngine.startAutonomousHealthMonitoring(parseInt(options.interval));
      
      log.info("✅ 自主健康监控已启动");
      log.info(`   检查间隔: ${parseInt(options.interval) / 1000 / 60} 分钟`);
      log.info("\n💡 系统将自动：");
      log.info("  - 检查所有组件健康状态");
      log.info("  - 自动应用恢复策略");
      log.info("  - 记录修复历史");
      log.info("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        log.info("\n\n🛑 停止自主健康监控...");
        process.exit(0);
      });
    });

  healingGroup
    .command("status")
    .description("查看系统健康状态")
    .action(async () => {
      log.info("🔍 检查系统健康状态...\n");
      
      const health = await enhancedSelfHealingEngine.getSystemHealth();
      
      const statusEmoji = {
        healthy: "✅",
        degraded: "⚠️",
        critical: "❌",
      };
      
      log.info(`${statusEmoji[health.overall]} 整体状态: ${health.overall}\n`);
      
      log.info("组件状态:");
      health.components.forEach(comp => {
        const emoji = comp.status === 'healthy' ? '✅' : comp.status === 'degraded' ? '⚠️' : '❌';
        log.info(`  ${emoji} ${comp.name}: ${comp.status}`);
        if (comp.issues && comp.issues.length > 0) {
          comp.issues.forEach(issue => {
            log.info(`      - ${issue}`);
          });
        }
      });
      
      const history = enhancedSelfHealingEngine.getHealingHistory();
      if (history.length > 0) {
        log.info(`\n🏥 最近修复活动 (${history.length} 次):`);
        history.slice(-5).forEach(h => {
          const emoji = h.result === 'success' ? '✅' : '❌';
          log.info(`  ${emoji} ${h.issue} -> ${h.action} (${h.result})`);
          log.info(`     时间: ${new Date(h.timestamp).toLocaleString()}`);
        });
      }
    });

  // ==================== 跨系统协调命令 ====================

  const crossSystemGroup = level5Group.command("cross-system").description("跨系统协调");

  crossSystemGroup
    .command("list-systems")
    .description("列出已注册的外部系统")
    .action(() => {
      const systems = crossSystemCoordinator.getRegisteredSystems();
      
      if (systems.length === 0) {
        log.info("🌐 暂无已注册的外部系统");
        return;
      }
      
      log.info(`\n🌐 外部系统列表 (${systems.length} 个):\n`);
      
      systems.forEach((system, index) => {
        const statusEmoji = system.status === 'active' ? '✅' : system.status === 'inactive' ? '⏸️' : '❌';
        log.info(`${index + 1}. ${statusEmoji} ${system.name}`);
        log.info(`   ID: ${system.id}`);
        log.info(`   类型: ${system.type}`);
        log.info(`   端点: ${system.endpoint}`);
        log.info(`   能力: ${system.capabilities.join(", ")}`);
        if (system.lastSync) {
          log.info(`   最后同步: ${new Date(system.lastSync).toLocaleString()}`);
        }
        log.info();
      });
    });

  crossSystemGroup
    .command("task-queue")
    .description("查看任务队列状态")
    .action(() => {
      const status = crossSystemCoordinator.getTaskQueueStatus();
      
      log.info("\n📋 跨系统任务队列:\n");
      log.info(`  待处理: ${status.pending}`);
      log.info(`  进行中: ${status.inProgress}`);
      log.info(`  已完成: ${status.completed}`);
      log.info(`  失败: ${status.failed}`);
      log.info(`  总计: ${status.pending + status.inProgress + status.completed + status.failed}`);
    });

  // ==================== 创造性问题解决命令 ====================

  const creativeGroup = level5Group.command("creative").description("创造性问题解决");

  creativeGroup
    .command("start-solving")
    .description("启动创造性问题解决循环（自动检测新问题并生成创新方案）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(2 * 60 * 60 * 1000))
    .action((options) => {
      log.info("💡 启动创造性问题解决循环...\n");
      
      creativeProblemSolver.startCreativeProblemSolving(parseInt(options.interval));
      
      log.info("✅ 创造性问题解决已启动");
      log.info(`   检查间隔: ${parseInt(options.interval) / 1000 / 60 / 60} 小时`);
      log.info("\n💡 系统将自动：");
      log.info("  - 检测新问题和模式");
      log.info("  - 生成创造性解决方案");
      log.info("  - 评估方案可行性和创新性");
      log.info("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        log.info("\n\n🛑 停止创造性问题解决...");
        process.exit(0);
      });
    });

  creativeGroup
    .command("solutions")
    .description("查看生成的解决方案历史")
    .action(() => {
      const solutions = creativeProblemSolver.getSolutionHistory();
      
      if (solutions.length === 0) {
        log.info("💭 暂无生成的解决方案");
        return;
      }
      
      log.info(`\n💡 创造性解决方案 (${solutions.length} 个):\n`);
      
      solutions.forEach((sol, index) => {
        log.info(`${index + 1}. ${sol.approach}`);
        log.info(`   问题 ID: ${sol.problemId}`);
        log.info(`   置信度: ${(sol.confidence * 100).toFixed(0)}%`);
        log.info(`   创新性: ${(sol.novelty * 100).toFixed(0)}%`);
        log.info(`   可行性: ${(sol.feasibility * 100).toFixed(0)}%`);
        log.info(`   步骤:`);
        sol.steps.forEach((step, i) => {
          log.info(`     ${i + 1}. ${step}`);
        });
        log.info(`   创建时间: ${new Date(sol.createdAt).toLocaleString()}`);
        log.info();
      });
    });

  // ==================== 完整 Level 5 自治启动 ====================

  level5Group
    .command("start-full-autonomy")
    .description("启动完整的 Level 5 自治系统（包括所有高级功能）")
    .option("--strategy-interval <ms>", "战略监控间隔", String(60 * 60 * 1000))
    .option("--health-interval <ms>", "健康监控间隔", String(5 * 60 * 1000))
    .option("--creative-interval <ms>", "创造性解决间隔", String(2 * 60 * 60 * 1000))
    .action((options) => {
      log.info("🚀 启动完整的 Level 5 自治系统...\n");
      log.info("=" .repeat(60));
      
      // 1. 启动自主战略监控
      autonomousStrategyAdjuster.startAutonomousMonitoring(parseInt(options.strategyInterval));
      log.info("✅ 自主战略监控已启动");
      
      // 2. 启动自主健康监控
      enhancedSelfHealingEngine.startAutonomousHealthMonitoring(parseInt(options.healthInterval));
      log.info("✅ 自主健康监控已启动");
      
      // 3. 启动创造性问题解决
      creativeProblemSolver.startCreativeProblemSolving(parseInt(options.creativeInterval));
      log.info("✅ 创造性问题解决已启动");
      
      // 4. 启动跨系统任务处理
      crossSystemCoordinator.startTaskProcessing(30 * 1000);
      log.info("✅ 跨系统任务处理已启动");
      
      log.info("\n" + "=".repeat(60));
      log.info("\n🎉 Level 5 完全自治系统已启动！\n");
      log.info("💡 系统现在能够：");
      log.info("  ✅ 自主调整战略（无需人工干预）");
      log.info("  ✅ 自动检测和修复问题");
      log.info("  ✅ 与外部系统协调工作");
      log.info("  ✅ 创造性解决全新问题");
      log.info("\n📊 使用以下命令监控系统：");
      log.info("  zhushou level5 strategy history");
      log.info("  zhushou level5 healing status");
      log.info("  zhushou level5 cross-system list-systems");
      log.info("  zhushou level5 creative solutions");
      log.info("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        log.info("\n\n🛑 停止 Level 5 自治系统...");
        process.exit(0);
      });
    });

  // ==================== Level 5 状态概览 ====================

  level5Group
    .command("status")
    .description("显示 Level 5 自治系统状态概览")
    .action(async () => {
      log.info("\n🌟 Level 5 完全自治系统状态\n");
      log.info("=".repeat(60));
      
      // 战略调整状态
      const strategyHistory = autonomousStrategyAdjuster.getAdjustmentHistory();
      log.info(`\n📋 自主战略调整:`);
      log.info(`  调整次数: ${strategyHistory.length}`);
      if (strategyHistory.length > 0) {
        const lastAdj = strategyHistory[strategyHistory.length - 1];
        log.info(`  最近调整: ${new Date(lastAdj.executedAt).toLocaleString()}`);
      }
      
      // 健康状态
      const health = await enhancedSelfHealingEngine.getSystemHealth();
      log.info(`\n🏥 系统健康:`);
      log.info(`  整体状态: ${health.overall}`);
      log.info(`  组件数量: ${health.components.length}`);
      
      const healingHistory = enhancedSelfHealingEngine.getHealingHistory();
      log.info(`  修复次数: ${healingHistory.length}`);
      
      // 跨系统状态
      const systems = crossSystemCoordinator.getRegisteredSystems();
      const taskStatus = crossSystemCoordinator.getTaskQueueStatus();
      log.info(`\n🌐 跨系统协调:`);
      log.info(`  注册系统: ${systems.length}`);
      log.info(`  任务队列: ${taskStatus.pending} 待处理, ${taskStatus.completed} 已完成`);
      
      // 创造性解决状态
      const solutions = creativeProblemSolver.getSolutionHistory();
      log.info(`\n💡 创造性问题解决:`);
      log.info(`  生成方案: ${solutions.length}`);
      if (solutions.length > 0) {
        const avgConfidence = solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length;
        const avgNovelty = solutions.reduce((sum, s) => sum + s.novelty, 0) / solutions.length;
        log.info(`  平均置信度: ${(avgConfidence * 100).toFixed(0)}%`);
        log.info(`  平均创新性: ${(avgNovelty * 100).toFixed(0)}%`);
      }
      
      log.info("\n" + "=".repeat(60));
      log.info("\n🎯 项目自主程度: 100% (Level 5 完全自治)");
      log.info("\n💡 提示: 使用子命令查看详细信息");
      log.info("  zhushou level5 strategy --help");
      log.info("  zhushou level5 healing --help");
      log.info("  zhushou level5 cross-system --help");
      log.info("  zhushou level5 creative --help\n");
    });
}
