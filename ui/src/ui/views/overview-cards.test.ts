/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { OverviewCardsProps } from "./overview-cards.ts";
import { renderOverviewCards } from "./overview-cards.ts";

function createProps(overrides: Partial<OverviewCardsProps> = {}): OverviewCardsProps {
  return {
    statusSummary: null,
    usageResult: null,
    sessionsResult: null,
    skillsReport: null,
    cronJobs: [],
    cronStatus: null,
    modelAuthStatus: null,
    presenceCount: 0,
    onNavigate: () => undefined,
    onNavigateToGovernance: () => undefined,
    onNavigateToAutonomy: () => undefined,
    ...overrides,
  };
}

describe("renderOverviewCards", () => {
  it("renders governance and autonomy cards from the status summary", async () => {
    const governanceClick = vi.fn();
    const autonomyClick = vi.fn();
    const container = document.createElement("div");

    render(
      renderOverviewCards(
        createProps({
          statusSummary: {
            heartbeat: {
              defaultAgentId: "founder",
              agents: [],
            },
            channelSummary: [],
            queuedSystemEvents: [],
            tasks: {
              totalDefinitions: 0,
              registeredIds: [],
              taskflows: {
                enabled: false,
                registered: 0,
                pending: 0,
                running: 0,
              },
            } as never,
            taskAudit: {
              queued: 0,
              running: 0,
              succeeded: 0,
              failed: 0,
              cancelled: 0,
              latestUpdatedAt: null,
              activeTaskIds: [],
              recentFailures: [],
            } as never,
            sessions: {
              paths: [],
              count: 0,
              defaults: {
                model: null,
                contextTokens: null,
              },
              recent: [],
              byAgent: [],
            },
            governance: {
              observedAt: Date.now(),
              discovered: true,
              freezeActive: true,
              freezeReasonCode: "freeze_without_auditor",
              proposalSummary: {
                total: 3,
                pending: 2,
                approved: 1,
                rejected: 0,
                applied: 0,
              },
              findingSummary: {
                critical: 1,
                warn: 2,
                info: 0,
              },
              capabilitySummary: {
                requestedAgentIds: ["founder"],
                totalEntries: 3,
                gapCount: 2,
                criticalGapCount: 1,
                warningGapCount: 1,
                infoGapCount: 0,
                topGapIds: ["capability_inventory.demo_gap"],
              },
              genesisSummary: {
                teamId: "genesis_team",
                mode: "repair",
                blockerCount: 1,
                blockers: ["missing genesis roles: qa"],
                focusGapIds: ["capability_inventory.demo_gap"],
                stageCounts: {
                  ready: 1,
                  waiting: 0,
                  blocked: 0,
                },
              },
              teamSummary: {
                teamId: "genesis_team",
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
              observedAt: Date.now(),
              fleetSummary: {
                totalProfiles: 4,
                healthy: 2,
                idle: 1,
                drift: 1,
                missingLoop: 1,
                activeFlows: 2,
                driftAgentIds: ["strategist"],
                missingLoopAgentIds: ["founder"],
              },
              capabilitySummary: {
                requestedAgentIds: [],
                totalEntries: 4,
                gapCount: 2,
                criticalGapCount: 1,
                warningGapCount: 1,
                infoGapCount: 0,
                topGapIds: ["autonomy.capability.loop_missing"],
              },
              genesisSummary: {
                teamId: "genesis_team",
                mode: "repair",
                blockerCount: 0,
                blockers: [],
                focusGapIds: ["autonomy.capability.loop_missing"],
                stageCounts: {
                  ready: 2,
                  waiting: 0,
                  blocked: 0,
                },
              },
            },
          },
          onNavigateToGovernance: governanceClick,
          onNavigateToAutonomy: autonomyClick,
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(container.textContent).toContain("Governance");
    expect(container.textContent).toContain("Autonomy");
    expect(container.textContent).toContain("Freeze");
    expect(container.textContent).toContain("1 missing");
    expect(container.textContent).toContain("2 drift");

    container.querySelector<HTMLButtonElement>('[data-kind="governance"]')?.click();
    container.querySelector<HTMLButtonElement>('[data-kind="autonomy"]')?.click();

    expect(governanceClick).toHaveBeenCalledTimes(1);
    expect(autonomyClick).toHaveBeenCalledTimes(1);
  });
});
