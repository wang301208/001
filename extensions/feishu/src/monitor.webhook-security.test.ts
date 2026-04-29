import { createConnection } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFeishuClientMockModule,
  createFeishuRuntimeMockModule,
} from "./monitor.test-mocks.js";
import {
  buildWebhookConfig,
  getFreePort,
  withRunningWebhookMonitor,
} from "./monitor.webhook.test-helpers.js";

const probeFeishuMock = vi.hoisted(() => vi.fn());

vi.mock("./probe.js", () => ({
  probeFeishu: probeFeishuMock,
}));

vi.mock("./client.js", () => createFeishuClientMockModule());
vi.mock("./runtime.js", () => createFeishuRuntimeMockModule());

vi.mock("@larksuiteoapi/node-sdk", () => ({
  adaptDefault: vi.fn(
    () => (_req: unknown, res: { statusCode?: number; end: (s: string) => void }) => {
      res.statusCode = 200;
      res.end("ok");
    },
  ),
}));

import type { RuntimeEnv } from "../runtime-api.js";
import {
  clearFeishuWebhookRateLimitStateForTest,
  getFeishuWebhookRateLimitStateSizeForTest,
  isWebhookRateLimitedForTest,
  monitorFeishuProvider,
  stopFeishuMonitor,
} from "./monitor.js";
import { monitorWebhook } from "./monitor.transport.js";
import type { ResolvedFeishuAccount } from "./types.js";

