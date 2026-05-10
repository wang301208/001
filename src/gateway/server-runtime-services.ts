import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { AssistantConfig } from "../config/types.assistant.js";
import { resolveMainSessionKey } from "../config/sessions/main-session.js";
import { loadGovernanceCharter } from "../governance/charter-runtime.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { startHeartbeatRunner, type HeartbeatRunner } from "../infra/heartbeat-runner.js";
import type { ChannelHealthMonitor } from "./channel-health-monitor.js";
import { startChannelHealthMonitor } from "./channel-health-monitor.js";
import { startGatewayModelPricingRefresh } from "./model-pricing-cache.js";

type GatewayRuntimeServiceLogger = {
  child: (name: string) => {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  error: (message: string) => void;
};

export type GatewayChannelManager = Parameters<
  typeof startChannelHealthMonitor
>[0]["channelManager"];

type GatewayAutonomyMaintenanceResult =
  | {
      mode: "reconcile";
      reconciled: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["reconcileLoopJobs"]>
      >;
      changedCount: number;
    }
  | {
      mode: "heal";
      healed: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["healFleet"]>
      >;
      changedCount: number;
    }
  | {
      mode: "supervise";
      supervised: Awaited<
        ReturnType<import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime["superviseFleet"]>
      >;
      changedCount: number;
    };

type GatewayAutonomySupervisor = {
  start: () => void;
  stop: () => void;
  updateConfig: (cfg: AssistantConfig) => void;
};

type GatewayBackendAutomationStep = {
  name: string;
  ok: boolean;
  changedCount: number;
  detail?: string;
};

type GatewayBackendAutomationResult = {
  source: "startup" | "supervisor";
  steps: GatewayBackendAutomationStep[];
  changedCount: number;
};

export type GatewayBackendAutomationHistoryEntry = GatewayBackendAutomationResult & {
  id: string;
  observedAt: number;
  ok: boolean;
};

type GatewayBackendAutomationSupervisor = {
  start: () => void;
  stop: () => void;
  updateConfig: (cfg: AssistantConfig) => void;
};

function createNoopHeartbeatRunner(): HeartbeatRunner {
  return {
    stop: () => {},
    updateConfig: (_cfg: AssistantConfig) => {},
  };
}

export function startGatewayChannelHealthMonitor(params: {
  cfg: AssistantConfig;
  channelManager: GatewayChannelManager;
}): ChannelHealthMonitor | null {
  const healthCheckMinutes = params.cfg.gateway?.channelHealthCheckMinutes;
  if (healthCheckMinutes === 0) {
    return null;
  }
  const staleEventThresholdMinutes = params.cfg.gateway?.channelStaleEventThresholdMinutes;
  const maxRestartsPerHour = params.cfg.gateway?.channelMaxRestartsPerHour;
  return startChannelHealthMonitor({
    channelManager: params.channelManager,
    checkIntervalMs: (healthCheckMinutes ?? 5) * 60_000,
    ...(staleEventThresholdMinutes != null && {
      staleEventThresholdMs: staleEventThresholdMinutes * 60_000,
    }),
    ...(maxRestartsPerHour != null && { maxRestartsPerHour }),
  });
}

export function startGatewayCronWithLogging(params: {
  cron: { start: () => Promise<void> };
  logCron: { error: (message: string) => void };
  onStarted?: () => Promise<void> | void;
}): void {
  void params.cron
    .start()
    .then(async () => {
      if (!params.onStarted) {
        return;
      }
      try {
        await params.onStarted();
      } catch (err) {
        params.logCron.error(`post-start hook failed: ${String(err)}`);
      }
    })
    .catch((err) => params.logCron.error(`failed to start: ${String(err)}`));
}

async function runGatewayAutonomyMaintenance(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  source: "startup" | "supervisor";
}): Promise<GatewayAutonomyMaintenanceResult | undefined> {
  if (params.minimalTestGateway) {
    return undefined;
  }
  if (process.env.ASSISTANT_SKIP_AUTONOMY_RECONCILE === "1") {
    return undefined;
  }
  if (process.env.ASSISTANT_SKIP_CRON === "1" || params.cfgAtStart.cron?.enabled === false) {
    return undefined;
  }
  if (
    typeof params.cron.list !== "function" ||
    typeof params.cron.add !== "function" ||
    typeof params.cron.update !== "function" ||
    typeof params.cron.remove !== "function"
  ) {
    return undefined;
  }

  const [{ createRuntimeAutonomy }, { createRuntimeTaskFlow }] = await Promise.all([
    import("../plugins/runtime/runtime-autonomy.js"),
    import("../plugins/runtime/runtime-taskflow.js"),
  ]);
  const charterDir = loadGovernanceCharter().charterDir;
  const autonomy = createRuntimeAutonomy({
    legacyTaskFlow: createRuntimeTaskFlow(),
    charterDir,
    cronService: params.cron as import("../cron/service-contract.js").CronServiceContract,
  }).bindSession({
    sessionKey: resolveMainSessionKey(params.cfgAtStart),
  });
  const mode = resolveGatewayAutonomyMaintenanceMode();
  if (mode === "reconcile") {
    const reconciled = await autonomy.reconcileLoopJobs({
      telemetrySource: params.source,
    });
    return {
      mode: "reconcile",
      reconciled,
      changedCount: reconciled.createdCount + reconciled.updatedCount,
    };
  }

  if (mode === "heal") {
    const healed = await autonomy.healFleet({
      restartBlockedFlows: false,
      telemetrySource: params.source,
    });
    return {
      mode: "heal",
      healed,
      changedCount: healed.totals.changed,
    };
  }

  const supervised = await autonomy.superviseFleet({
    governanceMode: resolveAutonomySupervisorGovernanceMode(),
    includeCapabilityInventory: resolveAutonomySupervisorIncludeCapabilityInventory(),
    includeGenesisPlan: resolveAutonomySupervisorIncludeGenesisPlan(),
    recordHistory: true,
    restartBlockedFlows: false,
    telemetrySource: params.source,
  });
  return {
    mode: "supervise",
    supervised,
    changedCount:
      supervised.summary.changedProfiles +
      supervised.summary.governanceCreatedCount +
      supervised.summary.governanceAppliedCount,
  };
}

