import fs from "node:fs/promises";
import path from "node:path";

/**
 * 晋升后观察器
 * 
 * 负责监控已晋升资产的行为，检测回归并自动触发告警或回滚。
 * 这是确保系统稳定性的关键组件。
 */

export interface PromotionObservationConfig {
  /** 观察窗口（毫秒），默认 24 小时 */
  observationWindowMs?: number;
  
  /** 检查间隔（毫秒），默认 5 分钟 */
  checkIntervalMs?: number;
  
  /** 是否启用自动回滚，默认 true */
  autoRollbackEnabled?: boolean;
  
  /** 回归阈值（错误率），默认 0.05 (5%) */
  regressionThreshold?: number;
}

export interface AssetMetrics {
  assetId: string;
  promotionId: string;
  observedAt: number;
  metrics: {
    usageCount: number;
    errorCount: number;
    errorRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    successRate: number;
  };
  trends: {
    errorRateChange: number; // 相对于前一窗口的变化
    responseTimeChange: number;
    usageChange: number;
  };
}

export interface RegressionDetection {
  detected: boolean;
  severity: "critical" | "high" | "medium" | "low";
  type: "error_rate_spike" | "performance_degradation" | "functional_regression" | "security_violation";
  description: string;
  evidence: {
    currentMetrics: AssetMetrics;
    baselineMetrics?: AssetMetrics;
    threshold: number;
    actualValue: number;
  };
  detectedAt: number;
}

export interface RollbackTrigger {
  triggered: boolean;
  reason: string;
  regression: RegressionDetection;
  rollbackPlan: {
    targetVersion: string;
    steps: string[];
    estimatedDowntime: string;
  };
  executedAt?: number;
  success?: boolean;
}

export interface ObservationReport {
  reportId: string;
  promotionId: string;
  assetId: string;
  observationPeriod: {
    start: number;
    end: number;
    duration: number;
  };
  metrics: AssetMetrics;
  regressions: RegressionDetection[];
  rollbackTrigger?: RollbackTrigger;
  recommendations: string[];
  overallStatus: "healthy" | "warning" | "critical";
  summary: string;
}

export class PostPromotionObserver {
  private config: Required<PromotionObservationConfig>;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private observationHistory: Map<string, ObservationReport[]> = new Map();
  
  constructor(config: PromotionObservationConfig = {}) {
    this.config = {
      observationWindowMs: config.observationWindowMs ?? 24 * 60 * 60 * 1000, // 24 小时
      checkIntervalMs: config.checkIntervalMs ?? 5 * 60 * 1000, // 5 分钟
      autoRollbackEnabled: config.autoRollbackEnabled ?? true,
      regressionThreshold: config.regressionThreshold ?? 0.05, // 5%
    };
  }
  
  /**
   * 开始观察已晋升的资产
   * 
   * @param promotionId 晋升记录 ID
   * @param assetId 资产 ID
   */
  async startObserving(promotionId: string, assetId: string): Promise<void> {
    console.log(`[PostPromotionObserver] 开始观察资产: ${assetId} (晋升ID: ${promotionId})`);
    
    // 如果已有观察任务，先停止
    this.stopObserving(promotionId);
    
    // 立即执行一次观察
    await this.observe(promotionId, assetId);
    
    // 设置定时检查
    const timer = setInterval(async () => {
      await this.observe(promotionId, assetId);
    }, this.config.checkIntervalMs);
    
    this.timers.set(promotionId, timer);
    
    // 在观察窗口结束后自动停止
    setTimeout(() => {
      this.stopObserving(promotionId);
      console.log(`[PostPromotionObserver] 观察窗口结束: ${assetId}`);
    }, this.config.observationWindowMs);
  }
  
  /**
   * 停止观察
   */
  stopObserving(promotionId: string): void {
    const timer = this.timers.get(promotionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(promotionId);
      console.log(`[PostPromotionObserver] 停止观察: ${promotionId}`);
    }
  }
  
