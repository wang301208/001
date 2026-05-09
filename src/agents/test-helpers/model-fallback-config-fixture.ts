import type { AssistantConfig } from "../../config/types.assistant.js";

export function makeModelFallbackCfg(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1-mini",
          fallbacks: ["anthropic/claude-haiku-3-5"],
        },
      },
    },
    ...overrides,
  } as AssistantConfig;
}
