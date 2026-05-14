import { describe, expect, it, vi } from "vitest";
import { CLI_DEFAULT_OPERATOR_SCOPES } from "./method-scopes.js";
import type { GatewayRequestContext, GatewayRequestOptions } from "./server-methods/types.js";
import { handleGatewayStdioRequest } from "./stdio-bridge.js";

describe("handleGatewayStdioRequest", () => {
  it("dispatches JSON-RPC requests directly through Node gateway handlers", async () => {
    const invokeGatewayRequest = vi.fn(async (opts: GatewayRequestOptions) => {
      opts.respond(true, { method: opts.req.method, params: opts.req.params }, undefined);
    });
    const context = {} as GatewayRequestContext;

    const response = await handleGatewayStdioRequest({
      request: {
        id: "r1",
        jsonrpc: "2.0",
        method: "gateway.methods",
        params: { query: "auto" },
      },
      context,
      invokeGatewayRequest,
    });

    expect(response).toEqual({
      id: "r1",
      jsonrpc: "2.0",
      result: { method: "gateway.methods", params: { query: "auto" } },
    });
    expect(invokeGatewayRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        req: {
          type: "req",
          id: "r1",
          method: "gateway.methods",
          params: { query: "auto" },
        },
        context,
        client: expect.objectContaining({
          connId: "stdio-tui",
          connect: expect.objectContaining({
            role: "operator",
            scopes: CLI_DEFAULT_OPERATOR_SCOPES,
          }),
        }),
      }),
    );
  });

  it("converts gateway handler errors into JSON-RPC error frames", async () => {
    const response = await handleGatewayStdioRequest({
      request: {
        id: "r2",
        jsonrpc: "2.0",
        method: "missing",
      },
      context: {} as GatewayRequestContext,
      invokeGatewayRequest: async (opts) => {
        opts.respond(false, undefined, { code: "INVALID_REQUEST", message: "unknown method" });
      },
    });

    expect(response).toEqual({
      id: "r2",
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "unknown method",
        details: { code: "INVALID_REQUEST" },
      },
    });
  });
});
