import type { ChannelRuntimeSurface } from "zhushou/plugin-sdk/channel-contract";
import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import type { RuntimeEnv } from "zhushou/plugin-sdk/runtime-env";

export type MonitorTelegramOpts = {
  token?: string;
  accountId?: string;
  config?: ZhushouConfig;
  runtime?: RuntimeEnv;
  channelRuntime?: ChannelRuntimeSurface;
  abortSignal?: AbortSignal;
  useWebhook?: boolean;
  webhookPath?: string;
  webhookPort?: number;
  webhookSecret?: string;
  webhookHost?: string;
  proxyFetch?: typeof fetch;
  webhookUrl?: string;
  webhookCertPath?: string;
};

export type TelegramMonitorFn = (opts?: MonitorTelegramOpts) => Promise<void>;
