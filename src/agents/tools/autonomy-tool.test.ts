import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../config/config.js";
import { resolveStorePath } from "../../config/sessions.js";
import {
  installRuntimeTaskDeliveryMock,
  resetRuntimeTaskTestState,
} from "../../plugins/runtime/runtime-task-test-harness.js";
import { createAutonomyTool } from "./autonomy-tool.js";

afterEach(() => {
  clearRuntimeConfigSnapshot();
  resetRuntimeTaskTestState();
});

async function createGovernedCapabilityCharterRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-autonomy-tool-capability-"));
  const charterDir = path.join(root, "governance", "charter");
  const workspaceDir = path.join(root, "workspace");
  await fs.mkdir(path.join(charterDir, "agents"), { recursive: true });
  await fs.mkdir(path.join(charterDir, "policies"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "skills", "demo-skill"), { recursive: true });
  await fs.writeFile(
    path.join(charterDir, "constitution.yaml"),
    ["version: 1", "charter_artifacts: {}", "sovereign_boundaries: {}", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "sovereignty.yaml"),
    ["version: 1", "reserved_authorities: {}", "automatic_enforcement: {}", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "evolution-policy.yaml"),
    ["version: 1", "policy: {}", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
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
  await fs.writeFile(
    path.join(workspaceDir, "skills", "demo-skill", "SKILL.md"),
    [
      "---",
      "name: demo-skill",
      "description: Demo governed capability skill",
      "---",
      "",
      "# Demo",
    ].join("\n"),
    "utf8",
  );
  return { root, charterDir, workspaceDir };
}

async function writeSessionWorkspaceBinding(params: {
  agentId: string;
  sessionKey: string;
  workspaceDir: string;
}) {
  const storePath = resolveStorePath(undefined, { agentId: params.agentId });
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(
    storePath,
    JSON.stringify(
      {
        [params.sessionKey]: {
          sessionId: `${params.agentId}-session`,
          updatedAt: Date.now(),
          spawnedWorkspaceDir: params.workspaceDir,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

describe("autonomy tool", () => {
  let tempStateDir: string | null = null;
  let previousStateDir: string | undefined;

  beforeEach(async () => {
    previousStateDir = process.env.ZHUSHOU_STATE_DIR;
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-autonomy-tool-"));
    process.env.ZHUSHOU_STATE_DIR = tempStateDir;
    installRuntimeTaskDeliveryMock();
    setRuntimeConfigSnapshot({});
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.ZHUSHOU_STATE_DIR;
    } else {
      process.env.ZHUSHOU_STATE_DIR = previousStateDir;
    }
    tempStateDir = null;
  });

  it("lists supported autonomy profiles", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-1", { action: "list" });

    const details = result.details as {
      action: string;
      sessionKey: string;
      requesterAgentId?: string;
      profiles: Array<{ id: string }>;
    };

    expect(details.action).toBe("list");
    expect(details.sessionKey).toBe("agent:main:main");
    expect(details.requesterAgentId).toBe("main");
    expect(details.profiles.length).toBeGreaterThanOrEqual(3);
    expect(details.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "founder" }),
        expect.objectContaining({ id: "strategist" }),
        expect.objectContaining({ id: "librarian" }),
      ]),
    );
  });

  it("returns fleet-wide autonomy convergence from the tool layer", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-overview", {
      action: "overview",
    });

    const details = result.details as {
      action: string;
      overview: {
        totals: {
          totalProfiles: number;
        };
        entries: Array<{ agentId: string }>;
      };
    };

    expect(details.action).toBe("overview");
    expect(details.overview.totals.totalProfiles).toBeGreaterThanOrEqual(3);
    expect(details.overview.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "founder",
        }),
        expect.objectContaining({
          agentId: "strategist",
        }),
        expect.objectContaining({
          agentId: "librarian",
        }),
      ]),
    );
  });

  it("passes the bound workspace scope through overview requests", async () => {
    const workspaceA = "/tmp/tool-overview-workspace-a";
    const workspaceB = "/tmp/tool-overview-workspace-b";

    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-overview-seed-a", {
      action: "heal",
      agentIds: ["founder"],
      workspaceDirs: [workspaceA],
    });

    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-overview-seed-b", {
      action: "heal",
      agentIds: ["strategist"],
      workspaceDirs: [workspaceB],
    });

    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
      workspaceDir: workspaceA,
    }).execute("call-overview-scoped", {
      action: "overview",
    });

    const overviewEntries = (
      result.details as {
        overview: { entries: Array<{ agentId: string }> };
      }
    ).overview.entries;

    expect(overviewEntries.some((entry) => entry.agentId === "founder")).toBe(true);
    expect(overviewEntries.some((entry) => entry.agentId === "strategist")).toBe(false);
  });

  it("heals fleet-wide autonomy continuity from the tool layer", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-heal", {
      action: "heal",
      agentIds: ["founder"],
    });

    expect(result.details).toMatchObject({
      action: "heal",
      healed: {
        totals: expect.objectContaining({
          totalProfiles: 1,
        }),
        entries: [
          expect.objectContaining({
            agentId: "founder",
          }),
        ],
      },
    });
  });

  it("supervises fleet-wide autonomy convergence from the tool layer", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-supervise", {
        action: "supervise",
        agentIds: ["librarian"],
        governanceMode: "apply_safe",
        decisionNote: "Supervisor pass for governed capability repair.",
        restartBlockedFlows: true,
        includeCapabilityInventory: true,
        includeGenesisPlan: true,
        recordHistory: true,
      });

      expect(result.details).toMatchObject({
        action: "supervise",
        sessionKey: "agent:librarian:main",
        requesterAgentId: "librarian",
        supervised: {
          governanceMode: "apply_safe",
          overviewBefore: {
            totals: expect.objectContaining({
              totalProfiles: 1,
            }),
          },
          healed: {
            totals: expect.objectContaining({
              totalProfiles: 1,
            }),
          },
          governanceReconciled: {
            charterDir,
            requestedAgentIds: ["librarian"],
            eligibleAgentIds: ["librarian"],
            mode: "apply_safe",
          },
          capabilityInventory: {
            charterDir,
            workspaceDirs: [workspaceDir],
            requestedAgentIds: ["librarian"],
          },
          genesisPlan: {
            charterDir,
            workspaceDirs: [workspaceDir],
            requestedAgentIds: ["librarian"],
          },
          overviewAfter: {
            totals: expect.objectContaining({
              totalProfiles: 1,
            }),
          },
          summary: expect.objectContaining({
            totalProfiles: 1,
            recommendedNextActions: expect.any(Array),
          }),
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("bootstraps fleet-wide autonomy readiness from the tool layer", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-bootstrap", {
        action: "bootstrap",
        agentIds: ["librarian"],
        governanceMode: "apply_safe",
        decisionNote: "Bootstrap governed capability readiness.",
        restartBlockedFlows: false,
        includeCapabilityInventory: true,
        includeGenesisPlan: true,
        recordHistory: false,
      });

      expect(result.details).toMatchObject({
        action: "bootstrap",
        sessionKey: "agent:librarian:main",
        requesterAgentId: "librarian",
        bootstrapped: {
          sessionKey: "agent:librarian:main",
          supervised: {
            governanceMode: "apply_safe",
            overviewAfter: {
              totals: expect.objectContaining({
                totalProfiles: 1,
                healthy: 1,
                missingLoop: 0,
                activeFlows: 1,
              }),
            },
          },
          readiness: {
            ready: false,
            profileReadyCount: 1,
            profileNotReadyCount: 0,
            missingLoopProfiles: 0,
            driftProfiles: 0,
            idleProfiles: 0,
            activeFlows: 1,
            blockers: expect.arrayContaining([
              expect.stringContaining("critical capability gap"),
              expect.stringContaining("Genesis stage"),
            ]),
          },
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("returns strong-autonomy architecture readiness from the tool layer", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-architecture", {
      action: "architecture",
      governanceMode: "apply_safe",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
    });

    const details = result.details as {
      action: string;
      architectureReadiness: {
        summary: {
          totalChecks: number;
          readyChecks: number;
        };
        layers: Array<{ id: string }>;
        loops: Array<{ id: string }>;
        sandboxUniverse: { id: string };
      };
    };

    expect(details.action).toBe("architecture");
    expect(details.architectureReadiness.summary.totalChecks).toBeGreaterThanOrEqual(13);
    expect(details.architectureReadiness.summary.readyChecks).toBeGreaterThan(0);
    expect(details.architectureReadiness.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "governance" }),
        expect.objectContaining({ id: "evolution" }),
        expect.objectContaining({ id: "capability" }),
        expect.objectContaining({ id: "execution" }),
      ]),
    );
    expect(details.architectureReadiness.loops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "value" }),
        expect.objectContaining({ id: "maintenance" }),
        expect.objectContaining({ id: "evolution" }),
      ]),
    );
    expect(details.architectureReadiness.sandboxUniverse.id).toBe("sandbox_universe");
  });

  it("activates governed maximum autonomy from the tool layer", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-activate", {
      action: "activate",
      agentIds: ["founder"],
      governanceMode: "force_apply_all",
      includeCapabilityInventory: false,
      includeGenesisPlan: false,
      recordHistory: false,
      restartBlockedFlows: false,
    });

    const details = result.details as {
      action: string;
      architectureReadiness: {
        summary: {
          totalChecks: number;
          readyChecks: number;
        };
      };
    };

    expect(details.action).toBe("activate");
    expect(details.architectureReadiness.summary.totalChecks).toBeGreaterThanOrEqual(13);
    expect(details.architectureReadiness.summary.readyChecks).toBeGreaterThan(0);
  });

  it("reads persistent autonomy maintenance history from the tool layer", async () => {
    const workspaceDir = "/tmp/tool-history-workspace";
    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-history-a", {
      action: "heal",
      agentIds: ["founder"],
      workspaceDirs: [workspaceDir],
    });

    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-history-b", {
      action: "history",
      agentIds: ["founder"],
      workspaceDirs: [workspaceDir],
      limit: 5,
      mode: "heal",
      source: "manual",
    });

    expect(result.details).toMatchObject({
      action: "history",
      history: {
        total: 1,
        truncated: false,
        events: [
          expect.objectContaining({
            mode: "heal",
            source: "manual",
            agentIds: ["founder"],
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
            entries: [
              expect.objectContaining({
                agentId: "founder",
                workspaceDirs: [workspaceDir],
                primaryWorkspaceDir: workspaceDir,
              }),
            ],
          }),
        ],
      },
    });
  });

  it("exposes governance proposal synthesis from the tool layer", async () => {
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-governance", {
      action: "governance_proposals",
      agentIds: ["founder"],
    });

    expect(result.details).toMatchObject({
      action: "governance_proposals",
      sessionKey: "agent:main:main",
      governanceProposals: {
        requestedAgentIds: ["founder"],
        eligibleAgentIds: ["founder"],
        createdCount: expect.any(Number),
        existingCount: expect.any(Number),
        skippedCount: expect.any(Number),
        results: expect.any(Array),
      },
    });
  });

  it("exposes governance proposal reconciliation from the tool layer", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-governance-reconcile", {
        action: "governance_reconcile",
        agentIds: ["librarian"],
        mode: "apply_safe",
        decisionNote: "Auto-apply safe governance repairs.",
      });

      expect(result.details).toMatchObject({
        action: "governance_reconcile",
        sessionKey: "agent:librarian:main",
        governanceReconciled: {
          charterDir,
          requestedAgentIds: ["librarian"],
          eligibleAgentIds: ["librarian"],
          mode: "apply_safe",
          reviewedCount: 1,
          appliedCount: 1,
          entries: [
            expect.objectContaining({
              ruleId: "bootstrap_capability_asset_registry",
              autoApplied: true,
            }),
          ],
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("defaults governance proposal workspace scope from the bound tool workspace", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-governance-workspace-default", {
        action: "governance_proposals",
        agentIds: ["librarian"],
      });

      expect(result.details).toMatchObject({
        action: "governance_proposals",
        governanceProposals: {
          charterDir,
          requestedAgentIds: ["librarian"],
          eligibleAgentIds: ["librarian"],
          createdCount: 1,
          existingCount: 0,
          results: [
            expect.objectContaining({
              ruleId: "bootstrap_capability_asset_registry",
              status: "created",
            }),
          ],
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("inherits governance proposal workspace scope from spawned session bindings", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      await writeSessionWorkspaceBinding({
        agentId: "librarian",
        sessionKey: "agent:librarian:project-thread",
        workspaceDir,
      });
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:project-thread",
        charterDir,
      }).execute("call-governance-session-workspace-default", {
        action: "governance_proposals",
        agentIds: ["librarian"],
      });

      expect(result.details).toMatchObject({
        action: "governance_proposals",
        governanceProposals: {
          charterDir,
          requestedAgentIds: ["librarian"],
          eligibleAgentIds: ["librarian"],
          createdCount: 1,
          existingCount: 0,
          results: [
            expect.objectContaining({
              ruleId: "bootstrap_capability_asset_registry",
              status: "created",
            }),
          ],
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("propagates the bound tool workspace through heal governance synthesis", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-heal-workspace-default", {
        action: "heal",
        agentIds: ["librarian"],
      });

      expect(result.details).toMatchObject({
        action: "heal",
        healed: {
          totals: expect.objectContaining({
            totalProfiles: 1,
          }),
          governanceProposals: {
            charterDir,
            requestedAgentIds: ["librarian"],
            eligibleAgentIds: ["librarian"],
            createdCount: 1,
            existingCount: 0,
            results: [
              expect.objectContaining({
                ruleId: "bootstrap_capability_asset_registry",
                status: "created",
              }),
            ],
          },
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("shows a governance-backed autonomy profile", async () => {
    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-2a", {
      action: "start",
      agentId: "founder",
      goal: "Scan organization topology",
      currentStep: "scan-organization",
    });

    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-2", {
      action: "show",
      agentId: "founder",
    });

    expect(result.details).toMatchObject({
      action: "show",
      profile: expect.objectContaining({
        id: "founder",
        contract: expect.objectContaining({
          agentId: "founder",
          charterDeclared: true,
          charterLayer: "evolution",
        }),
        bootstrap: expect.objectContaining({
          controllerId: "runtime.autonomy/founder",
        }),
      }),
      latestFlow: expect.objectContaining({
        goal: "Scan organization topology",
      }),
      latestSeedTask: expect.objectContaining({
        agentId: "founder",
      }),
    });
  });

  it("shows the scheduled autonomy loop from the tool layer", async () => {
    const workspaceDir = "/tmp/tool-loop-show-workspace";
    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-loop-a", {
      action: "loop_upsert",
      agentId: "founder",
      everyMs: 3_600_000,
      workspaceDirs: [workspaceDir],
    });

    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-loop-b", {
      action: "loop_show",
      agentId: "founder",
    });

    expect(result.details).toMatchObject({
      action: "loop_show",
      loop: {
        profile: {
          id: "founder",
        },
        loop: {
          agentId: "founder",
          mode: "managed-flow",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          job: expect.objectContaining({
            agentId: "founder",
            sessionTarget: "isolated",
            wakeMode: "now",
            schedule: expect.objectContaining({
              kind: "every",
              everyMs: 3_600_000,
            }),
          }),
        },
      },
    });
  });

  it("starts a managed autonomy flow from the tool layer", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const result = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-3", {
        action: "start",
        agentId: "librarian",
        goal: "Curate governed assets",
        currentStep: "index-assets",
      });

      expect(result.details).toMatchObject({
        action: "start",
        started: {
          profile: expect.objectContaining({
            id: "librarian",
          }),
          flow: expect.objectContaining({
            ownerKey: "agent:librarian:main",
            goal: "Curate governed assets",
            currentStep: "index-assets",
            state: expect.objectContaining({
              autonomy: expect.objectContaining({
                agentId: "librarian",
                currentStep: "index-assets",
                workspaceDirs: [workspaceDir],
                primaryWorkspaceDir: workspaceDir,
              }),
            }),
            tasks: [
              expect.objectContaining({
                agentId: "librarian",
                title: expect.stringContaining(`Workspace scope: ${workspaceDir}.`),
                governanceRuntime: expect.objectContaining({
                  agentId: "librarian",
                }),
              }),
            ],
          }),
          seedTask: expect.objectContaining({
            agentId: "librarian",
            title: expect.stringContaining(`Workspace scope: ${workspaceDir}.`),
          }),
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("cancels the latest managed autonomy flow from the tool layer", async () => {
    await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-3a", {
      action: "start",
      agentId: "founder",
      goal: "Cancel this founder flow",
    });

    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-3b", {
      action: "cancel",
      agentId: "founder",
    });

    expect(result.details).toMatchObject({
      action: "cancel",
      cancelled: {
        profile: expect.objectContaining({
          id: "founder",
        }),
        outcome: {
          found: true,
          cancelled: true,
          flow: expect.objectContaining({
            status: "cancelled",
          }),
        },
      },
    });
  });

  it("submits sandbox replay evidence from the tool layer", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const healed = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-replay-a", {
        action: "heal",
        agentIds: ["librarian"],
        workspaceDirs: [workspaceDir],
      });
      const flowId = (
        healed.details as {
          healed: {
            entries: Array<{ startedFlow?: { id: string } }>;
          };
        }
      ).healed.entries[0]?.startedFlow?.id;
      expect(flowId).toBeTruthy();

      const submitted = await createAutonomyTool({
        agentSessionKey: "agent:librarian:main",
        workspaceDir,
        charterDir,
      }).execute("call-replay-b", {
        action: "replay_submit",
        agentId: "librarian",
        flowId,
        replayPassed: true,
        qaPassed: true,
        auditPassed: true,
      });

      expect(submitted.details).toMatchObject({
        action: "replay_submit",
        sessionKey: "agent:librarian:main",
        submitted: {
          targetFlowId: flowId,
          outcome: {
            found: true,
            applied: true,
            decision: expect.objectContaining({
              canPromote: true,
            }),
            sandboxReplayRunner: expect.objectContaining({
              status: "passed",
              lastRun: expect.objectContaining({
                replayPassed: true,
                qaPassed: true,
                auditPassed: true,
                canPromote: true,
              }),
            }),
          },
        },
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("upserts and removes the managed autonomy loop from the tool layer", async () => {
    const workspaceDir = "/tmp/tool-loop-upsert-workspace";
    const upserted = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-5a", {
      action: "loop_upsert",
      agentId: "librarian",
      everyMs: 7_200_000,
      workspaceDirs: [workspaceDir],
    });
    const upsertedDetails = upserted.details as {
      action: string;
      upserted: {
        loop: {
          job: {
            id: string;
          };
        };
      };
    };

    expect(upsertedDetails).toMatchObject({
      action: "loop_upsert",
      upserted: {
        profile: {
          id: "librarian",
        },
        loop: {
          agentId: "librarian",
          mode: "managed-flow",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          job: expect.objectContaining({
            schedule: expect.objectContaining({
              kind: "every",
              everyMs: 7_200_000,
            }),
            payload: expect.objectContaining({
              kind: "agentTurn",
            }),
          }),
        },
      },
    });

    const removed = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-5b", {
      action: "loop_remove",
      agentId: "librarian",
      jobId: upsertedDetails.upserted.loop.job.id,
    });

    expect(removed.details).toMatchObject({
      action: "loop_remove",
      removed: {
        profile: expect.objectContaining({
          id: "librarian",
        }),
        targetJobId: upsertedDetails.upserted.loop.job.id,
        removed: true,
        removedJobIds: [upsertedDetails.upserted.loop.job.id],
      },
    });
  });

  it("reconciles managed autonomy loops from the tool layer", async () => {
    const workspaceDir = "/tmp/tool-loop-reconcile-workspace";
    const result = await createAutonomyTool({
      agentSessionKey: "agent:main:main",
    }).execute("call-6", {
      action: "loop_reconcile",
      agentIds: ["founder", "strategist"],
      workspaceDirs: [workspaceDir],
    });
    const resultDetails = result.details as {
      action: string;
      reconciled: {
        reconciled: unknown[];
        createdCount: number;
        updatedCount: number;
      };
    };

    expect(resultDetails).toMatchObject({
      action: "loop_reconcile",
      reconciled: {
        reconciled: [
          expect.objectContaining({
            profile: expect.objectContaining({ id: "founder" }),
            loop: expect.objectContaining({
              workspaceDirs: [workspaceDir],
              primaryWorkspaceDir: workspaceDir,
            }),
          }),
          expect.objectContaining({
            profile: expect.objectContaining({ id: "strategist" }),
            loop: expect.objectContaining({
              workspaceDirs: [workspaceDir],
              primaryWorkspaceDir: workspaceDir,
            }),
          }),
        ],
      },
    });
    expect(resultDetails.reconciled.reconciled).toHaveLength(2);
    expect(resultDetails.reconciled.createdCount + resultDetails.reconciled.updatedCount).toBe(2);
  });

  it("requires a bound agent session", async () => {
    await expect(
      createAutonomyTool().execute("call-4", {
        action: "list",
      }),
    ).rejects.toThrow("autonomy tool requires a bound agent session");
  });
});
