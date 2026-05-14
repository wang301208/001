import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import {
  createSandboxUniverseController,
  createSandboxUniverseReplayRunner,
  evaluateSandboxUniversePromotionGate,
  loadSandboxUniverseStateSync,
  planSandboxUniverseExperiment,
  runSandboxUniverseReplayRunner,
} from "./sandbox-universe.js";

async function createTempSandboxCharterRoot(): Promise<{
  root: string;
  charterDir: string;
  workspaceDir: string;
  stateDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "zhushou-sandbox-universe-"));
  const charterDir = path.join(root, "governance", "charter");
  const workspaceDir = path.join(root, "workspace");
  const stateDir = path.join(root, "state");
  await mkdir(path.join(charterDir, "agents"), { recursive: true });
  await mkdir(path.join(charterDir, "evolution"), { recursive: true });
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  await mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
  await mkdir(stateDir, { recursive: true });
  return { root, charterDir, workspaceDir, stateDir };
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

async function writeAgentBlueprint(params: {
  charterDir: string;
  agentId: string;
  title?: string;
  layer?: string;
}) {
  await writeFile(
    path.join(params.charterDir, "agents", `${params.agentId}.yaml`),
    [
      "version: 1",
      "agent:",
      `  id: "${params.agentId}"`,
      `  title: "${params.title ?? params.agentId}"`,
      `  layer: "${params.layer ?? "evolution"}"`,
      '  status: "active"',
      "mission:",
      `  primary: "Operate as ${params.title ?? params.agentId}."`,
      "authority:",
      '  level: "high"',
      "  mutation_scope:",
      "    allow:",
      '      - "skills"',
      "    deny:",
      '      - "constitution"',
      "  network_scope:",
      '    default: "internal_only"',
      "    conditions: []",
      "  resource_budget:",
      '    tokens: "high"',
      '    runtime: "continuous"',
      "required_counterparties:",
      '  works_with: ["librarian"]',
      '  reports_to: ["founder"]',
      "runtime_mapping:",
      "  intended_project_hooks:",
      '    - "skills"',
      "",
    ].join("\n"),
    "utf8",
  );
}

