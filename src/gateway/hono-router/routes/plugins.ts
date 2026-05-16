import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";

export function registerPluginRoutes(app: Hono<GatewayHonoEnv>): void {
  app.all("/plugins/*", async (c) => {
    const gateway = c.get("gateway");
    gateway.log.info(`plugin request: ${c.req.path}`);
    return c.json({ ok: false, error: "Not yet migrated" }, 501);
  });
}
