import type { AssistantConfig } from "../../config/types.assistant.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<AssistantConfig["session"]>> = {},
): NonNullable<AssistantConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
