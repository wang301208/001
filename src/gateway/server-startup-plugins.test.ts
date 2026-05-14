import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareGatewayPluginBootstrap } from "./server-startup-plugins.js";

const mocks = vi.hoisted(() => ({
  runChannelPluginStartupMaintenance: vi.fn(async () => {}),
  runStartupSessionMigration: vi.fn(async () => {}),
  loadGatewayStartupPlugins: vi.fn(() => ({
    pluginRegistry: {
      plugins: [],
      diagnostics: [],
      gatewayHandlers: {},
      services: [],
    },
    gatewayMethods: ["plugin.method"],
  })),
}));

vi.mock("../channels/plugins/lifecycle-startup.js", () => ({
  runChannelPluginStartupMaintenance: mocks.runChannelPluginStartupMaintenance,
}));

vi.mock("./server-startup-session-migration.js", () => ({
  runStartupSessionMigration: mocks.runStartupSessionMigration,
}));

vi.mock("./server-plugin-bootstrap.js", () => ({
  loadGatewayStartupPlugins: mocks.loadGatewayStartupPlugins,
}));

describe("gateway startup plugin bootstrap", () => {
  const previousSkipChannels = process.env.ZHUSHOU_SKIP_CHANNELS;
  const previousSkipProviders = process.env.ZHUSHOU_SKIP_PROVIDERS;

  afterEach(() => {
    if (previousSkipChannels === undefined) {
      delete process.env.ZHUSHOU_SKIP_CHANNELS;
    } else {
      process.env.ZHUSHOU_SKIP_CHANNELS = previousSkipChannels;
    }
    if (previousSkipProviders === undefined) {
      delete process.env.ZHUSHOU_SKIP_PROVIDERS;
    } else {
      process.env.ZHUSHOU_SKIP_PROVIDERS = previousSkipProviders;
    }
    vi.clearAllMocks();
  });

  it("uses a lightweight core-method bootstrap when channels are skipped", async () => {
    process.env.ZHUSHOU_SKIP_CHANNELS = "1";

    const result = await prepareGatewayPluginBootstrap({
      cfgAtStart: {},
      startupRuntimeConfig: {},
      minimalTestGateway: false,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(mocks.runChannelPluginStartupMaintenance).not.toHaveBeenCalled();
    expect(mocks.runStartupSessionMigration).not.toHaveBeenCalled();
    expect(mocks.loadGatewayStartupPlugins).not.toHaveBeenCalled();
    expect(result.startupPluginIds).toEqual([]);
    expect(result.deferredConfiguredChannelPluginIds).toEqual([]);
    expect(result.baseGatewayMethods).toEqual(result.baseMethods);
  });

  it("can skip channel startup maintenance while still loading gateway plugins", async () => {
    delete process.env.ZHUSHOU_SKIP_CHANNELS;
    delete process.env.ZHUSHOU_SKIP_PROVIDERS;
    const result = await prepareGatewayPluginBootstrap({
      cfgAtStart: {},
      startupRuntimeConfig: {},
      minimalTestGateway: false,
      skipStartupMaintenance: true,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(mocks.runChannelPluginStartupMaintenance).not.toHaveBeenCalled();
    expect(mocks.runStartupSessionMigration).not.toHaveBeenCalled();
    expect(mocks.loadGatewayStartupPlugins).toHaveBeenCalledTimes(1);
    expect(result.baseGatewayMethods).toEqual(["plugin.method"]);
  });

  it("can skip blocking plugin loading while keeping core gateway methods", async () => {
    delete process.env.ZHUSHOU_SKIP_CHANNELS;
    delete process.env.ZHUSHOU_SKIP_PROVIDERS;
    const result = await prepareGatewayPluginBootstrap({
      cfgAtStart: {},
      startupRuntimeConfig: {},
      minimalTestGateway: false,
      skipStartupMaintenance: true,
      skipPluginLoad: true,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(mocks.runChannelPluginStartupMaintenance).not.toHaveBeenCalled();
    expect(mocks.runStartupSessionMigration).not.toHaveBeenCalled();
    expect(mocks.loadGatewayStartupPlugins).not.toHaveBeenCalled();
    expect(result.startupPluginIds).not.toEqual([]);
    expect(result.baseGatewayMethods).toEqual(result.baseMethods);
  });

  it("can skip plugin discovery for stdio startup while keeping core gateway methods", async () => {
    const result = await prepareGatewayPluginBootstrap({
      cfgAtStart: {},
      startupRuntimeConfig: {},
      minimalTestGateway: false,
      skipStartupMaintenance: true,
      skipPluginLoad: true,
      skipPluginDiscovery: true,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });

    expect(mocks.runChannelPluginStartupMaintenance).not.toHaveBeenCalled();
    expect(mocks.runStartupSessionMigration).not.toHaveBeenCalled();
    expect(mocks.loadGatewayStartupPlugins).not.toHaveBeenCalled();
    expect(result.startupPluginIds).toEqual([]);
    expect(result.deferredConfiguredChannelPluginIds).toEqual([]);
    expect(result.baseGatewayMethods).toEqual(result.baseMethods);
  });
});
