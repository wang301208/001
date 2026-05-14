export const ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isZhushouOwnerOnlyCoreToolName(toolName: string): boolean {
  return ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
