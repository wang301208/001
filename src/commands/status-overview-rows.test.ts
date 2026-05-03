import { describe, expect, it } from "vitest";
import {
  buildStatusAllOverviewRows,
  buildStatusCommandOverviewRows,
} from "./status-overview-rows.ts";
import {
  baseStatusOverviewSurface,
  createStatusCommandOverviewRowsParams,
} from "./status.test-support.ts";

describe("status-overview-rows", () => {
  it("builds command overview rows from the shared surface", () => {
    const rows = buildStatusCommandOverviewRows(createStatusCommandOverviewRowsParams());
    const byItem = new Map(rows.map((row) => [row.Item, row.Value]));

    expect(byItem.get("OS")).toContain("macOS");
    expect(byItem.get("OS")).toContain(`node ${process.versions.node}`);
    expect(byItem.get("Agents")).toContain("1 chartered");
    expect(byItem.get("Agents")).toContain("0 frozen");
    expect(byItem.get("Memory")).toContain("1 files");
    expect(byItem.get("Memory")).toContain("plugin memory");
    expect(byItem.get("Governance")).toContain("freeze open");
    expect(byItem.get("Governance")).toContain("2 gaps");
    expect(byItem.get("Autonomy")).toContain("3 profiles");
    expect(byItem.get("Autonomy")).toContain("1 drift");
    expect(byItem.get("Autonomy")).toContain("1 replay ready");
    expect(byItem.get("Plugin compatibility")).toContain("1 notice");
    expect(byItem.get("Sessions")).toContain("2 active");
    expect(byItem.get("Sessions")).toContain("default gpt-5.4");
    expect(byItem.get("Sessions")).toContain("store.json");
  });

  it("builds status-all overview rows from the shared surface", () => {
    expect(
      buildStatusAllOverviewRows({
        surface: {
          ...baseStatusOverviewSurface,
          tailscaleMode: "off",
          tailscaleHttpsUrl: null,
          gatewayConnection: { url: "wss://gateway.example.com", urlSource: "config" },
        },
        osLabel: "macOS",
        configPath: "/tmp/zhushou.json",
        secretDiagnosticsCount: 2,
        summary: createStatusCommandOverviewRowsParams().summary,
        agentStatus: {
          bootstrapPendingCount: 1,
          totalSessions: 2,
          agents: [{ id: "main", lastActiveAgeMs: 60_000 }],
        },
        tailscaleBackendState: "Running",
      }),
    ).toEqual(
      expect.arrayContaining([
        { Item: "Version", Value: expect.any(String) },
        { Item: "OS", Value: "macOS" },
        { Item: "Config", Value: "/tmp/zhushou.json" },
        { Item: "Security", Value: "Run: zhushou security audit --deep" },
        { Item: "Governance", Value: expect.stringContaining("freeze open") },
        { Item: "Autonomy", Value: expect.stringContaining("3 profiles") },
        { Item: "Secrets", Value: "2 diagnostics" },
      ]),
    );
  });
});
