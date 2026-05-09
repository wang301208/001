import type { SlashCommand } from "@mariozechner/pi-tui";
import { listChatCommands, listChatCommandsForConfig } from "../auto-reply/commands-registry.js";
import { formatThinkingLevels, listThinkingLevelLabels } from "../auto-reply/thinking.js";
import type { AssistantConfig } from "../config/types.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { ASSISTANT_HELP_TEXT } from "./assistant-style.js";

const VERBOSE_LEVELS = ["on", "off"];
const TRACE_LEVELS = ["on", "off"];
const FAST_LEVELS = ["status", "on", "off"];
const REASONING_LEVELS = ["on", "off"];
const ELEVATED_LEVELS = ["on", "off", "ask", "full"];
const ACTIVATION_LEVELS = ["mention", "always"];
const USAGE_FOOTER_LEVELS = ["off", "tokens", "full"];

export type ParsedCommand = {
  name: string;
  args: string;
};

export type SlashCommandOptions = {
  cfg?: AssistantConfig;
  provider?: string;
  model?: string;
};

const COMMAND_ALIASES: Record<string, string> = {
  abilities: "capabilities",
  elev: "elevated",
  gwstatus: "gateway-status",
  listen: "voice",
  mcp: "mcp-tools",
  method: "gateway-method",
  methods: "gateway-methods",
  "memory-recall": "session-recall",
  recall: "experience-search",
  redirect: "steer",
  remember: "experience-capture",
  rpc: "gateway-call",
  "parallel-agents": "agents-parallel",
  "parallel-status": "agents-parallel-status",
  "parallel-cancel": "agents-parallel-cancel",
  "skills-candidates": "skill-candidates",
  "task-list": "tasks",
  "use-tool": "invoke-tool",
};

