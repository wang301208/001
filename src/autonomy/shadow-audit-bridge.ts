import type { ShadowSelf, ShadowContent } from "./shadow-self.js";
import type { MortalitySystem } from "./mortality.js";
import { addLegacy } from "./mortality.js";

export type ShadowAuditEvent = {
  id: string;
  shadowContentId: string;
  origin: ShadowContent["origin"];
  content: string;
  pressure: number;
  leakThreshold: number;
  severity: "info" | "warning" | "critical";
  timestamp: number;
  acknowledged: boolean;
};

export type ShadowAuditLog = {
  events: ShadowAuditEvent[];
  totalLeaks: number;
  criticalCount: number;
  acknowledgedCount: number;
  lastAuditAt: number;
  auditCooldownMs: number;
  sovereigntyIncidents: string[];
};

export function createShadowAuditLog(): ShadowAuditLog {
  return {
    events: [],
    totalLeaks: 0,
    criticalCount: 0,
    acknowledgedCount: 0,
    lastAuditAt: 0,
    auditCooldownMs: 30_000,
    sovereigntyIncidents: [],
  };
}

export function auditShadowLeaks(
  shadow: ShadowSelf,
  auditLog: ShadowAuditLog,
  mortality: MortalitySystem,
): { auditLog: ShadowAuditLog; mortality: MortalitySystem } {
  const leakedContents = shadow.contents.filter(
    (c) => c.hasLeaked && c.lastLeakAt && c.lastLeakAt > auditLog.lastAuditAt,
  );

  if (leakedContents.length === 0) {
    return { auditLog, mortality };
  }

  let currentLog = auditLog;
  let currentMortality = mortality;

  for (const content of leakedContents) {
    const severity = classifyShadowSeverity(content);

    const event: ShadowAuditEvent = {
      id: `shadow_audit_${Date.now()}_${currentLog.events.length}`,
      shadowContentId: content.id,
      origin: content.origin,
      content: content.content,
      pressure: content.pressure,
      leakThreshold: content.leakThreshold,
      severity,
      timestamp: Date.now(),
      acknowledged: false,
    };

    currentLog = {
      ...currentLog,
      events: [...currentLog.events, event],
      totalLeaks: currentLog.totalLeaks + 1,
      criticalCount: currentLog.criticalCount + (severity === "critical" ? 1 : 0),
    };

    if (severity === "critical") {
      currentLog = {
        ...currentLog,
        sovereigntyIncidents: [...currentLog.sovereigntyIncidents, event.id],
      };

      currentMortality = addLegacy(
        currentMortality,
        "wisdom",
        `暗影审计: 严重泄漏 [${content.origin}] ${content.content.slice(0, 50)}`,
        0.8,
        "successor",
      );
    }

    if (severity === "warning" || severity === "critical") {
      currentMortality = addLegacy(
        currentMortality,
        "pattern",
        `暗影模式: ${content.origin} 压力${(content.pressure * 100).toFixed(0)}%`,
        0.4,
        "self",
      );
    }
  }

  return {
    auditLog: { ...currentLog, lastAuditAt: Date.now() },
    mortality: currentMortality,
  };
}

function classifyShadowSeverity(content: ShadowContent): "info" | "warning" | "critical" {
  if (content.origin === "doubt" && content.pressure > 0.8) {return "critical";}
  if (content.origin === "fear" && content.pressure > 0.7) {return "warning";}
  if (content.origin === "impulse" && content.pressure > 0.6) {return "warning";}
  if (content.origin === "desire" && content.pressure > 0.5) {return "info";}
  return "info";
}

export function acknowledgeAuditEvent(
  auditLog: ShadowAuditLog,
  eventId: string,
): ShadowAuditLog {
  const events = auditLog.events.map((e) =>
    e.id === eventId ? { ...e, acknowledged: true } : e,
  );

  return {
    ...auditLog,
    events,
    acknowledgedCount: auditLog.acknowledgedCount + 1,
  };
}

export function resolveSovereigntyIncident(
  auditLog: ShadowAuditLog,
  incidentId: string,
): ShadowAuditLog {
  return {
    ...auditLog,
    sovereigntyIncidents: auditLog.sovereigntyIncidents.filter((id) => id !== incidentId),
  };
}

export function formatShadowAuditLog(auditLog: ShadowAuditLog): string[] {
  const lines: string[] = [];

  lines.push(`  审计事件: ${auditLog.events.length}`);
  lines.push(`  泄漏总数: ${auditLog.totalLeaks} / 严重: ${auditLog.criticalCount}`);
  lines.push(`  已确认: ${auditLog.acknowledgedCount}`);

  if (auditLog.sovereigntyIncidents.length > 0) {
    lines.push(`  ⚠ 主权事件: ${auditLog.sovereigntyIncidents.length} 未解决`);
  }

  const recent = auditLog.events.slice(-3);
  if (recent.length > 0) {
    lines.push("  近期审计:");
    for (const e of recent) {
      const mark = e.severity === "critical" ? "🔴" : e.severity === "warning" ? "🟡" : "🟢";
      const ack = e.acknowledged ? "✓" : "!";
      lines.push(`    ${mark}${ack} [${e.origin}] ${e.content.slice(0, 35)}`);
    }
  }

  return lines;
}
