import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { collectGovernanceCharterFindings } from "./audit.js";

async function createTempCharterRoot(): Promise<{ root: string; charterDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-audit-governance-"));
  const charterDir = path.join(root, "governance", "charter");
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  return { root, charterDir };
}

async function seedMinimalCharter(charterDir: string): Promise<void> {
  await writeFile(
    path.join(charterDir, "constitution.yaml"),
    [
      "version: 1",
      "charter_artifacts:",
      "  policies:",
      '    - "governance/charter/policies/sovereignty.yaml"',
      '    - "governance/charter/policies/evolution-policy.yaml"',
      "  core_agents:",
      '    - "governance/charter/agents/sovereignty-auditor.yaml"',
      "sovereign_boundaries:",
      "  human_reserved_powers:",
      '    - "external_high_risk_network_opening"',
      '    - "root_privilege_expansion"',
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
      '    - "root_privilege_expansion"',
      "automatic_enforcement:",
      "  freeze_targets:",
      '    - "evolution_layer_promotions"',
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(charterDir, "policies", "evolution-policy.yaml"),
    "version: 1\n",
    "utf8",
  );
}

describe("security audit governance findings", () => {
  it("flags sovereign-grade network openings declared by config", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await seedMinimalCharter(charterDir);
      const cfg: OpenClawConfig = {
        gateway: {
          bind: "lan",
          controlUi: {
            dangerouslyAllowHostHeaderOriginFallback: true,
          },
        },
      };

      const findings = collectGovernanceCharterFindings({ cfg, charterDir });

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checkId: "governance.sovereignty.network_boundary_opened",
            severity: "critical",
          }),
          expect.objectContaining({
            checkId: "governance.charter.artifact_missing",
            severity: "critical",
          }),
        ]),
      );
      expect(
        findings.find((entry) => entry.checkId === "governance.sovereignty.network_boundary_opened")
          ?.detail ?? "",
      ).toContain("gateway.bind=lan");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("flags sovereign-grade execution expansion declared by config", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await seedMinimalCharter(charterDir);
      const cfg: OpenClawConfig = {
        tools: {
          exec: {
            security: "full",
            applyPatch: {
              workspaceOnly: false,
            },
          },
        },
      };

      const findings = collectGovernanceCharterFindings({ cfg, charterDir });

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checkId: "governance.sovereignty.exec_boundary_opened",
            severity: "critical",
          }),
        ]),
      );
      expect(
        findings.find((entry) => entry.checkId === "governance.sovereignty.exec_boundary_opened")
          ?.detail ?? "",
      ).toContain("tools.exec.security=full");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