function createLevelCompletion(
  levels: string[],
): NonNullable<SlashCommand["getArgumentCompletions"]> {
  return (prefix) =>
    levels
      .filter((value) => value.startsWith(normalizeLowercaseStringOrEmpty(prefix)))
      .map((value) => ({
        value,
        label: value,
      }));
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.replace(/^\//, "").trim();
  if (!trimmed) {
    return { name: "", args: "" };
  }
  const [name, ...rest] = trimmed.split(/\s+/);
  const normalized = normalizeLowercaseStringOrEmpty(name);
  return {
    name: COMMAND_ALIASES[normalized] ?? normalized,
    args: rest.join(" ").trim(),
  };
}

export function getSlashCommands(options: SlashCommandOptions = {}): SlashCommand[] {
  const thinkLevels = listThinkingLevelLabels(options.provider, options.model);
  const verboseCompletions = createLevelCompletion(VERBOSE_LEVELS);
  const traceCompletions = createLevelCompletion(TRACE_LEVELS);
  const fastCompletions = createLevelCompletion(FAST_LEVELS);
  const reasoningCompletions = createLevelCompletion(REASONING_LEVELS);
  const usageCompletions = createLevelCompletion(USAGE_FOOTER_LEVELS);
  const elevatedCompletions = createLevelCompletion(ELEVATED_LEVELS);
  const activationCompletions = createLevelCompletion(ACTIVATION_LEVELS);
  const commands: SlashCommand[] = [
    { name: "help", description: "Show slash command help" },
    { name: "robot", description: "Show natural-language robot control help" },
    { name: "gateway-status", description: "Show gateway status summary" },
    { name: "gwstatus", description: "Alias for /gateway-status" },
    { name: "capabilities", description: "Show the full backend capability catalog" },
    { name: "abilities", description: "Alias for /capabilities" },
    { name: "tools-catalog", description: "Alias for /capabilities" },
    { name: "tools-effective", description: "Show tools currently callable in this session" },
    { name: "agents-parallel", description: "Start multiple agent tasks concurrently" },
    { name: "parallel-agents", description: "Alias for /agents-parallel" },
    { name: "agents-parallel-status", description: "Show a parallel agent batch" },
    { name: "agents-parallel-list", description: "List recent parallel agent batches" },
    { name: "agents-parallel-cancel", description: "Cancel a parallel agent batch" },
    { name: "gateway-method", description: "Show a gateway JSON-RPC method contract" },
    { name: "method", description: "Alias for /gateway-method" },
    { name: "gateway-methods", description: "List discoverable gateway JSON-RPC methods" },
    { name: "methods", description: "Alias for /gateway-methods" },
    { name: "gateway-call", description: "Call any gateway JSON-RPC method with JSON params" },
    { name: "rpc", description: "Alias for /gateway-call" },
    { name: "tasks", description: "List business tasks" },
    { name: "task-list", description: "Alias for /tasks" },
    { name: "task-create", description: "Create and start a business task" },
    { name: "task-update", description: "Update a business task status/progress" },
    { name: "task-delete", description: "Delete a business task" },
    { name: "config", description: "Read backend configuration snapshot" },
    { name: "config-patch", description: "Merge a backend configuration patch" },
    { name: "logs", description: "Tail backend logs" },
    { name: "remote-models", description: "Probe a remote model endpoint" },
    { name: "skills", description: "Show skill system status" },
    { name: "skill-search", description: "Search installable skills" },
    { name: "agent-files", description: "List agent context files" },
    { name: "agent-file", description: "Read an agent context file" },
    { name: "agent-file-set", description: "Write an agent context file" },
    { name: "mcp-tools", description: "List configured MCP tools" },
    { name: "mcp", description: "Alias for /mcp-tools" },
    { name: "mcp-call", description: "Call a configured MCP tool" },
    { name: "experience-capture", description: "Persist a lesson from the current work" },
    { name: "remember", description: "Alias for /experience-capture" },
    { name: "experience-search", description: "Search experience and past conversations" },
    { name: "recall", description: "Alias for /experience-search" },
    { name: "session-recall", description: "Search cross-session memory with FTS5 recall" },
    { name: "memory-recall", description: "Alias for /session-recall" },
    { name: "experience-summary", description: "Show persistent experience summary" },
    { name: "skill-candidates", description: "List skill candidates learned from experience" },
    { name: "skills-candidates", description: "Alias for /skill-candidates" },
    { name: "skill-candidate-create", description: "Create a skill candidate from experience" },
    { name: "skill-usage-record", description: "Record and improve a skill candidate from use" },
    { name: "skill-export", description: "Export a skill candidate as agentskills.io SKILL.md" },
    { name: "strategy-memory", description: "Capture a periodic strategic push memory" },
    { name: "strategy-due", description: "List due periodic strategic pushes" },
    { name: "strategy-advance", description: "Mark a strategic push completed and schedule next cycle" },
    { name: "self-model", description: "Show persistent self model" },
    { name: "self-model-update", description: "Append a learned self-model pattern" },
    { name: "user-model-update", description: "Append a dialectic user model preference" },
    { name: "user-model", description: "Query the dialectic user model" },
    { name: "invoke-tool", description: "Ask the agent to use a named tool for a goal" },
    { name: "use-tool", description: "Alias for /invoke-tool" },
    { name: "voice", description: "Capture one voice input and submit it as natural language" },
    { name: "listen", description: "Alias for /voice" },
    { name: "agent", description: "Switch agent (or open picker)" },
    { name: "agents", description: "Open agent picker" },
    { name: "session", description: "Switch session (or open picker)" },
    { name: "sessions", description: "Open session picker" },
    {
      name: "model",
      description: "Set model (or open picker)",
    },
    { name: "models", description: "Open model picker" },
    {
      name: "think",
      description: "Set thinking level",
      getArgumentCompletions: (prefix) =>
        thinkLevels
          .filter((v) => v.startsWith(normalizeLowercaseStringOrEmpty(prefix)))
          .map((value) => ({ value, label: value })),
    },
    {
      name: "fast",
      description: "Set fast mode on/off",
      getArgumentCompletions: fastCompletions,
    },
    {
      name: "verbose",
      description: "Set verbose on/off",
      getArgumentCompletions: verboseCompletions,
    },
    {
      name: "trace",
      description: "Set trace on/off",
      getArgumentCompletions: traceCompletions,
    },
    {
      name: "reasoning",
      description: "Set reasoning on/off",
      getArgumentCompletions: reasoningCompletions,
    },
    {
      name: "usage",
      description: "Toggle per-response usage line",
      getArgumentCompletions: usageCompletions,
    },
    {
      name: "tools",
      description: "Show current tools or set tool output expanded/collapsed",
      getArgumentCompletions: createLevelCompletion([
        "compact",
        "verbose",
        "expanded",
        "collapsed",
        "on",
        "off",
      ]),
    },
    {
      name: "elevated",
      description: "Set elevated on/off/ask/full",
      getArgumentCompletions: elevatedCompletions,
    },
    {
      name: "elev",
      description: "Alias for /elevated",
      getArgumentCompletions: elevatedCompletions,
    },
    {
      name: "activation",
      description: "Set group activation",
      getArgumentCompletions: activationCompletions,
    },
    { name: "steer", description: "Interrupt and redirect the active run" },
    { name: "redirect", description: "Alias for /steer" },
    { name: "abort", description: "Abort active run" },
    { name: "new", description: "Reset the session" },
    { name: "reset", description: "Reset the session" },
    { name: "settings", description: "Open settings" },
    { name: "governance", description: "Toggle governance panel" },
    { name: "gov", description: "Alias for /governance" },
    { name: "exit", description: "Exit the TUI" },
    { name: "quit", description: "Exit the TUI" },
  ];

  const seen = new Set(commands.map((command) => command.name));
  const gatewayCommands = options.cfg ? listChatCommandsForConfig(options.cfg) : listChatCommands();
  for (const command of gatewayCommands) {
    const aliases = command.textAliases.length > 0 ? command.textAliases : [`/${command.key}`];
    for (const alias of aliases) {
      const name = alias.replace(/^\//, "").trim();
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      commands.push({ name, description: command.description });
    }
  }

  return commands;
}

export function helpText(options: SlashCommandOptions = {}): string {
  const thinkLevels = formatThinkingLevels(options.provider, options.model, "|");
  return [
    ASSISTANT_HELP_TEXT,
    "",
    "Slash commands:",
    "/help",
    "/robot",
    "/commands",
    "/status",
    "/gateway-status",
    "/gwstatus",
    "/capabilities or /abilities - Show full backend capability catalog",
    "/tools-effective - Show currently callable tools for this session",
    "/agents-parallel <agent: goal | agent: goal> - Start multiple agent tasks concurrently",
    "/agents-parallel-status <batchId> - Show parallel agent batch status",
    "/agents-parallel-list [limit] - List recent parallel agent batches",
    "/agents-parallel-cancel <batchId> - Cancel a parallel agent batch",
    "/gateway-method or /method <method> - Show params schema and runnable call template",
    "/gateway-methods or /methods [query] - List gateway JSON-RPC methods",
    "/gateway-call <method> [json_params] - Call any gateway JSON-RPC method",
    "/tasks [status] - List business tasks",
    "/task-create <name> | <goal> | <short|medium|long> | <high|medium|low> - Create and start a business task",
    "/task-update <id> | <status> | <progress> | <error> - Update a business task",
    "/task-delete <id> - Delete a business task",
    "/config - Read backend configuration",
    "/config-patch <json_object> - Merge a backend configuration patch",
    "/logs [limit] - Tail backend logs",
    "/remote-models <api> <endpoint> [provider] [apiKey] - Probe remote model endpoint",
    "/skills - Show skill system status",
    "/skill-search [query] - Search installable skills",
    "/agent-files [agentId] - List context files for an agent",
    "/agent-file <name> - Read current agent context file",
    "/agent-file-set <name> | <content> - Write current agent context file",
    "/mcp-tools or /mcp - List configured MCP tools",
    "/mcp-call <tool_name> [json_arguments] - Call a configured MCP tool",
    "/experience-capture or /remember <summary> - Persist a lesson from this work",
    "/experience-search or /recall <query> - Search experience and past conversations",
    "/session-recall or /memory-recall <query> - FTS5 cross-session recall with summary",
    "/experience-summary - Show persistent experience summary",
    "/skill-candidates - List proposed skills learned from experience",
    "/skill-candidate-create <title> | <trigger> | <step1, step2> - Create a skill candidate",
    "/skill-usage-record <candidateId> | <outcome> | <observation1, observation2> - Improve a skill from use",
    "/skill-export <candidateId> - Export agentskills.io-compatible SKILL.md",
    "/strategy-memory <title> | <objective> - Capture periodic strategic push memory",
    "/strategy-due - List due strategic pushes",
    "/strategy-advance <strategyId> - Mark strategic push completed and schedule next cycle",
    "/self-model - Show persistent self model",
    "/self-model-update <pattern> - Append a learned self-model pattern",
    "/user-model-update <preference> - Append a user model preference",
    "/user-model <query> - Dialectic user model query",
    "/invoke-tool <tool_name> <goal> - Ask the agent to use a named tool through function calling",
    "/voice or /listen - Capture one voice input and submit it as natural language",
    "/agent <id> (or /agents)",
    "/session <key> (or /sessions)",
    "/model <provider/model> (or /models)",
    `/think <${thinkLevels}>`,
    "/fast <status|on|off>",
    "/verbose <on|off>",
    "/trace <on|off>",
    "/reasoning <on|off>",
    "/usage <off|tokens|full>",
    "/tools [compact|verbose|expanded|collapsed]",
    "/elevated <on|off|ask|full>",
    "/elev <on|off|ask|full>",
    "/activation <mention|always>",
    "/steer <instruction> or /redirect <instruction> - Interrupt and redirect the active run",
    "/new or /reset",
    "/abort",
    "/governance or /gov - Toggle governance panel",
    "/settings",
    "/exit",
  ].join("\n");
}
