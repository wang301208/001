export type McpLoopbackRuntime = {
  port: number;
  token: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

export function clearActiveMcpLoopbackRuntime(token: string): void {
  if (activeRuntime?.token === token) {
    activeRuntime = undefined;
  }
}

export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      assistant: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${ASSISTANT_MCP_TOKEN}",
          "x-session-key": "${ASSISTANT_MCP_SESSION_KEY}",
          "x-assistant-agent-id": "${ASSISTANT_MCP_AGENT_ID}",
          "x-assistant-account-id": "${ASSISTANT_MCP_ACCOUNT_ID}",
          "x-assistant-message-channel": "${ASSISTANT_MCP_MESSAGE_CHANNEL}",
          "x-assistant-sender-is-owner": "${ASSISTANT_MCP_SENDER_IS_OWNER}",
        },
      },
    },
  };
}
