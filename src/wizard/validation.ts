import type { ZhushouConfig } from "../config/types.zhushou.js";
import type { WizardValidationIssue } from "./prompts.js";

export type ValidationError = {
  path: string;
  message: string;
  code: string;
};

export type ConfigConflict = {
  paths: string[];
  message: string;
  code: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  conflicts: ConfigConflict[];
  warnings: ValidationError[];
};

export type WizardLegacyIssue = {
  path: string;
  message: string;
};

/**
 * Legacy keys that are no longer recognized by the wizard.
 * Configs containing these keys must be migrated before the wizard can proceed.
 */
const LEGACY_FIELD_PATHS: ReadonlyArray<{ path: string; replacement?: string; message: string }> = [
  {
    path: "routing",
    replacement: "gateway.routing (or per-channel config)",
    message: "routing.* keys are deprecated; use channel-level allow/block configuration instead.",
  },
  {
    path: "providers",
    replacement: "auth.profiles",
    message: "Top-level providers.* is a legacy field; use auth.profiles.<id> instead.",
  },
  {
    path: "bot",
    replacement: "agents.defaults",
    message: "Top-level bot.* is a legacy field; use agents.defaults instead.",
  },
  {
    path: "agent",
    replacement: "agents",
    message: "Top-level agent.* is a legacy field; use agents.* instead.",
  },
  {
    path: "memorySearch",
    replacement: "agents.defaults.memorySearch",
    message: "Top-level memorySearch is a legacy field.",
  },
  {
    path: "heartbeat",
    replacement: "agents.defaults.heartbeat or channels.defaults.heartbeat",
    message: "Top-level heartbeat is a legacy field.",
  },
  {
    path: "gateway.token",
    replacement: "gateway.auth.token",
    message: "gateway.token is a legacy field.",
  },
  {
    path: "gateway.password",
    replacement: "gateway.auth.password",
    message: "gateway.password is a legacy field.",
  },
  {
    path: "tools.web.x_search.apiKey",
    replacement: "plugins.entries.xai.config.webSearch.apiKey",
    message: "tools.web.x_search.apiKey is a legacy field.",
  },
  {
    path: "tools.web.search.apiKey",
    replacement: "plugins.entries.<provider>.config.webSearch.apiKey",
    message: "tools.web.search.apiKey is a legacy provider-owned field.",
  },
];

const LEGACY_TOP_LEVEL_CHANNEL_KEYS = [
  "telegram",
  "whatsapp",
  "slack",
  "discord",
  "signal",
  "imessage",
  "msteams",
  "googlechat",
  "line",
  "irc",
  "nextcloudtalk",
  "qqbot",
] as const;

