import type { ZhushouConfig } from "../../config/types.zhushou.js";
import type { SecretRef } from "../../config/types.secrets.js";

export type OAuthProvider = string;
export type ExternalOAuthManager = "codex-cli" | "minimax-cli";

export type OAuthCredentials = {
  access: string;
  refresh: string;
  expires: number;
  provider?: OAuthProvider;
  email?: string;
  enterpriseUrl?: string;
  projectId?: string;
  accountId?: string;
};

export type ApiKeyCredential = {
  type: "api_key";
  provider: string;
  key?: string;
  keyRef?: SecretRef;
  email?: string;
  displayName?: string;
  /** 可选的提供者特定元数据（例如账户 ID、网关 ID）。 */
  metadata?: Record<string, string>;
};

export type TokenCredential = {
  /**
   * 静态 bearer 风格令牌（通常是 OAuth 访问令牌 / PAT）。
   * 不可被助手刷新（与 `type: "oauth"` 不同）。
   */
  type: "token";
  provider: string;
  token?: string;
  tokenRef?: SecretRef;
  /** 可选过期时间戳（自纪元起的毫秒数）。 */
  expires?: number;
  email?: string;
  displayName?: string;
};

export type OAuthCredential = OAuthCredentials & {
  type: "oauth";
  provider: string;
  clientId?: string;
  email?: string;
  displayName?: string;
  /**
   * CLI 管理的 OAuth 条目的兼容性/运行时元数据。
   *
   * 核心路由应优先使用 external-auth 覆盖合约，
   * 而非直接基于此字段分支。持久化存储在较旧的
   * CLI 同步路径仍受支持时可继续携带此字段。
   */
  managedBy?: ExternalOAuthManager;
};

export type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;

export type AuthProfileFailureReason =
  | "auth"
  | "auth_permanent"
  | "format"
  | "overloaded"
  | "rate_limit"
  | "billing"
  | "timeout"
  | "model_not_found"
  | "session_expired"
  | "unknown";

/** 每个配置文件的用法统计，用于轮转和冷却跟踪 */
export type ProfileUsageStats = {
  lastUsed?: number;
  cooldownUntil?: number;
  cooldownReason?: AuthProfileFailureReason;
  cooldownModel?: string;
  disabledUntil?: number;
  disabledReason?: AuthProfileFailureReason;
  errorCount?: number;
  failureCounts?: Partial<Record<AuthProfileFailureReason, number>>;
  lastFailureAt?: number;
};

export type AuthProfileState = {
  /**
   * 可选的每 Agent 首选配置文件顺序覆盖。
   * 允许锁定/覆盖特定 Agent 的认证轮转，
   * 而不更改全局配置。
   */
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  /** 每个配置文件的用法统计，用于轮转轮询 */
  usageStats?: Record<string, ProfileUsageStats>;
};

export type AuthProfileSecretsStore = {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
};

export type AuthProfileStateStore = {
  version: number;
} & AuthProfileState;

export type AuthProfileStore = AuthProfileSecretsStore & AuthProfileState;

export type AuthProfileIdRepairResult = {
  config: ZhushouConfig;
  changes: string[];
  migrated: boolean;
  fromProfileId?: string;
  toProfileId?: string;
};
