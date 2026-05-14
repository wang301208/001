/**
 * 独立 MCP 服务器，暴露助手插件注册的工具
 * （如 memory-lancedb 的 memory_recall、memory_store、memory_forget）
 * 以便运行 Claude Code 的 ACP 会话可以使用它们。
 *
 * 运行方式：node --import tsx src/mcp/plugin-tools-serve.ts
 * 或：bun src/mcp/plugin-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  isToolWrappedWithBeforeToolCallHook,
  wrapToolWithBeforeToolCallHook,
} from "../agents/pi-tools.before-tool-call.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { loadConfig } from "../config/config.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { formatErrorMessage } from "../infra/errors.js";
import { routeLogsToStderr } from "../logging/console.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { VERSION } from "../version.js";

function resolveJsonSchemaForTool(tool: AnyAgentTool): Record<string, unknown> {
  const params = tool.parameters;
  if (params && typeof params === "object" && "type" in params) {
    return params as Record<string, unknown>;
  }
  // 回退：接受任意对象
  return { type: "object", properties: {} };
}

function resolveTools(config: ZhushouConfig): AnyAgentTool[] {
  return resolvePluginTools({
    context: { config },
    suppressNameConflicts: true,
  });
}

export function createPluginToolsMcpServer(
  params: {
    config?: ZhushouConfig;
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const cfg = params.config ?? loadConfig();
  const tools = (params.tools ?? resolveTools(cfg)).map((tool) => {
    if (isToolWrappedWithBeforeToolCallHook(tool)) {
      return tool;
    }
    // ACPX MCP 桥接应强制与 Agent 和 HTTP 工具执行路径
    // 相同的预执行钩子边界。
    return wrapToolWithBeforeToolCallHook(tool);
  });

  const toolMap = new Map<string, AnyAgentTool>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  const server = new Server(
    { name: "zhushou-plugin-tools", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: resolveJsonSchemaForTool(tool),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolMap.get(request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }
    try {
      const result = await tool.execute(`mcp-${Date.now()}`, request.params.arguments ?? {});
      return {
        content: Array.isArray(result.content)
          ? result.content
          : [{ type: "text", text: String(result.content) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Tool error: ${formatErrorMessage(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function servePluginToolsMcp(): Promise<void> {
  // MCP stdio 要求 stdout 仅保留协议内容。
  routeLogsToStderr();

  const config = loadConfig();
  const tools = resolveTools(config);
  const server = createPluginToolsMcpServer({ config, tools });
  if (tools.length === 0) {
    process.stderr.write("plugin-tools-serve: no plugin tools found\n");
  }

  const transport = new StdioServerTransport();

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdin.off("end", shutdown);
    process.stdin.off("close", shutdown);
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    void server.close();
  };

  process.stdin.once("end", shutdown);
  process.stdin.once("close", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await server.connect(transport);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  servePluginToolsMcp().catch((err) => {
    process.stderr.write(`plugin-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
