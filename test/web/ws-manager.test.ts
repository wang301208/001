import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SentFrame = Record<string, unknown>;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  sent: SentFrame[] = [];

  send(data: string) {
    this.sent.push(JSON.parse(data) as SentFrame);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

async function loadManager() {
  vi.resetModules();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  const { wsManager } = await import("../../web/src/services/ws-manager");
  return wsManager as typeof wsManager & Record<string, any>;
}

describe("web WebSocket manager protocol handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("dispatches gateway event frames using top-level event and payload fields", async () => {
    const wsManager = await loadManager();
    const handler = vi.fn();

    const unsubscribe = wsManager.onEvent("session.*", handler);
    wsManager.handleMessage({
      type: "event",
      event: "session.message",
      payload: { messageId: "m1" },
    });

    expect(handler).toHaveBeenCalledWith({
      type: "session.message",
      payload: { messageId: "m1" },
    });
    unsubscribe();
  });

  it("resolves RPC responses with the response payload", async () => {
    const wsManager = await loadManager();
    const socket = new FakeWebSocket();
    wsManager.ws = socket;
    wsManager.authenticated = true;

    const response = wsManager.request("channels.status", {}, 1_000);
    const requestFrame = socket.sent[0];
    wsManager.handleMessage({
      type: "res",
      id: requestFrame.id,
      ok: true,
      payload: { channels: [] },
    });

    await expect(response).resolves.toEqual({ channels: [] });
  });

  it("uses RPC subscription methods instead of unsupported top-level subscribe frames", async () => {
    const wsManager = await loadManager();
    const socket = new FakeWebSocket();
    wsManager.ws = socket;
    wsManager.authenticated = true;

    wsManager.subscribe("session.*");
    wsManager.unsubscribe("session.*");

    expect(socket.sent).toEqual([
      expect.objectContaining({ type: "req", method: "sessions.subscribe" }),
      expect.objectContaining({ type: "req", method: "sessions.unsubscribe" }),
    ]);
  });

  it("does not send unsupported heartbeat frames", async () => {
    const wsManager = await loadManager();
    const socket = new FakeWebSocket();
    wsManager.ws = socket;

    wsManager.startHeartbeat();
    vi.advanceTimersByTime(30_000);

    expect(socket.sent).toEqual([]);
  });
});
