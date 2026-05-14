export type ZhushouAction =
  | {
      type: "tui.operation";
      operation: string;
      args?: string;
      raw?: string;
    }
  | {
      type: "gateway.call";
      method: string;
      params?: unknown;
      rawParams?: string;
    }
  | {
      type: "mcp.call";
      name: string;
      arguments?: Record<string, unknown>;
      rawArguments?: string;
    }
  | {
      type: "tool.invoke";
      toolName: string;
      goal: string;
    }
  | {
      type: "shell.run";
      command: string;
    };
