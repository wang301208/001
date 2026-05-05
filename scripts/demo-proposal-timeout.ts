/**
 * 提案超时审核功能演示脚本
 */

import { processTimedOutProposals } from "../src/governance/proposal-timeout-review.js";

async function demo() {
  console.log("=".repeat(80));
  console.log("⏰ 提案超时自动审核系统演示");
  console.log("=".repeat(80));
  console.log();

  console.log("📋 场景说明:");
  console.log("   - 模拟多个待审核提案");
  console.log("   - 其中部分提案等待超过30秒");
  console.log("   - 系统自动检测并处理超时提案\n");

  try {
    // 执行超时检查
    const result = await processTimedOutProposals({
      timeoutMs: 30_000,  // 30秒超时
      enabled: true,
      applicableRiskLevels: ["safe"],
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ 演示完成！");
    console.log("=".repeat(80));

    console.log("\n📊 结果汇总:\n");
    console.log(`总检查提案数: ${result.totalChecked}`);
    console.log(`超时提案数: ${result.timedOutCount}`);
    console.log(`自动通过数: ${result.autoApprovedCount}`);
    console.log(`跳过数: ${result.skippedCount}`);
    console.log(`失败数: ${result.failedCount}`);

    if (result.entries.length > 0) {
      console.log("\n📋 详细结果:\n");
      result.entries.forEach((entry, index) => {
        const statusIcon = entry.autoApproved ? "✅" : entry.isTimedOut ? "⏰" : "⏸️ ";
        console.log(`${index + 1}. ${statusIcon} ${entry.proposalId}: ${entry.title}`);
        console.log(`   状态: ${entry.status}`);
        console.log(`   等待时长: ${(entry.pendingDuration / 1000).toFixed(1)}秒`);
        console.log(`   风险级别: ${entry.riskLevel}`);
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

    console.log("\n💡 使用说明:\n");
    console.log("CLI命令:");
    console.log("  zhushou proposal-timeout check              # 手动检查");
    console.log("  zhushou proposal-timeout start-watch        # 启动定时检查");
    console.log("  zhushou proposal-timeout config             # 查看配置");
    console.log("\n编程API:");
    console.log("  import { processTimedOutProposals } from '@zhushou/governance/proposal-timeout-review';");
    console.log("  const result = await processTimedOutProposals({ timeoutMs: 30000 });");
  } catch (error: any) {
    console.error(`\n❌ 演示失败: ${error.message}`);
    console.error(error.stack);
  }
}

demo();
