import os from "node:os";
import path from "node:path";
import { resolveHomeRelativePath, resolveRequiredHomeDir } from "../infra/home-dir.js";
import type { ZhushouConfig } from "./types.js";

/**
 * Nix mode detection: When ZHUSHOU_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ZHUSHOU_NIX_MODE === "1";
}

export const isNixMode = resolveIsNixMode();

const NEW_STATE_DIRNAME = ".zhushou";
const CONFIG_FILENAME = "zhushou.json";

function resolveDefaultHomeDir(): string {
  return resolveRequiredHomeDir(process.env, os.homedir);
}

/** Build a homedir thunk that respects ZHUSHOU_HOME for the given env. */
function envHomedir(env: NodeJS.ProcessEnv): () => string {
  return () => resolveRequiredHomeDir(env, os.homedir);
}

function newStateDir(homedir: () => string = resolveDefaultHomeDir): string {
  return path.join(homedir(), NEW_STATE_DIRNAME);
}

export function resolveLegacyStateDir(homedir: () => string = resolveDefaultHomeDir): string {
  return newStateDir(homedir);
}

export function resolveLegacyStateDirs(homedir: () => string = resolveDefaultHomeDir): string[] {
  void homedir;
  return [];
}

export function resolveNewStateDir(homedir: () => string = resolveDefaultHomeDir): string {
  return newStateDir(homedir);
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via ZHUSHOU_STATE_DIR.
 * Default: ~/.zhushou
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = env.ZHUSHOU_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, effectiveHomedir);
  }
  return newStateDir(effectiveHomedir);
}

function resolveUserPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  return resolveHomeRelativePath(input, { env, homedir });
}

export const STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON or JSON5).
 * Can be overridden via ZHUSHOU_CONFIG_PATH.
 * Default: ~/.wang301208/zhushou.json (or $ZHUSHOU_STATE_DIR/zhushou.json)
 */
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.ZHUSHOU_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

/**
 * Resolve the active config path by preferring existing config candidates
 * before falling back to the canonical path.
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path (prefers existing config files).
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
  homedir: () => string = envHomedir(env),
): string {
  const override = env.ZHUSHOU_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  void env;
  void homedir;
  return path.join(stateDir, CONFIG_FILENAME);
}

export const CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Resolve default config path candidates across default locations.
 * Order: explicit config path → state-dir-derived paths → new default.
 */
export function resolveDefaultConfigCandidates(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string[] {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const explicit = env.ZHUSHOU_CONFIG_PATH?.trim();
  if (explicit) {
    return [resolveUserPath(explicit, env, effectiveHomedir)];
  }

  const candidates: string[] = [];
  const zhushouStateDir = env.ZHUSHOU_STATE_DIR?.trim();
  if (zhushouStateDir) {
    const resolved = resolveUserPath(zhushouStateDir, env, effectiveHomedir);
    candidates.push(path.join(resolved, CONFIG_FILENAME));
  }

  candidates.push(path.join(newStateDir(effectiveHomedir), CONFIG_FILENAME));
  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 3000;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/zhushou-<uid> (uid suffix when available).
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `zhushou-${uid}` : "zhushou";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 *
 * Precedence:
 * - `ZHUSHOU_OAUTH_DIR` (explicit override)
 * - `$*_STATE_DIR/credentials` (canonical server/default)
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.ZHUSHOU_OAUTH_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

function parseGatewayPortEnvValue(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  // Docker Compose publish strings can leak into host CLI env loading via repo `.env`,
  // for example `127.0.0.1:18789` or `[::1]:18789`. Accept only explicit host:port forms.
  const bracketedIpv6Match = trimmed.match(/^\[[^\]]+\]:(\d+)$/);
  if (bracketedIpv6Match?.[1]) {
    const parsed = Number.parseInt(bracketedIpv6Match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const firstColon = trimmed.indexOf(":");
  const lastColon = trimmed.lastIndexOf(":");
  if (firstColon <= 0 || firstColon !== lastColon) {
    return null;
  }
  const suffix = trimmed.slice(firstColon + 1);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveGatewayPort(
  cfg?: ZhushouConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw = env.ZHUSHOU_GATEWAY_PORT?.trim();
  const envPort = parseGatewayPortEnvValue(envRaw);
  if (envPort !== null) {
    return envPort;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) {
      return configPort;
    }
  }
  return DEFAULT_GATEWAY_PORT;
}
