import type { OpenClawConfig } from "../config/types.openclaw.js";

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

/**
 * Legacy top-level keys that are no longer recognized.
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
];

/** Conflicts: pairs of settings that cannot coexist. */
const CONFLICT_RULES: ReadonlyArray<{
  code: string;
  check: (cfg: OpenClawConfig) => boolean;
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
  check: (cfg: OpenClawConfig) => boolean;
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

function hasLegacyField(config: OpenClawConfig, fieldPath: string): boolean {
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

/**
 * Validate a config against the current project schema.
 * Returns errors for legacy fields, conflicts between settings, and missing required values.
 * Warnings are non-blocking issues worth surfacing to the user.
 */
export function validateWizardConfig(config: OpenClawConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const conflicts: ConfigConflict[] = [];
  const warnings: ValidationError[] = [];

  for (const legacy of LEGACY_FIELD_PATHS) {
    if (hasLegacyField(config, legacy.path)) {
      errors.push({
        path: legacy.path,
        code: `legacy-field:${legacy.path}`,
        message: legacy.replacement
          ? `${legacy.message} Migrate to: ${legacy.replacement}.`
          : legacy.message,
      });
    }
  }

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
export function detectConfigConflicts(config: OpenClawConfig): ConfigConflict[] {
  return CONFLICT_RULES.filter((rule) => rule.check(config)).map((rule) => ({
    paths: rule.paths,
    code: rule.code,
    message: rule.message,
  }));
}

/**
 * Return true if the config contains any legacy (no longer supported) fields.
 */
export function hasLegacyFields(config: OpenClawConfig): boolean {
  return LEGACY_FIELD_PATHS.some((legacy) => hasLegacyField(config, legacy.path));
}

/**
 * Format a ValidationResult as a human-readable multi-line string for display in wizard notes.
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("Errors (must fix before continuing):");
    for (const err of result.errors) {
      lines.push(`  ✗ ${err.path}: ${err.message}`);
    }
  }

  if (result.conflicts.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Conflicts (incompatible settings):");
    for (const conflict of result.conflicts) {
      lines.push(`  ⚡ [${conflict.paths.join(", ")}]: ${conflict.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Warnings:");
    for (const warn of result.warnings) {
      lines.push(`  ⚠ ${warn.path}: ${warn.message}`);
    }
  }

  return lines.join("\n");
}
