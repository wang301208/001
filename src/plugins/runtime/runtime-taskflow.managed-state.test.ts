import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  createSandboxUniverseController,
  createSandboxUniverseReplayRunner,
  runSandboxUniverseReplayRunner,
  type SandboxUniverseExperimentPlan,
} from "../../governance/sandbox-universe.js";
import { extractManagedAutonomyRuntimeState } from "./runtime-taskflow.managed-state.js";

function createCfg(): OpenClawConfig {
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
  } as unknown as OpenClawConfig;
}

async function createTempSandboxRoot(): Promise<{
  root: string;
  charterDir: string;
  workspaceDir: string;
  stateDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-managed-sandbox-"));
  const charterDir = path.join(root, "governance", "charter");
  const workspaceDir = path.join(root, "workspace");
  const stateDir = path.join(root, "state");
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
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
  return { root, charterDir, workspaceDir, stateDir };
}

function createSandboxPlan(params: {
  charterDir: string;
  workspaceDir: string;
}): SandboxUniverseExperimentPlan {
  return {
    observedAt: 100,
    charterDir: params.charterDir,
    workspaceDirs: [params.workspaceDir],
    universeId: "sandbox/executor/capability/demo-gap",
    requestedByAgentId: "executor",
    target: {
      kind: "capability",
      id: "capability_inventory.demo_gap",
      title: "Demo gap",
      focusGapIds: ["capability_inventory.demo_gap"],
      teamId: "genesis_team",
    },
    stages: [
      {
        id: "proposal",
        title: "Proposal",
        status: "planned",
        requiredEvidence: ["problem_statement", "target_scope"],
        blockers: [],
      },
      {
        id: "sandbox_validation",
        title: "Sandbox Validation",
        status: "planned",
        requiredEvidence: ["sandbox_change_set"],
        blockers: [],
      },
      {
        id: "qa_replay",
        title: "QA Replay",
        status: "planned",
        requiredEvidence: ["qa_report", "replay_report"],
        blockers: [],
      },
      {
        id: "promotion_gate",
        title: "Promotion Gate",
        status: "planned",
        requiredEvidence: [
          "sandbox_change_set",
          "replay_report",
          "qa_report",
          "audit_trace",
          "rollback_reference",
        ],
        blockers: [],
      },
    ],
    replayPlan: {
      scenarios: ["replay:capability_inventory.demo_gap"],
      workspaceDirs: [params.workspaceDir],
      requiredOutputs: [
        "sandbox_change_set",
        "replay_report",
        "qa_report",
        "audit_trace",
        "rollback_reference",
        "promotion_manifest",
      ],
    },
    promotionGate: {
      freezeActive: false,
      blockers: [],
      requiredEvidence: [
        "sandbox_change_set",
        "replay_report",
        "qa_report",
        "audit_trace",
        "rollback_reference",
      ],
    },
  };
}

describe("runtime taskflow managed state", () => {
  it("hydrates sandbox projections from the persisted sandbox ledger", async () => {
    const { root, charterDir, workspaceDir, stateDir } = await createTempSandboxRoot();
    try {
      const plan = createSandboxPlan({
        charterDir,
        workspaceDir,
      });
      const staleController = createSandboxUniverseController({
        plan,
        observedAt: 101,
        stateDir,
      });
      const staleReplayRunner = createSandboxUniverseReplayRunner({
        plan,
        controller: staleController,
        observedAt: 101,
        producedByAgentId: "executor",
        stateDir,
      });
      const executed = runSandboxUniverseReplayRunner({
        cfg: createCfg(),
        charterDir,
        plan,
        controller: staleController,
        replayRunner: staleReplayRunner,
        replayPassed: true,
        qaPassed: true,
        auditPassed: true,
        observedAt: 102,
        producedByAgentId: "executor",
        stateDir,
      });

      const managed = extractManagedAutonomyRuntimeState({
        controllerId: "runtime.autonomy/executor",
        goal: "Deliver governed outcomes.",
        currentStep: "sandbox",
        stateJson: {
          autonomy: {
            agentId: "executor",
            controllerId: "runtime.autonomy/executor",
            goal: "Deliver governed outcomes.",
            currentStep: "sandbox",
            workspaceDirs: [workspaceDir],
            project: {
              kind: "execution_system",
              goalContract: {
                goal: "Deliver governed outcomes.",
                layer: "execution",
                authorityLevel: "governed",
              },
              taskGraph: [
                {
                  id: "goal_intake",
                  title: "Goal Intake",
                  dependsOn: [],
                  output: "goal_contract",
                },
              ],
              executionPlan: {
                phases: [
                  {
                    id: "goal_intake",
                    title: "Goal Intake",
                    dependsOn: [],
                    output: "goal_contract",
                  },
                ],
                runtimeHooks: ["taskflow"],
                collaborators: ["founder", "librarian"],
              },
              capabilityRequest: {
                status: "required",
                focusGapIds: ["capability_inventory.demo_gap"],
                handoffTeamId: "genesis_team",
                reason: "critical capability gaps block safe execution",
                blockers: [],
              },
              observedCapabilityGaps: ["capability_inventory.demo_gap"],
              genesisPlan: {
                teamId: "genesis_team",
                mode: "repair",
                focusGapIds: ["capability_inventory.demo_gap"],
                blockers: [],
              },
              sandboxUniverse: {
                ...plan,
                replayPlan: {
                  ...plan.replayPlan,
                  requiredOutputs: ["replay_report"],
                },
              },
              sandboxController: {
                ...staleController,
                evidence: staleController.evidence.filter(
                  (entry) => entry.id !== "promotion_manifest",
                ),
              },
              sandboxReplayRunner: {
                ...staleReplayRunner,
                requiredOutputs: ["replay_report"],
              },
            },
          },
        },
      });

      expect(managed?.project?.kind).toBe("execution_system");
      const hydratedProject =
        managed?.project?.kind === "execution_system" ? managed.project : undefined;
      expect(hydratedProject?.sandboxController?.statePath).toBe(executed.controller.statePath);
      expect(
        hydratedProject?.sandboxController?.evidence.find(
          (entry) => entry.id === "promotion_manifest",
        )?.status,
      ).toBe("collected");
      expect(hydratedProject?.sandboxReplayRunner?.status).toBe("passed");
      expect(hydratedProject?.sandboxReplayRunner?.lastRun?.canPromote).toBe(true);
      expect(hydratedProject?.sandboxReplayRunner?.requiredOutputs).toEqual(
        expect.arrayContaining(["audit_trace", "rollback_reference", "promotion_manifest"]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
