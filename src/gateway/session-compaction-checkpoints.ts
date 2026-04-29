import { randomUUID } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { updateSessionStore } from "../config/sessions.js";
import type {
  SessionCompactionCheckpoint,
  SessionCompactionCheckpointReason,
  SessionContinuationAuditPayload,
  SessionEntry,
  SessionTaskContinuation,
} from "../config/sessions.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { migrateAndPruneGatewaySessionStoreKey, resolveGatewaySessionStoreTarget } from "./session-utils.js";

const log = createSubsystemLogger("gateway/session-compaction-checkpoints");
const MAX_COMPACTION_CHECKPOINTS_PER_SESSION = 25;

export type CapturedCompactionCheckpointSnapshot = {
  sessionId: string;
  sessionFile: string;
  leafId: string;
};

function trimSessionCheckpoints(
  checkpoints: SessionCompactionCheckpoint[] | undefined,
): SessionCompactionCheckpoint[] | undefined {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    return undefined;
  }
  return checkpoints.slice(-MAX_COMPACTION_CHECKPOINTS_PER_SESSION);
}

function sessionStoreCheckpoints(
  entry: Pick<SessionEntry, "compactionCheckpoints"> | undefined,
): SessionCompactionCheckpoint[] {
  return Array.isArray(entry?.compactionCheckpoints) ? [...entry.compactionCheckpoints] : [];
}

export function resolveSessionCompactionCheckpointReason(params: {
  trigger?: "budget" | "overflow" | "manual";
  timedOut?: boolean;
}): SessionCompactionCheckpointReason {
  if (params.trigger === "manual") {
    return "manual";
  }
  if (params.timedOut) {
    return "timeout-retry";
  }
  if (params.trigger === "overflow") {
    return "overflow-retry";
  }
  return "auto-threshold";
}

