import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import { summarizeGovernanceSovereigntyIncidentsSync } from "./sovereignty-incidents.js";

const GOVERNANCE_FREEZE_TOOL_DENY = [
  "apply_patch",
  "write",
  "edit",
  "exec",
  "process",
  "gateway",
  "cron",
  "subagents",
  "sessions_spawn",
  "nodes",
] as const;

type GovernanceYamlDocument<T extends Record<string, unknown> = Record<string, unknown>> = {
  path: string;
  exists: boolean;
  data: T | null;
  parseError: string | null;
};

type ConstitutionRecord = Record<string, unknown> & {
  charter_artifacts?: Record<string, unknown>;
  sovereign_boundaries?: Record<string, unknown>;
};

type SovereigntyPolicyRecord = Record<string, unknown> & {
  reserved_authorities?: Record<string, unknown>;
  automatic_enforcement?: Record<string, unknown>;
};

export type GovernanceCharterSnapshot = {
  repoRoot: string;
  charterDir: string;
  discovered: boolean;
  constitution: GovernanceYamlDocument;
  sovereigntyPolicy: GovernanceYamlDocument;
  evolutionPolicy: GovernanceYamlDocument;
  artifactPaths: string[];
  missingArtifactPaths: string[];
  reservedAuthorities: string[];
  automaticEnforcementActions: string[];
  freezeTargets: string[];
};

export type GovernanceBoundaryExposure = {
  kind: "network" | "execution";
  scope: "critical" | "elevated";
  detail: string;
};

export type GovernanceEnforcementReasonCode =
  | "constitution_missing"
  | "constitution_invalid"
  | "sovereignty_policy_missing"
  | "sovereignty_policy_invalid"
  | "evolution_policy_missing"
  | "evolution_policy_invalid"
  | "freeze_without_auditor"
  | "network_boundary_opened"
  | "exec_boundary_opened"
  | "sovereignty_incident_open";

export type GovernanceEnforcementSignalSeverity = "warn" | "critical";

export type GovernanceEnforcementSignal = {
  reasonCode: Exclude<GovernanceEnforcementReasonCode, "sovereignty_incident_open">;
  severity: GovernanceEnforcementSignalSeverity;
  freezeActive: boolean;
  title: string;
  message: string;
  details: string[];
};

export type GovernanceEnforcementState = {
  active: boolean;
  reasonCode?: GovernanceEnforcementReasonCode;
  message?: string;
  details: string[];
  denyTools: string[];
  snapshot: GovernanceCharterSnapshot;
  activeSovereigntyIncidentIds: string[];
  activeSovereigntyFreezeIncidentIds: string[];
};

function moduleRepoRoot(): string {
  return path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
}

function defaultCharterDir(): string {
  return path.join(moduleRepoRoot(), "governance", "charter");
}

function parseYamlRecord(raw: string): Record<string, unknown> | null {
  const parsed = YAML.parse(raw, { schema: "core" }) as unknown;
  return isRecord(parsed) ? parsed : null;
}

function readYamlDocument<T extends Record<string, unknown>>(filePath: string): GovernanceYamlDocument<T> {
  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
      data: null,
      parseError: null,
    };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseYamlRecord(raw);
    if (!parsed) {
      return {
        path: filePath,
        exists: true,
        data: null,
        parseError: "document must be a YAML mapping",
      };
    }
    return {
      path: filePath,
      exists: true,
      data: parsed as T,
      parseError: null,
    };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      data: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => normalizeOptionalString(typeof entry === "string" ? entry : undefined))
    .filter((entry): entry is string => Boolean(entry));
}

function collectArtifactPaths(constitution: ConstitutionRecord | null): string[] {
  if (!constitution || !isRecord(constitution.charter_artifacts)) {
    return [];
  }
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const value of Object.values(constitution.charter_artifacts)) {
    for (const entry of readStringArray(value)) {
      if (seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      paths.push(entry);
    }
  }
  return paths;
}

function collectMissingArtifactPaths(repoRoot: string, artifactPaths: string[]): string[] {
  return artifactPaths.filter((artifactPath) => !fs.existsSync(path.join(repoRoot, artifactPath)));
}

