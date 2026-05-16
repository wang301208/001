import type { Context, Next } from "hono";
import type { GatewayHonoEnv } from "./app.js";
import { createEffectRequestHandler, type RequestContext } from "../effect-core/request-flow.js";

export type EffectMiddlewareConfig = {
  enabled: boolean;
  modelId?: string;
  channelId?: string;
  sessionId?: string;
};

let handler: ReturnType<typeof createEffectRequestHandler> | null = null;
let initialized = false;

export function createEffectMiddleware(config: EffectMiddlewareConfig) {
  return {
    middleware: async (c: Context<GatewayHonoEnv>, next: Next) => {
      if (!config.enabled) {
        await next();
        return;
      }

      if (!initialized) {
        handler = createEffectRequestHandler();
        await handler.initialize(
          c.get("gateway"),
          config.modelId ?? "default",
          config.channelId ?? "default",
          config.sessionId ?? "default",
        );
        initialized = true;
      }

      const ctx: RequestContext = {
        requestId: c.req.header("X-Request-Id") ?? crypto.randomUUID(),
        method: c.req.method,
        path: c.req.path,
        clientIp: c.get("clientIp") ?? c.req.header("X-Forwarded-For") ?? "unknown",
        startedAt: c.get("requestStartTime") ?? performance.now(),
      };

      c.set("effectRequestContext" as never, ctx as never);

      const start = performance.now();
      c.header("X-Effect-Flow", "active");

      await next();

      const duration = performance.now() - start;
      c.header("X-Effect-Duration", `${duration.toFixed(2)}ms`);
    },

    async shutdown() {
      if (handler) {
        await handler.shutdown();
        handler = null;
        initialized = false;
      }
    },

    getHandler() {
      return handler;
    },

    async getMetrics() {
      if (!handler) return null;
      return handler.getMetrics();
    },
  };
}
