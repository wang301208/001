import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  filterToolsByPolicy,
  isToolAllowedByPolicyName,
  resolveEffectiveToolPolicy,
  resolveSubagentToolPolicy,
  resolveSubagentToolPolicyForSession,
} from "./pi-tools.policy.js";
import { createStubTool } from "./test-helpers/pi-tool-stubs.js";

async function createTempCharterRoot(): Promise<{ root: string; charterDir: string }> {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "openclaw-tool-policy-"));
  const charterDir = path.join(root, "governance", "charter");
  await fsPromises.mkdir(path.join(charterDir, "policies"), { recursive: true });
  return { root, charterDir };
}

async function seedMinimalCharter(charterDir: string): Promise<void> {
  await fsPromises.writeFile(
    path.join(charterDir, "constitution.yaml"),
    [
      "version: 1",
      "charter_artifacts:",
      "  policies:",
      '    - "governance/charter/policies/sovereignty.yaml"',
      '    - "governance/charter/policies/evolution-policy.yaml"',
      "sovereign_boundaries:",
      "  human_reserved_powers:",
      '    - "external_high_risk_network_opening"',
      '    - "root_privilege_expansion"',
    ].join("\n"),
    "utf8",
  );
  await fsPromises.writeFile(
    path.join(charterDir, "policies", "sovereignty.yaml"),
    [
      "version: 1",
      "reserved_authorities:",
      "  human_sovereign_only:",
      '    - "global_high_risk_network_opening"',
      '    - "root_privilege_expansion"',
    ].join("\n"),
    "utf8",
  );
  await fsPromises.writeFile(
    path.join(charterDir, "policies", "evolution-policy.yaml"),
    "version: 1\n",
    "utf8",
  );
}

describe("pi-tools.policy", () => {
  it("treats * in allow as allow-all", () => {
    const tools = [createStubTool("read"), createStubTool("exec")];
    const filtered = filterToolsByPolicy(tools, { allow: ["*"] });
    expect(filtered.map((tool) => tool.name)).toEqual(["read", "exec"]);
  });

  it("treats * in deny as deny-all", () => {
    const tools = [createStubTool("read"), createStubTool("exec")];
    const filtered = filterToolsByPolicy(tools, { deny: ["*"] });
    expect(filtered).toEqual([]);
  });

  it("supports wildcard allow/deny patterns", () => {
    expect(isToolAllowedByPolicyName("web_fetch", { allow: ["web_*"] })).toBe(true);
    expect(isToolAllowedByPolicyName("web_search", { deny: ["web_*"] })).toBe(false);
  });

  it("keeps apply_patch when write is allowlisted", () => {
    expect(isToolAllowedByPolicyName("apply_patch", { allow: ["write"] })).toBe(true);
  });

  it("blocks apply_patch when write is denylisted", () => {
    expect(isToolAllowedByPolicyName("apply_patch", { deny: ["write"] })).toBe(false);
  });
});

