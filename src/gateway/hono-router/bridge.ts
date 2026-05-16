import { Hono } from "hono";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayHonoEnv } from "./app.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerOpenAiRoutes } from "./routes/openai.js";
import { registerOpenResponsesRoutes } from "./routes/open-responses.js";
import { registerModelsRoutes } from "./routes/models.js";
import { registerEmbeddingsRoutes } from "./routes/embeddings.js";
import { registerToolsInvokeRoutes } from "./routes/tools-invoke.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerHookRoutes } from "./routes/hooks.js";
import { registerPluginRoutes } from "./routes/plugins.js";
import { registerCanvasRoutes } from "./routes/canvas.js";
import { registerAutonomousRoutes, type AutonomousEndpointDeps } from "./routes/autonomous.js";
import type { GatewayHonoContext } from "./app.js";
import { createGatewayHonoApp } from "./app.js";
import type { AutonomousMiddlewareDeps } from "./autonomous-middleware.js";

export type HonoBridgeConfig = GatewayHonoContext & {
  openAiChatCompletionsEnabled?: boolean;
  openResponsesEnabled?: boolean;
  autonomousMiddleware?: AutonomousMiddlewareDeps;
  autonomousEndpoints?: AutonomousEndpointDeps;
};

export function createHonoBridge(config: HonoBridgeConfig): {
  app: Hono<GatewayHonoEnv>;
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
} {
  const app = createGatewayHonoApp(config, config.autonomousMiddleware);

  registerHealthRoutes(app);
  registerMetricsRoutes(app);

  if (config.openAiChatCompletionsEnabled !== false) {
    registerOpenAiRoutes(app);
    registerModelsRoutes(app);
    registerEmbeddingsRoutes(app);
  }

  if (config.openResponsesEnabled !== false) {
    registerOpenResponsesRoutes(app);
  }

  registerToolsInvokeRoutes(app);
  registerSessionRoutes(app);
  registerHookRoutes(app);
  registerPluginRoutes(app);
  registerCanvasRoutes(app);

  if (config.autonomousEndpoints) {
    registerAutonomousRoutes(app, config.autonomousEndpoints);
  }

  app.all("*", (c) => {
    return c.json({ error: { message: "Not Found", type: "not_found" } }, 404);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const upgrade = (req.headers.upgrade ?? "").toLowerCase();
    if (upgrade === "websocket") {
      return false;
    }

    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();
    const host = req.headers.host ?? "localhost";
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      }
    }

    let body: ReadableStream<Uint8Array> | null = null;
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

    try {
      const webReq = new Request(`http://${host}${url}`, {
        method,
        headers,
        body,
        duplex: body ? "half" : undefined,
      } as RequestInit & { duplex?: string });

      const webRes = await app.fetch(webReq);

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
        await pump();
      } else {
        res.end();
      }
      return true;
    } catch {
      return false;
    }
  }

  return { app, handleRequest };
}
