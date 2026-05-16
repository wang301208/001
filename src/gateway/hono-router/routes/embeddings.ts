import type { Hono, Context } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { ModelsHandlerDeps } from "./models.js";

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

export function registerEmbeddingsRoutes(app: Hono<GatewayHonoEnv>, deps?: ModelsHandlerDeps): void {
  app.post("/v1/embeddings", async (c) => {
    if (!deps) {
      return c.json({ error: { message: "Embeddings路由未配置handler依赖", type: "config_error" } }, 503);
    }
    return delegateToHandler(c, "embeddings-http", "handleOpenAiEmbeddingsHttpRequest", {
      auth: deps.getResolvedAuth(),
      trustedProxies: deps.trustedProxies,
      allowRealIpFallback: deps.allowRealIpFallback,
      rateLimiter: deps.rateLimiter,
    });
  });
}
