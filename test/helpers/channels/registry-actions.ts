import { requireBundledChannelPlugin } from "../../../src/channels/plugins/bundled.js";
import type { ChannelPlugin } from "../../../src/channels/plugins/types.js";
import type { ZhushouConfig } from "../../../src/config/config.js";
import { loadBundledPluginPublicSurfaceSync } from "../../../src/test-utils/bundled-plugin-public-surface.js";
import { Type } from "@sinclair/typebox";

type ChannelActions = NonNullable<ChannelPlugin["actions"]>;

let slackMessageToolApiCache:
  | {
      describeMessageTool: NonNullable<ChannelActions["describeMessageTool"]>;
    }
  | undefined;
let telegramRuntimeApiCache:
  | {
      telegramMessageActions: ChannelActions;
    }
  | undefined;
let discordRuntimeApiCache:
  | {
      discordMessageActions: ChannelActions;
    }
  | undefined;

function getSlackMessageToolApi() {
  slackMessageToolApiCache ??= loadBundledPluginPublicSurfaceSync<{
    describeMessageTool: NonNullable<ChannelActions["describeMessageTool"]>;
  }>({
    pluginId: "slack",
    artifactBasename: "message-tool-api.js",
  });
  return slackMessageToolApiCache;
}

function getTelegramRuntimeApi() {
  telegramRuntimeApiCache ??= loadBundledPluginPublicSurfaceSync<{
    telegramMessageActions: ChannelActions;
  }>({
    pluginId: "telegram",
    artifactBasename: "runtime-api.js",
  });
  return telegramRuntimeApiCache;
}

function getDiscordRuntimeApi() {
  discordRuntimeApiCache ??= loadBundledPluginPublicSurfaceSync<{
    discordMessageActions: ChannelActions;
  }>({
    pluginId: "discord",
    artifactBasename: "runtime-api.js",
  });
  return discordRuntimeApiCache;
}

type ActionsContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "actions">;
  unsupportedAction?: string;
  cases: Array<{
    name: string;
    cfg: ZhushouConfig;
    expectedActions: string[];
    expectedCapabilities?: string[];
    beforeTest?: () => void;
  }>;
};

let actionContractRegistryCache: ActionsContractEntry[] | undefined;

function createSlackActionsContractPlugin(): Pick<ChannelPlugin, "id" | "actions"> {
  return {
    id: "slack",
    actions: {
      describeMessageTool: (ctx) => getSlackMessageToolApi().describeMessageTool(ctx),
    },
  };
}

function listMattermostAccountIds(cfg: ZhushouConfig): string[] {
  const mattermost = cfg.channels?.mattermost as
    | {
        accounts?: Record<string, unknown>;
        defaultAccount?: string;
      }
    | undefined;
  const accountIds = Object.keys(mattermost?.accounts ?? {});
  if (accountIds.length > 0) {
    return accountIds;
  }
  return [mattermost?.defaultAccount?.trim() || "default"];
}

function resolveMattermostAccount(cfg: ZhushouConfig, accountId: string) {
  const mattermost = cfg.channels?.mattermost as
    | {
        enabled?: boolean;
        botToken?: string;
        baseUrl?: string;
        actions?: { reactions?: boolean };
        accounts?: Record<
          string,
          {
            enabled?: boolean;
            botToken?: string;
            baseUrl?: string;
            actions?: { reactions?: boolean };
          }
        >;
      }
    | undefined;
  const account = mattermost?.accounts?.[accountId] ?? {};
  return {
    enabled: mattermost?.enabled !== false && account.enabled !== false,
    botToken: account.botToken ?? mattermost?.botToken,
    baseUrl: account.baseUrl ?? mattermost?.baseUrl,
    actions: account.actions ?? mattermost?.actions,
  };
}

function createMattermostActionsContractPlugin(): Pick<ChannelPlugin, "id" | "actions"> {
  return {
    id: "mattermost",
    actions: {
      describeMessageTool: ({ cfg, accountId }) => {
        const enabledAccounts = (accountId ? [accountId] : listMattermostAccountIds(cfg))
          .map((id) => resolveMattermostAccount(cfg, id))
          .filter((account) => account.enabled)
          .filter((account) => Boolean(account.botToken?.trim() && account.baseUrl?.trim()));
        if (enabledAccounts.length === 0) {
          return { actions: [], capabilities: [], schema: null };
        }
        const reactionsEnabled = enabledAccounts.some(
          (account) => account.actions?.reactions ?? true,
        );
        return {
          actions: reactionsEnabled ? ["send", "react"] : ["send"],
          capabilities: ["buttons"],
          schema: {
            properties: {
              buttons: Type.Array(Type.Unknown()),
            },
          },
        };
      },
      supportsAction: ({ action }) => action === "send" || action === "react",
    },
  };
}

