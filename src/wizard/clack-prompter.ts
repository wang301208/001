import {
  autocompleteMultiselect,
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  type Option,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { createCliProgress } from "../cli/progress.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { stripAnsi } from "../terminal/ansi.js";
import { note as emitNote } from "../terminal/note.js";
import { stylePromptHint, stylePromptMessage, stylePromptTitle } from "../terminal/prompt-style.js";
import { theme } from "../terminal/theme.js";
import type {
  WizardConfigDiffEntry,
  WizardProgress,
  WizardPrompter,
  WizardValidationIssue,
} from "./prompts.js";
import { WizardCancelledError } from "./prompts.js";

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel(stylePromptTitle("已取消。") ?? "已取消。");
    throw new WizardCancelledError();
  }
  return value;
}

function normalizeSearchTokens(search: string): string[] {
  return normalizeLowercaseStringOrEmpty(search)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function buildOptionSearchText<T>(option: Option<T>): string {
  const label = stripAnsi(option.label ?? "");
  const hint = stripAnsi(option.hint ?? "");
  const value = String(option.value ?? "");
  return normalizeLowercaseStringOrEmpty(`${label} ${hint} ${value}`);
}

export function tokenizedOptionFilter<T>(search: string, option: Option<T>): boolean {
  const tokens = normalizeSearchTokens(search);
  if (tokens.length === 0) {
    return true;
  }
  const haystack = buildOptionSearchText(option);
  return tokens.every((token) => haystack.includes(token));
}

function formatValidationIssues(issues: WizardValidationIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error");
  const conflicts = issues.filter((i) => i.severity === "conflict");
  const warnings = issues.filter((i) => i.severity === "warning");

  const lines: string[] = [];

  if (errors.length > 0) {
    lines.push("错误（须修复后方可继续）：");
    for (const err of errors) {
      lines.push(`  ✗ ${err.path}: ${err.message}`);
    }
  }

  if (conflicts.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("冲突（互斥配置）：");
    for (const c of conflicts) {
      lines.push(`  ⚡ ${c.path}: ${c.message}`);
    }
  }

  if (warnings.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("警告：");
    for (const w of warnings) {
      lines.push(`  ⚠ ${w.path}: ${w.message}`);
    }
  }

  return lines.join("\n") || "（无问题）";
}

function serializeValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "（未设置）";
  }
  if (typeof value === "string") {
    return value || "（空字符串）";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatConfigDiff(entries: WizardConfigDiffEntry[]): string {
  if (entries.length === 0) {
    return "（无变更）";
  }
  return entries
    .map((entry) => {
      const before = serializeValue(entry.before);
      const after = serializeValue(entry.after);
      return `  ${entry.path}\n    旧值: ${before}\n    新值: ${after}`;
    })
    .join("\n");
}

export function createClackPrompter(): WizardPrompter {
  return {
    intro: async (title) => {
      intro(stylePromptTitle(title) ?? title);
    },
    outro: async (message) => {
      outro(stylePromptTitle(message) ?? message);
    },
    note: async (message, title) => {
      emitNote(message, title);
    },
    select: async (params) =>
      guardCancel(
        await select({
          message: stylePromptMessage(params.message),
          options: params.options.map((opt) => {
            const base = { value: opt.value, label: opt.label };
            return opt.hint === undefined ? base : { ...base, hint: stylePromptHint(opt.hint) };
          }) as Option<(typeof params.options)[number]["value"]>[],
          initialValue: params.initialValue,
        }),
      ),
    multiselect: async (params) => {
      const options = params.options.map((opt) => {
        const base = { value: opt.value, label: opt.label };
        return opt.hint === undefined ? base : { ...base, hint: stylePromptHint(opt.hint) };
      }) as Option<(typeof params.options)[number]["value"]>[];

      if (params.searchable) {
        return guardCancel(
          await autocompleteMultiselect({
            message: stylePromptMessage(params.message),
            options,
            initialValues: params.initialValues,
            filter: tokenizedOptionFilter,
          }),
        );
      }

      return guardCancel(
        await multiselect({
          message: stylePromptMessage(params.message),
          options,
          initialValues: params.initialValues,
        }),
      );
    },
    text: async (params) => {
      const validate = params.validate;
      return guardCancel(
        await text({
          message: stylePromptMessage(params.message),
          initialValue: params.initialValue,
          placeholder: params.placeholder,
          validate: validate ? (value) => validate(value ?? "") : undefined,
        }),
      );
    },
    confirm: async (params) =>
      guardCancel(
        await confirm({
          message: stylePromptMessage(params.message),
          initialValue: params.initialValue,
        }),
      ),
    progress: (label: string): WizardProgress => {
      const spin = spinner();
      spin.start(theme.accent(label));
      const osc = createCliProgress({
        label,
        indeterminate: true,
        enabled: true,
        fallback: "none",
      });
      return {
        update: (message) => {
          spin.message(theme.accent(message));
          osc.setLabel(message);
        },
        stop: (message) => {
          osc.done();
          spin.stop(message);
        },
      };
    },
    showValidationErrors: async (issues, title = "配置检查") => {
      emitNote(formatValidationIssues(issues), title);
    },
    showConfigDiff: async (entries, title = "配置变更预览") => {
      emitNote(formatConfigDiff(entries), title);
    },
  };
}
