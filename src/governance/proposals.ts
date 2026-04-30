import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { appendAuditFact, type AuditActorType } from "../infra/audit-stream.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import { loadGovernanceCharter } from "./charter-runtime.js";

const DEFAULT_PROPOSAL_LIMIT = 50;
const MAX_PROPOSAL_LIMIT = 200;
const GOVERNANCE_PROPOSAL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;

export type GovernanceProposalStatus = "pending" | "approved" | "rejected" | "applied";
export type GovernanceProposalDecision = "approve" | "reject";
export type GovernanceProposalOperationKind = "write" | "delete";

export type GovernanceProposalOperation = {
  kind: GovernanceProposalOperationKind;
  path: string;
  content?: string;
};

export type GovernanceProposalRiskLevel = "safe" | "elevated" | "sovereign";

export type GovernanceProposalClassification = {
  level: GovernanceProposalRiskLevel;
  reasons: string[];
  touchedPaths: string[];
  hasDeleteOperations: boolean;
  requiresHumanSovereignApproval: boolean;
};

export type GovernanceProposalReviewRecord = {
  decision: GovernanceProposalDecision;
  decidedAt: number;
  decidedBy: string;
  decidedByType: AuditActorType;
  decisionNote?: string;
};

export type GovernanceProposalApplyRecord = {
  appliedAt: number;
  appliedBy: string;
  appliedByType: AuditActorType;
  writtenPaths: string[];
  ledgerPath?: string;
  revertedAt?: number;
  revertedBy?: string;
  restoredPaths?: string[];
};

export type GovernanceProposalApplySnapshot = {
  kind: GovernanceProposalOperationKind;
  path: string;
  repoRelativePath: string;
  existedBefore: boolean;
  previousContent?: string;
  previousContentSha256?: string;
};

export type GovernanceProposalApplyLedgerStatus = "prepared" | "applied" | "reverted";

export type GovernanceProposalApplyLedger = {
  proposalId: string;
  proposalTitle: string;
  charterDir: string;
  storageDir: string;
  ledgerPath: string;
  status: GovernanceProposalApplyLedgerStatus;
  appliedAt: number;
  appliedBy: string;
  writtenPaths: string[];
  snapshots: GovernanceProposalApplySnapshot[];
  revertedAt?: number;
  revertedBy?: string;
  restoredPaths?: string[];
};

export type GovernanceProposalRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdByAgentId?: string;
  createdBySessionKey?: string;
  title: string;
  rationale?: string;
  status: GovernanceProposalStatus;
  operations: GovernanceProposalOperation[];
  classification: GovernanceProposalClassification;
  review?: GovernanceProposalReviewRecord;
  apply?: GovernanceProposalApplyRecord;
};

export type GovernanceProposalSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  applied: number;
  latestCreatedAt?: number;
  latestUpdatedAt?: number;
};

export type GovernanceProposalLedger = GovernanceProposalSummary & {
  storageDir: string;
};

export type GovernanceProposalListResult = {
  storageDir: string;
  summary: GovernanceProposalSummary;
  proposals: GovernanceProposalRecord[];
};

export type GovernanceProposalBatchSelection = {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
  matchedProposalIds: string[];
};

export type GovernanceProposalBatchEntry = {
  proposalId: string;
  ok: boolean;
  title?: string;
  statusBefore?: GovernanceProposalStatus;
  statusAfter?: GovernanceProposalStatus;
  reason?: string;
  ledgerPath?: string;
  writtenPaths?: string[];
  restoredPaths?: string[];
};

export type GovernanceProposalCreateResult = {
  storageDir: string;
  proposal: GovernanceProposalRecord;
};

export type GovernanceProposalReviewResult = {
  storageDir: string;
  proposal: GovernanceProposalRecord;
};

export type GovernanceProposalApplyResult = {
  storageDir: string;
  charterDir: string;
  ledgerPath: string;
  proposal: GovernanceProposalRecord;
  writtenPaths: string[];
};

export type GovernanceProposalRevertResult = {
  storageDir: string;
  charterDir: string;
  ledgerPath: string;
  proposal: GovernanceProposalRecord;
  restoredPaths: string[];
};

export type GovernanceProposalsReviewManyResult = {
  storageDir: string;
  selection: GovernanceProposalBatchSelection;
  decision: GovernanceProposalDecision;
  reviewedCount: number;
  failedCount: number;
  stoppedEarly: boolean;
  entries: GovernanceProposalBatchEntry[];
};

export type GovernanceProposalsApplyManyResult = {
  storageDir: string;
  selection: GovernanceProposalBatchSelection;
  appliedCount: number;
  failedCount: number;
  stoppedEarly: boolean;
  entries: GovernanceProposalBatchEntry[];
};

export type GovernanceProposalsRevertManyResult = {
  storageDir: string;
  selection: GovernanceProposalBatchSelection;
  revertedCount: number;
  failedCount: number;
  stoppedEarly: boolean;
  entries: GovernanceProposalBatchEntry[];
};

type GovernanceProposalListParams = {
  status?: GovernanceProposalStatus;
  limit?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
};

type GovernanceProposalBatchParams = {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
  continueOnError?: boolean;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
};

function isGovernanceProposalStatus(value: unknown): value is GovernanceProposalStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "applied";
}

function isGovernanceProposalDecision(value: unknown): value is GovernanceProposalDecision {
  return value === "approve" || value === "reject";
}

function isGovernanceProposalOperationKind(value: unknown): value is GovernanceProposalOperationKind {
  return value === "write" || value === "delete";
}

function normalizeProposalLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_PROPOSAL_LIMIT;
  }
  const normalized = Math.floor(limit);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Governance proposal limit must be a positive integer.");
  }
  return Math.min(normalized, MAX_PROPOSAL_LIMIT);
}

function normalizeProposalId(value: string, label = "proposalId"): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized || !GOVERNANCE_PROPOSAL_ID_RE.test(normalized)) {
    throw new Error(`${label} must match ${GOVERNANCE_PROPOSAL_ID_RE.source}.`);
  }
  return normalized;
}

