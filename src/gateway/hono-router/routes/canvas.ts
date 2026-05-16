import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";

export function registerCanvasRoutes(app: Hono<GatewayHonoEnv>): void {
  app.get("/canvas/*", async (c) => {
    const gateway = c.get("gateway");
    gateway.log.info(`canvas request: ${c.req.path}`);
    return c.json({ ok: false, error: "Not yet migrated" }, 501);
  });
}
