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
    await withTempDir({ prefix: "assistant-test-" }, async (tmp) => {
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
  it("prefers ~/.assistant when legacy dir is missing", async () => {
    await withTempDir({ prefix: "assistant-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".assistant");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands ASSISTANT_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/assistant-home",
      ASSISTANT_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/assistant-home", "state"));
  });

  it("falls back to the config file directory when only ASSISTANT_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/assistant-home",
      ASSISTANT_CONFIG_PATH: "~/profiles/dev/assistant.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/assistant-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers ASSISTANT_HOME over HOME", () => {
    vi.stubEnv("ASSISTANT_HOME", "/srv/assistant-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveHomeDir()).toBe(path.resolve("/srv/assistant-home"));

    vi.unstubAllEnvs();
  });
});

describe("shortenHomePath", () => {
  it("uses $ASSISTANT_HOME prefix when ASSISTANT_HOME is set", () => {
    vi.stubEnv("ASSISTANT_HOME", "/srv/assistant-home");
    vi.stubEnv("HOME", "/home/other");

    expect(shortenHomePath(`${path.resolve("/srv/assistant-home")}/.assistant/assistant.json`)).toBe(
      "$ASSISTANT_HOME/.assistant/assistant.json",
    );

    vi.unstubAllEnvs();
  });
});

describe("shortenHomeInString", () => {
  it("uses $ASSISTANT_HOME replacement when ASSISTANT_HOME is set", () => {
    vi.stubEnv("ASSISTANT_HOME", "/srv/assistant-home");
    vi.stubEnv("HOME", "/home/other");

    expect(
      shortenHomeInString(`config: ${path.resolve("/srv/assistant-home")}/.assistant/assistant.json`),
    ).toBe("config: $ASSISTANT_HOME/.assistant/assistant.json");

    vi.unstubAllEnvs();
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/assistant", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "assistant"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers ASSISTANT_HOME for tilde expansion", () => {
    vi.stubEnv("ASSISTANT_HOME", "/srv/assistant-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveUserPath("~/assistant")).toBe(path.resolve("/srv/assistant-home", "assistant"));

    vi.unstubAllEnvs();
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/assistant-home",
      ASSISTANT_HOME: "/srv/assistant-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/assistant", env)).toBe(path.resolve("/srv/assistant-home", "assistant"));
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
