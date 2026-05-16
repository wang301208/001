import type { Hono, Context } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { RealHandlerDeps } from "./real-handlers.js";

async function delegateToHandler(c: Context<GatewayHonoEnv>, moduleName: string, handlerName: string, opts: Record<string, unknown>): Promise<Response> {
  try {
    const { createHonoToNodeAdapter } = await import("../hono-to-node-adapter.js");
    const mod = await import(`../../${moduleName}.js`);
    const handler = mod[handlerName];
    if (!handler) {
      return c.json({ error: { message: `handler ${handlerName} 不存在`, type: "module_error" } }, 503);
    }
    return await createHonoToNodeAdapter(c, handler, opts);
  } catch (err) {
    return c.json({ error: { message: `${moduleName} 处理失败: ${String(err)}`, type: "delegate_error" } }, 503);
  }
}

export type ModelsHandlerDeps = {
  resolvedAuth: RealHandlerDeps["resolvedAuth"];
  getResolvedAuth: RealHandlerDeps["getResolvedAuth"];
  rateLimiter?: RealHandlerDeps["rateLimiter"];
  trustedProxies: RealHandlerDeps["trustedProxies"];
  allowRealIpFallback: RealHandlerDeps["allowRealIpFallback"];
};

export function registerModelsRoutes(app: Hono<GatewayHonoEnv>, deps?: ModelsHandlerDeps): void {
  app.get("/v1/models", async (c) => {
    if (!deps) {
      return c.json({ object: "list", data: [] });
    }
    return delegateToHandler(c, "models-http", "handleOpenAiModelsHttpRequest", {
      auth: deps.getResolvedAuth(),
      trustedProxies: deps.trustedProxies,
      allowRealIpFallback: deps.allowRealIpFallback,
      rateLimiter: deps.rateLimiter,
    });
  });

  app.get("/v1/models/:modelId", async (c) => {
    const modelId = c.req.param("modelId");
    return c.json({ id: modelId, object: "model", owned_by: "system" });
  });
}
