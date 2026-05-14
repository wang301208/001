import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import {
  createSnapshot,
  listConfigSnapshots,
  pruneOldSnapshots,
  rollbackToSnapshot,
  saveConfigSnapshot,
} from "./rollback.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function sampleConfig(overrides: Partial<ZhushouConfig> = {}): ZhushouConfig {
  return {
    gateway: { bind: "loopback", auth: { mode: "token" } },
    ...overrides,
  } as ZhushouConfig;
}

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rollback-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ─── createSnapshot ───────────────────────────────────────────────────────────

describe("createSnapshot", () => {
  it("creates a snapshot with a timestamp, label, and config copy", () => {
    const cfg = sampleConfig();
    const before = Date.now();
    const snap = createSnapshot(cfg, "before-wizard");
    const after = Date.now();

    expect(snap.label).toBe("before-wizard");
    expect(snap.timestamp).toBeGreaterThanOrEqual(before);
    expect(snap.timestamp).toBeLessThanOrEqual(after);
    expect(snap.config).toEqual(cfg);
  });

  it("deep-clones the config — mutations to original do not affect snapshot", () => {
    const cfg = sampleConfig();
    const snap = createSnapshot(cfg, "test");
    (cfg as unknown as Record<string, unknown>).gateway = { bind: "lan" };
    expect(snap.config.gateway?.bind).toBe("loopback");
  });

  it("deep-clones the config — mutations to snapshot do not affect original", () => {
    const cfg = sampleConfig();
    const snap = createSnapshot(cfg, "test");
    (snap.config as unknown as Record<string, unknown>).gateway = { bind: "lan" };
    expect(cfg.gateway?.bind).toBe("loopback");
  });
});

// ─── saveConfigSnapshot / listConfigSnapshots ─────────────────────────────────

describe("saveConfigSnapshot + listConfigSnapshots", () => {
  it("saves a snapshot and retrieves it", async () => {
    const cfg = sampleConfig();
    const snap = createSnapshot(cfg, "save-test");
    await saveConfigSnapshot(snap, tmpDir);

    const loaded = await listConfigSnapshots(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].label).toBe("save-test");
    expect(loaded[0].config).toEqual(cfg);
  });

  it("lists multiple snapshots sorted newest-first", async () => {
    const snap1 = { ...createSnapshot(sampleConfig(), "first"), timestamp: 1000 };
    const snap2 = { ...createSnapshot(sampleConfig(), "second"), timestamp: 2000 };
    const snap3 = { ...createSnapshot(sampleConfig(), "third"), timestamp: 3000 };

    await saveConfigSnapshot(snap1, tmpDir);
    await saveConfigSnapshot(snap2, tmpDir);
    await saveConfigSnapshot(snap3, tmpDir);

    const loaded = await listConfigSnapshots(tmpDir);
    expect(loaded).toHaveLength(3);
    expect(loaded[0].label).toBe("third");
    expect(loaded[1].label).toBe("second");
    expect(loaded[2].label).toBe("first");
  });

  it("returns an empty array when the directory does not exist", async () => {
    const nonExistent = path.join(tmpDir, "no-such-dir");
    const loaded = await listConfigSnapshots(nonExistent);
    expect(loaded).toEqual([]);
  });

  it("skips malformed JSON files in the snapshot directory", async () => {
    await fs.writeFile(path.join(tmpDir, "config-snapshot-999-bad.json"), "{ not valid json ]");
    const loaded = await listConfigSnapshots(tmpDir);
    expect(loaded).toHaveLength(0);
  });

  it("skips files that do not match the snapshot naming convention", async () => {
    await fs.writeFile(path.join(tmpDir, "other-file.json"), JSON.stringify({ data: true }));
    const loaded = await listConfigSnapshots(tmpDir);
    expect(loaded).toHaveLength(0);
  });

  it("creates the snapshot directory if it does not exist", async () => {
    const nested = path.join(tmpDir, "nested", "snapshots");
    const snap = createSnapshot(sampleConfig(), "mkdir-test");
    await saveConfigSnapshot(snap, nested);

    const loaded = await listConfigSnapshots(nested);
    expect(loaded).toHaveLength(1);
  });
});

// ─── rollbackToSnapshot ───────────────────────────────────────────────────────

describe("rollbackToSnapshot", () => {
  it("calls writeConfig with the snapshot config and returns ok:true", async () => {
    const cfg = sampleConfig({ agents: { defaults: { workspace: "/old/path" } } });
    const snap = createSnapshot(cfg, "rollback-target");
    const writer = vi.fn(async () => {});

    const result = await rollbackToSnapshot(snap, writer);
    expect(result.ok).toBe(true);
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ gateway: cfg.gateway }));
  });

  it("returns ok:false with a reason when writeConfig throws", async () => {
    const snap = createSnapshot(sampleConfig(), "will-fail");
    const writer = vi.fn(async () => {
      throw new Error("disk full");
    });

    const result = await rollbackToSnapshot(snap, writer);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("disk full");
    }
  });

  it("does not mutate the snapshot config during rollback", async () => {
    const cfg = sampleConfig();
    const snap = createSnapshot(cfg, "immutable-test");
    const originalBind = snap.config.gateway?.bind;

    const writer = vi.fn(async (written: ZhushouConfig) => {
      (written as unknown as Record<string, unknown>).gateway = { bind: "mutated" };
    });

    await rollbackToSnapshot(snap, writer);
    expect(snap.config.gateway?.bind).toBe(originalBind);
  });
});

// ─── pruneOldSnapshots ────────────────────────────────────────────────────────

describe("pruneOldSnapshots", () => {
  it("removes snapshots older than maxAgeMs", async () => {
    const old = { ...createSnapshot(sampleConfig(), "old"), timestamp: Date.now() - 10_000 };
    const fresh = createSnapshot(sampleConfig(), "fresh");

    await saveConfigSnapshot(old, tmpDir);
    await saveConfigSnapshot(fresh, tmpDir);

    const removed = await pruneOldSnapshots(5_000, tmpDir);
    expect(removed).toBe(1);

    const remaining = await listConfigSnapshots(tmpDir);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].label).toBe("fresh");
  });

  it("returns 0 and leaves all snapshots when none are older than maxAgeMs", async () => {
    const snap = createSnapshot(sampleConfig(), "keep-me");
    await saveConfigSnapshot(snap, tmpDir);

    const removed = await pruneOldSnapshots(1_000_000, tmpDir);
    expect(removed).toBe(0);

    const remaining = await listConfigSnapshots(tmpDir);
    expect(remaining).toHaveLength(1);
  });

  it("returns 0 when snapshot directory is empty", async () => {
    const removed = await pruneOldSnapshots(1_000, tmpDir);
    expect(removed).toBe(0);
  });

  it("returns 0 when snapshot directory does not exist", async () => {
    const missing = path.join(tmpDir, "no-dir");
    const removed = await pruneOldSnapshots(1_000, missing);
    expect(removed).toBe(0);
  });
});
