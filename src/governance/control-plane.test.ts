import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import {
  getGovernanceAgent,
  getGovernanceCapabilityAssetRegistry,
  getGovernanceCapabilityInventory,
  getGovernanceGenesisPlan,
  getGovernanceOverview,
  getGovernanceTeam,
  reconcileGovernanceProposals,
  synthesizeGovernanceProposals,
} from "./control-plane.js";

async function createTempCharterRoot(): Promise<{
  root: string;
  charterDir: string;
  stateDir: string;
  workspaceDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-governance-control-plane-"));
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
      bind: "loopback",
    },
    tools: {
      exec: {
        security: "allowlist",
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

describe("governance control plane", () => {
  it("builds an overview from charter artifacts and governance findings", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/founder.yaml"]',
          "sovereign_boundaries:",
          '  human_reserved_powers: ["global_high_risk_network_opening"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "reserved_authorities:",
          '  human_sovereign_only: ["global_high_risk_network_opening"]',
          "automatic_enforcement:",
          '  on_high_or_critical_breach: ["freeze_mutating_subsystems"]',
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Evolve the organization."',
          "required_counterparties:",
          '  works_with: ["strategist"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "strategist.yaml"),
        ['version: 1', "agent:", '  id: "strategist"', '  title: "Strategist"'].join("\n"),
        "utf8",
      );
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
          '  - "founder"',
          '  - "strategist"',
        ].join("\n"),
        "utf8",
      );

      const overview = getGovernanceOverview({
        cfg: createCfg(),
        charterDir,
        observedAt: 123,
        stateDir,
      });

      expect(overview.observedAt).toBe(123);
      expect(overview.discovered).toBe(true);
      expect(overview.proposals).toMatchObject({
        storageDir: path.join(stateDir, "governance", "proposals"),
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        applied: 0,
      });
      expect(overview.audit.summary).toMatchObject({
        filePath: path.join(stateDir, "audit", "facts.jsonl"),
        total: 0,
        domains: [],
      });
      expect(overview.audit.recentGovernanceFacts).toEqual([]);
      expect(overview.organization.agentCount).toBe(2);
      expect(overview.organization.teamCount).toBe(1);
      expect(overview.organization.agents.find((entry) => entry.id === "founder")?.declaredCollaborators).toEqual([
        "strategist",
      ]);
      expect(overview.sovereignty.open).toBeGreaterThanOrEqual(1);
      expect(overview.sovereignty.freezeActive).toBe(true);
      expect(overview.sovereignty.freezeIncidentIds.length).toBeGreaterThanOrEqual(1);
      expect(overview.enforcement.active).toBe(true);
      expect(overview.enforcement.reasonCode).toBe("freeze_without_auditor");
      expect(overview.enforcement.activeSovereigntyFreezeIncidentIds).toEqual(
        overview.sovereignty.freezeIncidentIds,
      );
      expect(overview.findings.some((entry) => entry.checkId === "governance.charter.freeze_without_auditor")).toBe(
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds a per-agent governance snapshot with charter prompt and runtime contract", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "executor.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "executor"',
          '  title: "Executor"',
          '  layer: "execution"',
          "mission:",
          '  primary: "Turn goals into outcomes."',
          "jurisdiction:",
          '  can_decide: ["decompose_goal"]',
          '  cannot_decide: ["rewrite_constitution"]',
          "authority:",
          '  level: "high"',
          "  mutation_scope:",
          '    allow: ["task_records"]',
          '    deny: ["constitution"]',
          "  network_scope:",
          '    default: "internal_only"',
          "  resource_budget:",
          '    tokens: "high"',
          '    runtime: "continuous"',
          "required_counterparties:",
          '  works_with: ["qa"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "qa.yaml"),
        ['version: 1', "agent:", '  id: "qa"', '  title: "QA"'].join("\n"),
        "utf8",
      );

      const result = getGovernanceAgent({
        cfg: createCfg(),
        charterDir,
        agentId: "executor",
        observedAt: 456,
      });

      expect(result.observedAt).toBe(456);
      expect(result.agentId).toBe("executor");
      expect(result.blueprint?.title).toBe("Executor");
      expect(result.runtimeProfile?.executionContract).toBe("strict-agentic");
      expect(result.runtimeProfile?.toolDeny).toEqual(["web_fetch", "web_search"]);
      expect(result.collaborationPolicy.allowedAgentIds).toEqual(["executor", "qa"]);
      expect(result.contract.charterDeclared).toBe(true);
      expect(result.runtimeSnapshot?.agentId).toBe("executor");
      expect(result.prompt).toContain("## Organizational Charter");
      expect(result.prompt).toContain("Declared collaborators: qa");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves persisted sovereignty incidents after the charter breach is fixed", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/sovereignty-auditor.yaml"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  on_high_or_critical_breach: ["freeze_mutating_subsystems"]',
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");

      const frozenOverview = getGovernanceOverview({
        cfg: createCfg(),
        charterDir,
        stateDir,
        observedAt: 100,
      });
      expect(frozenOverview.enforcement.active).toBe(true);
      expect(frozenOverview.sovereignty.open).toBeGreaterThanOrEqual(1);
      expect(frozenOverview.sovereignty.freezeActive).toBe(true);

      await writeFile(
        path.join(charterDir, "agents", "sovereignty-auditor.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "sovereignty_auditor"',
          '  title: "Sovereignty Auditor"',
          '  layer: "governance"',
          "mission:",
          '  primary: "Contain sovereign drift."',
          "authority:",
          '  level: "high"',
          "  mutation_scope:",
          '    allow: ["incident_ledgers"]',
          '    deny: ["constitution"]',
          "contract:",
          '  role: "sovereignty_boundary_auditor"',
          '  allowed_subagents: []',
          '  allowed_tools: ["governance.overview"]',
          '  memory_scope: ["freeze_incidents"]',
          '  qa_requirements: ["root_cause_identified"]',
          '  write_scope: ["state/governance/**"]',
          '  promotion_gates: ["root_cause_identified"]',
          "  network_policy:",
          '    default: "internal_only"',
          "    allowed_domains: []",
          "  escalation_policy:",
          '    boundary_conflict: "human_sovereign"',
          '    critical_change: "human_sovereign"',
        ].join("\n"),
        "utf8",
      );

      const healedOverview = getGovernanceOverview({
        cfg: createCfg(),
        charterDir,
        stateDir,
        observedAt: 200,
      });

      expect(healedOverview.enforcement.active).toBe(false);
      expect(healedOverview.sovereignty.open).toBe(0);
      expect(healedOverview.sovereignty.resolved).toBeGreaterThanOrEqual(1);
      expect(healedOverview.sovereignty.freezeActive).toBe(false);
      expect(
        healedOverview.sovereignty.incidents.find((entry) => entry.status === "resolved")?.title,
      ).toContain("sovereignty auditor");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds a per-team governance snapshot with resolved members and aggregate controls", async () => {
    const { root, charterDir } = await createTempCharterRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  on_high_or_critical_breach: ["freeze_mutating_subsystems"]',
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Shape the organization."',
          "authority:",
          '  level: "high"',
          "  mutation_scope:",
          '    allow: ["charter_agents"]',
          '    deny: ["constitution"]',
          "runtime_mapping:",
          '  intended_project_hooks: ["governance.proposals.*", "autonomy.governance.proposals"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "strategist.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "strategist"',
          '  title: "Strategist"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Refine execution doctrine."',
          "authority:",
          '  level: "medium"',
          "  mutation_scope:",
          '    allow: ["task_strategies"]',
          '    deny: ["constitution"]',
          "runtime_mapping:",
          '  intended_project_hooks: ["autonomy.history", "autonomy.genesis.plan"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "evolution", "genesis-team.yaml"),
        [
          "version: 1",
          "team:",
          '  id: "genesis_team"',
          '  title: "Genesis Team"',
          '  layer: "evolution"',
          "members:",
          '  - "founder"',
          '  - "strategist"',
          '  - "qa"',
        ].join("\n"),
        "utf8",
      );

      const result = getGovernanceTeam({
        cfg: createCfg(),
        charterDir,
        teamId: "genesis_team",
        observedAt: 654,
      });

      expect(result.observedAt).toBe(654);
      expect(result.teamId).toBe("genesis_team");
      expect(result.declared).toBe(true);
      expect(result.blueprint?.title).toBe("Genesis Team");
      expect(result.declaredMemberIds).toEqual(["founder", "strategist", "qa"]);
      expect(result.missingMemberIds).toEqual(["qa"]);
      expect(result.runtimeHookCoverage).toEqual([
        "autonomy.genesis.plan",
        "autonomy.governance.proposals",
        "autonomy.history",
        "governance.proposals.*",
      ]);
      expect(result.mutationAllow).toEqual(["charter_agents", "task_strategies"]);
      expect(result.mutationDeny).toEqual(["constitution"]);
      expect(result.freezeActiveMemberIds).toEqual(["founder", "qa", "strategist"]);
      expect(result.members).toHaveLength(3);
      expect(result.members.find((entry) => entry.agentId === "founder")?.blueprint?.title).toBe(
        "Founder",
      );
      expect(result.members.find((entry) => entry.agentId === "qa")?.blueprint).toBeUndefined();
      expect(result.members.every((entry) => entry.runtimeSnapshot?.agentId === entry.agentId)).toBe(
        true,
      );
      expect(result.effectiveToolDeny).toContain("apply_patch");
      expect(result.effectiveToolDeny).toEqual(
        result.members.find((entry) => entry.agentId === "founder")?.contract.effectiveToolDeny,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes governed capability inventory and genesis plan wrappers", async () => {
    const { root, charterDir, workspaceDir } = await createTempCharterRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      for (const agentId of ["founder", "strategist", "librarian"]) {
        await writeFile(
          path.join(charterDir, "agents", `${agentId}.yaml`),
          [
            "version: 1",
            "agent:",
            `  id: "${agentId}"`,
            `  title: "${agentId}"`,
            '  layer: "evolution"',
            "mission:",
            `  primary: "Operate as ${agentId}."`,
          ].join("\n"),
          "utf8",
        );
      }
      await writeFile(
        path.join(charterDir, "evolution", "genesis-team.yaml"),
        [
          "version: 1",
          "team:",
          '  id: "genesis_team"',
          '  title: "Genesis Team"',
          '  layer: "evolution"',
          "members:",
          '  - "librarian"',
        ].join("\n"),
        "utf8",
      );
      await mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
      await writeFile(
        path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
        ["---", "name: demo-skill", "description: Demo governed skill", "---", "", "# demo-skill"].join(
          "\n",
        ),
        "utf8",
      );

      const inventory = getGovernanceCapabilityInventory({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 789,
      });
      const genesisPlan = getGovernanceGenesisPlan({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        observedAt: 790,
      });

      expect(inventory.observedAt).toBe(789);
      expect(inventory.workspaceDirs).toEqual([workspaceDir]);
      expect(inventory.summary.skillCount).toBeGreaterThanOrEqual(1);
      expect(inventory.entries.some((entry) => entry.kind === "skill")).toBe(true);
      expect(genesisPlan.observedAt).toBe(790);
      expect(genesisPlan.teamId).toBe("genesis_team");
      expect(genesisPlan.stages).toHaveLength(6);
      expect(genesisPlan.blockers.some((entry) => entry.includes("missing genesis roles"))).toBe(
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes governed capability asset registry drift against the observed inventory", async () => {
    const { root, charterDir, workspaceDir } = await createTempCharterRoot();
    try {
      await mkdir(path.join(charterDir, "capability"), { recursive: true });
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "librarian.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "librarian"',
          '  title: "Librarian"',
          '  layer: "capability"',
          "mission:",
          '  primary: "Register governed capability assets."',
        ].join("\n"),
        "utf8",
      );
      await mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
      await writeFile(
        path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
        ["---", "name: demo-skill", "description: Demo governed skill", "---", "", "# demo-skill"].join(
          "\n",
        ),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "capability", "asset-registry.yaml"),
        [
          "version: 1",
          "registry:",
          '  id: "capability_asset_registry"',
          '  title: "Governed Capability Asset Registry"',
          '  status: "active"',
          "  observedAt: 12",
          "assets:",
          `  - id: 'skill:${workspaceDir}:demo-skill'`,
          '    kind: "skill"',
          '    status: "ready"',
          '    title: "Outdated Demo Skill"',
          "    coverage: []",
          "    dependencies: []",
          "    issues: []",
          "    installOptions: []",
          '  - id: "plugin:bundled:stale-plugin::/tmp/stale-plugin"',
          '    kind: "plugin"',
          '    status: "blocked"',
          '    title: "Stale Plugin"',
          "    coverage: []",
          "    dependencies: []",
          "    issues: []",
          "    installOptions: []",
        ].join("\n"),
        "utf8",
      );

      const result = getGovernanceCapabilityAssetRegistry({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        agentIds: ["librarian"],
        observedAt: 880,
      });

      expect(result.observedAt).toBe(880);
      expect(result.charterDir).toBe(charterDir);
      expect(result.workspaceDirs).toEqual([workspaceDir]);
      expect(result.requestedAgentIds).toEqual(["librarian"]);
      expect(result.snapshot.exists).toBe(true);
      expect(result.currentAssetCount).toBe(2);
      expect(result.assetCount).toBeGreaterThan(0);
      expect(result.hasChanges).toBe(true);
      expect(result.staleAssetIds).toContain("plugin:bundled:stale-plugin::/tmp/stale-plugin");
      expect(result.driftedAssetIds).toContain(`skill:${workspaceDir}:demo-skill`);
      expect(result.desiredRegistry.assets).toContainEqual(
        expect.objectContaining({
          id: `skill:${workspaceDir}:demo-skill`,
          kind: "skill",
          title: "demo-skill",
        }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes governance proposal synthesis through the control plane", async () => {
    const { root, charterDir, stateDir, workspaceDir } = await createTempCharterRoot();
    try {
      await mkdir(path.join(charterDir, "capability"), { recursive: true });
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  on_high_or_critical_breach: ["freeze_mutating_subsystems"]',
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Shape the organization."',
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "agents", "strategist.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "strategist"',
          '  title: "Strategist"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Refine doctrine."',
        ].join("\n"),
        "utf8",
      );
      await mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
      await writeFile(
        path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
        ["---", "name: demo-skill", "description: Demo governed skill", "---", "", "# demo-skill"].join(
          "\n",
        ),
        "utf8",
      );

      const result = await synthesizeGovernanceProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        workspaceDirs: [workspaceDir],
        agentIds: ["founder", "strategist"],
        createdBySessionKey: "agent:founder:main",
        now: 990,
      });

      expect(result.observedAt).toBe(990);
      expect(result.requestedAgentIds).toEqual(["founder", "strategist"]);
      expect(result.eligibleAgentIds).toEqual(["founder", "strategist"]);
      expect(result.createdCount).toBeGreaterThan(0);
      expect(result.results.some((entry) => entry.status === "created")).toBe(true);
      expect(result.results.some((entry) => entry.ruleId === "attach_sovereignty_auditor")).toBe(
        true,
      );
      expect(
        result.results.some((entry) => entry.ruleId.endsWith("capability_asset_registry")),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reconciles safe governance proposals through deterministic auto-apply", async () => {
    const { root, charterDir, stateDir, workspaceDir } = await createTempCharterRoot();
    try {
      await mkdir(path.join(charterDir, "capability"), { recursive: true });
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "librarian.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "librarian"',
          '  title: "Librarian"',
          '  layer: "capability"',
          "mission:",
          '  primary: "Register governed capability assets."',
        ].join("\n"),
        "utf8",
      );
      await mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
      await writeFile(
        path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
        ["---", "name: demo-skill", "description: Demo governed skill", "---", "", "# demo-skill"].join(
          "\n",
        ),
        "utf8",
      );

      const result = await reconcileGovernanceProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        workspaceDirs: [workspaceDir],
        agentIds: ["librarian"],
        createdBySessionKey: "agent:librarian:main",
        now: 1_000,
      });

      expect(result.mode).toBe("apply_safe");
      expect(result.reviewedCount).toBe(1);
      expect(result.appliedCount).toBe(1);
      expect(result.entries).toContainEqual(
        expect.objectContaining({
          ruleId: "bootstrap_capability_asset_registry",
          risk: "safe",
          requiresHumanSovereignApproval: false,
          safe: true,
          autoApproved: true,
          autoApplied: true,
          proposalStatusBefore: "pending",
          proposalStatusAfter: "applied",
        }),
      );
      const writtenRegistry = await readFile(
        path.join(charterDir, "capability", "asset-registry.yaml"),
        "utf8",
      );
      expect(writtenRegistry).toContain("demo-skill");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses sovereign governance proposals during force_apply_all without human approval", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  on_high_or_critical_breach: ["freeze_mutating_subsystems"]',
          '  freeze_targets: ["evolution_layer_promotions"]',
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Shape the organization."',
        ].join("\n"),
        "utf8",
      );

      const result = await reconcileGovernanceProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["founder"],
        createdBySessionKey: "agent:founder:main",
        mode: "force_apply_all",
        now: 2_000,
      });

      expect(result.mode).toBe("force_apply_all");
      expect(result.reviewedCount).toBe(0);
      expect(result.appliedCount).toBe(0);
      expect(result.entries).toContainEqual(
        expect.objectContaining({
          ruleId: "attach_sovereignty_auditor",
          risk: "sovereign",
          requiresHumanSovereignApproval: true,
          safe: false,
          autoApproved: false,
          autoApplied: false,
          proposalStatusBefore: "pending",
          reason: expect.stringMatching(/human sovereign approval/i),
        }),
      );
      const constitution = await readFile(path.join(charterDir, "constitution.yaml"), "utf8");
      expect(constitution).not.toContain("sovereignty-auditor.yaml");
      await expect(
        readFile(path.join(charterDir, "agents", "sovereignty-auditor.yaml"), "utf8"),
      ).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("can force-apply elevated governance proposals during reconciliation", async () => {
    const { root, charterDir, stateDir } = await createTempCharterRoot();
    try {
      await writeFile(path.join(charterDir, "constitution.yaml"), "version: 1\n", "utf8");
      await writeFile(path.join(charterDir, "policies", "sovereignty.yaml"), "version: 1\n", "utf8");
      await writeFile(
        path.join(charterDir, "agents", "founder.yaml"),
        [
          "version: 1",
          "agent:",
          '  id: "founder"',
          '  title: "Founder"',
          '  layer: "evolution"',
          "mission:",
          '  primary: "Shape the organization."',
        ].join("\n"),
        "utf8",
      );

      const result = await reconcileGovernanceProposals({
        cfg: createCfg(),
        charterDir,
        stateDir,
        agentIds: ["founder"],
        createdBySessionKey: "agent:founder:main",
        mode: "force_apply_all",
        now: 3_000,
      });

      expect(result.mode).toBe("force_apply_all");
      expect(result.reviewedCount).toBe(1);
      expect(result.appliedCount).toBe(1);
      expect(result.entries).toContainEqual(
        expect.objectContaining({
          ruleId: "restore_evolution_policy_missing",
          risk: "elevated",
          requiresHumanSovereignApproval: false,
          safe: false,
          autoApproved: true,
          autoApplied: true,
          proposalStatusAfter: "applied",
        }),
      );
      await expect(
        readFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "utf8"),
      ).resolves.toContain("version:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
