/**
 * 提案超时审核 CLI 命令
 * 
 * 提供提案超时自动审核的命令行接口
 */

import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import {
  processTimedOutProposals,
  startPeriodicTimeoutCheck,
  stopPeriodicTimeoutCheck,
  DEFAULT_REVIEW_TIMEOUT_MS,
} from "../governance/proposal-timeout-review.js";

let periodicTimer: NodeJS.Timeout | null = null;

export function registerProposalTimeoutCommands(program: Command, runtime: RuntimeEnv): void {
  const timeoutGroup = program
    .command("proposal-timeout")
    .description("提案超时自动审核工具");

  // ==================== 手动触发超时检查 ====================

  timeoutGroup
    .command("check")
    .description("手动检查并处理超时的提案")
    .option("--timeout <ms>", "超时时间（毫秒）", String(DEFAULT_REVIEW_TIMEOUT_MS))
    .option("--risk-levels <levels...>", "适用的风险级别 (safe/elevated/sovereign)", ["safe"])
    .action(async (options) => {
      console.log("⏰ 开始检查超时提案\n");

      try {
        const result = await processTimedOutProposals({
          timeoutMs: parseInt(options.timeout),
          enabled: true,
          applicableRiskLevels: options.riskLevels,
        });

        console.log("\n📊 检查结果汇总:\n");
        console.log(`总检查提案数: ${result.totalChecked}`);
        console.log(`超时提案数: ${result.timedOutCount}`);
        console.log(`自动通过数: ${result.autoApprovedCount}`);
        console.log(`跳过数: ${result.skippedCount}`);
        console.log(`失败数: ${result.failedCount}`);

        if (result.entries.length > 0) {
          console.log("\n📋 详细结果:\n");
          result.entries.forEach((entry, index) => {
            console.log(`${index + 1}. ${entry.proposalId}: ${entry.title}`);
            console.log(`   状态: ${entry.status}`);
            console.log(`   等待时长: ${(entry.pendingDuration / 1000).toFixed(1)}秒`);
            console.log(`   是否超时: ${entry.isTimedOut ? "是" : "否"}`);
            console.log(`   自动通过: ${entry.autoApproved ? "✅ 是" : "❌ 否"}`);
            if (entry.skipReason) {
              console.log(`   跳过原因: ${entry.skipReason}`);
            }
            if (entry.error) {
              console.log(`   错误: ${entry.error}`);
            }
            console.log();
          });
        }
      } catch (error: any) {
        console.error(`❌ 检查失败: ${error.message}`);
        process.exit(1);
      }
    });

  // ==================== 启动定时检查 ====================

  timeoutGroup
    .command("start-watch")
    .description("启动定时超时检查服务")
    .option("--interval <ms>", "检查间隔（毫秒）", "60000")
    .option("--timeout <ms>", "超时时间（毫秒）", String(DEFAULT_REVIEW_TIMEOUT_MS))
    .option("--risk-levels <levels...>", "适用的风险级别", ["safe"])
    .action(async (options) => {
      const intervalMs = parseInt(options.interval);
      const timeoutMs = parseInt(options.timeout);

      console.log(`⏱️  启动定时超时检查服务`);
      console.log(`   检查间隔: ${intervalMs / 1000}秒`);
      console.log(`   超时阈值: ${timeoutMs / 1000}秒`);
      console.log(`   风险级别: ${options.riskLevels.join(", ")}`);
      console.log(`\n按 Ctrl+C 停止服务\n`);

      periodicTimer = startPeriodicTimeoutCheck(intervalMs, {
        timeoutMs,
        enabled: true,
        applicableRiskLevels: options.riskLevels,
      });

      // 监听退出信号
      process.on("SIGINT", () => {
        console.log("\n⏹️  收到退出信号，停止服务...");
        if (periodicTimer) {
          stopPeriodicTimeoutCheck(periodicTimer);
          periodicTimer = null;
        }
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        console.log("\n⏹️  收到终止信号，停止服务...");
        if (periodicTimer) {
          stopPeriodicTimeoutCheck(periodicTimer);
          periodicTimer = null;
        }
        process.exit(0);
      });

      // 保持进程运行
      await new Promise(() => {
        // 永久等待
      });
    });

  // ==================== 停止定时检查 ====================

  timeoutGroup
    .command("stop-watch")
    .description("停止定时超时检查服务")
    .action(() => {
      console.log("⚠️  注意: 此命令需要在运行 start-watch 的同一进程中调用");
      console.log("   建议直接在该进程中按 Ctrl+C 停止");
    });

  // ==================== 查看配置 ====================

  timeoutGroup
    .command("config")
    .description("查看超时审核配置")
    .action(() => {
      console.log("⚙️  超时审核配置:\n");
      console.log(`默认超时时间: ${DEFAULT_REVIEW_TIMEOUT_MS / 1000}秒`);
      console.log(`最小超时时间: 10秒`);
      console.log(`最大超时时间: 300秒 (5分钟)`);
      console.log(`自动审核器ID: auto-reviewer`);
      console.log(`适用风险级别: safe (默认)`);
      console.log(`\n说明:`);
      console.log(`- 仅对 "safe" 级别的提案自动通过`);
      console.log(`- "elevated" 和 "sovereign" 级别需要人工审核`);
      console.log(`- 所有操作都有完整的审计追踪`);
    });

  // ==================== 测试功能 ====================

  timeoutGroup
    .command("test")
    .description("测试超时审核功能（创建一个测试提案）")
    .action(async () => {
      console.log("🧪 测试超时审核功能\n");
      console.log("注意: 此命令将创建一个测试提案用于验证功能");
      console.log("实际使用时应通过正常流程创建提案\n");

      // 这里可以添加创建测试提案的逻辑
      console.log("ℹ️  测试功能待实现");
      console.log("   请通过正常的提案创建流程创建提案后，再使用 check 命令测试");
    });
}
