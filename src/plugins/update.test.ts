import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundledPluginRootAt } from "../../test/helpers/bundled-plugin-paths.js";
import type { ZhushouConfig } from "../config/config.js";

const APP_ROOT = "/app";

function appBundledPluginRoot(pluginId: string): string {
  return bundledPluginRootAt(APP_ROOT, pluginId);
}

const installPluginFromNpmSpecMock = vi.fn();
const installPluginFromMarketplaceMock = vi.fn();
const installPluginFromClawHubMock = vi.fn();
const resolveBundledPluginSourcesMock = vi.fn();

vi.mock("./install.js", () => ({
  installPluginFromNpmSpec: (...args: unknown[]) => installPluginFromNpmSpecMock(...args),
  resolvePluginInstallDir: (pluginId: string) => `/tmp/${pluginId}`,
  PLUGIN_INSTALL_ERROR_CODE: {
    NPM_PACKAGE_NOT_FOUND: "npm_package_not_found",
  },
}));

vi.mock("./marketplace.js", () => ({
  installPluginFromMarketplace: (...args: unknown[]) => installPluginFromMarketplaceMock(...args),
}));

vi.mock("./clawhub.js", () => ({
  installPluginFromClawHub: (...args: unknown[]) => installPluginFromClawHubMock(...args),
}));

vi.mock("./bundled-sources.js", () => ({
  resolveBundledPluginSources: (...args: unknown[]) => resolveBundledPluginSourcesMock(...args),
}));

const { syncPluginsForUpdateChannel, updateNpmInstalledPlugins } = await import("./update.js");

function createSuccessfulNpmUpdateResult(params?: {
  pluginId?: string;
  targetDir?: string;
  version?: string;
  npmResolution?: {
    name: string;
    version: string;
    resolvedSpec: string;
  };
}) {
  return {
    ok: true,
    pluginId: params?.pluginId ?? "opik-zhushou",
    targetDir: params?.targetDir ?? "/tmp/opik-zhushou",
    version: params?.version ?? "0.2.6",
    extensions: ["index.ts"],
    ...(params?.npmResolution ? { npmResolution: params.npmResolution } : {}),
  };
}

function createNpmInstallConfig(params: {
  pluginId: string;
  spec: string;
  installPath: string;
  integrity?: string;
  resolvedName?: string;
  resolvedSpec?: string;
}) {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "npm" as const,
          spec: params.spec,
          installPath: params.installPath,
          ...(params.integrity ? { integrity: params.integrity } : {}),
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
        },
      },
    },
  };
}

function createMarketplaceInstallConfig(params: {
  pluginId: string;
  installPath: string;
  marketplaceSource: string;
  marketplacePlugin: string;
  marketplaceName?: string;
}): ZhushouConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "marketplace" as const,
          installPath: params.installPath,
          marketplaceSource: params.marketplaceSource,
          marketplacePlugin: params.marketplacePlugin,
          ...(params.marketplaceName ? { marketplaceName: params.marketplaceName } : {}),
        },
      },
    },
  };
}

function createClawHubInstallConfig(params: {
  pluginId: string;
  installPath: string;
  clawhubUrl: string;
  clawhubPackage: string;
  clawhubFamily: "bundle-plugin" | "code-plugin";
  clawhubChannel: "community" | "official" | "private";
}): ZhushouConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "clawhub" as const,
          spec: `clawhub:${params.clawhubPackage}`,
          installPath: params.installPath,
          clawhubUrl: params.clawhubUrl,
          clawhubPackage: params.clawhubPackage,
          clawhubFamily: params.clawhubFamily,
          clawhubChannel: params.clawhubChannel,
        },
      },
    },
  };
}

function createBundledPathInstallConfig(params: {
  loadPaths: string[];
  installPath: string;
  sourcePath?: string;
  spec?: string;
}): ZhushouConfig {
  return {
    plugins: {
      load: { paths: params.loadPaths },
      installs: {
        feishu: {
          source: "path",
          sourcePath: params.sourcePath ?? appBundledPluginRoot("feishu"),
          installPath: params.installPath,
          ...(params.spec ? { spec: params.spec } : {}),
        },
      },
    },
  };
}

function createCodexAppServerInstallConfig(params: {
  spec: string;
  resolvedName?: string;
  resolvedSpec?: string;
}) {
  return {
    plugins: {
      installs: {
        "zhushou-codex-app-server": {
          source: "npm" as const,
          spec: params.spec,
          installPath: "/tmp/zhushou-codex-app-server",
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
        },
      },
    },
  };
}

