import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ZhushouConfig } from "../config/types.zhushou.js";

export type ConfigSnapshot = {
  /** Unix timestamp (ms) when the snapshot was taken. */
  timestamp: number;
  /** Config state at snapshot time. */
  config: ZhushouConfig;
  /** Short human-readable label for the snapshot (e.g. "before-setup-wizard"). */
  label: string;
};

export type RollbackResult =
  | { ok: true }
  | { ok: false; reason: string };

function defaultSnapshotDir(): string {
  return path.join(os.homedir(), ".zhushou", ".snapshots");
}

function snapshotFilename(snapshot: ConfigSnapshot): string {
  return `config-snapshot-${snapshot.timestamp}-${snapshot.label.replace(/[^a-z0-9-]/gi, "_")}.json`;
}

/**
 * Persist a config snapshot to disk under the snapshot directory.
 * Returns the absolute path of the written snapshot file.
 */
export async function saveConfigSnapshot(
  snapshot: ConfigSnapshot,
  snapshotDir: string = defaultSnapshotDir(),
): Promise<string> {
  await fsPromises.mkdir(snapshotDir, { recursive: true });
  const filePath = path.join(snapshotDir, snapshotFilename(snapshot));
  await fsPromises.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

/**
 * Load all snapshots from the snapshot directory, sorted newest-first.
 */
export async function listConfigSnapshots(
  snapshotDir: string = defaultSnapshotDir(),
): Promise<ConfigSnapshot[]> {
  let entries: string[];
  try {
    entries = await fsPromises.readdir(snapshotDir);
  } catch {
    return [];
  }

  const snapshots: ConfigSnapshot[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("config-snapshot-") || !entry.endsWith(".json")) {
      continue;
    }
    try {
      const raw = await fsPromises.readFile(path.join(snapshotDir, entry), "utf8");
      const parsed = JSON.parse(raw) as ConfigSnapshot;
      if (
        typeof parsed.timestamp === "number" &&
        typeof parsed.config === "object" &&
        typeof parsed.label === "string"
      ) {
        snapshots.push(parsed);
      }
    } catch {
      // skip malformed snapshot files
    }
  }

  return snapshots.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Create a snapshot of the current config (call before any wizard writes).
 */
export function createSnapshot(config: ZhushouConfig, label: string): ConfigSnapshot {
  return {
    timestamp: Date.now(),
    config: structuredClone(config),
    label,
  };
}

/**
 * Apply a snapshot by writing it back as the current config via the provided writer.
 * The writer should be the project's `writeConfigFile` function.
 */
export async function rollbackToSnapshot(
  snapshot: ConfigSnapshot,
  writeConfig: (config: ZhushouConfig) => Promise<void>,
): Promise<RollbackResult> {
  try {
    await writeConfig(structuredClone(snapshot.config));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Delete snapshots older than `maxAgeMs` milliseconds.
 * Returns the number of snapshots removed.
 */
export async function pruneOldSnapshots(
  maxAgeMs: number,
  snapshotDir: string = defaultSnapshotDir(),
): Promise<number> {
  const snapshots = await listConfigSnapshots(snapshotDir);
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const snap of snapshots) {
    if (snap.timestamp < cutoff) {
      const filePath = path.join(snapshotDir, snapshotFilename(snap));
      try {
        await fsPromises.unlink(filePath);
        removed++;
      } catch {
        // ignore delete failures
      }
    }
  }
  return removed;
}
