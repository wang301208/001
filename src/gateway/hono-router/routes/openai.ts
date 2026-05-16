import type { Hono, Context } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { RealHandlerDeps } from "./real-handlers.js";
import { registerRealOpenAiRoutes } from "./real-handlers.js";

export type { RealHandlerDeps };

export function registerOpenAiRoutes(app: Hono<GatewayHonoEnv>, deps?: RealHandlerDeps): void {
  if (deps) {
    registerRealOpenAiRoutes(app, deps);
    return;
  }
  app.post("/v1/chat/completions", async (c) => {
    return c.json({ error: { message: "OpenAI路由未配置真实handler依赖", type: "config_error" } }, 503);
  });
}
