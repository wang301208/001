import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGovernanceCharter } from "./charter-runtime.js";

async function createTempCharterRoot(): Promise<{ root: string; charterDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-charter-"));
  const charterDir = path.join(root, "governance", "charter");
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  return { root, charterDir };
}

describe("governance charter runtime", () => {
  it("loads charter metadata and detects missing listed artifacts", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          "  policies:",
          '    - "governance/charter/policies/sovereignty.yaml"',
          '    - "governance/charter/policies/nonexistent.yaml"',
          "  core_agents:",
          '    - "governance/charter/agents/sovereignty-auditor.yaml"',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "reserved_authorities:",
          "  human_sovereign_only:",
          '    - "global_high_risk_network_opening"',
          "automatic_enforcement:",
          "  on_high_or_critical_breach:",
          '    - "freeze_mutating_subsystems"',
          "  freeze_targets:",
          '    - "evolution_layer_promotions"',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "agents", "sovereignty-auditor.yaml"), "version: 1\n", "utf8");

      const snapshot = loadGovernanceCharter({ charterDir });

      expect(snapshot.discovered).toBe(true);
      expect(snapshot.reservedAuthorities).toContain("global_high_risk_network_opening");
      expect(snapshot.automaticEnforcementActions).toContain("freeze_mutating_subsystems");
      expect(snapshot.freezeTargets).toContain("evolution_layer_promotions");
      expect(snapshot.missingArtifactPaths).toEqual([
        "governance/charter/policies/nonexistent.yaml",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
