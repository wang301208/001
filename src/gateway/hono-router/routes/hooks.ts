import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";

export function registerHookRoutes(app: Hono<GatewayHonoEnv>): void {
  app.post("/hooks/wake", async (c) => {
    const gateway = c.get("gateway");
    gateway.log.info("hook wake request via hono router");
    return c.json({ ok: false, error: "Not yet migrated" }, 501);
  });

  app.post("/hooks/agent", async (c) => {
    const gateway = c.get("gateway");
    gateway.log.info("hook agent request via hono router");
    return c.json({ ok: false, error: "Not yet migrated" }, 501);
  });

  app.post("/hooks/*", async (c) => {
    const gateway = c.get("gateway");
    gateway.log.info("hook generic request via hono router");
    return c.json({ ok: false, error: "Not yet migrated" }, 501);
  });
}
