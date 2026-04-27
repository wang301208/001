import fs from "node:fs/promises";
import path from "node:path";
import { getQueuedFileWriter, type QueuedFileWriter } from "../../agents/queued-file-writer.js";
import { resolveStateDir } from "../../config/paths.js";
import { appendAuditFact } from "../../infra/audit-stream.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { isRecord } from "../../utils.js";
import type {
  AutonomyFleetHistoryEvent,
  AutonomyFleetHistoryMode,
  AutonomyFleetHistoryParams,
  AutonomyFleetHistoryResult,
  AutonomyFleetHistorySource,
} from "./runtime-autonomy.types.js";

const writers = new Map<string, QueuedFileWriter>();
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 200;

function normalizeWorkspaceDirs(workspaceDirs?: string[]): string[] {
  return Array.from(
    new Set((workspaceDirs ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function resolveHistoryLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_HISTORY_LIMIT;
  }
  const normalized = Math.floor(limit);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Autonomy history limit must be a positive integer.");
  }
  return Math.min(normalized, MAX_HISTORY_LIMIT);
}

function getHistoryWriter(filePath: string): QueuedFileWriter {
  return getQueuedFileWriter(writers, filePath);
}

function parseHistoryEvent(line: string): AutonomyFleetHistoryEvent | undefined {
  if (!line.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) {
      return undefined;
    }
    if (typeof parsed.eventId !== "string" || typeof parsed.ts !== "number") {
      return undefined;
    }
    if (
      (parsed.mode !== "heal" && parsed.mode !== "reconcile") ||
      (parsed.source !== "manual" &&
        parsed.source !== "startup" &&
        parsed.source !== "supervisor")
    ) {
      return undefined;
    }
    if (typeof parsed.sessionKey !== "string" || !Array.isArray(parsed.entries)) {
      return undefined;
    }
    return parsed as AutonomyFleetHistoryEvent;
  } catch {
    return undefined;
  }
}

function matchesHistoryFilters(
  event: AutonomyFleetHistoryEvent,
  params: Pick<AutonomyFleetHistoryParams, "agentIds" | "workspaceDirs" | "mode" | "source">,
): boolean {
  if (params.mode && event.mode !== params.mode) {
    return false;
  }
  if (params.source && event.source !== params.source) {
    return false;
  }
  if (!params.agentIds?.length) {
    if (!params.workspaceDirs?.length) {
      return true;
    }
  } else {
    const filter = new Set(params.agentIds.map((agentId) => normalizeAgentId(agentId)));
    if (!event.entries.some((entry) => filter.has(normalizeAgentId(entry.agentId)))) {
      return false;
    }
  }
  if (!params.workspaceDirs?.length) {
    return true;
  }
  const filter = new Set(normalizeWorkspaceDirs(params.workspaceDirs));
  const eventWorkspaceDirs = normalizeWorkspaceDirs(event.workspaceDirs);
  if (eventWorkspaceDirs.some((workspaceDir) => filter.has(workspaceDir))) {
    return true;
  }
  return event.entries.some((entry) =>
    normalizeWorkspaceDirs(entry.workspaceDirs).some((workspaceDir) => filter.has(workspaceDir)),
  );
}

export function resolveAutonomyFleetHistoryPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "autonomy", "fleet-history.jsonl");
}

export async function appendAutonomyFleetHistoryEvent(params: {
  event: AutonomyFleetHistoryEvent;
  env?: NodeJS.ProcessEnv;
  filePath?: string;
}): Promise<void> {
  const filePath = params.filePath ?? resolveAutonomyFleetHistoryPath(params.env);
  const writer = getHistoryWriter(filePath);
  writer.write(`${JSON.stringify(params.event)}\n`);
  await writer.flush();
  await appendAuditFact({
    fact: {
      domain: "autonomy",
      action: "fleet.history.recorded",
      actor: {
        type: "runtime",
        id: "runtime-autonomy",
      },
      refs: {
        sessionKey: params.event.sessionKey,
        workspaceDirs: [...(params.event.workspaceDirs ?? [])],
      },
      summary: `${params.event.mode} history recorded with ${params.event.entries.length} entries`,
      payload: {
        eventId: params.event.eventId,
        mode: params.event.mode,
        source: params.event.source,
        entryCount: params.event.entries.length,
      },
    },
    ...(params.env ? { env: params.env } : {}),
  });
}

export async function listAutonomyFleetHistory(
  params: AutonomyFleetHistoryParams & {
    env?: NodeJS.ProcessEnv;
    filePath?: string;
  },
): Promise<AutonomyFleetHistoryResult> {
  const filePath = params.filePath ?? resolveAutonomyFleetHistoryPath(params.env);
  const limit = resolveHistoryLimit(params.limit);

  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      return {
        events: [],
        total: 0,
        truncated: false,
      };
    }
    throw error;
  }

  const matched = raw
    .split(/\r?\n/u)
    .map((line) => parseHistoryEvent(line))
    .filter((event): event is AutonomyFleetHistoryEvent => Boolean(event))
    .filter((event) =>
      matchesHistoryFilters(event, {
        ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
        ...(params.mode ? { mode: params.mode as AutonomyFleetHistoryMode } : {}),
        ...(params.source ? { source: params.source as AutonomyFleetHistorySource } : {}),
      }),
    )
    .sort((left, right) => right.ts - left.ts);

  const events = matched.slice(0, limit);
  return {
    events,
    total: matched.length,
    truncated: matched.length > events.length,
  };
}
