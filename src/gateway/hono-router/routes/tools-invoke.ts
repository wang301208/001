import type { Hono, Context } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { ModelsHandlerDeps } from "./models.js";

async function delegateToHandler(c: Context<GatewayHonoEnv>, moduleName: string, handlerName: string, opts: Record<string, unknown>): Promise<Response> {
  try {
    const { createHonoToNodeAdapter } = await import("../hono-to-node-adapter.js");
    const mod = await import(`../../${moduleName}.js`);
    const handler = mod[handlerName];
    if (!handler) {
      return c.json({ ok: false, error: `handler ${handlerName} 不存在` }, 503);
    }
    return await createHonoToNodeAdapter(c, handler, opts);
  } catch (err) {
    return c.json({ ok: false, error: `${moduleName} 处理失败: ${String(err)}` }, 503);
  }
}

export function registerToolsInvokeRoutes(app: Hono<GatewayHonoEnv>, deps?: ModelsHandlerDeps): void {
  app.post("/tools/invoke", async (c) => {
    if (!deps) {
      return c.json({ ok: false, error: "Tools Invoke路由未配置handler依赖" }, 503);
    }
    return delegateToHandler(c, "tools-invoke-http", "handleToolsInvokeHttpRequest", {
      auth: deps.getResolvedAuth(),
      trustedProxies: deps.trustedProxies,
      allowRealIpFallback: deps.allowRealIpFallback,
      rateLimiter: deps.rateLimiter,
    });
  });
}
