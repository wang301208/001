export const ASSISTANT_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const ASSISTANT_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  ASSISTANT_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isAssistantOwnerOnlyCoreToolName(toolName: string): boolean {
  return ASSISTANT_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
