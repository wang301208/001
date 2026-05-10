import { describe, expect, it } from "vitest";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import {
  rewriteUpdateFlagArgv,
  resolveMissingPluginCommandMessage,
  resolveExplicitTuiFastPathOptions,
  shouldEnsureCliPath,
  shouldRunTuiByDefault,
  shouldUseRootHelpFastPath,
} from "./run-main.js";

const memoryWikiCommandAliasRegistry: PluginManifestRegistry = {
  plugins: [
    {
      id: "memory-wiki",
      channels: [],
      providers: [],
      cliBackends: [],
      skills: [],
      hooks: [],
      origin: "bundled",
      rootDir: "/tmp/memory-wiki",
      source: "bundled",
      manifestPath: "/tmp/memory-wiki/assistant.plugin.json",
      commandAliases: [{ name: "wiki" }],
    },
  ],
  diagnostics: [],
};

describe("rewriteUpdateFlagArgv", () => {
  it("leaves argv unchanged when --update is absent", () => {
    const argv = ["node", "entry.js", "status"];
    expect(rewriteUpdateFlagArgv(argv)).toBe(argv);
  });

  it("rewrites --update into the update command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update"])).toEqual([
      "node",
      "entry.js",
      "update",
    ]);
  });

  it("preserves global flags that appear before --update", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--profile", "p", "--update"])).toEqual([
      "node",
      "entry.js",
      "--profile",
      "p",
      "update",
    ]);
  });

  it("keeps update options after the rewritten command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update", "--json"])).toEqual([
      "node",
      "entry.js",
      "update",
      "--json",
    ]);
  });
});

describe("shouldEnsureCliPath", () => {
  it("skips path bootstrap for help/version invocations", () => {
    expect(shouldEnsureCliPath(["node", "assistant", "--help"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "-V"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "-v"])).toBe(false);
  });

  it("skips path bootstrap for read-only fast paths", () => {
    expect(shouldEnsureCliPath(["node", "assistant", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "--log-level", "debug", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "sessions", "--json"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "config", "get", "update"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "assistant", "models", "status", "--json"])).toBe(false);
  });

  it("keeps path bootstrap for mutating or unknown commands", () => {
    expect(shouldEnsureCliPath(["node", "assistant", "message", "send"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "assistant", "voicecall", "status"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "assistant", "acp", "-v"])).toBe(true);
  });
});

describe("shouldUseRootHelpFastPath", () => {
  it("uses the fast path for root help only", () => {
    expect(shouldUseRootHelpFastPath(["node", "assistant", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "assistant", "--profile", "work", "-h"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "assistant", "status", "--help"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "assistant", "--help", "status"])).toBe(false);
  });
});

describe("shouldRunTuiByDefault", () => {
  it("uses the real terminal UI for bare root invocations", () => {
    expect(shouldRunTuiByDefault(["node", "assistant"])).toBe(true);
    expect(shouldRunTuiByDefault(["node", "assistant", "--profile", "work"])).toBe(true);
    expect(shouldRunTuiByDefault(["node", "assistant", "--dev"])).toBe(true);
    expect(shouldRunTuiByDefault(["node", "assistant", "--tui"])).toBe(true);
    expect(shouldRunTuiByDefault(["node", "assistant", "--profile", "work", "--tui"])).toBe(true);
  });

  it("preserves help, version, explicit commands, and legacy flags", () => {
    expect(shouldRunTuiByDefault(["node", "assistant", "--help"])).toBe(false);
    expect(shouldRunTuiByDefault(["node", "assistant", "--version"])).toBe(false);
    expect(shouldRunTuiByDefault(["node", "assistant", "status"])).toBe(false);
    expect(shouldRunTuiByDefault(["node", "assistant", "tui"])).toBe(false);
    expect(shouldRunTuiByDefault(["node", "assistant", "--update"])).toBe(false);
  });
});

describe("resolveExplicitTuiFastPathOptions", () => {
  it("parses explicit tui invocations without requiring full CLI registration", () => {
    expect(
      resolveExplicitTuiFastPathOptions([
        "node",
        "assistant",
        "tui",
        "--session",
        "work",
        "--message=你好",
        "--timeout-ms",
        "45000",
        "--history-limit",
        "50",
        "--deliver",
      ]),
    ).toEqual({
      session: "work",
      message: "你好",
      timeoutMs: 45_000,
      historyLimit: 50,
      deliver: true,
    });
  });

  it("keeps tui help and unknown options on the normal Commander path", () => {
    expect(resolveExplicitTuiFastPathOptions(["node", "assistant", "tui", "--help"])).toBeNull();
    expect(resolveExplicitTuiFastPathOptions(["node", "assistant", "tui", "--unknown"])).toBeNull();
  });
});

describe("resolveMissingPluginCommandMessage", () => {
  it("explains plugins.allow misses for a bundled plugin command", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["telegram"],
        },
      }),
    ).toContain('`plugins.allow` excludes "browser"');
  });

  it("explains explicit bundled plugin disablement", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          entries: {
            browser: {
              enabled: false,
            },
          },
        },
      }),
    ).toContain("plugins.entries.browser.enabled=false");
  });

  it("returns null when the bundled plugin command is already allowed", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["browser"],
        },
      }),
    ).toBeNull();
  });

  it("explains that dreaming is a runtime slash command, not a CLI command", () => {
    const message = resolveMissingPluginCommandMessage("dreaming", {});
    expect(message).toContain("runtime slash command");
    expect(message).toContain("/dreaming");
    expect(message).toContain("memory-core");
    expect(message).toContain("assistant memory");
  });

  it("returns the runtime command message even when plugins.allow is set", () => {
    const message = resolveMissingPluginCommandMessage("dreaming", {
      plugins: {
        allow: ["memory-core"],
      },
    });
    expect(message).toContain("runtime slash command");
    expect(message).not.toContain("plugins.allow");
  });

  it("points command names in plugins.allow at their parent plugin", () => {
    const message = resolveMissingPluginCommandMessage("dreaming", {
      plugins: {
        allow: ["dreaming"],
      },
    });
    expect(message).toContain('"dreaming" is not a plugin');
    expect(message).toContain('"memory-core"');
    expect(message).toContain("plugins.allow");
  });

  it("explains parent plugin disablement for runtime command aliases", () => {
    const message = resolveMissingPluginCommandMessage("dreaming", {
      plugins: {
        entries: {
          "memory-core": {
            enabled: false,
          },
        },
      },
    });
    expect(message).toContain("plugins.entries.memory-core.enabled=false");
    expect(message).not.toContain("runtime slash command");
  });

  it("allows CLI commands when their parent plugin is in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["memory-wiki"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).toBeNull();
  });

  it("blocks CLI commands when parent plugin is NOT in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["telegram"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).not.toBeNull();
    expect(message).toContain('"memory-wiki"');
    expect(message).toContain("plugins.allow");
  });
});
