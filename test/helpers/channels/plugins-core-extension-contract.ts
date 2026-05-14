import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BaseProbeResult,
  BaseTokenResolution,
  ChannelDirectoryEntry,
} from "../../../src/channels/plugins/types.js";
import type { ZhushouConfig } from "../../../src/config/config.js";
import type { LineProbeResult } from "../../../src/plugin-sdk/line.js";
import {
  loadBundledPluginContractApi,
  loadBundledPluginContractApiSync,
} from "../../../src/test-utils/bundled-plugin-public-surface.js";
import { withEnvAsync } from "../../../src/test-utils/env.js";

type DiscordContractApiSurface = Pick<
  typeof import("@zhushou/discord/contract-api.js"),
  "listDiscordDirectoryPeersFromConfig" | "listDiscordDirectoryGroupsFromConfig"
>;
type DiscordProbe = import("@zhushou/discord/api.js").DiscordProbe;
type DiscordTokenResolution = import("@zhushou/discord/api.js").DiscordTokenResolution;
type IMessageProbe = import("@zhushou/imessage/runtime-api.js").IMessageProbe;
type SignalProbe = import("@zhushou/signal/api.js").SignalProbe;
type SlackContractApiSurface = Pick<
  typeof import("@zhushou/slack/contract-api.js"),
  "listSlackDirectoryPeersFromConfig" | "listSlackDirectoryGroupsFromConfig"
>;
type SlackProbe = import("@zhushou/slack/api.js").SlackProbe;
type TelegramContractApiSurface = Pick<
  typeof import("@zhushou/telegram/contract-api.js"),
  "listTelegramDirectoryPeersFromConfig" | "listTelegramDirectoryGroupsFromConfig"
>;
type TelegramProbe = import("@zhushou/telegram/api.js").TelegramProbe;
type TelegramTokenResolution = import("@zhushou/telegram/api.js").TelegramTokenResolution;

let discordContractApiPromise: Promise<DiscordContractApiSurface> | undefined;
let slackContractApi: SlackContractApiSurface | undefined;

function getDiscordContractApi(): Promise<DiscordContractApiSurface> {
  discordContractApiPromise ??=
    loadBundledPluginContractApi<DiscordContractApiSurface>("discord");
  return discordContractApiPromise;
}

function getSlackContractApi(): SlackContractApiSurface {
  slackContractApi ??= loadBundledPluginContractApiSync<SlackContractApiSurface>("slack");
  return slackContractApi;
}

