import type { ChannelPlugin } from "../../../src/channels/plugins/types.js";
import type {
  ChannelDirectoryEntry,
  ChannelThreadingContext,
} from "../../../src/channels/plugins/types.core.js";
import type { ZhushouConfig } from "../../../src/config/config.js";
import { channelPluginSurfaceKeys, type ChannelPluginSurface } from "./manifest.js";

type SurfaceContractEntry = {
  id: string;
  plugin: Pick<
    ChannelPlugin,
    | "id"
    | "actions"
    | "setup"
    | "status"
    | "outbound"
    | "messaging"
    | "threading"
    | "directory"
    | "gateway"
  >;
  surfaces: readonly ChannelPluginSurface[];
};

type ThreadingContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "threading">;
};

type DirectoryContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "directory">;
  coverage: "lookups" | "presence";
  cfg?: ZhushouConfig;
  accountId?: string;
};

type LightweightSurfacePlugin = SurfaceContractEntry["plugin"];

const bundledChannelSurfaceMatrix: Record<string, readonly ChannelPluginSurface[]> = {
  bluebubbles: ["actions", "setup", "status", "outbound", "messaging", "threading", "gateway"],
  discord: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  feishu: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  googlechat: ["setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  imessage: ["actions", "setup", "status", "outbound", "messaging", "threading", "gateway"],
  irc: ["setup", "status", "outbound", "messaging", "directory", "gateway"],
  line: ["actions", "setup", "status", "outbound", "messaging", "directory", "gateway"],
  matrix: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  mattermost: ["actions", "setup", "status", "outbound", "messaging", "directory", "gateway"],
  msteams: ["setup", "status", "outbound", "messaging", "directory", "gateway"],
  "nextcloud-talk": ["setup", "status", "outbound", "messaging", "gateway"],
  nostr: ["setup", "status", "outbound", "messaging", "gateway"],
  "qa-channel": ["setup", "status", "outbound", "messaging", "gateway"],
  qqbot: ["setup", "status", "outbound", "messaging", "gateway"],
  signal: ["actions", "setup", "status", "outbound", "messaging", "gateway"],
  slack: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  "synology-chat": ["actions", "setup", "status", "outbound", "messaging", "directory", "gateway"],
  telegram: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  tlon: ["setup", "status", "outbound", "messaging", "gateway"],
  twitch: ["setup", "status", "outbound", "messaging", "gateway"],
  whatsapp: ["actions", "setup", "status", "outbound", "messaging", "directory", "gateway"],
  zalo: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
  zalouser: ["actions", "setup", "status", "outbound", "messaging", "threading", "directory", "gateway"],
};

const directoryPresenceOnlyIds = new Set(["whatsapp", "zalouser"]);

let surfaceContractRegistryCache: SurfaceContractEntry[] | undefined;
let threadingContractRegistryCache: ThreadingContractEntry[] | undefined;
let directoryContractRegistryCache: DirectoryContractEntry[] | undefined;

function normalizeSurfaceList(surfaces: readonly ChannelPluginSurface[]): ChannelPluginSurface[] {
  const known = new Set(channelPluginSurfaceKeys);
  return [...new Set(surfaces)].filter((surface) => known.has(surface));
}

function createDirectoryEntry(kind: ChannelDirectoryEntry["kind"], id: string): ChannelDirectoryEntry {
  return {
    kind,
    id,
    name: `${id} name`,
    handle: `${id}-handle`,
    rank: 1,
  };
}

function createLightweightPlugin(
  id: string,
  surfaces: readonly ChannelPluginSurface[],
): LightweightSurfacePlugin {
  const plugin: LightweightSurfacePlugin = { id };

  if (surfaces.includes("actions")) {
    plugin.actions = {
      describeMessageTool: () => ({ actions: ["send"], capabilities: [] }),
      supportsAction: ({ action }) => action === "send",
    };
  }

  if (surfaces.includes("setup")) {
    plugin.setup = {
      applyAccountConfig: ({ cfg }) => cfg,
    };
  }

  if (surfaces.includes("status")) {
    plugin.status = {
      buildAccountSnapshot: ({ runtime }) => ({
        accountId: runtime?.accountId ?? "default",
        enabled: true,
        configured: true,
      }),
    };
  }

  if (surfaces.includes("outbound")) {
    plugin.outbound = {
      deliveryMode: "direct",
      sendText: async ({ to }) => ({
        messageId: "test-message",
        to,
        channel: id,
      }),
    };
  }

  if (surfaces.includes("messaging")) {
    plugin.messaging = {
      normalizeTarget: (raw) => raw.trim() || undefined,
    };
  }

  if (surfaces.includes("threading")) {
    plugin.threading = {
      resolveReplyToMode: () => "first",
      buildToolContext: ({ context, hasRepliedRef }) => ({
        currentChannelId: context.NativeChannelId ?? context.Channel,
        currentChannelProvider: id as never,
        currentThreadTs: String(context.MessageThreadId ?? context.ReplyToIdFull ?? "thread-0"),
        currentMessageId: context.CurrentMessageId,
        replyToMode: "first",
        hasRepliedRef,
      }),
      resolveAutoThreadId: ({ toolContext, replyToId }) =>
        String(toolContext?.currentThreadTs ?? replyToId ?? "thread-0"),
      resolveReplyTransport: ({ threadId, replyToId }) => ({
        threadId,
        replyToId,
      }),
      resolveFocusedBinding: ({ context }: { context: ChannelThreadingContext }) => ({
        conversationId: String(context.NativeChannelId ?? context.Channel ?? "conversation-0"),
        parentConversationId: context.MessageThreadId ? String(context.Channel ?? "parent-0") : undefined,
        placement: context.MessageThreadId ? "child" : "current",
        labelNoun: "conversation",
      }),
    };
  }

  if (surfaces.includes("directory")) {
    plugin.directory = {
      self: async () => createDirectoryEntry("user", `${id}:self`),
      listPeers: async () => [createDirectoryEntry("user", `${id}:peer`)],
      listGroups: async () => [createDirectoryEntry("group", `${id}:group`)],
      listGroupMembers: async () => [createDirectoryEntry("user", `${id}:member`)],
    };
  }

  if (surfaces.includes("gateway")) {
    plugin.gateway = {
      startAccount: async () => undefined,
    };
  }

  return plugin;
}

export function getSurfaceContractRegistry(): SurfaceContractEntry[] {
  surfaceContractRegistryCache ??= Object.entries(bundledChannelSurfaceMatrix).map(
    ([id, declaredSurfaces]) => {
      const surfaces = normalizeSurfaceList(declaredSurfaces);
      return {
        id,
        plugin: createLightweightPlugin(id, surfaces),
        surfaces,
      };
    },
  );
  return surfaceContractRegistryCache;
}

export function getThreadingContractRegistry(): ThreadingContractEntry[] {
  threadingContractRegistryCache ??= getSurfaceContractRegistry()
    .filter((entry) => entry.surfaces.includes("threading"))
    .map((entry) => ({
      id: entry.id,
      plugin: entry.plugin,
    }));
  return threadingContractRegistryCache;
}

export function getDirectoryContractRegistry(): DirectoryContractEntry[] {
  directoryContractRegistryCache ??= getSurfaceContractRegistry()
    .filter((entry) => entry.surfaces.includes("directory"))
    .map((entry) => ({
      id: entry.id,
      plugin: entry.plugin,
      coverage: directoryPresenceOnlyIds.has(entry.id) ? "presence" : "lookups",
    }));
  return directoryContractRegistryCache;
}