describe("resolveSubagentToolPolicy depth awareness", () => {
  const baseCfg = {
    agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
  } as unknown as OpenClawConfig;

  const deepCfg = {
    agents: { defaults: { subagents: { maxSpawnDepth: 3 } } },
  } as unknown as OpenClawConfig;

  const leafCfg = {
    agents: { defaults: { subagents: { maxSpawnDepth: 1 } } },
  } as unknown as OpenClawConfig;

  it("applies subagent tools.alsoAllow to re-enable default-denied tools", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: { subagents: { tools: { alsoAllow: ["sessions_send"] } } },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(isToolAllowedByPolicyName("sessions_send", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("cron", policy)).toBe(false);
  });

  it("applies subagent tools.allow to re-enable default-denied tools", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: { subagents: { tools: { allow: ["sessions_send"] } } },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(isToolAllowedByPolicyName("sessions_send", policy)).toBe(true);
  });

  it("merges subagent tools.alsoAllow into tools.allow when both are set", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: {
        subagents: { tools: { allow: ["sessions_spawn"], alsoAllow: ["sessions_send"] } },
      },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(policy.allow).toEqual(["sessions_spawn", "sessions_send"]);
  });

  it("keeps configured deny precedence over allow and alsoAllow", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: {
        subagents: {
          tools: {
            allow: ["sessions_send"],
            alsoAllow: ["sessions_send"],
            deny: ["sessions_send"],
          },
        },
      },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(isToolAllowedByPolicyName("sessions_send", policy)).toBe(false);
  });

  it("applies configured deny to memory tools even though they are allowed by default", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: {
        subagents: {
          tools: {
            deny: ["memory_search", "memory_get"],
          },
        },
      },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(isToolAllowedByPolicyName("memory_search", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("memory_get", policy)).toBe(false);
  });

  it("does not create a restrictive allowlist when only alsoAllow is configured", () => {
    const cfg = {
      agents: { defaults: { subagents: { maxSpawnDepth: 2 } } },
      tools: { subagents: { tools: { alsoAllow: ["sessions_send"] } } },
    } as unknown as OpenClawConfig;
    const policy = resolveSubagentToolPolicy(cfg, 1);
    expect(policy.allow).toBeUndefined();
    expect(isToolAllowedByPolicyName("subagents", policy)).toBe(true);
  });

  it("depth-1 orchestrator (maxSpawnDepth=2) allows sessions_spawn", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(true);
  });

  it("depth-1 orchestrator (maxSpawnDepth=2) allows subagents", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(isToolAllowedByPolicyName("subagents", policy)).toBe(true);
  });

  it("depth-1 orchestrator (maxSpawnDepth=2) allows sessions_list", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(isToolAllowedByPolicyName("sessions_list", policy)).toBe(true);
  });

  it("depth-1 orchestrator (maxSpawnDepth=2) allows sessions_history", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(isToolAllowedByPolicyName("sessions_history", policy)).toBe(true);
  });

  it("depth-1 orchestrator still denies gateway and cron but allows memory tools", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 1);
    expect(isToolAllowedByPolicyName("gateway", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("cron", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("memory_search", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("memory_get", policy)).toBe(true);
  });

  it("depth-2 leaf denies sessions_spawn", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 2);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(false);
  });

  it("depth-2 orchestrator (maxSpawnDepth=3) allows sessions_spawn", () => {
    const policy = resolveSubagentToolPolicy(deepCfg, 2);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(true);
  });

  it("depth-3 leaf (maxSpawnDepth=3) denies sessions_spawn", () => {
    const policy = resolveSubagentToolPolicy(deepCfg, 3);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(false);
  });

  it("depth-2 leaf denies subagents", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 2);
    expect(isToolAllowedByPolicyName("subagents", policy)).toBe(false);
  });

  it("depth-2 leaf denies sessions_list and sessions_history", () => {
    const policy = resolveSubagentToolPolicy(baseCfg, 2);
    expect(isToolAllowedByPolicyName("sessions_list", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("sessions_history", policy)).toBe(false);
  });

  it("depth-1 leaf (maxSpawnDepth=1) denies sessions_spawn", () => {
    const policy = resolveSubagentToolPolicy(leafCfg, 1);
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(false);
  });

  it("depth-1 leaf (maxSpawnDepth=1) denies sessions_list", () => {
    const policy = resolveSubagentToolPolicy(leafCfg, 1);
    expect(isToolAllowedByPolicyName("sessions_list", policy)).toBe(false);
  });

  it("uses stored leaf role for flat depth-1 session keys", () => {
    const storePath = path.join(
      os.tmpdir(),
      `openclaw-subagent-policy-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(
      storePath,
      JSON.stringify(
        {
          "agent:main:subagent:flat-leaf": {
            sessionId: "flat-leaf",
            updatedAt: Date.now(),
            spawnDepth: 1,
            subagentRole: "leaf",
            subagentControlScope: "none",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    const cfg = {
      ...baseCfg,
      session: {
        store: storePath,
      },
    } as unknown as OpenClawConfig;

    const policy = resolveSubagentToolPolicyForSession(cfg, "agent:main:subagent:flat-leaf");
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("subagents", policy)).toBe(false);
    expect(isToolAllowedByPolicyName("memory_search", policy)).toBe(true);
    expect(isToolAllowedByPolicyName("memory_get", policy)).toBe(true);
  });

  it("defaults to leaf behavior when no depth is provided", () => {
    const policy = resolveSubagentToolPolicy(baseCfg);
    // Default depth=1, maxSpawnDepth=2 → orchestrator
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(true);
  });

  it("defaults to leaf behavior when depth is undefined and maxSpawnDepth is 1", () => {
    const policy = resolveSubagentToolPolicy(leafCfg);
    // Default depth=1, maxSpawnDepth=1 → leaf
    expect(isToolAllowedByPolicyName("sessions_spawn", policy)).toBe(false);
  });
});

describe("resolveEffectiveToolPolicy", () => {
  it("implicitly re-exposes exec and process when tools.exec is configured", () => {
    const cfg = {
      tools: {
        profile: "messaging",
        exec: { host: "sandbox" },
      },
    } as OpenClawConfig;
    const result = resolveEffectiveToolPolicy({ config: cfg });
    expect(result.profileAlsoAllow).toEqual(["exec", "process"]);
  });

  it("implicitly re-exposes read, write, and edit when tools.fs is configured", () => {
    const cfg = {
      tools: {
        profile: "messaging",
        fs: { workspaceOnly: false },
      },
    } as OpenClawConfig;
    const result = resolveEffectiveToolPolicy({ config: cfg });
    expect(result.profileAlsoAllow).toEqual(["read", "write", "edit"]);
  });

  it("merges explicit alsoAllow with implicit tool-section exposure", () => {
    const cfg = {
      tools: {
        profile: "messaging",
        alsoAllow: ["web_search"],
        exec: { host: "sandbox" },
      },
    } as OpenClawConfig;
    const result = resolveEffectiveToolPolicy({ config: cfg });
    expect(result.profileAlsoAllow).toEqual(["web_search", "exec", "process"]);
  });

  it("uses agent tool sections when resolving implicit exposure", () => {
    const cfg = {
      tools: {
        profile: "messaging",
      },
      agents: {
        list: [
          {
            id: "coder",
            tools: {
              fs: { workspaceOnly: true },
            },
          },
        ],
      },
    } as OpenClawConfig;
    const result = resolveEffectiveToolPolicy({ config: cfg, agentId: "coder" });
    expect(result.profileAlsoAllow).toEqual(["read", "write", "edit"]);
  });

  it("adds a governance freeze deny policy for sovereign-grade violations", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await seedMinimalCharter(charterDir);
      const cfg = {
        gateway: {
          bind: "lan",
        },
      } as OpenClawConfig;
      const result = resolveEffectiveToolPolicy({ config: cfg, charterDir });
      expect(result.governancePolicy?.deny).toEqual(
        expect.arrayContaining(["exec", "write", "apply_patch", "gateway"]),
      );
      expect(isToolAllowedByPolicyName("exec", result.governancePolicy)).toBe(false);
      expect(isToolAllowedByPolicyName("read", result.governancePolicy)).toBe(true);
    } finally {
      await fsPromises.rm(root, { recursive: true, force: true });
    }
  });
});
