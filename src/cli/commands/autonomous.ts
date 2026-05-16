import type { Command } from "commander";

export function registerAutonomousCommands(program: Command): void {
  const autonomous = program
    .command("autonomous")
    .description("自治系统管理命令");

  autonomous
    .command("status")
    .description("查看自治系统状态")
    .action(async () => {
      try {
        const status = await fetchAutonomous("/autonomous/status");
        if (!status.enabled) {
          console.log("自治系统未启用");
          return;
        }
        console.log("┌─ 自治系统状态 ────────────────┐");
        console.log(`│ 运行状态: ${status.running ? "● 运行中" : "○ 已停止"}`);
        if (status.startedAt) {
          const uptime = Date.now() - status.startedAt;
          console.log(`│ 运行时间: ${formatDuration(uptime)}`);
        }
        console.log("├─ 模块状态 ────────────────────┤");
        for (const [name, state] of Object.entries(status.modules ?? {})) {
          const icon = state === "active" ? "✓" : state === "error" ? "✗" : "○";
          console.log(`│ ${icon} ${name}: ${state}`);
        }
        console.log("└────────────────────────────────┘");
      } catch (err) {
        console.error(`获取自治状态失败: ${String(err)}`);
      }
    });

  autonomous
    .command("modules")
    .description("查看自治模块详情")
    .action(async () => {
      try {
        const modules = await fetchAutonomous("/autonomous/modules");
        console.log("┌─ 自治模块详情 ────────────────┐");
        for (const [name, info] of Object.entries(modules.modules ?? {})) {
          const m = info as { active: boolean; info?: Record<string, unknown> };
          const icon = m.active ? "✓" : "○";
          console.log(`│ ${icon} ${name}`);
          if (m.info) {
            for (const [key, value] of Object.entries(m.info)) {
              console.log(`│   ${key}: ${typeof value === "number" ? value.toFixed(2) : value}`);
            }
          }
        }
        console.log("└────────────────────────────────┘");
      } catch (err) {
        console.error(`获取模块详情失败: ${String(err)}`);
      }
    });

  autonomous
    .command("audit")
    .description("查看审计链")
    .option("-n, --limit <number>", "显示条目数", "20")
    .option("--verify", "验证审计链完整性")
    .action(async (opts) => {
      try {
        if (opts.verify) {
          const audit = await fetchAutonomous(`/autonomous/audit?limit=1`);
          const integrity = audit.integrity;
          console.log(`审计链完整性: ${integrity.valid ? "✓ 有效" : "✗ 损坏"}`);
          if (!integrity.valid) {
            console.log(`  损坏位置: 第${integrity.brokenAt}条`);
          }
          return;
        }
        const audit = await fetchAutonomous(`/autonomous/audit?limit=${opts.limit}`);
        console.log(`审计条目 (共${audit.total}条, 根哈希: ${audit.rootHash?.slice(0, 16)}...)`);
        console.log("────────────────────────────────");
        for (const entry of audit.entries ?? []) {
          const time = new Date(entry.timestamp).toLocaleTimeString();
          const outcome = entry.outcome === "success" ? "✓" : entry.outcome === "denied" ? "✗" : "⚠";
          console.log(`[${time}] ${outcome} ${entry.actor} ${entry.action}`);
        }
      } catch (err) {
        console.error(`获取审计链失败: ${String(err)}`);
      }
    });

  autonomous
    .command("defense")
    .description("查看自防御状态")
    .action(async () => {
      try {
        const defense = await fetchAutonomous("/autonomous/defense");
        if (!defense.enabled) {
          console.log("自防御系统未启用");
          return;
        }
        console.log("┌─ 自防御状态 ──────────────────┐");
        console.log(`│ 总评估: ${defense.stats.totalEvaluations}`);
        console.log(`│ 总封禁: ${defense.stats.totalBlocks}`);
        console.log(`│ 总限流: ${defense.stats.totalRateLimits}`);
        if (defense.activeBlocks.length > 0) {
          console.log("├─ 活跃封禁 ───────────────────┤");
          for (const block of defense.activeBlocks) {
            const remaining = Math.ceil((block.until - Date.now()) / 1000);
            console.log(`│ ✗ ${block.ip} (剩余${remaining}s): ${block.reason}`);
          }
        }
        if (defense.stats.topThreats.length > 0) {
          console.log("├─ 高危IP ─────────────────────┤");
          for (const ip of defense.stats.topThreats.slice(0, 5)) {
            console.log(`│ ⚠ ${ip}`);
          }
        }
        console.log("└────────────────────────────────┘");
      } catch (err) {
        console.error(`获取自防御状态失败: ${String(err)}`);
      }
    });

  autonomous
    .command("cache")
    .description("查看语义缓存统计")
    .action(async () => {
      try {
        const cache = await fetchAutonomous("/autonomous/cache");
        if (!cache.enabled) {
          console.log("语义缓存未启用");
          return;
        }
        const s = cache.stats;
        console.log("┌─ 语义缓存统计 ────────────────┐");
        console.log(`│ 总条目: ${s.totalEntries}`);
        console.log(`│ 命中率: ${(s.hitRate * 100).toFixed(1)}%`);
        console.log(`│ 平均相似度: ${s.avgSimilarity.toFixed(3)}`);
        console.log(`│ 淘汰次数: ${s.evictions}`);
        console.log(`│ 内存占用: ${(s.memoryEstimateBytes / 1024).toFixed(0)}KB`);
        console.log("└────────────────────────────────┘");
      } catch (err) {
        console.error(`获取缓存统计失败: ${String(err)}`);
      }
    });

  autonomous
    .command("cost")
    .description("查看成本治理")
    .option("-t, --tenant <id>", "租户ID", "default")
    .action(async (opts) => {
      try {
        const cost = await fetchAutonomous(`/autonomous/cost?tenant=${opts.tenant}`);
        if (!cost.enabled) {
          console.log("成本治理未启用");
          return;
        }
        console.log("┌─ 成本治理 ────────────────────┐");
        const q = cost.quota;
        console.log(`│ 日配额: $${q.dailyUsedUsd?.toFixed(4) ?? 0} / $${q.dailyLimitUsd}`);
        console.log(`│ 月配额: $${q.monthlyUsedUsd?.toFixed(4) ?? 0} / $${q.monthlyLimitUsd}`);
        const daily = cost.dailyReport;
        console.log(`│ 今日请求: ${daily.requestCount}`);
        if (daily.byModel && Object.keys(daily.byModel).length > 0) {
          console.log("├─ 模型消耗 ───────────────────┤");
          for (const [model, c] of Object.entries(daily.byModel)) {
            console.log(`│ ${model}: $${(c as number).toFixed(4)}`);
          }
        }
        if (cost.suggestions.length > 0) {
          console.log("├─ 优化建议 ───────────────────┤");
          for (const s of cost.suggestions) {
            console.log(`│ [${s.type}] ${s.description}`);
            console.log(`│   预计节省: $${s.estimatedSavingsUsd.toFixed(2)}`);
          }
        }
        console.log("└────────────────────────────────┘");
      } catch (err) {
        console.error(`获取成本治理失败: ${String(err)}`);
      }
    });
}

async function fetchAutonomous(path: string): Promise<Record<string, unknown>> {
  const port = process.env.ZHUSHOU_GATEWAY_PORT ?? "18790";
  const host = process.env.ZHUSHOU_BIND ?? "127.0.0.1";
  const url = `http://${host}:${port}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m${seconds % 60}s`;
  return `${seconds}s`;
}