function expectNpmUpdateCall(params: {
  spec: string;
  expectedIntegrity?: string;
  expectedPluginId?: string;
}) {
  expect(installPluginFromNpmSpecMock).toHaveBeenCalledWith(
    expect.objectContaining({
      spec: params.spec,
      expectedIntegrity: params.expectedIntegrity,
      ...(params.expectedPluginId ? { expectedPluginId: params.expectedPluginId } : {}),
    }),
  );
}

function createBundledSource(params?: { pluginId?: string; localPath?: string; npmSpec?: string }) {
  const pluginId = params?.pluginId ?? "feishu";
  return {
    pluginId,
    localPath: params?.localPath ?? appBundledPluginRoot(pluginId),
    npmSpec: params?.npmSpec ?? `@zhushou/${pluginId}`,
  };
}

function mockBundledSources(...sources: ReturnType<typeof createBundledSource>[]) {
  resolveBundledPluginSourcesMock.mockReturnValue(
    new Map(sources.map((source) => [source.pluginId, source])),
  );
}

function expectBundledPathInstall(params: {
  install: Record<string, unknown> | undefined;
  sourcePath: string;
  installPath: string;
  spec?: string;
}) {
  expect(params.install).toMatchObject({
    source: "path",
    sourcePath: params.sourcePath,
    installPath: params.installPath,
    ...(params.spec ? { spec: params.spec } : {}),
  });
}

function expectCodexAppServerInstallState(params: {
  result: Awaited<ReturnType<typeof updateNpmInstalledPlugins>>;
  spec: string;
  version: string;
  resolvedSpec?: string;
}) {
  expect(params.result.config.plugins?.installs?.["zhushou-codex-app-server"]).toMatchObject({
    source: "npm",
    spec: params.spec,
    installPath: "/tmp/zhushou-codex-app-server",
    version: params.version,
    ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
  });
}

