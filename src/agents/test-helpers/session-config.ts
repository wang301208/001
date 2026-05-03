import type { ZhushouConfig } from "../../config/types.zhushou.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<ZhushouConfig["session"]>> = {},
): NonNullable<ZhushouConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
