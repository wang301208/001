import { describe, expect, it, vi } from "vitest";
import type { ProgressReporter } from "../../cli/progress.js";
import { createEmptyAgentToolGovernanceSummary } from "../../governance/tool-governance-summary.js";
import { buildStatusAllReportLines } from "./report-lines.js";

const diagnosisSpy = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./diagnosis.js", () => ({
  appendStatusAllDiagnosis: diagnosisSpy,
}));

describe("buildStatusAllReportLines", () => {
  it("renders bootstrap column using file-presence semantics", async () => {
    const progress: ProgressReporter = {
      setLabel: () => {},
      setPercent: () => {},
      tick: () => {},
      done: () => {},
    };
    const lines = await buildStatusAllReportLines({
      progress,
      overviewRows: [{ Item: "Gateway", Value: "ok" }],
      governanceLines: ["Governance summary"],
      autonomyLines: ["Autonomy summary"],
      channels: {
        rows: [],
        details: [],
      },
      channelIssues: [],
      agentStatus: {
        agents: [
          {
            id: "main",
            bootstrapPending: true,
            sessionsCount: 1,
            lastActiveAgeMs: 12_000,
            governance: {
              ...createEmptyAgentToolGovernanceSummary(),
              charterDeclared: true,
              charterTitle: "Founder",
              charterLayer: "evolution",
              charterToolDeny: ["web_fetch"],
              charterRequireAgentId: true,
              charterExecutionContract: "strict-agentic",
              charterElevatedLocked: true,
              freezeActive: false,
              freezeDeny: [],
              freezeDetails: [],
            },
            sessionsPath: "/tmp/main-sessions.json",
          },
          {
            id: "ops",
            bootstrapPending: false,
            sessionsCount: 0,
            lastActiveAgeMs: null,
            governance: {
              ...createEmptyAgentToolGovernanceSummary(),
              freezeActive: true,
              freezeReasonCode: "network_boundary_opened",
              freezeDeny: ["exec"],
              freezeDetails: [],
            },
            sessionsPath: "/tmp/ops-sessions.json",
          },
        ],
      },
      connectionDetailsForReport: "",
      diagnosis: {
        snap: null,
        remoteUrlMissing: false,
        secretDiagnostics: [],
        sentinel: null,
        lastErr: null,
        port: 18789,
        portUsage: null,
        tailscaleMode: "off",
        tailscale: {
          backendState: null,
          dnsName: null,
          ips: [],
          error: null,
        },
        tailscaleHttpsUrl: null,
        skillStatus: null,
        pluginCompatibility: [],
        channelsStatus: null,
        channelIssues: [],
        gatewayReachable: false,
        health: null,
        nodeOnlyGateway: null,
      },
    });

    const output = lines.join("\n");
    const normalizedOutput = output.replace(/\s+/g, " ");
    expect(output).toContain("Bootstrap file");
    expect(output).toContain("Governance");
    expect(output).toContain("Governance summary");
    expect(output).toContain("Autonomy summary");
    expect(output).toContain("PRESENT");
    expect(output).toContain("ABSENT");
    expect(normalizedOutput).toContain("execution=strict-");
    expect(normalizedOutput).toContain("agentic; elevated locked");
    expect(normalizedOutput).toContain("freeze (network_boundary_opened)");
    expect(diagnosisSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        secretDiagnostics: [],
      }),
    );
  });
});
