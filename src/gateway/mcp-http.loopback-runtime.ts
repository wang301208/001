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
      zhushou: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${ZHUSHOU_MCP_TOKEN}",
          "x-session-key": "${ZHUSHOU_MCP_SESSION_KEY}",
          "x-zhushou-agent-id": "${ZHUSHOU_MCP_AGENT_ID}",
          "x-zhushou-account-id": "${ZHUSHOU_MCP_ACCOUNT_ID}",
          "x-zhushou-message-channel": "${ZHUSHOU_MCP_MESSAGE_CHANNEL}",
          "x-zhushou-sender-is-owner": "${ZHUSHOU_MCP_SENDER_IS_OWNER}",
        },
      },
    },
  };
}
