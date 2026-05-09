import { getCommandPathWithRootOptions } from "../cli/argv.js";
import type { AssistantConfig } from "../config/types.assistant.js";
import { resolveNodeRequireFromMeta } from "./node-require.js";

type LoggingConfig = AssistantConfig["logging"];

const requireConfig = resolveNodeRequireFromMeta(import.meta.url);

export function shouldSkipMutatingLoggingConfigRead(argv: string[] = process.argv): boolean {
  const [primary, secondary] = getCommandPathWithRootOptions(argv, 2);
  return primary === "config" && (secondary === "schema" || secondary === "validate");
}

export function readLoggingConfig(): LoggingConfig | undefined {
  if (shouldSkipMutatingLoggingConfigRead()) {
    return undefined;
  }
  try {
    const loaded = requireConfig?.("../config/config.js") as
      | {
          loadConfig?: () => AssistantConfig;
        }
      | undefined;
    const parsed = loaded?.loadConfig?.();
    const logging = parsed?.logging;
    if (!logging || typeof logging !== "object" || Array.isArray(logging)) {
      return undefined;
    }
    return logging as LoggingConfig;
  } catch {
    return undefined;
  }
}