  /**
   * 执行单次观察
   */
  async observe(promotionId: string, assetId: string): Promise<ObservationReport> {
    const reportId = `obs-${Date.now()}-${promotionId.slice(0, 8)}`;
    const startTime = Date.now();
    
    console.log(`[PostPromotionObserver] 执行观察: ${reportId}`);
    
    try {
      // 1. 收集指标
      const metrics = await this.collectMetrics(promotionId, assetId);
      
      // 2. 检测回归
      const regressions = await this.detectRegressions(metrics);
      
      // 3. 如果需要，触发回滚
      let rollbackTrigger: RollbackTrigger | undefined;
      if (regressions.some(r => r.severity === "critical" || r.severity === "high")) {
        if (this.config.autoRollbackEnabled) {
          rollbackTrigger = await this.triggerRollback(promotionId, assetId, regressions[0]);
        }
      }
      
      // 4. 生成建议
      const recommendations = this.generateRecommendations(metrics, regressions);
      
      // 5. 确定整体状态
      const overallStatus = this.determineOverallStatus(regressions);
      
      // 6. 生成报告
      const report: ObservationReport = {
        reportId,
        promotionId,
        assetId,
        observationPeriod: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime,
        },
        metrics,
        regressions,
        rollbackTrigger,
        recommendations,
        overallStatus,
        summary: this.generateSummary(metrics, regressions, overallStatus),
      };
      
      // 7. 保存历史记录
      this.saveObservationHistory(promotionId, report);
      
      // 8. 如果有严重问题，发送告警
      if (overallStatus === "critical") {
        await this.sendAlert(report);
      }
      
      console.log(`[PostPromotionObserver] 观察完成: ${overallStatus}`);
      
      return report;
    } catch (error) {
      console.error(`[PostPromotionObserver] 观察失败:`, error);
      throw error;
    }
  }
  
  /**
   * 收集资产指标
   */
  private async collectMetrics(promotionId: string, assetId: string): Promise<AssetMetrics> {
    // TODO: 从实际的监控系统收集指标
    // 当前生成模拟数据
    
    const errorRate = Math.random() * 0.1; // 0-10% 错误率
    const avgResponseTime = 100 + Math.random() * 400; // 100-500ms
    const usageCount = Math.floor(Math.random() * 1000);
    const errorCount = Math.floor(usageCount * errorRate);
    
    const metrics: AssetMetrics = {
      assetId,
      promotionId,
      observedAt: Date.now(),
      metrics: {
        usageCount,
        errorCount,
        errorRate,
        avgResponseTime,
        p95ResponseTime: avgResponseTime * 1.5,
        p99ResponseTime: avgResponseTime * 2.0,
        successRate: 1 - errorRate,
      },
      trends: {
        errorRateChange: (Math.random() - 0.5) * 0.02, // ±2% 变化
        responseTimeChange: (Math.random() - 0.5) * 50, // ±50ms 变化
        usageChange: (Math.random() - 0.5) * 100, // ±100 使用量变化
      },
    };
    
    return metrics;
  }
  
  /**
   * 检测回归
   */
  private async detectRegressions(metrics: AssetMetrics): Promise<RegressionDetection[]> {
    const regressions: RegressionDetection[] = [];
    
    // 检测错误率飙升
    if (metrics.metrics.errorRate > this.config.regressionThreshold) {
      regressions.push({
        detected: true,
        severity: metrics.metrics.errorRate > 0.1 ? "critical" : "high",
        type: "error_rate_spike",
        description: `错误率 ${(metrics.metrics.errorRate * 100).toFixed(2)}% 超过阈值 ${(this.config.regressionThreshold * 100).toFixed(2)}%`,
        evidence: {
          currentMetrics: metrics,
          threshold: this.config.regressionThreshold,
          actualValue: metrics.metrics.errorRate,
        },
        detectedAt: Date.now(),
      });
    }
    
    // 检测性能退化
    if (metrics.trends.responseTimeChange > 100) {
      regressions.push({
        detected: true,
        severity: metrics.trends.responseTimeChange > 200 ? "high" : "medium",
        type: "performance_degradation",
        description: `响应时间增加 ${metrics.trends.responseTimeChange.toFixed(0)}ms`,
        evidence: {
          currentMetrics: metrics,
          threshold: 100,
          actualValue: metrics.trends.responseTimeChange,
        },
        detectedAt: Date.now(),
      });
    }
    
    // 检测使用量异常下降
    if (metrics.trends.usageChange < -500) {
      regressions.push({
        detected: true,
        severity: "medium",
        type: "functional_regression",
        description: `使用量下降 ${Math.abs(metrics.trends.usageChange)}，可能存在功能问题`,
        evidence: {
          currentMetrics: metrics,
          threshold: -500,
          actualValue: metrics.trends.usageChange,
        },
        detectedAt: Date.now(),
      });
    }
    
    return regressions;
  }
  
  /**
   * 触发回滚
   */
  private async triggerRollback(
    promotionId: string,
    assetId: string,
    regression: RegressionDetection
  ): Promise<RollbackTrigger> {
    console.log(`[PostPromotionObserver] 触发回滚: ${assetId}, 原因: ${regression.description}`);
    
    const rollbackTrigger: RollbackTrigger = {
      triggered: true,
      reason: regression.description,
      regression,
      rollbackPlan: {
        targetVersion: "previous-stable",
        steps: [
          "1. 停止当前版本服务",
          "2. 恢复到上一稳定版本",
          "3. 验证回滚后的功能",
          "4. 通知相关人员",
        ],
        estimatedDowntime: "2-5 minutes",
      },
      executedAt: Date.now(),
    };
    
    // TODO: 实际执行回滚操作
    // 当前模拟回滚成功
    rollbackTrigger.success = true;
    
    console.log(`[PostPromotionObserver] 回滚执行完成: ${assetId}`);
    
    return rollbackTrigger;
  }
  
  /**
   * 生成建议
   */
  private generateRecommendations(
    metrics: AssetMetrics,
    regressions: RegressionDetection[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (regressions.length === 0) {
      recommendations.push("资产运行正常，继续观察");
      return recommendations;
    }
    
    for (const regression of regressions) {
      switch (regression.type) {
        case "error_rate_spike":
          recommendations.push("检查错误日志，定位错误根源");
          recommendations.push("考虑临时降级或回滚");
          break;
        case "performance_degradation":
          recommendations.push("分析性能瓶颈，优化热点代码");
          recommendations.push("检查资源使用情况（CPU、内存、IO）");
          break;
        case "functional_regression":
          recommendations.push("审查最近的变更，确认是否有破坏性改动");
          recommendations.push("运行完整的回归测试套件");
          break;
        case "security_violation":
          recommendations.push("立即隔离资产，进行安全审计");
          recommendations.push("通知安全团队");
          break;
      }
    }
    
    return recommendations;
  }
  
  /**
   * 确定整体状态
   */
  private determineOverallStatus(regressions: RegressionDetection[]): "healthy" | "warning" | "critical" {
    if (regressions.some(r => r.severity === "critical")) {
      return "critical";
    }
    
    if (regressions.some(r => r.severity === "high")) {
      return "warning";
    }
    
    if (regressions.length > 0) {
      return "warning";
    }
    
    return "healthy";
  }
  
  /**
   * 生成摘要
   */
  private generateSummary(
    metrics: AssetMetrics,
    regressions: RegressionDetection[],
    status: "healthy" | "warning" | "critical"
  ): string {
    if (status === "healthy") {
      return `资产运行正常，错误率: ${(metrics.metrics.errorRate * 100).toFixed(2)}%, 平均响应时间: ${metrics.metrics.avgResponseTime.toFixed(0)}ms`;
    }
    
    const regressionTypes = regressions.map(r => r.type).join(", ");
    return `检测到 ${regressions.length} 个回归信号 (${regressionTypes}), 状态: ${status}`;
  }
  
  /**
   * 保存观察历史
   */
  private saveObservationHistory(promotionId: string, report: ObservationReport): void {
    if (!this.observationHistory.has(promotionId)) {
      this.observationHistory.set(promotionId, []);
    }
    
    const history = this.observationHistory.get(promotionId)!;
    history.push(report);
    
    // 只保留最近 100 条记录
    if (history.length > 100) {
      history.shift();
    }
  }
  
  /**
   * 发送告警
   */
  private async sendAlert(report: ObservationReport): Promise<void> {
    console.warn(`[PostPromotionObserver] ⚠️  严重告警: ${report.summary}`);
    console.warn(`[PostPromotionObserver] 资产: ${report.assetId}`);
    console.warn(`[PostPromotionObserver] 回归数: ${report.regressions.length}`);
    
    if (report.rollbackTrigger) {
      console.warn(`[PostPromotionObserver] 已触发回滚: ${report.rollbackTrigger.reason}`);
    }
    
    // TODO: 集成实际的告警系统（如 Slack、邮件等）
  }
  
  /**
   * 获取观察历史
   */
  getObservationHistory(promotionId: string): ObservationReport[] {
    return this.observationHistory.get(promotionId) || [];
  }
  
  /**
   * 清理所有观察任务
   */
  cleanup(): void {
    for (const [promotionId, timer] of this.timers.entries()) {
      clearInterval(timer);
      console.log(`[PostPromotionObserver] 清理观察任务: ${promotionId}`);
    }
    this.timers.clear();
  }
}

// 导出单例实例
let postPromotionObserverInstance: PostPromotionObserver | null = null;

export function getPostPromotionObserver(): PostPromotionObserver {
  if (!postPromotionObserverInstance) {
    postPromotionObserverInstance = new PostPromotionObserver();
  }
  return postPromotionObserverInstance;
}

export function initializePostPromotionObserver(config?: PromotionObservationConfig): PostPromotionObserver {
  if (postPromotionObserverInstance) {
    console.log("[PostPromotionObserver] 实例已存在，使用现有实例");
    return postPromotionObserverInstance;
  }
  
  postPromotionObserverInstance = new PostPromotionObserver(config);
  return postPromotionObserverInstance;
}