function normalizeProposalIds(values: string[] | undefined, label = "proposalIds"): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value, index) => normalizeProposalId(value, `${label}[${index}]`))
        .filter(Boolean),
    ),
  );
}

function normalizeActorLabel(value: string | undefined, label: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} required.`);
  }
  return normalized;
}

function normalizeGovernanceProposalPath(value: string, label = "operation.path"): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} required.`);
  }
  const posixInput = normalized.replace(/\\/gu, "/");
  const stripped = posixInput.startsWith("governance/charter/")
    ? posixInput.slice("governance/charter/".length)
    : posixInput;
  if (!stripped || stripped.startsWith("/")) {
    throw new Error(`${label} must stay within governance/charter.`);
  }
  const relativePath = path.posix.normalize(stripped);
  if (!relativePath || relativePath === "." || relativePath.startsWith("../")) {
    throw new Error(`${label} must stay within governance/charter.`);
  }
  return relativePath;
}

function normalizeProposalOperation(operation: GovernanceProposalOperation): GovernanceProposalOperation {
  if (!isGovernanceProposalOperationKind(operation.kind)) {
    throw new Error(`Unsupported proposal operation kind: ${String(operation.kind)}`);
  }
  const normalizedPath = normalizeGovernanceProposalPath(operation.path);
  if (operation.kind === "write") {
    if (typeof operation.content !== "string") {
      throw new Error(`content required for write operation: ${normalizedPath}`);
    }
    return {
      kind: "write",
      path: normalizedPath,
      content: operation.content,
    };
  }
  return {
    kind: "delete",
    path: normalizedPath,
  };
}

function isAuditActorType(value: unknown): value is AuditActorType {
  return value === "agent" || value === "human" || value === "system" || value === "runtime";
}

function normalizeAuditActorType(
  value: AuditActorType | undefined,
  label: string,
  fallback: AuditActorType,
): AuditActorType {
  if (value === undefined) {
    return fallback;
  }
  if (!isAuditActorType(value)) {
    throw new Error(`${label} must be one of: agent, human, system, runtime.`);
  }
  return value;
}

function compareGovernanceProposalRiskLevel(
  left: GovernanceProposalRiskLevel,
  right: GovernanceProposalRiskLevel,
): number {
  const order: Record<GovernanceProposalRiskLevel, number> = {
    safe: 0,
    elevated: 1,
    sovereign: 2,
  };
  return order[left] - order[right];
}

function maxGovernanceProposalRiskLevel(
  left: GovernanceProposalRiskLevel,
  right: GovernanceProposalRiskLevel,
): GovernanceProposalRiskLevel {
  return compareGovernanceProposalRiskLevel(left, right) >= 0 ? left : right;
}

function classifyGovernanceProposalOperation(operation: GovernanceProposalOperation): {
  level: GovernanceProposalRiskLevel;
  reasons: string[];
} {
  const normalizedPath = normalizeGovernanceProposalPath(operation.path);
  if (normalizedPath === "constitution.yaml") {
    return {
      level: "sovereign",
      reasons: ["touches the constitutional charter root"],
    };
  }
  if (normalizedPath === "policies/sovereignty.yaml") {
    return {
      level: "sovereign",
      reasons: ["touches the sovereignty boundary policy"],
    };
  }
  if (normalizedPath === "agents/sovereignty-auditor.yaml" && operation.kind === "delete") {
    return {
      level: "sovereign",
      reasons: ["removes the sovereignty auditor charter artifact"],
    };
  }
  if (normalizedPath === "capability/asset-registry.yaml" && operation.kind === "write") {
    return {
      level: "safe",
      reasons: ["writes the governed capability asset registry"],
    };
  }
  if (operation.kind === "delete") {
    return {
      level: "elevated",
      reasons: ["deletes a governed charter artifact"],
    };
  }
  if (normalizedPath.startsWith("agents/")) {
    return {
      level: "elevated",
      reasons: ["mutates a governed agent blueprint"],
    };
  }
  if (normalizedPath.startsWith("evolution/")) {
    return {
      level: "elevated",
      reasons: ["mutates governed organizational topology or evolution policy"],
    };
  }
  if (normalizedPath.startsWith("policies/")) {
    return {
      level: "elevated",
      reasons: ["mutates a governed policy artifact"],
    };
  }
  if (normalizedPath.startsWith("capability/")) {
    return {
      level: "elevated",
      reasons: ["mutates a governed capability artifact"],
    };
  }
  return {
    level: "elevated",
    reasons: ["mutates a governed charter artifact"],
  };
}

export function classifyGovernanceProposalOperations(
  operations: GovernanceProposalOperation[],
): GovernanceProposalClassification {
  let level: GovernanceProposalRiskLevel = "safe";
  const reasons = new Set<string>();
  const touchedPaths = new Set<string>();
  let hasDeleteOperations = false;

  for (const operation of operations) {
    const normalizedOperation = normalizeProposalOperation(operation);
    const classification = classifyGovernanceProposalOperation(normalizedOperation);
    level = maxGovernanceProposalRiskLevel(level, classification.level);
    touchedPaths.add(normalizedOperation.path);
    if (normalizedOperation.kind === "delete") {
      hasDeleteOperations = true;
    }
    for (const reason of classification.reasons) {
      reasons.add(reason);
    }
  }

  return {
    level,
    reasons: [...reasons],
    touchedPaths: [...touchedPaths],
    hasDeleteOperations,
    requiresHumanSovereignApproval: level === "sovereign",
  };
}

export function proposalRequiresHumanSovereignApproval(params: {
  classification?: GovernanceProposalClassification;
  operations: GovernanceProposalOperation[];
}): boolean {
  return (
    params.classification ?? classifyGovernanceProposalOperations(params.operations)
  ).requiresHumanSovereignApproval;
}

function buildProposalSummary(proposals: GovernanceProposalRecord[]): GovernanceProposalSummary {
  const summary: GovernanceProposalSummary = {
    total: proposals.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
  };
  for (const proposal of proposals) {
    summary[proposal.status] += 1;
    summary.latestCreatedAt =
      summary.latestCreatedAt === undefined
        ? proposal.createdAt
        : Math.max(summary.latestCreatedAt, proposal.createdAt);
    summary.latestUpdatedAt =
      summary.latestUpdatedAt === undefined
        ? proposal.updatedAt
        : Math.max(summary.latestUpdatedAt, proposal.updatedAt);
  }
  return summary;
}

