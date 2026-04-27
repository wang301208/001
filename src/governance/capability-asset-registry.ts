import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { normalizeAgentId } from "../routing/session-key.js";
import { isRecord } from "../utils.js";
import type {
  GovernanceCapabilityInventoryEntry,
  GovernanceCapabilityInventoryEntryActivation,
  GovernanceCapabilityInventoryEntryKind,
  GovernanceCapabilityInventoryEntryStatus,
} from "./capability-registry.js";

export const CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH = "capability/asset-registry.yaml";
const CAPABILITY_ASSET_REGISTRY_ID = "capability_asset_registry";
const CAPABILITY_ASSET_REGISTRY_TITLE = "Governed Capability Asset Registry";

type GovernanceCapabilityAssetKind = Extract<
  GovernanceCapabilityInventoryEntryKind,
  "skill" | "plugin" | "memory" | "strategy" | "algorithm"
>;

export type GovernanceCapabilityAssetRecord = {
  id: string;
  kind: GovernanceCapabilityAssetKind;
  status: GovernanceCapabilityInventoryEntryStatus;
  title: string;
  description?: string;
  layer?: string;
  ownerAgentId?: string;
  sourcePath?: string;
  workspaceDir?: string;
  origin?: string;
  activation?: GovernanceCapabilityInventoryEntryActivation;
  coverage: string[];
  dependencies: string[];
  issues: string[];
  installOptions: string[];
};

export type GovernanceCapabilityAssetRegistryFile = {
  version: 1;
  registry: {
    id: typeof CAPABILITY_ASSET_REGISTRY_ID;
    title: typeof CAPABILITY_ASSET_REGISTRY_TITLE;
    status: "active";
    observedAt: number;
  };
  assets: GovernanceCapabilityAssetRecord[];
};

export type GovernanceCapabilityAssetRegistrySnapshot = {
  charterDir: string;
  relativePath: typeof CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH;
  filePath: string;
  exists: boolean;
  parseError?: string;
  registry?: GovernanceCapabilityAssetRegistryFile;
};

export type GovernanceCapabilityAssetRegistrySyncResult = {
  snapshot: GovernanceCapabilityAssetRegistrySnapshot;
  desiredRegistry: GovernanceCapabilityAssetRegistryFile;
  assetCount: number;
  missingAssetIds: string[];
  staleAssetIds: string[];
  driftedAssetIds: string[];
  hasChanges: boolean;
};

function collectUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function sortAssetRecords(
  left: GovernanceCapabilityAssetRecord,
  right: GovernanceCapabilityAssetRecord,
): number {
  const kindDelta = left.kind.localeCompare(right.kind);
  if (kindDelta !== 0) {
    return kindDelta;
  }
  return left.id.localeCompare(right.id);
}

function cloneActivation(
  value: GovernanceCapabilityInventoryEntryActivation | undefined,
): GovernanceCapabilityInventoryEntryActivation | undefined {
  if (!value) {
    return undefined;
  }
  return {
    enabled: value.enabled,
    activated: value.activated,
    explicitlyEnabled: value.explicitlyEnabled,
    source: value.source,
    ...(value.reason ? { reason: value.reason } : {}),
  };
}

function normalizeAssetRecord(
  asset: GovernanceCapabilityAssetRecord,
): GovernanceCapabilityAssetRecord {
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    title: asset.title,
    ...(asset.description ? { description: asset.description } : {}),
    ...(asset.layer ? { layer: asset.layer } : {}),
    ...(asset.ownerAgentId ? { ownerAgentId: normalizeAgentId(asset.ownerAgentId) } : {}),
    ...(asset.sourcePath ? { sourcePath: asset.sourcePath } : {}),
    ...(asset.workspaceDir ? { workspaceDir: asset.workspaceDir } : {}),
    ...(asset.origin ? { origin: asset.origin } : {}),
    ...(asset.activation ? { activation: cloneActivation(asset.activation) } : {}),
    coverage: collectUniqueStrings(asset.coverage),
    dependencies: collectUniqueStrings(asset.dependencies),
    issues: collectUniqueStrings(asset.issues),
    installOptions: collectUniqueStrings(asset.installOptions),
  };
}

