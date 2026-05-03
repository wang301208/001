import { WebSocket } from "ws";
import { captureEnv } from "../test-utils/env.js";
import {
  connectOk,
  getFreePort,
  startGatewayServer,
  trackConnectChallengeNonce,
} from "./test-helpers.server.js";

export type GatewayWsClient = {
  ws: WebSocket;
  hello: unknown;
};

export type GatewayServerHarness = {
  port: number;
  server: Awaited<ReturnType<typeof startGatewayServer>>;
  openClient: (opts?: Parameters<typeof connectOk>[1]) => Promise<GatewayWsClient>;
  close: () => Promise<void>;
};

async function closeTrackedClient(ws: WebSocket, timeoutMs = 2_000): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      ws.off("close", onClose);
      ws.off("error", onError);
      resolve();
    };
    const onClose = () => {
      finish();
    };
    const onError = () => {
      finish();
    };
    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {
        // ignore forced-close failures during harness shutdown
      }
      finish();
    }, timeoutMs);
    timer.unref?.();
    ws.once("close", onClose);
    ws.once("error", onError);
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    } catch {
      finish();
    }
  });
}

export async function startGatewayServerHarness(options?: {
  minimalGateway?: boolean;
}): Promise<GatewayServerHarness> {
  const envSnapshot = captureEnv(["ZHUSHOU_GATEWAY_TOKEN", "OPENCLAW_TEST_MINIMAL_GATEWAY"]);
  delete process.env.ZHUSHOU_GATEWAY_TOKEN;
  if (options?.minimalGateway === true) {
    process.env.OPENCLAW_TEST_MINIMAL_GATEWAY = "1";
  } else if (options?.minimalGateway === false) {
    delete process.env.OPENCLAW_TEST_MINIMAL_GATEWAY;
  }
  const port = await getFreePort();
  const server = await startGatewayServer(port, {
    auth: { mode: "none" },
    controlUiEnabled: false,
  });
  const clients = new Set<WebSocket>();

  const openClient = async (opts?: Parameters<typeof connectOk>[1]): Promise<GatewayWsClient> => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.add(ws);
    ws.once("close", () => {
      clients.delete(ws);
    });
    trackConnectChallengeNonce(ws);
    await new Promise<void>((resolve) => ws.once("open", resolve));
    try {
      const hello = await connectOk(ws, opts);
      return { ws, hello };
    } catch (error) {
      await closeTrackedClient(ws);
      throw error;
    }
  };

  const close = async () => {
    try {
      await server.close();
      await Promise.allSettled([...clients].map((ws) => closeTrackedClient(ws)));
    } finally {
      envSnapshot.restore();
    }
  };

  return { port, server, openClient, close };
}