function parseGovernanceProposalOperation(
  value: unknown,
  filePath: string,
): GovernanceProposalOperation {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal operation in ${filePath}.`);
  }
  const kind = value.kind;
  if (!isGovernanceProposalOperationKind(kind)) {
    throw new Error(`Invalid governance proposal operation kind in ${filePath}.`);
  }
  const rawPath = value.path;
  if (typeof rawPath !== "string") {
    throw new Error(`Invalid governance proposal operation path in ${filePath}.`);
  }
  const normalizedPath = normalizeGovernanceProposalPath(rawPath, `operation.path in ${filePath}`);
  if (kind === "write") {
    if (typeof value.content !== "string") {
      throw new Error(`Write operation missing content in ${filePath}.`);
    }
    return {
      kind,
      path: normalizedPath,
      content: value.content,
    };
  }
  return {
    kind,
    path: normalizedPath,
  };
}

function parseProposalReviewRecord(value: unknown, filePath: string): GovernanceProposalReviewRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal review record in ${filePath}.`);
  }
  if (!isGovernanceProposalDecision(value.decision)) {
    throw new Error(`Invalid governance proposal review decision in ${filePath}.`);
  }
  if (typeof value.decidedAt !== "number" || !Number.isFinite(value.decidedAt)) {
    throw new Error(`Invalid governance proposal review timestamp in ${filePath}.`);
  }
  if (typeof value.decidedBy !== "string" || !value.decidedBy.trim()) {
    throw new Error(`Invalid governance proposal reviewer in ${filePath}.`);
  }
  return {
    decision: value.decision,
    decidedAt: value.decidedAt,
    decidedBy: value.decidedBy,
    decidedByType: isAuditActorType(value.decidedByType) ? value.decidedByType : "human",
    ...(typeof value.decisionNote === "string" ? { decisionNote: value.decisionNote } : {}),
  };
}

function parseProposalApplyRecord(value: unknown, filePath: string): GovernanceProposalApplyRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal apply record in ${filePath}.`);
  }
  if (typeof value.appliedAt !== "number" || !Number.isFinite(value.appliedAt)) {
    throw new Error(`Invalid governance proposal apply timestamp in ${filePath}.`);
  }
  if (typeof value.appliedBy !== "string" || !value.appliedBy.trim()) {
    throw new Error(`Invalid governance proposal appliedBy in ${filePath}.`);
  }
  if (!Array.isArray(value.writtenPaths)) {
    throw new Error(`Invalid governance proposal writtenPaths in ${filePath}.`);
  }
  const writtenPaths = value.writtenPaths.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return {
    appliedAt: value.appliedAt,
    appliedBy: value.appliedBy,
    appliedByType: isAuditActorType(value.appliedByType) ? value.appliedByType : "human",
    writtenPaths,
    ...(typeof value.ledgerPath === "string" && value.ledgerPath.trim()
      ? { ledgerPath: value.ledgerPath }
      : {}),
    ...(typeof value.revertedAt === "number" && Number.isFinite(value.revertedAt)
      ? { revertedAt: value.revertedAt }
      : {}),
    ...(typeof value.revertedBy === "string" && value.revertedBy.trim()
      ? { revertedBy: value.revertedBy }
      : {}),
    ...(Array.isArray(value.restoredPaths)
      ? {
          restoredPaths: value.restoredPaths.filter(
            (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
          ),
        }
      : {}),
  };
}

function hashTextContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function isGovernanceProposalApplyLedgerStatus(
  value: unknown,
): value is GovernanceProposalApplyLedgerStatus {
  return value === "prepared" || value === "applied" || value === "reverted";
}

function parseNonEmptyStringArray(value: unknown, label: string, filePath: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label} in ${filePath}.`);
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function parseProposalApplySnapshot(
  value: unknown,
  filePath: string,
): GovernanceProposalApplySnapshot {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal apply snapshot in ${filePath}.`);
  }
  if (!isGovernanceProposalOperationKind(value.kind)) {
    throw new Error(`Invalid governance proposal apply snapshot kind in ${filePath}.`);
  }
  if (typeof value.path !== "string") {
    throw new Error(`Invalid governance proposal apply snapshot path in ${filePath}.`);
  }
  if (typeof value.repoRelativePath !== "string" || !value.repoRelativePath.trim()) {
    throw new Error(`Invalid governance proposal apply snapshot repoRelativePath in ${filePath}.`);
  }
  if (typeof value.existedBefore !== "boolean") {
    throw new Error(`Invalid governance proposal apply snapshot existedBefore in ${filePath}.`);
  }
  return {
    kind: value.kind,
    path: normalizeGovernanceProposalPath(value.path, `apply snapshot path in ${filePath}`),
    repoRelativePath: value.repoRelativePath,
    existedBefore: value.existedBefore,
    ...(typeof value.previousContent === "string" ? { previousContent: value.previousContent } : {}),
    ...(typeof value.previousContentSha256 === "string" && value.previousContentSha256.trim()
      ? { previousContentSha256: value.previousContentSha256 }
      : {}),
  };
}

function parseProposalApplyLedger(value: unknown, filePath: string): GovernanceProposalApplyLedger {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal apply ledger in ${filePath}.`);
  }
  if (typeof value.proposalId !== "string") {
    throw new Error(`Invalid governance proposal apply ledger proposalId in ${filePath}.`);
  }
  if (typeof value.proposalTitle !== "string" || !value.proposalTitle.trim()) {
    throw new Error(`Invalid governance proposal apply ledger proposalTitle in ${filePath}.`);
  }
  if (typeof value.charterDir !== "string" || !value.charterDir.trim()) {
    throw new Error(`Invalid governance proposal apply ledger charterDir in ${filePath}.`);
  }
  if (typeof value.storageDir !== "string" || !value.storageDir.trim()) {
    throw new Error(`Invalid governance proposal apply ledger storageDir in ${filePath}.`);
  }
  if (typeof value.ledgerPath !== "string" || !value.ledgerPath.trim()) {
    throw new Error(`Invalid governance proposal apply ledger ledgerPath in ${filePath}.`);
  }
  if (!isGovernanceProposalApplyLedgerStatus(value.status)) {
    throw new Error(`Invalid governance proposal apply ledger status in ${filePath}.`);
  }
  if (typeof value.appliedAt !== "number" || !Number.isFinite(value.appliedAt)) {
    throw new Error(`Invalid governance proposal apply ledger appliedAt in ${filePath}.`);
  }
  if (typeof value.appliedBy !== "string" || !value.appliedBy.trim()) {
    throw new Error(`Invalid governance proposal apply ledger appliedBy in ${filePath}.`);
  }
  return {
    proposalId: normalizeProposalId(value.proposalId, `proposalId in ${filePath}`),
    proposalTitle: value.proposalTitle.trim(),
    charterDir: value.charterDir,
    storageDir: value.storageDir,
    ledgerPath: value.ledgerPath,
    status: value.status,
    appliedAt: value.appliedAt,
    appliedBy: value.appliedBy,
    writtenPaths: parseNonEmptyStringArray(value.writtenPaths, "writtenPaths", filePath),
    snapshots: Array.isArray(value.snapshots)
      ? value.snapshots.map((entry) => parseProposalApplySnapshot(entry, filePath))
      : (() => {
          throw new Error(`Invalid snapshots in ${filePath}.`);
        })(),
    ...(typeof value.revertedAt === "number" && Number.isFinite(value.revertedAt)
      ? { revertedAt: value.revertedAt }
      : {}),
    ...(typeof value.revertedBy === "string" && value.revertedBy.trim()
      ? { revertedBy: value.revertedBy }
      : {}),
    ...(Array.isArray(value.restoredPaths)
      ? { restoredPaths: parseNonEmptyStringArray(value.restoredPaths, "restoredPaths", filePath) }
      : {}),
  };
}

