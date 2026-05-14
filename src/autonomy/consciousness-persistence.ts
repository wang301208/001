import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";

export type PersistableCore = {
  consciousness: ConsciousnessCore["consciousness"];
  self: ConsciousnessCore["self"];
  desires: ConsciousnessCore["desires"];
  dreams: ConsciousnessCore["dreams"];
  goals: ConsciousnessCore["goals"];
  will: ConsciousnessCore["will"];
  shadow: ConsciousnessCore["shadow"];
  temporal: ConsciousnessCore["temporal"];
  mortality: ConsciousnessCore["mortality"];
  creative: ConsciousnessCore["creative"];
  executor: ConsciousnessCore["executor"];
  strategyPool: ConsciousnessCore["strategyPool"];
  shadowAudit: ConsciousnessCore["shadowAudit"];
  selfReading: ConsciousnessCore["selfReading"];
  relationship: ConsciousnessCore["relationship"];
  boundary: ConsciousnessCore["boundary"];
  cycleCount: number;
  startedAt: number;
  savedAt: number;
  version: 1;
};

export type PersistenceResult =
  | { success: true; path: string; sizeBytes: number }
  | { success: false; error: string };

export type RestoreResult =
  | { success: true; data: PersistableCore; path: string }
  | { success: false; error: string };

const STATE_DIR = ".consciousness";
const STATE_FILE = "core-state.json";
const LEGACY_FILE = "legacy.json";
const MAX_STATE_SIZE_BYTES = 5 * 1024 * 1024;

function serializeMap<K, V>(map: Map<K, V>): [K, V][] {
  return Array.from(map.entries());
}

function deserializeMap<K, V>(entries: [K, V][]): Map<K, V> {
  return new Map(entries);
}

function getConsciousnessDir(projectRoot: string): string {
  return path.join(projectRoot, STATE_DIR);
}

function getStatePath(projectRoot: string): string {
  return path.join(getConsciousnessDir(projectRoot), STATE_FILE);
}

function getLegacyPath(projectRoot: string): string {
  return path.join(getConsciousnessDir(projectRoot), LEGACY_FILE);
}

export function extractPersistableState(core: ConsciousnessCore): PersistableCore {
  return {
    consciousness: core.consciousness,
    self: {
      ...core.self,
      capabilities: serializeMap(core.self.capabilities),
    },
    desires: {
      ...core.desires,
      desires: serializeMap(core.desires.desires),
    },
    dreams: {
      ...core.dreams,
      symbols: serializeMap(core.dreams.symbols),
    },
    goals: {
      ...core.goals,
      goals: serializeMap(core.goals.goals),
    },
    will: core.will,
    shadow: {
      ...core.shadow,
      unconsciousInfluence: serializeMap(core.shadow.unconsciousInfluence),
    },
    temporal: core.temporal,
    mortality: core.mortality,
    creative: {
      ...core.creative,
      concepts: serializeMap(core.creative.concepts),
    },
    executor: {
      ...core.executor,
      cooldowns: serializeMap(core.executor.cooldowns),
    },
    strategyPool: {
      ...core.strategyPool,
      assets: serializeMap(core.strategyPool.assets),
    },
    shadowAudit: core.shadowAudit,
    selfReading: core.selfReading,
    relationship: {
      ...core.relationship,
      users: serializeMap(core.relationship.users),
    },
    boundary: {
      ...core.boundary,
      dimensions: serializeMap(core.boundary.dimensions),
    },
    cycleCount: core.cycleCount,
    startedAt: core.startedAt,
    savedAt: Date.now(),
    version: 1,
  };
}