function logGatewayAutonomyMaintenanceSummary(params: {
  log: GatewayRuntimeServiceLogger;
  result: GatewayAutonomyMaintenanceResult;
  prefix?: string;
}): void {
  const logAutonomy = params.log.child("autonomy");
  const prefix = params.prefix ? `${params.prefix} ` : "";
  if (params.result.mode === "reconcile") {
    logAutonomy.info(
      `${prefix}reconciled ${params.result.reconciled.reconciled.length} managed autonomy loop(s) (created ${params.result.reconciled.createdCount}, updated ${params.result.reconciled.updatedCount})`,
    );
    return;
  }
  if (params.result.mode === "supervise") {
    logAutonomy.info(
      `${prefix}supervised ${params.result.supervised.summary.totalProfiles} managed autonomy profile(s) (changed ${params.result.supervised.summary.changedProfiles}, healthy ${params.result.supervised.summary.healthyProfiles}, drift ${params.result.supervised.summary.driftProfiles}, missingLoop ${params.result.supervised.summary.missingLoopProfiles}, activeFlows ${params.result.supervised.summary.activeFlows}, governanceCreated ${params.result.supervised.summary.governanceCreatedCount}, governanceApplied ${params.result.supervised.summary.governanceAppliedCount}, governancePending ${params.result.supervised.summary.governancePendingCount}, capabilityGaps ${params.result.supervised.summary.capabilityGapCount}, criticalCapabilityGaps ${params.result.supervised.summary.criticalCapabilityGapCount}, genesisStages ${params.result.supervised.summary.genesisStageCount}, genesisBlocked ${params.result.supervised.summary.genesisBlockedStageCount})`,
    );
    return;
  }
  logAutonomy.info(
    `${prefix}healed ${params.result.healed.totals.totalProfiles} managed autonomy profile(s) (changed ${params.result.healed.totals.changed}, loopCreated ${params.result.healed.totals.loopCreated}, loopUpdated ${params.result.healed.totals.loopUpdated}, flowStarted ${params.result.healed.totals.flowStarted}, flowRestarted ${params.result.healed.totals.flowRestarted})`,
  );
}

function resolveBooleanEnvFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return undefined;
}

