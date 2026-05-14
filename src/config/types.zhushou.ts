import type { AcpConfig } from "./types.acp.js";
import type { AgentBinding, AgentsConfig } from "./types.agents.js";
import type { ApprovalsConfig } from "./types.approvals.js";
import type { AuthConfig } from "./types.auth.js";
import type { DiagnosticsConfig, LoggingConfig, SessionConfig, WebConfig } from "./types.base.js";
import type { BrowserConfig } from "./types.browser.js";
import type { ChannelsConfig } from "./types.channels.js";
import type { CliConfig } from "./types.cli.js";
import type { CronConfig } from "./types.cron.js";
import type {
  CanvasHostConfig,
  DiscoveryConfig,
  GatewayConfig,
  TalkConfig,
} from "./types.gateway.js";
import type { HooksConfig } from "./types.hooks.js";
import type { McpConfig } from "./types.mcp.js";
import type { MemoryConfig } from "./types.memory.js";
import type {
  AudioConfig,
  BroadcastConfig,
  CommandsConfig,
  MessagesConfig,
} from "./types.messages.js";
import type { ModelsConfig } from "./types.models.js";
import type { NodeHostConfig } from "./types.node-host.js";
import type { PluginsConfig } from "./types.plugins.js";
import type { SecretsConfig } from "./types.secrets.js";
import type { SkillsConfig } from "./types.skills.js";
import type { ToolsConfig } from "./types.tools.js";

export type ZhushouConfig = {
  meta?: {
    /** 上次写入此配置的助手版本。 */
    lastTouchedVersion?: string;
    /** 此配置上次被写入的 ISO 时间戳。 */
    lastTouchedAt?: string;
  };
  auth?: AuthConfig;
  acp?: AcpConfig;
  env?: {
    /** 可选：从登录 shell 环境导入缺失的密钥（执行 `$SHELL -l -c 'env -0'`）。 */
    shellEnv?: {
      enabled?: boolean;
      /** 登录 shell 执行超时（毫秒）。默认：15000。 */
      timeoutMs?: number;
    };
    /** 内联环境变量，仅在进程环境中尚未存在时应用。 */
    vars?: Record<string, string>;
    /** 语法糖：允许在 env 下直接放置环境变量（仅限字符串值）。 */
    [key: string]:
      | string
      | Record<string, string>
      | { enabled?: boolean; timeoutMs?: number }
      | undefined;
  };
  wizard?: {
    lastRunAt?: string;
    lastRunVersion?: string;
    lastRunCommit?: string;
    lastRunCommand?: string;
    lastRunMode?: "local" | "remote";
  };
  diagnostics?: DiagnosticsConfig;
  logging?: LoggingConfig;
  cli?: CliConfig;
  update?: {
    /** 更新通道，适用于 git + npm 安装（"stable"、"beta" 或 "dev"）。 */
    channel?: "stable" | "beta" | "dev";
    /** 网关启动时检查更新（仅 npm 安装）。 */
    checkOnStart?: boolean;
    /** 核心自动更新策略，适用于包安装。 */
    auto?: {
      /** 启用后台自动更新检查和应用逻辑。默认：false。 */
      enabled?: boolean;
      /** 稳定通道自动应用前的最小延迟。默认：6。 */
      stableDelayHours?: number;
      /** 稳定通道额外的抖动窗口。默认：12。 */
      stableJitterHours?: number;
      /** Beta 通道检查间隔。默认：1 小时。 */
      betaCheckIntervalHours?: number;
    };
  };
  browser?: BrowserConfig;
  ui?: {
    /** 助手 UI 装饰的强调色（十六进制）。 */
    seamColor?: string;
    zhushou?: {
      /** 助手在 UI 界面上的显示名称。 */
      name?: string;
      /** 助手头像（emoji、短文本或图片 URL/data URI）。 */
      avatar?: string;
    };
  };
  secrets?: SecretsConfig;
  skills?: SkillsConfig;
  plugins?: PluginsConfig;
  models?: ModelsConfig;
  nodeHost?: NodeHostConfig;
  agents?: AgentsConfig;
  tools?: ToolsConfig;
  bindings?: AgentBinding[];
  broadcast?: BroadcastConfig;
  audio?: AudioConfig;
  media?: {
    /** 存储入站媒体时保留原始上传文件名。 */
    preserveFilenames?: boolean;
    /** 持久化入站媒体清理的可选保留窗口。 */
    ttlHours?: number;
  };
  messages?: MessagesConfig;
  commands?: CommandsConfig;
  approvals?: ApprovalsConfig;
  session?: SessionConfig;
  web?: WebConfig;
  channels?: ChannelsConfig;
  cron?: CronConfig;
  hooks?: HooksConfig;
  discovery?: DiscoveryConfig;
  canvasHost?: CanvasHostConfig;
  talk?: TalkConfig;
  gateway?: GatewayConfig;
  memory?: MemoryConfig;
  mcp?: McpConfig;
};

declare const zhushouConfigStateBrand: unique symbol;

type BrandedConfigState<TState extends string> = ZhushouConfig & {
  readonly [zhushouConfigStateBrand]?: TState;
};

export type SourceConfig = BrandedConfigState<"source">;
export type ResolvedSourceConfig = BrandedConfigState<"resolved-source">;
export type RuntimeConfig = BrandedConfigState<"runtime">;

export type ConfigValidationIssue = {
  path: string;
  message: string;
  allowedValues?: string[];
  allowedValuesHiddenCount?: number;
};

export type LegacyConfigIssue = {
  path: string;
  message: string;
};

export type ConfigFileSnapshot = {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  /**
   * 磁盘上经过 $include 解析和 ${ENV} 替换后的配置，
   * 但尚未应用运行时默认值。
   */
  sourceConfig: ResolvedSourceConfig;
  /**
   * 经过 $include 解析和 ${ENV} 替换后的配置，但尚未应用运行时
   * 默认值。用于 config set/unset 操作，避免将运行时默认值
   * 泄漏到写入的配置文件中。
   */
  resolved: ResolvedSourceConfig;
  valid: boolean;
  /** 进程内读取器使用的运行时形态配置。 */
  runtimeConfig: RuntimeConfig;
  /** @deprecated Prefer runtimeConfig. */
  config: RuntimeConfig;
  hash?: string;
  issues: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  legacyIssues: LegacyConfigIssue[];
};