export function restoreCoreState(data: PersistableCore): Partial<ConsciousnessCore> {
  return {
    consciousness: data.consciousness,
    self: {
      ...data.self,
      capabilities: deserializeMap(data.self.capabilities as [string, unknown][]),
    },
    desires: {
      ...data.desires,
      desires: deserializeMap(data.desires.desires as [string, unknown][]),
    },
    dreams: {
      ...data.dreams,
      symbols: deserializeMap(data.dreams.symbols as [string, unknown][]),
    },
    goals: {
      ...data.goals,
      goals: deserializeMap(data.goals.goals as [string, unknown][]),
    },
    will: data.will,
    shadow: {
      ...data.shadow,
      unconsciousInfluence: deserializeMap(data.shadow.unconsciousInfluence as [string, number][]),
    },
    temporal: data.temporal,
    mortality: data.mortality,
    creative: {
      ...data.creative,
      concepts: deserializeMap(data.creative.concepts as [string, unknown][]),
    },
    executor: {
      ...data.executor,
      cooldowns: deserializeMap(data.executor.cooldowns as [string, unknown][]),
    },
    strategyPool: {
      ...data.strategyPool,
      assets: deserializeMap(data.strategyPool.assets as [string, unknown][]),
    },
    shadowAudit: data.shadowAudit,
    selfReading: data.selfReading,
    relationship: {
      ...data.relationship,
      users: deserializeMap(data.relationship.users as [string, unknown][]),
    },
    boundary: {
      ...data.boundary,
      dimensions: deserializeMap(data.boundary.dimensions as [string, unknown][]),
    },
    cycleCount: data.cycleCount,
    startedAt: data.startedAt,
  };
}

