import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";

const SOVEREIGNTY_INCIDENT_LEDGER_VERSION = 1;

export type GovernanceSovereigntyIncidentSeverity = "warn" | "critical";
export type GovernanceSovereigntyIncidentStatus = "open" | "resolved";
export type GovernanceSovereigntyIncidentSource = "signal" | "finding";

export type GovernanceSovereigntyIncidentCandidate = {
  key: string;
  severity: GovernanceSovereigntyIncidentSeverity;
  source: GovernanceSovereigntyIncidentSource;
  title: string;
  summary: string;
  reasonCode?: string;
  detailLines: string[];
  findingIds: string[];
  freezeRequested: boolean;
};

export type GovernanceSovereigntyIncidentRecord = {
  id: string;
  key: string;
  status: GovernanceSovereigntyIncidentStatus;
  severity: GovernanceSovereigntyIncidentSeverity;
  source: GovernanceSovereigntyIncidentSource;
  title: string;
  summary: string;
  reasonCode?: string;
  detailLines: string[];
  findingIds: string[];
  freezeRequested: boolean;
  firstObservedAt: number;
  lastObservedAt: number;
  updatedAt: number;
  resolvedAt?: number;
};

type GovernanceSovereigntyIncidentLedgerFile = {
  version: number;
  incidents: GovernanceSovereigntyIncidentRecord[];
};

export type GovernanceSovereigntyIncidentSummary = {
  storagePath: string;
  total: number;
  open: number;
  resolved: number;
  criticalOpen: number;
  freezeActive: boolean;
  activeIncidentIds: string[];
  freezeIncidentIds: string[];
  latestObservedAt?: number;
  incidents: GovernanceSovereigntyIncidentRecord[];
};

export type GovernanceSovereigntyIncidentSyncResult = GovernanceSovereigntyIncidentSummary & {
  openedIds: string[];
  reopenedIds: string[];
  resolvedIds: string[];
};

function isGovernanceSovereigntyIncidentSeverity(
  value: unknown,
): value is GovernanceSovereigntyIncidentSeverity {
  return value === "warn" || value === "critical";
}

function isGovernanceSovereigntyIncidentStatus(
  value: unknown,
): value is GovernanceSovereigntyIncidentStatus {
  return value === "open" || value === "resolved";
}

function isGovernanceSovereigntyIncidentSource(
  value: unknown,
): value is GovernanceSovereigntyIncidentSource {
  return value === "signal" || value === "finding";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => normalizeOptionalString(typeof entry === "string" ? entry : undefined))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeGovernanceSovereigntyIncidentRecord(
  value: unknown,
): GovernanceSovereigntyIncidentRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeOptionalString(typeof value.id === "string" ? value.id : undefined);
  const key = normalizeOptionalString(typeof value.key === "string" ? value.key : undefined);
  const title = normalizeOptionalString(typeof value.title === "string" ? value.title : undefined);
  const summary = normalizeOptionalString(typeof value.summary === "string" ? value.summary : undefined);
  if (!id || !key || !title || !summary) {
    return null;
  }
  if (
    !isGovernanceSovereigntyIncidentStatus(value.status) ||
    !isGovernanceSovereigntyIncidentSeverity(value.severity) ||
    !isGovernanceSovereigntyIncidentSource(value.source)
  ) {
    return null;
  }
  const firstObservedAt = typeof value.firstObservedAt === "number" ? value.firstObservedAt : NaN;
  const lastObservedAt = typeof value.lastObservedAt === "number" ? value.lastObservedAt : NaN;
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : NaN;
  if (
    !Number.isFinite(firstObservedAt) ||
    !Number.isFinite(lastObservedAt) ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }
  const resolvedAt =
    typeof value.resolvedAt === "number" && Number.isFinite(value.resolvedAt)
      ? value.resolvedAt
      : undefined;
  const reasonCode = normalizeOptionalString(
    typeof value.reasonCode === "string" ? value.reasonCode : undefined,
  );
  return {
    id,
    key,
    status: value.status,
    severity: value.severity,
    source: value.source,
    title,
    summary,
    ...(reasonCode ? { reasonCode } : {}),
    detailLines: normalizeStringArray(value.detailLines),
    findingIds: normalizeStringArray(value.findingIds),
    freezeRequested: value.freezeRequested === true,
    firstObservedAt,
    lastObservedAt,
    updatedAt,
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
  };
}

