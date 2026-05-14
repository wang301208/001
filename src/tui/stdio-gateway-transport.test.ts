import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  StdioGatewayTransport,
  type StdioGatewayTransportOptions,
} from "./stdio-gateway-transport.js";

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    killed: boolean;
    exitCode: number | null;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.exitCode = null;
  child.kill = vi.fn(() => {
    child.killed = true;
    child.exitCode = 0;
    child.emit("exit", 0);
    return true;
  });
  return child;
}

describe("StdioGatewayTransport", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("spawns the Node stdio gateway bridge by default", () => {
    const child = createFakeChild();
    const spawn = vi.fn(
      () => child as ReturnType<NonNullable<StdioGatewayTransportOptions["spawn"]>>,
    );
    const transport = new StdioGatewayTransport({
      spawn,
      startupTimeoutMs: 1000,
      requestTimeoutMs: 1000,
    });

    transport.start();

    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      ["zhushou.mjs", "stdio-gateway"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: expect.objectContaining({
          ZHUSHOU_STDIO_GATEWAY_BRIDGE: "1",
        }),
      }),
    );

    transport.stop();
  });

  it("uses zhushou JSON-RPC lines over child stdin/stdout", async () => {
    const child = createFakeChild();
    const writes: string[] = [];
    child.stdin.on("data", (chunk) => writes.push(String(chunk)));
    const spawn = vi.fn(
      () => child as ReturnType<NonNullable<StdioGatewayTransportOptions["spawn"]>>,
    );
    const transport = new StdioGatewayTransport({
      spawn,
      startupTimeoutMs: 1000,
      requestTimeoutMs: 1000,
      resolveProcess: () => ({
        command: process.execPath,
        args: ["zhushou.mjs", "stdio-gateway"],
        cwd: process.cwd(),
      }),
    });

    transport.start();
    const request = transport.request("status", { verbose: true });

    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      ["zhushou.mjs", "stdio-gateway"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      }),
    );

    const outbound = JSON.parse(writes.join("").trim()) as {
      id: string;
      jsonrpc: string;
      method: string;
      params: unknown;
    };
    expect(outbound).toMatchObject({
      jsonrpc: "2.0",
      method: "status",
      params: { verbose: true },
    });

    child.stdout.write(
      `${JSON.stringify({ id: outbound.id, jsonrpc: "2.0", result: { ok: true } })}\n`,
    );

    await expect(request).resolves.toEqual({ ok: true });
  });

  it("publishes gateway.ready as the connected signal", async () => {
    const child = createFakeChild();
    const transport = new StdioGatewayTransport({
      spawn: vi.fn(() => child) as NonNullable<StdioGatewayTransportOptions["spawn"]>,
      startupTimeoutMs: 1000,
      requestTimeoutMs: 1000,
      resolveProcess: () => ({
        command: process.execPath,
        args: ["zhushou.mjs", "stdio-gateway"],
      }),
    });
    const connected = vi.fn();
    const events: Array<{ event: string; payload?: unknown }> = [];
    transport.onConnected = connected;
    transport.onEvent = (evt) => events.push(evt);

    transport.start();
    child.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: { type: "gateway.ready", payload: { url: "stdio://local-gateway" } },
      })}\n`,
    );
    child.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: { type: "chat", payload: { state: "delta" } },
      })}\n`,
    );

    await vi.waitFor(() => expect(connected).toHaveBeenCalledTimes(1));
    expect(events).toEqual([{ event: "chat", payload: { state: "delta" } }]);
  });

  it("uses Chinese user-facing errors for stdio gateway failures", async () => {
    const child = createFakeChild();
    const spawn = vi.fn(
      () => child as ReturnType<NonNullable<StdioGatewayTransportOptions["spawn"]>>,
    );
    const transport = new StdioGatewayTransport({
      spawn,
      startupTimeoutMs: 1000,
      requestTimeoutMs: 10,
      resolveProcess: () => ({
        command: process.execPath,
        args: ["zhushou.mjs", "stdio-gateway"],
      }),
    });

    transport.start();
    await expect(transport.request("status")).rejects.toThrow("stdio 网关请求超时: status");
    transport.stop();
  });
});