function resolveGatewayAutonomyMaintenanceMode(): "reconcile" | "heal" | "supervise" {
  if (process.env.ASSISTANT_SKIP_AUTONOMY_FLOW_HEAL === "1") {
    return "reconcile";
  }
  const explicit = process.env.ASSISTANT_AUTONOMY_SUPERVISOR_MODE?.trim().toLowerCase();
  if (explicit === "reconcile" || explicit === "heal" || explicit === "supervise") {
    return explicit;
  }
  return "supervise";
}

function resolveAutonomySupervisorGovernanceMode(): "none" | "apply_safe" | "force_apply_all" {
  const explicit = process.env.ASSISTANT_AUTONOMY_SUPERVISOR_GOVERNANCE_MODE?.trim();
  if (explicit === "none" || explicit === "apply_safe" || explicit === "force_apply_all") {
    return explicit;
  }
  return "apply_safe";
}

function resolveAutonomySupervisorIncludeCapabilityInventory(): boolean {
  return resolveBooleanEnvFlag("ASSISTANT_AUTONOMY_SUPERVISOR_INCLUDE_CAPABILITY_INVENTORY") ?? true;
}

function resolveAutonomySupervisorIncludeGenesisPlan(): boolean {
  return resolveBooleanEnvFlag("ASSISTANT_AUTONOMY_SUPERVISOR_INCLUDE_GENESIS_PLAN") ?? true;
}

function resolveAutonomySupervisorIntervalMs(): number | undefined {
  if (process.env.ASSISTANT_SKIP_AUTONOMY_SUPERVISOR === "1") {
    return undefined;
  }
  const explicit = process.env.ASSISTANT_AUTONOMY_SUPERVISOR_INTERVAL_MS?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    if (parsed === 0) {
      return undefined;
    }
  }
  return 15 * 60_000;
}

function resolveBackendAutomationIntervalMs(): number | undefined {
  if (process.env.ASSISTANT_SKIP_BACKEND_AUTOMATION === "1") {
    return undefined;
  }
  const explicit = process.env.ASSISTANT_BACKEND_AUTOMATION_INTERVAL_MS?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    if (parsed === 0) {
      return undefined;
    }
  }
  return 5 * 60_000;
}

function shouldRunBackendAutomation(params: {
  minimalTestGateway: boolean;
}): boolean {
  if (params.minimalTestGateway) {
    return false;
  }
  if (process.env.ASSISTANT_SKIP_BACKEND_AUTOMATION === "1") {
    return false;
  }
  return true;
}

function resolveBackendAutomationHistoryPath(): string {
  return path.join(resolveStateDir(), "self", "backend-automation-history.json");
}

function readBackendAutomationHistory(): GatewayBackendAutomationHistoryEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(resolveBackendAutomationHistoryPath(), "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is GatewayBackendAutomationHistoryEntry =>
      typeof entry === "object" && entry !== null && typeof (entry as { id?: unknown }).id === "string"
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    return [];
  }
}