async function waitForSlowBodyTimeoutResponse(
  url: string,
  timeoutMs: number,
): Promise<{ body: string; elapsedMs: number }> {
  return await new Promise<{ body: string; elapsedMs: number }>((resolve, reject) => {
    const target = new URL(url);
    const startedAt = Date.now();
    let response = "";
    const socket = createConnection(
      {
        host: target.hostname,
        port: Number(target.port),
      },
      () => {
        socket.write(`POST ${target.pathname} HTTP/1.1\r\n`);
        socket.write(`Host: ${target.hostname}\r\n`);
        socket.write("Content-Type: application/json\r\n");
        socket.write("Content-Length: 65536\r\n");
        socket.write("\r\n");
        socket.write('{"type":"url_verification"');
      },
    );

    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      response += chunk;
      if (response.includes("Request body timeout")) {
        clearTimeout(failTimer);
        socket.destroy();
        resolve({ body: response, elapsedMs: Date.now() - startedAt });
      }
    });

    const failTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`timeout response did not arrive within ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function sendWebhookRequestAndCaptureRawResponse(params: {
  url: string;
  contentLength: number;
  bodyPrefix?: string;
  timeoutMs: number;
}): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const target = new URL(params.url);
    let response = "";
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(failTimer);
      socket.destroy();
      handler();
    };
    const socket = createConnection(
      {
        host: target.hostname,
        port: Number(target.port),
      },
      () => {
        socket.write(`POST ${target.pathname} HTTP/1.1\r\n`);
        socket.write(`Host: ${target.hostname}\r\n`);
        socket.write("Content-Type: application/json\r\n");
        socket.write("Connection: close\r\n");
        socket.write(`Content-Length: ${params.contentLength}\r\n`);
        socket.write("\r\n");
        if (params.bodyPrefix) {
          socket.write(params.bodyPrefix);
        }
      },
    );

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      response += chunk;
      if (response.includes("Payload too large")) {
        finish(() => resolve(response));
      }
    });
    socket.on("error", (error) => {
      if (response.includes("Payload too large")) {
        finish(() => resolve(response));
        return;
      }
      finish(() => reject(error));
    });
    socket.on("close", () => {
      if (response) {
        finish(() => resolve(response));
        return;
      }
      finish(() => reject(new Error("connection closed before webhook response was captured")));
    });

    const failTimer = setTimeout(() => {
      finish(() => reject(new Error(`raw webhook response did not arrive within ${params.timeoutMs}ms`)));
    }, params.timeoutMs);
  });
}

afterEach(() => {
  clearFeishuWebhookRateLimitStateForTest();
  stopFeishuMonitor();
});

describe("Feishu webhook security hardening", () => {
  it("rejects webhook mode without verificationToken", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });

    const cfg = buildWebhookConfig({
      accountId: "missing-token",
      path: "/hook-missing-token",
      port: await getFreePort(),
    });

    await expect(monitorFeishuProvider({ config: cfg })).rejects.toThrow(
      /requires verificationToken/i,
    );
  });

  it("rejects webhook mode without encryptKey", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });

    const cfg = buildWebhookConfig({
      accountId: "missing-encrypt-key",
      path: "/hook-missing-encrypt",
      port: await getFreePort(),
      verificationToken: "verify_token",
    });

    await expect(monitorFeishuProvider({ config: cfg })).rejects.toThrow(/requires encryptKey/i);
  });

  it("refuses to start the webhook transport without encryptKey", async () => {
    const account = {
      accountId: "transport-missing-encrypt-key",
      config: {
        enabled: true,
        connectionMode: "webhook",
        webhookHost: "127.0.0.1",
        webhookPort: await getFreePort(),
        webhookPath: "/hook-transport-missing-encrypt",
      },
    } as ResolvedFeishuAccount;

    await expect(
      monitorWebhook({
        account,
        accountId: account.accountId,
        runtime: {
          log: vi.fn(),
          error: vi.fn(),
          exit: vi.fn(),
        } as RuntimeEnv,
        abortSignal: new AbortController().signal,
        eventDispatcher: {} as never,
      }),
    ).rejects.toThrow(/requires encryptKey/i);
  });

  it("returns 415 for POST requests without json content type", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });
    await withRunningWebhookMonitor(
      {
        accountId: "content-type",
        path: "/hook-content-type",
        verificationToken: "verify_token",
        encryptKey: "encrypt_key",
      },
      monitorFeishuProvider,
      async (url) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "{}",
        });

        expect(response.status).toBe(415);
        expect(await response.text()).toBe("Unsupported Media Type");
      },
    );
  });

  it("rejects oversized unsigned webhook bodies with 413 before signature verification", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });
    await withRunningWebhookMonitor(
      {
        accountId: "payload-too-large",
        path: "/hook-payload-too-large",
        verificationToken: "verify_token",
        encryptKey: "encrypt_key",
      },
      monitorFeishuProvider,
      async (url) => {
        const response = await sendWebhookRequestAndCaptureRawResponse({
          url,
          contentLength: Buffer.byteLength('{"payload":"') + 70 * 1024 + Buffer.byteLength('"}'),
          bodyPrefix: '{"payload":"',
          timeoutMs: 15_000,
        });

        expect(response).toContain("413 Payload Too Large");
        expect(response).toContain("Payload too large");
      },
    );
  });

  it("drops slow-body webhook requests within the tightened pre-auth timeout", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });
    await withRunningWebhookMonitor(
      {
        accountId: "slow-body-timeout",
        path: "/hook-slow-body-timeout",
        verificationToken: "verify_token",
        encryptKey: "encrypt_key",
      },
      monitorFeishuProvider,
      async (url) => {
        const result = await waitForSlowBodyTimeoutResponse(url, 15_000);
        expect(result.body).toContain("408 Request Timeout");
        expect(result.body).toContain("Request body timeout");
        expect(result.elapsedMs).toBeLessThan(12_000);
      },
    );
  });

  it("rate limits webhook burst traffic with 429", async () => {
    probeFeishuMock.mockResolvedValue({ ok: true, botOpenId: "bot_open_id" });
    await withRunningWebhookMonitor(
      {
        accountId: "rate-limit",
        path: "/hook-rate-limit",
        verificationToken: "verify_token",
        encryptKey: "encrypt_key",
      },
      monitorFeishuProvider,
      async (url) => {
        let saw429 = false;
        for (let i = 0; i < 130; i += 1) {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "{}",
          });
          if (response.status === 429) {
            saw429 = true;
            expect(await response.text()).toBe("Too Many Requests");
            break;
          }
        }

        expect(saw429).toBe(true);
      },
    );
  });

  it("caps tracked webhook rate-limit keys to prevent unbounded growth", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4_500; i += 1) {
      isWebhookRateLimitedForTest(`/feishu-rate-limit:key-${i}`, now);
    }
    expect(getFeishuWebhookRateLimitStateSizeForTest()).toBeLessThanOrEqual(4_096);
  });

  it("prunes stale webhook rate-limit state after window elapses", () => {
    const now = 2_000_000;
    for (let i = 0; i < 100; i += 1) {
      isWebhookRateLimitedForTest(`/feishu-rate-limit-stale:key-${i}`, now);
    }
    expect(getFeishuWebhookRateLimitStateSizeForTest()).toBe(100);

    isWebhookRateLimitedForTest("/feishu-rate-limit-stale:fresh", now + 60_001);
    expect(getFeishuWebhookRateLimitStateSizeForTest()).toBe(1);
  });
});
