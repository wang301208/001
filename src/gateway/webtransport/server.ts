import type { EventBus } from "../event-bus/bus.js";

export type WebTransportSession = {
  id: string;
  protocol: "webtransport" | "websocket-fallback";
  remoteAddr?: string;
  sendDatagram(data: Uint8Array): void;
  receiveDatagrams(): ReadableStream<Uint8Array>;
  openBidirectionalStream(): Promise<WebTransportBidirectionalStream>;
  close(code?: number, reason?: string): void;
  closed: Promise<{ code: number; reason: string }>;
  ready: Promise<void>;
  getStats(): { datagramsSent: number; datagramsReceived: number; streamsOpened: number; createdAt: number };
};

export type WebTransportBidirectionalStream = {
  id: string;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  sendOrder?: number;
};

export type WebTransportServer = {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  onSession(handler: (session: WebTransportSession) => void): void;
  getStats(): { activeSessions: number; totalDatagramsSent: number; totalDatagramsReceived: number; totalStreamsOpened: number; wsFallbackSessions: number; nativeSessions: number };
  getSession(id: string): WebTransportSession | undefined;
  broadcastDatagram(data: Uint8Array): number;
};

export function createWebTransportServer(eventBus?: EventBus): WebTransportServer {
  const sessions = new Map<string, WebTransportSession>();
  let sessionHandler: ((session: WebTransportSession) => void) | null = null;

  return {
    async start(_port: number) {
      eventBus?.publish("webtransport.starting", { port: _port });
    },

    async stop() {
      for (const session of sessions.values()) {
        session.close(0, "server shutdown");
      }
      sessions.clear();
      eventBus?.publish("webtransport.stopped", {});
    },

    onSession(handler) {
      sessionHandler = handler;
    },

    getStats() {
      let totalDatagramsSent = 0;
      let totalDatagramsReceived = 0;
      let totalStreamsOpened = 0;
      let wsFallbackSessions = 0;
      let nativeSessions = 0;

      for (const session of sessions.values()) {
        const stats = session.getStats();
        totalDatagramsSent += stats.datagramsSent;
        totalDatagramsReceived += stats.datagramsReceived;
        totalStreamsOpened += stats.streamsOpened;
        if (session.protocol === "websocket-fallback") wsFallbackSessions++;
        else nativeSessions++;
      }

      return {
        activeSessions: sessions.size,
        totalDatagramsSent,
        totalDatagramsReceived,
        totalStreamsOpened,
        wsFallbackSessions,
        nativeSessions,
      };
    },

    getSession(id) {
      return sessions.get(id);
    },

    broadcastDatagram(data) {
      let sent = 0;
      for (const session of sessions.values()) {
        try {
          session.sendDatagram(data);
          sent++;
        } catch {
          // session可能已关闭
        }
      }
      return sent;
    },
  };
}

export function createWebTransportSessionFromWebSocket(
  ws: { send: (data: Buffer | Uint8Array | string) => void; on: (event: string, handler: (...args: unknown[]) => void) => void; close: (code?: number, reason?: string) => void },
  eventBus?: EventBus,
): WebTransportSession {
  const id = crypto.randomUUID();
  let datagramsSent = 0;
  let datagramsReceived = 0;
  let streamsOpened = 0;
  const createdAt = Date.now();

  const datagramBuffer: Uint8Array[] = [];
  let datagramController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const datagramStream = new ReadableStream<Uint8Array>({
    start(controller) {
      datagramController = controller;
      for (const buffered of datagramBuffer) {
        controller.enqueue(buffered);
      }
      datagramBuffer.length = 0;

      ws.on("message", (data: unknown) => {
        datagramsReceived++;
        const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : new TextEncoder().encode(String(data));
        if (datagramController) {
          datagramController.enqueue(bytes);
        } else {
          datagramBuffer.push(bytes);
        }
      });
    },
    cancel() {
      datagramController = null;
    },
  });

  let closedResolve: ((value: { code: number; reason: string }) => void) | null = null;
  const closedPromise = new Promise<{ code: number; reason: string }>((resolve) => {
    closedResolve = resolve;
  });

  ws.on("close", (code: unknown, reason: unknown) => {
    closedResolve?.({ code: Number(code) ?? 0, reason: String(reason) ?? "" });
    eventBus?.publish("webtransport.session-closed", { sessionId: id, code, protocol: "websocket-fallback" });
  });

  const session: WebTransportSession = {
    id,
    protocol: "websocket-fallback",
    sendDatagram(data) {
      datagramsSent++;
      ws.send(data);
    },
    receiveDatagrams() {
      return datagramStream;
    },
    async openBidirectionalStream() {
      streamsOpened++;
      const streamId = crypto.randomUUID();

      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          ws.on("message", (data: unknown) => {
            const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
            controller.enqueue(bytes);
          });
        },
      });

      const writable = new WritableStream<Uint8Array>({
        write(chunk) {
          ws.send(chunk);
        },
      });

      return { id: streamId, readable, writable };
    },
    close(code = 0, reason = "") {
      ws.close(code, reason);
    },
    closed: closedPromise,
    ready: Promise.resolve(),
    getStats() {
      return { datagramsSent, datagramsReceived, streamsOpened, createdAt };
    },
  };

  eventBus?.publish("webtransport.session-created", { sessionId: id, protocol: "websocket-fallback" });
  return session;
}

export function createWebSocketUpgradeHandler(wtServer: WebTransportServer) {
  return (ws: { send: (data: Buffer | Uint8Array | string) => void; on: (event: string, handler: (...args: unknown[]) => void) => void; close: (code?: number, reason?: string) => void }, req?: { headers?: Record<string, string | string[] | undefined> }) => {
    const session = createWebTransportSessionFromWebSocket(ws);
    const sessionsMap = (wtServer as unknown as { sessions: Map<string, WebTransportSession> }).sessions;
    if (sessionsMap) {
      sessionsMap.set(session.id, session);
    }

    session.closed.then(() => {
      if (sessionsMap) {
        sessionsMap.delete(session.id);
      }
    });

    const handler = (wtServer as unknown as { sessionHandler: ((s: WebTransportSession) => void) | null }).sessionHandler;
    if (handler) {
      handler(session);
    }
  };
}