const LEGACY_GATEWAY_BIND_HOST_ALIASES = new Set([
  "0.0.0.0",
  "::",
  "[::]",
  "*",
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

const LEGACY_WEB_SEARCH_PROVIDER_KEYS = new Set([
  "brave",
  "firecrawl",
  "google",
  "perplexity",
  "exa",
  "serper",
  "xai",
  "grok",
]);

/** Conflicts: pairs of settings that cannot coexist. */
const CONFLICT_RULES: ReadonlyArray<{
  code: string;
  check: (cfg: ZhushouConfig) => boolean;
  paths: string[];
  message: string;
}> = [
  {
    code: "tailscale-non-loopback-bind",
    check: (cfg) =>
      cfg.gateway?.tailscale?.mode !== undefined &&
      cfg.gateway.tailscale.mode !== "off" &&
      cfg.gateway?.bind !== undefined &&
      cfg.gateway.bind !== "loopback",
    paths: ["gateway.tailscale.mode", "gateway.bind"],
    message:
      "Tailscale serve/funnel requires gateway.bind=loopback. Non-loopback bind exposes the server directly alongside Tailscale, which is unsupported.",
  },
  {
    code: "tailscale-funnel-no-password",
    check: (cfg) =>
      cfg.gateway?.tailscale?.mode === "funnel" && cfg.gateway?.auth?.mode !== "password",
    paths: ["gateway.tailscale.mode", "gateway.auth.mode"],
    message:
      "Tailscale funnel exposes the gateway to the public internet and requires password authentication (gateway.auth.mode=password).",
  },
  {
    code: "lan-bind-no-auth",
    check: (cfg) =>
      (cfg.gateway?.bind === "lan" || cfg.gateway?.bind === "auto") &&
      !cfg.gateway?.auth?.token &&
      !cfg.gateway?.auth?.password &&
      cfg.gateway?.auth?.mode === undefined,
    paths: ["gateway.bind", "gateway.auth"],
    message:
      "LAN/auto bind without any auth token or password leaves the gateway open on your network. Set gateway.auth.token or gateway.auth.password.",
  },
  {
    code: "remote-mode-with-local-only-settings",
    check: (cfg) =>
      cfg.gateway?.mode === "remote" &&
      (cfg.gateway?.tailscale?.mode !== undefined ||
        cfg.gateway?.bind !== undefined ||
        cfg.gateway?.port !== undefined),
    paths: ["gateway.mode", "gateway.tailscale", "gateway.bind", "gateway.port"],
    message:
      "gateway.mode=remote: local-only settings (bind, port, tailscale) are ignored. Remove them to avoid confusion.",
  },
];

/** Required fields that must be present for a functional config. */
const REQUIRED_FIELD_CHECKS: ReadonlyArray<{
  code: string;
  check: (cfg: ZhushouConfig) => boolean;
  path: string;
  message: string;
}> = [
  {
    code: "missing-workspace",
    check: (cfg) => !cfg.agents?.defaults?.workspace,
    path: "agents.defaults.workspace",
    message: "Workspace directory is not set. Run the setup wizard to configure it.",
  },
];

function hasLegacyField(config: ZhushouConfig, fieldPath: string): boolean {
  const parts = fieldPath.split(".");
  let cursor: unknown = config;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object") {
      return false;
    }
    if (!(part in (cursor as Record<string, unknown>))) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor !== undefined;
}

function hasOwnRecordKey(value: unknown, key: string): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, key),
  );
}

function hasLegacySandboxPerSession(config: ZhushouConfig): boolean {
  if (hasOwnRecordKey(config.agents?.defaults?.sandbox, "perSession")) {
    return true;
  }
  const agents = config.agents?.list;
  if (!Array.isArray(agents)) {
    return false;
  }
  return agents.some((agent) => hasOwnRecordKey(agent?.sandbox, "perSession"));
}

function hasLegacyGatewayBindHostAlias(config: ZhushouConfig): boolean {
  const bind = config.gateway?.bind;
  return typeof bind === "string" && LEGACY_GATEWAY_BIND_HOST_ALIASES.has(bind.toLowerCase());
}

