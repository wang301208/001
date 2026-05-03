import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempDir } from "./test-helpers/temp-dir.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "zhushou-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.zhushou when legacy dir is missing", async () => {
    await withTempDir({ prefix: "zhushou-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".zhushou");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands ZHUSHOU_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/zhushou-home",
      ZHUSHOU_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/zhushou-home", "state"));
  });

  it("falls back to the config file directory when only ZHUSHOU_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/zhushou-home",
      ZHUSHOU_CONFIG_PATH: "~/profiles/dev/zhushou.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/zhushou-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers ZHUSHOU_HOME over HOME", () => {
    vi.stubEnv("ZHUSHOU_HOME", "/srv/zhushou-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveHomeDir()).toBe(path.resolve("/srv/zhushou-home"));

    vi.unstubAllEnvs();
  });
});

describe("shortenHomePath", () => {
  it("uses $ZHUSHOU_HOME prefix when ZHUSHOU_HOME is set", () => {
    vi.stubEnv("ZHUSHOU_HOME", "/srv/zhushou-home");
    vi.stubEnv("HOME", "/home/other");

    expect(shortenHomePath(`${path.resolve("/srv/zhushou-home")}/.zhushou/zhushou.json`)).toBe(
      "$ZHUSHOU_HOME/.zhushou/zhushou.json",
    );

    vi.unstubAllEnvs();
  });
});

describe("shortenHomeInString", () => {
  it("uses $ZHUSHOU_HOME replacement when ZHUSHOU_HOME is set", () => {
    vi.stubEnv("ZHUSHOU_HOME", "/srv/zhushou-home");
    vi.stubEnv("HOME", "/home/other");

    expect(
      shortenHomeInString(`config: ${path.resolve("/srv/zhushou-home")}/.zhushou/zhushou.json`),
    ).toBe("config: $ZHUSHOU_HOME/.zhushou/zhushou.json");

    vi.unstubAllEnvs();
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/zhushou", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "zhushou"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers ZHUSHOU_HOME for tilde expansion", () => {
    vi.stubEnv("ZHUSHOU_HOME", "/srv/zhushou-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveUserPath("~/zhushou")).toBe(path.resolve("/srv/zhushou-home", "zhushou"));

    vi.unstubAllEnvs();
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/zhushou-home",
      ZHUSHOU_HOME: "/srv/zhushou-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/zhushou", env)).toBe(path.resolve("/srv/zhushou-home", "zhushou"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