describe("sandbox universe", () => {
  it("plans a sandbox experiment from governed capability and genesis signals", async () => {
    const { root, charterDir, workspaceDir, stateDir } = await createTempSandboxCharterRoot();
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
        ["version: 1", "promotion_pipeline: {}", ""].join("\n"),
        "utf8",
      );
      for (const agentId of [
        "founder",
        "strategist",
        "librarian",
        "sentinel",
        "archaeologist",
        "tdd_developer",
        "qa",
        "publisher",
        "executor",
      ]) {
        await writeAgentBlueprint({
          charterDir,
          agentId,
          title: agentId,
          layer: agentId === "librarian" ? "capability" : agentId === "executor" ? "execution" : "evolution",
        });
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
      await writeFile(
        path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
        ["---", "name: demo-skill", "description: Demo governed capability skill", "---", "", "# Demo"].join(
          "\n",
        ),
        "utf8",
      );

      const plan = planSandboxUniverseExperiment({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        requestedByAgentId: "tdd_developer",
        observedAt: 123,
      });

      expect(plan).toMatchObject({
        observedAt: 123,
        charterDir,
        workspaceDirs: [workspaceDir],
        requestedByAgentId: "tdd_developer",
      });
      expect(plan.universeId).toContain("sandbox/tdd_developer/");
      expect(plan.target.teamId).toBe("genesis_team");
      expect(plan.replayPlan.workspaceDirs).toEqual([workspaceDir]);
      expect(plan.replayPlan.requiredOutputs).toEqual(
        expect.arrayContaining(["sandbox_change_set", "replay_report", "qa_report"]),
      );
      expect(plan.stages.map((entry) => entry.id)).toEqual([
        "proposal",
        "sandbox_validation",
        "qa_replay",
        "promotion_gate",
      ]);
      const controller = createSandboxUniverseController({
        plan,
        stateDir,
      });
      const replayRunner = createSandboxUniverseReplayRunner({
        plan,
        controller,
        producedByAgentId: "tdd_developer",
        stateDir,
      });
      expect(controller.activeStageId).toBe("sandbox_validation");
      expect(controller.evidence.find((entry) => entry.id === "problem_statement")?.status).toBe(
        "collected",
      );
      expect(controller.statePath).toBeTruthy();
      expect(controller.artifactDir).toBeTruthy();
      expect(replayRunner).toMatchObject({
        status: "ready",
        producedByAgentId: "tdd_developer",
        scenarios: plan.replayPlan.scenarios,
      });
      expect(replayRunner.statePath).toBe(controller.statePath);

      const loaded = loadSandboxUniverseStateSync({
        universeId: plan.universeId,
        stateDir,
      });
      expect(loaded?.controller?.statePath).toBe(controller.statePath);
      expect(
        loaded?.controller?.evidence.find((entry) => entry.id === "problem_statement")?.storagePath,
      ).toContain("problem_statement.md");
      expect(
        loaded?.controller?.evidence.find((entry) => entry.id === "target_scope")?.storagePath,
      ).toContain("target_scope.json");
      expect(loaded?.replayRunner?.statePath).toBe(replayRunner.statePath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("blocks sandbox promotion while governance freeze is active and clears once evidence passes", async () => {
    const { root, charterDir, workspaceDir, stateDir } = await createTempSandboxCharterRoot();
    try {
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/founder.yaml"]',
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(charterDir, "policies", "sovereignty.yaml"),
        [
          "version: 1",
          "automatic_enforcement:",
          '  freeze_targets: ["evolution_layer_promotions"]',
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(path.join(charterDir, "policies", "evolution-policy.yaml"), "version: 1\n", "utf8");
      await writeAgentBlueprint({
        charterDir,
        agentId: "founder",
        title: "Founder",
      });

      const plan = planSandboxUniverseExperiment({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        requestedByAgentId: "publisher",
        observedAt: 456,
      });
      const blocked = evaluateSandboxUniversePromotionGate({
        cfg: createCfg(),
        charterDir,
        plan,
        qaPassed: true,
        replayPassed: true,
        auditPassed: true,
        observedAt: 457,
      });

      expect(blocked).toMatchObject({
        observedAt: 457,
        freezeActive: true,
        qaPassed: true,
        replayPassed: true,
        auditPassed: true,
        canPromote: false,
      });
      expect(blocked.blockers.length).toBeGreaterThan(0);

      await writeAgentBlueprint({
        charterDir,
        agentId: "sovereignty-auditor",
        title: "Sovereignty Auditor",
      });
      await writeFile(
        path.join(charterDir, "constitution.yaml"),
        [
          "version: 1",
          "charter_artifacts:",
          '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
          '  core_agents: ["governance/charter/agents/founder.yaml", "governance/charter/agents/sovereignty-auditor.yaml"]',
          "",
        ].join("\n"),
        "utf8",
      );

      const clearedPlan = planSandboxUniverseExperiment({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        requestedByAgentId: "publisher",
        observedAt: 458,
      });
      const cleared = evaluateSandboxUniversePromotionGate({
        cfg: createCfg(),
        charterDir,
        plan: clearedPlan,
        qaPassed: true,
        replayPassed: true,
        auditPassed: true,
        observedAt: 459,
      });

      expect(cleared).toMatchObject({
        observedAt: 459,
        freezeActive: false,
        qaPassed: true,
        replayPassed: true,
        auditPassed: true,
        canPromote: true,
        blockers: [],
      });

      const executed = runSandboxUniverseReplayRunner({
        cfg: createCfg(),
        charterDir,
        plan: clearedPlan,
        replayPassed: true,
        qaPassed: true,
        auditPassed: true,
        producedByAgentId: "publisher",
        observedAt: 460,
        stateDir,
      });
      expect(executed.decision.canPromote).toBe(true);
      expect(executed.controller.stages.find((entry) => entry.id === "qa_replay")?.status).toBe(
        "passed",
      );
      expect(
        executed.controller.evidence.find((entry) => entry.id === "promotion_manifest")?.status,
      ).toBe("collected");
      expect(executed.replayRunner).toMatchObject({
        status: "passed",
        producedByAgentId: "publisher",
        lastRun: expect.objectContaining({
          replayPassed: true,
          qaPassed: true,
          auditPassed: true,
          canPromote: true,
        }),
      });
      const loaded = loadSandboxUniverseStateSync({
        universeId: clearedPlan.universeId,
        stateDir,
      });
      expect(loaded?.decision?.canPromote).toBe(true);
      expect(
        loaded?.controller?.evidence.find((entry) => entry.id === "promotion_manifest")?.storagePath,
      ).toContain("promotion_manifest.json");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reads persisted evidence for the promotion gate instead of trusting forged in-memory flags", async () => {
    const { root, charterDir, workspaceDir, stateDir } = await createTempSandboxCharterRoot();
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
        ["version: 1", "promotion_pipeline: {}", ""].join("\n"),
        "utf8",
      );
      await writeAgentBlueprint({
        charterDir,
        agentId: "founder",
        title: "Founder",
      });
      await writeAgentBlueprint({
        charterDir,
        agentId: "sovereignty-auditor",
        title: "Sovereignty Auditor",
      });

      const plan = planSandboxUniverseExperiment({
        cfg: createCfg(),
        charterDir,
        workspaceDirs: [workspaceDir],
        requestedByAgentId: "publisher",
        observedAt: 700,
      });
      const controller = createSandboxUniverseController({
        plan,
        observedAt: 701,
        stateDir,
      });
      const forgedController = {
        ...controller,
        evidence: controller.evidence.map((entry) =>
          plan.promotionGate.requiredEvidence.includes(entry.id)
            ? {
                ...entry,
                status: "collected" as const,
                storagePath: path.join(root, "forged", `${entry.id}.json`),
              }
            : entry,
        ),
      };
      const blocked = evaluateSandboxUniversePromotionGate({
        cfg: createCfg(),
        charterDir,
        plan,
        controller: forgedController,
        qaPassed: true,
        replayPassed: true,
        auditPassed: true,
        observedAt: 702,
      });

      expect(blocked.canPromote).toBe(false);
      expect(blocked.blockers).toEqual(
        expect.arrayContaining([expect.stringContaining("required evidence not collected")]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
