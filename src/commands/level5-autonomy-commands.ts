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

export function registerLevel5AutonomyCommands(program: Command, runtime: RuntimeEnv): void {
  const level5Group = program.command("level5").description("Level 5 完全自治系统管理");

  // ==================== 自主战略调整命令 ====================

  const strategyGroup = level5Group.command("strategy").description("自主战略调整");

  strategyGroup
    .command("start-monitoring")
    .description("启动自主战略监控（自动检测环境信号并调整战略）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(60 * 60 * 1000))
    .action((options) => {
      console.log("🚀 启动自主战略监控...\n");
      
      autonomousStrategyAdjuster.startAutonomousMonitoring(parseInt(options.interval));
      
      console.log("✅ 自主战略监控已启动");
      console.log(`   检查间隔: ${parseInt(options.interval) / 1000 / 60} 分钟`);
      console.log("\n💡 系统将自动：");
      console.log("  - 检测环境信号（性能、资源、机会）");
      console.log("  - 自动调整战略目标");
      console.log("  - 通知战略变更");
      console.log("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        console.log("\n\n🛑 停止自主战略监控...");
        process.exit(0);
      });
    });

  strategyGroup
    .command("history")
    .description("查看战略调整历史")
    .action(() => {
      const history = autonomousStrategyAdjuster.getAdjustmentHistory();
      
      if (history.length === 0) {
        console.log("📭 暂无战略调整历史");
        return;
      }
      
      console.log(`\n📊 战略调整历史 (${history.length} 次):\n`);
      
      history.forEach((adj, index) => {
        console.log(`${index + 1}. ${adj.id}`);
        console.log(`   触发信号: ${adj.trigger.type} (${adj.trigger.severity})`);
        console.log(`   描述: ${adj.trigger.description}`);
        console.log(`   调整数量: ${adj.adjustments.length}`);
        console.log(`   状态: ${adj.status}`);
        console.log(`   执行时间: ${new Date(adj.executedAt).toLocaleString()}`);
        console.log(`   理由: ${adj.rationale}`);
        console.log();
      });
    });

  // ==================== 自我修复命令 ====================

  const healingGroup = level5Group.command("healing").description("自我修复系统");

  healingGroup
    .command("start-monitoring")
    .description("启动自主健康监控（自动检测和修复问题）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(5 * 60 * 1000))
    .action((options) => {
      console.log("🏥 启动自主健康监控...\n");
      
      enhancedSelfHealingEngine.startAutonomousHealthMonitoring(parseInt(options.interval));
      
      console.log("✅ 自主健康监控已启动");
      console.log(`   检查间隔: ${parseInt(options.interval) / 1000 / 60} 分钟`);
      console.log("\n💡 系统将自动：");
      console.log("  - 检查所有组件健康状态");
      console.log("  - 自动应用恢复策略");
      console.log("  - 记录修复历史");
      console.log("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        console.log("\n\n🛑 停止自主健康监控...");
        process.exit(0);
      });
    });

  healingGroup
    .command("status")
    .description("查看系统健康状态")
    .action(async () => {
      console.log("🔍 检查系统健康状态...\n");
      
      const health = await enhancedSelfHealingEngine.getSystemHealth();
      
      const statusEmoji = {
        healthy: "✅",
        degraded: "⚠️",
        critical: "❌",
      };
      
      console.log(`${statusEmoji[health.overall]} 整体状态: ${health.overall}\n`);
      
      console.log("组件状态:");
      health.components.forEach(comp => {
        const emoji = comp.status === 'healthy' ? '✅' : comp.status === 'degraded' ? '⚠️' : '❌';
        console.log(`  ${emoji} ${comp.name}: ${comp.status}`);
        if (comp.issues && comp.issues.length > 0) {
          comp.issues.forEach(issue => {
            console.log(`      - ${issue}`);
          });
        }
      });
      
      const history = enhancedSelfHealingEngine.getHealingHistory();
      if (history.length > 0) {
        console.log(`\n🏥 最近修复活动 (${history.length} 次):`);
        history.slice(-5).forEach(h => {
          const emoji = h.result === 'success' ? '✅' : '❌';
          console.log(`  ${emoji} ${h.issue} -> ${h.action} (${h.result})`);
          console.log(`     时间: ${new Date(h.timestamp).toLocaleString()}`);
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
        console.log("🌐 暂无已注册的外部系统");
        return;
      }
      
      console.log(`\n🌐 外部系统列表 (${systems.length} 个):\n`);
      
      systems.forEach((system, index) => {
        const statusEmoji = system.status === 'active' ? '✅' : system.status === 'inactive' ? '⏸️' : '❌';
        console.log(`${index + 1}. ${statusEmoji} ${system.name}`);
        console.log(`   ID: ${system.id}`);
        console.log(`   类型: ${system.type}`);
        console.log(`   端点: ${system.endpoint}`);
        console.log(`   能力: ${system.capabilities.join(", ")}`);
        if (system.lastSync) {
          console.log(`   最后同步: ${new Date(system.lastSync).toLocaleString()}`);
        }
        console.log();
      });
    });

  crossSystemGroup
    .command("task-queue")
    .description("查看任务队列状态")
    .action(() => {
      const status = crossSystemCoordinator.getTaskQueueStatus();
      
      console.log("\n📋 跨系统任务队列:\n");
      console.log(`  待处理: ${status.pending}`);
      console.log(`  进行中: ${status.inProgress}`);
      console.log(`  已完成: ${status.completed}`);
      console.log(`  失败: ${status.failed}`);
      console.log(`  总计: ${status.pending + status.inProgress + status.completed + status.failed}`);
    });

  // ==================== 创造性问题解决命令 ====================

  const creativeGroup = level5Group.command("creative").description("创造性问题解决");

  creativeGroup
    .command("start-solving")
    .description("启动创造性问题解决循环（自动检测新问题并生成创新方案）")
    .option("--interval <ms>", "检查间隔（毫秒）", String(2 * 60 * 60 * 1000))
    .action((options) => {
      console.log("💡 启动创造性问题解决循环...\n");
      
      creativeProblemSolver.startCreativeProblemSolving(parseInt(options.interval));
      
      console.log("✅ 创造性问题解决已启动");
      console.log(`   检查间隔: ${parseInt(options.interval) / 1000 / 60 / 60} 小时`);
      console.log("\n💡 系统将自动：");
      console.log("  - 检测新问题和模式");
      console.log("  - 生成创造性解决方案");
      console.log("  - 评估方案可行性和创新性");
      console.log("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        console.log("\n\n🛑 停止创造性问题解决...");
        process.exit(0);
      });
    });

  creativeGroup
    .command("solutions")
    .description("查看生成的解决方案历史")
    .action(() => {
      const solutions = creativeProblemSolver.getSolutionHistory();
      
      if (solutions.length === 0) {
        console.log("💭 暂无生成的解决方案");
        return;
      }
      
      console.log(`\n💡 创造性解决方案 (${solutions.length} 个):\n`);
      
      solutions.forEach((sol, index) => {
        console.log(`${index + 1}. ${sol.approach}`);
        console.log(`   问题 ID: ${sol.problemId}`);
        console.log(`   置信度: ${(sol.confidence * 100).toFixed(0)}%`);
        console.log(`   创新性: ${(sol.novelty * 100).toFixed(0)}%`);
        console.log(`   可行性: ${(sol.feasibility * 100).toFixed(0)}%`);
        console.log(`   步骤:`);
        sol.steps.forEach((step, i) => {
          console.log(`     ${i + 1}. ${step}`);
        });
        console.log(`   创建时间: ${new Date(sol.createdAt).toLocaleString()}`);
        console.log();
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
      console.log("🚀 启动完整的 Level 5 自治系统...\n");
      console.log("=" .repeat(60));
      
      // 1. 启动自主战略监控
      autonomousStrategyAdjuster.startAutonomousMonitoring(parseInt(options.strategyInterval));
      console.log("✅ 自主战略监控已启动");
      
      // 2. 启动自主健康监控
      enhancedSelfHealingEngine.startAutonomousHealthMonitoring(parseInt(options.healthInterval));
      console.log("✅ 自主健康监控已启动");
      
      // 3. 启动创造性问题解决
      creativeProblemSolver.startCreativeProblemSolving(parseInt(options.creativeInterval));
      console.log("✅ 创造性问题解决已启动");
      
      // 4. 启动跨系统任务处理
      crossSystemCoordinator.startTaskProcessing(30 * 1000);
      console.log("✅ 跨系统任务处理已启动");
      
      console.log("\n" + "=".repeat(60));
      console.log("\n🎉 Level 5 完全自治系统已启动！\n");
      console.log("💡 系统现在能够：");
      console.log("  ✅ 自主调整战略（无需人工干预）");
      console.log("  ✅ 自动检测和修复问题");
      console.log("  ✅ 与外部系统协调工作");
      console.log("  ✅ 创造性解决全新问题");
      console.log("\n📊 使用以下命令监控系统：");
      console.log("  zhushou level5 strategy history");
      console.log("  zhushou level5 healing status");
      console.log("  zhushou level5 cross-system list-systems");
      console.log("  zhushou level5 creative solutions");
      console.log("\n按 Ctrl+C 停止\n");
      
      process.on("SIGINT", () => {
        console.log("\n\n🛑 停止 Level 5 自治系统...");
        process.exit(0);
      });
    });

  // ==================== Level 5 状态概览 ====================

  level5Group
    .command("status")
    .description("显示 Level 5 自治系统状态概览")
    .action(async () => {
      console.log("\n🌟 Level 5 完全自治系统状态\n");
      console.log("=".repeat(60));
      
      // 战略调整状态
      const strategyHistory = autonomousStrategyAdjuster.getAdjustmentHistory();
      console.log(`\n📋 自主战略调整:`);
      console.log(`  调整次数: ${strategyHistory.length}`);
      if (strategyHistory.length > 0) {
        const lastAdj = strategyHistory[strategyHistory.length - 1];
        console.log(`  最近调整: ${new Date(lastAdj.executedAt).toLocaleString()}`);
      }
      
      // 健康状态
      const health = await enhancedSelfHealingEngine.getSystemHealth();
      console.log(`\n🏥 系统健康:`);
      console.log(`  整体状态: ${health.overall}`);
      console.log(`  组件数量: ${health.components.length}`);
      
      const healingHistory = enhancedSelfHealingEngine.getHealingHistory();
      console.log(`  修复次数: ${healingHistory.length}`);
      
      // 跨系统状态
      const systems = crossSystemCoordinator.getRegisteredSystems();
      const taskStatus = crossSystemCoordinator.getTaskQueueStatus();
      console.log(`\n🌐 跨系统协调:`);
      console.log(`  注册系统: ${systems.length}`);
      console.log(`  任务队列: ${taskStatus.pending} 待处理, ${taskStatus.completed} 已完成`);
      
      // 创造性解决状态
      const solutions = creativeProblemSolver.getSolutionHistory();
      console.log(`\n💡 创造性问题解决:`);
      console.log(`  生成方案: ${solutions.length}`);
      if (solutions.length > 0) {
        const avgConfidence = solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length;
        const avgNovelty = solutions.reduce((sum, s) => sum + s.novelty, 0) / solutions.length;
        console.log(`  平均置信度: ${(avgConfidence * 100).toFixed(0)}%`);
        console.log(`  平均创新性: ${(avgNovelty * 100).toFixed(0)}%`);
      }
      
      console.log("\n" + "=".repeat(60));
      console.log("\n🎯 项目自主程度: 100% (Level 5 完全自治)");
      console.log("\n💡 提示: 使用子命令查看详细信息");
      console.log("  zhushou level5 strategy --help");
      console.log("  zhushou level5 healing --help");
      console.log("  zhushou level5 cross-system --help");
      console.log("  zhushou level5 creative --help\n");
    });
}
