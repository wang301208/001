import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfigSnapshot, setRuntimeConfigSnapshot } from "../../config/config.js";
import { resolveStorePath } from "../../config/sessions.js";
import { CronService } from "../../cron/service.js";
import {
  createCronStoreHarness,
  createNoopLogger,
  installCronTestHooks,
} from "../../cron/service.test-harness.js";
import { markTaskTerminalById } from "../../tasks/task-registry.js";
import { createRuntimeAutonomy } from "./runtime-autonomy.js";
import {
  installRuntimeTaskDeliveryMock,
  resetRuntimeTaskTestState,
} from "./runtime-task-test-harness.js";
import { createRuntimeTaskFlow } from "./runtime-taskflow.js";

const cronLogger = createNoopLogger();
const { makeStorePath } = createCronStoreHarness({
  prefix: "openclaw-runtime-autonomy-",
});
installCronTestHooks({ logger: cronLogger });

function createAutonomyRuntime(options?: { cronService?: CronService; charterDir?: string }) {
  return createRuntimeAutonomy({
    legacyTaskFlow: createRuntimeTaskFlow(),
    ...(options?.cronService ? { cronService: options.cronService } : {}),
    ...(options?.charterDir ? { charterDir: options.charterDir } : {}),
  });
}

function createScopedRuntimeConfig(workspaceDir: string) {
  return {
    agents: {
      defaults: {
        workspace: workspaceDir,
      },
      list: [
        {
          id: "main",
          default: true,
        },
      ],
    },
  };
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

async function createCronService() {
  const { storePath } = await makeStorePath();
  const cron = new CronService({
    storePath,
    cronEnabled: true,
    log: cronLogger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
  });
  await cron.start();
  return cron;
}

async function createGovernanceGapCharterRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-runtime-autonomy-governance-"));
  const charterDir = path.join(root, "governance", "charter");
  await fs.mkdir(path.join(charterDir, "agents"), { recursive: true });
  await fs.mkdir(path.join(charterDir, "policies"), { recursive: true });
  await fs.writeFile(
    path.join(charterDir, "constitution.yaml"),
    [
      "version: 1",
      "charter_artifacts:",
      '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
      '  core_agents: ["governance/charter/agents/founder.yaml"]',
    ].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "sovereignty.yaml"),
    [
      "version: 1",
      "automatic_enforcement:",
      '  freeze_targets: ["evolution_layer_promotions"]',
    ].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "evolution-policy.yaml"),
    "version: 1\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "agents", "founder.yaml"),
    ["version: 1", "agent:", '  id: "founder"', '  title: "Founder"'].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "agents", "strategist.yaml"),
    ["version: 1", "agent:", '  id: "strategist"', '  title: "Strategist"'].join("\n"),
    "utf8",
  );
  return { root, charterDir };
}

async function createGovernedCapabilityCharterRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-runtime-autonomy-capability-"));
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

async function createAutonomyPipelineCharterRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-runtime-autonomy-pipeline-"));
  const charterDir = path.join(root, "governance", "charter");
  const workspaceDir = path.join(root, "workspace");
  await fs.mkdir(path.join(charterDir, "agents"), { recursive: true });
  await fs.mkdir(path.join(charterDir, "evolution"), { recursive: true });
  await fs.mkdir(path.join(charterDir, "policies"), { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });

  await fs.writeFile(
    path.join(charterDir, "constitution.yaml"),
    [
      "version: 1",
      "charter_artifacts:",
      '  policies: ["governance/charter/policies/sovereignty.yaml", "governance/charter/policies/evolution-policy.yaml"]',
      '  core_agents: ["governance/charter/agents/founder.yaml", "governance/charter/agents/strategist.yaml", "governance/charter/agents/algorithmist.yaml", "governance/charter/agents/librarian.yaml", "governance/charter/agents/sentinel.yaml", "governance/charter/agents/archaeologist.yaml", "governance/charter/agents/tdd_developer.yaml", "governance/charter/agents/qa.yaml", "governance/charter/agents/publisher.yaml", "governance/charter/agents/executor.yaml", "governance/charter/agents/sovereignty_auditor.yaml"]',
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "sovereignty.yaml"),
    ["version: 1", "reserved_authorities: {}", "automatic_enforcement: {}", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(charterDir, "policies", "evolution-policy.yaml"),
    ["version: 1", "promotion_pipeline: {}", ""].join("\n"),
    "utf8",
  );

  const blueprints = [
    { id: "founder", title: "Founder", layer: "evolution", hooks: ['"governance.proposals.*"'] },
    { id: "strategist", title: "Strategist", layer: "evolution", hooks: ['"autonomy.history"'] },
    {
      id: "algorithmist",
      title: "Algorithmist",
      layer: "evolution",
      hooks: [
        '"compaction runtime telemetry"',
        '"task scheduling telemetry"',
        '"qa-runner-runtime"',
      ],
    },
    { id: "librarian", title: "Librarian", layer: "capability", hooks: ['"skills"', '"plugins"'] },
    { id: "sentinel", title: "Sentinel", layer: "evolution", hooks: ['"runtime.telemetry"'] },
    {
      id: "archaeologist",
      title: "Archaeologist",
      layer: "evolution",
      hooks: ['"src/tasks/task-registry.ts"'],
    },
    {
      id: "tdd_developer",
      title: "TDD Developer",
      layer: "evolution",
      hooks: ['"skills"', '"plugins"'],
    },
    { id: "qa", title: "QA", layer: "evolution", hooks: ['"qa-runtime"'] },
    {
      id: "publisher",
      title: "Publisher",
      layer: "evolution",
      hooks: ['"capability/asset-registry.yaml"'],
    },
    {
      id: "executor",
      title: "Executor",
      layer: "execution",
      hooks: ['"src/tasks/task-registry.ts"', '"src/tasks/task-flow-registry.ts"'],
    },
    {
      id: "sovereignty_auditor",
      title: "Sovereignty Auditor",
      layer: "governance",
      hooks: ['"src/governance/control-plane.ts"', '"src/infra/audit-stream.ts"'],
    },
  ];
  for (const blueprint of blueprints) {
    await fs.writeFile(
      path.join(charterDir, "agents", `${blueprint.id}.yaml`),
      [
        "version: 1",
        "agent:",
        `  id: "${blueprint.id}"`,
        `  title: "${blueprint.title}"`,
        `  layer: "${blueprint.layer}"`,
        '  status: "active"',
        "mission:",
        `  primary: "Operate as ${blueprint.title}."`,
        "jurisdiction:",
        '  can_decide: ["observe", "plan", "deliver"]',
        '  cannot_decide: ["rewrite_constitution"]',
        "authority:",
        '  level: "high"',
        "  mutation_scope:",
        '    allow: ["skills", "plugins", "task_records", "flow_records"]',
        '    deny: ["constitution"]',
        "  network_scope:",
        '    default: "internal_only"',
        "    conditions: []",
        "  resource_budget:",
        '    tokens: "high"',
        '    parallelism: "high"',
        '    runtime: "continuous"',
        "required_counterparties:",
        '  works_with: ["librarian", "qa"]',
        '  reports_to: ["founder"]',
        "runtime_mapping:",
        "  intended_project_hooks:",
        ...blueprint.hooks.map((entry) => `    - ${entry}`),
        "",
      ].join("\n"),
      "utf8",
    );
  }

  await fs.writeFile(
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

  return { root, charterDir, workspaceDir };
}

afterEach(() => {
  clearRuntimeConfigSnapshot();
  resetRuntimeTaskTestState();
});

describe("runtime autonomy", () => {
  let tempStateDir: string | null = null;
  let previousStateDir: string | undefined;

  beforeEach(async () => {
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-runtime-autonomy-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    installRuntimeTaskDeliveryMock();
    setRuntimeConfigSnapshot({});
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    tempStateDir = null;
  });

  it("lists supported autonomy profiles in charter-defined order", () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:main",
    });

    expect(runtime.listProfiles().map((profile) => profile.id)).toEqual([
      "founder",
      "strategist",
      "algorithmist",
      "librarian",
      "sentinel",
      "archaeologist",
      "tdd_developer",
      "qa",
      "publisher",
      "executor",
      "sovereignty_auditor",
    ]);
  });

  it("returns founder profile with governance contract and bootstrap template", () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:main",
    });

    expect(runtime.getProfile("founder")).toMatchObject({
      id: "founder",
      layer: "evolution",
      contract: expect.objectContaining({
        agentId: "founder",
        charterDeclared: true,
        charterTitle: "Founder",
      }),
      bootstrap: expect.objectContaining({
        controllerId: "runtime.autonomy/founder",
        defaultCurrentStep: "scan-organization",
        recommendedGoals: expect.arrayContaining([
          expect.stringContaining("organization performance"),
        ]),
        seedTask: expect.objectContaining({
          label: "Organization evolution scan",
          runtime: "cli",
        }),
        loop: expect.objectContaining({
          mode: "managed-flow",
          sessionTarget: "isolated",
          wakeMode: "now",
        }),
      }),
    });
  });

  it("starts a managed autonomy flow with a governance-seeded task", () => {
    const workspaceDir = "/tmp/governed-workspace";
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:main",
    });

    const created = runtime.startManagedFlow({
      agentId: "librarian",
      goal: "Curate governed capability assets",
      currentStep: "index-and-link",
      workspaceDirs: [workspaceDir],
      stateJson: {
        lane: "registry",
        autonomy: {
          agentId: "tampered",
        },
      },
    });

    expect(created.profile).toMatchObject({
      id: "librarian",
      layer: "capability",
      contract: expect.objectContaining({
        agentId: "librarian",
        charterDeclared: true,
      }),
    });
    expect(created.flow).toMatchObject({
      ownerKey: "agent:main:main",
      status: "running",
      notifyPolicy: "state_changes",
      goal: "Curate governed capability assets",
      currentStep: "index-and-link",
      state: expect.objectContaining({
        lane: "registry",
        autonomy: expect.objectContaining({
          agentId: "librarian",
          controllerId: "runtime.autonomy/librarian",
          goal: "Curate governed capability assets",
          currentStep: "index-and-link",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
        }),
      }),
      taskSummary: expect.objectContaining({
        total: 1,
        active: 1,
        terminal: 0,
      }),
      tasks: [
        expect.objectContaining({
          agentId: "librarian",
          label: "Capability inventory audit",
          title: expect.stringContaining("Audit skill and plugin inventory"),
          status: "queued",
          governanceRuntime: expect.objectContaining({
            agentId: "librarian",
            summary: expect.objectContaining({
              charterDeclared: true,
              charterLayer: "capability",
            }),
          }),
        }),
      ],
    });
    expect(created.seedTask).toMatchObject({
      agentId: "librarian",
      label: "Capability inventory audit",
      governanceRuntime: expect.objectContaining({
        agentId: "librarian",
      }),
    });
    expect(created.flow.tasks[0]?.governanceRuntime?.agentId).toBe("librarian");
    expect((created.flow.state as { autonomy?: { agentId?: string } }).autonomy?.agentId).toBe(
      "librarian",
    );
    expect(created.seedTask?.title).toContain(`Workspace scope: ${workspaceDir}.`);
    expect(created.flow.tasks[0]?.title).toContain(`Workspace scope: ${workspaceDir}.`);
  });

  it("returns the latest managed flow snapshot for a profile", () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:autonomy-latest-test",
    });

    runtime.startManagedFlow({
      agentId: "founder",
      goal: "Old organization scan",
    });
    const started = runtime.startManagedFlow({
      agentId: "founder",
      goal: "Latest organization scan",
      currentStep: "review-structure",
      seedTask: false,
    });

    const latest = runtime.getLatestManagedFlowSnapshot("founder");

    expect(latest?.flow).toMatchObject({
      id: started.flow.id,
      goal: "Latest organization scan",
      currentStep: "review-structure",
      status: "running",
    });
    expect(latest?.seedTask).toBeUndefined();
  });

  it("synthesizes governance proposals through the founder and strategist runtime path", async () => {
    const { root, charterDir } = await createGovernanceGapCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:governance-runtime-test",
      });

      const synthesized = await runtime.synthesizeGovernanceProposals({
        agentIds: ["founder", "strategist"],
      });

      expect(synthesized).toMatchObject({
        requestedAgentIds: ["founder", "strategist"],
        eligibleAgentIds: ["founder", "strategist"],
        createdCount: 1,
        existingCount: 0,
        results: [
          expect.objectContaining({
            ruleId: "attach_sovereignty_auditor",
            status: "created",
            proposalStatus: "pending",
          }),
        ],
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("reconciles governance proposals through the founder and strategist runtime path", async () => {
    const { root, charterDir } = await createGovernanceGapCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:governance-runtime-reconcile-test",
      });

      const reconciled = await runtime.reconcileGovernanceProposals({
        agentIds: ["founder", "strategist"],
        mode: "force_apply_all",
        decisionNote: "Escalate all deterministic governance repairs.",
      });

      expect(reconciled).toMatchObject({
        requestedAgentIds: ["founder", "strategist"],
        eligibleAgentIds: ["founder", "strategist"],
        mode: "force_apply_all",
        reviewedCount: 0,
        appliedCount: 0,
        entries: [
          expect.objectContaining({
            ruleId: "attach_sovereignty_auditor",
            proposalStatusBefore: "pending",
            requiresHumanSovereignApproval: true,
            autoApproved: false,
            autoApplied: false,
          }),
        ],
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("synthesizes and dedupes capability asset registry proposals when workspace scope is explicit", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:librarian-governance-runtime-test",
      });

      const first = await runtime.synthesizeGovernanceProposals({
        agentIds: ["librarian"],
        workspaceDirs: [workspaceDir],
      });
      expect(first).toMatchObject({
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        createdCount: 1,
        existingCount: 0,
        results: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "created",
            proposalStatus: "pending",
          }),
        ],
      });
      expect(first.results[0]?.operations[0]?.content).toContain("demo-skill");

      const second = await runtime.synthesizeGovernanceProposals({
        agentIds: ["librarian"],
        workspaceDirs: [workspaceDir],
      });
      expect(second).toMatchObject({
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        createdCount: 0,
        existingCount: 1,
        results: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "existing",
            proposalStatus: "pending",
          }),
        ],
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("infers scoped workspace dirs for librarian capability runtime calls", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      setRuntimeConfigSnapshot(createScopedRuntimeConfig(workspaceDir));
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:librarian:main",
      });

      const inventory = await runtime.getCapabilityInventory({
        agentIds: ["librarian"],
      });
      expect(inventory.workspaceDirs).toEqual([workspaceDir]);
      expect(
        inventory.entries.some(
          (entry) => entry.kind === "skill" && entry.id.includes("demo-skill"),
        ),
      ).toBe(true);

      const proposals = await runtime.synthesizeGovernanceProposals({
        agentIds: ["librarian"],
      });
      expect(proposals).toMatchObject({
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        createdCount: 1,
        existingCount: 0,
        results: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "created",
            proposalStatus: "pending",
          }),
        ],
      });
      expect(proposals.results[0]?.operations[0]?.content).toContain("demo-skill");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("infers scoped workspace dirs from spawned session workspace bindings", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      await writeSessionWorkspaceBinding({
        agentId: "librarian",
        sessionKey: "agent:librarian:project-thread",
        workspaceDir,
      });
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:librarian:project-thread",
      });

      const inventory = await runtime.getCapabilityInventory({
        agentIds: ["librarian"],
      });
      expect(inventory.workspaceDirs).toEqual([workspaceDir]);
      expect(
        inventory.entries.some(
          (entry) => entry.kind === "skill" && entry.id.includes("demo-skill"),
        ),
      ).toBe(true);

      const proposals = await runtime.synthesizeGovernanceProposals({
        agentIds: ["librarian"],
      });
      expect(proposals).toMatchObject({
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        createdCount: 1,
        existingCount: 0,
        results: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "created",
            proposalStatus: "pending",
          }),
        ],
      });
      expect(proposals.results[0]?.operations[0]?.content).toContain("demo-skill");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("inherits scoped workspace dirs from tool context bindings", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).fromToolContext({
        sessionKey: "agent:librarian:tool-context",
        workspaceDir,
      });

      const inventory = await runtime.getCapabilityInventory({
        agentIds: ["librarian"],
      });
      expect(inventory.workspaceDirs).toEqual([workspaceDir]);
      expect(
        inventory.entries.some(
          (entry) => entry.kind === "skill" && entry.id.includes("demo-skill"),
        ),
      ).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("propagates inferred workspace scope through healFleet governance synthesis", async () => {
    const { root, charterDir, workspaceDir } = await createGovernedCapabilityCharterRoot();
    try {
      setRuntimeConfigSnapshot(createScopedRuntimeConfig(workspaceDir));
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:main",
      });

      const healed = await runtime.healFleet({
        agentIds: ["librarian"],
        restartBlockedFlows: false,
      });

      expect(healed.governanceProposals).toMatchObject({
        requestedAgentIds: ["librarian"],
        eligibleAgentIds: ["librarian"],
        createdCount: 1,
        existingCount: 0,
        results: [
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            status: "created",
            proposalStatus: "pending",
          }),
        ],
      });
      expect(healed.governanceProposals?.results[0]?.operations[0]?.content).toContain(
        "demo-skill",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("scopes capability inventory and genesis planning through the runtime surface", async () => {
    const { root, charterDir } = await createGovernanceGapCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:capability-runtime-test",
      });

      const inventory = await runtime.getCapabilityInventory({
        agentIds: ["founder"],
      });
      expect(inventory.requestedAgentIds).toEqual(["founder"]);
      expect(inventory.entries.some((entry) => entry.id === "agent_blueprint:founder")).toBe(true);
      expect(inventory.entries.some((entry) => entry.id === "agent_blueprint:strategist")).toBe(
        false,
      );
      expect(inventory.gaps.map((entry) => entry.id)).toContain(
        "capability_inventory.genesis_team_missing",
      );

      const plan = await runtime.planGenesisWork({
        agentIds: ["founder"],
      });
      expect(plan.workspaceDirs).toEqual(inventory.workspaceDirs);
      expect(plan.primaryWorkspaceDir).toBe(inventory.workspaceDirs[0]);
      expect(plan.requestedAgentIds).toEqual(["founder"]);
      expect(plan.focusGapIds).toContain("capability_inventory.genesis_team_missing");
      expect(plan.blockers).toContain("missing team blueprint: genesis_team");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("heals genesis stage roles into structured managed flows when capability gaps exist", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:genesis-pipeline-runtime-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["sentinel", "qa", "librarian"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });

      expect(healed.totals).toMatchObject({
        totalProfiles: 3,
        changed: 3,
        flowStarted: 3,
      });
      expect(healed.entries.map((entry) => entry.agentId)).toEqual(["sentinel", "qa", "librarian"]);
      for (const entry of healed.entries) {
        expect(entry.flowAction).toBe("started");
        expect(entry.startedFlow).toMatchObject({
          currentStep: expect.stringMatching(/^genesis\./),
          managedAutonomy: expect.objectContaining({
            agentId: entry.agentId,
            project: expect.objectContaining({
              kind: "genesis_stage",
            }),
          }),
          state: {
            autonomy: {
              project: expect.objectContaining({
                kind: "genesis_stage",
                teamId: "genesis_team",
                sandboxUniverse: expect.objectContaining({
                  target: expect.objectContaining({
                    teamId: "genesis_team",
                  }),
                }),
                sandboxController: expect.objectContaining({
                  activeStageId: "sandbox_validation",
                }),
                sandboxReplayRunner: expect.objectContaining({
                  status: "ready",
                }),
                developmentPackage: expect.objectContaining({
                  candidateKinds: expect.arrayContaining([
                    "skill",
                    "plugin",
                    "strategy",
                    "algorithm",
                  ]),
                  qaGates: expect.arrayContaining([
                    "functional_pass",
                    "sandbox_replay_pass",
                    "audit_trace_present",
                  ]),
                  promotionEvidence: expect.arrayContaining([
                    "candidate_asset",
                    "qa_report",
                    "rollback_reference",
                  ]),
                  publishTargets: expect.arrayContaining([
                    "governance/charter/capability/asset-registry.yaml",
                  ]),
                }),
              }),
            },
          },
        });
        expect(entry.startedFlow?.tasks.length ?? 0).toBeGreaterThan(0);
      }
      expect(
        healed.entries
          .find((entry) => entry.agentId === "sentinel")
          ?.startedFlow?.tasks.map((task) => task.label),
      ).toContain("Sentinel Detection");
      expect(
        healed.entries
          .find((entry) => entry.agentId === "qa")
          ?.startedFlow?.tasks.map((task) => task.label),
      ).toContain("QA Replay");
      expect(
        healed.entries
          .find((entry) => entry.agentId === "librarian")
          ?.startedFlow?.tasks.map((task) => task.label),
      ).toContain("Librarian Registration");
      expect(
        healed.entries
          .find((entry) => entry.agentId === "librarian")
          ?.startedFlow?.tasks.map((task) => task.label),
      ).toContain("Development package");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("upgrades old Genesis managed flows that do not carry development packages", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const controlRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:genesis-package-upgrade-test",
      });
      const agentRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:sentinel:main",
      });

      const legacy = agentRuntime.startManagedFlow({
        agentId: "sentinel",
        workspaceDirs: [workspaceDir],
        stateJson: {
          autonomy: {
            project: {
              kind: "genesis_stage",
              teamId: "genesis_team",
              mode: "build",
              stage: {
                id: "genesis.gap_detection",
                title: "Sentinel Detection",
                ownerAgentId: "sentinel",
                status: "ready",
                goal: "Legacy Genesis flow without development package.",
                dependsOn: [],
                inputRefs: [],
                outputRefs: ["gap_signal"],
                actions: ["detect gaps"],
              },
              focusGapIds: [],
              blockers: [],
              stageGraph: [],
              sandboxUniverse: {
                universeId: "legacy",
                target: {
                  kind: "capability",
                  id: "legacy",
                  teamId: "genesis_team",
                  focusGapIds: [],
                },
                stages: [],
                promotionGate: {
                  freezeActive: false,
                  blockers: [],
                  requiredEvidence: [],
                  canPromote: true,
                },
              },
            },
          },
        },
      });
      await controlRuntime.upsertLoopJob({
        agentId: "sentinel",
        workspaceDirs: [workspaceDir],
      });

      const before = await controlRuntime.getFleetStatus({
        agentIds: ["sentinel"],
        workspaceDirs: [workspaceDir],
      });
      expect(before.entries[0]).toMatchObject({
        health: "drift",
        driftReasons: expect.arrayContaining([
          "latest Genesis managed flow is missing development package",
        ]),
      });

      const healed = await controlRuntime.healFleet({
        agentIds: ["sentinel"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });

      expect(healed.entries[0]).toMatchObject({
        flowAction: "restarted",
        cancelledFlowBeforeRestart: expect.objectContaining({
          id: legacy.flow.id,
        }),
        startedFlow: expect.objectContaining({
          managedAutonomy: expect.objectContaining({
            project: expect.objectContaining({
              kind: "genesis_stage",
              developmentPackage: expect.objectContaining({
                candidateKinds: expect.arrayContaining(["skill", "plugin", "algorithm"]),
                qaGates: expect.arrayContaining(["sandbox_replay_pass"]),
              }),
            }),
          }),
        }),
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("heals executor into a structured execution system with capability escalation", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:executor-pipeline-runtime-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["executor"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });

      expect(healed.totals).toMatchObject({
        totalProfiles: 1,
        changed: 1,
        flowStarted: 1,
      });
      const executorEntry = healed.entries[0];
      expect(executorEntry?.agentId).toBe("executor");
      expect(executorEntry?.startedFlow).toMatchObject({
        currentStep: "execution.goal_intake",
        managedExecution: expect.objectContaining({
          kind: "execution_system",
          capabilityRequest: expect.objectContaining({
            handoffTeamId: "genesis_team",
          }),
        }),
        state: {
          autonomy: {
            project: expect.objectContaining({
              kind: "execution_system",
              capabilityRequest: expect.objectContaining({
                handoffTeamId: "genesis_team",
              }),
              sandboxUniverse: expect.objectContaining({
                target: expect.objectContaining({
                  teamId: "genesis_team",
                }),
              }),
              sandboxController: expect.objectContaining({
                activeStageId: "sandbox_validation",
              }),
              sandboxReplayRunner: expect.objectContaining({
                status: "ready",
              }),
            }),
          },
        },
      });
      expect(executorEntry?.startedFlow?.tasks.map((task) => task.label)).toEqual(
        expect.arrayContaining([
          "Goal intake",
          "Task graph synthesis",
          "Capability selection and dispatch",
          "Capability escalation",
          "Delivery and recovery",
        ]),
      );
      expect(executorEntry?.startedSeedTask).toMatchObject({
        label: "Goal intake",
      });
      expect(executorEntry?.startedFlow?.taskSummary.total).toBeGreaterThanOrEqual(5);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("heals algorithmist into a structured algorithm research system", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:algorithmist-pipeline-runtime-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });

      expect(healed.totals).toMatchObject({
        totalProfiles: 1,
        changed: 1,
        flowStarted: 1,
      });
      const algorithmistEntry = healed.entries[0];
      expect(algorithmistEntry?.agentId).toBe("algorithmist");
      expect(algorithmistEntry?.startedFlow).toMatchObject({
        currentStep: "algorithm.signal_review",
        managedAutonomy: expect.objectContaining({
          agentId: "algorithmist",
          project: expect.objectContaining({
            kind: "algorithm_research",
            inventorySummary: expect.objectContaining({
              algorithmCount: expect.any(Number),
            }),
            researchPlan: expect.objectContaining({
              targetDomains: expect.arrayContaining(["retrieval", "task_scheduling"]),
            }),
            sandboxUniverse: expect.objectContaining({
              target: expect.objectContaining({
                kind: "algorithm",
              }),
            }),
          }),
        }),
        state: {
          autonomy: {
            project: expect.objectContaining({
              kind: "algorithm_research",
              sandboxController: expect.objectContaining({
                activeStageId: "sandbox_validation",
              }),
              sandboxReplayRunner: expect.objectContaining({
                status: "ready",
              }),
            }),
          },
        },
      });
      expect(algorithmistEntry?.startedFlow?.tasks.map((task) => task.label)).toEqual(
        expect.arrayContaining([
          "Benchmark review",
          "Hypothesis generation",
          "Replay and validation plan",
          "Promotion dossier",
        ]),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("submits a passed sandbox replay and closes the managed flow", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const controlRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:algorithmist-replay-pass-test",
      });

      const healed = await controlRuntime.healFleet({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });
      const flowId = healed.entries[0]?.startedFlow?.id;
      expect(flowId).toBeTruthy();

      const agentRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:algorithmist:main",
      });
      const submitted = await agentRuntime.submitSandboxReplay({
        agentId: "algorithmist",
        flowId,
        replayPassed: true,
        qaPassed: true,
      });

      expect(submitted).toMatchObject({
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
          flow: expect.objectContaining({
            status: "succeeded",
            currentStep: "algorithm.promotion_complete",
            managedAutonomy: expect.objectContaining({
              project: expect.objectContaining({
                kind: "algorithm_research",
                sandboxReplayRunner: expect.objectContaining({
                  status: "passed",
                }),
              }),
            }),
          }),
        },
      });

      expect(agentRuntime.getLatestManagedFlowSnapshot("algorithmist")?.flow.status).toBe(
        "succeeded",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("submits a failed sandbox replay and marks the managed flow failed", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const controlRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:executor-replay-fail-test",
      });

      const healed = await controlRuntime.healFleet({
        agentIds: ["executor"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });
      const flowId = healed.entries[0]?.startedFlow?.id;
      expect(flowId).toBeTruthy();

      const agentRuntime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:executor:main",
      });
      const submitted = await agentRuntime.submitSandboxReplay({
        agentId: "executor",
        flowId,
        replayPassed: false,
        qaPassed: false,
        auditPassed: false,
      });

      expect(submitted).toMatchObject({
        targetFlowId: flowId,
        outcome: {
          found: true,
          applied: true,
          decision: expect.objectContaining({
            canPromote: false,
          }),
          sandboxReplayRunner: expect.objectContaining({
            status: "failed",
            lastRun: expect.objectContaining({
              replayPassed: false,
              qaPassed: false,
              auditPassed: false,
              canPromote: false,
            }),
          }),
          flow: expect.objectContaining({
            status: "failed",
            currentStep: "execution.sandbox_validation",
            managedExecution: expect.objectContaining({
              sandboxReplayRunner: expect.objectContaining({
                status: "failed",
              }),
            }),
          }),
        },
      });

      expect(agentRuntime.getLatestManagedFlowSnapshot("executor")?.flow.status).toBe("failed");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("auto-submits a passed sandbox replay when all managed flow tasks finish successfully", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:algorithmist-auto-pass-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });
      const startedFlow = healed.entries[0]?.startedFlow;
      expect(startedFlow?.id).toBeTruthy();
      expect(startedFlow?.tasks.length).toBeGreaterThan(0);

      for (const task of startedFlow?.tasks ?? []) {
        markTaskTerminalById({
          taskId: task.id,
          status: "succeeded",
          endedAt: Date.now(),
          terminalSummary: `${task.label ?? task.title} finished successfully.`,
        });
      }

      const fleet = await runtime.getFleetStatus({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
      });
      const flow = fleet.entries[0]?.latestFlow;
      expect(flow).toMatchObject({
        id: startedFlow?.id,
        status: "succeeded",
        currentStep: "algorithm.promotion_complete",
        managedAutonomy: expect.objectContaining({
          project: expect.objectContaining({
            kind: "algorithm_research",
            sandboxReplayRunner: expect.objectContaining({
              status: "passed",
              lastRun: expect.objectContaining({
                replayPassed: true,
                qaPassed: true,
                auditPassed: true,
                canPromote: true,
              }),
            }),
          }),
        }),
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("auto-submits a failed sandbox replay when managed flow tasks end with a rejection", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:executor-auto-fail-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["executor"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });
      const startedFlow = healed.entries[0]?.startedFlow;
      expect(startedFlow?.id).toBeTruthy();
      expect(startedFlow?.tasks.length).toBeGreaterThan(0);

      const [firstTask, ...remainingTasks] = startedFlow?.tasks ?? [];
      expect(firstTask?.id).toBeTruthy();
      markTaskTerminalById({
        taskId: firstTask!.id,
        status: "failed",
        endedAt: Date.now(),
        error: `${firstTask?.label ?? firstTask?.title} failed validation.`,
      });
      for (const task of remainingTasks) {
        markTaskTerminalById({
          taskId: task.id,
          status: "succeeded",
          endedAt: Date.now(),
          terminalSummary: `${task.label ?? task.title} finished successfully.`,
        });
      }

      const fleet = await runtime.getFleetStatus({
        agentIds: ["executor"],
        workspaceDirs: [workspaceDir],
      });
      const flow = fleet.entries[0]?.latestFlow;
      expect(flow).toMatchObject({
        id: startedFlow?.id,
        status: "failed",
        currentStep: "execution.sandbox_validation",
        managedExecution: expect.objectContaining({
          sandboxReplayRunner: expect.objectContaining({
            status: "failed",
            lastRun: expect.objectContaining({
              replayPassed: false,
              qaPassed: false,
              auditPassed: false,
              canPromote: false,
            }),
          }),
        }),
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("does not auto-submit sandbox replay before all managed flow tasks are terminal", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:algorithmist-auto-defer-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });
      const startedFlow = healed.entries[0]?.startedFlow;
      const firstTask = startedFlow?.tasks[0];
      expect(firstTask?.id).toBeTruthy();

      markTaskTerminalById({
        taskId: firstTask!.id,
        status: "succeeded",
        endedAt: Date.now(),
        terminalSummary: `${firstTask?.label ?? firstTask?.title} finished successfully.`,
      });

      const fleet = await runtime.getFleetStatus({
        agentIds: ["algorithmist"],
        workspaceDirs: [workspaceDir],
      });
      const flow = fleet.entries[0]?.latestFlow;
      expect(flow).toMatchObject({
        id: startedFlow?.id,
        status: "running",
        currentStep: "algorithm.signal_review",
        managedAutonomy: expect.objectContaining({
          project: expect.objectContaining({
            kind: "algorithm_research",
            sandboxReplayRunner: expect.objectContaining({
              status: "ready",
            }),
          }),
        }),
      });
      const algorithmResearchProject =
        flow?.managedAutonomy?.project?.kind === "algorithm_research"
          ? flow.managedAutonomy.project
          : undefined;
      expect(algorithmResearchProject?.sandboxReplayRunner?.lastRun).toBeUndefined();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("heals sovereignty auditor into a structured sovereignty watch system", async () => {
    const { root, charterDir, workspaceDir } = await createAutonomyPipelineCharterRoot();
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:sovereignty-auditor-pipeline-runtime-test",
      });

      const healed = await runtime.healFleet({
        agentIds: ["sovereignty_auditor"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
        recordHistory: false,
      });

      expect(healed.totals).toMatchObject({
        totalProfiles: 1,
        changed: 1,
        flowStarted: 1,
      });
      const auditorEntry = healed.entries[0];
      expect(auditorEntry?.agentId).toBe("sovereignty_auditor");
      expect(auditorEntry?.startedFlow).toMatchObject({
        currentStep: "sovereignty.audit_snapshot",
        managedAutonomy: expect.objectContaining({
          agentId: "sovereignty_auditor",
          project: expect.objectContaining({
            kind: "sovereignty_watch",
            governanceOverview: expect.objectContaining({
              proposalPendingCount: expect.any(Number),
            }),
            watchPlan: expect.objectContaining({
              reservedAuthorities: expect.any(Array),
            }),
          }),
        }),
        state: {
          autonomy: {
            project: expect.objectContaining({
              kind: "sovereignty_watch",
            }),
          },
        },
      });
      expect(auditorEntry?.startedFlow?.tasks.map((task) => task.label)).toEqual(
        expect.arrayContaining([
          "Audit snapshot",
          "Boundary drift triage",
          "Freeze or clearance decision",
        ]),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("runs a supervisor pass that heals, reconciles governance, and refreshes capability planning", async () => {
    const { root, charterDir } = await createGovernanceGapCharterRoot();
    const workspaceDir = "/tmp/autonomy-supervisor-workspace";
    try {
      const runtime = createAutonomyRuntime({
        charterDir,
      }).bindSession({
        sessionKey: "agent:main:supervisor-runtime-test",
      });

      const supervised = await runtime.superviseFleet({
        agentIds: ["founder", "strategist"],
        workspaceDirs: [workspaceDir],
        governanceMode: "force_apply_all",
        decisionNote: "Escalate deterministic governance repairs during supervisor pass.",
        telemetrySource: "manual",
      });

      expect(supervised.governanceMode).toBe("force_apply_all");
      expect(supervised.overviewBefore.totals.totalProfiles).toBe(2);
      expect(supervised.healed.totals).toMatchObject({
        totalProfiles: 2,
        changed: 2,
        loopCreated: 2,
        flowStarted: 2,
      });
      expect(supervised.governanceReconciled).toMatchObject({
        requestedAgentIds: ["founder", "strategist"],
        eligibleAgentIds: ["founder", "strategist"],
        mode: "force_apply_all",
      });
      expect(supervised.governanceReconciled?.appliedCount).toBeGreaterThanOrEqual(1);
      expect(supervised.governanceReconciled?.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "attach_sovereignty_auditor",
            proposalStatusBefore: "pending",
            requiresHumanSovereignApproval: true,
            autoApproved: false,
            autoApplied: false,
          }),
          expect.objectContaining({
            ruleId: "bootstrap_capability_asset_registry",
            proposalStatusAfter: "applied",
            autoApproved: true,
            autoApplied: true,
          }),
        ]),
      );
      expect(supervised.capabilityInventory?.requestedAgentIds).toEqual(["founder", "strategist"]);
      expect(supervised.genesisPlan?.requestedAgentIds).toEqual(["founder", "strategist"]);
      expect(supervised.overviewAfter.totals).toMatchObject({
        totalProfiles: 2,
        healthy: 2,
        drift: 0,
        missingLoop: 0,
        activeFlows: 2,
      });
      expect(supervised.summary).toMatchObject({
        totalProfiles: 2,
        changedProfiles: 2,
        healthyProfiles: 2,
        driftProfiles: 0,
        missingLoopProfiles: 0,
        activeFlows: 2,
      });
      expect(supervised.summary.governanceAppliedCount).toBeGreaterThanOrEqual(1);
      expect(supervised.summary.recommendedNextActions.length).toBeGreaterThan(0);
      const history = await runtime.getFleetHistory({
        mode: "heal",
        source: "manual",
      });
      expect(history.events).toEqual([
        expect.objectContaining({
          mode: "heal",
          source: "manual",
          agentIds: ["founder", "strategist"],
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
        }),
      ]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("bootstraps the autonomy fleet and returns an explicit readiness verdict", async () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:bootstrap-runtime-test",
    });

    const bootstrapped = await runtime.bootstrapFleet({
      agentIds: ["founder", "strategist"],
      governanceMode: "none",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
      restartBlockedFlows: false,
    });

    expect(bootstrapped.sessionKey).toBe("agent:main:bootstrap-runtime-test");
    expect(bootstrapped.supervised.summary).toMatchObject({
      totalProfiles: 2,
      changedProfiles: 2,
      healthyProfiles: 2,
      driftProfiles: 0,
      missingLoopProfiles: 0,
      activeFlows: 2,
    });
    expect(bootstrapped.readiness).toEqual({
      ready: true,
      profileReadyCount: 2,
      profileNotReadyCount: 0,
      missingLoopProfiles: 0,
      driftProfiles: 0,
      idleProfiles: 0,
      activeFlows: 2,
      capabilityGapCount: expect.any(Number),
      criticalCapabilityGapCount: 0,
      genesisBlockedStageCount: 0,
      blockers: [],
    });
  });

  it("evaluates strong-autonomy architecture readiness across layers and loops", async () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:architecture-readiness-test",
    });

    const readiness = await runtime.getArchitectureReadiness({
      governanceMode: "none",
      includeCapabilityInventory: true,
      includeGenesisPlan: true,
      recordHistory: false,
      restartBlockedFlows: false,
    });

    expect(readiness.sessionKey).toBe("agent:main:architecture-readiness-test");
    expect(readiness.summary.totalChecks).toBe(13);
    expect(readiness.layers.map((entry) => entry.id)).toEqual([
      "governance",
      "evolution",
      "capability",
      "execution",
      "api_communication",
      "interaction",
    ]);
    expect(readiness.loops.map((entry) => entry.id)).toEqual(["value", "maintenance", "evolution"]);
    expect(readiness.sandboxUniverse.id).toBe("sandbox_universe");
    expect(readiness.algorithmEvolutionProtocol.id).toBe("algorithm_evolution_protocol");
    expect(readiness.autonomousDevelopment.id).toBe("autonomous_development");
    expect(readiness.autonomousDevelopment.status).toBe("ready");
    expect(readiness.autonomousDevelopment.evidence).toEqual(
      expect.arrayContaining([expect.stringContaining("developmentPackages=")]),
    );
    expect(readiness.continuousRuntime.id).toBe("continuous_runtime");
    expect(readiness.bootstrapped.readiness.ready).toBe(true);
    expect(readiness.summary.readyChecks).toBeGreaterThan(0);
  });

  it("persists autonomy maintenance history and supports filtering", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/history-workspace";

    try {
      const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
        sessionKey: "agent:main:main",
      });

      await runtime.reconcileLoopJobs({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        telemetrySource: "startup",
      });
      await runtime.healFleet({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        telemetrySource: "manual",
      });

      const history = await runtime.getFleetHistory({});
      const healEvent = history.events.find((event) => event.mode === "heal");
      const reconcileEvent = history.events.find((event) => event.mode === "reconcile");

      expect(history.total).toBe(2);
      expect(healEvent).toMatchObject({
        source: "manual",
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        primaryWorkspaceDir: workspaceDir,
        entries: [expect.objectContaining({ agentId: "founder", workspaceDirs: [workspaceDir] })],
      });
      expect(reconcileEvent).toMatchObject({
        source: "startup",
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        primaryWorkspaceDir: workspaceDir,
        entries: [
          expect.objectContaining({
            agentId: "founder",
            loopAction: expect.stringMatching(/created|updated/),
            workspaceDirs: [workspaceDir],
          }),
        ],
      });

      const filtered = await runtime.getFleetHistory({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        mode: "reconcile",
        source: "startup",
        limit: 1,
      });
      expect(filtered).toMatchObject({
        total: 1,
        truncated: false,
        events: [
          expect.objectContaining({
            mode: "reconcile",
            source: "startup",
          }),
        ],
      });
      await expect(
        runtime.getFleetHistory({
          workspaceDirs: ["/tmp/non-matching-workspace"],
        }),
      ).resolves.toMatchObject({
        total: 0,
        events: [],
      });
    } finally {
      cron.stop();
    }
  });

  it("cancels the latest managed autonomy flow for a profile", async () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:autonomy-cancel-test",
    });

    const started = runtime.startManagedFlow({
      agentId: "founder",
      goal: "Cancel the current autonomy scan",
      currentStep: "scan-organization",
    });

    const cancelled = await runtime.cancelManagedFlow({
      agentId: "founder",
    });

    expect(cancelled).toMatchObject({
      profile: {
        id: "founder",
      },
      targetFlowId: started.flow.id,
      outcome: {
        found: true,
        cancelled: true,
        flow: expect.objectContaining({
          id: started.flow.id,
          status: "cancelled",
        }),
      },
    });
    expect(cancelled.outcome.seedTask).toMatchObject({
      agentId: "founder",
      status: "cancelled",
    });
  });

  it("upserts, shows, lists, and removes autonomy loop jobs", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/founder-loop-workspace";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });

    try {
      const upserted = await runtime.upsertLoopJob({
        agentId: "founder",
        everyMs: 3_600_000,
        workspaceDirs: [workspaceDir],
      });

      expect(upserted).toMatchObject({
        profile: {
          id: "founder",
        },
        created: true,
        updated: false,
        loop: {
          agentId: "founder",
          mode: "managed-flow",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          job: expect.objectContaining({
            agentId: "founder",
            sessionKey: "agent:founder:main",
            sessionTarget: "isolated",
            wakeMode: "now",
            schedule: expect.objectContaining({
              kind: "every",
              everyMs: 3_600_000,
            }),
            payload: expect.objectContaining({
              kind: "agentTurn",
            }),
          }),
        },
      });
      expect(upserted.loop.job.payload.kind).toBe("agentTurn");
      if (upserted.loop.job.payload.kind !== "agentTurn") {
        throw new Error("expected agentTurn cron payload");
      }
      expect(upserted.loop.job.payload.message).toContain("[[autonomy-loop:founder]]");
      expect(upserted.loop.job.payload.message).toContain(`Workspace scope: ${workspaceDir}.`);

      const shown = await runtime.showLoopJob({
        agentId: "founder",
      });
      expect(shown).toMatchObject({
        profile: {
          id: "founder",
        },
        loop: {
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          job: expect.objectContaining({
            id: upserted.loop.job.id,
          }),
        },
      });

      const listed = await runtime.listLoopJobs();
      expect(listed).toEqual([
        expect.objectContaining({
          agentId: "founder",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          job: expect.objectContaining({
            id: upserted.loop.job.id,
          }),
        }),
      ]);

      const removed = await runtime.removeLoopJob({
        agentId: "founder",
      });
      expect(removed).toMatchObject({
        profile: {
          id: "founder",
        },
        targetJobId: upserted.loop.job.id,
        removed: true,
        removedJobIds: [upserted.loop.job.id],
      });

      await expect(runtime.getLoopJob("founder")).resolves.toBeUndefined();
    } finally {
      cron.stop();
    }
  });

  it("reconciles duplicate autonomy loop jobs down to one managed loop", async () => {
    const cron = await createCronService();
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });

    try {
      const first = await runtime.upsertLoopJob({
        agentId: "strategist",
        everyMs: 10_800_000,
      });

      const duplicate = await cron.add({
        name: "Autonomy Loop: Strategist duplicate",
        description: "[[autonomy-loop:strategist]] duplicate",
        agentId: "strategist",
        sessionKey: "agent:strategist:main",
        enabled: true,
        schedule: { kind: "every", everyMs: 10_800_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: {
          kind: "agentTurn",
          message: "[[autonomy-loop:strategist]] duplicate",
        },
      });

      const upserted = await runtime.upsertLoopJob({
        agentId: "strategist",
      });
      const keptJobId = upserted.loop.job.id;
      const removedJobId = keptJobId === first.loop.job.id ? duplicate.id : first.loop.job.id;

      expect(upserted.updated).toBe(true);
      expect(upserted.created).toBe(false);
      expect([first.loop.job.id, duplicate.id]).toContain(keptJobId);
      expect(upserted.reconciledRemovedJobIds).toContain(removedJobId);

      const strategistJobs = await runtime.listLoopJobs();
      expect(
        strategistJobs.filter((job) => job.agentId === "strategist").map((job) => job.job.id),
      ).toEqual([keptJobId]);
    } finally {
      cron.stop();
    }
  });

  it("reconciles the requested managed loop set and preserves existing loop cadence", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/reconcile-workspace";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });

    try {
      const founder = await runtime.upsertLoopJob({
        agentId: "founder",
        everyMs: 5_400_000,
        workspaceDirs: [workspaceDir],
      });

      const reconciled = await runtime.reconcileLoopJobs({
        agentIds: ["founder", "strategist"],
        workspaceDirs: [workspaceDir],
      });

      expect(reconciled).toMatchObject({
        createdCount: 1,
        updatedCount: 1,
        reconciled: [
          expect.objectContaining({
            profile: expect.objectContaining({ id: "founder" }),
            updated: true,
            loop: expect.objectContaining({
              workspaceDirs: [workspaceDir],
              primaryWorkspaceDir: workspaceDir,
              job: expect.objectContaining({
                id: founder.loop.job.id,
                schedule: expect.objectContaining({
                  kind: "every",
                  everyMs: 5_400_000,
                }),
              }),
            }),
          }),
          expect.objectContaining({
            profile: expect.objectContaining({ id: "strategist" }),
            created: true,
            loop: expect.objectContaining({
              workspaceDirs: [workspaceDir],
              primaryWorkspaceDir: workspaceDir,
            }),
          }),
        ],
      });
    } finally {
      cron.stop();
    }
  });

  it("heals managed loop cadence drift back to the profile template", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/heal-cadence-workspace";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });

    try {
      await runtime.upsertLoopJob({
        agentId: "founder",
        everyMs: 3_600_000,
        workspaceDirs: [workspaceDir],
      });

      const before = await runtime.getFleetStatus({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
      });
      expect(before.entries[0]).toMatchObject({
        agentId: "founder",
        health: "drift",
        actualLoopEveryMs: 3_600_000,
        expectedLoopEveryMs: 21_600_000,
      });

      const healed = await runtime.healFleet({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        recordHistory: false,
        synthesizeGovernanceProposals: false,
      });

      expect(healed.entries[0]).toMatchObject({
        agentId: "founder",
        loopAction: "updated",
        healthBefore: "drift",
        healthAfter: "healthy",
        loopAfter: expect.objectContaining({
          job: expect.objectContaining({
            schedule: expect.objectContaining({
              kind: "every",
              everyMs: 21_600_000,
            }),
          }),
        }),
      });
    } finally {
      cron.stop();
    }
  });

  it("builds fleet-wide autonomy status with health and drift signals", async () => {
    const cron = await createCronService();
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });
    const founderRuntime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:founder:main",
    });

    try {
      await runtime.upsertLoopJob({
        agentId: "founder",
      });
      founderRuntime.startManagedFlow({
        agentId: "founder",
        goal: "Scan organization posture",
      });

      await runtime.upsertLoopJob({
        agentId: "strategist",
        everyMs: 60 * 60 * 1000,
      });

      const fleet = await runtime.getFleetStatus({});

      expect(fleet.totals).toEqual({
        totalProfiles: 11,
        healthy: 1,
        idle: 0,
        drift: 1,
        missingLoop: 9,
        activeFlows: 1,
      });
      expect(fleet.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agentId: "founder",
            health: "healthy",
            hasActiveFlow: true,
            suggestedAction: "observe",
            loopCadenceAligned: true,
          }),
          expect.objectContaining({
            agentId: "strategist",
            health: "drift",
            hasActiveFlow: false,
            suggestedAction: "reconcile_loop",
            loopCadenceAligned: false,
            driftReasons: expect.arrayContaining([expect.stringContaining("cadence drifted")]),
          }),
          expect.objectContaining({
            agentId: "executor",
            health: "missing_loop",
            hasActiveFlow: false,
            suggestedAction: "reconcile_loop",
            driftReasons: expect.arrayContaining(["managed loop missing"]),
          }),
        ]),
      );
    } finally {
      cron.stop();
    }
  });

  it("filters fleet-wide autonomy status to the requested workspace scope", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/fleet-scope-a";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });
    const founderRuntime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:founder:main",
    });

    try {
      await runtime.upsertLoopJob({
        agentId: "founder",
        workspaceDirs: [workspaceDir],
      });
      founderRuntime.startManagedFlow({
        agentId: "founder",
        goal: "Scan organization posture",
        workspaceDirs: [workspaceDir],
      });

      await runtime.upsertLoopJob({
        agentId: "strategist",
        everyMs: 60 * 60 * 1000,
        workspaceDirs: ["/tmp/fleet-scope-b"],
      });

      const fleet = await runtime.getFleetStatus({
        workspaceDirs: [workspaceDir],
      });

      expect(fleet.totals).toEqual({
        totalProfiles: 10,
        healthy: 1,
        idle: 0,
        drift: 0,
        missingLoop: 9,
        activeFlows: 1,
      });
      expect(fleet.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agentId: "founder",
            health: "healthy",
            hasActiveFlow: true,
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
          }),
          expect.objectContaining({
            agentId: "librarian",
            health: "missing_loop",
            hasActiveFlow: false,
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
          }),
          expect.objectContaining({
            agentId: "executor",
            health: "missing_loop",
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
          }),
        ]),
      );
      expect(fleet.entries.map((entry) => entry.agentId)).not.toContain("strategist");
    } finally {
      cron.stop();
    }
  });

  it("heals fleet continuity by creating missing loops and restarting terminal flows", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/heal-workspace";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });
    const founderRuntime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:founder:main",
    });

    try {
      await runtime.upsertLoopJob({
        agentId: "founder",
      });
      const started = founderRuntime.startManagedFlow({
        agentId: "founder",
        goal: "Run one founder scan",
      });
      await founderRuntime.cancelManagedFlow({
        agentId: "founder",
        flowId: started.flow.id,
      });

      const healed = await runtime.healFleet({
        agentIds: ["founder", "librarian"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: false,
      });

      expect(healed.totals).toEqual({
        totalProfiles: 2,
        changed: 2,
        unchanged: 0,
        loopCreated: 1,
        loopUpdated: 0,
        flowStarted: 2,
        flowRestarted: 0,
      });
      expect(healed.entries).toEqual([
        expect.objectContaining({
          agentId: "founder",
          healthBefore: "idle",
          healthAfter: "healthy",
          loopAction: "none",
          flowAction: "started",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          reasons: expect.arrayContaining(["latest managed flow is cancelled"]),
          startedFlow: expect.objectContaining({
            ownerKey: "agent:founder:main",
            status: "running",
          }),
        }),
        expect.objectContaining({
          agentId: "librarian",
          healthBefore: "missing_loop",
          healthAfter: "healthy",
          loopAction: "created",
          flowAction: "started",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          reasons: expect.arrayContaining(["managed loop missing", "no managed flow recorded yet"]),
          loopAfter: expect.objectContaining({
            workspaceDirs: [workspaceDir],
            primaryWorkspaceDir: workspaceDir,
          }),
          startedFlow: expect.objectContaining({
            ownerKey: "agent:librarian:main",
            status: "running",
          }),
        }),
      ]);

      const fleet = await runtime.getFleetStatus({
        agentIds: ["founder", "librarian"],
      });
      expect(fleet.entries).toEqual([
        expect.objectContaining({
          agentId: "founder",
          health: "healthy",
          hasActiveFlow: true,
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
        }),
        expect.objectContaining({
          agentId: "librarian",
          health: "healthy",
          hasActiveFlow: true,
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
        }),
      ]);
      expect(
        (healed.entries[0]?.startedFlow?.state as { autonomy?: { workspaceDirs?: string[] } })
          ?.autonomy?.workspaceDirs,
      ).toEqual([workspaceDir]);
      expect(
        (healed.entries[1]?.startedFlow?.state as { autonomy?: { workspaceDirs?: string[] } })
          ?.autonomy?.workspaceDirs,
      ).toEqual([workspaceDir]);
    } finally {
      cron.stop();
    }
  });

  it("persists standalone fleet healing without arming an executable scheduler", async () => {
    const runtime = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:main",
    });

    const healed = await runtime.healFleet({
      agentIds: ["founder"],
      restartBlockedFlows: false,
      synthesizeGovernanceProposals: false,
      recordHistory: false,
    });

    expect(healed.totals).toEqual({
      totalProfiles: 1,
      changed: 1,
      unchanged: 0,
      loopCreated: 1,
      loopUpdated: 0,
      flowStarted: 1,
      flowRestarted: 0,
    });

    const reloaded = createAutonomyRuntime().bindSession({
      sessionKey: "agent:main:main",
    });
    const fleet = await reloaded.getFleetStatus({
      agentIds: ["founder"],
    });

    expect(fleet.totals).toEqual({
      totalProfiles: 1,
      healthy: 1,
      idle: 0,
      drift: 0,
      missingLoop: 0,
      activeFlows: 1,
    });
    expect(fleet.entries[0]).toEqual(
      expect.objectContaining({
        agentId: "founder",
        health: "healthy",
        hasActiveFlow: true,
        loopCadenceAligned: true,
      }),
    );
  });

  it("restarts blocked managed flows by cancelling the old flow before replacement", async () => {
    const cron = await createCronService();
    const workspaceDir = "/tmp/blocked-restart-workspace";
    const runtime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:main:main",
    });
    const founderRuntime = createAutonomyRuntime({ cronService: cron }).bindSession({
      sessionKey: "agent:founder:main",
    });
    const founderTaskFlow = createRuntimeTaskFlow().bindSession({
      sessionKey: "agent:founder:main",
    });

    try {
      await runtime.upsertLoopJob({
        agentId: "founder",
      });
      const started = founderRuntime.startManagedFlow({
        agentId: "founder",
        goal: "Continue the founder control loop",
      });
      const blockedRecord = founderTaskFlow.get(started.flow.id);
      expect(blockedRecord).toBeTruthy();
      const blocked = founderTaskFlow.setWaiting({
        flowId: started.flow.id,
        expectedRevision: blockedRecord?.revision ?? 0,
        blockedSummary: "Needs intervention before the loop can continue.",
      });
      expect(blocked).toMatchObject({
        applied: true,
        flow: expect.objectContaining({
          flowId: started.flow.id,
          status: "blocked",
        }),
      });

      const healed = await runtime.healFleet({
        agentIds: ["founder"],
        workspaceDirs: [workspaceDir],
        restartBlockedFlows: true,
      });

      expect(healed.totals).toEqual({
        totalProfiles: 1,
        changed: 1,
        unchanged: 0,
        loopCreated: 0,
        loopUpdated: 0,
        flowStarted: 1,
        flowRestarted: 1,
      });
      expect(healed.entries).toEqual([
        expect.objectContaining({
          agentId: "founder",
          healthBefore: "drift",
          healthAfter: "healthy",
          loopAction: "none",
          flowAction: "restarted",
          workspaceDirs: [workspaceDir],
          primaryWorkspaceDir: workspaceDir,
          cancelledFlowBeforeRestart: expect.objectContaining({
            id: started.flow.id,
            status: "cancelled",
          }),
          startedFlow: expect.objectContaining({
            ownerKey: "agent:founder:main",
            status: "running",
          }),
          reasons: expect.arrayContaining([
            "latest managed flow is blocked",
            `cancelled blocked flow "${started.flow.id}" before restart`,
          ]),
        }),
      ]);
      expect(healed.entries[0]?.startedFlow?.id).not.toBe(started.flow.id);
      expect(
        (healed.entries[0]?.startedFlow?.state as { autonomy?: { workspaceDirs?: string[] } })
          ?.autonomy?.workspaceDirs,
      ).toEqual([workspaceDir]);
      expect(founderTaskFlow.get(started.flow.id)).toMatchObject({
        status: "cancelled",
      });
    } finally {
      cron.stop();
    }
  });

  it("rejects tool contexts without a bound session key", () => {
    const runtime = createAutonomyRuntime();

    expect(() =>
      runtime.fromToolContext({
        sessionKey: undefined,
        deliveryContext: undefined,
      }),
    ).toThrow("Autonomy runtime requires tool context with a sessionKey.");
  });
});
