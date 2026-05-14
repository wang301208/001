import { beforeEach, describe, expect, it, vi } from "vitest";

const agentScopeMocks = vi.hoisted(() => ({
  listAgentIds: vi.fn(() => ["main", "founder", "strategist"]),
  resolveDefaultAgentId: vi.fn(() => "main"),
}));

const governanceSummaryMocks = vi.hoisted(() => ({
  resolveAgentToolGovernanceSummary: vi.fn(() => ({
    charterDeclared: true,
    charterTitle: "Founder",
    charterLayer: "evolution",
    charterToolDeny: ["web_fetch", "web_search"],
    charterRequireAgentId: true,
    charterExecutionContract: "strict-agentic" as const,
    charterElevatedLocked: true,
    freezeActive: true,
    freezeReasonCode: "constitution_missing" as const,
    freezeDeny: ["apply_patch", "write", "edit", "exec", "gateway"],
    freezeDetails: [],
  })),
}));

vi.mock("../agents/agent-scope.js", () => agentScopeMocks);
vi.mock("./tool-governance-summary.js", () => governanceSummaryMocks);

import {
  buildAgentGovernanceSelectionHint,
  buildUnknownAgentIdMessage,
} from "./agent-selection-feedback.js";

describe("agent-selection-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds unknown agent messages with charter-only hints", () => {
    const message = buildUnknownAgentIdMessage({
      cfg: {
        agents: {
          list: [{ id: "main", default: true }],
        },
      } as never,
      rawAgentId: "ghost",
      inspectHint: 'Use "zhushou agents list" to inspect available agents.',
    });

    expect(message).toContain('Unknown agent id "ghost".');
    expect(message).toContain("Known agents: main, founder, strategist.");
    expect(message).toContain("Default: main.");
    expect(message).toContain("Charter-only: founder, strategist.");
    expect(message).toContain('Use "zhushou agents list" to inspect available agents.');
  });

  it("builds compact governance hints for selected agents", () => {
    const message = buildAgentGovernanceSelectionHint({
      cfg: {
        agents: {
          list: [{ id: "main", default: true }],
        },
      } as never,
      agentId: "founder",
    });

    expect(message).toContain('Governance for "founder":');
    expect(message).toContain("charter evolution / Founder");
    expect(message).toContain("deny web_fetch, web_search");
    expect(message).toContain("explicit subagent ids");
    expect(message).toContain("execution=strict-agentic");
    expect(message).toContain("elevated locked");
    expect(message).toContain("freeze active (constitution_missing)");
    expect(message).toContain("deny apply_patch, write, edit, exec (+1 more)");
  });
});
