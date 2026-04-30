import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { buildGovernanceCapabilityAssetRegistry } from "./capability-asset-registry.js";
import {
  getGovernanceCapabilityInventory,
  planGovernanceGenesisWork,
} from "./capability-registry.js";

async function writeAgentBlueprint(charterDir: string, agentId: string, title?: string) {
  await writeFile(
    path.join(charterDir, "agents", `${agentId}.yaml`),
    [
      "version: 1",
      "agent:",
      `  id: "${agentId}"`,
      `  title: "${title ?? agentId}"`,
      '  layer: "evolution"',
      '  status: "active"',
      "mission:",
      `  primary: "Operate as ${title ?? agentId}."`,
      "authority:",
      '  level: "high"',
      "  mutation_scope:",
      "    allow:",
      '      - "skills"',
      "    deny:",
      '      - "constitution"',
      "  network_scope:",
      '    default: "narrow"',
      "    conditions: []",
      "  resource_budget:",
      '    tokens: "medium"',
      '    parallelism: "medium"',
      '    runtime: "continuous"',
      "required_counterparties:",
      "  works_with: []",
      "  reports_to: []",
      "runtime_mapping:",
      "  intended_project_hooks:",
      '    - "skills"',
      "",
    ].join("\n"),
    "utf8",
  );
}

