import type { Hono } from "hono";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayHonoEnv } from "./app.js";

export function createHonoNodeHandler(app: Hono<GatewayHonoEnv>): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      }
    }

    let body: ReadableStream<Uint8Array> | undefined;
    if (method !== "GET" && method !== "HEAD" && req.readable) {
      body = new ReadableStream({
        start(controller) {
          req.on("data", (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          });
          req.on("end", () => {
            controller.close();
          });
          req.on("error", (err) => {
            controller.error(err);
          });
        },
      });
    }

    const webReq = new Request(`http://${headers.host ?? "localhost"}${url}`, {
      method,
      headers: new Headers(headers),
      body,
      duplex: "half",
    } as RequestInit);

    app.fetch(webReq).then((webRes) => {
      res.statusCode = webRes.status;
      for (const [key, value] of webRes.headers.entries()) {
        res.setHeader(key, value);
      }
      if (webRes.body) {
        const reader = webRes.body.getReader();
        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              res.end();
              return;
            }
            res.write(value);
            return pump();
          });
        pump().catch((err) => {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      } else {
        res.end();
      }
    }).catch((err) => {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { message: "Internal Server Error", type: "internal_error" } }));
      }
    });
  };
}
