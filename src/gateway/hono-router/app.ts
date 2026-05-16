import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { ResolvedGatewayAuth } from "../auth.js";
import type { AuthRateLimiter } from "../auth-rate-limit.js";
import type { ReadinessChecker } from "./../server/readiness.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { AutonomousMiddlewareDeps } from "./autonomous-middleware.js";
import { createAutonomousMiddlewares } from "./autonomous-middleware.js";
import type { EffectMiddlewareConfig } from "./effect-middleware.js";
import { createEffectMiddleware } from "./effect-middleware.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type GatewayHonoContext = {
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth: () => ResolvedGatewayAuth;
  rateLimiter?: AuthRateLimiter;
  getReadiness?: ReadinessChecker;
  log: SubsystemLogger;
};

export type GatewayHonoEnv = {
  Variables: {
    gateway: GatewayHonoContext;
    requestStartTime: number;
    clientIp: string;
  };
};

export function createGatewayHonoApp(ctx: GatewayHonoContext, autonomousDeps?: AutonomousMiddlewareDeps, effectConfig?: EffectMiddlewareConfig): Hono<GatewayHonoEnv> {
  const app = new Hono<GatewayHonoEnv>();

  app.use("*", requestTimingMiddleware());
  app.use("*", securityHeadersMiddleware());
  app.use("*", corsOriginMiddleware());
  app.use("*", requestIdMiddleware());

  app.use("*", async (c, next) => {
    c.set("gateway", ctx);
    c.set("requestStartTime", performance.now());
    await next();
  });

  if (autonomousDeps) {
    const mw = createAutonomousMiddlewares(autonomousDeps);
    app.use("*", mw.selfDefense);
    app.use("/v1/*", mw.semanticCache);
    app.use("/v1/*", mw.costGovernance);
    app.use("*", mw.auditTrail);
    app.use("*", mw.metricsEmit);
  }

  if (effectConfig?.enabled) {
    const effectMw = createEffectMiddleware(effectConfig);
    app.use("/v1/*", effectMw.middleware);
  }

  return app;
}

function requestTimingMiddleware() {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    const start = performance.now();
    c.set("requestStartTime", start);
    await next();
    const duration = performance.now() - start;
    c.header("X-Response-Time", `${duration.toFixed(2)}ms`);
  };
}

function securityHeadersMiddleware() {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  };
}

function corsOriginMiddleware() {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    const origin = c.req.header("Origin");
    if (origin && c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-助手-Token");
      c.header("Access-Control-Max-Age", "86400");
      return c.body(null, 204);
    }
    await next();
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }
  };
}

function requestIdMiddleware() {
  let counter = 0;
  const randomPart = Math.random().toString(36).slice(2, 10);
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    const id = `${randomPart}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
    c.header("X-Request-Id", id);
    await next();
  };
}
