import type { ZhushouConfig } from "../config/types.zhushou.js";
import type { SecurityAuditFinding } from "../security/audit.js";
import {
  collectGovernanceCharterFindings,
} from "../security/audit.js";
import {
  collectGovernanceEnforcementSignals,
  loadGovernanceCharter,
  type GovernanceEnforcementSignal,
} from "./charter-runtime.js";
import {
  reconcileGovernanceSovereigntyIncidentsSync,
  type GovernanceSovereigntyIncidentCandidate,
  type GovernanceSovereigntyIncidentSyncResult,
} from "./sovereignty-incidents.js";

export type GovernanceSovereigntyAuditEvaluation = {
  observedAt: number;
  charterDir: string;
  findings: SecurityAuditFinding[];
  signals: GovernanceEnforcementSignal[];
  candidates: GovernanceSovereigntyIncidentCandidate[];
};

const GOVERNANCE_FINDING_REASON_CODE_MAP = new Map<string, GovernanceEnforcementSignal["reasonCode"]>([
  ["governance.charter.constitution_missing", "constitution_missing"],
  ["governance.charter.constitution_invalid", "constitution_invalid"],
  ["governance.charter.sovereignty_policy_missing", "sovereignty_policy_missing"],
  ["governance.charter.sovereignty_policy_invalid", "sovereignty_policy_invalid"],
  ["governance.charter.evolution_policy_missing", "evolution_policy_missing"],
  ["governance.charter.evolution_policy_invalid", "evolution_policy_invalid"],
  ["governance.charter.freeze_without_auditor", "freeze_without_auditor"],
  ["governance.sovereignty.network_boundary_opened", "network_boundary_opened"],
  ["governance.sovereignty.exec_boundary_opened", "exec_boundary_opened"],
]);

function normalizeDetailLines(detail: string, remediation?: string): string[] {
  const lines = detail
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (remediation?.trim()) {
    lines.push(`remediation: ${remediation.trim()}`);
  }
  return lines;
}

function buildSignalIncidentCandidate(
  signal: GovernanceEnforcementSignal,
): GovernanceSovereigntyIncidentCandidate {
  return {
    key: `signal:${signal.reasonCode}`,
    severity: signal.severity,
    source: "signal",
    title: signal.title,
    summary: signal.message,
    reasonCode: signal.reasonCode,
    detailLines: [...signal.details],
    findingIds: [],
    freezeRequested: signal.freezeActive,
  };
}

function buildFindingIncidentCandidate(
  finding: SecurityAuditFinding,
): GovernanceSovereigntyIncidentCandidate {
  return {
    key: `finding:${finding.checkId}`,
    severity: finding.severity === "critical" ? "critical" : "warn",
    source: "finding",
    title: finding.title,
    summary: finding.detail,
    detailLines: normalizeDetailLines(finding.detail, finding.remediation),
    findingIds: [finding.checkId],
    freezeRequested: finding.severity === "critical",
  };
}

function buildIncidentCandidates(params: {
  findings: SecurityAuditFinding[];
  signals: GovernanceEnforcementSignal[];
}): GovernanceSovereigntyIncidentCandidate[] {
  const candidates = new Map<string, GovernanceSovereigntyIncidentCandidate>();
  const coveredReasonCodes = new Set(params.signals.map((entry) => entry.reasonCode));

  for (const signal of params.signals) {
    const candidate = buildSignalIncidentCandidate(signal);
    candidates.set(candidate.key, candidate);
  }

  for (const finding of params.findings) {
    if (!finding.checkId.startsWith("governance.")) {
      continue;
    }
    if (finding.severity === "info") {
      continue;
    }
    const mappedReasonCode = GOVERNANCE_FINDING_REASON_CODE_MAP.get(finding.checkId);
    if (mappedReasonCode && coveredReasonCodes.has(mappedReasonCode)) {
      continue;
    }
    const candidate = buildFindingIncidentCandidate(finding);
    candidates.set(candidate.key, candidate);
  }

  return [...candidates.values()];
}

export function evaluateGovernanceSovereigntyIncidents(params: {
  cfg: ZhushouConfig;
  charterDir?: string;
  observedAt?: number;
  findings?: SecurityAuditFinding[];
}): GovernanceSovereigntyAuditEvaluation {
  const snapshot = loadGovernanceCharter({
    charterDir: params.charterDir,
  });
  const findings =
    params.findings ??
    collectGovernanceCharterFindings({
      cfg: params.cfg,
      charterDir: params.charterDir,
    });
  const signals = collectGovernanceEnforcementSignals(params.cfg, snapshot);
  return {
    observedAt: params.observedAt ?? Date.now(),
    charterDir: snapshot.charterDir,
    findings,
    signals,
    candidates: buildIncidentCandidates({
      findings,
      signals,
    }),
  };
}

export function reconcileGovernanceSovereigntyAuditSync(params: {
  cfg: ZhushouConfig;
  charterDir?: string;
  observedAt?: number;
  findings?: SecurityAuditFinding[];
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): GovernanceSovereigntyIncidentSyncResult {
  const evaluation = evaluateGovernanceSovereigntyIncidents(params);
  return reconcileGovernanceSovereigntyIncidentsSync({
    candidates: evaluation.candidates,
    observedAt: evaluation.observedAt,
    ...(params.stateDir ? { stateDir: params.stateDir } : {}),
    ...(params.env ? { env: params.env } : {}),
  });
}
