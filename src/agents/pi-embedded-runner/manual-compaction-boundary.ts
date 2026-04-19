import fs from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import {
  applyTaskStatusOverrideToSummary,
  getDefaultTaskStatusOverrideFromContinuationState,
  mergeTaskContinuationDetails,
  type ContinuationState,
  type SessionTaskContinuation,
} from "../task-status-override.js";

type SessionManagerLike = ReturnType<typeof SessionManager.open>;
type SessionEntry = ReturnType<SessionManagerLike["getEntries"]>[number];
type SessionHeader = NonNullable<ReturnType<SessionManagerLike["getHeader"]>>;
type CompactionEntry = Extract<SessionEntry, { type: "compaction" }>;

export type HardenedManualCompactionBoundary = {
  applied: boolean;
  firstKeptEntryId?: string;
  leafId?: string;
  messages: AgentMessage[];
};

function serializeSessionFile(header: SessionHeader, entries: SessionEntry[]): string {
  return (
    [JSON.stringify(header), ...entries.map((entry) => JSON.stringify(entry))].join("\n") + "\n"
  );
}

function replaceLatestCompactionSummary(params: {
  entries: SessionEntry[];
  compactionEntryId: string;
  projectedTaskStatusOverride?: string;
  taskStatusOverride?: string;
  continuation?: SessionTaskContinuation;
}): SessionEntry[] {
  return params.entries.map((entry) => {
    if (entry.type !== "compaction" || entry.id !== params.compactionEntryId) {
      return entry;
    }
    return {
      ...entry,
      summary:
        applyTaskStatusOverrideToSummary(
          entry.summary,
          params.projectedTaskStatusOverride ?? params.taskStatusOverride,
        ) ?? entry.summary,
      details: mergeTaskContinuationDetails({
        details: entry.details,
        continuation: params.continuation,
      }),
    } satisfies CompactionEntry;
  });
}

function replaceLatestCompactionBoundary(params: {
  entries: SessionEntry[];
  compactionEntryId: string;
}): SessionEntry[] {
  return params.entries.map((entry) => {
    if (entry.type !== "compaction" || entry.id !== params.compactionEntryId) {
      return entry;
    }
    return {
      ...entry,
      // Manual /compact is an explicit checkpoint request, so make the
      // rebuilt context start from the summary itself instead of preserving
      // an upstream "recent tail" that can keep large prior turns alive.
      firstKeptEntryId: entry.id,
    } satisfies CompactionEntry;
  });
}

export async function normalizeLatestCompactionEntry(params: {
  sessionFile: string;
  projectedTaskStatusOverride?: string;
  taskStatusOverride?: string;
  continuation?: SessionTaskContinuation;
  continuationState?: ContinuationState;
}): Promise<{ applied: boolean; leafId?: string; firstKeptEntryId?: string; messages: AgentMessage[] }> {
  const sessionManager = SessionManager.open(params.sessionFile) as Partial<SessionManagerLike>;
  if (
    typeof sessionManager.getHeader !== "function" ||
    typeof sessionManager.getLeafEntry !== "function" ||
    typeof sessionManager.buildSessionContext !== "function" ||
    typeof sessionManager.getEntries !== "function"
  ) {
    return { applied: false, messages: [] };
  }

  const header = sessionManager.getHeader();
  const leaf = sessionManager.getLeafEntry();
  if (!header || leaf?.type !== "compaction") {
    const sessionContext = sessionManager.buildSessionContext();
    return {
      applied: false,
      leafId:
        typeof sessionManager.getLeafId === "function"
          ? (sessionManager.getLeafId() ?? undefined)
          : undefined,
      messages: sessionContext.messages,
    };
  }

  const nextEntries = replaceLatestCompactionSummary({
    entries: sessionManager.getEntries(),
    compactionEntryId: leaf.id,
    projectedTaskStatusOverride:
      getDefaultTaskStatusOverrideFromContinuationState(params.continuationState) ??
      params.projectedTaskStatusOverride ??
      params.taskStatusOverride,
    taskStatusOverride: params.taskStatusOverride,
    continuation: params.continuationState?.continuation ?? params.continuation,
  });
  const currentEntries = sessionManager.getEntries();
  const changed = JSON.stringify(nextEntries) !== JSON.stringify(currentEntries);
  if (!changed) {
    const sessionContext = sessionManager.buildSessionContext();
    return {
      applied: false,
      firstKeptEntryId: leaf.firstKeptEntryId,
      leafId:
        typeof sessionManager.getLeafId === "function"
          ? (sessionManager.getLeafId() ?? undefined)
          : undefined,
      messages: sessionContext.messages,
    };
  }

  const content = serializeSessionFile(header, nextEntries);
  const tmpFile = `${params.sessionFile}.compaction-normalize-tmp`;
  await fs.writeFile(tmpFile, content, "utf-8");
  await fs.rename(tmpFile, params.sessionFile);

  const refreshed = SessionManager.open(params.sessionFile);
  const sessionContext = refreshed.buildSessionContext();
  const refreshedLeaf = refreshed.getLeafEntry();
  return {
    applied: true,
    firstKeptEntryId:
      refreshedLeaf?.type === "compaction" ? refreshedLeaf.firstKeptEntryId : undefined,
    leafId: refreshed.getLeafId() ?? undefined,
    messages: sessionContext.messages,
  };
}

