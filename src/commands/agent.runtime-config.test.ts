import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import { resolveAgentRuntimeConfig } from "../agents/agent-runtime-config.js";
import { resolveSession } from "../agents/command/session.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import type { RuntimeEnv } from "../runtime.js";

type ConfigSnapshotForWrite = {
  snapshot: { valid: boolean; resolved: ZhushouConfig };
  writeOptions: Record<string, never>;
};

type ResolveCommandConfigParams = {
  config: ZhushouConfig;
  commandName: string;
  targetIds: Set<string>;
  runtime: RuntimeEnv;
};

const loadConfigMock = vi.hoisted(() => vi.fn<() => ZhushouConfig>());
const readConfigFileSnapshotForWriteMock = vi.hoisted(() =>
  vi.fn<() => Promise<ConfigSnapshotForWrite>>(),
);
vi.mock("../config/io.js", () => ({
  loadConfig: loadConfigMock,
  readConfigFileSnapshotForWrite: readConfigFileSnapshotForWriteMock,
}));

vi.mock("../cli/command-secret-targets.js", () => ({
  getAgentRuntimeCommandSecretTargetIds: (params?: { includeChannelTargets?: boolean }) =>
    new Set([
      "models.providers.*.apiKey",
      ...(params?.includeChannelTargets === true ? ["channels.telegram.botToken"] : []),
    ]),
}));

const setRuntimeConfigSnapshotMock = vi.hoisted(() =>
  vi.fn<(cfg: ZhushouConfig, sourceConfig: ZhushouConfig) => void>(),
);
vi.mock("../config/runtime-snapshot.js", () => ({
  setRuntimeConfigSnapshot: setRuntimeConfigSnapshotMock,
}));

const resolveCommandConfigWithSecretsMock = vi.hoisted(() =>
  vi.fn<
    (params: ResolveCommandConfigParams) => Promise<{
      resolvedConfig: ZhushouConfig;
      effectiveConfig: ZhushouConfig;
      diagnostics: never[];
    }>
  >(),
);
vi.mock("../cli/command-config-resolution.runtime.js", () => ({
  resolveCommandConfigWithSecrets: resolveCommandConfigWithSecretsMock,
}));

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "zhushou-agent-" });
}

function mockConfig(home: string, storePath: string): ZhushouConfig {
  const cfg = {
    agents: {
      defaults: {
        model: { primary: "anthropic/claude-opus-4-6" },
        models: { "anthropic/claude-opus-4-6": {} },
        workspace: path.join(home, "zhushou"),
      },
    },
    session: { store: storePath, mainKey: "main" },
  } as ZhushouConfig;
  loadConfigMock.mockReturnValue(cfg);
  return cfg;
}

beforeEach(() => {
  vi.clearAllMocks();
  readConfigFileSnapshotForWriteMock.mockResolvedValue({
    snapshot: { valid: false, resolved: {} as ZhushouConfig },
    writeOptions: {},
  });
});

describe("agentCommand runtime config", () => {
  it("sets runtime snapshots from source config before embedded agent run", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      const loadedConfig = {
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-opus-4-6" },
            models: { "anthropic/claude-opus-4-6": {} },
            workspace: path.join(home, "zhushou"),
          },
        },
        session: { store, mainKey: "main" },
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              apiKey: { source: "env", provider: "default", id: "OPENAI_API_KEY" }, // pragma: allowlist secret
              models: [],
            },
          },
        },
      } as unknown as ZhushouConfig;
      const sourceConfig = {
        ...loadedConfig,
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              apiKey: { source: "env", provider: "default", id: "OPENAI_API_KEY" }, // pragma: allowlist secret
              models: [],
            },
          },
        },
      } as unknown as ZhushouConfig;
      const resolvedConfig = {
        ...loadedConfig,
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              apiKey: "sk-resolved-runtime", // pragma: allowlist secret
              models: [],
            },
          },
        },
      } as unknown as ZhushouConfig;

      loadConfigMock.mockReturnValue(loadedConfig);
      readConfigFileSnapshotForWriteMock.mockResolvedValue({
        snapshot: { valid: true, resolved: sourceConfig },
        writeOptions: {},
      });
      resolveCommandConfigWithSecretsMock.mockResolvedValueOnce({
        resolvedConfig,
        effectiveConfig: resolvedConfig,
        diagnostics: [],
      });

      const prepared = await resolveAgentRuntimeConfig(runtime);

      expect(resolveCommandConfigWithSecretsMock).toHaveBeenCalledWith({
        config: loadedConfig,
        commandName: "agent",
        targetIds: expect.objectContaining({
          has: expect.any(Function),
        }),
        runtime,
      });
      const targetIds = resolveCommandConfigWithSecretsMock.mock.calls[0]?.[0].targetIds;
      expect(targetIds.has("models.providers.*.apiKey")).toBe(true);
      expect(targetIds.has("channels.telegram.botToken")).toBe(false);
      expect(setRuntimeConfigSnapshotMock).toHaveBeenCalledWith(resolvedConfig, sourceConfig);
      expect(prepared.cfg).toBe(resolvedConfig);
    });
  });

  it("includes channel secret targets when delivery is requested", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      const loadedConfig = mockConfig(home, store);
      loadedConfig.channels = {
        telegram: {
          botToken: { source: "env", provider: "default", id: "TELEGRAM_BOT_TOKEN" },
        },
      } as unknown as ZhushouConfig["channels"];
      resolveCommandConfigWithSecretsMock.mockResolvedValueOnce({
        resolvedConfig: loadedConfig,
        effectiveConfig: loadedConfig,
        diagnostics: [],
      });

      await resolveAgentRuntimeConfig(runtime, {
        runtimeTargetsChannelSecrets: true,
      });

      const targetIds = resolveCommandConfigWithSecretsMock.mock.calls[0]?.[0].targetIds;
      expect(targetIds.has("channels.telegram.botToken")).toBe(true);
    });
  });

  it("skips command secret resolution when no relevant SecretRef values exist", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      const loadedConfig = mockConfig(home, store);

      const prepared = await resolveAgentRuntimeConfig(runtime);

      expect(resolveCommandConfigWithSecretsMock).not.toHaveBeenCalled();
      expect(prepared.cfg).toBe(loadedConfig);
    });
  });

  it("derives a fresh session from --to", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      const cfg = mockConfig(home, store);

      const resolved = resolveSession({ cfg, to: "+1555" });

      expect(resolved.storePath).toBe(store);
      expect(resolved.sessionKey).toBeTruthy();
      expect(resolved.sessionId).toBeTruthy();
      expect(resolved.isNewSession).toBe(true);
    });
  });
});
