import { expect } from "vitest";
import type { ChannelPlugin } from "../../../src/channels/plugins/types.js";
import type { ZhushouConfig } from "../../../src/config/config.js";

type SetupContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "config" | "setup">;
  cases: Array<{
    name: string;
    cfg: ZhushouConfig;
    accountId?: string;
    input: Record<string, unknown>;
    expectedAccountId?: string;
    expectedValidation?: string | null;
    beforeTest?: () => void;
    assertPatchedConfig?: (cfg: ZhushouConfig) => void;
    assertResolvedAccount?: (account: unknown, cfg: ZhushouConfig) => void;
  }>;
};

type StatusContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "config" | "status">;
  cases: Array<{
    name: string;
    cfg: ZhushouConfig;
    accountId?: string;
    runtime?: Record<string, unknown>;
    probe?: unknown;
    beforeTest?: () => void;
    assertSnapshot?: (snapshot: Record<string, unknown>) => void;
    assertSummary?: (summary: Record<string, unknown>) => void;
  }>;
};

let setupContractRegistryCache: SetupContractEntry[] | undefined;
let statusContractRegistryCache: StatusContractEntry[] | undefined;

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(value: unknown): string | undefined {
  const trimmed = trimString(value);
  return trimmed ? trimmed.replace(/\/+$/u, "") : undefined;
}

function createSlackContractPlugin(): Pick<ChannelPlugin, "id" | "config" | "setup" | "status"> {
  return {
    id: "slack",
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: (cfg, accountId) => ({
        accountId: accountId?.trim() || "default",
        botToken: cfg.channels?.slack?.botToken,
        appToken: cfg.channels?.slack?.appToken,
        enabled: cfg.channels?.slack?.enabled !== false,
      }),
    },
    setup: {
      validateInput: ({ accountId, input }) =>
        accountId !== "default" && input.useEnv === true
          ? "Slack env tokens can only be used for the default account."
          : null,
      applyAccountConfig: ({ cfg, input }) =>
        ({
          ...cfg,
          channels: {
            ...cfg.channels,
            slack: {
              ...cfg.channels?.slack,
              enabled: true,
              botToken: trimString(input.botToken),
              appToken: trimString(input.appToken),
            },
          },
        }) as ZhushouConfig,
    },
    status: {
      buildAccountSnapshot: ({ account, runtime }) => {
        const resolved = account as { accountId: string; botToken?: string; enabled?: boolean };
        return {
          ...runtime,
          accountId: resolved.accountId,
          enabled: resolved.enabled !== false,
          configured: Boolean(trimString(resolved.botToken)),
        };
      },
    },
  };
}

function createMattermostContractPlugin(): Pick<
  ChannelPlugin,
  "id" | "config" | "setup" | "status"
> {
  return {
    id: "mattermost",
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: (cfg, accountId) => ({
        accountId: accountId?.trim() || "default",
        enabled: cfg.channels?.mattermost?.enabled !== false,
        botToken: cfg.channels?.mattermost?.botToken,
        baseUrl: cfg.channels?.mattermost?.baseUrl,
      }),
    },
    setup: {
      validateInput: ({ input }) => {
        const botToken = trimString(input.botToken);
        const baseUrl = normalizeBaseUrl(input.httpUrl);
        return botToken && baseUrl
          ? null
          : "Mattermost requires --bot-token and --http-url (or --use-env).";
      },
      applyAccountConfig: ({ cfg, input }) =>
        ({
          ...cfg,
          channels: {
            ...cfg.channels,
            mattermost: {
              ...cfg.channels?.mattermost,
              enabled: true,
              botToken: trimString(input.botToken),
              baseUrl: normalizeBaseUrl(input.httpUrl),
            },
          },
        }) as ZhushouConfig,
    },
    status: {
      buildAccountSnapshot: ({ account, runtime }) => {
        const resolved = account as {
          accountId: string;
          enabled?: boolean;
          botToken?: string;
          baseUrl?: string;
        };
        return {
          ...runtime,
          accountId: resolved.accountId,
          enabled: resolved.enabled !== false,
          configured: Boolean(trimString(resolved.botToken) && trimString(resolved.baseUrl)),
          baseUrl: resolved.baseUrl,
        };
      },
    },
  };
}

function createLineContractPlugin(): Pick<ChannelPlugin, "id" | "config" | "setup" | "status"> {
  return {
    id: "line",
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: (cfg, accountId) => ({
        accountId: accountId?.trim() || "default",
        enabled: cfg.channels?.line?.enabled !== false,
        channelAccessToken: cfg.channels?.line?.channelAccessToken,
        channelSecret: cfg.channels?.line?.channelSecret,
      }),
    },
    setup: {
      validateInput: ({ accountId, input }) =>
        accountId !== "default" && input.useEnv === true
          ? "LINE_CHANNEL_ACCESS_TOKEN can only be used for the default account."
          : null,
      applyAccountConfig: ({ cfg, input }) => {
        const lineInput = input as typeof input & {
          channelAccessToken?: string;
          channelSecret?: string;
        };
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            line: {
              ...cfg.channels?.line,
              enabled: true,
              channelAccessToken: trimString(lineInput.channelAccessToken),
              channelSecret: trimString(lineInput.channelSecret),
            },
          },
        } as ZhushouConfig;
      },
    },
    status: {
      buildAccountSnapshot: ({ account, runtime }) => {
        const resolved = account as {
          accountId: string;
          enabled?: boolean;
          channelAccessToken?: string;
          channelSecret?: string;
        };
        return {
          ...runtime,
          accountId: resolved.accountId,
          enabled: resolved.enabled !== false,
          configured: Boolean(
            trimString(resolved.channelAccessToken) && trimString(resolved.channelSecret),
          ),
          mode: "webhook",
        };
      },
    },
  };
}