function parseGovernanceProposalRecord(
  value: unknown,
  filePath: string,
): GovernanceProposalRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid governance proposal record in ${filePath}.`);
  }
  if (typeof value.id !== "string") {
    throw new Error(`Invalid governance proposal id in ${filePath}.`);
  }
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    throw new Error(`Invalid governance proposal createdAt in ${filePath}.`);
  }
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) {
    throw new Error(`Invalid governance proposal updatedAt in ${filePath}.`);
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error(`Invalid governance proposal title in ${filePath}.`);
  }
  if (!isGovernanceProposalStatus(value.status)) {
    throw new Error(`Invalid governance proposal status in ${filePath}.`);
  }
  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    throw new Error(`Invalid governance proposal operations in ${filePath}.`);
  }
  const operations = value.operations.map((entry) => parseGovernanceProposalOperation(entry, filePath));
  const classification = classifyGovernanceProposalOperations(operations);
  return {
    id: normalizeProposalId(value.id, `proposal id in ${filePath}`),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(typeof value.createdByAgentId === "string" && value.createdByAgentId.trim()
      ? { createdByAgentId: normalizeAgentId(value.createdByAgentId) }
      : {}),
    ...(typeof value.createdBySessionKey === "string" && value.createdBySessionKey.trim()
      ? { createdBySessionKey: value.createdBySessionKey }
      : {}),
    title: value.title.trim(),
    ...(typeof value.rationale === "string" ? { rationale: value.rationale } : {}),
    status: value.status,
    operations,
    classification,
    ...(value.review !== undefined ? { review: parseProposalReviewRecord(value.review, filePath) } : {}),
    ...(value.apply !== undefined ? { apply: parseProposalApplyRecord(value.apply, filePath) } : {}),
  };
}

function readProposalRecordSync(filePath: string): GovernanceProposalRecord {
  return parseGovernanceProposalRecord(JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown, filePath);
}

async function readProposalRecord(filePath: string): Promise<GovernanceProposalRecord> {
  return parseGovernanceProposalRecord(JSON.parse(await fsp.readFile(filePath, "utf8")) as unknown, filePath);
}

function tryReadProposalRecordSync(filePath: string): GovernanceProposalRecord | null {
  try {
    return readProposalRecordSync(filePath);
  } catch {
    return null;
  }
}

async function listProposalFiles(storageDir: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await fsp.readdir(storageDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(storageDir, entry));
}

function listProposalFilesSync(storageDir: string): string[] {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(storageDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(storageDir, entry));
}

function sortProposals(proposals: GovernanceProposalRecord[]): GovernanceProposalRecord[] {
  return proposals.toSorted((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    return left.id.localeCompare(right.id);
  });
}

async function writeProposalRecord(
  proposal: GovernanceProposalRecord,
  storageDir: string,
): Promise<void> {
  await fsp.mkdir(storageDir, { recursive: true });
  await fsp.writeFile(
    path.join(storageDir, `${normalizeProposalId(proposal.id)}.json`),
    `${JSON.stringify(proposal, null, 2)}\n`,
    "utf8",
  );
}

async function writeProposalApplyLedger(ledger: GovernanceProposalApplyLedger): Promise<void> {
  await fsp.mkdir(path.dirname(ledger.ledgerPath), { recursive: true });
  await fsp.writeFile(ledger.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

async function readProposalApplyLedger(filePath: string): Promise<GovernanceProposalApplyLedger> {
  return parseProposalApplyLedger(JSON.parse(await fsp.readFile(filePath, "utf8")) as unknown, filePath);
}

function resolveProposalStorageRoot(params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {}): string {
  return params.stateDir ?? resolveStateDir(params.env);
}

function resolveProposalStorageDir(params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {}): string {
  return path.join(resolveProposalStorageRoot(params), "governance", "proposals");
}

function resolveProposalAuditStreamPath(params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {}): string {
  return path.join(resolveProposalStorageRoot(params), "audit", "facts.jsonl");
}

function resolveProposalApplyStorageDir(
  params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {},
): string {
  return path.join(resolveProposalStorageRoot(params), "governance", "applies");
}

function resolveProposalRecordPath(params: {
  proposalId: string;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): string {
  return path.join(resolveProposalStorageDir(params), `${normalizeProposalId(params.proposalId)}.json`);
}

function resolveProposalApplyLedgerFilePath(params: {
  proposalId: string;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): string {
  return path.join(
    resolveProposalApplyStorageDir(params),
    `${normalizeProposalId(params.proposalId)}.json`,
  );
}

function resolveStateDirFromProposalStorage(storageDir: string): string {
  return path.resolve(storageDir, "..", "..");
}

function readStoredProposalForMutation(params: {
  proposalId: string;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): Promise<{ proposal: GovernanceProposalRecord; storageDir: string }> {
  const storageDir = resolveProposalStorageDir(params);
  const filePath = resolveProposalRecordPath(params);
  return readProposalRecord(filePath).then((proposal) => ({
    proposal,
    storageDir,
  }));
}

async function tryReadStoredProposal(params: {
  proposalId: string;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): Promise<GovernanceProposalRecord | null> {
  try {
    const { proposal } = await readStoredProposalForMutation(params);
    return proposal;
  } catch {
    return null;
  }
}

async function resolveGovernanceProposalBatchSelection(
  params: GovernanceProposalBatchParams,
): Promise<{ storageDir: string; selection: GovernanceProposalBatchSelection }> {
  const proposalIds = normalizeProposalIds(params.proposalIds);
  if (proposalIds.length > 0 && params.status) {
    throw new Error("proposalIds and status are mutually exclusive.");
  }
  if (proposalIds.length > 0 && params.limit !== undefined) {
    throw new Error("limit cannot be combined with explicit proposalIds.");
  }
  if (proposalIds.length === 0 && !params.status) {
    throw new Error("proposalIds or status required.");
  }
  if (proposalIds.length > 0) {
    return {
      storageDir: resolveProposalStorageDir(params),
      selection: {
        proposalIds,
        matchedProposalIds: [...proposalIds],
      },
    };
  }
  const listed = await listGovernanceProposals({
    status: params.status,
    ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
    ...(params.env ? { env: params.env } : {}),
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
  });
  return {
    storageDir: listed.storageDir,
    selection: {
      status: params.status,
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      matchedProposalIds: listed.proposals.map((proposal) => proposal.id),
    },
  };
}

export function resolveGovernanceProposalStorageDir(params: {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
} = {}): string {
  return resolveProposalStorageDir(params);
}

export function resolveGovernanceProposalApplyLedgerDir(params: {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
} = {}): string {
  return resolveProposalApplyStorageDir(params);
}

export function resolveGovernanceProposalFilePath(
  proposalId: string,
  params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {},
): string {
  const stateDir =
    params.stateDir && path.basename(params.stateDir) === "proposals"
      ? resolveStateDirFromProposalStorage(params.stateDir)
      : params.stateDir;
  return resolveProposalRecordPath({
    proposalId,
    ...(stateDir ? { stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
}

export function resolveGovernanceProposalApplyLedgerPath(
  proposalId: string,
  params: { env?: NodeJS.ProcessEnv; stateDir?: string } = {},
): string {
  const stateDir =
    params.stateDir && path.basename(params.stateDir) === "applies"
      ? resolveStateDirFromProposalStorage(params.stateDir)
      : params.stateDir;
  return resolveProposalApplyLedgerFilePath({
    proposalId,
    ...(stateDir ? { stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
}

export function resolveGovernanceCharterMutationTarget(params: {
  proposalPath: string;
  charterDir?: string;
}): {
  charterDir: string;
  repoRoot: string;
  relativePath: string;
  absolutePath: string;
  repoRelativePath: string;
} {
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  const relativePath = normalizeGovernanceProposalPath(params.proposalPath);
  const absolutePath = path.resolve(snapshot.charterDir, relativePath);
  const rebased = path.relative(snapshot.charterDir, absolutePath);
  if (rebased.startsWith("..") || path.isAbsolute(rebased)) {
    throw new Error(`Proposal path escapes governance/charter: ${params.proposalPath}`);
  }
  return {
    charterDir: snapshot.charterDir,
    repoRoot: snapshot.repoRoot,
    relativePath,
    absolutePath,
    repoRelativePath: path.relative(snapshot.repoRoot, absolutePath).replace(/\\/gu, "/"),
  };
}

type GovernanceProposalApplyTarget = ReturnType<typeof resolveGovernanceCharterMutationTarget>;

type GovernanceProposalPreparedMutation = {
  operation: GovernanceProposalOperation;
  target: GovernanceProposalApplyTarget;
  snapshot: GovernanceProposalApplySnapshot;
};

async function captureProposalApplySnapshot(
  operation: GovernanceProposalOperation,
  charterDir: string | undefined,
): Promise<GovernanceProposalPreparedMutation> {
  const target = resolveGovernanceCharterMutationTarget({
    proposalPath: operation.path,
    charterDir,
  });
  let existedBefore = false;
  let previousContent: string | undefined;
  try {
    previousContent = await fsp.readFile(target.absolutePath, "utf8");
    existedBefore = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
  return {
    operation,
    target,
    snapshot: {
      kind: operation.kind,
      path: target.relativePath,
      repoRelativePath: target.repoRelativePath,
      existedBefore,
      ...(previousContent !== undefined ? { previousContent } : {}),
      ...(previousContent !== undefined ? { previousContentSha256: hashTextContent(previousContent) } : {}),
    },
  };
}

async function executeProposalOperation(
  operation: GovernanceProposalOperation,
  target: GovernanceProposalApplyTarget,
): Promise<void> {
  if (operation.kind === "write") {
    await fsp.mkdir(path.dirname(target.absolutePath), { recursive: true });
    await fsp.writeFile(target.absolutePath, operation.content ?? "", "utf8");
    return;
  }
  await fsp.rm(target.absolutePath, { force: true });
}

async function restoreProposalSnapshot(
  snapshot: GovernanceProposalApplySnapshot,
  charterDir: string | undefined,
): Promise<GovernanceProposalApplyTarget> {
  const target = resolveGovernanceCharterMutationTarget({
    proposalPath: snapshot.path,
    charterDir,
  });
  if (snapshot.existedBefore) {
    await fsp.mkdir(path.dirname(target.absolutePath), { recursive: true });
    await fsp.writeFile(target.absolutePath, snapshot.previousContent ?? "", "utf8");
  } else {
    await fsp.rm(target.absolutePath, { force: true });
  }
  return target;
}

export function summarizeGovernanceProposalLedger(params: {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
} = {}): GovernanceProposalLedger {
  const storageDir = resolveProposalStorageDir(params);
  const proposals = sortProposals(
    listProposalFilesSync(storageDir)
      .map((filePath) => tryReadProposalRecordSync(filePath))
      .filter((entry): entry is GovernanceProposalRecord => Boolean(entry)),
  );
  return {
    storageDir,
    ...buildProposalSummary(proposals),
  };
}

export async function listGovernanceProposals(
  params: GovernanceProposalListParams = {},
): Promise<GovernanceProposalListResult> {
  const storageDir = resolveProposalStorageDir(params);
  const limit = normalizeProposalLimit(params.limit);
  const proposals = sortProposals(
    (
      await Promise.all(
        (await listProposalFiles(storageDir)).map(async (filePath) => {
          try {
            return await readProposalRecord(filePath);
          } catch {
            return null;
          }
        }),
      )
    ).filter((entry): entry is GovernanceProposalRecord => Boolean(entry)),
  );
  const filtered = params.status ? proposals.filter((entry) => entry.status === params.status) : proposals;
  return {
    storageDir,
    summary: buildProposalSummary(proposals),
    proposals: filtered.slice(0, limit),
  };
}

export async function createGovernanceProposal(params: {
  title: string;
  rationale?: string;
  operations: GovernanceProposalOperation[];
  createdByAgentId?: string;
  createdBySessionKey?: string;
  proposalId?: string;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  charterDir?: string;
}): Promise<GovernanceProposalCreateResult> {
  const title = normalizeActorLabel(params.title, "title");
  const rationale = normalizeOptionalString(params.rationale);
  if (!Array.isArray(params.operations) || params.operations.length === 0) {
    throw new Error("operations required.");
  }
  const operations = params.operations.map((entry) => {
    const normalized = normalizeProposalOperation(entry);
    resolveGovernanceCharterMutationTarget({
      proposalPath: normalized.path,
      charterDir: params.charterDir,
    });
    return normalized;
  });
  const classification = classifyGovernanceProposalOperations(operations);
  const createdAt = params.now ?? Date.now();
  const id = normalizeProposalId(
    params.proposalId ?? `gpr-${createdAt}-${randomUUID().slice(0, 8)}`,
    "proposalId",
  );
  const storageDir = resolveProposalStorageDir(params);
  const filePath = path.join(storageDir, `${id}.json`);
  try {
    await fsp.access(filePath);
    throw new Error(`Governance proposal already exists: ${id}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const proposal: GovernanceProposalRecord = {
    id,
    createdAt,
    updatedAt: createdAt,
    ...(typeof params.createdByAgentId === "string" && params.createdByAgentId.trim()
      ? { createdByAgentId: normalizeAgentId(params.createdByAgentId) }
      : {}),
    ...(typeof params.createdBySessionKey === "string" && params.createdBySessionKey.trim()
      ? { createdBySessionKey: params.createdBySessionKey.trim() }
      : {}),
    title,
    ...(rationale ? { rationale } : {}),
    status: "pending",
    operations,
    classification,
  };
  await writeProposalRecord(proposal, storageDir);
  await appendAuditFact({
    filePath: resolveProposalAuditStreamPath(params),
    fact: {
      domain: "governance",
      action: "proposal.created",
      actor: {
        type: proposal.createdByAgentId ? "agent" : "system",
        id: proposal.createdByAgentId ?? "governance.proposals",
      },
      refs: {
        proposalId: proposal.id,
        ...(proposal.createdBySessionKey ? { sessionKey: proposal.createdBySessionKey } : {}),
      },
      summary: `created governance proposal ${proposal.id}`,
      payload: {
        title: proposal.title,
        operationCount: proposal.operations.length,
        status: proposal.status,
        risk: proposal.classification.level,
        requiresHumanSovereignApproval: proposal.classification.requiresHumanSovereignApproval,
      },
    },
  });
  return {
    storageDir,
    proposal,
  };
}

