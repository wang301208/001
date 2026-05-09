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
  const previousSkipChannels = process.env.ASSISTANT_SKIP_CHANNELS;

  afterEach(() => {
    if (previousSkipChannels === undefined) {
      delete process.env.ASSISTANT_SKIP_CHANNELS;
    } else {
      process.env.ASSISTANT_SKIP_CHANNELS = previousSkipChannels;
    }
    vi.clearAllMocks();
  });

  it("uses a lightweight core-method bootstrap when channels are skipped", async () => {
    process.env.ASSISTANT_SKIP_CHANNELS = "1";

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
});
