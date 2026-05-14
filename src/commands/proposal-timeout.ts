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
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("commands:proposal-timeout");

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
      log.info("⏰ 开始检查超时提案\n");

      try {
        const result = await processTimedOutProposals({
          timeoutMs: parseInt(options.timeout),
          enabled: true,
          applicableRiskLevels: options.riskLevels,
        });

        log.info("\n📊 检查结果汇总:\n");
        log.info(`总检查提案数: ${result.totalChecked}`);
        log.info(`超时提案数: ${result.timedOutCount}`);
        log.info(`自动通过数: ${result.autoApprovedCount}`);
        log.info(`跳过数: ${result.skippedCount}`);
        log.info(`失败数: ${result.failedCount}`);

        if (result.entries.length > 0) {
          log.info("\n📋 详细结果:\n");
          result.entries.forEach((entry, index) => {
            log.info(`${index + 1}. ${entry.proposalId}: ${entry.title}`);
            log.info(`   状态: ${entry.status}`);
            log.info(`   等待时长: ${(entry.pendingDuration / 1000).toFixed(1)}秒`);
            log.info(`   是否超时: ${entry.isTimedOut ? "是" : "否"}`);
            log.info(`   自动通过: ${entry.autoApproved ? "✅ 是" : "❌ 否"}`);
            if (entry.skipReason) {
              log.info(`   跳过原因: ${entry.skipReason}`);
            }
            if (entry.error) {
              log.info(`   错误: ${entry.error}`);
            }
            log.info();
          });
        }
      } catch (error: any) {
        log.error(`❌ 检查失败: ${error.message}`);
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

      log.info(`⏱️  启动定时超时检查服务`);
      log.info(`   检查间隔: ${intervalMs / 1000}秒`);
      log.info(`   超时阈值: ${timeoutMs / 1000}秒`);
      log.info(`   风险级别: ${options.riskLevels.join(", ")}`);
      log.info(`\n按 Ctrl+C 停止服务\n`);

      periodicTimer = startPeriodicTimeoutCheck(intervalMs, {
        timeoutMs,
        enabled: true,
        applicableRiskLevels: options.riskLevels,
      });

      // 监听退出信号
      process.on("SIGINT", () => {
        log.info("\n⏹️  收到退出信号，停止服务...");
        if (periodicTimer) {
          stopPeriodicTimeoutCheck(periodicTimer);
          periodicTimer = null;
        }
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        log.info("\n⏹️  收到终止信号，停止服务...");
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
      log.info("⚠️  注意: 此命令需要在运行 start-watch 的同一进程中调用");
      log.info("   建议直接在该进程中按 Ctrl+C 停止");
    });

  // ==================== 查看配置 ====================

  timeoutGroup
    .command("config")
    .description("查看超时审核配置")
    .action(() => {
      log.info("⚙️  超时审核配置:\n");
      log.info(`默认超时时间: ${DEFAULT_REVIEW_TIMEOUT_MS / 1000}秒`);
      log.info(`最小超时时间: 10秒`);
      log.info(`最大超时时间: 300秒 (5分钟)`);
      log.info(`自动审核器ID: auto-reviewer`);
      log.info(`适用风险级别: safe (默认)`);
      log.info(`\n说明:`);
      log.info(`- 仅对 "safe" 级别的提案自动通过`);
      log.info(`- "elevated" 和 "sovereign" 级别需要人工审核`);
      log.info(`- 所有操作都有完整的审计追踪`);
    });

  // ==================== 测试功能 ====================

  timeoutGroup
    .command("test")
    .description("测试超时审核功能（创建一个测试提案）")
    .action(async () => {
      log.info("🧪 测试超时审核功能\n");
      log.info("注意: 此命令将创建一个测试提案用于验证功能");
      log.info("实际使用时应通过正常流程创建提案\n");

      // 这里可以添加创建测试提案的逻辑
      log.info("ℹ️  测试功能待实现");
      log.info("   请通过正常的提案创建流程创建提案后，再使用 check 命令测试");
    });
}