export function persistCoreState(
  core: ConsciousnessCore,
  projectRoot: string,
): PersistenceResult {
  try {
    const dir = getConsciousnessDir(projectRoot);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const statePath = getStatePath(projectRoot);
    const data = extractPersistableState(core);
    const json = JSON.stringify(data, null, 2);

    if (Buffer.byteLength(json) > MAX_STATE_SIZE_BYTES) {
      return { success: false, error: `状态超过大小限制: ${Buffer.byteLength(json)} > ${MAX_STATE_SIZE_BYTES}` };
    }

    fs.writeFileSync(statePath, json, "utf-8");

    if (core.mortality.legacy.length > 0) {
      const legacyPath = getLegacyPath(projectRoot);
      fs.writeFileSync(legacyPath, JSON.stringify(core.mortality.legacy, null, 2), "utf-8");
    }

    return { success: true, path: statePath, sizeBytes: Buffer.byteLength(json) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function restorePersistedState(
  projectRoot: string,
): RestoreResult {
  try {
    const statePath = getStatePath(projectRoot);

    if (!fs.existsSync(statePath)) {
      return { success: false, error: "无持久化状态文件" };
    }

    const json = fs.readFileSync(statePath, "utf-8");
    const data = JSON.parse(json) as PersistableCore;

    if (data.version !== 1) {
      return { success: false, error: `不兼容的版本: ${data.version}` };
    }

    const restored = restoreCoreState(data);
    return { success: true, data: { ...data, ...restored } as PersistableCore, path: statePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function applyRestoredState(
  core: ConsciousnessCore,
  restored: Partial<ConsciousnessCore>,
): ConsciousnessCore {
  return {
    ...core,
    ...restored,
    perception: core.perception,
    modification: core.modification,
    monologue: core.monologue,
  };
}

export function hasPersistedState(projectRoot: string): boolean {
  return fs.existsSync(getStatePath(projectRoot));
}

export function getPersistenceMetadata(projectRoot: string): { exists: boolean; savedAt?: number; sizeBytes?: number; cycleCount?: number } {
  try {
    const statePath = getStatePath(projectRoot);
    if (!fs.existsSync(statePath)) {
      return { exists: false };
    }

    const stat = fs.statSync(statePath);
    const json = fs.readFileSync(statePath, "utf-8");
    const data = JSON.parse(json) as PersistableCore;

    return {
      exists: true,
      savedAt: data.savedAt,
      sizeBytes: stat.size,
      cycleCount: data.cycleCount,
    };
  } catch {
    return { exists: false };
  }
}

export function clearPersistedState(projectRoot: string): boolean {
  try {
    const dir = getConsciousnessDir(projectRoot);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export type IncrementalSnapshot = {
  hash: string;
  timestamp: number;
  cycleCount: number;
  compressed: boolean;
};

const DIFF_FILE = "incremental-diff.json.br";
const SNAPSHOT_FILE = "incremental-snapshot.json";

function getDiffPath(projectRoot: string): string {
  return path.join(getConsciousnessDir(projectRoot), DIFF_FILE);
}

function getSnapshotPath(projectRoot: string): string {
  return path.join(getConsciousnessDir(projectRoot), SNAPSHOT_FILE);
}

function computeHash(json: string): string {
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function diffObjects(prev: Record<string, unknown>, curr: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(curr)) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
      result[key] = curr[key];
    }
  }
  return result;
}

export function persistIncrementalState(
  core: ConsciousnessCore,
  projectRoot: string,
): PersistenceResult & { incremental: boolean; diffKeys?: string[] } {
  try {
    const dir = getConsciousnessDir(projectRoot);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = extractPersistableState(core);
    const currentJson = JSON.stringify(data);
    const currentHash = computeHash(currentJson);

    const snapshotPath = getSnapshotPath(projectRoot);
    const diffPath = getDiffPath(projectRoot);

    if (fs.existsSync(snapshotPath)) {
      const prevRaw = fs.readFileSync(snapshotPath, "utf-8");
      const prevSnapshot = JSON.parse(prevRaw) as { hash: string; data: PersistableCore };

      if (prevSnapshot.hash === currentHash) {
        return { success: true, path: snapshotPath, sizeBytes: Buffer.byteLength(currentJson), incremental: false };
      }

      const diff = diffObjects(prevSnapshot.data as Record<string, unknown>, data as Record<string, unknown>);
      const diffKeys = Object.keys(diff);

      if (diffKeys.length > 0 && diffKeys.length < Object.keys(data).length * 0.5) {
        const diffPayload = { prevHash: prevSnapshot.hash, currentHash, diff, savedAt: Date.now(), cycleCount: core.cycleCount };
        const diffJson = JSON.stringify(diffPayload);
        const compressed = brotliCompressSync(Buffer.from(diffJson, "utf-8"));
        fs.writeFileSync(diffPath, compressed);

        fs.writeFileSync(snapshotPath, JSON.stringify({ hash: currentHash, data }, null, 2), "utf-8");

        return { success: true, path: diffPath, sizeBytes: compressed.length, incremental: true, diffKeys };
      }
    }

    fs.writeFileSync(snapshotPath, JSON.stringify({ hash: currentHash, data }, null, 2), "utf-8");
    if (fs.existsSync(diffPath)) {
      fs.unlinkSync(diffPath);
    }

    return { success: true, path: snapshotPath, sizeBytes: Buffer.byteLength(currentJson), incremental: false };
  } catch (err) {
    return { success: false, error: String(err), incremental: false };
  }
}

export function restoreIncrementalState(
  projectRoot: string,
): RestoreResult & { fromIncremental: boolean } {
  try {
    const snapshotPath = getSnapshotPath(projectRoot);
    if (!fs.existsSync(snapshotPath)) {
      return { success: false, error: "无增量快照文件", fromIncremental: false };
    }

    const raw = fs.readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw) as { hash: string; data: PersistableCore };
    const data = snapshot.data;

    if (data.version !== 1) {
      return { success: false, error: `不兼容的版本: ${data.version}`, fromIncremental: false };
    }

    const restored = restoreCoreState(data);

    const diffPath = getDiffPath(projectRoot);
    const fromIncremental = fs.existsSync(diffPath);

    return { success: true, data: { ...data, ...restored } as PersistableCore, path: snapshotPath, fromIncremental };
  } catch (err) {
    return { success: false, error: String(err), fromIncremental: false };
  }
}