function createTelegramActionsContractPlugin(): Pick<ChannelPlugin, "id" | "actions"> {
  return {
    id: "telegram",
    actions: getTelegramRuntimeApi().telegramMessageActions,
  };
}

function createDiscordActionsContractPlugin(): Pick<ChannelPlugin, "id" | "actions"> {
  return {
    id: "discord",
    actions: getDiscordRuntimeApi().discordMessageActions,
  };
}

export function getActionContractRegistry(): ActionsContractEntry[] {
  actionContractRegistryCache ??= [
    {
      id: "slack",
      plugin: createSlackActionsContractPlugin(),
      unsupportedAction: "poll",
      cases: [
        {
          name: "configured account exposes default Slack actions",
          cfg: {
            channels: {
              slack: {
                botToken: "xoxb-test",
                appToken: "xapp-test",
              },
            },
          } as ZhushouConfig,
          expectedActions: [
            "send",
            "react",
            "reactions",
            "read",
            "edit",
            "delete",
            "download-file",
            "upload-file",
            "pin",
            "unpin",
            "list-pins",
            "member-info",
            "emoji-list",
          ],
          expectedCapabilities: ["blocks"],
        },
        {
          name: "interactive replies add the shared interactive capability",
          cfg: {
            channels: {
              slack: {
                botToken: "xoxb-test",
                appToken: "xapp-test",
                capabilities: {
                  interactiveReplies: true,
                },
              },
            },
          } as ZhushouConfig,
          expectedActions: [
            "send",
            "react",
            "reactions",
            "read",
            "edit",
            "delete",
            "download-file",
            "upload-file",
            "pin",
            "unpin",
            "list-pins",
            "member-info",
            "emoji-list",
          ],
          expectedCapabilities: ["blocks", "interactive"],
        },
        {
          name: "missing tokens disables the actions surface",
          cfg: {
            channels: {
              slack: {
                enabled: true,
              },
            },
          } as ZhushouConfig,
          expectedActions: [],
          expectedCapabilities: [],
        },
      ],
    },
    {
      id: "mattermost",
      plugin: createMattermostActionsContractPlugin(),
      unsupportedAction: "poll",
      cases: [
        {
          name: "configured account exposes send and react",
          cfg: {
            channels: {
              mattermost: {
                enabled: true,
                botToken: "test-token",
                baseUrl: "https://chat.example.com",
              },
            },
          } as ZhushouConfig,
          expectedActions: ["send", "react"],
          expectedCapabilities: ["buttons"],
        },
        {
          name: "reactions can be disabled while send stays available",
          cfg: {
            channels: {
              mattermost: {
                enabled: true,
                botToken: "test-token",
                baseUrl: "https://chat.example.com",
                actions: { reactions: false },
              },
            },
          } as ZhushouConfig,
          expectedActions: ["send"],
          expectedCapabilities: ["buttons"],
        },
        {
          name: "missing bot credentials disables the actions surface",
          cfg: {
            channels: {
              mattermost: {
                enabled: true,
              },
            },
          } as ZhushouConfig,
          expectedActions: [],
          expectedCapabilities: [],
        },
      ],
    },
    {
      id: "telegram",
      plugin: createTelegramActionsContractPlugin(),
      cases: [
        {
          name: "exposes configured Telegram actions and capabilities",
          cfg: {
            channels: {
              telegram: {
                botToken: "123:telegram-test-token",
              },
            },
          } as ZhushouConfig,
          expectedActions: [
            "send",
            "poll",
            "react",
            "delete",
            "edit",
            "topic-create",
            "topic-edit",
          ],
          expectedCapabilities: ["interactive", "buttons"],
        },
      ],
    },
    {
      id: "discord",
      plugin: createDiscordActionsContractPlugin(),
      cases: [
        {
          name: "describes configured Discord actions and capabilities",
          cfg: {
            channels: {
              discord: {
                token: "Bot token-main",
                actions: {
                  polls: true,
                  reactions: true,
                  permissions: false,
                  messages: false,
                  pins: false,
                  threads: false,
                  search: false,
                  stickers: false,
                  memberInfo: false,
                  roleInfo: false,
                  emojiUploads: false,
                  stickerUploads: false,
                  channelInfo: false,
                  channels: false,
                  voiceStatus: false,
                  events: false,
                  roles: false,
                  moderation: false,
                  presence: false,
                },
              },
            },
          } as ZhushouConfig,
          expectedActions: ["send", "poll", "react", "reactions", "emoji-list"],
          expectedCapabilities: ["interactive", "components"],
        },
      ],
    },
  ];
  return actionContractRegistryCache;
}
