import {
  CRON_TOOL_DISPLAY_SUMMARY,
  EXEC_TOOL_DISPLAY_SUMMARY,
  PROCESS_TOOL_DISPLAY_SUMMARY,
  SESSIONS_HISTORY_TOOL_DISPLAY_SUMMARY,
  SESSIONS_LIST_TOOL_DISPLAY_SUMMARY,
  SESSIONS_SEND_TOOL_DISPLAY_SUMMARY,
  SESSIONS_SPAWN_TOOL_DISPLAY_SUMMARY,
  SESSION_STATUS_TOOL_DISPLAY_SUMMARY,
  AUTONOMY_TOOL_DISPLAY_SUMMARY,
  GOVERNANCE_TOOL_DISPLAY_SUMMARY,
  UPDATE_PLAN_TOOL_DISPLAY_SUMMARY,
} from "./tool-description-presets.js";

export type ToolProfileId = "minimal" | "coding" | "messaging" | "full";

type ToolProfilePolicy = {
  allow?: string[];
  deny?: string[];
};

export type CoreToolSection = {
  id: string;
  label: string;
  tools: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

type CoreToolDefinition = {
  id: string;
  label: string;
  description: string;
  sectionId: string;
  profiles: ToolProfileId[];
  includeInAssistantGroup?: boolean;
};

const CORE_TOOL_SECTION_ORDER: Array<{ id: string; label: string }> = [
  { id: "fs", label: "Files" },
  { id: "runtime", label: "Runtime" },
  { id: "web", label: "Web" },
  { id: "memory", label: "Memory" },
  { id: "models", label: "Models" },
  { id: "config", label: "Config" },
  { id: "sessions", label: "Sessions" },
  { id: "ui", label: "UI" },
  { id: "messaging", label: "Messaging" },
  { id: "automation", label: "Automation" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "mcp", label: "MCP" },
  { id: "tasks", label: "Tasks" },
  { id: "nodes", label: "Nodes" },
  { id: "agents", label: "Agents" },
  { id: "media", label: "Media" },
];

const CORE_TOOL_DEFINITIONS: CoreToolDefinition[] = [
  {
    id: "read",
    label: "read",
    description: "Read file contents",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "write",
    label: "write",
    description: "Create or overwrite files",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "edit",
    label: "edit",
    description: "Make precise edits",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "apply_patch",
    label: "apply_patch",
    description: "Patch files",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "exec",
    label: "exec",
    description: EXEC_TOOL_DISPLAY_SUMMARY,
    sectionId: "runtime",
    profiles: ["coding"],
  },
  {
    id: "process",
    label: "process",
    description: PROCESS_TOOL_DISPLAY_SUMMARY,
    sectionId: "runtime",
    profiles: ["coding"],
  },
  {
    id: "code_execution",
    label: "code_execution",
    description: "Run sandboxed remote analysis",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "web_search",
    label: "web_search",
    description: "Search the web",
    sectionId: "web",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "web_fetch",
    label: "web_fetch",
    description: "Fetch web content",
    sectionId: "web",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "x_search",
    label: "x_search",
    description: "Search X posts",
    sectionId: "web",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "memory_search",
    label: "memory_search",
    description: "Semantic search",
    sectionId: "memory",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "memory_get",
    label: "memory_get",
    description: "Read memory files",
    sectionId: "memory",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "models_list",
    label: "models_list",
    description: "List configured local and remote models",
    sectionId: "models",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "models_remote_list",
    label: "models_remote_list",
    description: "Probe a remote model endpoint for available models",
    sectionId: "models",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "config_get",
    label: "config_get",
    description: "Read runtime configuration",
    sectionId: "config",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "config_patch",
    label: "config_patch",
    description: "Merge a partial runtime configuration object",
    sectionId: "config",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "logs_tail",
    label: "logs_tail",
    description: "Read recent backend log lines",
    sectionId: "config",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "sessions_list",
    label: "sessions_list",
    description: SESSIONS_LIST_TOOL_DISPLAY_SUMMARY,
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInAssistantGroup: true,
  },
  {
    id: "sessions_history",
    label: "sessions_history",
    description: SESSIONS_HISTORY_TOOL_DISPLAY_SUMMARY,
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInAssistantGroup: true,
  },
  {
    id: "sessions_send",
    label: "sessions_send",
    description: SESSIONS_SEND_TOOL_DISPLAY_SUMMARY,
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInAssistantGroup: true,
  },
  {
    id: "sessions_spawn",
    label: "sessions_spawn",
    description: SESSIONS_SPAWN_TOOL_DISPLAY_SUMMARY,
    sectionId: "sessions",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "sessions_yield",
    label: "sessions_yield",
    description: "End turn to receive sub-agent results",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "subagents",
    label: "subagents",
    description: "Manage sub-agents",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "session_status",
    label: "session_status",
    description: SESSION_STATUS_TOOL_DISPLAY_SUMMARY,
    sectionId: "sessions",
    profiles: ["minimal", "coding", "messaging"],
    includeInAssistantGroup: true,
  },
  {
    id: "browser",
    label: "browser",
    description: "Control web browser",
    sectionId: "ui",
    profiles: [],
    includeInAssistantGroup: true,
  },
  {
    id: "canvas",
    label: "canvas",
    description: "Control canvases",
    sectionId: "ui",
    profiles: [],
    includeInAssistantGroup: true,
  },
  {
    id: "message",
    label: "message",
    description: "Send messages",
    sectionId: "messaging",
    profiles: ["messaging"],
    includeInAssistantGroup: true,
  },
  {
    id: "cron",
    label: "cron",
    description: CRON_TOOL_DISPLAY_SUMMARY,
    sectionId: "automation",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "gateway",
    label: "gateway",
    description: "Gateway control",
    sectionId: "automation",
    profiles: [],
    includeInAssistantGroup: true,
  },
  {
    id: "skills_search",
    label: "skills_search",
    description: "Search installed and generated skills",
    sectionId: "skills",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "skills_status",
    label: "skills_status",
    description: "Inspect the skill library and generated skill center",
    sectionId: "skills",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "experience_capture",
    label: "experience_capture",
    description: "Capture durable experience from completed work",
    sectionId: "experience",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "experience_search",
    label: "experience_search",
    description: "Search persistent experience and prior transcripts",
    sectionId: "experience",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "strategy_memory",
    label: "strategy_memory",
    description: "Manage scheduled strategic memories and pushes",
    sectionId: "experience",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "self_model",
    label: "self_model",
    description: "Read and update persistent self and user models",
    sectionId: "experience",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "mcp_tools_list",
    label: "mcp_tools_list",
    description: "Discover tools exposed by configured MCP servers",
    sectionId: "mcp",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "mcp_tools_call",
    label: "mcp_tools_call",
    description: "Call a tool exposed by a configured MCP server",
    sectionId: "mcp",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "business_tasks",
    label: "business_tasks",
    description: "Create, list, update, and delete task-center work items",
    sectionId: "tasks",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "nodes",
    label: "nodes",
    description: "Nodes + devices",
    sectionId: "nodes",
    profiles: [],
    includeInAssistantGroup: true,
  },
  {
    id: "agents_files",
    label: "agents_files",
    description: "Manage agent context files that shape each conversation",
    sectionId: "agents",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "governance",
    label: "governance",
    description: GOVERNANCE_TOOL_DISPLAY_SUMMARY,
    sectionId: "agents",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "autonomy",
    label: "autonomy",
    description: AUTONOMY_TOOL_DISPLAY_SUMMARY,
    sectionId: "agents",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "agents_list",
    label: "agents_list",
    description: "List agents",
    sectionId: "agents",
    profiles: [],
    includeInAssistantGroup: true,
  },
  {
    id: "update_plan",
    label: "update_plan",
    description: UPDATE_PLAN_TOOL_DISPLAY_SUMMARY,
    sectionId: "agents",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "image",
    label: "image",
    description: "Image understanding",
    sectionId: "media",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "image_generate",
    label: "image_generate",
    description: "Image generation",
    sectionId: "media",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "music_generate",
    label: "music_generate",
    description: "Music generation",
    sectionId: "media",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "video_generate",
    label: "video_generate",
    description: "Video generation",
    sectionId: "media",
    profiles: ["coding"],
    includeInAssistantGroup: true,
  },
  {
    id: "tts",
    label: "tts",
    description: "Text-to-speech conversion",
    sectionId: "media",
    profiles: [],
    includeInAssistantGroup: true,
  },
];

const CORE_TOOL_BY_ID = new Map<string, CoreToolDefinition>(
  CORE_TOOL_DEFINITIONS.map((tool) => [tool.id, tool]),
);

function listCoreToolIdsForProfile(profile: ToolProfileId): string[] {
  return CORE_TOOL_DEFINITIONS.filter((tool) => tool.profiles.includes(profile)).map(
    (tool) => tool.id,
  );
}

const CORE_TOOL_PROFILES: Record<ToolProfileId, ToolProfilePolicy> = {
  minimal: {
    allow: listCoreToolIdsForProfile("minimal"),
  },
  coding: {
    allow: listCoreToolIdsForProfile("coding"),
  },
  messaging: {
    allow: listCoreToolIdsForProfile("messaging"),
  },
  full: {},
};

function buildCoreToolGroupMap() {
  const sectionToolMap = new Map<string, string[]>();
  for (const tool of CORE_TOOL_DEFINITIONS) {
    const groupId = `group:${tool.sectionId}`;
    const list = sectionToolMap.get(groupId) ?? [];
    list.push(tool.id);
    sectionToolMap.set(groupId, list);
  }
  const assistantTools = CORE_TOOL_DEFINITIONS.filter((tool) => tool.includeInAssistantGroup).map(
    (tool) => tool.id,
  );
  return {
    "group:assistant": assistantTools,
    ...Object.fromEntries(sectionToolMap.entries()),
  };
}

export const CORE_TOOL_GROUPS = buildCoreToolGroupMap();

export const PROFILE_OPTIONS = [
  { id: "minimal", label: "Minimal" },
  { id: "coding", label: "Coding" },
  { id: "messaging", label: "Messaging" },
  { id: "full", label: "Full" },
] as const;

export function resolveCoreToolProfilePolicy(profile?: string): ToolProfilePolicy | undefined {
  if (!profile) {
    return undefined;
  }
  const resolved = CORE_TOOL_PROFILES[profile as ToolProfileId];
  if (!resolved) {
    return undefined;
  }
  if (!resolved.allow && !resolved.deny) {
    return undefined;
  }
  return {
    allow: resolved.allow ? [...resolved.allow] : undefined,
    deny: resolved.deny ? [...resolved.deny] : undefined,
  };
}

export function listCoreToolSections(): CoreToolSection[] {
  return CORE_TOOL_SECTION_ORDER.map((section) => ({
    id: section.id,
    label: section.label,
    tools: CORE_TOOL_DEFINITIONS.filter((tool) => tool.sectionId === section.id).map((tool) => ({
      id: tool.id,
      label: tool.label,
      description: tool.description,
    })),
  })).filter((section) => section.tools.length > 0);
}

export function resolveCoreToolProfiles(toolId: string): ToolProfileId[] {
  const tool = CORE_TOOL_BY_ID.get(toolId);
  if (!tool) {
    return [];
  }
  return [...tool.profiles];
}

export function isKnownCoreToolId(toolId: string): boolean {
  return CORE_TOOL_BY_ID.has(toolId);
}
