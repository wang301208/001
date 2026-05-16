export type CostRecord = {
  timestamp: number;
  tenantId: string;
  modelId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  channel?: string;
  sessionId?: string;
};

export type TenantQuota = {
  tenantId: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  dailyUsedUsd: number;
  monthlyUsedUsd: number;
  rateLimitPerMinute: number;
  allowedModels: string[];
  priority: "low" | "normal" | "high";
};

export type CostGovernance = {
  recordCost(record: Omit<CostRecord, "timestamp">): void;
  checkQuota(tenantId: string, estimatedCostUsd: number): { allowed: boolean; reason?: string; remainingBudgetUsd: number };
  getTenantQuota(tenantId: string): TenantQuota;
  setTenantQuota(tenantId: string, quota: Partial<TenantQuota>): void;
  getDailyReport(tenantId: string): { totalCostUsd: number; byModel: Record<string, number>; byChannel: Record<string, number>; requestCount: number };
  getMonthlyReport(tenantId: string): { totalCostUsd: number; budgetRemainingUsd: number; utilizationPercent: number };
  getCostOptimizationSuggestions(tenantId: string): CostOptimizationSuggestion[];
};

export type CostOptimizationSuggestion = {
  type: "model-downgrade" | "cache-opportunity" | "batch-opportunity" | "quota-warning";
  description: string;
  estimatedSavingsUsd: number;
  confidence: number;
};

export function createCostGovernance(): CostGovernance {
  const records: CostRecord[] = [];
  const quotas = new Map<string, TenantQuota>();

  function getOrCreateQuota(tenantId: string): TenantQuota {
    let quota = quotas.get(tenantId);
    if (!quota) {
      quota = {
        tenantId,
        dailyLimitUsd: 10,
        monthlyLimitUsd: 200,
        dailyUsedUsd: 0,
        monthlyUsedUsd: 0,
        rateLimitPerMinute: 60,
        allowedModels: ["*"],
        priority: "normal",
      };
      quotas.set(tenantId, quota);
    }
    return quota;
  }

  function resetDailyIfNeeded(quota: TenantQuota): void {
    const today = new Date().toISOString().slice(0, 10);
    const lastRecord = records.filter((r) => r.tenantId === quota.tenantId).pop();
    if (lastRecord) {
      const lastDay = new Date(lastRecord.timestamp).toISOString().slice(0, 10);
      if (lastDay !== today) {
        quota.dailyUsedUsd = 0;
      }
    }
  }

  return {
    recordCost(record) {
      const fullRecord: CostRecord = { ...record, timestamp: Date.now() };
      records.push(fullRecord);
      const quota = getOrCreateQuota(record.tenantId);
      quota.dailyUsedUsd += record.costUsd;
      quota.monthlyUsedUsd += record.costUsd;
    },

    checkQuota(tenantId, estimatedCostUsd) {
      const quota = getOrCreateQuota(tenantId);
      resetDailyIfNeeded(quota);

      if (quota.dailyUsedUsd + estimatedCostUsd > quota.dailyLimitUsd) {
        return { allowed: false, reason: `日配额超限: $${quota.dailyUsedUsd.toFixed(4)} + $${estimatedCostUsd.toFixed(4)} > $${quota.dailyLimitUsd}`, remainingBudgetUsd: 0 };
      }
      if (quota.monthlyUsedUsd + estimatedCostUsd > quota.monthlyLimitUsd) {
        return { allowed: false, reason: `月配额超限: $${quota.monthlyUsedUsd.toFixed(4)} + $${estimatedCostUsd.toFixed(4)} > $${quota.monthlyLimitUsd}`, remainingBudgetUsd: 0 };
      }
      return {
        allowed: true,
        remainingBudgetUsd: quota.dailyLimitUsd - quota.dailyUsedUsd - estimatedCostUsd,
      };
    },

    getTenantQuota(tenantId) {
      return getOrCreateQuota(tenantId);
    },

    setTenantQuota(tenantId, quotaUpdate) {
      const quota = getOrCreateQuota(tenantId);
      Object.assign(quota, quotaUpdate);
    },

    getDailyReport(tenantId) {
      const today = new Date().toISOString().slice(0, 10);
      const todayRecords = records.filter((r) => r.tenantId === tenantId && new Date(r.timestamp).toISOString().slice(0, 10) === today);
      const byModel: Record<string, number> = {};
      const byChannel: Record<string, number> = {};
      for (const r of todayRecords) {
        byModel[r.modelId] = (byModel[r.modelId] ?? 0) + r.costUsd;
        if (r.channel) {
          byChannel[r.channel] = (byChannel[r.channel] ?? 0) + r.costUsd;
        }
      }
      return {
        totalCostUsd: todayRecords.reduce((s, r) => s + r.costUsd, 0),
        byModel,
        byChannel,
        requestCount: todayRecords.length,
      };
    },

    getMonthlyReport(tenantId) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthRecords = records.filter((r) => r.tenantId === tenantId && r.timestamp >= monthStart);
      const quota = getOrCreateQuota(tenantId);
      const totalCostUsd = monthRecords.reduce((s, r) => s + r.costUsd, 0);
      return {
        totalCostUsd,
        budgetRemainingUsd: quota.monthlyLimitUsd - totalCostUsd,
        utilizationPercent: quota.monthlyLimitUsd > 0 ? (totalCostUsd / quota.monthlyLimitUsd) * 100 : 0,
      };
    },

    getCostOptimizationSuggestions(tenantId) {
      const suggestions: CostOptimizationSuggestion[] = [];
      const quota = getOrCreateQuota(tenantId);
      const report = this.getDailyReport(tenantId);

      if (quota.dailyUsedUsd > quota.dailyLimitUsd * 0.8) {
        suggestions.push({
          type: "quota-warning",
          description: `日用量已达配额的 ${((quota.dailyUsedUsd / quota.dailyLimitUsd) * 100).toFixed(0)}%，考虑降低模型或增加配额`,
          estimatedSavingsUsd: quota.dailyUsedUsd * 0.3,
          confidence: 0.9,
        });
      }

      for (const [model, cost] of Object.entries(report.byModel)) {
        if (cost > 1 && model.startsWith("gpt-4")) {
          suggestions.push({
            type: "model-downgrade",
            description: `${model} 日消耗 $${cost.toFixed(2)}，考虑降级到 gpt-4o-mini`,
            estimatedSavingsUsd: cost * 0.8,
            confidence: 0.7,
          });
        }
      }

      return suggestions;
    },
  };
}