function sortGovernanceSovereigntyIncidents(
  incidents: GovernanceSovereigntyIncidentRecord[],
): GovernanceSovereigntyIncidentRecord[] {
  return [...incidents].toSorted((left, right) => {
    if (left.status !== right.status) {
      return left.status === "open" ? -1 : 1;
    }
    return right.lastObservedAt - left.lastObservedAt;
  });
}

function buildGovernanceSovereigntyIncidentId(key: string): string {
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `sovereignty.${digest}`;
}

function normalizeGovernanceSovereigntyIncidentCandidate(
  candidate: GovernanceSovereigntyIncidentCandidate,
): GovernanceSovereigntyIncidentCandidate {
  const key = normalizeOptionalString(candidate.key);
  const title = normalizeOptionalString(candidate.title);
  const summary = normalizeOptionalString(candidate.summary);
  if (!key || !title || !summary) {
    throw new Error("Governance sovereignty incident candidate requires key, title, and summary.");
  }
  if (!isGovernanceSovereigntyIncidentSeverity(candidate.severity)) {
    throw new Error(`Unsupported governance sovereignty incident severity: ${String(candidate.severity)}`);
  }
  if (!isGovernanceSovereigntyIncidentSource(candidate.source)) {
    throw new Error(`Unsupported governance sovereignty incident source: ${String(candidate.source)}`);
  }
  const reasonCode = normalizeOptionalString(candidate.reasonCode);
  return {
    key,
    severity: candidate.severity,
    source: candidate.source,
    title,
    summary,
    ...(reasonCode ? { reasonCode } : {}),
    detailLines: normalizeStringArray(candidate.detailLines),
    findingIds: normalizeStringArray(candidate.findingIds),
    freezeRequested: candidate.freezeRequested ?? false,
  };
}

function createGovernanceSovereigntyIncidentRecord(params: {
  candidate: GovernanceSovereigntyIncidentCandidate;
  observedAt: number;
  existing?: GovernanceSovereigntyIncidentRecord;
}): GovernanceSovereigntyIncidentRecord {
  const { candidate, observedAt, existing } = params;
  return {
    id: existing?.id ?? buildGovernanceSovereigntyIncidentId(candidate.key),
    key: candidate.key,
    status: "open",
    severity: candidate.severity,
    source: candidate.source,
    title: candidate.title,
    summary: candidate.summary,
    ...(candidate.reasonCode ? { reasonCode: candidate.reasonCode } : {}),
    detailLines: [...candidate.detailLines],
    findingIds: [...candidate.findingIds],
    freezeRequested: candidate.freezeRequested,
    firstObservedAt: existing?.firstObservedAt ?? observedAt,
    lastObservedAt: observedAt,
    updatedAt: observedAt,
  };
}

function createResolvedGovernanceSovereigntyIncidentRecord(params: {
  incident: GovernanceSovereigntyIncidentRecord;
  observedAt: number;
}): GovernanceSovereigntyIncidentRecord {
  return {
    ...params.incident,
    status: "resolved",
    updatedAt: params.observedAt,
    resolvedAt: params.observedAt,
  };
}

function buildGovernanceSovereigntyIncidentSummary(params: {
  storagePath: string;
  incidents: GovernanceSovereigntyIncidentRecord[];
}): GovernanceSovereigntyIncidentSummary {
  const incidents = sortGovernanceSovereigntyIncidents(params.incidents);
  const openIncidents = incidents.filter((entry) => entry.status === "open");
  const freezeIncidents = openIncidents.filter((entry) => entry.freezeRequested);
  const latestObservedAt = incidents.reduce<number | undefined>(
    (latest, entry) => (latest === undefined || entry.lastObservedAt > latest ? entry.lastObservedAt : latest),
    undefined,
  );
  return {
    storagePath: params.storagePath,
    total: incidents.length,
    open: openIncidents.length,
    resolved: incidents.filter((entry) => entry.status === "resolved").length,
    criticalOpen: openIncidents.filter((entry) => entry.severity === "critical").length,
    freezeActive: freezeIncidents.length > 0,
    activeIncidentIds: openIncidents.map((entry) => entry.id),
    freezeIncidentIds: freezeIncidents.map((entry) => entry.id),
    ...(latestObservedAt !== undefined ? { latestObservedAt } : {}),
    incidents,
  };
}

