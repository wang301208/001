import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  isAcpAgentAllowedByPolicy,
  isAcpDispatchEnabledByPolicy,
  isAcpEnabledByPolicy,
  resolveAcpAgentPolicyError,
  resolveAcpDispatchPolicyError,
  resolveAcpDispatchPolicyMessage,
  resolveAcpDispatchPolicyState,
} from "./policy.js";

async function createTempCharterRoot(): Promise<{ root: string; charterDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-acp-policy-"));
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

describe("acp policy", () => {
  it("treats ACP + ACP dispatch as enabled by default", () => {
    const cfg = {} satisfies OpenClawConfig;
    expect(isAcpEnabledByPolicy(cfg)).toBe(true);
    expect(isAcpDispatchEnabledByPolicy(cfg)).toBe(true);
    expect(resolveAcpDispatchPolicyState(cfg)).toBe("enabled");
  });

  it("reports ACP disabled state when acp.enabled is false", () => {
    const cfg = {
      acp: {
        enabled: false,
      },
    } satisfies OpenClawConfig;
    expect(isAcpEnabledByPolicy(cfg)).toBe(false);
    expect(resolveAcpDispatchPolicyState(cfg)).toBe("acp_disabled");
    expect(resolveAcpDispatchPolicyMessage(cfg)).toContain("acp.enabled=false");
    expect(resolveAcpDispatchPolicyError(cfg)?.code).toBe("ACP_DISPATCH_DISABLED");
  });

  it("reports dispatch-disabled state when dispatch gate is false", () => {
    const cfg = {
      acp: {
        enabled: true,
        dispatch: {
          enabled: false,
        },
      },
    } satisfies OpenClawConfig;
    expect(isAcpDispatchEnabledByPolicy(cfg)).toBe(false);
    expect(resolveAcpDispatchPolicyState(cfg)).toBe("dispatch_disabled");
    expect(resolveAcpDispatchPolicyMessage(cfg)).toContain("acp.dispatch.enabled=false");
  });

  it("freezes dispatch when governance policy detects a sovereign-grade boundary opening", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await seedMinimalCharter(charterDir);
      const cfg = {
        gateway: {
          bind: "lan",
        },
      } satisfies OpenClawConfig;
      expect(isAcpDispatchEnabledByPolicy(cfg, { charterDir })).toBe(false);
      expect(resolveAcpDispatchPolicyState(cfg, { charterDir })).toBe("governance_frozen");
      expect(resolveAcpDispatchPolicyMessage(cfg, { charterDir })).toContain(
        "frozen by governance policy",
      );
      expect(resolveAcpDispatchPolicyError(cfg, { charterDir })?.code).toBe(
        "ACP_DISPATCH_DISABLED",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies allowlist filtering for ACP agents", () => {
    const cfg = {
      acp: {
        allowedAgents: ["Codex", "claude-code", "kimi"],
      },
    } satisfies OpenClawConfig;
    expect(isAcpAgentAllowedByPolicy(cfg, "codex")).toBe(true);
    expect(isAcpAgentAllowedByPolicy(cfg, "claude-code")).toBe(true);
    expect(isAcpAgentAllowedByPolicy(cfg, "KIMI")).toBe(true);
    expect(isAcpAgentAllowedByPolicy(cfg, "gemini")).toBe(false);
    expect(resolveAcpAgentPolicyError(cfg, "gemini")?.code).toBe("ACP_SESSION_INIT_FAILED");
    expect(resolveAcpAgentPolicyError(cfg, "codex")).toBeNull();
  });
});