function normalizeTelegramDirectoryPeerId(entry: string): string | null {
  const trimmed = entry.replace(/^(telegram|tg):/i, "").trim();
  if (!trimmed || trimmed === "*") {
    return null;
  }
  if (/^-?\d+$/u.test(trimmed)) {
    return trimmed;
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeTelegramDirectoryGroupId(entry: string): string | null {
  const trimmed = entry.trim();
  return trimmed && trimmed !== "*" ? trimmed : null;
}

function applyDirectoryQueryAndLimit(
  ids: string[],
  params: { query?: string | null; limit?: number | null },
): string[] {
  const query = params.query?.trim().toLowerCase() ?? "";
  const filtered = query ? ids.filter((id) => id.toLowerCase().includes(query)) : ids;
  return typeof params.limit === "number" && params.limit > 0
    ? filtered.slice(0, params.limit)
    : filtered;
}

function getTelegramConfigForDirectory(params: {
  cfg: ZhushouConfig;
  accountId?: string | null;
}): {
  allowFrom?: Array<string | number>;
  dms?: Record<string, unknown>;
  groups?: Record<string, unknown>;
} {
  const telegram = params.cfg.channels?.telegram as
    | {
        allowFrom?: Array<string | number>;
        dms?: Record<string, unknown>;
        groups?: Record<string, unknown>;
        accounts?: Record<
          string,
          {
            allowFrom?: Array<string | number>;
            dms?: Record<string, unknown>;
            groups?: Record<string, unknown>;
          }
        >;
      }
    | undefined;
  const accountId = params.accountId?.trim();
  if (!accountId || accountId === "default") {
    return telegram ?? {};
  }
  return {
    ...telegram,
    ...telegram?.accounts?.[accountId],
  };
}

const telegramContractApi: TelegramContractApiSurface = {
  listTelegramDirectoryPeersFromConfig: async ({ cfg, accountId, query, limit }) => {
    const telegram = getTelegramConfigForDirectory({ cfg, accountId });
    const ids = new Set<string>();
    for (const entry of [
      ...(telegram.allowFrom ?? []).map((value) => String(value)),
      ...Object.keys(telegram.dms ?? {}),
    ]) {
      const normalized = normalizeTelegramDirectoryPeerId(entry);
      if (normalized) {
        ids.add(normalized);
      }
    }
    return applyDirectoryQueryAndLimit([...ids], { query, limit }).map((id) => ({
      kind: "user" as const,
      id,
    }));
  },
  listTelegramDirectoryGroupsFromConfig: async ({ cfg, accountId, query, limit }) => {
    const telegram = getTelegramConfigForDirectory({ cfg, accountId });
    const ids = new Set<string>();
    for (const entry of Object.keys(telegram.groups ?? {})) {
      const normalized = normalizeTelegramDirectoryGroupId(entry);
      if (normalized) {
        ids.add(normalized);
      }
    }
    return applyDirectoryQueryAndLimit([...ids], { query, limit }).map((id) => ({
      kind: "group" as const,
      id,
    }));
  },
};

function getTelegramContractApi(): TelegramContractApiSurface {
  return telegramContractApi;
}

type DirectoryListFn = (params: {
  cfg: ZhushouConfig;
  accountId?: string;
  query?: string | null;
  limit?: number | null;
}) => Promise<ChannelDirectoryEntry[]>;

async function listDirectoryEntriesWithDefaults(listFn: DirectoryListFn, cfg: ZhushouConfig) {
  return await listFn({
    cfg,
    accountId: "default",
    query: null,
    limit: null,
  });
}

async function expectDirectoryIds(
  listFn: DirectoryListFn,
  cfg: ZhushouConfig,
  expected: string[],
  options?: { sorted?: boolean },
) {
  const entries = await listDirectoryEntriesWithDefaults(listFn, cfg);
  const ids = entries.map((entry) => entry.id);
  expect(options?.sorted ? ids.toSorted() : ids).toEqual(expected);
}

type WhatsAppConfigForDirectory = {
  allowFrom?: Array<string | number>;
  groups?: Record<string, unknown>;
  accounts?: Record<string, WhatsAppConfigForDirectory>;
  defaultAccount?: string;
};

function stripWhatsAppTargetPrefixes(value: string): string {
  let candidate = value.trim();
  for (;;) {
    const before = candidate;
    candidate = candidate.replace(/^whatsapp:/i, "").trim();
    if (candidate === before) {
      return candidate;
    }
  }
}

function normalizeDirectoryPhone(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  if (/^\+\d+$/u.test(candidate)) {
    return candidate;
  }
  if (/^\d+$/u.test(candidate)) {
    return `+${candidate}`;
  }
  return null;
}

function isWhatsAppDirectoryGroupJid(value: string): boolean {
  const candidate = stripWhatsAppTargetPrefixes(value);
  const lower = candidate.toLowerCase();
  if (!lower.endsWith("@g.us")) {
    return false;
  }
  const localPart = candidate.slice(0, candidate.length - "@g.us".length);
  return Boolean(localPart) && !localPart.includes("@") && /^[0-9]+(-[0-9]+)*$/u.test(localPart);
}

function normalizeWhatsAppDirectoryTarget(value: string): string | null {
  const candidate = stripWhatsAppTargetPrefixes(value);
  if (!candidate || candidate === "*") {
    return null;
  }
  if (isWhatsAppDirectoryGroupJid(candidate)) {
    return `${candidate.slice(0, candidate.length - "@g.us".length)}@g.us`;
  }
  const jidPhone =
    candidate.match(/^(\d+)(?::\d+)?@s\.whatsapp\.net$/iu)?.[1] ??
    candidate.match(/^(\d+)@c\.us$/iu)?.[1] ??
    candidate.match(/^(\d+)@lid$/iu)?.[1] ??
    null;
  if (jidPhone) {
    return normalizeDirectoryPhone(jidPhone);
  }
  if (candidate.includes("@")) {
    return null;
  }
  return normalizeDirectoryPhone(candidate);
}

function getWhatsAppConfigForDirectory(params: {
  cfg: ZhushouConfig;
  accountId?: string | null;
}): WhatsAppConfigForDirectory {
  const whatsapp = params.cfg.channels?.whatsapp as WhatsAppConfigForDirectory | undefined;
  const accountId = params.accountId?.trim();
  const effectiveAccountId = accountId || whatsapp?.defaultAccount;
  if (!effectiveAccountId || effectiveAccountId === "default") {
    return whatsapp ?? {};
  }
  return {
    ...whatsapp,
    ...whatsapp?.accounts?.[effectiveAccountId],
  };
}

const whatsappContractApi = {
  listWhatsAppDirectoryPeersFromConfig: async ({ cfg, accountId, query, limit }) => {
    const whatsapp = getWhatsAppConfigForDirectory({ cfg, accountId });
    const ids = new Set<string>();
    for (const entry of whatsapp.allowFrom ?? []) {
      const normalized = normalizeWhatsAppDirectoryTarget(String(entry));
      if (normalized && !isWhatsAppDirectoryGroupJid(normalized)) {
        ids.add(normalized);
      }
    }
    return applyDirectoryQueryAndLimit([...ids], { query, limit }).map((id) => ({
      kind: "user" as const,
      id,
    }));
  },
  listWhatsAppDirectoryGroupsFromConfig: async ({ cfg, accountId, query, limit }) => {
    const whatsapp = getWhatsAppConfigForDirectory({ cfg, accountId });
    const ids = new Set<string>();
    for (const entry of Object.keys(whatsapp.groups ?? {})) {
      const normalized = normalizeWhatsAppDirectoryTarget(entry);
      if (normalized && isWhatsAppDirectoryGroupJid(normalized)) {
        ids.add(normalized);
      }
    }
    return applyDirectoryQueryAndLimit([...ids], { query, limit }).map((id) => ({
      kind: "group" as const,
      id,
    }));
  },
} satisfies Record<
  "listWhatsAppDirectoryPeersFromConfig" | "listWhatsAppDirectoryGroupsFromConfig",
  DirectoryListFn
>;

export function describeDiscordPluginsCoreExtensionContract() {
  describe("discord plugins-core extension contract", () => {
    const listPeers = async () =>
      (await getDiscordContractApi()).listDiscordDirectoryPeersFromConfig;
    const listGroups = async () =>
      (await getDiscordContractApi()).listDiscordDirectoryGroupsFromConfig;

    it("DiscordProbe satisfies BaseProbeResult", () => {
      expectTypeOf<DiscordProbe>().toMatchTypeOf<BaseProbeResult>();
    });

    it("Discord token resolution satisfies BaseTokenResolution", () => {
      expectTypeOf<DiscordTokenResolution>().toMatchTypeOf<BaseTokenResolution>();
    });

    it("lists peers/groups from config (numeric ids only)", async () => {
      const cfg = {
        channels: {
          discord: {
            token: "discord-test",
            dm: { allowFrom: ["<@111>", "<@!333>", "nope"] },
            dms: { "222": {} },
            guilds: {
              "123": {
                users: ["<@12345>", " discord:444 ", "not-an-id"],
                channels: {
                  "555": {},
                  "<#777>": {},
                  "channel:666": {},
                  general: {},
                },
              },
            },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(
        await listPeers(),
        cfg,
        ["user:111", "user:12345", "user:222", "user:333", "user:444"],
        { sorted: true },
      );
      await expectDirectoryIds(
        await listGroups(),
        cfg,
        ["channel:555", "channel:666", "channel:777"],
        {
          sorted: true,
        },
      );
    }, 180_000);

    it("keeps directories readable when tokens are unresolved SecretRefs", async () => {
      const envSecret = {
        source: "env",
        provider: "default",
        id: "MISSING_TEST_SECRET",
      } as const;
      const cfg = {
        channels: {
          discord: {
            token: envSecret,
            dm: { allowFrom: ["<@111>"] },
            guilds: {
              "123": {
                channels: {
                  "555": {},
                },
              },
            },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(await listPeers(), cfg, ["user:111"]);
      await expectDirectoryIds(await listGroups(), cfg, ["channel:555"]);
    });

    it("applies query and limit filtering for config-backed directories", async () => {
      const cfg = {
        channels: {
          discord: {
            token: "discord-test",
            guilds: {
              "123": {
                channels: {
                  "555": {},
                  "666": {},
                  "777": {},
                },
              },
            },
          },
        },
      } as unknown as ZhushouConfig;

      const groups = await (await listGroups())({
        cfg,
        accountId: "default",
        query: "666",
        limit: 5,
      });
      expect(groups.map((entry) => entry.id)).toEqual(["channel:666"]);
    });
  });
}

export function describeSlackPluginsCoreExtensionContract() {
  describe("slack plugins-core extension contract", () => {
    const listPeers = () => getSlackContractApi().listSlackDirectoryPeersFromConfig;
    const listGroups = () => getSlackContractApi().listSlackDirectoryGroupsFromConfig;

    it("SlackProbe satisfies BaseProbeResult", () => {
      expectTypeOf<SlackProbe>().toMatchTypeOf<BaseProbeResult>();
    });

    it("lists peers/groups from config", async () => {
      const cfg = {
        channels: {
          slack: {
            botToken: "xoxb-test",
            appToken: "xapp-test",
            dm: { allowFrom: ["U123", "user:U999"] },
            dms: { U234: {} },
            channels: { C111: { users: ["U777"] } },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(
        listPeers(),
        cfg,
        ["user:u123", "user:u234", "user:u777", "user:u999"],
        { sorted: true },
      );
      await expectDirectoryIds(listGroups(), cfg, ["channel:c111"]);
    });

    it("keeps directories readable when tokens are unresolved SecretRefs", async () => {
      const envSecret = {
        source: "env",
        provider: "default",
        id: "MISSING_TEST_SECRET",
      } as const;
      const cfg = {
        channels: {
          slack: {
            botToken: envSecret,
            appToken: envSecret,
            dm: { allowFrom: ["U123"] },
            channels: { C111: {} },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(listPeers(), cfg, ["user:u123"]);
      await expectDirectoryIds(listGroups(), cfg, ["channel:c111"]);
    });

    it("applies query and limit filtering for config-backed directories", async () => {
      const cfg = {
        channels: {
          slack: {
            botToken: "xoxb-test",
            appToken: "xapp-test",
            dm: { allowFrom: ["U100", "U200"] },
            dms: { U300: {} },
          },
        },
      } as unknown as ZhushouConfig;

      const peers = await listPeers()({
        cfg,
        accountId: "default",
        query: "user:u",
        limit: 2,
      });
      expect(peers).toHaveLength(2);
      expect(peers.every((entry) => entry.id.startsWith("user:u"))).toBe(true);
    });
  });
}

export function describeTelegramPluginsCoreExtensionContract() {
  describe("telegram plugins-core extension contract", () => {
    const listPeers = () => getTelegramContractApi().listTelegramDirectoryPeersFromConfig;
    const listGroups = () => getTelegramContractApi().listTelegramDirectoryGroupsFromConfig;

    it("TelegramProbe satisfies BaseProbeResult", () => {
      expectTypeOf<TelegramProbe>().toMatchTypeOf<BaseProbeResult>();
    });

    it("Telegram token resolution satisfies BaseTokenResolution", () => {
      expectTypeOf<TelegramTokenResolution>().toMatchTypeOf<BaseTokenResolution>();
    });

    it("lists peers/groups from config", async () => {
      const cfg = {
        channels: {
          telegram: {
            botToken: "telegram-test",
            allowFrom: ["123", "alice", "tg:@bob"],
            dms: { "456": {} },
            groups: { "-1001": {}, "*": {} },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(listPeers(), cfg, ["123", "456", "@alice", "@bob"], {
        sorted: true,
      });
      await expectDirectoryIds(listGroups(), cfg, ["-1001"]);
    });

    it("keeps fallback semantics when accountId is omitted", async () => {
      await withEnvAsync({ TELEGRAM_BOT_TOKEN: "tok-env" }, async () => {
        const cfg = {
          channels: {
            telegram: {
              allowFrom: ["alice"],
              groups: { "-1001": {} },
              accounts: {
                work: {
                  botToken: "tok-work",
                  allowFrom: ["bob"],
                  groups: { "-2002": {} },
                },
              },
            },
          },
        } as unknown as ZhushouConfig;

        await expectDirectoryIds(listPeers(), cfg, ["@alice"]);
        await expectDirectoryIds(listGroups(), cfg, ["-1001"]);
      });
    });

    it("keeps directories readable when tokens are unresolved SecretRefs", async () => {
      const envSecret = {
        source: "env",
        provider: "default",
        id: "MISSING_TEST_SECRET",
      } as const;
      const cfg = {
        channels: {
          telegram: {
            botToken: envSecret,
            allowFrom: ["alice"],
            groups: { "-1001": {} },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(listPeers(), cfg, ["@alice"]);
      await expectDirectoryIds(listGroups(), cfg, ["-1001"]);
    });

    it("applies query and limit filtering for config-backed directories", async () => {
      const cfg = {
        channels: {
          telegram: {
            botToken: "telegram-test",
            groups: { "-1001": {}, "-1002": {}, "-2001": {} },
          },
        },
      } as unknown as ZhushouConfig;

      const groups = await listGroups()({
        cfg,
        accountId: "default",
        query: "-100",
        limit: 1,
      });
      expect(groups.map((entry) => entry.id)).toEqual(["-1001"]);
    });
  });
}

export function describeWhatsAppPluginsCoreExtensionContract() {
  describe("whatsapp plugins-core extension contract", () => {
    const listPeers = () => whatsappContractApi.listWhatsAppDirectoryPeersFromConfig;
    const listGroups = () => whatsappContractApi.listWhatsAppDirectoryGroupsFromConfig;

    it("lists peers/groups from config", async () => {
      const cfg = {
        channels: {
          whatsapp: {
            allowFrom: ["+15550000000", "*", "123@g.us"],
            groups: { "999@g.us": { requireMention: true }, "*": {} },
          },
        },
      } as unknown as ZhushouConfig;

      await expectDirectoryIds(listPeers(), cfg, ["+15550000000"]);
      await expectDirectoryIds(listGroups(), cfg, ["999@g.us"]);
    });

    it("applies query and limit filtering for config-backed directories", async () => {
      const cfg = {
        channels: {
          whatsapp: {
            groups: { "111@g.us": {}, "222@g.us": {}, "333@s.whatsapp.net": {} },
          },
        },
      } as unknown as ZhushouConfig;

      const groups = await listGroups()({
        cfg,
        accountId: "default",
        query: "@g.us",
        limit: 1,
      });
      expect(groups.map((entry) => entry.id)).toEqual(["111@g.us"]);
    });
  });
}

export function describeSignalPluginsCoreExtensionContract() {
  describe("signal plugins-core extension contract", () => {
    it("SignalProbe satisfies BaseProbeResult", () => {
      expectTypeOf<SignalProbe>().toMatchTypeOf<BaseProbeResult>();
    });
  });
}

export function describeIMessagePluginsCoreExtensionContract() {
  describe("imessage plugins-core extension contract", () => {
    it("IMessageProbe satisfies BaseProbeResult", () => {
      expectTypeOf<IMessageProbe>().toMatchTypeOf<BaseProbeResult>();
    });
  });
}

export function describeLinePluginsCoreExtensionContract() {
  describe("line plugins-core extension contract", () => {
    it("LineProbeResult satisfies BaseProbeResult", () => {
      expectTypeOf<LineProbeResult>().toMatchTypeOf<BaseProbeResult>();
    });
  });
}
