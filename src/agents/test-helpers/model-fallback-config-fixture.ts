import type { ZhushouConfig } from "../../config/types.zhushou.js";

export function makeModelFallbackCfg(overrides: Partial<ZhushouConfig> = {}): ZhushouConfig {
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
  } as ZhushouConfig;
}
