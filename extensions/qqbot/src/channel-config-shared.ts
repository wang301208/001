import {
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "assistant/plugin-sdk/channel-plugin-common";
import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
import { hasConfiguredSecretInput } from "assistant/plugin-sdk/secret-input";
import { applyAccountNameToChannelSection } from "assistant/plugin-sdk/setup";
import type { ChannelSetupInput } from "assistant/plugin-sdk/setup";
import {
  DEFAULT_ACCOUNT_ID,
  applyQQBotAccountConfig,
  listQQBotAccountIds,
  resolveDefaultQQBotAccountId,
  resolveQQBotAccount,
} from "./config.js";
import type { ResolvedQQBotAccount } from "./types.js";

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeStringifiedOptionalString(
  value: string | number | null | undefined,
): string | undefined {
  if (value == null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export const qqbotMeta = {
  id: "qqbot",
  label: "QQ Bot",
  selectionLabel: "QQ Bot",
  docsPath: "/channels/qqbot",
  blurb: "Connect to QQ via official QQ Bot API",
  order: 50,
} as const;

function parseQQBotInlineToken(token: string): { appId: string; clientSecret: string } | null {
  const colonIdx = token.indexOf(":");
  if (colonIdx <= 0 || colonIdx === token.length - 1) {
    return null;
  }

  const appId = token.slice(0, colonIdx).trim();
  const clientSecret = token.slice(colonIdx + 1).trim();
  if (!appId || !clientSecret) {
    return null;
  }

  return { appId, clientSecret };
}

export function validateQQBotSetupInput(params: {
  accountId: string;
  input: ChannelSetupInput;
}): string | null {
  const { accountId, input } = params;

  if (!input.token && !input.tokenFile && !input.useEnv) {
    return "QQBot requires --token (format: appId:clientSecret) or --use-env";
  }

  if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
    return "QQBot --use-env only supports the default account";
  }

  if (input.token && !parseQQBotInlineToken(input.token)) {
    return "QQBot --token must be in appId:clientSecret format";
  }

  return null;
}

export function applyQQBotSetupAccountConfig(params: {
  cfg: AssistantConfig;
  accountId: string;
  input: ChannelSetupInput;
}): AssistantConfig {
  if (params.input.useEnv && params.accountId !== DEFAULT_ACCOUNT_ID) {
    return params.cfg;
  }

  let appId = "";
  let clientSecret = "";

  if (params.input.token) {
    const parsed = parseQQBotInlineToken(params.input.token);
    if (!parsed) {
      return params.cfg;
    }
    appId = parsed.appId;
    clientSecret = parsed.clientSecret;
  }

  if (!appId && !params.input.tokenFile && !params.input.useEnv) {
    return params.cfg;
  }

  return applyQQBotAccountConfig(params.cfg, params.accountId, {
    appId,
    clientSecret,
    clientSecretFile: params.input.tokenFile,
    name: params.input.name,
  });
}

export function isQQBotConfigured(account: ResolvedQQBotAccount | undefined): boolean {
  return Boolean(
    account?.appId &&
    (Boolean(account?.clientSecret) ||
      hasConfiguredSecretInput(account?.config?.clientSecret) ||
      Boolean(account?.config?.clientSecretFile?.trim())),
  );
}

export function describeQQBotAccount(account: ResolvedQQBotAccount | undefined) {
  return {
    accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
    name: account?.name,
    enabled: account?.enabled ?? false,
    configured: isQQBotConfigured(account),
    tokenSource: account?.secretSource,
  };
}

export function formatQQBotAllowFrom(params: {
  allowFrom: Array<string | number> | undefined | null;
}): string[] {
  return (params.allowFrom ?? [])
    .map((entry) => normalizeStringifiedOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => entry.replace(/^qqbot:/i, ""))
    .map((entry) => entry.toUpperCase());
}

export const qqbotConfigAdapter = {
  listAccountIds: (cfg: AssistantConfig) => listQQBotAccountIds(cfg),
  resolveAccount: (cfg: AssistantConfig, accountId?: string | null) =>
    resolveQQBotAccount(cfg, accountId, { allowUnresolvedSecretRef: true }),
  defaultAccountId: (cfg: AssistantConfig) => resolveDefaultQQBotAccountId(cfg),
  setAccountEnabled: ({
    cfg,
    accountId,
    enabled,
  }: {
    cfg: AssistantConfig;
    accountId: string;
    enabled: boolean;
  }) =>
    setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "qqbot",
      accountId,
      enabled,
      allowTopLevel: true,
    }),
  deleteAccount: ({ cfg, accountId }: { cfg: AssistantConfig; accountId: string }) =>
    deleteAccountFromConfigSection({
      cfg,
      sectionKey: "qqbot",
      accountId,
      clearBaseFields: ["appId", "clientSecret", "clientSecretFile", "name"],
    }),
  isConfigured: isQQBotConfigured,
  describeAccount: describeQQBotAccount,
  resolveAllowFrom: ({ cfg, accountId }: { cfg: AssistantConfig; accountId?: string | null }) =>
    resolveQQBotAccount(cfg, accountId, { allowUnresolvedSecretRef: true }).config?.allowFrom,
  formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> | undefined | null }) =>
    formatQQBotAllowFrom({ allowFrom }),
};

export const qqbotSetupAdapterShared = {
  resolveAccountId: ({ cfg, accountId }: { cfg: AssistantConfig; accountId?: string | null }) =>
    normalizeLowercaseStringOrEmpty(accountId) || resolveDefaultQQBotAccountId(cfg),
  applyAccountName: ({
    cfg,
    accountId,
    name,
  }: {
    cfg: AssistantConfig;
    accountId: string;
    name?: string;
  }) =>
    applyAccountNameToChannelSection({
      cfg,
      channelKey: "qqbot",
      accountId,
      name,
    }),
  validateInput: ({ accountId, input }: { accountId: string; input: ChannelSetupInput }) =>
    validateQQBotSetupInput({ accountId, input }),
  applyAccountConfig: ({
    cfg,
    accountId,
    input,
  }: {
    cfg: AssistantConfig;
    accountId: string;
    input: ChannelSetupInput;
  }) => applyQQBotSetupAccountConfig({ cfg, accountId, input }),
};
