import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";

export function registerHealthRoutes(app: Hono<GatewayHonoEnv>): void {
  app.get("/health", (c) => {
    const gateway = c.get("gateway");
    const readiness = gateway.getReadiness?.();
    if (readiness?.ready === false) {
      return c.json({ ok: false, status: "live", failing: readiness.failing }, 503);
    }
    return c.json({ ok: true, status: "live" });
  });

  app.get("/healthz", (c) => {
    const gateway = c.get("gateway");
    const readiness = gateway.getReadiness?.();
    if (readiness?.ready === false) {
      return c.json({ ok: false, status: "live", failing: readiness.failing }, 503);
    }
    return c.json({ ok: true, status: "live" });
  });

  app.get("/ready", (c) => {
    const gateway = c.get("gateway");
    const readiness = gateway.getReadiness?.();
    if (!readiness?.ready) {
      return c.json(
        { ready: false, failing: readiness?.failing ?? ["unknown"], uptimeMs: 0 },
        503,
      );
    }
    return c.json({ ready: true, failing: [], uptimeMs: readiness.uptimeMs });
  });

  app.get("/readyz", (c) => {
    const gateway = c.get("gateway");
    const readiness = gateway.getReadiness?.();
    if (!readiness?.ready) {
      return c.json({ ready: false }, 503);
    }
    return c.json({ ready: true });
  });
}
