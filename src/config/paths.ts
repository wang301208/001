import os from "node:os";
import path from "node:path";
import { resolveHomeRelativePath, resolveRequiredHomeDir } from "../infra/home-dir.js";
import type { ZhushouConfig } from "./types.js";

/**
 * Nix 模式检测：当 ZHUSHOU_NIX_MODE=1 时，网关运行在 Nix 环境下。
 * 在此模式下：
 * - 不应尝试自动安装流程
 * - 缺失依赖应产生可操作的 Nix 专用错误消息
 * - 配置由外部管理（从 Nix 视角为只读）
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

/** 构建一个尊重 ZHUSHOU_HOME 环境变量的 homedir 延迟求值函数。 */
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
 * 可变数据（会话、日志、缓存）的状态目录。
 * 可通过 ZHUSHOU_STATE_DIR 覆盖。
 * 默认：~/.zhushou
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
 * 配置文件路径（JSON 或 JSON5）。
 * 可通过 ZHUSHOU_CONFIG_PATH 覆盖。
 * 默认：~/.wang301208/zhushou.json（或 $ZHUSHOU_STATE_DIR/zhushou.json）
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
 * 解析活跃配置路径，优先选择已存在的配置候选项，
 * 然后回退到规范路径。
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * 活跃配置路径（优先选择已存在的配置文件）。
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
 * 解析默认配置路径候选项，跨默认位置搜索。
 * 顺序：显式配置路径 → 状态目录派生路径 → 新默认值。
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
 * 网关锁目录（临时性）。
 * 默认：os.tmpdir()/zhushou-<uid>（可用时附加 uid 后缀）。
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `zhushou-${uid}` : "zhushou";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth 凭据存储目录。
 *
 * 优先级：
 * - `ZHUSHOU_OAUTH_DIR`（显式覆盖）
 * - `$*_STATE_DIR/credentials`（规范服务器/默认）
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

  // Docker Compose publish 字符串可能通过仓库 `.env` 文件泄漏到宿主 CLI 环境变量加载中，
  // 例如 `127.0.0.1:18789` 或 `[::1]:18789`。仅接受显式的 host:port 形式。
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
