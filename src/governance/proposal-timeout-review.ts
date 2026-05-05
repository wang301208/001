/**
 * 提案超时自动审核系统
 * 
 * 功能：如果提案等待审核超过30秒且无人干预，自动通过提案
 * 
 * 设计理念：
 * - 提高系统自主性，减少人工干预瓶颈
 * - 适用于低风险提案（safe级别）
 * - 保留审计追踪，确保可追溯性
 */

import { appendAuditFact } from "../infra/audit-stream.js";
import { resolveStateDir } from "../config/paths.js";
import {
  listGovernanceProposals,
  reviewGovernanceProposal,
  type GovernanceProposalRecord,
  type GovernanceProposalStatus,
} from "./proposals.js";

// ==================== 配置常量 ====================

/**
 * 默认超时时间（毫秒）
 * 30秒 = 30000毫秒
 */
export const DEFAULT_REVIEW_TIMEOUT_MS = 30_000;

/**
 * 最小超时时间（10秒）
 */
export const MIN_REVIEW_TIMEOUT_MS = 10_000;

/**
 * 最大超时时间（5分钟）
 */
export const MAX_REVIEW_TIMEOUT_MS = 300_000;

/**
 * 自动审核器标识
 */
export const AUTO_REVIEWER_ID = "auto-reviewer";

/**
 * 自动审核原因
 */
export const AUTO_REVIEW_REASON = "Review timeout exceeded (30s). Auto-approved for system autonomy.";

// ==================== 类型定义 ====================

/**
 * 超时审核配置
 */
export interface TimeoutReviewConfig {
  /**
   * 超时时间（毫秒），默认30000ms（30秒）
   */
  timeoutMs?: number;
  
  /**
   * 是否启用超时自动审核，默认true
   */
  enabled?: boolean;
  
  /**
   * 仅对特定风险级别的提案生效
   * 默认只对"safe"级别自动通过
   */
  applicableRiskLevels?: Array<"safe" | "elevated" | "sovereign">;
  
  /**
   * 状态目录路径
   */
  stateDir?: string;
  
  /**
   * 环境变量
   */
  env?: NodeJS.ProcessEnv;
}

/**
 * 超时审核结果
 */
export interface TimeoutReviewResult {
  /**
   * 检查的提案总数
   */
  totalChecked: number;
  
  /**
   * 超时的提案数
   */
  timedOutCount: number;
  
  /**
   * 自动通过的提案数
   */
  autoApprovedCount: number;
  
  /**
   * 跳过的提案数（不符合条件）
   */
  skippedCount: number;
  
  /**
   * 失败的提案数
   */
  failedCount: number;
  
  /**
   * 详细结果列表
   */
  entries: TimeoutReviewEntry[];
}

/**
 * 单个提案的超时审核结果
 */
export interface TimeoutReviewEntry {
  /**
   * 提案ID
   */
  proposalId: string;
  
  /**
   * 提案标题
   */
  title: string;
  
  /**
   * 当前状态
   */
  status: GovernanceProposalStatus;
  
  /**
   * 创建时间
   */
  createdAt: number;
  
  /**
   * 等待时长（毫秒）
   */
  pendingDuration: number;
  
  /**
   * 是否超时
   */
  isTimedOut: boolean;
  
  /**
   * 是否自动通过
   */
  autoApproved: boolean;
  
  /**
   * 跳过原因（如果有）
   */
  skipReason?: string;
  
  /**
   * 错误信息（如果失败）
   */
  error?: string;
  
  /**
   * 风险级别
   */
  riskLevel?: string;
}

// ==================== 核心函数 ====================

/**
 * 检查并处理超时的提案
 * 
 * @param config 超时审核配置
 * @returns 超时审核结果
 */