export async function hardenManualCompactionBoundary(params: {
  sessionFile: string;
}): Promise<HardenedManualCompactionBoundary> {
  const sessionManager = SessionManager.open(params.sessionFile) as Partial<SessionManagerLike>;
  if (
    typeof sessionManager.getLeafEntry !== "function" ||
    typeof sessionManager.buildSessionContext !== "function"
  ) {
    return {
      applied: false,
      messages: [],
    };
  }

  const leaf = sessionManager.getLeafEntry();
  if (leaf?.type !== "compaction") {
    const sessionContext = sessionManager.buildSessionContext();
    return {
      applied: false,
      leafId:
        typeof sessionManager.getLeafId === "function"
          ? (sessionManager.getLeafId() ?? undefined)
          : undefined,
      messages: sessionContext.messages,
    };
  }

  if (leaf.firstKeptEntryId === leaf.id) {
    const sessionContext = sessionManager.buildSessionContext();
    return {
      applied: false,
      firstKeptEntryId: leaf.id,
      leafId:
        typeof sessionManager.getLeafId === "function"
          ? (sessionManager.getLeafId() ?? undefined)
          : undefined,
      messages: sessionContext.messages,
    };
  }

  const normalized = await normalizeLatestCompactionEntry({
    sessionFile: params.sessionFile,
  });
  if (!normalized.applied) {
    return {
      applied: false,
      firstKeptEntryId: leaf.firstKeptEntryId,
      leafId: normalized.leafId,
      messages: normalized.messages,
    };
  }

  const refreshed = SessionManager.open(params.sessionFile) as Partial<SessionManagerLike>;
  if (
    typeof refreshed.getHeader !== "function" ||
    typeof refreshed.getEntries !== "function" ||
    typeof refreshed.buildSessionContext !== "function"
  ) {
    return {
      applied: true,
      firstKeptEntryId: leaf.id,
      leafId: normalized.leafId,
      messages: normalized.messages,
    };
  }

  const content = serializeSessionFile(
    refreshed.getHeader()!,
    replaceLatestCompactionBoundary({
      entries: refreshed.getEntries(),
      compactionEntryId: leaf.id,
    }),
  );
  const tmpFile = `${params.sessionFile}.manual-compaction-tmp`;
  await fs.writeFile(tmpFile, content, "utf-8");
  await fs.rename(tmpFile, params.sessionFile);

  const hardened = SessionManager.open(params.sessionFile);
  const sessionContext = hardened.buildSessionContext();
  return {
    applied: true,
    firstKeptEntryId: leaf.id,
    leafId: hardened.getLeafId() ?? undefined,
    messages: sessionContext.messages,
  };
}
