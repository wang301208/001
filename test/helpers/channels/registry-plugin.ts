import fs from "node:fs";
import path from "node:path";
import type { ChannelPlugin } from "../../../src/channels/plugins/types.js";

type PluginContractEntry = {
  id: string;
  plugin: Pick<ChannelPlugin, "id" | "meta" | "capabilities" | "config">;
};

type ChannelPackageMetadata = {
  zhushou?: {
    channel?: {
      id?: string;
      label?: string;
      selectionLabel?: string;
      docsPath?: string;
      blurb?: string;
    };
  };
};

type ChannelManifest = {
  id?: string;
  channels?: string[];
};

let pluginContractRegistryCache: PluginContractEntry[] | undefined;

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function normalizeLabel(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function createLightweightPluginContractEntry(params: {
  id: string;
  packageDir: string;
}): PluginContractEntry {
  const pkg = readJsonFile<ChannelPackageMetadata>(path.join(params.packageDir, "package.json"));
  const channel = pkg?.zhushou?.channel ?? {};
  const label = channel.label?.trim() || normalizeLabel(params.id);
  const selectionLabel = channel.selectionLabel?.trim() || label;
  const docsPath = channel.docsPath?.trim() || `/channels/${params.id}`;
  const blurb = channel.blurb?.trim() || `${label} channel plugin.`;

  return {
    id: params.id,
    plugin: {
      id: params.id as never,
      meta: {
        id: params.id as never,
        label,
        selectionLabel,
        docsPath,
        blurb,
      },
      capabilities: {
        chatTypes: ["direct"],
      },
      config: {
        listAccountIds: () => ["default"],
        resolveAccount: (_cfg, accountId) => ({
          accountId: accountId?.trim() || "default",
        }),
      },
    },
  };
}

export function getPluginContractRegistry(): PluginContractEntry[] {
  pluginContractRegistryCache ??= fs
    .readdirSync("extensions", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packageDir = path.join("extensions", entry.name);
      const manifest = readJsonFile<ChannelManifest>(path.join(packageDir, "zhushou.plugin.json"));
      const id = manifest?.id?.trim();
      const channels = manifest?.channels;
      if (!id || !channels?.length) {
        return undefined;
      }
      return createLightweightPluginContractEntry({ id, packageDir });
    })
    .filter((entry): entry is PluginContractEntry => Boolean(entry))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return pluginContractRegistryCache;
}
