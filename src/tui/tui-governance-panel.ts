import { Container, Text } from "@mariozechner/pi-tui";
import type { GovernanceStatus } from "../communication/message-bus.js";

/**
 * TUI 治理层状态面板
 * 在终端中显示系统治理层的关键信息
 */
export function renderGovernancePanel(governanceStatus: GovernanceStatus | null): string[] {
  const lines: string[] = [];
  
  // 标题
  lines.push("");
  lines.push("╔══════════════════════════════════════════╗");
  lines.push("║       🏛️  系统治理层状态监控            ║");
  lines.push("╚══════════════════════════════════════════╝");
  lines.push("");
  
  if (!governanceStatus) {
    lines.push("  ⏳ 正在加载治理层状态...");
    lines.push("");
    return lines;
  }
  
  // 冻结状态（最高优先级）
  if (governanceStatus.freezeActive) {
    const freezeStatus = governanceStatus.freezeStatus;
    const affectedSubsystems = freezeStatus?.affectedSubsystems ?? [];
    lines.push("  ⚠️  【系统已冻结】");
    lines.push(`     原因: ${freezeStatus?.reason || "未知"}`);
    if (freezeStatus?.activatedAt) {
      const freezeTime = new Date(freezeStatus.activatedAt).toLocaleString("zh-CN");
      lines.push(`     时间: ${freezeTime}`);
    }
    if (affectedSubsystems.length > 0) {
      lines.push(`     影响: ${affectedSubsystems.join(", ")}`);
    }
    lines.push("");
  } else {
    lines.push("  ✅ 系统运行正常");
    lines.push("");
  }
  
  // 主权边界
  lines.push(`  🛡️  主权边界: ${governanceStatus.sovereigntyBoundary ? "✅ 正常" : "❌ 异常"}`);
  lines.push("");
  
  // 代理统计
  lines.push(`  👥 活跃代理: ${governanceStatus.activeAgents.length} 个`);
  const activeCount = governanceStatus.activeAgents.filter(a => a.status === "active").length;
  const frozenCount = governanceStatus.activeAgents.filter(a => a.status === "frozen").length;
  if (activeCount > 0 || frozenCount > 0) {
    lines.push(`     ├─ 活跃: ${activeCount}`);
    if (frozenCount > 0) {
      lines.push(`     └─ 冻结: ${frozenCount} ⚠️`);
    }
  }
  lines.push("");
  
  // 演化项目
  lines.push(`  🧬 演化项目: ${governanceStatus.evolutionProjects.length} 个`);
  const runningProjects = governanceStatus.evolutionProjects.filter(p => p.status === "running");
  const completedProjects = governanceStatus.evolutionProjects.filter(p => p.status === "completed");
  if (runningProjects.length > 0 || completedProjects.length > 0) {
    lines.push(`     ├─ 运行中: ${runningProjects.length}`);
    lines.push(`     └─ 已完成: ${completedProjects.length}`);
  }
  lines.push("");
  
  // 沙盒实验
  lines.push(`  🧪 沙盒实验: ${governanceStatus.sandboxExperiments.length} 个`);
  const runningExperiments = governanceStatus.sandboxExperiments.filter(e => e.status === "running");
  const observingExperiments = governanceStatus.sandboxExperiments.filter(e => e.status === "observing");
  if (runningExperiments.length > 0 || observingExperiments.length > 0) {
    lines.push(`     ├─ 运行中: ${runningExperiments.length}`);
    lines.push(`     └─ 观察中: ${observingExperiments.length}`);
  }
  lines.push("");
  
  return lines;
}

/**
 * 简化的治理层状态摘要（用于状态栏）
 */
export function getGovernanceSummary(governanceStatus: GovernanceStatus | null): string {
  if (!governanceStatus) {
    return "治理层: 加载中...";
  }
  
  if (governanceStatus.freezeActive) {
    return "🔴 系统已冻结";
  }
  
  const parts: string[] = [];
  parts.push(`代理:${governanceStatus.activeAgents.length}`);
  parts.push(`项目:${governanceStatus.evolutionProjects.length}`);
  parts.push(`实验:${governanceStatus.sandboxExperiments.length}`);
  
  return `治理层: ${parts.join(" | ")}`;
}
