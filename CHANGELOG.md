# Changelog

All notable changes to the configuration wizard module are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Wizard Refactor

### Breaking Changes

- **Legacy field rejection** — The wizard now refuses to start if the source config contains
  removed or auto-migrated legacy keys, including `routing`, `providers`, `bot`, `agent`,
  `memorySearch`, `heartbeat`, legacy top-level channel sections, legacy gateway auth aliases,
  legacy gateway bind host aliases, sandbox `perSession`, and legacy provider-owned web search
  config. Run `openclaw doctor` to migrate and remove those keys before re-running setup or
  configure.

- **Product name change** — All user-facing wizard text now uses the name "助手" instead of the
  previous project name. The CLI binary name and environment variable names are unchanged.

- **Removed legacy search auto-detection** — The finalize step no longer silently detects
  old-style bare API keys (e.g. `BRAVE_API_KEY`) without an explicit `tools.web.search.provider`.
  Explicitly select a search provider via `openclaw configure --section web`.

### Added

- **`src/wizard/assistant-constants.ts`** — Central module for the product display name, CLI
  binary name, docs base URL, config file path, and environment variable names. All wizard files
  now import from this module rather than inlining strings.

- **`src/wizard/validation.ts`** — New config validation and conflict detection module.
  - `validateWizardConfig(config)` — returns `{ valid, errors, conflicts, warnings }` after
    checking for legacy fields, mutually-exclusive setting pairs, and missing required values.
  - `validationResultToWizardIssues(result)` — converts validation output into
    `WizardPrompter.showValidationErrors()` issues.
  - `detectConfigConflicts(config)` — returns only the list of conflicts.
  - `hasLegacyFields(config, legacyIssues?)` — quick boolean check for legacy fields.
  - `formatValidationResult(result)` — formats a `ValidationResult` for display in wizard notes.
  - Known conflict rules: `tailscale-non-loopback-bind`, `tailscale-funnel-no-password`,
    `lan-bind-no-auth`, `remote-mode-with-local-only-settings`.

- **`src/wizard/templates.ts`** — One-click initialization templates.
  - `WIZARD_TEMPLATES` — five built-in templates: `minimal`, `lan`, `tailscale-serve`,
    `tailscale-funnel`, `remote-gateway`.
  - `applyTemplate(base, template)` — deep-merges template config onto a base config without
    mutating either input.
  - `findTemplate(id)` — look up a template by ID.
  - `templateSelectOptions()` — ready-to-use options list for a wizard `select` prompt.
  - Templates now set `ui.assistant.name="助手"` and explicit `gateway.mode` defaults.

- **`src/wizard/rollback.ts`** — Config snapshot and rollback strategy.
  - `createSnapshot(config, label)` — creates an in-memory snapshot with timestamp.
  - `saveConfigSnapshot(snapshot, dir?)` — persists snapshot to `~/.openclaw/.snapshots/`.
  - `listConfigSnapshots(dir?)` — loads and returns all snapshots, newest-first.
  - `rollbackToSnapshot(snapshot, writeConfig)` — restores a snapshot via a provided writer.
  - `pruneOldSnapshots(maxAgeMs, dir?)` — removes snapshots older than the given age.

- **`WizardPrompter.showValidationErrors(issues, title?)`** — new method on the prompter
  interface that displays a structured list of validation issues grouped by severity.

- **`WizardPrompter.showConfigDiff(entries, title?)`** — new method that renders a before/after
  diff of config changes for user review.

- **`WizardValidationIssue` / `WizardConfigDiffEntry`** — new public types exported from
  `src/wizard/prompts.ts`.

- **Conflict detection on startup** — `runSetupWizard` and `runConfigureWizard` now call
  `detectConfigConflicts` on the loaded base config and surface any conflicts as a note before
  wizard interaction begins.

- **Write-time validation** — setup/configure now validate the final candidate config before
  every write and block unsupported legacy fields or mutually-exclusive settings from being
  persisted by the wizard.

- **Rollback CLI** — `openclaw config snapshots list` and
  `openclaw config snapshots rollback <timestamp>` expose wizard-created snapshots.

- **Localized Chinese UI** — All user-facing wizard strings are now in Simplified Chinese,
  including section names, prompts, notes, and error messages.

### Changed

- `createClackPrompter()` — cancel message changed from "Setup cancelled." to "已取消。"
  (Chinese). Implements the two new `WizardPrompter` methods using `clack` notes with
  formatted output.

- `runSetupWizard` — intro text is now "助手 设置". All prompts, notes, and outros use
  Chinese strings.

- `runConfigureWizard` — intro text is now "助手 配置" / "助手 更新向导". Section menu uses
  Chinese labels. All other user-facing strings localized.

- `CONFIGURE_SECTION_OPTIONS` — all label and hint strings updated to Chinese.

- `setup.gateway-config.ts` — token/password prompt messages, mode selection hints, and
  auto-adjust notes now use Chinese strings.

- `setup.plugin-config.ts` — plugin selection prompt, sensitive-field notice, configure/skip
  labels now use Chinese strings.

- `setup.finalize.ts` — removed legacy search auto-detection block. All user-facing messages
  updated to Chinese. "Onboarding complete" outro updated to reference "助手".

### Fixed

- The "Web search" note at the end of the setup wizard no longer shows a misleading
  "auto-detected" message for configs that have an API key but no explicit provider configured
  (legacy compat block removed).

---

## Migration Guide

See [docs/upgrade-guide.md](docs/upgrade-guide.md) for step-by-step migration instructions.
