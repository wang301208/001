import { describe, expect, it } from "vitest";
import {
  buildStatusAllAgentsValue,
  buildStatusAutonomyValue,
  buildStatusEventsValue,
  buildStatusGovernanceValue,
  buildStatusPluginCompatibilityValue,
  buildStatusProbesValue,
  buildStatusSecretsValue,
  buildStatusSessionsOverviewValue,
  countActiveStatusAgents,
} from "./status-overview-values.ts";

describe("status-overview-values", () => {
  it("counts active agents and formats status-all agent value", () => {
    const agentStatus = {
      bootstrapPendingCount: 2,
      totalSessions: 3,
      agents: [
        {
          id: "main",
          lastActiveAgeMs: 5_000,
          governance: { charterDeclared: true, freezeActive: false },
        },
        {
          id: "ops",
          lastActiveAgeMs: 11 * 60_000,
          governance: { charterDeclared: true, freezeActive: true },
        },
        { id: "idle", lastActiveAgeMs: null },
      ],
    };

    expect(countActiveStatusAgents({ agentStatus })).toBe(1);
    expect(buildStatusAllAgentsValue({ agentStatus })).toBe(
      "3 total | 2 bootstrapping | 1 active | 3 sessions | 2 chartered | 1 frozen",
    );
  });

  it("formats secrets events probes and plugin compatibility values", () => {
    expect(buildStatusSecretsValue(0)).toBe("none");
    expect(buildStatusSecretsValue(1)).toBe("1 diagnostic");
    expect(buildStatusEventsValue({ queuedSystemEvents: [] })).toBe("none");
    expect(buildStatusEventsValue({ queuedSystemEvents: ["a", "b"] })).toBe("2 queued");
    expect(
      buildStatusProbesValue({
        health: undefined,
        ok: (value) => `ok(${value})`,
        muted: (value) => `muted(${value})`,
      }),
    ).toBe("muted(skipped (use --deep))");
    expect(
      buildStatusPluginCompatibilityValue({
        notices: [{ pluginId: "a" }, { pluginId: "a" }, { pluginId: "b" }],
        ok: (value) => `ok(${value})`,
        warn: (value) => `warn(${value})`,
      }),
    ).toBe("warn(3 notices | 2 plugins)");
  });

  it("formats sessions overview values", () => {
    expect(
      buildStatusSessionsOverviewValue({
        sessions: {
          count: 2,
          paths: ["store.json", "other.json"],
          defaults: { model: "gpt-5.4", contextTokens: 12_000 },
        },
        formatKTokens: (value) => `${Math.round(value / 1000)}k`,
      }),
    ).toBe("2 active | default gpt-5.4 (12k ctx) | 2 stores");
  });

  it("formats governance overview values with team state", () => {
    expect(
      buildStatusGovernanceValue({
        governance: {
          observedAt: 1,
          discovered: true,
          freezeActive: false,
          proposalSummary: {
            total: 3,
            pending: 1,
            approved: 1,
            rejected: 0,
            applied: 1,
          },
          findingSummary: {
            critical: 0,
            warn: 1,
            info: 1,
          },
          capabilitySummary: {
            requestedAgentIds: ["founder"],
            totalEntries: 4,
            gapCount: 2,
            criticalGapCount: 1,
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
        ok: (value) => `ok(${value})`,
        warn: (value) => `warn(${value})`,
        muted: (value) => `muted(${value})`,
      }),
    ).toBe(
      "ok(freeze open) | 1 pending | warn(1 finding) | warn(2 gaps) | warn(team missing 1 member) | warn(1 blocker)",
    );
  });

  it("formats autonomy overview values", () => {
    expect(
      buildStatusAutonomyValue({
        autonomy: {
          observedAt: 2,
          fleetSummary: {
            totalProfiles: 3,
            healthy: 1,
            idle: 1,
            drift: 1,
            missingLoop: 1,
            activeFlows: 2,
            driftAgentIds: ["strategist"],
            missingLoopAgentIds: ["librarian"],
          },
          replaySummary: {
            totalRunners: 2,
            ready: 1,
            passed: 1,
            failed: 0,
            promotable: 1,
            blocked: 1,
            readyAgentIds: ["strategist"],
            promotableAgentIds: ["founder"],
            blockedAgentIds: ["strategist"],
          },
          capabilitySummary: {
            requestedAgentIds: ["founder", "strategist", "librarian"],
            totalEntries: 5,
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
        },
        ok: (value) => `ok(${value})`,
        warn: (value) => `warn(${value})`,
        muted: (value) => `muted(${value})`,
      }),
    ).toBe(
      "3 profiles | warn(1 drift) | warn(1 missing loop) | 2 active | warn(1 gap) | warn(1 replay ready) | warn(1 blocker)",
    );
  });
});