function recordBackendAutomationHistory(result: GatewayBackendAutomationResult): void {
  const observedAt = Date.now();
  const entry: GatewayBackendAutomationHistoryEntry = {
    ...result,
    id: `backend_automation_${observedAt}_${Math.random().toString(36).slice(2, 10)}`,
    observedAt,
    ok: result.steps.every((step) => step.ok),
  };
  const filePath = resolveBackendAutomationHistoryPath();
  const history = [entry, ...readBackendAutomationHistory()].slice(0, 100);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

export function getGatewayBackendAutomationHistory(params: {
  limit?: number;
} = {}): GatewayBackendAutomationHistoryEntry[] {
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : 20;
  return readBackendAutomationHistory().slice(0, limit);
}

async function runBackendAutomationStep(params: {
  steps: GatewayBackendAutomationStep[];
  name: string;
  log: GatewayRuntimeServiceLogger;
  run: () => Promise<number | void> | number | void;
}): Promise<number> {
  try {
    const changedCount = (await params.run()) ?? 0;
    params.steps.push({
      name: params.name,
      ok: true,
      changedCount,
    });
    return changedCount;
  } catch (err) {
    params.steps.push({
      name: params.name,
      ok: false,
      changedCount: 0,
      detail: String(err),
    });
    params.log.child("backend-automation").warn(`${params.name} failed: ${String(err)}`);
    return 0;
  }
}

async function prewarmBackendModelCatalog(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const { loadModelCatalog } = await import("../agents/model-catalog.js");
  const catalog = await loadModelCatalog({ config: params.cfgAtStart });
  return Array.isArray(catalog) ? catalog.length : 0;
}

async function refreshBackendSkillsState(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const [{ listAgentIds, resolveAgentWorkspaceDir }, { buildWorkspaceSkillStatus }] =
    await Promise.all([
      import("../agents/agent-scope.js"),
      import("../agents/skills-status.js"),
    ]);
  let eligibleCount = 0;
  for (const agentId of listAgentIds(params.cfgAtStart)) {
    const workspaceDir = resolveAgentWorkspaceDir(params.cfgAtStart, agentId);
    const report = buildWorkspaceSkillStatus(workspaceDir, { config: params.cfgAtStart });
    eligibleCount += report.skills.filter((skill) => skill.eligible).length;
  }
  return eligibleCount;
}

async function prewarmBackendToolCatalog(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const [{ listAgentIds }, { buildToolsCatalogResult }] = await Promise.all([
    import("../agents/agent-scope.js"),
    import("./server-methods/tools-catalog.js"),
  ]);
  let toolCount = 0;
  for (const agentId of listAgentIds(params.cfgAtStart)) {
    const result = buildToolsCatalogResult({
      cfg: params.cfgAtStart,
      agentId,
      includePlugins: true,
    });
    toolCount += result.groups.reduce((count, group) => count + group.tools.length, 0);
  }
  return toolCount;
}

async function refreshBackendRemoteSkills(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const { primeRemoteSkillsCache, refreshRemoteBinsForConnectedNodes } = await import(
    "../infra/skills-remote.js"
  );
  await primeRemoteSkillsCache();
  await refreshRemoteBinsForConnectedNodes(params.cfgAtStart);
  return 0;
}

async function sweepBackendTaskRegistry(): Promise<number> {
  const { sweepTaskRegistry } = await import("../tasks/task-registry.maintenance.js");
  const summary = await sweepTaskRegistry();
  return summary.reconciled + summary.governanceStamped + summary.cleanupStamped + summary.pruned;
}

async function runBackendGovernanceInventory(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const {
    getGovernanceOverview,
    getGovernanceCapabilityInventory,
    getGovernanceCapabilityAssetRegistry,
    getGovernanceGenesisPlan,
  } = await import("../governance/control-plane.js");
  const overview = getGovernanceOverview({ cfg: params.cfgAtStart });
  const inventory = getGovernanceCapabilityInventory({ cfg: params.cfgAtStart });
  const assetRegistry = getGovernanceCapabilityAssetRegistry({
    cfg: params.cfgAtStart,
  });
  const genesisPlan = getGovernanceGenesisPlan({
    cfg: params.cfgAtStart,
    inventory,
  });
  return (
    overview.findings.length +
    inventory.entries.length +
    assetRegistry.currentAssetCount +
    genesisPlan.stages.length
  );
}

async function repairBackendMemoryArtifacts(params: {
  cfgAtStart: AssistantConfig;
}): Promise<number> {
  const [
    { listAgentIds, resolveAgentWorkspaceDir },
    { repairDreamingArtifacts, dedupeDreamDiaryEntries },
  ] = await Promise.all([
    import("../agents/agent-scope.js"),
    import("./server-methods/doctor.memory-core-runtime.js"),
  ]);
  let changedCount = 0;
  for (const agentId of listAgentIds(params.cfgAtStart)) {
    const workspaceDir = resolveAgentWorkspaceDir(params.cfgAtStart, agentId);
    const repair = await repairDreamingArtifacts({ workspaceDir });
    const dedupe = await dedupeDreamDiaryEntries({ workspaceDir });
    if (repair.changed) {
      changedCount += 1;
    }
    changedCount += dedupe.removed;
  }
  return changedCount;
}

async function advanceBackendSelfRoadmap(): Promise<number> {
  const { advanceSelfRoadmap } = await import("../experience/experience-store.js");
  const result = advanceSelfRoadmap();
  return result.createdStrategicMemories;
}

function buildSelfRoadmapTaskParams(goal: {
  id: string;
  title: string;
  objective: string;
  priority: "high" | "medium" | "low";
  nextPushAt: number;
  evidenceEventIds: string[];
  blockers: string[];
}) {
  const baseGoalText = [
    "[self-roadmap]",
    goal.objective,
    "",
    goal.blockers.length > 0 ? `Blockers: ${goal.blockers.join("; ")}` : "Blockers: none",
  ].join("\n");
  if (goal.id === "self_upgrade_loop") {
    const codeChangeContract = {
      strategy: "test-first",
      allowedPaths: ["src/", "scripts/", "test/"],
      verificationCommands: [
        "pnpm tsgo",
        "pnpm check:import-cycles",
      ],
      deliverables: [
        "implementation patch",
        "fresh verification output",
        "experience memory update",
      ],
      releaseHandoff: "record verification evidence and leave deployment to the release workflow",
    };
    return {
      agentId: "main",
      name: goal.title,
      goal: [
        baseGoalText,
        "",
        "[self-code-upgrade-contract]",
        `Strategy: ${codeChangeContract.strategy}`,
        `Allowed paths: ${codeChangeContract.allowedPaths.join(", ")}`,
        `Verification: ${codeChangeContract.verificationCommands.join(" && ")}`,
        `Deliverables: ${codeChangeContract.deliverables.join(", ")}`,
      ].join("\n"),
      duration: "long" as const,
      priority: goal.priority,
      group: "self-code-upgrade",
      business: {
        domain: "self-code",
        domainLabel: "Self code evolution",
        accessMode: "autonomous-code-change",
        accessModeLabel: "Autonomous code change pipeline",
        object: goal.id,
        acceptanceCriteria:
          "A bounded source change is implemented with test-first evidence, fresh verification output, and experience memory update.",
        payload: {
          selfRoadmapGoalId: goal.id,
          evidenceEventIds: goal.evidenceEventIds,
          nextPushAt: goal.nextPushAt,
          codeChangeContract,
        },
      },
    };
  }
  return {
    agentId: "main",
    name: goal.title,
    goal: baseGoalText,
    duration: "long" as const,
    priority: goal.priority,
    group: "self-roadmap",
    business: {
      domain: "self",
      domainLabel: "Self evolution",
      accessMode: "autonomous",
      accessModeLabel: "Backend startup automation",
      object: goal.id,
      acceptanceCriteria: "Autonomy flow is started and the result is captured back into experience memory.",
      payload: {
        selfRoadmapGoalId: goal.id,
        evidenceEventIds: goal.evidenceEventIds,
        nextPushAt: goal.nextPushAt,
      },
    },
  };
}

async function materializeSelfRoadmapTasks(): Promise<number> {
  const [{ getSelfRoadmap }, { createBusinessTask, listBusinessTasks }] = await Promise.all([
    import("../experience/experience-store.js"),
    import("../tasks/business-task-store.js"),
  ]);
  const existingGoalIds = new Set(
    listBusinessTasks()
      .map((task) => task.business.payload?.selfRoadmapGoalId)
      .filter((goalId): goalId is string => typeof goalId === "string" && goalId.length > 0),
  );
  let createdCount = 0;
  for (const goal of getSelfRoadmap().goals) {
    if (goal.status !== "active" || existingGoalIds.has(goal.id)) {
      continue;
    }
    createBusinessTask(buildSelfRoadmapTaskParams(goal));
    existingGoalIds.add(goal.id);
    createdCount += 1;
  }
  return createdCount;
}

async function recoverRunningBusinessTasks(params: {
  cfgAtStart: AssistantConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
}): Promise<number> {
  if (
    typeof params.cron.list !== "function" ||
    typeof params.cron.add !== "function" ||
    typeof params.cron.update !== "function" ||
    typeof params.cron.remove !== "function"
  ) {
    return 0;
  }
  const [
    { listBusinessTasks, updateBusinessTask },
    { createRuntimeAutonomy },
    { createRuntimeTaskFlow },
  ] = await Promise.all([
    import("../tasks/business-task-store.js"),
    import("../plugins/runtime/runtime-autonomy.js"),
    import("../plugins/runtime/runtime-taskflow.js"),
  ]);
  const runningTasks = listBusinessTasks({ status: "running" });
  if (runningTasks.length === 0) {
    return 0;
  }
  const charterDir = loadGovernanceCharter().charterDir;
  const autonomyByAgent = new Map<
    string,
    import("../plugins/runtime/runtime-autonomy.types.js").BoundAutonomyRuntime
  >();
  let recoveredCount = 0;
  for (const task of runningTasks) {
    if (task.autonomy?.flowId) {
      continue;
    }
    const agentId = task.agentId || "main";
    const sessionKey = `agent:${agentId}:main`;
    let autonomy = autonomyByAgent.get(agentId);
    if (!autonomy) {
      autonomy = createRuntimeAutonomy({
        legacyTaskFlow: createRuntimeTaskFlow(),
        charterDir,
        cronService: params.cron as import("../cron/service-contract.js").CronServiceContract,
      }).bindSession({ sessionKey });
      autonomyByAgent.set(agentId, autonomy);
    }
    const started = autonomy.startManagedFlow({
      agentId,
      goal: [
        "[backend-automation:business-task-recovery]",
        task.name,
        "",
        task.goal,
      ].join("\n"),
      status: "running",
    });
    updateBusinessTask(task.id, {
      progress: Math.max(task.progress, 15),
      autonomy: {
        sessionKey,
        flowId: started.flow.id,
        started,
      },
    });
    recoveredCount += 1;
  }
  return recoveredCount;
}

async function runGatewayBackendAutomation(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
  source: "startup" | "supervisor";
}): Promise<GatewayBackendAutomationResult | undefined> {
  if (!shouldRunBackendAutomation(params)) {
    return undefined;
  }
  const steps: GatewayBackendAutomationStep[] = [];
  let changedCount = 0;
  changedCount += await runBackendAutomationStep({
    steps,
    name: "model-catalog",
    log: params.log,
    run: () => prewarmBackendModelCatalog({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "skills-state",
    log: params.log,
    run: () => refreshBackendSkillsState({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "tool-catalog",
    log: params.log,
    run: () => prewarmBackendToolCatalog({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "remote-skills",
    log: params.log,
    run: () => refreshBackendRemoteSkills({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "task-registry",
    log: params.log,
    run: sweepBackendTaskRegistry,
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "governance-inventory",
    log: params.log,
    run: () => runBackendGovernanceInventory({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "memory-artifacts",
    log: params.log,
    run: () => repairBackendMemoryArtifacts({ cfgAtStart: params.cfgAtStart }),
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "self-roadmap",
    log: params.log,
    run: advanceBackendSelfRoadmap,
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "self-roadmap-tasks",
    log: params.log,
    run: materializeSelfRoadmapTasks,
  });
  changedCount += await runBackendAutomationStep({
    steps,
    name: "business-task-recovery",
    log: params.log,
    run: () => recoverRunningBusinessTasks({
      cfgAtStart: params.cfgAtStart,
      cron: params.cron,
    }),
  });
  return {
    source: params.source,
    steps,
    changedCount,
  };
}

function logGatewayBackendAutomationSummary(params: {
  log: GatewayRuntimeServiceLogger;
  result: GatewayBackendAutomationResult;
  prefix?: string;
}): void {
  const logAutomation = params.log.child("backend-automation");
  const prefix = params.prefix ? `${params.prefix} ` : "";
  const failedCount = params.result.steps.filter((step) => !step.ok).length;
  const stepSummary = params.result.steps
    .map((step) => `${step.name}:${step.ok ? step.changedCount : "failed"}`)
    .join(", ");
  logAutomation.info(
    `${prefix}${params.result.source} sweep completed (changed ${params.result.changedCount}, failed ${failedCount}; ${stepSummary})`,
  );
}

function createGatewayBackendAutomationSupervisor(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  getCron: () => Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): GatewayBackendAutomationSupervisor {
  const logSupervisor = params.log.child("backend-automation-supervisor");
  const state = {
    cfg: params.cfgAtStart,
    timer: null as NodeJS.Timeout | null,
    started: false,
    stopped: false,
    running: false,
  };

  const clearTimer = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };

  const scheduleNext = () => {
    clearTimer();
    if (!state.started || state.stopped) {
      return;
    }
    const intervalMs = resolveBackendAutomationIntervalMs();
    if (!intervalMs) {
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      void runSweep();
    }, intervalMs);
    state.timer.unref?.();
  };

  const runSweep = async () => {
    if (state.stopped || state.running) {
      return;
    }
    state.running = true;
    try {
      const result = await runGatewayBackendAutomation({
        minimalTestGateway: params.minimalTestGateway,
        cfgAtStart: state.cfg,
        cron: params.getCron(),
        log: params.log,
        source: "supervisor",
      });
      if (result) {
        recordBackendAutomationHistory(result);
        logGatewayBackendAutomationSummary({
          log: params.log,
          result,
          prefix: "supervisor",
        });
      }
    } catch (err) {
      logSupervisor.error(`sweep failed: ${String(err)}`);
    } finally {
      state.running = false;
      scheduleNext();
    }
  };

  return {
    start: () => {
      if (state.started || state.stopped) {
        return;
      }
      state.started = true;
      const intervalMs = resolveBackendAutomationIntervalMs();
      if (intervalMs) {
        logSupervisor.info(`scheduled backend automation sweep every ${intervalMs}ms`);
      }
      scheduleNext();
    },
    stop: () => {
      state.stopped = true;
      clearTimer();
    },
    updateConfig: (cfg) => {
      state.cfg = cfg;
      if (state.started && !state.stopped) {
        scheduleNext();
      }
    },
  };
}

function createGatewayAutonomySupervisor(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  getCron: () => Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): GatewayAutonomySupervisor {
  const logSupervisor = params.log.child("autonomy-supervisor");
  const state = {
    cfg: params.cfgAtStart,
    timer: null as NodeJS.Timeout | null,
    started: false,
    stopped: false,
    running: false,
  };

  const clearTimer = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };

  const scheduleNext = () => {
    clearTimer();
    if (!state.started || state.stopped) {
      return;
    }
    const intervalMs = resolveAutonomySupervisorIntervalMs();
    if (!intervalMs) {
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      void runSweep();
    }, intervalMs);
    state.timer.unref?.();
  };

  const runSweep = async () => {
    if (state.stopped || state.running) {
      return;
    }
    state.running = true;
    try {
      const result = await runGatewayAutonomyMaintenance({
        minimalTestGateway: params.minimalTestGateway,
        cfgAtStart: state.cfg,
        cron: params.getCron(),
        source: "supervisor",
      });
      if (result && result.changedCount > 0) {
        logGatewayAutonomyMaintenanceSummary({
          log: params.log,
          result,
          prefix: "supervisor",
        });
      }
    } catch (err) {
      logSupervisor.error(`sweep failed: ${String(err)}`);
    } finally {
      state.running = false;
      scheduleNext();
    }
  };

  return {
    start: () => {
      if (state.started || state.stopped) {
        return;
      }
      state.started = true;
      const intervalMs = resolveAutonomySupervisorIntervalMs();
      if (intervalMs) {
        logSupervisor.info(`scheduled managed autonomy sweep every ${intervalMs}ms`);
      }
      scheduleNext();
    },
    stop: () => {
      state.stopped = true;
      clearTimer();
    },
    updateConfig: (cfg) => {
      state.cfg = cfg;
      if (state.started && !state.stopped) {
        scheduleNext();
      }
    },
  };
}

function composeGatewayHeartbeatRunner(
  heartbeatRunner: HeartbeatRunner,
  autonomySupervisor: GatewayAutonomySupervisor,
  backendAutomationSupervisor: GatewayBackendAutomationSupervisor,
): HeartbeatRunner {
  return {
    stop: () => {
      backendAutomationSupervisor.stop();
      autonomySupervisor.stop();
      heartbeatRunner.stop();
    },
    updateConfig: (cfg) => {
      heartbeatRunner.updateConfig(cfg);
      autonomySupervisor.updateConfig(cfg);
      backendAutomationSupervisor.updateConfig(cfg);
    },
  };
}

export async function reconcileGatewayAutonomyLoops(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): Promise<void> {
  const result = await runGatewayAutonomyMaintenance({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    cron: params.cron,
    source: "startup",
  });
  if (!result) {
    return;
  }
  logGatewayAutonomyMaintenanceSummary({
    log: params.log,
    result,
  });
}

export async function runGatewayBackendAutomationStartup(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  cron: Partial<import("../cron/service-contract.js").CronServiceContract>;
  log: GatewayRuntimeServiceLogger;
}): Promise<void> {
  const result = await runGatewayBackendAutomation({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    cron: params.cron,
    log: params.log,
    source: "startup",
  });
  if (!result) {
    return;
  }
  recordBackendAutomationHistory(result);
  logGatewayBackendAutomationSummary({
    log: params.log,
    result,
  });
}

function recoverPendingOutboundDeliveries(params: {
  cfg: AssistantConfig;
  log: GatewayRuntimeServiceLogger;
}): void {
  void (async () => {
    const { recoverPendingDeliveries } = await import("../infra/outbound/delivery-queue.js");
    const { deliverOutboundPayloads } = await import("../infra/outbound/deliver.js");
    const logRecovery = params.log.child("delivery-recovery");
    await recoverPendingDeliveries({
      deliver: deliverOutboundPayloads,
      log: logRecovery,
      cfg: params.cfg,
    });
  })().catch((err) => params.log.error(`Delivery recovery failed: ${String(err)}`));
}

export function startGatewayRuntimeServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  channelManager: GatewayChannelManager;
  log: GatewayRuntimeServiceLogger;
}): {
  heartbeatRunner: HeartbeatRunner;
  channelHealthMonitor: ChannelHealthMonitor | null;
  stopModelPricingRefresh: () => void;
} {
  // Keep scheduled work inert until post-attach sidecars finish.
  const channelHealthMonitor = startGatewayChannelHealthMonitor({
    cfg: params.cfgAtStart,
    channelManager: params.channelManager,
  });

  return {
    heartbeatRunner: createNoopHeartbeatRunner(),
    channelHealthMonitor,
    stopModelPricingRefresh:
      !params.minimalTestGateway && !isTruthyEnvValue(process.env.VITEST)
        ? startGatewayModelPricingRefresh({ config: params.cfgAtStart })
        : () => {},
  };
}

/**
 * Activate cron scheduler, heartbeat runner, and pending delivery recovery
 * after gateway sidecars are fully started and chat.history is available.
 */
export function activateGatewayScheduledServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: AssistantConfig;
  cron: { start: () => Promise<void> };
  getCron?: () => Partial<import("../cron/service-contract.js").CronServiceContract>;
  logCron: { error: (message: string) => void };
  log: GatewayRuntimeServiceLogger;
}): { heartbeatRunner: HeartbeatRunner } {
  if (
    params.minimalTestGateway &&
    process.env.ASSISTANT_TEST_MINIMAL_GATEWAY_ALLOW_SCHEDULED_SERVICES !== "1"
  ) {
    return { heartbeatRunner: createNoopHeartbeatRunner() };
  }
  const heartbeatRunner = startHeartbeatRunner({ cfg: params.cfgAtStart });
  const autonomySupervisor = createGatewayAutonomySupervisor({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    getCron: params.getCron ?? (() => params.cron),
    log: params.log,
  });
  const backendAutomationSupervisor = createGatewayBackendAutomationSupervisor({
    minimalTestGateway: params.minimalTestGateway,
    cfgAtStart: params.cfgAtStart,
    getCron: params.getCron ?? (() => params.cron),
    log: params.log,
  });
  startGatewayCronWithLogging({
    cron: params.cron,
    logCron: params.logCron,
    onStarted: async () => {
      try {
        await reconcileGatewayAutonomyLoops({
          minimalTestGateway: params.minimalTestGateway,
          cfgAtStart: params.cfgAtStart,
          cron: params.cron,
          log: params.log,
        }).catch((err) => params.log.error(`Autonomy startup maintenance failed: ${String(err)}`));
        await runGatewayBackendAutomationStartup({
          minimalTestGateway: params.minimalTestGateway,
          cfgAtStart: params.cfgAtStart,
          cron: params.getCron?.() ?? params.cron,
          log: params.log,
        }).catch((err) => params.log.error(`Backend automation startup failed: ${String(err)}`));
      } finally {
        autonomySupervisor.start();
        backendAutomationSupervisor.start();
      }
    },
  });
  recoverPendingOutboundDeliveries({
    cfg: params.cfgAtStart,
    log: params.log,
  });
  return {
    heartbeatRunner: composeGatewayHeartbeatRunner(
      heartbeatRunner,
      autonomySupervisor,
      backendAutomationSupervisor,
    ),
  };
}