export function getSetupContractRegistry(): SetupContractEntry[] {
  setupContractRegistryCache ??= [
    {
      id: "slack",
      plugin: createSlackContractPlugin(),
      cases: [
        {
          name: "default account stores tokens and enables the channel",
          cfg: {} as ZhushouConfig,
          input: {
            botToken: "xoxb-test",
            appToken: "xapp-test",
          },
          expectedAccountId: "default",
          assertPatchedConfig: (cfg) => {
            expect(cfg.channels?.slack?.enabled).toBe(true);
            expect(cfg.channels?.slack?.botToken).toBe("xoxb-test");
            expect(cfg.channels?.slack?.appToken).toBe("xapp-test");
          },
        },
        {
          name: "non-default env setup is rejected",
          cfg: {} as ZhushouConfig,
          accountId: "ops",
          input: {
            useEnv: true,
          },
          expectedAccountId: "ops",
          expectedValidation: "Slack env tokens can only be used for the default account.",
        },
      ],
    },
    {
      id: "mattermost",
      plugin: createMattermostContractPlugin(),
      cases: [
        {
          name: "default account stores token and normalized base URL",
          cfg: {} as ZhushouConfig,
          input: {
            botToken: "test-token",
            httpUrl: "https://chat.example.com/",
          },
          expectedAccountId: "default",
          assertPatchedConfig: (cfg) => {
            expect(cfg.channels?.mattermost?.enabled).toBe(true);
            expect(cfg.channels?.mattermost?.botToken).toBe("test-token");
            expect(cfg.channels?.mattermost?.baseUrl).toBe("https://chat.example.com");
          },
        },
        {
          name: "missing credentials are rejected",
          cfg: {} as ZhushouConfig,
          input: {
            httpUrl: "",
          },
          expectedAccountId: "default",
          expectedValidation: "Mattermost requires --bot-token and --http-url (or --use-env).",
        },
      ],
    },
    {
      id: "line",
      plugin: createLineContractPlugin(),
      cases: [
        {
          name: "default account stores token and secret",
          cfg: {} as ZhushouConfig,
          input: {
            channelAccessToken: "line-token",
            channelSecret: "line-secret",
          },
          expectedAccountId: "default",
          assertPatchedConfig: (cfg) => {
            expect(cfg.channels?.line?.enabled).toBe(true);
            expect(cfg.channels?.line?.channelAccessToken).toBe("line-token");
            expect(cfg.channels?.line?.channelSecret).toBe("line-secret");
          },
        },
        {
          name: "non-default env setup is rejected",
          cfg: {} as ZhushouConfig,
          accountId: "ops",
          input: {
            useEnv: true,
          },
          expectedAccountId: "ops",
          expectedValidation: "LINE_CHANNEL_ACCESS_TOKEN can only be used for the default account.",
        },
      ],
    },
  ];
  return setupContractRegistryCache;
}

export function getStatusContractRegistry(): StatusContractEntry[] {
  statusContractRegistryCache ??= [
    {
      id: "slack",
      plugin: createSlackContractPlugin(),
      cases: [
        {
          name: "configured account produces a configured status snapshot",
          cfg: {
            channels: {
              slack: {
                botToken: "xoxb-test",
                appToken: "xapp-test",
              },
            },
          } as ZhushouConfig,
          runtime: {
            accountId: "default",
            connected: true,
            running: true,
          },
          probe: { ok: true },
          assertSnapshot: (snapshot) => {
            expect(snapshot.accountId).toBe("default");
            expect(snapshot.enabled).toBe(true);
            expect(snapshot.configured).toBe(true);
          },
        },
      ],
    },
    {
      id: "mattermost",
      plugin: createMattermostContractPlugin(),
      cases: [
        {
          name: "configured account preserves connectivity details in the snapshot",
          cfg: {
            channels: {
              mattermost: {
                enabled: true,
                botToken: "test-token",
                baseUrl: "https://chat.example.com",
              },
            },
          } as ZhushouConfig,
          runtime: {
            accountId: "default",
            connected: true,
            lastConnectedAt: 1234,
          },
          probe: { ok: true },
          assertSnapshot: (snapshot) => {
            expect(snapshot.accountId).toBe("default");
            expect(snapshot.enabled).toBe(true);
            expect(snapshot.configured).toBe(true);
            expect(snapshot.connected).toBe(true);
            expect(snapshot.baseUrl).toBe("https://chat.example.com");
          },
        },
      ],
    },
    {
      id: "line",
      plugin: createLineContractPlugin(),
      cases: [
        {
          name: "configured account produces a webhook status snapshot",
          cfg: {
            channels: {
              line: {
                enabled: true,
                channelAccessToken: "line-token",
                channelSecret: "line-secret",
              },
            },
          } as ZhushouConfig,
          runtime: {
            accountId: "default",
            running: true,
          },
          probe: { ok: true },
          assertSnapshot: (snapshot) => {
            expect(snapshot.accountId).toBe("default");
            expect(snapshot.enabled).toBe(true);
            expect(snapshot.configured).toBe(true);
            expect(snapshot.mode).toBe("webhook");
          },
        },
      ],
    },
  ];
  return statusContractRegistryCache;
}