function normalizeAssetEntryFromInventory(
  entry: GovernanceCapabilityInventoryEntry,
): GovernanceCapabilityAssetRecord | undefined {
  if (
    entry.kind !== "skill" &&
    entry.kind !== "plugin" &&
    entry.kind !== "memory" &&
    entry.kind !== "strategy" &&
    entry.kind !== "algorithm"
  ) {
    return undefined;
  }
  return normalizeAssetRecord({
    id: entry.id,
    kind: entry.kind,
    status: entry.status,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.layer ? { layer: entry.layer } : {}),
    ...(entry.ownerAgentId ? { ownerAgentId: entry.ownerAgentId } : {}),
    ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
    ...(entry.workspaceDir ? { workspaceDir: entry.workspaceDir } : {}),
    ...(entry.origin ? { origin: entry.origin } : {}),
    ...(entry.activation ? { activation: entry.activation } : {}),
    coverage: entry.coverage,
    dependencies: entry.dependencies,
    issues: entry.issues,
    installOptions: entry.installOptions,
  });
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return collectUniqueStrings(
    value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean),
  );
}

function parseActivation(
  value: unknown,
  label: string,
): GovernanceCapabilityInventoryEntryActivation | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  if (
    typeof value.enabled !== "boolean" ||
    typeof value.activated !== "boolean" ||
    typeof value.explicitlyEnabled !== "boolean"
  ) {
    throw new Error(`${label} is missing boolean activation fields.`);
  }
  if (
    value.source !== "disabled" &&
    value.source !== "explicit" &&
    value.source !== "auto" &&
    value.source !== "default"
  ) {
    throw new Error(`${label}.source is invalid.`);
  }
  return {
    enabled: value.enabled,
    activated: value.activated,
    explicitlyEnabled: value.explicitlyEnabled,
    source: value.source,
    ...(typeof value.reason === "string" && value.reason.trim()
      ? { reason: value.reason.trim() }
      : {}),
  };
}

function parseAssetRecord(value: unknown, index: number): GovernanceCapabilityAssetRecord {
  if (!isRecord(value)) {
    throw new Error(`assets[${index}] must be an object.`);
  }
  if (typeof value.id !== "string" || !value.id.trim()) {
    throw new Error(`assets[${index}].id required.`);
  }
  if (
    value.kind !== "skill" &&
    value.kind !== "plugin" &&
    value.kind !== "memory" &&
    value.kind !== "strategy" &&
    value.kind !== "algorithm"
  ) {
    throw new Error(
      `assets[${index}].kind must be "skill", "plugin", "memory", "strategy", or "algorithm".`,
    );
  }
  if (value.status !== "ready" && value.status !== "attention" && value.status !== "blocked") {
    throw new Error(`assets[${index}].status is invalid.`);
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error(`assets[${index}].title required.`);
  }
  return normalizeAssetRecord({
    id: value.id.trim(),
    kind: value.kind,
    status: value.status,
    title: value.title.trim(),
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim() }
      : {}),
    ...(typeof value.layer === "string" && value.layer.trim() ? { layer: value.layer.trim() } : {}),
    ...(typeof value.ownerAgentId === "string" && value.ownerAgentId.trim()
      ? { ownerAgentId: value.ownerAgentId.trim() }
      : {}),
    ...(typeof value.sourcePath === "string" && value.sourcePath.trim()
      ? { sourcePath: value.sourcePath.trim() }
      : {}),
    ...(typeof value.workspaceDir === "string" && value.workspaceDir.trim()
      ? { workspaceDir: value.workspaceDir.trim() }
      : {}),
    ...(typeof value.origin === "string" && value.origin.trim()
      ? { origin: value.origin.trim() }
      : {}),
    ...(parseActivation(value.activation, `assets[${index}].activation`)
      ? { activation: parseActivation(value.activation, `assets[${index}].activation`) }
      : {}),
    coverage: parseStringArray(value.coverage ?? [], `assets[${index}].coverage`),
    dependencies: parseStringArray(value.dependencies ?? [], `assets[${index}].dependencies`),
    issues: parseStringArray(value.issues ?? [], `assets[${index}].issues`),
    installOptions: parseStringArray(
      value.installOptions ?? [],
      `assets[${index}].installOptions`,
    ),
  });
}