function hasLegacyProviderScopedWebSearch(config: ZhushouConfig): boolean {
  const search = config.tools?.web?.search;
  if (!search || typeof search !== "object") {
    return false;
  }
  return Object.entries(search as Record<string, unknown>).some(
    ([key, value]) =>
      LEGACY_WEB_SEARCH_PROVIDER_KEYS.has(key) &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function pushLegacyError(
  errors: ValidationError[],
  path: string,
  message: string,
  replacement?: string,
): void {
  if (errors.some((err) => err.code === `legacy-field:${path}`)) {
    return;
  }
  errors.push({
    path,
    code: `legacy-field:${path}`,
    message: replacement ? `${message} Migrate to: ${replacement}.` : message,
  });
}

function collectLegacyErrors(
  config: ZhushouConfig,
  externalLegacyIssues: readonly WizardLegacyIssue[] = [],
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const legacy of LEGACY_FIELD_PATHS) {
    if (hasLegacyField(config, legacy.path)) {
      pushLegacyError(errors, legacy.path, legacy.message, legacy.replacement);
    }
  }

  for (const key of LEGACY_TOP_LEVEL_CHANNEL_KEYS) {
    if (hasLegacyField(config, key)) {
      pushLegacyError(
        errors,
        key,
        `Top-level ${key}.* is a legacy channel field.`,
        `channels.${key}`,
      );
    }
  }

  if (hasLegacyGatewayBindHostAlias(config)) {
    pushLegacyError(
      errors,
      "gateway.bind",
      "gateway.bind host aliases are legacy; use bind modes instead.",
      "gateway.bind=lan, loopback, custom, tailnet, or auto",
    );
  }

  if (hasLegacySandboxPerSession(config)) {
    pushLegacyError(
      errors,
      "agents.*.sandbox.perSession",
      "sandbox.perSession is a legacy field.",
      "sandbox.scope",
    );
  }

  if (hasLegacyProviderScopedWebSearch(config)) {
    pushLegacyError(
      errors,
      "tools.web.search.<provider>",
      "tools.web.search.<provider> provider-owned config is legacy.",
      "plugins.entries.<provider>.config.webSearch",
    );
  }

  for (const issue of externalLegacyIssues) {
    if (!issue.path) {
      continue;
    }
    pushLegacyError(errors, issue.path, issue.message);
  }

  return errors;
}

function hasAnyExternalLegacyIssue(legacyIssues: readonly WizardLegacyIssue[] = []): boolean {
  return legacyIssues.some((issue) => issue.path.trim().length > 0);
}

/**
 * Validate a config against the current project schema.
 * Returns errors for legacy fields, conflicts between settings, and missing required values.
 * Warnings are non-blocking issues worth surfacing to the user.
 */
export function validateWizardConfig(
  config: ZhushouConfig,
  opts: { legacyIssues?: readonly WizardLegacyIssue[] } = {},
): ValidationResult {
  const errors: ValidationError[] = collectLegacyErrors(config, opts.legacyIssues);
  const conflicts: ConfigConflict[] = [];
  const warnings: ValidationError[] = [];

  for (const rule of CONFLICT_RULES) {
    if (rule.check(config)) {
      conflicts.push({
        paths: rule.paths,
        code: rule.code,
        message: rule.message,
      });
    }
  }

  for (const req of REQUIRED_FIELD_CHECKS) {
    if (req.check(config)) {
      warnings.push({
        path: req.path,
        code: req.code,
        message: req.message,
      });
    }
  }

  return {
    valid: errors.length === 0 && conflicts.length === 0,
    errors,
    conflicts,
    warnings,
  };
}

/**
 * Convenience: detect only conflicts between the given config's settings.
 */
export function detectConfigConflicts(config: ZhushouConfig): ConfigConflict[] {
  return CONFLICT_RULES.filter((rule) => rule.check(config)).map((rule) => ({
    paths: rule.paths,
    code: rule.code,
    message: rule.message,
  }));
}

/**
 * Return true if the config contains any legacy (no longer supported) fields.
 */
export function hasLegacyFields(
  config: ZhushouConfig,
  legacyIssues: readonly WizardLegacyIssue[] = [],
): boolean {
  return collectLegacyErrors(config, legacyIssues).length > 0 || hasAnyExternalLegacyIssue(legacyIssues);
}

export function validationResultToWizardIssues(
  result: ValidationResult,
): WizardValidationIssue[] {
  return [
    ...result.errors.map((error) => ({
      path: error.path,
      message: error.message,
      severity: "error" as const,
    })),
    ...result.conflicts.map((conflict) => ({
      path: conflict.paths.join(", "),
      message: conflict.message,
      severity: "conflict" as const,
    })),
    ...result.warnings.map((warning) => ({
      path: warning.path,
      message: warning.message,
      severity: "warning" as const,
    })),
  ];
}

/**
 * Format a ValidationResult as a human-readable multi-line string for display in wizard notes.
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("错误（须修复后方可继续）：");
    for (const err of result.errors) {
      lines.push(`  ✗ ${err.path}: ${err.message}`);
    }
  }

  if (result.conflicts.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("冲突（互斥配置）：");
    for (const conflict of result.conflicts) {
      lines.push(`  ⚡ [${conflict.paths.join(", ")}]: ${conflict.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("警告：");
    for (const warn of result.warnings) {
      lines.push(`  ⚠ ${warn.path}: ${warn.message}`);
    }
  }

  return lines.join("\n");
}