describe("updateNpmInstalledPlugins", () => {
  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromMarketplaceMock.mockReset();
    installPluginFromClawHubMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
  });

  it.each([
    {
      name: "skips integrity drift checks for unpinned npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-zhushou",
        spec: "@opik/opik-zhushou",
        integrity: "sha512-old",
        installPath: "/tmp/opik-zhushou",
      }),
      pluginIds: ["opik-zhushou"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-zhushou",
        expectedIntegrity: undefined,
      },
    },
    {
      name: "keeps integrity drift checks for exact-version npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-zhushou",
        spec: "@opik/opik-zhushou@0.2.5",
        integrity: "sha512-old",
        installPath: "/tmp/opik-zhushou",
      }),
      pluginIds: ["opik-zhushou"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-zhushou@0.2.5",
        expectedIntegrity: "sha512-old",
      },
    },
    {
      name: "skips recorded integrity checks when an explicit npm version override changes the spec",
      config: createNpmInstallConfig({
        pluginId: "zhushou-codex-app-server",
        spec: "zhushou-codex-app-server@0.2.0-beta.3",
        integrity: "sha512-old",
        installPath: "/tmp/zhushou-codex-app-server",
      }),
      pluginIds: ["zhushou-codex-app-server"],
      specOverrides: {
        "zhushou-codex-app-server": "zhushou-codex-app-server@0.2.0-beta.4",
      },
      installerResult: createSuccessfulNpmUpdateResult({
        pluginId: "zhushou-codex-app-server",
        targetDir: "/tmp/zhushou-codex-app-server",
        version: "0.2.0-beta.4",
      }),
      expectedCall: {
        spec: "zhushou-codex-app-server@0.2.0-beta.4",
        expectedIntegrity: undefined,
      },
    },
  ] as const)(
    "$name",
    async ({ config, pluginIds, dryRun, specOverrides, installerResult, expectedCall }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(
        installerResult ?? createSuccessfulNpmUpdateResult(),
      );

      await updateNpmInstalledPlugins({
        config,
        pluginIds: [...pluginIds],
        ...(dryRun ? { dryRun: true } : {}),
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall(expectedCall);
    },
  );

  it.each([
    {
      name: "formats package-not-found updates with a stable message",
      installerResult: {
        ok: false,
        code: "npm_package_not_found",
        error: "Package not found on npm: @zhushou/missing.",
      },
      config: createNpmInstallConfig({
        pluginId: "missing",
        spec: "@zhushou/missing",
        installPath: "/tmp/missing",
      }),
      pluginId: "missing",
      expectedMessage: "Failed to check missing: npm package not found for @zhushou/missing.",
    },
    {
      name: "falls back to raw installer error for unknown error codes",
      installerResult: {
        ok: false,
        code: "invalid_npm_spec",
        error: "unsupported npm spec: github:evil/evil",
      },
      config: createNpmInstallConfig({
        pluginId: "bad",
        spec: "github:evil/evil",
        installPath: "/tmp/bad",
      }),
      pluginId: "bad",
      expectedMessage: "Failed to check bad: unsupported npm spec: github:evil/evil",
    },
  ] as const)("$name", async ({ installerResult, config, pluginId, expectedMessage }) => {
    installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: [pluginId],
      dryRun: true,
    });

    expect(result.outcomes).toEqual([
      {
        pluginId,
        status: "error",
        message: expectedMessage,
      },
    ]);
  });

  it.each([
    {
      name: "reuses a recorded npm dist-tag spec for id-based updates",
      installerResult: {
        ok: true,
        pluginId: "zhushou-codex-app-server",
        targetDir: "/tmp/zhushou-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
      },
      config: createCodexAppServerInstallConfig({
        spec: "zhushou-codex-app-server@beta",
        resolvedName: "zhushou-codex-app-server",
        resolvedSpec: "zhushou-codex-app-server@0.2.0-beta.3",
      }),
      expectedSpec: "zhushou-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
    },
    {
      name: "uses and persists an explicit npm spec override during updates",
      installerResult: {
        ok: true,
        pluginId: "zhushou-codex-app-server",
        targetDir: "/tmp/zhushou-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
        npmResolution: {
          name: "zhushou-codex-app-server",
          version: "0.2.0-beta.4",
          resolvedSpec: "zhushou-codex-app-server@0.2.0-beta.4",
        },
      },
      config: createCodexAppServerInstallConfig({
        spec: "zhushou-codex-app-server",
      }),
      specOverrides: {
        "zhushou-codex-app-server": "zhushou-codex-app-server@beta",
      },
      expectedSpec: "zhushou-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
      expectedResolvedSpec: "zhushou-codex-app-server@0.2.0-beta.4",
    },
  ] as const)(
    "$name",
    async ({
      installerResult,
      config,
      specOverrides,
      expectedSpec,
      expectedVersion,
      expectedResolvedSpec,
    }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

      const result = await updateNpmInstalledPlugins({
        config,
        pluginIds: ["zhushou-codex-app-server"],
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall({
        spec: expectedSpec,
        expectedPluginId: "zhushou-codex-app-server",
      });
      expectCodexAppServerInstallState({
        result,
        spec: expectedSpec,
        version: expectedVersion,
        ...(expectedResolvedSpec ? { resolvedSpec: expectedResolvedSpec } : {}),
      });
    },
  );

  it("updates ClawHub-installed plugins via recorded package metadata", async () => {
    installPluginFromClawHubMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      version: "1.2.4",
      clawhub: {
        source: "clawhub",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "demo",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
        integrity: "sha256-next",
        resolvedAt: "2026-03-22T00:00:00.000Z",
      },
    });

    const result = await updateNpmInstalledPlugins({
      config: createClawHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "demo",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
      }),
      pluginIds: ["demo"],
    });

    expect(installPluginFromClawHubMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "clawhub:demo",
        baseUrl: "https://clawhub.ai",
        expectedPluginId: "demo",
        mode: "update",
      }),
    );
    expect(result.config.plugins?.installs?.demo).toMatchObject({
      source: "clawhub",
      spec: "clawhub:demo",
      installPath: "/tmp/demo",
      version: "1.2.4",
      clawhubPackage: "demo",
      clawhubFamily: "code-plugin",
      clawhubChannel: "official",
      integrity: "sha256-next",
    });
  });

  it("migrates legacy unscoped install keys when a scoped npm package updates", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "@zhushou/voice-call",
      targetDir: "/tmp/zhushou-voice-call",
      version: "0.0.2",
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          allow: ["voice-call"],
          deny: ["voice-call"],
          slots: { memory: "voice-call" },
          entries: {
            "voice-call": {
              enabled: false,
              hooks: { allowPromptInjection: false },
            },
          },
          installs: {
            "voice-call": {
              source: "npm",
              spec: "@zhushou/voice-call",
              installPath: "/tmp/voice-call",
            },
          },
        },
      },
      pluginIds: ["voice-call"],
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@zhushou/voice-call",
        expectedPluginId: "voice-call",
      }),
    );
    expect(result.config.plugins?.allow).toEqual(["@zhushou/voice-call"]);
    expect(result.config.plugins?.deny).toEqual(["@zhushou/voice-call"]);
    expect(result.config.plugins?.slots?.memory).toBe("@zhushou/voice-call");
    expect(result.config.plugins?.entries?.["@zhushou/voice-call"]).toEqual({
      enabled: false,
      hooks: { allowPromptInjection: false },
    });
    expect(result.config.plugins?.entries?.["voice-call"]).toBeUndefined();
    expect(result.config.plugins?.installs?.["@zhushou/voice-call"]).toMatchObject({
      source: "npm",
      spec: "@zhushou/voice-call",
      installPath: "/tmp/zhushou-voice-call",
      version: "0.0.2",
    });
    expect(result.config.plugins?.installs?.["voice-call"]).toBeUndefined();
  });

  it("checks marketplace installs during dry-run updates", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.2.0",
      extensions: ["index.ts"],
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
      dryRun: true,
    });

    expect(installPluginFromMarketplaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "vincentkoc/claude-marketplace",
        plugin: "claude-bundle",
        expectedPluginId: "claude-bundle",
        dryRun: true,
      }),
    );
    expect(result.outcomes).toEqual([
      {
        pluginId: "claude-bundle",
        status: "updated",
        currentVersion: undefined,
        nextVersion: "1.2.0",
        message: "Would update claude-bundle: unknown -> 1.2.0.",
      },
    ]);
  });

  it("updates marketplace installs and preserves source metadata", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.3.0",
      extensions: ["index.ts"],
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceName: "Vincent's Claude Plugins",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
    });

    expect(result.changed).toBe(true);
    expect(result.config.plugins?.installs?.["claude-bundle"]).toMatchObject({
      source: "marketplace",
      installPath: "/tmp/claude-bundle",
      version: "1.3.0",
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });
  });

  it("forwards dangerous force unsafe install to plugin update installers", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue(
      createSuccessfulNpmUpdateResult({
        pluginId: "zhushou-codex-app-server",
        targetDir: "/tmp/zhushou-codex-app-server",
        version: "0.2.0-beta.4",
      }),
    );

    await updateNpmInstalledPlugins({
      config: createCodexAppServerInstallConfig({
        spec: "zhushou-codex-app-server@beta",
      }),
      pluginIds: ["zhushou-codex-app-server"],
      dangerouslyForceUnsafeInstall: true,
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "zhushou-codex-app-server@beta",
        dangerouslyForceUnsafeInstall: true,
        expectedPluginId: "zhushou-codex-app-server",
      }),
    );
  });
});

