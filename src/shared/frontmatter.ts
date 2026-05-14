import JSON5 from "json5";
import { MANIFEST_KEY } from "../project-name.js";
import { parseBooleanValue } from "../utils/boolean.js";
import { normalizeOptionalLowercaseString, readStringValue } from "./string-coerce.js";
import { normalizeCsvOrLooseStringList } from "./string-normalization.js";

export function normalizeStringList(input: unknown): string[] {
  return normalizeCsvOrLooseStringList(input);
}

export function getFrontmatterString(
  frontmatter: Record<string, unknown>,
  key: string,
): string | undefined {
  return readStringValue(frontmatter[key]);
}

export function parseFrontmatterBool(value: string | undefined, fallback: boolean): boolean {
  const parsed = parseBooleanValue(value);
  return parsed === undefined ? fallback : parsed;
}

export function resolveZhushouManifestBlock(params: {
  frontmatter: Record<string, unknown>;
  key?: string;
}): Record<string, unknown> | undefined {
  const raw = getFrontmatterString(params.frontmatter, params.key ?? "metadata");
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON5.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const candidate = (parsed as Record<string, unknown>)[MANIFEST_KEY];
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export type ZhushouManifestRequires = {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
};

export function resolveZhushouManifestRequires(
  metadataObj: Record<string, unknown>,
): ZhushouManifestRequires | undefined {
  const requiresRaw =
    typeof metadataObj.requires === "object" && metadataObj.requires !== null
      ? (metadataObj.requires as Record<string, unknown>)
      : undefined;
  if (!requiresRaw) {
    return undefined;
  }
  return {
    bins: normalizeStringList(requiresRaw.bins),
    anyBins: normalizeStringList(requiresRaw.anyBins),
    env: normalizeStringList(requiresRaw.env),
    config: normalizeStringList(requiresRaw.config),
  };
}

export function resolveZhushouManifestInstall<T>(
  metadataObj: Record<string, unknown>,
  parseInstallSpec: (input: unknown) => T | undefined,
): T[] {
  const installRaw = Array.isArray(metadataObj.install) ? (metadataObj.install as unknown[]) : [];
  return installRaw
    .map((entry) => parseInstallSpec(entry))
    .filter((entry): entry is T => Boolean(entry));
}

export function resolveZhushouManifestOs(metadataObj: Record<string, unknown>): string[] {
  return normalizeStringList(metadataObj.os);
}

export type ParsedZhushouManifestInstallBase = {
  raw: Record<string, unknown>;
  kind: string;
  id?: string;
  label?: string;
  bins?: string[];
};

export function parseZhushouManifestInstallBase(
  input: unknown,
  allowedKinds: readonly string[],
): ParsedZhushouManifestInstallBase | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const raw = input as Record<string, unknown>;
  const kindRaw =
    typeof raw.kind === "string" ? raw.kind : typeof raw.type === "string" ? raw.type : "";
  const kind = normalizeOptionalLowercaseString(kindRaw) ?? "";
  if (!allowedKinds.includes(kind)) {
    return undefined;
  }

  const spec: ParsedZhushouManifestInstallBase = {
    raw,
    kind,
  };
  if (typeof raw.id === "string") {
    spec.id = raw.id;
  }
  if (typeof raw.label === "string") {
    spec.label = raw.label;
  }
  const bins = normalizeStringList(raw.bins);
  if (bins.length > 0) {
    spec.bins = bins;
  }
  return spec;
}

export function applyZhushouManifestInstallCommonFields<
  T extends { id?: string; label?: string; bins?: string[] },
>(spec: T, parsed: Pick<ParsedZhushouManifestInstallBase, "id" | "label" | "bins">): T {
  if (parsed.id) {
    spec.id = parsed.id;
  }
  if (parsed.label) {
    spec.label = parsed.label;
  }
  if (parsed.bins) {
    spec.bins = parsed.bins;
  }
  return spec;
}