async function createTempCapabilityRoot(options?: { includePublisher?: boolean }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-capability-registry-"));
  const charterDir = path.join(root, "governance", "charter");
  const workspaceDir = path.join(root, "workspace");
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  await mkdir(path.join(charterDir, "evolution"), { recursive: true });
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });

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

  const agents = [
    "founder",
    "strategist",
    "librarian",
    "sentinel",
    "archaeologist",
    "tdd_developer",
    "qa",
    ...(options?.includePublisher === false ? [] : ["publisher"]),
    "executor",
  ];
  for (const agentId of agents) {
    await writeAgentBlueprint(charterDir, agentId);
  }

  await writeFile(
    path.join(charterDir, "evolution", "genesis-team.yaml"),
    [
      "version: 1",
      "team:",
      '  id: "genesis_team"',
      '  title: "Genesis Team"',
      '  layer: "evolution"',
      '  status: "active"',
      "members:",
      '  - "sentinel"',
      '  - "archaeologist"',
      '  - "tdd_developer"',
      '  - "qa"',
      '  - "publisher"',
      '  - "librarian"',
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    root,
    charterDir,
    workspaceDir,
  };
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

describe("capability registry", () => {
  it("builds a deterministic capability inventory", async () => {
    const { root, charterDir, workspaceDir } = await createTempCapabilityRoot();
    try {
      const inventory = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 123,
        agentIds: ["LIBRARIAN", "founder"],
      });
      const fullInventory = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 123,
      });

      expect(inventory.observedAt).toBe(123);
      expect(inventory.charterDir).toBe(charterDir);
      expect(inventory.workspaceDirs).toEqual([workspaceDir]);
      expect(inventory.requestedAgentIds).toEqual(["founder", "librarian"]);
      expect(inventory.summary.agentBlueprintCount).toBe(2);
      expect(inventory.summary.teamBlueprintCount).toBe(1);
      expect(inventory.summary.memoryCount).toBeGreaterThanOrEqual(1);
      expect(inventory.summary.autonomyProfileCount).toBe(9);
      expect(inventory.summary.genesisMemberCount).toBe(6);
      expect(fullInventory.summary.strategyCount).toBeGreaterThanOrEqual(1);
      expect(fullInventory.summary.algorithmCount).toBeGreaterThanOrEqual(1);
      expect(inventory.entries.some((entry) => entry.id === "agent_blueprint:founder")).toBe(true);
      expect(inventory.entries.some((entry) => entry.id === "agent_blueprint:librarian")).toBe(
        true,
      );
      expect(inventory.entries.some((entry) => entry.id === "agent_blueprint:strategist")).toBe(
        false,
      );
      expect(inventory.entries.some((entry) => entry.id === "team_blueprint:genesis_team")).toBe(
        true,
      );
      expect(inventory.entries.some((entry) => entry.kind === "memory")).toBe(true);
      expect(fullInventory.entries.some((entry) => entry.kind === "strategy")).toBe(true);
      expect(fullInventory.entries.some((entry) => entry.kind === "algorithm")).toBe(true);
      expect(inventory.summary.skillCount).toBeGreaterThanOrEqual(1);
      expect(
        inventory.gaps.some((entry) =>
          entry.id.startsWith("capability_inventory.governance_freeze"),
        ),
      ).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("includes repository-root governed skills when workspace scope is implicit", async () => {
    const { root, charterDir } = await createTempCapabilityRoot();
    try {
      await writeWorkspaceSkill({
        workspaceDir: root,
        id: "repo-governed-skill",
        description: "Repository-level governed capability skill",
      });

      const inventory = getGovernanceCapabilityInventory({
        charterDir,
        observedAt: 321,
      });

      expect(inventory.workspaceDirs).toContain(root);
      expect(inventory.summary.skillCount).toBeGreaterThanOrEqual(1);
      expect(inventory.entries).toContainEqual(
        expect.objectContaining({
          kind: "skill",
          title: "repo-governed-skill",
          sourcePath: path.join(root, "skills", "repo-governed-skill", "SKILL.md"),
          workspaceDir: root,
        }),
      );
      expect(inventory.gaps.map((entry) => entry.id)).not.toContain(
        "capability_inventory.skills_missing",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("plans genesis work and blocks promotion when required roles are missing", async () => {
    const { root, charterDir, workspaceDir } = await createTempCapabilityRoot({
      includePublisher: false,
    });
    try {
      const plan = planGovernanceGenesisWork({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 456,
      });

      expect(plan.observedAt).toBe(456);
      expect(plan.workspaceDirs).toEqual([workspaceDir]);
      expect(plan.primaryWorkspaceDir).toBe(workspaceDir);
      expect(plan.teamId).toBe("genesis_team");
      expect(plan.mode).toBe("repair");
      expect(plan.focusGapIds).toContain("capability_inventory.genesis_roles_missing");
      expect(plan.blockers.some((entry) => entry.includes("publisher"))).toBe(true);
      expect(plan.stages).toHaveLength(6);
      expect(plan.stages.find((entry) => entry.id === "genesis.gap_detection")?.status).toBe(
        "ready",
      );
      expect(
        plan.stages.find((entry) => entry.id === "genesis.promotion_or_rollback")?.status,
      ).toBe("blocked");
      expect(plan.stages.find((entry) => entry.id === "genesis.registration")?.status).toBe(
        "waiting",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("surfaces governed capability asset registry gaps and clears them once synced", async () => {
    const { root, charterDir, workspaceDir } = await createTempCapabilityRoot();
    try {
      await writeWorkspaceSkill({
        workspaceDir,
        id: "demo-skill",
        description: "Demo governed capability skill",
      });

      const inventoryBefore = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 789,
      });
      expect(inventoryBefore.gaps.map((entry) => entry.id)).toContain(
        "capability_inventory.asset_registry_missing",
      );

      await mkdir(path.join(charterDir, "capability"), { recursive: true });
      await writeFile(
        path.join(charterDir, "capability", "asset-registry.yaml"),
        stringifyYaml(
          buildGovernanceCapabilityAssetRegistry({
            observedAt: 790,
            entries: inventoryBefore.entries,
          }),
        ),
        "utf8",
      );

      const inventoryAfter = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 790,
      });
      expect(inventoryAfter.gaps.map((entry) => entry.id)).not.toContain(
        "capability_inventory.asset_registry_missing",
      );
      expect(inventoryAfter.gaps.map((entry) => entry.id)).not.toContain(
        "capability_inventory.asset_registry_sync_required",
      );
      expect(inventoryAfter.entries.some((entry) => entry.kind === "memory")).toBe(true);
      expect(inventoryAfter.entries.some((entry) => entry.kind === "strategy")).toBe(true);
      expect(inventoryAfter.entries.some((entry) => entry.kind === "algorithm")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("includes supplemental memory, strategy, and algorithm assets from the synced registry", async () => {
    const { root, charterDir, workspaceDir } = await createTempCapabilityRoot();
    try {
      await writeWorkspaceSkill({
        workspaceDir,
        id: "demo-skill",
        description: "Demo governed capability skill",
      });

      const inventoryBefore = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 890,
      });
      const registry = buildGovernanceCapabilityAssetRegistry({
        observedAt: 891,
        entries: inventoryBefore.entries,
      });
      registry.assets.push(
        {
          id: "algorithm:registered_dispatch_variant",
          kind: "algorithm",
          status: "ready",
          title: "Registered Dispatch Variant",
          layer: "execution",
          ownerAgentId: "executor",
          sourcePath: "src/plugins/runtime/runtime-autonomy.ts",
          coverage: ["algorithm:dispatch_variant"],
          dependencies: ["agent:executor"],
          issues: [],
          installOptions: [],
        },
        {
          id: "memory:audit_stream",
          kind: "memory",
          status: "ready",
          title: "Audit Stream Memory",
          layer: "api_communication",
          ownerAgentId: "librarian",
          sourcePath: "src/infra/audit-stream.ts",
          coverage: ["communication:audit_stream", "memory:audit_facts"],
          dependencies: ["src/infra/local-event-bus.ts"],
          issues: [],
          installOptions: [],
        },
        {
          id: "strategy:api_communication_fabric",
          kind: "strategy",
          status: "ready",
          title: "API and Communication Fabric Strategy",
          layer: "api_communication",
          ownerAgentId: "strategist",
          sourcePath: "src/cli/program/register.status-health-sessions.ts",
          coverage: ["communication:event_bus", "strategy:api_communication"],
          dependencies: ["src/plugins/runtime/runtime-autonomy.ts"],
          issues: [],
          installOptions: [],
        },
      );

      await mkdir(path.join(charterDir, "capability"), { recursive: true });
      await writeFile(
        path.join(charterDir, "capability", "asset-registry.yaml"),
        stringifyYaml(registry),
        "utf8",
      );

      const inventoryAfter = getGovernanceCapabilityInventory({
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 891,
      });

      expect(inventoryAfter.entries).toContainEqual(
        expect.objectContaining({
          id: "memory:audit_stream",
          kind: "memory",
          status: "ready",
          layer: "api_communication",
        }),
      );
      expect(inventoryAfter.entries).toContainEqual(
        expect.objectContaining({
          id: "strategy:api_communication_fabric",
          kind: "strategy",
          status: "ready",
          layer: "api_communication",
        }),
      );
      expect(inventoryAfter.entries).toContainEqual(
        expect.objectContaining({
          id: "algorithm:registered_dispatch_variant",
          kind: "algorithm",
          status: "ready",
        }),
      );
      expect(inventoryAfter.gaps.map((entry) => entry.id)).not.toContain(
        "capability_inventory.asset_registry_sync_required",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
