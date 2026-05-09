import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayHttpServer } from "./server-http.js";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({})),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

async function listenOnRandomPort(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return address.port;
}

describe("gateway HTTP probes", () => {
  const servers: Array<ReturnType<typeof createGatewayHttpServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
    mocks.loadConfig.mockClear();
  });

  it("answers health probes before loading runtime config", async () => {
    mocks.loadConfig.mockImplementation(() => {
      throw new Error("loadConfig should not run for gateway probes");
    });
    const server = createGatewayHttpServer({
      canvasHost: null,
      clients: new Set(),
      openAiChatCompletionsEnabled: false,
      openResponsesEnabled: false,
      handleHooksRequest: async () => false,
      resolvedAuth: { mode: "none", allowTailscale: false },
      getResolvedAuth: () => {
        throw new Error("getResolvedAuth should not run for gateway probes");
      },
    });
    servers.push(server);
    const port = await listenOnRandomPort(server);

    const response = await fetch(`http://127.0.0.1:${port}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "live" });
    expect(mocks.loadConfig).not.toHaveBeenCalled();
    mocks.loadConfig.mockImplementation(() => ({}));
  });

  it("does not host removed web console routes from the gateway listener", async () => {
    const server = createGatewayHttpServer({
      canvasHost: null,
      clients: new Set(),
      openAiChatCompletionsEnabled: false,
      openResponsesEnabled: false,
      handleHooksRequest: async () => false,
      resolvedAuth: { mode: "none", allowTailscale: false },
    });
    servers.push(server);
    const port = await listenOnRandomPort(server);

    for (const path of ["/", "/settings", "/assets/single-port-test.js"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      expect(response.status, path).toBe(404);
      await expect(response.text(), path).resolves.toBe("Not Found");
    }
  });
});