function parseRegistryFile(value: unknown, filePath: string): GovernanceCapabilityAssetRegistryFile {
  if (!isRecord(value)) {
    throw new Error(`Capability asset registry in ${filePath} must be an object.`);
  }
  if (value.version !== 1) {
    throw new Error(`Capability asset registry in ${filePath} must use version 1.`);
  }
  if (!isRecord(value.registry)) {
    throw new Error(`Capability asset registry metadata missing in ${filePath}.`);
  }
  if (value.registry.id !== CAPABILITY_ASSET_REGISTRY_ID) {
    throw new Error(`Capability asset registry id mismatch in ${filePath}.`);
  }
  const observedAt =
    typeof value.registry.observedAt === "number" && Number.isFinite(value.registry.observedAt)
      ? value.registry.observedAt
      : 0;
  const assets = Array.isArray(value.assets)
    ? value.assets.map((entry, index) => parseAssetRecord(entry, index)).toSorted(sortAssetRecords)
    : [];
  return {
    version: 1,
    registry: {
      id: CAPABILITY_ASSET_REGISTRY_ID,
      title: CAPABILITY_ASSET_REGISTRY_TITLE,
      status: "active",
      observedAt,
    },
    assets,
  };
}

function assetRecordSignature(asset: GovernanceCapabilityAssetRecord): string {
  return JSON.stringify(normalizeAssetRecord(asset));
}

export function resolveGovernanceCapabilityAssetRegistryFilePath(charterDir: string): string {
  return path.join(charterDir, ...CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH.split("/"));
}

export function buildGovernanceCapabilityAssetRegistry(params: {
  observedAt: number;
  entries: GovernanceCapabilityInventoryEntry[];
}): GovernanceCapabilityAssetRegistryFile {
  const assets = params.entries
    .map((entry) => normalizeAssetEntryFromInventory(entry))
    .filter((entry): entry is GovernanceCapabilityAssetRecord => Boolean(entry))
    .toSorted(sortAssetRecords);
  return {
    version: 1,
    registry: {
      id: CAPABILITY_ASSET_REGISTRY_ID,
      title: CAPABILITY_ASSET_REGISTRY_TITLE,
      status: "active",
      observedAt: params.observedAt,
    },
    assets,
  };
}

export function loadGovernanceCapabilityAssetRegistrySnapshot(params: {
  charterDir: string;
}): GovernanceCapabilityAssetRegistrySnapshot {
  const filePath = resolveGovernanceCapabilityAssetRegistryFilePath(params.charterDir);
  if (!fs.existsSync(filePath)) {
    return {
      charterDir: params.charterDir,
      relativePath: CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH,
      filePath,
      exists: false,
    };
  }
  try {
    const parsed = YAML.parse(fs.readFileSync(filePath, "utf8"));
    return {
      charterDir: params.charterDir,
      relativePath: CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH,
      filePath,
      exists: true,
      registry: parseRegistryFile(parsed, filePath),
    };
  } catch (error) {
    return {
      charterDir: params.charterDir,
      relativePath: CAPABILITY_ASSET_REGISTRY_RELATIVE_PATH,
      filePath,
      exists: true,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function planGovernanceCapabilityAssetRegistrySync(params: {
  charterDir: string;
  observedAt: number;
  entries: GovernanceCapabilityInventoryEntry[];
}): GovernanceCapabilityAssetRegistrySyncResult {
  const snapshot = loadGovernanceCapabilityAssetRegistrySnapshot({
    charterDir: params.charterDir,
  });
  const desiredRegistry = buildGovernanceCapabilityAssetRegistry({
    observedAt: params.observedAt,
    entries: params.entries,
  });
  const currentAssets = snapshot.registry?.assets ?? [];
  const currentById = new Map(currentAssets.map((entry) => [entry.id, entry]));
  const desiredById = new Map(desiredRegistry.assets.map((entry) => [entry.id, entry]));
  const missingAssetIds = desiredRegistry.assets
    .filter((entry) => !currentById.has(entry.id))
    .map((entry) => entry.id);
  const staleAssetIds = currentAssets
    .filter((entry) => !desiredById.has(entry.id))
    .map((entry) => entry.id);
  const driftedAssetIds = desiredRegistry.assets
    .filter((entry) => {
      const current = currentById.get(entry.id);
      return current ? assetRecordSignature(current) !== assetRecordSignature(entry) : false;
    })
    .map((entry) => entry.id);
  const hasChanges =
    Boolean(snapshot.parseError) ||
    (!snapshot.exists && desiredRegistry.assets.length > 0) ||
    missingAssetIds.length > 0 ||
    staleAssetIds.length > 0 ||
    driftedAssetIds.length > 0;
  return {
    snapshot,
    desiredRegistry,
    assetCount: desiredRegistry.assets.length,
    missingAssetIds,
    staleAssetIds,
    driftedAssetIds,
    hasChanges,
  };
}
