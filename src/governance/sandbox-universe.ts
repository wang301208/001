import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getRuntimeConfigSnapshot, loadConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import {
  getGovernanceCapabilityInventory,
  planGovernanceGenesisWork,
  type GovernanceCapabilityInventoryResult,
  type GovernanceGenesisPlanResult,
} from "./capability-registry.js";
import {
  resolveGovernanceEnforcementState,
  type GovernanceEnforcementState,
} from "./charter-runtime.js";

const SANDBOX_UNIVERSE_STATE_LEDGER_VERSION = 1;
const SANDBOX_UNIVERSE_STORAGE_ROOT = path.join("governance", "sandbox-universe");

export type SandboxUniverseTargetKind =
  | "capability"
  | "strategy"
  | "algorithm"
  | "organization";

export type SandboxUniverseExperimentStageId =
  | "proposal"
  | "sandbox_validation"
  | "qa_replay"
  | "promotion_gate";

export type SandboxUniverseExperimentStage = {
  id: SandboxUniverseExperimentStageId;
  title: string;
  status: "planned" | "blocked";
  requiredEvidence: string[];
  blockers: string[];
};

export type SandboxUniverseReplayPlan = {
  scenarios: string[];
  workspaceDirs: string[];
  requiredOutputs: string[];
};

export type SandboxUniversePromotionGatePreview = {
  freezeActive: boolean;
  blockers: string[];
  requiredEvidence: string[];
};

export type SandboxUniverseEvidenceArtifactStatus =
  | "planned"
  | "collected"
  | "failed";

export type SandboxUniverseEvidenceArtifact = {
  id: string;
  status: SandboxUniverseEvidenceArtifactStatus;
  producedByAgentId?: string;
  note?: string;
  observedAt?: number;
  storagePath?: string;
  mediaType?: string;
  sizeBytes?: number;
  sha256?: string;
};

export type SandboxUniverseControllerStageStatus =
  | "planned"
  | "active"
  | "blocked"
  | "passed"
  | "failed";

export type SandboxUniverseControllerStageState = {
  id: SandboxUniverseExperimentStageId;
  title: string;
  status: SandboxUniverseControllerStageStatus;
  requiredEvidence: string[];
  blockers: string[];
  startedAt?: number;
  completedAt?: number;
};

export type SandboxUniverseControllerState = {
  observedAt: number;
  charterDir: string;
  universeId: string;
  target: SandboxUniverseExperimentPlan["target"];
  workspaceDirs: string[];
  activeStageId?: SandboxUniverseExperimentStageId;
  blockers: string[];
  evidence: SandboxUniverseEvidenceArtifact[];
  stages: SandboxUniverseControllerStageState[];
  statePath?: string;
  artifactDir?: string;
};

export type SandboxUniverseReplayRunnerState = {
  observedAt: number;
  charterDir: string;
  universeId: string;
  status: "ready" | "passed" | "failed";
  scenarios: string[];
  workspaceDirs: string[];
  requiredOutputs: string[];
  producedByAgentId?: string;
  blockers: string[];
  lastRun?: {
    observedAt: number;
    replayPassed: boolean;
    qaPassed: boolean;
    auditPassed: boolean;
    canPromote: boolean;
  };
  statePath?: string;
  artifactDir?: string;
};

export type SandboxUniverseExperimentPlan = {
  observedAt: number;
  charterDir: string;
  workspaceDirs: string[];
  universeId: string;
  requestedByAgentId?: string;
  target: {
    kind: SandboxUniverseTargetKind;
    id: string;
    title: string;
    focusGapIds: string[];
    teamId: string;
  };
  stages: SandboxUniverseExperimentStage[];
  replayPlan: SandboxUniverseReplayPlan;
  promotionGate: SandboxUniversePromotionGatePreview;
};

export type SandboxUniversePromotionGateDecision = {
  observedAt: number;
  charterDir: string;
  universeId: string;
  target: SandboxUniverseExperimentPlan["target"];
  qaPassed: boolean;
  replayPassed: boolean;
  auditPassed: boolean;
  freezeActive: boolean;
  blockers: string[];
  requiredEvidence: string[];
  canPromote: boolean;
};

export type SandboxUniverseReplayRunnerResult = {
  observedAt: number;
  controller: SandboxUniverseControllerState;
  replayRunner: SandboxUniverseReplayRunnerState;
  decision: SandboxUniversePromotionGateDecision;
};

export type SandboxUniverseStoragePaths = {
  stateDir: string;
  storageKey: string;
  rootDir: string;
  statePath: string;
  artifactDir: string;
};

export type SandboxUniverseStateSnapshot = {
  observedAt: number;
  storagePaths: SandboxUniverseStoragePaths;
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
};

type SandboxUniverseStateLedger = {
  version: number;
  observedAt: number;
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
};

type SandboxUniverseArtifactRenderParams = {
  artifactId: string;
  plan: SandboxUniverseExperimentPlan;
  controller: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
  observedAt: number;
  producedByAgentId?: string;
  replayPassed?: boolean;
  qaPassed?: boolean;
  auditPassed?: boolean;
};

type SandboxUniverseRenderedArtifact = {
  id: string;
  fileName: string;
  mediaType: string;
  content: string;
  status: SandboxUniverseEvidenceArtifactStatus;
  note?: string;
};

function resolveRuntimeConfig(cfg?: OpenClawConfig): OpenClawConfig {
  return cfg ?? getRuntimeConfigSnapshot() ?? loadConfig();
}

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function cloneSandboxUniverseEvidenceArtifact(
  artifact: SandboxUniverseEvidenceArtifact,
): SandboxUniverseEvidenceArtifact {
  return {
    ...artifact,
  };
}

function serializeSandboxUniverseArtifactJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildSandboxUniverseStorageKey(universeId: string): string {
  const normalized = normalizeOptionalString(universeId) ?? "sandbox-universe";
  const slug =
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 96) || "sandbox-universe";
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${slug}-${digest}`;
}

function resolveSandboxUniverseExistingStoragePaths(params: {
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
}): SandboxUniverseStoragePaths | undefined {
  const statePath = normalizeOptionalString(
    params.controller?.statePath ?? params.replayRunner?.statePath,
  );
  if (!statePath) {
    return undefined;
  }
  const rootDir = path.dirname(statePath);
  const artifactDir =
    normalizeOptionalString(params.controller?.artifactDir ?? params.replayRunner?.artifactDir) ??
    path.join(rootDir, "artifacts");
  return {
    stateDir: path.resolve(rootDir, "..", "..", ".."),
    storageKey: path.basename(rootDir),
    rootDir,
    statePath,
    artifactDir,
  };
}

function resolveSandboxUniverseWritableStoragePaths(params: {
  universeId: string;
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseStoragePaths | undefined {
  if (params.stateDir || params.env) {
    return resolveSandboxUniverseStoragePaths({
      universeId: params.universeId,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    });
  }
  return resolveSandboxUniverseExistingStoragePaths({
    controller: params.controller,
    replayRunner: params.replayRunner,
  });
}

function attachSandboxUniverseStorageMetadataToController(
  controller: SandboxUniverseControllerState,
  storagePaths: SandboxUniverseStoragePaths,
): SandboxUniverseControllerState {
  return {
    ...controller,
    evidence: controller.evidence.map((entry) => cloneSandboxUniverseEvidenceArtifact(entry)),
    statePath: storagePaths.statePath,
    artifactDir: storagePaths.artifactDir,
  };
}

function attachSandboxUniverseStorageMetadataToReplayRunner(
  replayRunner: SandboxUniverseReplayRunnerState,
  storagePaths: SandboxUniverseStoragePaths,
): SandboxUniverseReplayRunnerState {
  return {
    ...replayRunner,
    statePath: storagePaths.statePath,
    artifactDir: storagePaths.artifactDir,
  };
}

function writeSandboxUniverseArtifactSync(params: {
  storagePaths: SandboxUniverseStoragePaths;
  artifact: SandboxUniverseRenderedArtifact;
}): {
  storagePath: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
} {
  const storagePath = path.join(params.storagePaths.artifactDir, params.artifact.fileName);
  const buffer = Buffer.from(params.artifact.content, "utf8");
  fs.mkdirSync(params.storagePaths.artifactDir, { recursive: true });
  fs.writeFileSync(storagePath, buffer);
  return {
    storagePath,
    mediaType: params.artifact.mediaType,
    sizeBytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function buildSandboxUniverseRollbackReferenceId(params: {
  universeId: string;
  observedAt: number;
}): string {
  const digest = createHash("sha256")
    .update(`${params.universeId}:${params.observedAt}:rollback`)
    .digest("hex")
    .slice(0, 16);
  return `rollback.${digest}`;
}

function renderSandboxUniverseArtifact(
  params: SandboxUniverseArtifactRenderParams,
): SandboxUniverseRenderedArtifact | undefined {
  const producedByAgentId = normalizeOptionalString(params.producedByAgentId);
  switch (params.artifactId) {
    case "problem_statement":
      return {
        id: params.artifactId,
        fileName: "problem_statement.md",
        mediaType: "text/markdown",
        content: [
          "# Sandbox Problem Statement",
          "",
          `- Universe: ${params.plan.universeId}`,
          `- Target: ${params.plan.target.kind}:${params.plan.target.id}`,
          `- Target Team: ${params.plan.target.teamId}`,
          `- Requested By: ${params.plan.requestedByAgentId ?? "system"}`,
          `- Focus Gaps: ${params.plan.target.focusGapIds.join(", ") || "none"}`,
          "",
          "## Objective",
          `Validate the governed ${params.plan.target.kind} mutation inside the sandbox before promotion.`,
          "",
          "## Promotion Gate",
          `- Freeze Active: ${params.plan.promotionGate.freezeActive ? "yes" : "no"}`,
          `- Required Evidence: ${params.plan.promotionGate.requiredEvidence.join(", ")}`,
          "",
        ].join("\n"),
        status: "collected",
        note: "problem statement captured",
      };
    case "target_scope":
      return {
        id: params.artifactId,
        fileName: "target_scope.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          charterDir: params.plan.charterDir,
          workspaceDirs: params.plan.workspaceDirs,
          target: params.plan.target,
          stages: params.plan.stages,
          replayPlan: params.plan.replayPlan,
          promotionGate: params.plan.promotionGate,
        }),
        status: "collected",
        note: "sandbox target scope frozen",
      };
    case "sandbox_change_set":
      return {
        id: params.artifactId,
        fileName: "sandbox_change_set.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          target: params.plan.target,
          workspaceDirs: params.plan.workspaceDirs,
          scenarios: params.plan.replayPlan.scenarios,
          requiredOutputs: params.plan.replayPlan.requiredOutputs,
          producedByAgentId: producedByAgentId ?? null,
        }),
        status: params.replayPassed === true ? "collected" : "failed",
        note:
          params.replayPassed === true
            ? "sandbox candidate assembled"
            : "sandbox candidate did not validate",
      };
    case "replay_report":
      return {
        id: params.artifactId,
        fileName: "replay_report.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          replayPassed: params.replayPassed === true,
          scenarios: params.plan.replayPlan.scenarios,
          blockers: params.replayPassed === true ? [] : ["sandbox replay failed"],
          producedByAgentId: producedByAgentId ?? null,
        }),
        status: params.replayPassed === true ? "collected" : "failed",
        note:
          params.replayPassed === true
            ? "sandbox replay passed"
            : "sandbox replay failed",
      };
    case "qa_report":
      return {
        id: params.artifactId,
        fileName: "qa_report.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          qaPassed: params.qaPassed === true,
          reviewedOutputs: ["sandbox_change_set", "replay_report"],
          blockers: params.qaPassed === true ? [] : ["qa replay failed"],
          producedByAgentId: producedByAgentId ?? null,
        }),
        status: params.qaPassed === true ? "collected" : "failed",
        note: params.qaPassed === true ? "qa replay passed" : "qa replay failed",
      };
    case "audit_trace":
      return {
        id: params.artifactId,
        fileName: "audit_trace.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          auditPassed: params.auditPassed !== false,
          reviewedEvidence: [
            "sandbox_change_set",
            "replay_report",
            "qa_report",
            "rollback_reference",
          ],
          freezePreview: {
            active: params.plan.promotionGate.freezeActive,
            blockers: params.plan.promotionGate.blockers,
          },
          producedByAgentId: producedByAgentId ?? null,
        }),
        status: params.auditPassed === false ? "failed" : "collected",
        note:
          params.auditPassed === false ? "audit trace failed" : "audit trace captured",
      };
    case "rollback_reference":
      return {
        id: params.artifactId,
        fileName: "rollback_reference.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          rollbackId: buildSandboxUniverseRollbackReferenceId({
            universeId: params.plan.universeId,
            observedAt: params.observedAt,
          }),
          target: params.plan.target,
          workspaceDirs: params.plan.workspaceDirs,
          producedByAgentId: producedByAgentId ?? null,
        }),
        status: "collected",
        note: "rollback reference captured",
      };
    case "promotion_manifest":
      if (!params.decision) {
        return undefined;
      }
      return {
        id: params.artifactId,
        fileName: "promotion_manifest.json",
        mediaType: "application/json",
        content: serializeSandboxUniverseArtifactJson({
          observedAt: params.observedAt,
          universeId: params.plan.universeId,
          decision: params.decision,
          replayRunner: params.replayRunner
            ? {
                status: params.replayRunner.status,
                scenarios: params.replayRunner.scenarios,
                requiredOutputs: params.replayRunner.requiredOutputs,
              }
            : null,
          controller: {
            activeStageId: params.controller.activeStageId ?? null,
            blockers: params.controller.blockers,
          },
        }),
        status: params.decision.canPromote ? "collected" : "planned",
        note:
          params.decision.canPromote
            ? "promotion manifest ready"
            : "promotion remains blocked",
      };
    default:
      return undefined;
  }
}

function persistSandboxUniverseArtifactsSync(params: {
  plan: SandboxUniverseExperimentPlan;
  controller: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
  artifactIds: string[];
  observedAt: number;
  producedByAgentId?: string;
  replayPassed?: boolean;
  qaPassed?: boolean;
  auditPassed?: boolean;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): {
  storagePaths: SandboxUniverseStoragePaths;
  controller: SandboxUniverseControllerState;
} | undefined {
  const storagePaths = resolveSandboxUniverseWritableStoragePaths({
    universeId: params.plan.universeId,
    controller: params.controller,
    replayRunner: params.replayRunner,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  if (!storagePaths) {
    return undefined;
  }
  const evidenceById = new Map(
    params.controller.evidence.map((entry) => [entry.id, cloneSandboxUniverseEvidenceArtifact(entry)]),
  );
  for (const artifactId of collectUniqueStrings(params.artifactIds)) {
    const rendered = renderSandboxUniverseArtifact({
      artifactId,
      plan: params.plan,
      controller: params.controller,
      replayRunner: params.replayRunner,
      decision: params.decision,
      observedAt: params.observedAt,
      ...(params.producedByAgentId ? { producedByAgentId: params.producedByAgentId } : {}),
      ...(params.replayPassed !== undefined ? { replayPassed: params.replayPassed } : {}),
      ...(params.qaPassed !== undefined ? { qaPassed: params.qaPassed } : {}),
      ...(params.auditPassed !== undefined ? { auditPassed: params.auditPassed } : {}),
    });
    if (!rendered) {
      continue;
    }
    const written = writeSandboxUniverseArtifactSync({
      storagePaths,
      artifact: rendered,
    });
    const previous = evidenceById.get(artifactId);
    evidenceById.set(artifactId, {
      ...(previous ?? {
        id: artifactId,
        status: rendered.status,
      }),
      status: rendered.status,
      ...(params.producedByAgentId
        ? { producedByAgentId: params.producedByAgentId }
        : previous?.producedByAgentId
          ? { producedByAgentId: previous.producedByAgentId }
          : {}),
      ...(rendered.note
        ? { note: rendered.note }
        : previous?.note
          ? { note: previous.note }
          : {}),
      observedAt: params.observedAt,
      storagePath: written.storagePath,
      mediaType: written.mediaType,
      sizeBytes: written.sizeBytes,
      sha256: written.sha256,
    });
  }
  return {
    storagePaths,
    controller: attachSandboxUniverseStorageMetadataToController(
      {
        ...params.controller,
        observedAt: params.observedAt,
        evidence: [...evidenceById.values()].toSorted((left, right) =>
          left.id.localeCompare(right.id),
        ),
      },
      storagePaths,
    ),
  };
}

function readSandboxUniverseStateLedgerByPathSync(
  statePath: string,
): SandboxUniverseStateLedger | undefined {
  if (!fs.existsSync(statePath)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.plan)) {
      return undefined;
    }
    return parsed as SandboxUniverseStateLedger;
  } catch {
    return undefined;
  }
}

function resolveSandboxUniverseStoragePathsFromStatePath(
  statePath: string,
): SandboxUniverseStoragePaths {
  const rootDir = path.dirname(statePath);
  return {
    stateDir: path.resolve(rootDir, "..", "..", ".."),
    storageKey: path.basename(rootDir),
    rootDir,
    statePath,
    artifactDir: path.join(rootDir, "artifacts"),
  };
}

function resolveSandboxUniverseGatePersistedState(params: {
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseStateSnapshot | undefined {
  const existingStatePath = normalizeOptionalString(params.controller?.statePath);
  if (existingStatePath) {
    const ledger = readSandboxUniverseStateLedgerByPathSync(existingStatePath);
    if (!ledger) {
      return undefined;
    }
    const storagePaths = resolveSandboxUniverseExistingStoragePaths({
      controller: params.controller,
    });
    if (!storagePaths) {
      return undefined;
    }
    return {
      observedAt:
        typeof ledger.observedAt === "number" && Number.isFinite(ledger.observedAt)
          ? ledger.observedAt
          : params.plan.observedAt,
      storagePaths,
      plan: ledger.plan,
      ...(ledger.controller
        ? {
            controller: attachSandboxUniverseStorageMetadataToController(
              ledger.controller,
              storagePaths,
            ),
          }
        : {}),
      ...(ledger.replayRunner
        ? {
            replayRunner: attachSandboxUniverseStorageMetadataToReplayRunner(
              ledger.replayRunner,
              storagePaths,
            ),
          }
        : {}),
      ...(ledger.decision ? { decision: ledger.decision } : {}),
    };
  }
  if (!params.stateDir && !params.env) {
    return undefined;
  }
  return loadSandboxUniverseStateSync({
    universeId: params.plan.universeId,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
}

function collectSandboxUniversePersistedEvidenceBlockers(params: {
  requiredEvidence: string[];
  controller?: SandboxUniverseControllerState;
}): string[] {
  const evidenceById = new Map(
    (params.controller?.evidence ?? []).map((entry) => [entry.id, entry] as const),
  );
  return params.requiredEvidence.flatMap((id) => {
    const entry = evidenceById.get(id);
    if (!entry) {
      return [`required evidence not persisted: ${id}`];
    }
    if (entry.status !== "collected") {
      return [`required evidence not collected: ${id}`];
    }
    const storagePath = normalizeOptionalString(entry.storagePath);
    if (!storagePath || !fs.existsSync(storagePath)) {
      return [`required evidence missing on disk: ${id}`];
    }
    return [];
  });
}

export function resolveSandboxUniverseStoragePaths(params: {
  universeId: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseStoragePaths {
  const stateDir = params.stateDir ?? resolveStateDir(params.env);
  const storageKey = buildSandboxUniverseStorageKey(params.universeId);
  const rootDir = path.join(stateDir, SANDBOX_UNIVERSE_STORAGE_ROOT, storageKey);
  return {
    stateDir,
    storageKey,
    rootDir,
    statePath: path.join(rootDir, "state.json"),
    artifactDir: path.join(rootDir, "artifacts"),
  };
}

export function loadSandboxUniverseStateSync(params: {
  universeId: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseStateSnapshot | undefined {
  const storagePaths = resolveSandboxUniverseStoragePaths(params);
  const ledger = readSandboxUniverseStateLedgerByPathSync(storagePaths.statePath);
  if (!ledger) {
    return undefined;
  }
  return {
    observedAt:
      typeof ledger.observedAt === "number" && Number.isFinite(ledger.observedAt)
        ? ledger.observedAt
        : ledger.plan.observedAt,
    storagePaths,
    plan: ledger.plan,
    ...(ledger.controller
      ? {
          controller: attachSandboxUniverseStorageMetadataToController(
            ledger.controller,
            storagePaths,
          ),
        }
      : {}),
    ...(ledger.replayRunner
      ? {
          replayRunner: attachSandboxUniverseStorageMetadataToReplayRunner(
            ledger.replayRunner,
            storagePaths,
          ),
        }
      : {}),
      ...(ledger.decision ? { decision: ledger.decision } : {}),
  };
}

export function loadSandboxUniverseStateByPathSync(
  statePath: string,
): SandboxUniverseStateSnapshot | undefined {
  const normalizedStatePath = normalizeOptionalString(statePath);
  if (!normalizedStatePath) {
    return undefined;
  }
  const storagePaths = resolveSandboxUniverseStoragePathsFromStatePath(normalizedStatePath);
  const ledger = readSandboxUniverseStateLedgerByPathSync(storagePaths.statePath);
  if (!ledger) {
    return undefined;
  }
  return {
    observedAt:
      typeof ledger.observedAt === "number" && Number.isFinite(ledger.observedAt)
        ? ledger.observedAt
        : ledger.plan.observedAt,
    storagePaths,
    plan: ledger.plan,
    ...(ledger.controller
      ? {
          controller: attachSandboxUniverseStorageMetadataToController(
            ledger.controller,
            storagePaths,
          ),
        }
      : {}),
    ...(ledger.replayRunner
      ? {
          replayRunner: attachSandboxUniverseStorageMetadataToReplayRunner(
            ledger.replayRunner,
            storagePaths,
          ),
        }
      : {}),
    ...(ledger.decision ? { decision: ledger.decision } : {}),
  };
}

export function syncSandboxUniverseStateSync(params: {
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  decision?: SandboxUniversePromotionGateDecision;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseStateSnapshot {
  const storagePaths = resolveSandboxUniverseWritableStoragePaths({
    universeId: params.plan.universeId,
    controller: params.controller,
    replayRunner: params.replayRunner,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  if (!storagePaths) {
    throw new Error(
      "Sandbox universe state sync requires stateDir, env, or an existing controller/replayRunner statePath.",
    );
  }
  const controller = params.controller
    ? attachSandboxUniverseStorageMetadataToController(params.controller, storagePaths)
    : undefined;
  const replayRunner = params.replayRunner
    ? attachSandboxUniverseStorageMetadataToReplayRunner(params.replayRunner, storagePaths)
    : undefined;
  const observedAt =
    params.observedAt ??
    params.decision?.observedAt ??
    replayRunner?.observedAt ??
    controller?.observedAt ??
    params.plan.observedAt;
  const ledger: SandboxUniverseStateLedger = {
    version: SANDBOX_UNIVERSE_STATE_LEDGER_VERSION,
    observedAt,
    plan: params.plan,
    ...(controller ? { controller } : {}),
    ...(replayRunner ? { replayRunner } : {}),
    ...(params.decision ? { decision: params.decision } : {}),
  };
  fs.mkdirSync(storagePaths.rootDir, { recursive: true });
  fs.writeFileSync(storagePaths.statePath, serializeSandboxUniverseArtifactJson(ledger), "utf8");
  return {
    observedAt,
    storagePaths,
    plan: params.plan,
    ...(controller ? { controller } : {}),
    ...(replayRunner ? { replayRunner } : {}),
    ...(params.decision ? { decision: params.decision } : {}),
  };
}

function resolveSandboxUniverseTarget(params: {
  inventory: GovernanceCapabilityInventoryResult;
  genesisPlan: GovernanceGenesisPlanResult;
  targetKind?: SandboxUniverseTargetKind;
  targetId?: string;
}): SandboxUniverseExperimentPlan["target"] {
  const explicitTargetId = normalizeOptionalString(params.targetId);
  const focusGapIds = params.genesisPlan.focusGapIds.length
    ? [...params.genesisPlan.focusGapIds]
    : params.inventory.gaps.slice(0, 5).map((entry) => entry.id);
  const focusGapTitles = params.inventory.gaps
    .filter((entry) => focusGapIds.includes(entry.id))
    .map((entry) => entry.title);
  const kind = params.targetKind ?? "capability";
  const derivedId =
    explicitTargetId ??
    (kind === "organization"
      ? params.genesisPlan.teamId
      : focusGapIds[0] ?? `${params.genesisPlan.teamId}.${kind}`);
  const title =
    kind === "organization"
      ? params.genesisPlan.teamTitle ?? params.genesisPlan.teamId
      : focusGapTitles[0] ?? `${kind}:${derivedId}`;
  return {
    kind,
    id: derivedId,
    title,
    focusGapIds,
    teamId: params.genesisPlan.teamId,
  };
}

function buildReplayPlan(params: {
  target: SandboxUniverseExperimentPlan["target"];
  workspaceDirs: string[];
}): SandboxUniverseReplayPlan {
  const scenarios = collectUniqueStrings([
    params.target.focusGapIds.length > 0
      ? `replay:${params.target.focusGapIds[0]}`
      : `replay:${params.target.id}`,
    `workspace:${params.workspaceDirs[0] ?? "n/a"}`,
    `target:${params.target.kind}:${params.target.id}`,
  ]);
  return {
    scenarios,
    workspaceDirs: [...params.workspaceDirs],
    requiredOutputs: [
      "sandbox_change_set",
      "replay_report",
      "qa_report",
      "audit_trace",
      "rollback_reference",
      "promotion_manifest",
    ],
  };
}

function buildPromotionGatePreview(
  enforcement: GovernanceEnforcementState,
): SandboxUniversePromotionGatePreview {
  return {
    freezeActive: enforcement.active,
    blockers: enforcement.active
      ? [
          enforcement.message ??
            "governance freeze is active; sandbox promotion cannot reach the governed runtime yet",
        ]
      : [],
    requiredEvidence: [
      "sandbox_change_set",
      "replay_report",
      "qa_report",
      "audit_trace",
      "rollback_reference",
    ],
  };
}

function buildExperimentStages(params: {
  promotionGate: SandboxUniversePromotionGatePreview;
}): SandboxUniverseExperimentStage[] {
  return [
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
      status: params.promotionGate.freezeActive ? "blocked" : "planned",
      requiredEvidence: [...params.promotionGate.requiredEvidence],
      blockers: [...params.promotionGate.blockers],
    },
  ];
}

function collectRequiredEvidence(plan: SandboxUniverseExperimentPlan): string[] {
  return collectUniqueStrings(plan.stages.flatMap((stage) => stage.requiredEvidence));
}

function buildControllerEvidence(
  plan: SandboxUniverseExperimentPlan,
): SandboxUniverseEvidenceArtifact[] {
  return collectRequiredEvidence(plan).map((id) => ({
    id,
    status:
      id === "problem_statement" || id === "target_scope" ? "collected" : "planned",
    observedAt:
      id === "problem_statement" || id === "target_scope" ? plan.observedAt : undefined,
  }));
}

function resolveControllerStageStates(params: {
  plan: SandboxUniverseExperimentPlan;
  observedAt: number;
  activeStageId?: SandboxUniverseExperimentStageId;
  failedStageId?: SandboxUniverseExperimentStageId;
  passedStageIds?: string[];
}): SandboxUniverseControllerStageState[] {
  const passedStageIds = new Set(params.passedStageIds ?? []);
  return params.plan.stages.map((stage, index) => {
    const base = {
      id: stage.id,
      title: stage.title,
      requiredEvidence: [...stage.requiredEvidence],
      blockers: [...stage.blockers],
    };
    if (passedStageIds.has(stage.id)) {
      return {
        ...base,
        status: "passed" as const,
        completedAt: params.observedAt,
      };
    }
    if (params.failedStageId === stage.id) {
      return {
        ...base,
        status: "failed" as const,
        startedAt: params.observedAt,
        completedAt: params.observedAt,
      };
    }
    if (
      stage.id === "promotion_gate" &&
      stage.status === "blocked" &&
      params.activeStageId === stage.id
    ) {
      return {
        ...base,
        status: "blocked" as const,
      };
    }
    if (params.activeStageId === stage.id) {
      return {
        ...base,
        status: "active" as const,
        startedAt: params.observedAt,
      };
    }
    if (stage.id === "promotion_gate" && stage.status === "blocked") {
      return {
        ...base,
        status: "blocked" as const,
      };
    }
    if (index > 0 && params.failedStageId && !passedStageIds.has(stage.id)) {
      return {
        ...base,
        status: stage.id === "promotion_gate" ? "blocked" : "planned",
      };
    }
    return {
      ...base,
      status: "planned" as const,
    };
  });
}

export function planSandboxUniverseExperiment(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  workspaceDirs?: string[];
  observedAt?: number;
  requestedByAgentId?: string;
  targetKind?: SandboxUniverseTargetKind;
  targetId?: string;
  inventory?: GovernanceCapabilityInventoryResult;
  genesisPlan?: GovernanceGenesisPlanResult;
} = {}): SandboxUniverseExperimentPlan {
  const cfg = resolveRuntimeConfig(params.cfg);
  const inventory =
    params.inventory ??
    getGovernanceCapabilityInventory({
      cfg,
      charterDir: params.charterDir,
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      observedAt: params.observedAt,
    });
  const genesisPlan =
    params.genesisPlan ??
    planGovernanceGenesisWork({
      cfg,
      charterDir: params.charterDir,
      ...(inventory.workspaceDirs.length ? { workspaceDirs: inventory.workspaceDirs } : {}),
      observedAt: params.observedAt,
      inventory,
    });
  const enforcement = resolveGovernanceEnforcementState(cfg, {
    charterDir: params.charterDir,
  });
  const target = resolveSandboxUniverseTarget({
    inventory,
    genesisPlan,
    targetKind: params.targetKind,
    targetId: params.targetId,
  });
  const replayPlan = buildReplayPlan({
    target,
    workspaceDirs: [...inventory.workspaceDirs],
  });
  const promotionGate = buildPromotionGatePreview(enforcement);
  const requestedByAgentId = normalizeOptionalString(params.requestedByAgentId)
    ? normalizeAgentId(params.requestedByAgentId)
    : undefined;
  return {
    observedAt: params.observedAt ?? Date.now(),
    charterDir: inventory.charterDir,
    workspaceDirs: [...inventory.workspaceDirs],
    universeId: [
      "sandbox",
      requestedByAgentId ?? "system",
      target.kind,
      target.id,
    ].join("/"),
    ...(requestedByAgentId ? { requestedByAgentId } : {}),
    target,
    stages: buildExperimentStages({
      promotionGate,
    }),
    replayPlan,
    promotionGate,
  };
}

export function createSandboxUniverseController(params: {
  plan: SandboxUniverseExperimentPlan;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseControllerState {
  const observedAt = params.observedAt ?? params.plan.observedAt;
  const passedStageIds = ["proposal"];
  const activeStageId = params.plan.stages.some((stage) => stage.id === "sandbox_validation")
    ? "sandbox_validation"
    : undefined;
  const controller: SandboxUniverseControllerState = {
    observedAt,
    charterDir: params.plan.charterDir,
    universeId: params.plan.universeId,
    target: params.plan.target,
    workspaceDirs: [...params.plan.workspaceDirs],
    ...(activeStageId ? { activeStageId } : {}),
    blockers: [...params.plan.promotionGate.blockers],
    evidence: buildControllerEvidence(params.plan),
    stages: resolveControllerStageStates({
      plan: params.plan,
      observedAt,
      activeStageId,
      passedStageIds,
    }),
  };
  const persisted = persistSandboxUniverseArtifactsSync({
    plan: params.plan,
    controller,
    artifactIds: ["problem_statement", "target_scope"],
    observedAt,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  if (!persisted) {
    return controller;
  }
  return syncSandboxUniverseStateSync({
    plan: params.plan,
    controller: persisted.controller,
    observedAt,
    stateDir: persisted.storagePaths.stateDir,
  }).controller ?? controller;
}

export function createSandboxUniverseReplayRunner(params: {
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  observedAt?: number;
  producedByAgentId?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseReplayRunnerState {
  const observedAt = params.observedAt ?? params.plan.observedAt;
  const replayRunner: SandboxUniverseReplayRunnerState = {
    observedAt,
    charterDir: params.plan.charterDir,
    universeId: params.plan.universeId,
    status: "ready",
    scenarios: [...params.plan.replayPlan.scenarios],
    workspaceDirs: [...params.plan.replayPlan.workspaceDirs],
    requiredOutputs: [...params.plan.replayPlan.requiredOutputs],
    ...(params.producedByAgentId
      ? { producedByAgentId: normalizeAgentId(params.producedByAgentId) }
      : {}),
    blockers: [...(params.controller?.blockers ?? params.plan.promotionGate.blockers)],
  };
  const storagePaths = resolveSandboxUniverseWritableStoragePaths({
    universeId: params.plan.universeId,
    controller: params.controller,
    replayRunner,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  if (!storagePaths) {
    return replayRunner;
  }
  return (
    syncSandboxUniverseStateSync({
      plan: params.plan,
      ...(params.controller ? { controller: params.controller } : {}),
      replayRunner: attachSandboxUniverseStorageMetadataToReplayRunner(
        replayRunner,
        storagePaths,
      ),
      observedAt,
      stateDir: storagePaths.stateDir,
    }).replayRunner ?? replayRunner
  );
}

export function evaluateSandboxUniversePromotionGate(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  qaPassed: boolean;
  replayPassed: boolean;
  auditPassed?: boolean;
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniversePromotionGateDecision {
  const cfg = resolveRuntimeConfig(params.cfg);
  const enforcement = resolveGovernanceEnforcementState(cfg, {
    charterDir: params.charterDir ?? params.plan.charterDir,
  });
  const qaPassed = params.qaPassed;
  const replayPassed = params.replayPassed;
  const auditPassed = params.auditPassed !== false;
  const usePersistedEvidence = Boolean(
    params.stateDir || params.env || normalizeOptionalString(params.controller?.statePath),
  );
  const persistedState = usePersistedEvidence
    ? resolveSandboxUniverseGatePersistedState({
        plan: params.plan,
        ...(params.controller ? { controller: params.controller } : {}),
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
        ...(params.env ? { env: params.env } : {}),
      })
    : undefined;
  const persistedEvidenceBlockers = usePersistedEvidence
    ? collectSandboxUniversePersistedEvidenceBlockers({
        requiredEvidence: params.plan.promotionGate.requiredEvidence,
        controller: persistedState?.controller,
      })
    : [];
  const blockers = collectUniqueStrings([
    ...params.plan.promotionGate.blockers,
    ...(qaPassed ? [] : ["qa validation did not pass"]),
    ...(replayPassed ? [] : ["sandbox replay did not pass"]),
    ...(auditPassed ? [] : ["audit trace is incomplete or failed"]),
    ...persistedEvidenceBlockers,
    ...(enforcement.active && params.plan.promotionGate.blockers.length === 0
      ? [
          enforcement.message ??
            "governance freeze is active; sandbox promotion cannot reach the governed runtime yet",
        ]
      : []),
  ]);
  return {
    observedAt: params.observedAt ?? Date.now(),
    charterDir: params.plan.charterDir,
    universeId: params.plan.universeId,
    target: params.plan.target,
    qaPassed,
    replayPassed,
    auditPassed,
    freezeActive: enforcement.active,
    blockers,
    requiredEvidence: [...params.plan.promotionGate.requiredEvidence],
    canPromote: qaPassed && replayPassed && auditPassed && blockers.length === 0,
  };
}

export function runSandboxUniverseReplayRunner(params: {
  cfg?: OpenClawConfig;
  charterDir?: string;
  plan: SandboxUniverseExperimentPlan;
  controller?: SandboxUniverseControllerState;
  replayRunner?: SandboxUniverseReplayRunnerState;
  replayPassed: boolean;
  qaPassed: boolean;
  auditPassed?: boolean;
  observedAt?: number;
  producedByAgentId?: string;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): SandboxUniverseReplayRunnerResult {
  const observedAt = params.observedAt ?? Date.now();
  const producedByAgentId = normalizeOptionalString(params.producedByAgentId)
    ? normalizeAgentId(params.producedByAgentId)
    : undefined;
  const controller =
    params.controller ??
    createSandboxUniverseController({
      plan: params.plan,
      observedAt,
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    });
  const replayRunner =
    params.replayRunner ??
    createSandboxUniverseReplayRunner({
      plan: params.plan,
      controller,
      observedAt,
      ...(producedByAgentId ? { producedByAgentId } : {}),
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      ...(params.env ? { env: params.env } : {}),
    });
  const evidenceById = new Map(
    controller.evidence.map((entry) => [entry.id, cloneSandboxUniverseEvidenceArtifact(entry)]),
  );
  const markEvidence = (
    id: string,
    status: SandboxUniverseEvidenceArtifactStatus,
    note?: string,
  ) => {
    const previous = evidenceById.get(id);
    evidenceById.set(id, {
      ...(previous ?? {
        id,
        status,
      }),
      status,
      ...(producedByAgentId
        ? { producedByAgentId }
        : previous?.producedByAgentId
          ? { producedByAgentId: previous.producedByAgentId }
          : {}),
      ...(note
        ? { note }
        : previous?.note
          ? { note: previous.note }
          : {}),
      observedAt,
    });
  };
  markEvidence("problem_statement", "collected", "problem statement captured");
  markEvidence("target_scope", "collected", "sandbox target scope frozen");
  markEvidence(
    "sandbox_change_set",
    params.replayPassed ? "collected" : "failed",
    params.replayPassed ? "sandbox candidate assembled" : "sandbox candidate did not validate",
  );
  markEvidence(
    "replay_report",
    params.replayPassed ? "collected" : "failed",
    params.replayPassed ? "sandbox replay passed" : "sandbox replay failed",
  );
  markEvidence(
    "qa_report",
    params.qaPassed ? "collected" : "failed",
    params.qaPassed ? "qa replay passed" : "qa replay failed",
  );
  markEvidence(
    "audit_trace",
    params.auditPassed === false ? "failed" : "collected",
    params.auditPassed === false ? "audit trace failed" : "audit trace captured",
  );
  markEvidence(
    "rollback_reference",
    "collected",
    "rollback reference captured",
  );
  const failedStageId: SandboxUniverseExperimentStageId | undefined = !params.replayPassed
    ? "sandbox_validation"
    : !params.qaPassed
      ? "qa_replay"
      : undefined;
  const passedStageIds: SandboxUniverseExperimentStageId[] = [
    "proposal",
    ...(params.replayPassed ? (["sandbox_validation"] as const) : []),
    ...(params.replayPassed && params.qaPassed ? (["qa_replay"] as const) : []),
  ];
  const provisionalActiveStageId: SandboxUniverseExperimentStageId | undefined =
    !params.replayPassed
      ? "sandbox_validation"
      : !params.qaPassed
        ? "qa_replay"
        : params.plan.promotionGate.freezeActive
          ? undefined
          : "promotion_gate";
  let provisionalController: SandboxUniverseControllerState = {
    observedAt,
    charterDir: controller.charterDir,
    universeId: controller.universeId,
    target: controller.target,
    workspaceDirs: [...controller.workspaceDirs],
    ...(provisionalActiveStageId ? { activeStageId: provisionalActiveStageId } : {}),
    blockers: [...controller.blockers],
    evidence: [...evidenceById.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
    stages: resolveControllerStageStates({
      plan: params.plan,
      observedAt,
      activeStageId: provisionalActiveStageId,
      failedStageId,
      passedStageIds,
    }),
  };
  const persistedPreDecision = persistSandboxUniverseArtifactsSync({
    plan: params.plan,
    controller: provisionalController,
    replayRunner,
    artifactIds: [
      "problem_statement",
      "target_scope",
      "sandbox_change_set",
      "replay_report",
      "qa_report",
      "audit_trace",
      "rollback_reference",
    ],
    observedAt,
    ...(producedByAgentId ? { producedByAgentId } : {}),
    replayPassed: params.replayPassed,
    qaPassed: params.qaPassed,
    auditPassed: params.auditPassed,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const preDecisionStoragePaths = persistedPreDecision?.storagePaths;
  provisionalController = persistedPreDecision?.controller ?? provisionalController;
  if (preDecisionStoragePaths) {
    syncSandboxUniverseStateSync({
      plan: params.plan,
      controller: provisionalController,
      replayRunner: attachSandboxUniverseStorageMetadataToReplayRunner(
        replayRunner,
        preDecisionStoragePaths,
      ),
      observedAt,
      stateDir: preDecisionStoragePaths.stateDir,
    });
  }
  const decision = evaluateSandboxUniversePromotionGate({
    cfg: params.cfg,
    charterDir: params.charterDir,
    plan: params.plan,
    controller: provisionalController,
    qaPassed: params.qaPassed,
    replayPassed: params.replayPassed,
    auditPassed: params.auditPassed,
    observedAt,
    ...(preDecisionStoragePaths ? { stateDir: preDecisionStoragePaths.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const finalEvidenceById = new Map(
    provisionalController.evidence.map((entry) => [entry.id, cloneSandboxUniverseEvidenceArtifact(entry)]),
  );
  finalEvidenceById.set("promotion_manifest", {
    ...(finalEvidenceById.get("promotion_manifest") ?? {
      id: "promotion_manifest",
      status: decision.canPromote ? "collected" : "planned",
    }),
    status: decision.canPromote ? "collected" : "planned",
    ...(producedByAgentId ? { producedByAgentId } : {}),
    note: decision.canPromote ? "promotion manifest ready" : "promotion remains blocked",
    observedAt,
  });
  const nextActiveStageId: SandboxUniverseExperimentStageId | undefined =
    decision.canPromote
      ? undefined
      : !params.replayPassed
        ? "sandbox_validation"
        : !params.qaPassed
          ? "qa_replay"
          : decision.freezeActive
            ? undefined
            : "promotion_gate";
  const nextControllerBase: SandboxUniverseControllerState = {
    observedAt,
    charterDir: controller.charterDir,
    universeId: controller.universeId,
    target: controller.target,
    workspaceDirs: [...controller.workspaceDirs],
    ...(nextActiveStageId ? { activeStageId: nextActiveStageId } : {}),
    blockers: [...decision.blockers],
    evidence: [...finalEvidenceById.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
    stages: resolveControllerStageStates({
      plan: params.plan,
      observedAt,
      activeStageId: nextActiveStageId,
      failedStageId,
      passedStageIds: [
        ...passedStageIds,
        ...(decision.canPromote ? (["promotion_gate"] as const) : []),
      ],
    }),
  };
  const nextReplayRunnerBase: SandboxUniverseReplayRunnerState = {
    ...replayRunner,
    observedAt,
    charterDir: params.plan.charterDir,
    universeId: params.plan.universeId,
    status:
      params.replayPassed && params.qaPassed && (params.auditPassed ?? true)
        ? "passed"
        : "failed",
    scenarios: [...params.plan.replayPlan.scenarios],
    workspaceDirs: [...params.plan.replayPlan.workspaceDirs],
    requiredOutputs: [...params.plan.replayPlan.requiredOutputs],
    ...(producedByAgentId ? { producedByAgentId } : {}),
    blockers: [...decision.blockers],
    lastRun: {
      observedAt,
      replayPassed: params.replayPassed,
      qaPassed: params.qaPassed,
      auditPassed: params.auditPassed !== false,
      canPromote: decision.canPromote,
    },
  };
  const persistedFinalArtifacts = persistSandboxUniverseArtifactsSync({
    plan: params.plan,
    controller: nextControllerBase,
    replayRunner: nextReplayRunnerBase,
    decision,
    artifactIds: ["promotion_manifest"],
    observedAt,
    ...(producedByAgentId ? { producedByAgentId } : {}),
    replayPassed: params.replayPassed,
    qaPassed: params.qaPassed,
    auditPassed: params.auditPassed,
    ...(preDecisionStoragePaths ? { stateDir: preDecisionStoragePaths.stateDir } : {}),
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  const finalStoragePaths = persistedFinalArtifacts?.storagePaths ?? preDecisionStoragePaths;
  const finalController =
    persistedFinalArtifacts?.controller ??
    (finalStoragePaths
      ? attachSandboxUniverseStorageMetadataToController(nextControllerBase, finalStoragePaths)
      : nextControllerBase);
  const finalReplayRunner = finalStoragePaths
    ? attachSandboxUniverseStorageMetadataToReplayRunner(nextReplayRunnerBase, finalStoragePaths)
    : nextReplayRunnerBase;
  if (finalStoragePaths) {
    const persisted = syncSandboxUniverseStateSync({
      plan: params.plan,
      controller: finalController,
      replayRunner: finalReplayRunner,
      decision,
      observedAt,
      stateDir: finalStoragePaths.stateDir,
    });
    return {
      observedAt,
      controller: persisted.controller ?? finalController,
      replayRunner: persisted.replayRunner ?? finalReplayRunner,
      decision,
    };
  }
  return {
    observedAt,
    controller: finalController,
    replayRunner: finalReplayRunner,
    decision,
  };
}
