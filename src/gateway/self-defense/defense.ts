export type ThreatIndicators = {
  requestRate: number;
  errorRate: number;
  uniqueIpCount: number;
  authFailureRate: number;
  payloadSizeAvg: number;
  patternAnomalies: number;
  geoAnomalies: number;
};

export type DefenseAction = "allow" | "rate-limit" | "challenge" | "block" | "quarantine";

export type DefenseVerdict = {
  action: DefenseAction;
  confidence: number;
  reason: string;
  indicators: ThreatIndicators;
};

export type SelfDefenseRule = {
  name: string;
  evaluate(indicators: ThreatIndicators): { triggered: boolean; severity: number; reason: string };
  action: DefenseAction;
  cooldownMs: number;
};

export type SelfDefenseSystem = {
  evaluate(requestContext: Partial<ThreatIndicators>): DefenseVerdict;
  addRule(rule: SelfDefenseRule): void;
  removeRule(name: string): void;
  recordEvent(event: DefenseEvent): void;
  getActiveBlocks(): { ip: string; until: number; reason: string }[];
  getStats(): { totalEvaluations: number; totalBlocks: number; totalRateLimits: number; topThreats: string[] };
};

export type DefenseEvent = {
  type: "request" | "auth-failure" | "error" | "block" | "unblock";
  ip: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export function createSelfDefenseSystem(opts?: { blockDurationMs?: number; maxActiveBlocks?: number }): SelfDefenseSystem {
  const rules: SelfDefenseRule[] = [];
  const activeBlocks = new Map<string, { until: number; reason: string }>();
  const eventHistory: DefenseEvent[] = [];
  let totalEvaluations = 0;
  let totalBlocks = 0;
  let totalRateLimits = 0;
  const blockDurationMs = opts?.blockDurationMs ?? 300_000;
  const maxActiveBlocks = opts?.maxActiveBlocks ?? 1000;

  const defaultRules: SelfDefenseRule[] = [
    {
      name: "high-request-rate",
      evaluate: (ind) => ({ triggered: ind.requestRate > 100, severity: ind.requestRate / 100, reason: `请求频率 ${ind.requestRate}/min 超过阈值 100` }),
      action: "rate-limit",
      cooldownMs: 60_000,
    },
    {
      name: "high-auth-failure",
      evaluate: (ind) => ({ triggered: ind.authFailureRate > 0.5, severity: ind.authFailureRate, reason: `认证失败率 ${(ind.authFailureRate * 100).toFixed(0)}% 超过 50%` }),
      action: "block",
      cooldownMs: 300_000,
    },
    {
      name: "high-error-rate",
      evaluate: (ind) => ({ triggered: ind.errorRate > 0.3, severity: ind.errorRate, reason: `错误率 ${(ind.errorRate * 100).toFixed(0)}% 超过 30%` }),
      action: "rate-limit",
      cooldownMs: 120_000,
    },
    {
      name: "abnormal-payload-size",
      evaluate: (ind) => ({ triggered: ind.payloadSizeAvg > 1_000_000, severity: ind.payloadSizeAvg / 1_000_000, reason: `平均载荷 ${(ind.payloadSizeAvg / 1024).toFixed(0)}KB 异常` }),
      action: "challenge",
      cooldownMs: 30_000,
    },
    {
      name: "geo-anomaly",
      evaluate: (ind) => ({ triggered: ind.geoAnomalies > 5, severity: ind.geoAnomalies / 5, reason: `地理异常 ${ind.geoAnomalies} 次` }),
      action: "challenge",
      cooldownMs: 60_000,
    },
  ];

  for (const rule of defaultRules) {
    rules.push(rule);
  }

  return {
    evaluate(requestContext) {
      totalEvaluations++;
      const indicators: ThreatIndicators = {
        requestRate: requestContext.requestRate ?? 0,
        errorRate: requestContext.errorRate ?? 0,
        uniqueIpCount: requestContext.uniqueIpCount ?? 1,
        authFailureRate: requestContext.authFailureRate ?? 0,
        payloadSizeAvg: requestContext.payloadSizeAvg ?? 0,
        patternAnomalies: requestContext.patternAnomalies ?? 0,
        geoAnomalies: requestContext.geoAnomalies ?? 0,
      };

      const triggered: { rule: SelfDefenseRule; severity: number; reason: string }[] = [];
      for (const rule of rules) {
        const result = rule.evaluate(indicators);
        if (result.triggered) {
          triggered.push({ rule, severity: result.severity, reason: result.reason });
        }
      }

      if (triggered.length === 0) {
        return { action: "allow", confidence: 1, reason: "无威胁指示", indicators };
      }

      triggered.sort((a, b) => b.severity - a.severity);
      const worst = triggered[0];
      const confidence = Math.min(worst.severity, 1);

      if (worst.rule.action === "block") {
        totalBlocks++;
      }
      if (worst.rule.action === "rate-limit") {
        totalRateLimits++;
      }

      return { action: worst.rule.action, confidence, reason: worst.reason, indicators };
    },

    addRule(rule) {
      rules.push(rule);
    },

    removeRule(name) {
      const idx = rules.findIndex((r) => r.name === name);
      if (idx !== -1) {
        rules.splice(idx, 1);
      }
    },

    recordEvent(event) {
      eventHistory.push(event);
      if (event.type === "block" && event.metadata?.ip) {
        const ip = event.metadata.ip as string;
        if (activeBlocks.size < maxActiveBlocks) {
          activeBlocks.set(ip, { until: Date.now() + blockDurationMs, reason: event.metadata.reason as string ?? "threat detected" });
        }
      }
      if (event.type === "unblock" && event.metadata?.ip) {
        activeBlocks.delete(event.metadata.ip as string);
      }
    },

    getActiveBlocks() {
      const now = Date.now();
      const blocks: { ip: string; until: number; reason: string }[] = [];
      for (const [ip, block] of activeBlocks) {
        if (block.until > now) {
          blocks.push({ ip, until: block.until, reason: block.reason });
        } else {
          activeBlocks.delete(ip);
        }
      }
      return blocks;
    },

    getStats() {
      const recentEvents = eventHistory.filter((e) => e.timestamp > Date.now() - 3600_000);
      const threatIps = new Map<string, number>();
      for (const event of recentEvents) {
        if (event.type === "block" || event.type === "auth-failure") {
          threatIps.set(event.ip, (threatIps.get(event.ip) ?? 0) + 1);
        }
      }
      const topThreats = [...threatIps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip]) => ip);
      return { totalEvaluations, totalBlocks, totalRateLimits, topThreats };
    },
  };
}
