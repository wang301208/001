import type { AssistantConfig } from "../config/types.assistant.js";

const MB = 1024 * 1024;

export function resolveConfiguredMediaMaxBytes(cfg?: AssistantConfig): number | undefined {
  const configured = cfg?.agents?.defaults?.mediaMaxMb;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured * MB);
  }
  return undefined;
}
