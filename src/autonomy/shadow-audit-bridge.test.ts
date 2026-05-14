import { describe, it, expect } from "vitest";
import {
  createShadowAuditLog,
  auditShadowLeaks,
  acknowledgeAuditEvent,
  resolveSovereigntyIncident,
} from "./shadow-audit-bridge.js";
import { createShadowSelf, accumulatePressure } from "./shadow-self.js";
import { createMortalitySystem } from "./mortality.js";

describe("shadow-audit-bridge", () => {
  describe("createShadowAuditLog", () => {
    it("creates empty audit log", () => {
      const log = createShadowAuditLog();
      expect(log.events).toHaveLength(0);
      expect(log.totalLeaks).toBe(0);
      expect(log.criticalCount).toBe(0);
      expect(log.sovereigntyIncidents).toHaveLength(0);
    });
  });

  describe("auditShadowLeaks", () => {
    it("returns unchanged log when no new leaks", () => {
      const shadow = createShadowSelf();
      const auditLog = createShadowAuditLog();
      const mortality = createMortalitySystem();

      const result = auditShadowLeaks(shadow, auditLog, mortality);
      expect(result.auditLog.totalLeaks).toBe(0);
    });

    it("detects leaked shadow contents", () => {
      let shadow = createShadowSelf();
      for (let i = 0; i < 100; i++) {
        shadow = accumulatePressure(shadow, 10000);
      }

      const leakedContents = shadow.contents.filter((c) => c.hasLeaked);
      if (leakedContents.length === 0) {return;}

      const auditLog = createShadowAuditLog();
      const mortality = createMortalitySystem();

      const result = auditShadowLeaks(shadow, auditLog, mortality);
      expect(result.auditLog.totalLeaks).toBeGreaterThan(0);
      expect(result.auditLog.events.length).toBeGreaterThan(0);
    });
  });

  describe("acknowledgeAuditEvent", () => {
    it("marks event as acknowledged", () => {
      const log = createShadowAuditLog();
      const event = {
        id: "test_event",
        shadowContentId: "sc_1",
        origin: "fear" as const,
        content: "test",
        pressure: 0.8,
        leakThreshold: 0.7,
        severity: "warning" as const,
        timestamp: Date.now(),
        acknowledged: false,
      };

      const logWithEvent = { ...log, events: [event] };
      const result = acknowledgeAuditEvent(logWithEvent, "test_event");
      expect(result.events[0]!.acknowledged).toBe(true);
      expect(result.acknowledgedCount).toBe(1);
    });
  });

  describe("resolveSovereigntyIncident", () => {
    it("removes resolved incident", () => {
      const log = { ...createShadowAuditLog(), sovereigntyIncidents: ["inc_1", "inc_2"] };
      const result = resolveSovereigntyIncident(log, "inc_1");
      expect(result.sovereigntyIncidents).toEqual(["inc_2"]);
    });
  });
});
