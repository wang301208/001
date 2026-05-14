import { describe, expect, it } from "vitest";
import { redactSensitiveStatusSummary } from "./status.summary.js";
import type { StatusSummary } from "./status.types.js";

function createRecentSessionRow() {
  return {
    key: "main",
    kind: "direct" as const,
    sessionId: "sess-1",
    updatedAt: 1,
    age: 2,
    totalTokens: 3,
    totalTokensFresh: true,
    remainingTokens: 4,
    percentUsed: 5,
    model: "gpt-5",
    contextTokens: 200_000,
    flags: ["id:sess-1"],
  };
}

describe("redactSensitiveStatusSummary", () => {
  it("removes sensitive session and path details while preserving summary structure", () => {
    const input: StatusSummary = {
      runtimeVersion: "2026.3.8",
      heartbeat: {
        defaultAgentId: "main",
        agents: [{ agentId: "main", enabled: true, every: "5m", everyMs: 300_000 }],
      },
      channelSummary: ["ok"],
      queuedSystemEvents: ["none"],
      governance: {
        observedAt: 1,
        discovered: true,
        freezeActive: false,
        proposalSummary: {
          total: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
          applied: 0,
        },
        findingSummary: {
          critical: 0,
          warn: 1,
          info: 0,
        },
        capabilitySummary: {
          requestedAgentIds: ["founder"],
          totalEntries: 2,
          gapCount: 1,
          criticalGapCount: 0,
          warningGapCount: 1,
          infoGapCount: 0,
          topGapIds: ["missing-plugin"],
        },
        genesisSummary: {
          teamId: "genesis",
          mode: "repair",
          blockerCount: 1,
          blockers: ["missing-plugin"],
          focusGapIds: ["missing-plugin"],
          stageCounts: {
            ready: 0,
            waiting: 1,
            blocked: 1,
          },
        },
        teamSummary: {
          teamId: "genesis",
          declared: true,
          memberCount: 3,
          missingMemberCount: 1,
          missingMemberIds: ["qa"],
          freezeActiveMemberCount: 1,
          freezeActiveMemberIds: ["founder"],
          runtimeHookCount: 4,
          effectiveToolDenyCount: 2,
        },
      },
      autonomy: {
        observedAt: 2,
        fleetSummary: {
          totalProfiles: 3,
          healthy: 1,
          idle: 1,
          drift: 1,
          missingLoop: 0,
          activeFlows: 2,
          driftAgentIds: ["strategist"],
          missingLoopAgentIds: [],
        },
        capabilitySummary: {
          requestedAgentIds: ["founder", "strategist", "librarian"],
          totalEntries: 4,
          gapCount: 1,
          criticalGapCount: 0,
          warningGapCount: 1,
          infoGapCount: 0,
          topGapIds: ["stale-index"],
        },
        genesisSummary: {
          teamId: "genesis",
          mode: "build",
          blockerCount: 1,
          blockers: ["stale-index"],
          focusGapIds: ["stale-index"],
          stageCounts: {
            ready: 1,
            waiting: 1,
            blocked: 0,
          },
        },
        lastSupervisorRun: {
          observedAt: 3,
          mode: "heal",
          changed: true,
          agentIds: ["founder", "strategist"],
          changedAgentIds: ["founder"],
          totals: {
            totalProfiles: 3,
            changed: 1,
            unchanged: 2,
            loopCreated: 1,
            loopUpdated: 0,
            flowStarted: 1,
            flowRestarted: 0,
          },
        },
      },
      tasks: {
        total: 2,
        active: 1,
        terminal: 1,
        failures: 1,
        byStatus: {
          queued: 1,
          running: 0,
          succeeded: 0,
          failed: 1,
          timed_out: 0,
          cancelled: 0,
          lost: 0,
        },
        byRuntime: {
          subagent: 0,
          acp: 1,
          cli: 0,
          cron: 1,
        },
      },
      taskAudit: {
        total: 1,
        warnings: 1,
        errors: 0,
        byCode: {
          stale_queued: 0,
          stale_running: 0,
          lost: 0,
          delivery_failed: 1,
          missing_governance_runtime: 0,
          missing_cleanup: 0,
          inconsistent_timestamps: 0,
        },
      },
      sessions: {
        paths: ["/tmp/zhushou/sessions.json"],
        count: 1,
        defaults: { model: "gpt-5", contextTokens: 200_000 },
        recent: [createRecentSessionRow()],
        byAgent: [
          {
            agentId: "main",
            path: "/tmp/zhushou/main-sessions.json",
            count: 1,
            recent: [createRecentSessionRow()],
          },
        ],
      },
    };

    const redacted = redactSensitiveStatusSummary(input);
    expect(redacted.sessions.paths).toEqual([]);
    expect(redacted.sessions.defaults).toEqual({ model: null, contextTokens: null });
    expect(redacted.sessions.recent).toEqual([]);
    expect(redacted.sessions.byAgent[0]?.path).toBe("[redacted]");
    expect(redacted.sessions.byAgent[0]?.recent).toEqual([]);
    expect(redacted.runtimeVersion).toBe("2026.3.8");
    expect(redacted.heartbeat).toEqual(input.heartbeat);
    expect(redacted.channelSummary).toEqual(input.channelSummary);
    expect(redacted.governance).toEqual(input.governance);
    expect(redacted.autonomy).toEqual(input.autonomy);
    expect(redacted.tasks).toEqual(input.tasks);
    expect(redacted.taskAudit).toEqual(input.taskAudit);
  });
});
