import { describe, expect, it, vi } from "vitest";
import { READ_SCOPE, WRITE_SCOPE } from "../method-scopes.js";
import { ErrorCodes } from "../protocol/index.js";
import { gatewayMethodsHandlers } from "./gateway-methods.js";

type RespondCall = [boolean, unknown?, { code: number; message: string }?];

async function invokeGatewayMethods(params: Record<string, unknown>) {
  const respond = vi.fn();
  await gatewayMethodsHandlers["gateway.methods"]({
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    req: { type: "req", id: "req-1", method: "gateway.methods" },
    isWebchatConnect: () => false,
  });
  return respond.mock.calls[0] as RespondCall | undefined;
}

async function invokeGatewayMethodDescribe(params: Record<string, unknown>) {
  const respond = vi.fn();
  await gatewayMethodsHandlers["gateway.method.describe"]({
    params,
    respond: respond as never,
    context: {} as never,
    client: null,
    req: { type: "req", id: "req-1", method: "gateway.method.describe" },
    isWebchatConnect: () => false,
  });
  return respond.mock.calls[0] as RespondCall | undefined;
}

describe("gateway.methods handler", () => {
  it("returns the discoverable gateway RPC methods with scope metadata", async () => {
    const call = await invokeGatewayMethods({});

    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as
      | {
          count: number;
          methods: Array<{ name: string; scope?: string; category: string }>;
        }
      | undefined;
    expect(payload?.count).toBe(payload?.methods.length);
    expect(payload?.methods.some((method) => method.name === "gateway.methods")).toBe(true);
    expect(payload?.methods.find((method) => method.name === "gateway.methods")).toMatchObject({
      scope: READ_SCOPE,
      category: "gateway",
    });
    expect(payload?.methods.find((method) => method.name === "business.tasks.list")).toMatchObject({
      scope: READ_SCOPE,
      category: "business",
    });
    expect(payload?.methods.find((method) => method.name === "agents.parallel.start")).toMatchObject({
      scope: WRITE_SCOPE,
      category: "agents",
    });
  });

  it("filters methods by query", async () => {
    const call = await invokeGatewayMethods({ query: "business.tasks" });

    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as
      | {
          query: string;
          methods: Array<{ name: string }>;
        }
      | undefined;
    expect(payload?.query).toBe("business.tasks");
    expect(payload?.methods.length).toBeGreaterThan(0);
    expect(payload?.methods.every((method) => method.name.includes("business.tasks"))).toBe(true);
  });

  it("rejects invalid params", async () => {
    const call = await invokeGatewayMethods({ query: 1 });

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("invalid gateway.methods params");
  });
});

describe("gateway.method.describe handler", () => {
  it("returns a method contract with params schema and a runnable gateway-call template", async () => {
    const call = await invokeGatewayMethodDescribe({ method: "business.tasks.list" });

    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as
      | {
          method: { name: string; scope?: string; category: string };
          paramsSchema?: { type?: string; properties?: Record<string, unknown> };
          callTemplate: string;
          exampleParams: Record<string, unknown>;
        }
      | undefined;
    expect(payload?.method).toMatchObject({
      name: "business.tasks.list",
      scope: READ_SCOPE,
      category: "business",
    });
    expect(payload?.paramsSchema?.properties).toHaveProperty("status");
    expect(payload?.paramsSchema?.properties).toHaveProperty("limit");
    expect(payload?.exampleParams).toEqual({ status: "running", limit: 20 });
    expect(payload?.callTemplate).toContain("/gateway-call business.tasks.list");
    expect(payload?.callTemplate).toContain('"status": "running"');
  });

  it("rejects unknown methods", async () => {
    const call = await invokeGatewayMethodDescribe({ method: "missing.method" });

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("unknown gateway method");
  });

  it("describes the parallel agent batch contract", async () => {
    const call = await invokeGatewayMethodDescribe({ method: "agents.parallel.start" });

    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as
      | {
          method: { name: string; scope?: string; category: string };
          paramsSchema?: { type?: string; properties?: Record<string, unknown> };
          resultSchema?: { type?: string; properties?: Record<string, unknown> };
          callTemplate: string;
        }
      | undefined;
    expect(payload?.method).toMatchObject({
      name: "agents.parallel.start",
      scope: WRITE_SCOPE,
      category: "agents",
    });
    expect(payload?.paramsSchema?.properties).toHaveProperty("tasks");
    expect(payload?.resultSchema?.properties).toHaveProperty("batchId");
    expect(payload?.callTemplate).toContain("/gateway-call agents.parallel.start");
  });

  it("rejects invalid params", async () => {
    const call = await invokeGatewayMethodDescribe({});

    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("invalid gateway.method.describe params");
  });
});