export async function reviewGovernanceProposal(params: {
  proposalId: string;
  decision: GovernanceProposalDecision;
  decidedBy: string;
  decidedByType?: AuditActorType;
  decisionNote?: string;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): Promise<GovernanceProposalReviewResult> {
  const decision = params.decision;
  if (!isGovernanceProposalDecision(decision)) {
    throw new Error(`Unsupported governance proposal decision: ${params.decision}`);
  }
  const decidedBy = normalizeActorLabel(params.decidedBy, "decidedBy");
  const decidedByType = normalizeAuditActorType(params.decidedByType, "decidedByType", "human");
  const decisionNote = normalizeOptionalString(params.decisionNote);
  const { proposal, storageDir } = await readStoredProposalForMutation(params);
  if (proposal.status === "applied") {
    throw new Error(`Governance proposal already applied: ${proposal.id}`);
  }
  if (
    decision === "approve" &&
    proposal.classification.requiresHumanSovereignApproval &&
    decidedByType !== "human"
  ) {
    throw new Error(`Governance proposal requires human sovereign approval before approve: ${proposal.id}`);
  }
  const reviewedAt = params.now ?? Date.now();
  const reviewed: GovernanceProposalRecord = {
    ...proposal,
    updatedAt: reviewedAt,
    status: decision === "approve" ? "approved" : "rejected",
    review: {
      decision,
      decidedAt: reviewedAt,
      decidedBy,
      decidedByType,
      ...(decisionNote ? { decisionNote } : {}),
    },
  };
  await writeProposalRecord(reviewed, storageDir);
  await appendAuditFact({
    filePath: resolveProposalAuditStreamPath(params),
    fact: {
      domain: "governance",
      action: "proposal.reviewed",
      actor: {
        type: decidedByType,
        id: decidedBy,
      },
      refs: {
        proposalId: reviewed.id,
      },
      summary: `${decision} governance proposal ${reviewed.id}`,
      payload: {
        title: reviewed.title,
        decision,
        status: reviewed.status,
        risk: reviewed.classification.level,
        requiresHumanSovereignApproval: reviewed.classification.requiresHumanSovereignApproval,
      },
    },
  });
  return {
    storageDir,
    proposal: reviewed,
  };
}

export async function reviewGovernanceProposals(params: {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
  decision: GovernanceProposalDecision;
  decidedBy: string;
  decidedByType?: AuditActorType;
  decisionNote?: string;
  continueOnError?: boolean;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): Promise<GovernanceProposalsReviewManyResult> {
  const decision = params.decision;
  if (!isGovernanceProposalDecision(decision)) {
    throw new Error(`Unsupported governance proposal decision: ${params.decision}`);
  }
  const decidedBy = normalizeActorLabel(params.decidedBy, "decidedBy");
  const { storageDir, selection } = await resolveGovernanceProposalBatchSelection(params);
  const continueOnError = params.continueOnError !== false;
  const entries: GovernanceProposalBatchEntry[] = [];
  let reviewedCount = 0;
  let failedCount = 0;
  let stoppedEarly = false;

  for (const proposalId of selection.matchedProposalIds) {
    const before = await tryReadStoredProposal({
      proposalId,
      ...(params.env ? { env: params.env } : {}),
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    });
    try {
        const result = await reviewGovernanceProposal({
          proposalId,
          decision,
          decidedBy,
          decidedByType: params.decidedByType,
          decisionNote: params.decisionNote,
          ...(typeof params.now === "number" ? { now: params.now } : {}),
          ...(params.env ? { env: params.env } : {}),
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
      });
      reviewedCount += 1;
      entries.push({
        proposalId,
        ok: true,
        title: result.proposal.title,
        statusBefore: before?.status,
        statusAfter: result.proposal.status,
      });
    } catch (error) {
      failedCount += 1;
      entries.push({
        proposalId,
        ok: false,
        ...(before?.title ? { title: before.title } : {}),
        ...(before?.status ? { statusBefore: before.status, statusAfter: before.status } : {}),
        reason: error instanceof Error ? error.message : "Failed to review governance proposal.",
      });
      if (!continueOnError) {
        stoppedEarly = true;
        break;
      }
    }
  }

  return {
    storageDir,
    selection,
    decision,
    reviewedCount,
    failedCount,
    stoppedEarly,
    entries,
  };
}

export async function applyGovernanceProposal(params: {
  proposalId: string;
  appliedBy: string;
  appliedByType?: AuditActorType;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  charterDir?: string;
}): Promise<GovernanceProposalApplyResult> {
  const appliedBy = normalizeActorLabel(params.appliedBy, "appliedBy");
  const appliedByType = normalizeAuditActorType(params.appliedByType, "appliedByType", "human");
  const { proposal, storageDir } = await readStoredProposalForMutation(params);
  if (proposal.status !== "approved") {
    throw new Error(`Governance proposal must be approved before apply: ${proposal.id}`);
  }
  if (
    proposal.classification.requiresHumanSovereignApproval &&
    proposal.review?.decidedByType !== "human"
  ) {
    throw new Error(
      `Governance proposal requires explicit human sovereign approval before apply: ${proposal.id}`,
    );
  }

  const appliedAt = params.now ?? Date.now();
  const prepared = await Promise.all(
    proposal.operations.map((operation) => captureProposalApplySnapshot(operation, params.charterDir)),
  );
  const charterDir =
    prepared[0]?.target.charterDir ?? loadGovernanceCharter({ charterDir: params.charterDir }).charterDir;
  const writtenPaths = prepared.map((entry) => entry.target.repoRelativePath);
  const ledgerPath = resolveGovernanceProposalApplyLedgerPath(proposal.id, {
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
  let ledger: GovernanceProposalApplyLedger = {
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    charterDir,
    storageDir,
    ledgerPath,
    status: "prepared",
    appliedAt,
    appliedBy,
    writtenPaths,
    snapshots: prepared.map((entry) => entry.snapshot),
  };
  await writeProposalApplyLedger(ledger);
  for (const entry of prepared) {
    await executeProposalOperation(entry.operation, entry.target);
  }
  ledger = {
    ...ledger,
    status: "applied",
  };
  await writeProposalApplyLedger(ledger);

  const appliedProposal: GovernanceProposalRecord = {
    ...proposal,
    updatedAt: appliedAt,
    status: "applied",
    apply: {
      appliedAt,
      appliedBy,
      appliedByType,
      writtenPaths,
      ledgerPath,
    },
  };
  await writeProposalRecord(appliedProposal, storageDir);
  await appendAuditFact({
    filePath: resolveProposalAuditStreamPath(params),
    fact: {
      domain: "governance",
      action: "proposal.applied",
      actor: {
        type: appliedByType,
        id: appliedBy,
      },
      refs: {
        proposalId: appliedProposal.id,
      },
      summary: `applied governance proposal ${appliedProposal.id}`,
      payload: {
        title: appliedProposal.title,
        ledgerPath,
        writtenPaths,
        risk: appliedProposal.classification.level,
        requiresHumanSovereignApproval: appliedProposal.classification.requiresHumanSovereignApproval,
      },
    },
  });

  return {
    storageDir,
    charterDir,
    ledgerPath,
    proposal: appliedProposal,
    writtenPaths,
  };
}

export async function applyGovernanceProposals(params: {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
  appliedBy: string;
  appliedByType?: AuditActorType;
  continueOnError?: boolean;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  charterDir?: string;
}): Promise<GovernanceProposalsApplyManyResult> {
  const appliedBy = normalizeActorLabel(params.appliedBy, "appliedBy");
  const { storageDir, selection } = await resolveGovernanceProposalBatchSelection(params);
  const continueOnError = params.continueOnError !== false;
  const entries: GovernanceProposalBatchEntry[] = [];
  let appliedCount = 0;
  let failedCount = 0;
  let stoppedEarly = false;

  for (const proposalId of selection.matchedProposalIds) {
    const before = await tryReadStoredProposal({
      proposalId,
      ...(params.env ? { env: params.env } : {}),
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    });
    try {
        const result = await applyGovernanceProposal({
          proposalId,
          appliedBy,
          appliedByType: params.appliedByType,
          ...(typeof params.now === "number" ? { now: params.now } : {}),
          ...(params.env ? { env: params.env } : {}),
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
        ...(params.charterDir ? { charterDir: params.charterDir } : {}),
      });
      appliedCount += 1;
      entries.push({
        proposalId,
        ok: true,
        title: result.proposal.title,
        statusBefore: before?.status,
        statusAfter: result.proposal.status,
        ledgerPath: result.ledgerPath,
        writtenPaths: [...result.writtenPaths],
      });
    } catch (error) {
      failedCount += 1;
      entries.push({
        proposalId,
        ok: false,
        ...(before?.title ? { title: before.title } : {}),
        ...(before?.status ? { statusBefore: before.status, statusAfter: before.status } : {}),
        reason: error instanceof Error ? error.message : "Failed to apply governance proposal.",
      });
      if (!continueOnError) {
        stoppedEarly = true;
        break;
      }
    }
  }

  return {
    storageDir,
    selection,
    appliedCount,
    failedCount,
    stoppedEarly,
    entries,
  };
}

export async function revertGovernanceProposalApply(params: {
  proposalId: string;
  revertedBy: string;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  charterDir?: string;
}): Promise<GovernanceProposalRevertResult> {
  const revertedBy = normalizeActorLabel(params.revertedBy, "revertedBy");
  const { proposal, storageDir } = await readStoredProposalForMutation(params);
  if (proposal.status !== "applied") {
    throw new Error(`Governance proposal must be applied before revert: ${proposal.id}`);
  }

  const ledgerPath = proposal.apply?.ledgerPath
    ? proposal.apply.ledgerPath
    : resolveGovernanceProposalApplyLedgerPath(proposal.id, {
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
        ...(params.env ? { env: params.env } : {}),
      });
  const ledger = await readProposalApplyLedger(ledgerPath);
  if (ledger.status !== "applied") {
    throw new Error(`Governance proposal apply ledger is not revertable: ${proposal.id}`);
  }

  const restoredPathsReversed: string[] = [];
  for (const snapshot of ledger.snapshots.toReversed()) {
    const target = await restoreProposalSnapshot(snapshot, params.charterDir ?? ledger.charterDir);
    restoredPathsReversed.push(target.repoRelativePath);
  }
  const restoredPaths = restoredPathsReversed.toReversed();
  const revertedAt = params.now ?? Date.now();
  const revertedLedger: GovernanceProposalApplyLedger = {
    ...ledger,
    status: "reverted",
    revertedAt,
    revertedBy,
    restoredPaths,
  };
  await writeProposalApplyLedger(revertedLedger);

  const revertedProposal: GovernanceProposalRecord = {
    ...proposal,
    updatedAt: revertedAt,
    status: "approved",
    apply: {
      appliedAt: proposal.apply?.appliedAt ?? ledger.appliedAt,
      appliedBy: proposal.apply?.appliedBy ?? ledger.appliedBy,
      appliedByType: proposal.apply?.appliedByType ?? "human",
      writtenPaths: proposal.apply?.writtenPaths ?? ledger.writtenPaths,
      ledgerPath,
      revertedAt,
      revertedBy,
      restoredPaths,
    },
  };
  await writeProposalRecord(revertedProposal, storageDir);
  await appendAuditFact({
    filePath: resolveProposalAuditStreamPath(params),
    fact: {
      domain: "governance",
      action: "proposal.reverted",
      actor: {
        type: "human",
        id: revertedBy,
      },
      refs: {
        proposalId: revertedProposal.id,
      },
      summary: `reverted governance proposal ${revertedProposal.id}`,
      payload: {
        title: revertedProposal.title,
        restoredPaths,
      },
    },
  });

  return {
    storageDir,
    charterDir: params.charterDir ?? ledger.charterDir,
    ledgerPath,
    proposal: revertedProposal,
    restoredPaths,
  };
}

export async function revertGovernanceProposalApplies(params: {
  proposalIds?: string[];
  status?: GovernanceProposalStatus;
  limit?: number;
  revertedBy: string;
  continueOnError?: boolean;
  now?: number;
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  charterDir?: string;
}): Promise<GovernanceProposalsRevertManyResult> {
  const revertedBy = normalizeActorLabel(params.revertedBy, "revertedBy");
  const { storageDir, selection } = await resolveGovernanceProposalBatchSelection(params);
  const continueOnError = params.continueOnError !== false;
  const entries: GovernanceProposalBatchEntry[] = [];
  let revertedCount = 0;
  let failedCount = 0;
  let stoppedEarly = false;

  for (const proposalId of selection.matchedProposalIds) {
    const before = await tryReadStoredProposal({
      proposalId,
      ...(params.env ? { env: params.env } : {}),
      ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    });
    try {
      const result = await revertGovernanceProposalApply({
        proposalId,
        revertedBy,
        ...(typeof params.now === "number" ? { now: params.now } : {}),
        ...(params.env ? { env: params.env } : {}),
        ...(params.stateDir ? { stateDir: params.stateDir } : {}),
        ...(params.charterDir ? { charterDir: params.charterDir } : {}),
      });
      revertedCount += 1;
      entries.push({
        proposalId,
        ok: true,
        title: result.proposal.title,
        statusBefore: before?.status,
        statusAfter: result.proposal.status,
        ledgerPath: result.ledgerPath,
        restoredPaths: [...result.restoredPaths],
      });
    } catch (error) {
      failedCount += 1;
      entries.push({
        proposalId,
        ok: false,
        ...(before?.title ? { title: before.title } : {}),
        ...(before?.status ? { statusBefore: before.status, statusAfter: before.status } : {}),
        reason:
          error instanceof Error ? error.message : "Failed to revert governance proposal apply.",
      });
      if (!continueOnError) {
        stoppedEarly = true;
        break;
      }
    }
  }

  return {
    storageDir,
    selection,
    revertedCount,
    failedCount,
    stoppedEarly,
    entries,
  };
}
