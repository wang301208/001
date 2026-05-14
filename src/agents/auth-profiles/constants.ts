import { createSubsystemLogger } from "../../logging/subsystem.js";
export {
  AUTH_PROFILE_FILENAME,
  AUTH_STATE_FILENAME,
  LEGACY_AUTH_FILENAME,
} from "./path-constants.js";

export const AUTH_STORE_VERSION = 1;

export const CLAUDE_CLI_PROFILE_ID = "anthropic:claude-cli";
export const CODEX_CLI_PROFILE_ID = "openai-codex:codex-cli";
export const OPENAI_CODEX_DEFAULT_PROFILE_ID = "openai-codex:default";
export const MINIMAX_CLI_PROFILE_ID = "minimax-portal:minimax-cli";

export const AUTH_STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 30_000,
} as const;

// 与 AUTH_STORE_LOCK_OPTIONS 分离，以便独立调优：此锁
// 序列化跨 Agent 的 OAuth 刷新（参见 issue #26322），而
// AUTH_STORE_LOCK_OPTIONS 保护逐存储文件写入。保持它们
// 分离使我们可以在不影响热路径 auth-store 写入器的
// 情况下扩大刷新锁的超时/重试预算。
//
// 不变量：OAUTH_REFRESH_CALL_TIMEOUT_MS < OAUTH_REFRESH_LOCK_OPTIONS.stale
// 以确保合法刷新的临界区始终在同伴将锁视为可回收之前完成。
// 违反此不变量会重新引入此锁旨在防止的
// `refresh_token_reused` 竞争条件。
export const OAUTH_REFRESH_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 180_000,
} as const;

// 单次 OAuth 刷新调用（插件钩子 + HTTP 令牌交换）的硬上限。
// 超过此时长的刷新将被中止并报告为刷新失败。
// 严格保持小于 OAUTH_REFRESH_LOCK_OPTIONS.stale，以确保当持有者
// 仍在执行合法工作时，锁不会被等待者视为过期。
export const OAUTH_REFRESH_CALL_TIMEOUT_MS = 120_000;

export const EXTERNAL_CLI_SYNC_TTL_MS = 15 * 60 * 1000;
export const EXTERNAL_CLI_NEAR_EXPIRY_MS = 10 * 60 * 1000;

export const log = createSubsystemLogger("agents/auth-profiles");
