import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getQueuedFileWriter, type QueuedFileWriter } from "../agents/queued-file-writer.js";
import { resolveStateDir } from "../config/paths.js";
import { publishLocalEventBusEvent } from "./local-event-bus.js";

export type AuditActorType = "agent" | "human" | "system" | "runtime";
export type AuditDomain =
  | "governance"
  | "task"
  | "task_flow"
  | "autonomy"
  | "sandbox"
  | "system";

export type AuditActor = {
  type: AuditActorType;
  id: string;
};

export type AuditFactRecord = {
  eventId: string;
  ts: number;
  domain: AuditDomain;
  action: string;
  actor: AuditActor;
  summary?: string;
  traceId?: string;
  causationId?: string;
  refs?: {
    sessionKey?: string;
    runId?: string;
    proposalId?: string;
    taskId?: string;
    flowId?: string;
    assetId?: string;
    workspaceDirs?: string[];
  };
  payload?: Record<string, unknown>;
};

export type AuditStreamSummary = {
  filePath: string;
  total: number;
  latestTs?: number;
  domains: string[];
};

const writers = new Map<string, QueuedFileWriter>();
const DEFAULT_AUDIT_LIMIT = 100;
const MAX_AUDIT_LIMIT = 500;

function getAuditWriter(filePath: string): QueuedFileWriter {
  return getQueuedFileWriter(writers, filePath);
}

function normalizeAuditLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_AUDIT_LIMIT;
  }
  const normalized = Math.floor(limit);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Audit stream limit must be a positive integer.");
  }
  return Math.min(normalized, MAX_AUDIT_LIMIT);
}

function parseAuditFact(line: string): AuditFactRecord | undefined {
  if (!line.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(line) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as AuditFactRecord).eventId !== "string" ||
      typeof (parsed as AuditFactRecord).ts !== "number" ||
      typeof (parsed as AuditFactRecord).domain !== "string" ||
      typeof (parsed as AuditFactRecord).action !== "string"
    ) {
      return undefined;
    }
    return parsed as AuditFactRecord;
  } catch {
    return undefined;
  }
}

function collectParsedAuditFacts(raw: string, domain?: AuditDomain): AuditFactRecord[] {
  return raw
    .split(/\r?\n/u)
    .map((line) => parseAuditFact(line))
    .filter((entry): entry is AuditFactRecord => Boolean(entry))
    .filter((entry) => (domain ? entry.domain === domain : true));
}

export function resolveAuditStreamPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "audit", "facts.jsonl");
}

export async function appendAuditFact(params: {
  fact: Omit<AuditFactRecord, "eventId" | "ts"> & {
    eventId?: string;
    ts?: number;
  };
  env?: NodeJS.ProcessEnv;
  filePath?: string;
}): Promise<AuditFactRecord> {
  const filePath = params.filePath ?? resolveAuditStreamPath(params.env);
  const fact: AuditFactRecord = {
    eventId: params.fact.eventId?.trim() || crypto.randomUUID(),
    ts: params.fact.ts ?? Date.now(),
    domain: params.fact.domain,
    action: params.fact.action,
    actor: params.fact.actor,
    ...(params.fact.summary ? { summary: params.fact.summary } : {}),
    ...(params.fact.traceId ? { traceId: params.fact.traceId } : {}),
    ...(params.fact.causationId ? { causationId: params.fact.causationId } : {}),
    ...(params.fact.refs ? { refs: params.fact.refs } : {}),
    ...(params.fact.payload ? { payload: params.fact.payload } : {}),
  };
  const writer = getAuditWriter(filePath);
  writer.write(`${JSON.stringify(fact)}\n`);
  await writer.flush();
  publishLocalEventBusEvent({
    topic: "audit.fact",
    source: "audit-stream",
    payload: {
      domain: fact.domain,
      action: fact.action,
      actor: fact.actor,
      refs: fact.refs ?? {},
    },
    ...(fact.refs?.sessionKey ? { sessionKey: fact.refs.sessionKey } : {}),
    ...(fact.refs?.runId ? { runId: fact.refs.runId } : {}),
    eventId: fact.eventId,
    ts: fact.ts,
  });
  return fact;
}

export async function listAuditFacts(params: {
  limit?: number;
  domain?: AuditDomain;
  filePath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<AuditFactRecord[]> {
  const filePath = params.filePath ?? resolveAuditStreamPath(params.env);
  const limit = normalizeAuditLimit(params.limit);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return collectParsedAuditFacts(raw, params.domain)
    .toSorted((left, right) => right.ts - left.ts)
    .slice(0, limit);
}

export function listAuditFactsSync(params: {
  limit?: number;
  domain?: AuditDomain;
  filePath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): AuditFactRecord[] {
  const filePath = params.filePath ?? resolveAuditStreamPath(params.env);
  const limit = normalizeAuditLimit(params.limit);
  let raw = "";
  try {
    raw = fsSync.readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return collectParsedAuditFacts(raw, params.domain)
    .toSorted((left, right) => right.ts - left.ts)
    .slice(0, limit);
}

export async function summarizeAuditStream(params: {
  filePath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<AuditStreamSummary> {
  const filePath = params.filePath ?? resolveAuditStreamPath(params.env);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return {
        filePath,
        total: 0,
        domains: [],
      };
    }
    throw error;
  }
  const facts = collectParsedAuditFacts(raw);
  const domains = Array.from(new Set(facts.map((entry) => entry.domain))).toSorted((left, right) =>
    left.localeCompare(right),
  );
  return {
    filePath,
    total: facts.length,
    ...(facts[0] ? { latestTs: facts[0].ts } : {}),
    domains,
  };
}

export function summarizeAuditStreamSync(params: {
  filePath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): AuditStreamSummary {
  const filePath = params.filePath ?? resolveAuditStreamPath(params.env);
  let raw = "";
  try {
    raw = fsSync.readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return {
        filePath,
        total: 0,
        domains: [],
      };
    }
    throw error;
  }
  const facts = collectParsedAuditFacts(raw);
  const domains = Array.from(new Set(facts.map((entry) => entry.domain))).toSorted((left, right) =>
    left.localeCompare(right),
  );
  return {
    filePath,
    total: facts.length,
    ...(facts[0] ? { latestTs: facts[0].ts } : {}),
    domains,
  };
}