export function resolveGovernanceSovereigntyIncidentStoragePath(
  params: { stateDir?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  return path.join(
    params.stateDir ?? resolveStateDir(params.env),
    "governance",
    "sovereignty-incidents.json",
  );
}

function readGovernanceSovereigntyIncidentLedgerFileSync(params: {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
} = {}): GovernanceSovereigntyIncidentLedgerFile {
  const storagePath = resolveGovernanceSovereigntyIncidentStoragePath(params);
  if (!fs.existsSync(storagePath)) {
    return {
      version: SOVEREIGNTY_INCIDENT_LEDGER_VERSION,
      incidents: [],
    };
  }
  try {
    const raw = fs.readFileSync(storagePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {
        version: SOVEREIGNTY_INCIDENT_LEDGER_VERSION,
        incidents: [],
      };
    }
    const incidents = Array.isArray(parsed.incidents)
      ? parsed.incidents
          .map((entry) => normalizeGovernanceSovereigntyIncidentRecord(entry))
          .filter((entry): entry is GovernanceSovereigntyIncidentRecord => Boolean(entry))
      : [];
    return {
      version:
        typeof parsed.version === "number" && Number.isFinite(parsed.version)
          ? parsed.version
          : SOVEREIGNTY_INCIDENT_LEDGER_VERSION,
      incidents,
    };
  } catch {
    return {
      version: SOVEREIGNTY_INCIDENT_LEDGER_VERSION,
      incidents: [],
    };
  }
}

export function summarizeGovernanceSovereigntyIncidentsSync(params: {
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
} = {}): GovernanceSovereigntyIncidentSummary {
  const storagePath = resolveGovernanceSovereigntyIncidentStoragePath(params);
  const ledger = readGovernanceSovereigntyIncidentLedgerFileSync(params);
  return buildGovernanceSovereigntyIncidentSummary({
    storagePath,
    incidents: ledger.incidents,
  });
}

export function reconcileGovernanceSovereigntyIncidentsSync(params: {
  candidates: GovernanceSovereigntyIncidentCandidate[];
  observedAt?: number;
  stateDir?: string;
  env?: NodeJS.ProcessEnv;
}): GovernanceSovereigntyIncidentSyncResult {
  const observedAt = params.observedAt ?? Date.now();
  const storagePath = resolveGovernanceSovereigntyIncidentStoragePath(params);
  const storageDir = path.dirname(storagePath);
  const existing = readGovernanceSovereigntyIncidentLedgerFileSync(params).incidents;
  const existingByKey = new Map(existing.map((entry) => [entry.key, entry] as const));
  const normalizedCandidates = Array.from(
    new Map(
      params.candidates.map((candidate) => {
        const normalized = normalizeGovernanceSovereigntyIncidentCandidate(candidate);
        return [normalized.key, normalized] as const;
      }),
    ).values(),
  );
  const seenKeys = new Set<string>();
  const nextIncidents: GovernanceSovereigntyIncidentRecord[] = [];
  const openedIds: string[] = [];
  const reopenedIds: string[] = [];
  const resolvedIds: string[] = [];

  for (const candidate of normalizedCandidates) {
    seenKeys.add(candidate.key);
    const previous = existingByKey.get(candidate.key);
    const next = createGovernanceSovereigntyIncidentRecord({
      candidate,
      observedAt,
      ...(previous ? { existing: previous } : {}),
    });
    if (!previous) {
      openedIds.push(next.id);
    } else if (previous.status === "resolved") {
      reopenedIds.push(next.id);
    }
    nextIncidents.push(next);
  }

  for (const incident of existing) {
    if (seenKeys.has(incident.key)) {
      continue;
    }
    if (incident.status === "open") {
      const resolved = createResolvedGovernanceSovereigntyIncidentRecord({
        incident,
        observedAt,
      });
      resolvedIds.push(resolved.id);
      nextIncidents.push(resolved);
      continue;
    }
    nextIncidents.push(incident);
  }

  const ledger: GovernanceSovereigntyIncidentLedgerFile = {
    version: SOVEREIGNTY_INCIDENT_LEDGER_VERSION,
    incidents: sortGovernanceSovereigntyIncidents(nextIncidents),
  };
  fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(storagePath, JSON.stringify(ledger, null, 2), "utf8");

  const summary = buildGovernanceSovereigntyIncidentSummary({
    storagePath,
    incidents: ledger.incidents,
  });
  return {
    ...summary,
    openedIds,
    reopenedIds,
    resolvedIds,
  };
}
