import type { ToolsCatalogResult, ToolsEffectiveResult } from "../gateway/protocol/index.js";
import { sanitizeRenderableText } from "./tui-formatters.js";

const DEFAULT_TOOL_LIMIT_PER_GROUP = 8;

type ToolGroup = {
  id?: string;
  label: string;
  source?: string;
  pluginId?: string;
  tools: Array<{
    id: string;
    label?: string;
    description?: string;
    source?: string;
  }>;
};

function normalizeQuery(query?: string): string {
  return query?.trim().toLowerCase() ?? "";
}

function toolMatchesQuery(tool: ToolGroup["tools"][number], query: string): boolean {
  if (!query) {
    return true;
  }
  return [tool.id, tool.label, tool.description, tool.source]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(query));
}

function filterGroupsByQuery(groups: ToolGroup[], query?: string): ToolGroup[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return groups;
  }
  return groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => toolMatchesQuery(tool, normalized)),
    }))
    .filter((group) => group.tools.length > 0);
}

function countTools(groups: ToolGroup[]): number {
  return groups.reduce((sum, group) => sum + group.tools.length, 0);
}

function formatToolLine(tool: ToolGroup["tools"][number]): string {
  const title = tool.label && tool.label !== tool.id ? `${tool.id} (${tool.label})` : tool.id;
  const description = sanitizeRenderableText(tool.description ?? "").replace(/\s+/g, " ").trim();
  return description ? `  - ${title}: ${description}` : `  - ${title}`;
}

function formatGroups(groups: ToolGroup[], limitPerGroup: number): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`${group.label} (${group.tools.length})`);
    for (const tool of group.tools.slice(0, limitPerGroup)) {
      lines.push(formatToolLine(tool));
    }
    if (group.tools.length > limitPerGroup) {
      lines.push(`  - ... 还有 ${group.tools.length - limitPerGroup} 个工具`);
    }
  }
  return lines;
}

function formatGovernanceLines(
  governance: ToolsCatalogResult["governance"] | ToolsEffectiveResult["governance"],
): string[] {
  const lines: string[] = [];
  const charter = governance.charterDeclared
    ? [governance.charterLayer, governance.charterTitle].filter(Boolean).join(" / ") || "已声明"
    : "未声明";
  lines.push(`治理: 宪章 ${charter}; 冻结 ${governance.freezeActive ? "启用" : "未启用"}`);
  if (governance.charterToolDeny.length > 0) {
    lines.push(`治理拒绝工具: ${governance.charterToolDeny.join(", ")}`);
  }
  if (governance.freezeDeny.length > 0) {
    lines.push(`冻结拒绝工具: ${governance.freezeDeny.join(", ")}`);
  }
  return lines;
}

export function formatToolsCatalogForTui(
  result: ToolsCatalogResult,
  options: { limitPerGroup?: number; query?: string } = {},
): string {
  const limitPerGroup = options.limitPerGroup ?? DEFAULT_TOOL_LIMIT_PER_GROUP;
  const groups = filterGroupsByQuery(result.groups as ToolGroup[], options.query);
  const lines = [
    `能力目录: agent=${result.agentId}; 分组=${groups.length}; 工具=${countTools(groups)}`,
    ...(normalizeQuery(options.query) ? [`匹配: ${options.query?.trim()}`] : []),
    `能力档位: ${result.profiles.map((profile) => profile.id).join(", ") || "none"}`,
    ...formatGovernanceLines(result.governance),
    "",
    ...formatGroups(groups, limitPerGroup),
  ];
  return lines.join("\n").trimEnd();
}

export function formatEffectiveToolsForTui(
  result: ToolsEffectiveResult,
  options: { limitPerGroup?: number; query?: string } = {},
): string {
  const limitPerGroup = options.limitPerGroup ?? DEFAULT_TOOL_LIMIT_PER_GROUP;
  const groups = filterGroupsByQuery(result.groups as ToolGroup[], options.query);
  const lines = [
    `当前可调用工具: agent=${result.agentId}; profile=${result.profile}; 分组=${groups.length}; 工具=${countTools(groups)}`,
    ...(normalizeQuery(options.query) ? [`匹配: ${options.query?.trim()}`] : []),
    ...formatGovernanceLines(result.governance),
    "",
    ...formatGroups(groups, limitPerGroup),
  ];
  return lines.join("\n").trimEnd();
}
