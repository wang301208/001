import { afterEach, describe, expect, it, vi } from "vitest";
import { importFreshModule } from "../../test/helpers/import-fresh.js";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredZhushouTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredZhushouTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredZhushouTmpDir =
    params?.resolvePreferredZhushouTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredZhushouTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-zhushou-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-zhushou-dir.js")>(
      "../infra/tmp-zhushou-dir.js",
    );
    return {
      ...actual,
      resolvePreferredZhushouTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredZhushouTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-zhushou-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredZhushouTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredZhushouTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/zhushou");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/wang301208/zhushou.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredZhushouTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      file: "/tmp/wang301208/zhushou.log",
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(() => module.getLogger().info("browser-safe")).not.toThrow();
    expect(resolvePreferredZhushouTmpDir).not.toHaveBeenCalled();
  });
});
