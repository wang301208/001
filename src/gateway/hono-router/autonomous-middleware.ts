import type { Context, Next } from "hono";
import type { GatewayHonoEnv } from "./app.js";
import type { SemanticCache } from "../semantic-cache/cache.js";
import type { SelfDefenseSystem, DefenseVerdict } from "../self-defense/defense.js";
import type { AuditChain } from "../audit-chain/chain.js";
import type { CostGovernance } from "../cost-governance/governance.js";
import type { EventBus } from "../event-bus/bus.js";

export type AutonomousMiddlewareDeps = {
  semanticCache?: SemanticCache;
  defense?: SelfDefenseSystem;
  auditChain?: AuditChain;
  costGovernance?: CostGovernance;
  eventBus?: EventBus;
  defaultTenantId?: string;
};

export function createAutonomousMiddlewares(deps: AutonomousMiddlewareDeps) {
  return {
    selfDefense: selfDefenseMiddleware(deps),
    semanticCache: semanticCacheMiddleware(deps),
    costGovernance: costGovernanceMiddleware(deps),
    auditTrail: auditTrailMiddleware(deps),
    metricsEmit: metricsEmitMiddleware(deps),
  };
}

function selfDefenseMiddleware(deps: AutonomousMiddlewareDeps) {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    if (!deps.defense) {
      await next();
      return;
    }

    const clientIp = c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
      ?? c.req.header("X-Real-Ip")
      ?? "unknown";

    const blocked = deps.defense.getActiveBlocks().find((b) => b.ip === clientIp);
    if (blocked) {
      deps.eventBus?.publish("defense.blocked", { ip: clientIp, reason: blocked.reason });
      c.header("X-Defense-Action", "blocked");
      c.header("Retry-After", String(Math.ceil((blocked.until - Date.now()) / 1000)));
      c.status(429);
      return c.json({ error: { message: "请求被安全系统拦截", type: "blocked", reason: blocked.reason } });
    }

    const verdict: DefenseVerdict = deps.defense.evaluate({
      requestRate: 0,
      errorRate: 0,
      authFailureRate: 0,
      payloadSizeAvg: Number(c.req.header("Content-Length") ?? 0),
    });

    c.header("X-Defense-Action", verdict.action);
    c.set("defenseVerdict" as keyof GatewayHonoEnv["Variables"], verdict as never);

    if (verdict.action === "block") {
      deps.defense.recordEvent({
        type: "block",
        ip: clientIp,
        timestamp: Date.now(),
        metadata: { reason: verdict.reason },
      });
      c.status(403);
      return c.json({ error: { message: "请求被安全系统拒绝", type: "forbidden", reason: verdict.reason } });
    }

    if (verdict.action === "rate-limit") {
      c.status(429);
      return c.json({ error: { message: "请求频率受限", type: "rate_limited", reason: verdict.reason } });
    }

    await next();
  };
}

function semanticCacheMiddleware(deps: AutonomousMiddlewareDeps) {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    if (!deps.semanticCache) {
      await next();
      return;
    }

    const method = c.req.method;
    if (method !== "POST" || !c.req.path.startsWith("/v1/")) {
      await next();
      return;
    }

    const cacheKey = `${method}:${c.req.path}:${c.req.header("Authorization")?.slice(-8) ?? "anon"}`;

    try {
      const body = await c.req.json().catch(() => null);
      if (body && typeof body === "object") {
        const queryText = extractQueryText(body);
        if (queryText) {
          const result = await deps.semanticCache.get(queryText);
          if (result.hit && result.entry) {
            c.header("X-Cache", "HIT");
            c.header("X-Cache-Similarity", String(result.entry.hitCount));
            deps.eventBus?.publish("cache.hit", { key: cacheKey, path: c.req.path });
            return c.json(result.entry.value);
          }
        }
      }
    } catch {
      // 缓存查找失败不阻断请求
    }

    c.header("X-Cache", "MISS");
    await next();

    if (c.res.status >= 200 && c.res.status < 300) {
      try {
        const responseBody = await c.res.clone().json().catch(() => null);
        if (responseBody) {
          const body = await new Request(c.req.raw).json().catch(() => null);
          const queryText = body ? extractQueryText(body) : null;
          if (queryText) {
            await deps.semanticCache.set(queryText, responseBody);
          }
        }
      } catch {
        // 缓存存储失败不阻断
      }
    }
  };
}

function costGovernanceMiddleware(deps: AutonomousMiddlewareDeps) {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    if (!deps.costGovernance) {
      await next();
      return;
    }

    const tenantId = c.req.header("X-Tenant-Id") ?? deps.defaultTenantId ?? "default";

    const quotaCheck = deps.costGovernance.checkQuota(tenantId, 0.001);
    if (!quotaCheck.allowed) {
      c.status(429);
      return c.json({
        error: {
          message: "成本配额超限",
          type: "quota_exceeded",
          reason: quotaCheck.reason,
          remainingBudgetUsd: quotaCheck.remainingBudgetUsd,
        },
      });
    }

    c.header("X-Cost-Budget-Remaining", `$${quotaCheck.remainingBudgetUsd.toFixed(4)}`);

    await next();

    const model = c.req.path.includes("/chat/completions") ? "chat" : "unknown";
    deps.eventBus?.publish("cost.request", {
      tenantId,
      model,
      path: c.req.path,
      status: c.res.status,
    });
  };
}

function auditTrailMiddleware(deps: AutonomousMiddlewareDeps) {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    const startTime = Date.now();

    await next();

    if (!deps.auditChain) {
      return;
    }

    const clientIp = c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
      ?? c.req.header("X-Real-Ip")
      ?? "unknown";

    deps.auditChain.append({
      actor: clientIp,
      action: `${c.req.method} ${c.req.path}`,
      resource: c.req.path,
      outcome: c.res.status >= 200 && c.res.status < 300 ? "success" : c.res.status === 403 ? "denied" : "failure",
      metadata: {
        status: c.res.status,
        durationMs: Date.now() - startTime,
        userAgent: c.req.header("User-Agent"),
      },
    });
  };
}

function metricsEmitMiddleware(deps: AutonomousMiddlewareDeps) {
  return async (c: Context<GatewayHonoEnv>, next: Next) => {
    const startTime = performance.now();

    await next();

    const durationMs = performance.now() - startTime;

    deps.eventBus?.publish("metrics.request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      timestamp: Date.now(),
    });
  };
}

function extractQueryText(body: Record<string, unknown>): string | null {
  if (typeof body.model === "string" && Array.isArray(body.messages)) {
    const lastMsg = body.messages[body.messages.length - 1] as Record<string, unknown> | undefined;
    if (lastMsg && typeof lastMsg.content === "string") {
      return `${body.model}:${lastMsg.content}`;
    }
  }
  if (typeof body.input === "string") {
    return body.input;
  }
  if (typeof body.prompt === "string") {
    return body.prompt;
  }
  return null;
}
