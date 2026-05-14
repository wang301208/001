import { createHash } from "node:crypto";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { resolveUserPath } from "../../utils.js";
import { resolveZhushouAgentDir } from "../agent-paths.js";
import {
  AUTH_PROFILE_FILENAME,
  AUTH_STATE_FILENAME,
  LEGACY_AUTH_FILENAME,
} from "./path-constants.js";

export function resolveAuthStorePath(agentDir?: string): string {
  const resolved = resolveUserPath(agentDir ?? resolveZhushouAgentDir());
  return path.join(resolved, AUTH_PROFILE_FILENAME);
}

export function resolveLegacyAuthStorePath(agentDir?: string): string {
  const resolved = resolveUserPath(agentDir ?? resolveZhushouAgentDir());
  return path.join(resolved, LEGACY_AUTH_FILENAME);
}

export function resolveAuthStatePath(agentDir?: string): string {
  const resolved = resolveUserPath(agentDir ?? resolveZhushouAgentDir());
  return path.join(resolved, AUTH_STATE_FILENAME);
}

export function resolveAuthStorePathForDisplay(agentDir?: string): string {
  const pathname = resolveAuthStorePath(agentDir);
  return pathname.startsWith("~") ? pathname : resolveUserPath(pathname);
}

export function resolveAuthStatePathForDisplay(agentDir?: string): string {
  const pathname = resolveAuthStatePath(agentDir);
  return pathname.startsWith("~") ? pathname : resolveUserPath(pathname);
}

/**
 * 解析跨 Agent、每配置文件 OAuth 刷新协调锁的路径。
 * 文件名对 `provider\0profileId` 进行哈希，使其对任意
 * unicode/控制字符输入文件系统安全，且长度始终有界。
 * NUL 分隔符使得两个不同的 `(provider, profileId)` 对
 * 不可能通过字符串拼接发生碰撞。
 *
 * 此锁是防止当 N 个 Agent 共享一个 OAuth 配置文件时
 * 出现 `refresh_token_reused` 风暴的序列化点
 *（参见 issue #26322）：每个尝试刷新的 Agent
 * 获取此文件锁，因此同一时间只有一个 HTTP 刷新在飞行中，
 * 同伴可以采用产生的新鲜凭据，而非与一次性刷新令牌竞争。
 *
 * 键故意包含 `provider`，使得两个恰好在不同提供者之间
 * 共享 `profileId` 的配置文件（操作员重命名的配置文件、
 * 测试固件等）不会不必要地互相序列化。
 */
export function resolveOAuthRefreshLockPath(provider: string, profileId: string): string {
  const hash = createHash("sha256");
  hash.update(provider, "utf8");
  hash.update("\u0000", "utf8"); // NUL 分隔符：无歧义边界。
  hash.update(profileId, "utf8");
  const safeId = `sha256-${hash.digest("hex")}`;
  return path.join(resolveStateDir(), "locks", "oauth-refresh", safeId);
}