export async function processTimedOutProposals(
  config: TimeoutReviewConfig = {}
): Promise<TimeoutReviewResult> {
  const {
    timeoutMs = DEFAULT_REVIEW_TIMEOUT_MS,
    enabled = true,
    applicableRiskLevels = ["safe"],
    stateDir,
    env,
  } = config;

  // 验证配置
  if (!enabled) {
    return {
      totalChecked: 0,
      timedOutCount: 0,
      autoApprovedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      entries: [],
    };
  }

  // 验证超时时间范围
  const validatedTimeoutMs = validateTimeout(timeoutMs);

  console.log(`🔍 开始检查超时提案 (超时阈值: ${validatedTimeoutMs / 1000}秒)`);

  // 获取所有pending状态的提案
  const proposals = await listGovernanceProposals({
    status: "pending",
    limit: 200,
    ...(stateDir ? { stateDir } : {}),
    ...(env ? { env } : {}),
  });

  console.log(`📋 找到 ${proposals.records.length} 个待审核提案`);

  const now = Date.now();
  const result: TimeoutReviewResult = {
    totalChecked: proposals.records.length,
    timedOutCount: 0,
    autoApprovedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    entries: [],
  };

  // 逐个检查提案
  for (const proposal of proposals.records) {
    try {
      const entry = await checkAndAutoApproveProposal(
        proposal,
        now,
        validatedTimeoutMs,
        applicableRiskLevels,
        stateDir,
        env
      );

      result.entries.push(entry);

      if (entry.autoApproved) {
        result.autoApprovedCount++;
      } else if (entry.isTimedOut) {
        result.timedOutCount++;
      } else if (entry.skipReason) {
        result.skippedCount++;
      }
    } catch (error) {
      result.failedCount++;
      result.entries.push({
        proposalId: proposal.id,
        title: proposal.title,
        status: proposal.status,
        createdAt: proposal.createdAt,
        pendingDuration: now - proposal.createdAt,
        isTimedOut: false,
        autoApproved: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log(`✅ 超时审核完成:`);
  console.log(`   - 总检查: ${result.totalChecked}`);
  console.log(`   - 超时: ${result.timedOutCount}`);
  console.log(`   - 自动通过: ${result.autoApprovedCount}`);
  console.log(`   - 跳过: ${result.skippedCount}`);
  console.log(`   - 失败: ${result.failedCount}`);

  return result;
}

/**
 * 检查单个提案并自动通过（如果超时）
 */
async function checkAndAutoApproveProposal(
  proposal: GovernanceProposalRecord,
  now: number,
  timeoutMs: number,
  applicableRiskLevels: Array<"safe" | "elevated" | "sovereign">,
  stateDir?: string,
  env?: NodeJS.ProcessEnv
): Promise<TimeoutReviewEntry> {
  const pendingDuration = now - proposal.createdAt;
  const isTimedOut = pendingDuration >= timeoutMs;
  const riskLevel = proposal.classification?.level || "safe";

  const baseEntry: Omit<TimeoutReviewEntry, "autoApproved" | "skipReason" | "error"> = {
    proposalId: proposal.id,
    title: proposal.title,
    status: proposal.status,
    createdAt: proposal.createdAt,
    pendingDuration,
    isTimedOut,
    riskLevel,
  };

  // 如果不超时，跳过
  if (!isTimedOut) {
    return {
      ...baseEntry,
      autoApproved: false,
      skipReason: `Not timed out yet (${pendingDuration / 1000}s < ${timeoutMs / 1000}s)`,
    };
  }

  // 执行自动通过
  console.log(`⏰ 提案超时，自动通过: ${proposal.id} (${proposal.title})`);
  console.log(`   - 等待时长: ${pendingDuration / 1000}秒`);
  console.log(`   - 风险级别: ${riskLevel}`);

  try {
    await reviewGovernanceProposal({
      proposalId: proposal.id,
      decision: "approve",
      decidedBy: AUTO_REVIEWER_ID,
      decidedByType: "system",
      decisionNote: AUTO_REVIEW_REASON,
      ...(stateDir ? { stateDir } : {}),
      ...(env ? { env } : {}),
    });

    // 记录审计事实
    await appendAuditFact({
      filePath: resolveProposalAuditStreamPath(stateDir),
      fact: {
        domain: "governance",
        action: "proposal.auto-approved",
        actor: {
          type: "system",
          id: AUTO_REVIEWER_ID,
        },
        refs: {
          proposalId: proposal.id,
        },
        summary: `Auto-approved proposal ${proposal.id} after timeout (${pendingDuration / 1000}s)`,
        payload: {
          title: proposal.title,
          pendingDuration,
          timeoutMs,
          riskLevel,
          reason: AUTO_REVIEW_REASON,
        },
      },
    });

    console.log(`✅ 已自动通过提案: ${proposal.id}`);

    return {
      ...baseEntry,
      autoApproved: true,
    };
  } catch (error) {
    console.error(`❌ 自动通过失败: ${proposal.id}`, error);
    throw error;
  }
}

/**
 * 验证超时时间
 */
function validateTimeout(timeoutMs: number): number {
  if (timeoutMs < MIN_REVIEW_TIMEOUT_MS) {
    console.warn(`⚠️  超时时间过小 (${timeoutMs}ms)，调整为最小值 ${MIN_REVIEW_TIMEOUT_MS}ms`);
    return MIN_REVIEW_TIMEOUT_MS;
  }

  if (timeoutMs > MAX_REVIEW_TIMEOUT_MS) {
    console.warn(`⚠️  超时时间过大 (${timeoutMs}ms)，调整为最大值 ${MAX_REVIEW_TIMEOUT_MS}ms`);
    return MAX_REVIEW_TIMEOUT_MS;
  }

  return timeoutMs;
}

/**
 * 解析提案审计流路径
 */
function resolveProposalAuditStreamPath(stateDir?: string): string {
  const resolvedStateDir = stateDir ?? resolveStateDir();
  return `${resolvedStateDir}/audit/governance-proposals.ndjson`;
}

/**
 * 启动定时超时检查任务
 * 
 * @param intervalMs 检查间隔（毫秒），默认60秒
 * @param config 超时审核配置
 * @returns 定时器ID，可用于清除
 */
export function startPeriodicTimeoutCheck(
  intervalMs: number = 60_000,
  config: TimeoutReviewConfig = {}
): NodeJS.Timeout {
  console.log(`⏱️  启动定时超时检查 (间隔: ${intervalMs / 1000}秒)`);

  const timer = setInterval(async () => {
    try {
      await processTimedOutProposals(config);
    } catch (error) {
      console.error("❌ 定时超时检查失败:", error);
    }
  }, intervalMs);

  // 立即执行一次
  processTimedOutProposals(config).catch((error) => {
    console.error("❌ 初始超时检查失败:", error);
  });

  return timer;
}

/**
 * 停止定时超时检查任务
 */
export function stopPeriodicTimeoutCheck(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log("⏹️  已停止定时超时检查");
}
