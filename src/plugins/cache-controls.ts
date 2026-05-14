import { normalizeOptionalString } from "../shared/string-coerce.js";

export const DEFAULT_PLUGIN_DISCOVERY_CACHE_MS = 1000;
export const DEFAULT_PLUGIN_MANIFEST_CACHE_MS = 1000;

export function shouldUsePluginSnapshotCache(env: NodeJS.ProcessEnv): boolean {
  if (normalizeOptionalString(env.ZHUSHOU_DISABLE_PLUGIN_DISCOVERY_CACHE)) {
    return false;
  }
  if (normalizeOptionalString(env.ZHUSHOU_DISABLE_PLUGIN_MANIFEST_CACHE)) {
    return false;
  }
  const discoveryCacheMs = normalizeOptionalString(env.ZHUSHOU_PLUGIN_DISCOVERY_CACHE_MS);
  if (discoveryCacheMs === "0") {
    return false;
  }
  const manifestCacheMs = normalizeOptionalString(env.ZHUSHOU_PLUGIN_MANIFEST_CACHE_MS);
  if (manifestCacheMs === "0") {
    return false;
  }
  return true;
}

export function resolvePluginCacheMs(rawValue: string | undefined, defaultMs: number): number {
  const raw = normalizeOptionalString(rawValue);
  if (raw === "" || raw === "0") {
    return 0;
  }
  if (!raw) {
    return defaultMs;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return defaultMs;
  }
  return Math.max(0, parsed);
}

export function resolvePluginSnapshotCacheTtlMs(env: NodeJS.ProcessEnv): number {
  const discoveryCacheMs = resolvePluginCacheMs(
    env.ZHUSHOU_PLUGIN_DISCOVERY_CACHE_MS,
    DEFAULT_PLUGIN_DISCOVERY_CACHE_MS,
  );
  const manifestCacheMs = resolvePluginCacheMs(
    env.ZHUSHOU_PLUGIN_MANIFEST_CACHE_MS,
    DEFAULT_PLUGIN_MANIFEST_CACHE_MS,
  );
  return Math.min(discoveryCacheMs, manifestCacheMs);
}

export function buildPluginSnapshotCacheEnvKey(env: NodeJS.ProcessEnv): string {
  return JSON.stringify({
    ZHUSHOU_BUNDLED_PLUGINS_DIR: env.ZHUSHOU_BUNDLED_PLUGINS_DIR ?? "",
    ZHUSHOU_DISABLE_PLUGIN_DISCOVERY_CACHE: env.ZHUSHOU_DISABLE_PLUGIN_DISCOVERY_CACHE ?? "",
    ZHUSHOU_DISABLE_PLUGIN_MANIFEST_CACHE: env.ZHUSHOU_DISABLE_PLUGIN_MANIFEST_CACHE ?? "",
    ZHUSHOU_PLUGIN_DISCOVERY_CACHE_MS: env.ZHUSHOU_PLUGIN_DISCOVERY_CACHE_MS ?? "",
    ZHUSHOU_PLUGIN_MANIFEST_CACHE_MS: env.ZHUSHOU_PLUGIN_MANIFEST_CACHE_MS ?? "",
    ZHUSHOU_HOME: env.ZHUSHOU_HOME ?? "",
    ZHUSHOU_STATE_DIR: env.ZHUSHOU_STATE_DIR ?? "",
    ZHUSHOU_CONFIG_PATH: env.ZHUSHOU_CONFIG_PATH ?? "",
    HOME: env.HOME ?? "",
    USERPROFILE: env.USERPROFILE ?? "",
    VITEST: env.VITEST ?? "",
  });
}