describe("syncPluginsForUpdateChannel", () => {
  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
  });

  it.each([
    {
      name: "keeps bundled path installs on beta without reinstalling from npm",
      config: createBundledPathInstallConfig({
        loadPaths: [appBundledPluginRoot("feishu")],
        installPath: appBundledPluginRoot("feishu"),
        spec: "@zhushou/feishu",
      }),
      expectedChanged: false,
      expectedLoadPaths: [appBundledPluginRoot("feishu")],
      expectedInstallPath: appBundledPluginRoot("feishu"),
    },
    {
      name: "repairs bundled install metadata when the load path is re-added",
      config: createBundledPathInstallConfig({
        loadPaths: [],
        installPath: "/tmp/old-feishu",
        spec: "@zhushou/feishu",
      }),
      expectedChanged: true,
      expectedLoadPaths: [appBundledPluginRoot("feishu")],
      expectedInstallPath: appBundledPluginRoot("feishu"),
    },
  ] as const)(
    "$name",
    async ({ config, expectedChanged, expectedLoadPaths, expectedInstallPath }) => {
      mockBundledSources(createBundledSource());

      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        config,
      });

      expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
      expect(result.changed).toBe(expectedChanged);
      expect(result.summary.switchedToNpm).toEqual([]);
      expect(result.config.plugins?.load?.paths).toEqual(expectedLoadPaths);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: appBundledPluginRoot("feishu"),
        installPath: expectedInstallPath,
        spec: "@zhushou/feishu",
      });
    },
  );

  it("forwards an explicit env to bundled plugin source resolution", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    const env = { ZHUSHOU_HOME: "/srv/zhushou-home" } as NodeJS.ProcessEnv;

    await syncPluginsForUpdateChannel({
      channel: "beta",
      config: {},
      workspaceDir: "/workspace",
      env,
    });

    expect(resolveBundledPluginSourcesMock).toHaveBeenCalledWith({
      workspaceDir: "/workspace",
      env,
    });
  });

  it("uses the provided env when matching bundled load and install paths", async () => {
    const bundledHome = "/tmp/zhushou-home";
    mockBundledSources(
      createBundledSource({
        localPath: `${bundledHome}/plugins/feishu`,
      }),
    );

    const previousHome = process.env.HOME;
    process.env.HOME = "/tmp/process-home";
    try {
      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        env: {
          ...process.env,
          ZHUSHOU_HOME: bundledHome,
          HOME: "/tmp/ignored-home",
        },
        config: {
          plugins: {
            load: { paths: ["~/plugins/feishu"] },
            installs: {
              feishu: {
                source: "path",
                sourcePath: "~/plugins/feishu",
                installPath: "~/plugins/feishu",
                spec: "@zhushou/feishu",
              },
            },
          },
        },
      });

      expect(result.changed).toBe(false);
      expect(result.config.plugins?.load?.paths).toEqual(["~/plugins/feishu"]);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: "~/plugins/feishu",
        installPath: "~/plugins/feishu",
      });
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
