import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { listGovernanceProposals } from "./proposals.js";
import { synthesizeGovernanceAutonomyProposals } from "./autonomy-proposals.js";

async function createTempCharterRoot(): Promise<{
  root: string;
  charterDir: string;
  stateDir: string;
  workspaceDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-governance-autonomy-proposals-"));
  const charterDir = path.join(root, "governance", "charter");
  const stateDir = path.join(root, "state");
  const workspaceDir = path.join(root, "workspace");
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  await mkdir(path.join(charterDir, "evolution"), { recursive: true });
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  return { root, charterDir, stateDir, workspaceDir };
}

function createCfg(): ZhushouConfig {
  return {
    gateway: {
      bind: "127.0.0.1",
    },
    tools: {
      exec: {
        security: "deny",
        applyPatch: {
          workspaceOnly: true,
        },
      },
      elevated: {
        enabled: false,
      },
    },
  } as unknown as ZhushouConfig;
}

async function writeWorkspaceSkill(params: {
  workspaceDir: string;
  id: string;
  description: string;
}) {
  const skillDir = path.join(params.workspaceDir, "skills", params.id);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${params.id}`,
      `description: ${params.description}`,
      "---",
      "",
      `# ${params.id}`,
    ].join("\n"),
    "utf8",
  );
}

describe("governance autonomy proposals", () => {
  it("accepts executor and qa as eligible governance synthesis agents", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      const result = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["executor", "qa"],
        createdBySessionKey: "agent:executor:main",
        now: 50,
      });

      expect(result.requestedAgentIds).toEqual(["executor", "qa"]);
      expect(result.eligibleAgentIds).toEqual(["executor", "qa"]);
      expect(result.createdCount).toBeGreaterThan(0);
      expect(result.results.some((entry) => entry.status === "created")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates pending restoration proposals for missing charter documents and dedupes reruns", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      const first = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["founder"],
        createdBySessionKey: "agent:founder:main",
        now: 100,
      });

      expect(first).toMatchObject({
        requestedAgentIds: ["founder"],
        eligibleAgentIds: ["founder"],
        createdCount: 3,
        existingCount: 0,
      });
      expect(first.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "restore_constitution_missing",
            status: "created",
            proposalStatus: "pending",
          }),
          expect.objectContaining({
            ruleId: "restore_sovereignty_policy_missing",
            status: "created",
            proposalStatus: "pending",
          }),
          expect.objectContaining({
            ruleId: "restore_evolution_policy_missing",
            status: "created",
            proposalStatus: "pending",
          }),
        ]),
      );

      const stored = await listGovernanceProposals({ stateDir });
      expect(stored.summary).toMatchObject({
        total: 3,
        pending: 3,
      });

      const second = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["founder"],
        createdBySessionKey: "agent:founder:main",
        now: 200,
      });

      expect(second.createdCount).toBe(0);
      expect(second.existingCount).toBe(3);
      expect(second.results.every((entry) => entry.status === "existing")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restores missing internal artifacts and prunes stale external references", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/ghost.yaml"]',
          '  design_docs: ["docs/missing-design.md"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");

      const result = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["founder", "strategist"],
        createdBySessionKey: "agent:main:main",
        now: 300,
      });

      expect(result.createdCount).toBe(2);
      expect(result.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "restore_missing_charter_artifacts",
            status: "created",
            operations: [
              expect.objectContaining({
                kind: "write",
                path: "agents/ghost.yaml",
              }),
            ],
          }),
          expect.objectContaining({
            ruleId: "prune_stale_artifact_references",
            status: "created",
            operations: [
              expect.objectContaining({
                kind: "write",
                path: "constitution.yaml",
                content: expect.not.stringContaining("docs/missing-design.md"),
              }),
            ],
          }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("queues a sovereignty auditor attachment proposal when freeze targets exist without the auditor", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/founder.yaml"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        ['version: 1', "agent:", '  id: "founder"', '  title: "Founder"'].join("\n"),
        "utf8",
      );

      const result = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["strategist"],
        createdBySessionKey: "agent:strategist:main",
        now: 400,
      });

      expect(result.createdCount).toBe(1);
      expect(result.results).toEqual([
        expect.objectContaining({
          ruleId: "attach_sovereignty_auditor",
          status: "created",
          operations: expect.arrayContaining([
            expect.objectContaining({
              kind: "write",
              path: "constitution.yaml",
              content: expect.stringContaining("governance/charter/agents/sovereignty-auditor.yaml"),
            }),
            expect.objectContaining({
              kind: "write",
              path: "agents/sovereignty-auditor.yaml",
            }),
          ]),
        }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates and dedupes governed capability asset registry sync proposals", async () => {
    const { root, charterDir, stateDir, workspaceDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        ["version: 1", "charter_artifacts: {}", "sovereign_boundaries: {}", ""].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        ["version: 1", "reserved_authorities: {}", "automatic_enforcement: {}", ""].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "evolution-policy.yaml"),
        ["version: 1", "policy: {}", ""].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "librarian.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "librarian"',
          '  title: "Librarian"',
          '  layer: "capability"',
          '  status: "active"',
        ].join("\n"),
        "utf8",
      );
      await writeWorkspaceSkill({
        workspaceDir,
        id: "demo-skill",
        description: "Demo governed capability skill",
      });

      const first = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        workspaceDirs: [workspaceDir],
        agentIds: ["librarian"],
        createdBySessionKey: "agent:librarian:main",
        now: 500,
      });

      expect(first.requestedAgentIds).toEqual(["librarian"]);
      expect(first.eligibleAgentIds).toEqual(["librarian"]);
      expect(first.findingIds).toContain("capability_inventory.asset_registry_missing");
      expect(first.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "created",
            operations: [
              expect.objectContaining({
                kind: "write",
                path: "capability/asset-registry.yaml",
                content: expect.stringContaining("demo-skill"),
              }),
            ],
          }),
        ]),
      );

      const second = await synthesizeGovernanceAutonomyProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        workspaceDirs: [workspaceDir],
        agentIds: ["librarian"],
        createdBySessionKey: "agent:librarian:main",
        now: 600,
      });

      expect(second.createdCount).toBe(0);
      expect(second.existingCount).toBe(1);
      expect(second.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "existing",
            proposalStatus: "pending",
          }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
