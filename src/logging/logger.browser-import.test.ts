import { afterEach, describe, expect, it, vi } from "vitest";
import { importFreshModule } from "../../test/helpers/import-fresh.js";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredAssistantTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredAssistantTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredAssistantTmpDir =
    params?.resolvePreferredAssistantTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredAssistantTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-assistant-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-assistant-dir.js")>(
      "../infra/tmp-assistant-dir.js",
    );
    return {
      ...actual,
      resolvePreferredAssistantTmpDir,
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
  return { module, resolvePreferredAssistantTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-assistant-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredAssistantTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredAssistantTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/assistant");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/assistant/assistant.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredAssistantTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      file: "/tmp/assistant/assistant.log",
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(() => module.getLogger().info("browser-safe")).not.toThrow();
    expect(resolvePreferredAssistantTmpDir).not.toHaveBeenCalled();
  });
});