export function captureCompactionCheckpointSnapshot(params: {
  sessionManager: Pick<SessionManager, "getLeafId"> &
    Partial<Pick<SessionManager, "getSessionId" | "getHeader" | "getEntries">>;
  sessionFile: string;
}): CapturedCompactionCheckpointSnapshot | null {
  const getLeafId =
    params.sessionManager && typeof params.sessionManager.getLeafId === "function"
      ? params.sessionManager.getLeafId.bind(params.sessionManager)
      : null;
  const getSessionId =
    params.sessionManager && typeof params.sessionManager.getSessionId === "function"
      ? params.sessionManager.getSessionId.bind(params.sessionManager)
      : null;
  const getHeader =
    params.sessionManager && typeof params.sessionManager.getHeader === "function"
      ? params.sessionManager.getHeader.bind(params.sessionManager)
      : null;
  const getEntries =
    params.sessionManager && typeof params.sessionManager.getEntries === "function"
      ? params.sessionManager.getEntries.bind(params.sessionManager)
      : null;
  const sessionFile = params.sessionFile.trim();
  if (!getLeafId || !sessionFile) {
    return null;
  }
  const leafId = getLeafId();
  if (!leafId) {
    return null;
  }
  const parsedSessionFile = path.parse(sessionFile);
  const snapshotFile = path.join(
    parsedSessionFile.dir,
    `${parsedSessionFile.name}.checkpoint.${randomUUID()}${parsedSessionFile.ext || ".jsonl"}`,
  );
  try {
    if (fsSync.existsSync(sessionFile)) {
      fsSync.copyFileSync(sessionFile, snapshotFile);
    } else {
      const header = getHeader?.();
      const entries = getEntries?.();
      if (!header || !Array.isArray(entries)) {
        return null;
      }
      const content = [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n");
      fsSync.writeFileSync(snapshotFile, `${content}\n`, "utf8");
    }
  } catch {
    return null;
  }
  const sessionId = getSessionId?.();
  if (sessionId) {
    return {
      sessionId,
      sessionFile: snapshotFile,
      leafId,
    };
  }
  let snapshotSession: SessionManager;
  try {
    snapshotSession = SessionManager.open(snapshotFile, path.dirname(snapshotFile));
  } catch {
    try {
      fsSync.unlinkSync(snapshotFile);
    } catch {
      // Best-effort cleanup if the copied transcript cannot be reopened.
    }
    return null;
  }
  const getSnapshotSessionId =
    snapshotSession && typeof snapshotSession.getSessionId === "function"
      ? snapshotSession.getSessionId.bind(snapshotSession)
      : null;
  if (!getSnapshotSessionId) {
    return null;
  }
  return {
    sessionId: getSnapshotSessionId(),
    sessionFile: snapshotFile,
    leafId,
  };
}

export async function cleanupCompactionCheckpointSnapshot(
  snapshot: CapturedCompactionCheckpointSnapshot | null | undefined,
): Promise<void> {
  if (!snapshot?.sessionFile) {
    return;
  }
  try {
    await fs.unlink(snapshot.sessionFile);
  } catch {
    // Best-effort cleanup; retained snapshots are harmless and easier to debug.
  }
}

export async function persistSessionCompactionCheckpoint(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  sessionId: string;
  reason: SessionCompactionCheckpointReason;
  snapshot: CapturedCompactionCheckpointSnapshot;
  summary?: string;
  firstKeptEntryId?: string;
  continuation?: SessionTaskContinuation;
  continuationAudit?: SessionContinuationAuditPayload;
  tokensBefore?: number;
  tokensAfter?: number;
  postSessionFile?: string;
  postLeafId?: string;
  postEntryId?: string;
  createdAt?: number;
}): Promise<SessionCompactionCheckpoint | null> {
  const target = resolveGatewaySessionStoreTarget({
    cfg: params.cfg,
    key: params.sessionKey,
  });
  const createdAt = params.createdAt ?? Date.now();
  const checkpoint: SessionCompactionCheckpoint = {
    checkpointId: randomUUID(),
    sessionKey: target.canonicalKey,
    sessionId: params.sessionId,
    createdAt,
    reason: params.reason,
    ...(typeof params.tokensBefore === "number" ? { tokensBefore: params.tokensBefore } : {}),
    ...(typeof params.tokensAfter === "number" ? { tokensAfter: params.tokensAfter } : {}),
    ...(params.summary?.trim() ? { summary: params.summary.trim() } : {}),
    ...(params.firstKeptEntryId?.trim()
      ? { firstKeptEntryId: params.firstKeptEntryId.trim() }
      : {}),
    ...(params.continuation && Object.keys(params.continuation).length > 0
      ? { continuation: params.continuation }
      : {}),
    ...(params.continuationAudit
      ? { continuationAudit: params.continuationAudit }
      : {}),
    preCompaction: {
      sessionId: params.snapshot.sessionId,
      sessionFile: params.snapshot.sessionFile,
      leafId: params.snapshot.leafId,
    },
    postCompaction: {
      sessionId: params.sessionId,
      ...(params.postSessionFile?.trim() ? { sessionFile: params.postSessionFile.trim() } : {}),
      ...(params.postLeafId?.trim() ? { leafId: params.postLeafId.trim() } : {}),
      ...(params.postEntryId?.trim() ? { entryId: params.postEntryId.trim() } : {}),
    },
  };

  let stored = false;
  await updateSessionStore(target.storePath, (store) => {
    const { primaryKey, entry: existing } = migrateAndPruneGatewaySessionStoreKey({
      cfg: params.cfg,
      key: params.sessionKey,
      store,
    });
    if (!existing?.sessionId) {
      return;
    }
    const checkpoints = sessionStoreCheckpoints(existing);
    checkpoints.push(checkpoint);
    store[primaryKey] = {
      ...existing,
      updatedAt: Math.max(existing.updatedAt ?? 0, createdAt),
      compactionCheckpoints: trimSessionCheckpoints(checkpoints),
    };
    stored = true;
  });

  if (!stored) {
    log.warn("skipping compaction checkpoint persist: session not found", {
      sessionKey: params.sessionKey,
    });
    return null;
  }
  return checkpoint;
}

export function listSessionCompactionCheckpoints(
  entry: Pick<SessionEntry, "compactionCheckpoints"> | undefined,
): SessionCompactionCheckpoint[] {
  return sessionStoreCheckpoints(entry).toSorted((a, b) => b.createdAt - a.createdAt);
}

export function getSessionCompactionCheckpoint(params: {
  entry: Pick<SessionEntry, "compactionCheckpoints"> | undefined;
  checkpointId: string;
}): SessionCompactionCheckpoint | undefined {
  const checkpointId = params.checkpointId.trim();
  if (!checkpointId) {
    return undefined;
  }
  return listSessionCompactionCheckpoints(params.entry).find(
    (checkpoint) => checkpoint.checkpointId === checkpointId,
  );
}