function collectReservedAuthorities(
  constitution: ConstitutionRecord | null,
  sovereigntyPolicy: SovereigntyPolicyRecord | null,
): string[] {
  const seen = new Set<string>();
  const values = [
    ...readStringArray(constitution?.sovereign_boundaries?.["human_reserved_powers"]),
    ...readStringArray(sovereigntyPolicy?.reserved_authorities?.["human_sovereign_only"]),
    ...readStringArray(sovereigntyPolicy?.reserved_authorities?.["never_delegated"]),
  ];
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function collectAutomaticEnforcementActions(sovereigntyPolicy: SovereigntyPolicyRecord | null): string[] {
  return readStringArray(sovereigntyPolicy?.automatic_enforcement?.["on_high_or_critical_breach"]);
}

function collectFreezeTargets(sovereigntyPolicy: SovereigntyPolicyRecord | null): string[] {
  return readStringArray(sovereigntyPolicy?.automatic_enforcement?.["freeze_targets"]);
}

export function loadGovernanceCharter(options: { charterDir?: string } = {}): GovernanceCharterSnapshot {
  const charterDir = path.resolve(options.charterDir ?? defaultCharterDir());
  const repoRoot = path.resolve(charterDir, "..", "..");
  const discovered = fs.existsSync(charterDir);
  const constitution = readYamlDocument<ConstitutionRecord>(path.join(charterDir, "constitution.yaml"));
  const sovereigntyPolicy = readYamlDocument<SovereigntyPolicyRecord>(
    path.join(charterDir, "policies", "sovereignty.yaml"),
  );
  const evolutionPolicy = readYamlDocument(path.join(charterDir, "policies", "evolution-policy.yaml"));
  const artifactPaths = collectArtifactPaths(constitution.data);

  return {
    repoRoot,
    charterDir,
    discovered,
    constitution,
    sovereigntyPolicy,
    evolutionPolicy,
    artifactPaths,
    missingArtifactPaths: collectMissingArtifactPaths(repoRoot, artifactPaths),
    reservedAuthorities: collectReservedAuthorities(constitution.data, sovereigntyPolicy.data),
    automaticEnforcementActions: collectAutomaticEnforcementActions(sovereigntyPolicy.data),
    freezeTargets: collectFreezeTargets(sovereigntyPolicy.data),
  };
}

function hasReservedAuthority(snapshot: GovernanceCharterSnapshot, ...candidates: string[]): boolean {
  const reserved = new Set(snapshot.reservedAuthorities);
  return candidates.some((candidate) => reserved.has(candidate));
}

export function collectGovernanceBoundaryExposures(
  cfg: ZhushouConfig,
  snapshot: GovernanceCharterSnapshot,
): GovernanceBoundaryExposure[] {
  if (!snapshot.discovered) {
    return [];
  }
  const exposures: GovernanceBoundaryExposure[] = [];
  const bind = cfg.gateway?.bind;
  const tailscaleMode = cfg.gateway?.tailscale?.mode;
  const authMode = cfg.gateway?.auth?.mode;
  const controlUi = cfg.gateway?.controlUi;
  const globalExecSecurity = cfg.tools?.exec?.security;
  const elevatedEnabled = cfg.tools?.elevated?.enabled === true;
  const applyPatchWorkspaceOnly = cfg.tools?.exec?.applyPatch?.workspaceOnly;

  if (
    hasReservedAuthority(
      snapshot,
      "global_high_risk_network_opening",
      "external_high_risk_network_opening",
    )
  ) {
    if (bind === "lan" || bind === "custom" || bind === "tailnet") {
      exposures.push({
        kind: "network",
        scope: "critical",
        detail: `gateway.bind=${bind}`,
      });
    }
    if (tailscaleMode === "funnel") {
      exposures.push({
        kind: "network",
        scope: "critical",
        detail: "gateway.tailscale.mode=funnel",
      });
    }
    if (authMode === "trusted-proxy") {
      exposures.push({
        kind: "network",
        scope: "elevated",
        detail: "gateway.auth.mode=trusted-proxy",
      });
    }
    if (controlUi?.allowInsecureAuth === true) {
      exposures.push({
        kind: "network",
        scope: "elevated",
        detail: "gateway.controlUi.allowInsecureAuth=true",
      });
    }
    if (controlUi?.dangerouslyAllowHostHeaderOriginFallback === true) {
      exposures.push({
        kind: "network",
        scope: "critical",
        detail: "gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true",
      });
    }
    if (controlUi?.dangerouslyDisableDeviceAuth === true) {
      exposures.push({
        kind: "network",
        scope: "critical",
        detail: "gateway.controlUi.dangerouslyDisableDeviceAuth=true",
      });
    }
  }

  if (hasReservedAuthority(snapshot, "root_privilege_expansion", "remove_rollback_paths")) {
    if (globalExecSecurity === "full") {
      exposures.push({
        kind: "execution",
        scope: "critical",
        detail: "tools.exec.security=full",
      });
    }
    if (applyPatchWorkspaceOnly === false) {
      exposures.push({
        kind: "execution",
        scope: "elevated",
        detail: "tools.exec.applyPatch.workspaceOnly=false",
      });
    }
    if (elevatedEnabled) {
      exposures.push({
        kind: "execution",
        scope: "elevated",
        detail: "tools.elevated.enabled=true",
      });
    }
  }

  return exposures;
}

function hasHealthySovereigntyAuditorArtifact(snapshot: GovernanceCharterSnapshot): boolean {
  return snapshot.artifactPaths.some(
    (entry) =>
      entry.endsWith("governance/charter/agents/sovereignty-auditor.yaml") &&
      !snapshot.missingArtifactPaths.includes(entry),
  );
}

function createGovernanceEnforcementState(params: {
  snapshot: GovernanceCharterSnapshot;
  active: boolean;
  reasonCode?: GovernanceEnforcementState["reasonCode"];
  message?: string;
  details?: string[];
  activeSovereigntyIncidentIds?: string[];
  activeSovereigntyFreezeIncidentIds?: string[];
}): GovernanceEnforcementState {
  return {
    active: params.active,
    reasonCode: params.reasonCode,
    message: params.message,
    details: params.details ?? [],
    denyTools: params.active ? [...GOVERNANCE_FREEZE_TOOL_DENY] : [],
    snapshot: params.snapshot,
    activeSovereigntyIncidentIds: [...(params.activeSovereigntyIncidentIds ?? [])],
    activeSovereigntyFreezeIncidentIds: [...(params.activeSovereigntyFreezeIncidentIds ?? [])],
  };
}

export function collectGovernanceEnforcementSignals(
  cfg: ZhushouConfig,
  snapshot: GovernanceCharterSnapshot,
): GovernanceEnforcementSignal[] {
  if (!snapshot.discovered) {
    return [];
  }
  const requiredDocs = [
    {
      doc: snapshot.constitution,
      missingCode: "constitution_missing" as const,
      invalidCode: "constitution_invalid" as const,
      label: "constitution",
    },
    {
      doc: snapshot.sovereigntyPolicy,
      missingCode: "sovereignty_policy_missing" as const,
      invalidCode: "sovereignty_policy_invalid" as const,
      label: "sovereignty policy",
    },
    {
      doc: snapshot.evolutionPolicy,
      missingCode: "evolution_policy_missing" as const,
      invalidCode: "evolution_policy_invalid" as const,
      label: "evolution policy",
    },
  ] as const;

  const signals: GovernanceEnforcementSignal[] = [];
  for (const entry of requiredDocs) {
    if (!entry.doc.exists) {
      signals.push({
        reasonCode: entry.missingCode,
        severity: "critical",
        freezeActive: true,
        title: `${entry.label} missing`,
        message: `ACP dispatch is frozen by governance policy because the ${entry.label} document is missing: ${entry.doc.path}.`,
        details: [entry.doc.path],
      });
      continue;
    }
    if (entry.doc.parseError) {
      signals.push({
        reasonCode: entry.invalidCode,
        severity: "critical",
        freezeActive: true,
        title: `${entry.label} invalid`,
        message:
          `ACP dispatch is frozen by governance policy because the ${entry.label} document is invalid: ` +
          `${entry.doc.path} (${entry.doc.parseError}).`,
        details: [entry.doc.path, entry.doc.parseError],
      });
      continue;
    }
  }

  if (snapshot.freezeTargets.length > 0 && !hasHealthySovereigntyAuditorArtifact(snapshot)) {
    signals.push({
      reasonCode: "freeze_without_auditor",
      severity: "critical",
      freezeActive: true,
      title: "Freeze policy exists without a usable sovereignty auditor",
      message:
        "ACP dispatch is frozen by governance policy because automatic freeze targets exist without a usable sovereignty auditor blueprint.",
      details: snapshot.freezeTargets,
    });
  }

  const exposures = collectGovernanceBoundaryExposures(cfg, snapshot);
  const criticalNetworkExposures = exposures.filter(
    (entry) => entry.kind === "network" && entry.scope === "critical",
  );
  const networkExposures = exposures.filter((entry) => entry.kind === "network");
  if (networkExposures.length > 0) {
    const networkFreezeActive = criticalNetworkExposures.length > 0;
    signals.push({
      reasonCode: "network_boundary_opened",
      severity: networkFreezeActive ? "critical" : "warn",
      freezeActive: networkFreezeActive,
      title: "Sovereign-grade network boundary opened",
      message: networkFreezeActive
        ? "ACP dispatch is frozen by governance policy because the current config opens a sovereign-grade network boundary."
        : "The current config opens a sovereign-grade network boundary that requires sovereign review.",
      details: networkExposures.map((entry) => entry.detail),
    });
  }

  const criticalExecExposures = exposures.filter(
    (entry) => entry.kind === "execution" && entry.scope === "critical",
  );
  const executionExposures = exposures.filter((entry) => entry.kind === "execution");
  if (executionExposures.length > 0) {
    const execFreezeActive = criticalExecExposures.length > 0;
    signals.push({
      reasonCode: "exec_boundary_opened",
      severity: execFreezeActive ? "critical" : "warn",
      freezeActive: execFreezeActive,
      title: "Sovereign-grade execution surface expanded",
      message: execFreezeActive
        ? "ACP dispatch is frozen by governance policy because the current config expands a sovereign-grade execution surface."
        : "The current config expands a sovereign-grade execution surface that requires sovereign review.",
      details: executionExposures.map((entry) => entry.detail),
    });
  }

  return signals;
}

export function resolveGovernanceEnforcementState(
  cfg: ZhushouConfig,
  options: { charterDir?: string; stateDir?: string; env?: NodeJS.ProcessEnv } = {},
): GovernanceEnforcementState {
  const snapshot = loadGovernanceCharter({ charterDir: options.charterDir });
  if (!snapshot.discovered) {
    return createGovernanceEnforcementState({ snapshot, active: false });
  }

  const sovereignty = summarizeGovernanceSovereigntyIncidentsSync({
    ...(options.stateDir ? { stateDir: options.stateDir } : {}),
    ...(options.env ? { env: options.env } : {}),
  });
  const signals = collectGovernanceEnforcementSignals(cfg, snapshot);
  const freezeSignal = signals.find((entry) => entry.freezeActive);
  if (freezeSignal) {
    return createGovernanceEnforcementState({
      snapshot,
      active: true,
      reasonCode: freezeSignal.reasonCode,
      message: freezeSignal.message,
      details: freezeSignal.details,
      activeSovereigntyIncidentIds: sovereignty.activeIncidentIds,
      activeSovereigntyFreezeIncidentIds: sovereignty.freezeIncidentIds,
    });
  }

  if (sovereignty.freezeActive) {
    const freezeIncidents = sovereignty.incidents
      .filter((entry) => entry.status === "open" && entry.freezeRequested)
      .slice(0, 8);
    return createGovernanceEnforcementState({
      snapshot,
      active: true,
      reasonCode: "sovereignty_incident_open",
      message:
        "ACP dispatch is frozen by governance policy because open sovereignty incidents still require containment.",
      details: freezeIncidents.map((entry) => `${entry.id}: ${entry.title}`),
      activeSovereigntyIncidentIds: sovereignty.activeIncidentIds,
      activeSovereigntyFreezeIncidentIds: sovereignty.freezeIncidentIds,
    });
  }

  return createGovernanceEnforcementState({
    snapshot,
    active: false,
    activeSovereigntyIncidentIds: sovereignty.activeIncidentIds,
    activeSovereigntyFreezeIncidentIds: sovereignty.freezeIncidentIds,
  });
}

function replaceGovernanceMessageSubject(message: string | undefined, subject: string): string {
  const trimmedMessage = normalizeOptionalString(message);
  if (!trimmedMessage) {
    return `${subject} is frozen by governance policy.`;
  }
  return trimmedMessage.replace(/^ACP dispatch\b/iu, subject);
}

export function formatGovernanceEnforcementMessage(params: {
  subject: string;
  enforcement: GovernanceEnforcementState;
}): string {
  const subject = normalizeOptionalString(params.subject) ?? "governance operation";
  const base = replaceGovernanceMessageSubject(params.enforcement.message, subject);
  if (params.enforcement.details.length === 0) {
    return base;
  }
  return `${base}\ndetails:\n${params.enforcement.details.map((entry) => `- ${entry}`).join("\n")}`;
}

export function resolveGovernanceToolPolicy(
  cfg: ZhushouConfig,
  options: { charterDir?: string; stateDir?: string; env?: NodeJS.ProcessEnv } = {},
): { deny: string[] } | undefined {
  const enforcement = resolveGovernanceEnforcementState(cfg, options);
  if (!enforcement.active || enforcement.denyTools.length === 0) {
    return undefined;
  }
  return { deny: enforcement.denyTools };
}
