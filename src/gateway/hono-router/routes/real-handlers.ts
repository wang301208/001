import type { Hono, Context } from "hono";
import type { GatewayHonoEnv } from "../app.js";
import type { ResolvedGatewayAuth } from "../../auth.js";
import type { AuthRateLimiter } from "../../auth-rate-limit.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export type RealHandlerDeps = {
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth: () => ResolvedGatewayAuth;
  rateLimiter?: AuthRateLimiter;
  trustedProxies: string[];
  allowRealIpFallback: boolean;
  openAiChatCompletionsConfig?: Record<string, unknown>;
  openResponsesConfig?: Record<string, unknown>;
};

async function honoToNodeDelegate(
  c: Context<GatewayHonoEnv>,
  handler: (req: IncomingMessage, res: ServerResponse, opts: Record<string, unknown>) => Promise<boolean>,
  opts: Record<string, unknown>,
): Promise<Response> {
  const { createHonoToNodeAdapter } = await import("../hono-to-node-adapter.js");
  const result = await createHonoToNodeAdapter(c, handler, opts);
  return result;
}

export function registerRealOpenAiRoutes(app: Hono<GatewayHonoEnv>, deps: RealHandlerDeps): void {
  app.post("/v1/chat/completions", async (c) => {
    try {
      const mod = await import("../../openai-http.js");
      const handled = await honoToNodeDelegate(c, mod.handleOpenAiHttpRequest, {
        auth: deps.getResolvedAuth(),
        config: deps.openAiChatCompletionsConfig,
        trustedProxies: deps.trustedProxies,
        allowRealIpFallback: deps.allowRealIpFallback,
        rateLimiter: deps.rateLimiter,
      });
      return handled;
    } catch (err) {
      return c.json(
        { error: { message: `OpenAI chat completions 处理失败: ${String(err)}`, type: "delegate_error" } },
        503,
      );
    }
  });

  app.post("/v1/responses", async (c) => {
    try {
      const mod = await import("../../openresponses-http.js");
      const handled = await honoToNodeDelegate(c, mod.handleOpenResponsesHttpRequest, {
        auth: deps.getResolvedAuth(),
        config: deps.openResponsesConfig,
        trustedProxies: deps.trustedProxies,
        allowRealIpFallback: deps.allowRealIpFallback,
        rateLimiter: deps.rateLimiter,
      });
      return handled;
    } catch (err) {
      return c.json(
        { error: { message: `OpenResponses 处理失败: ${String(err)}`, type: "delegate_error" } },
        503,
      );
    }
  });

  app.post("/v1/embeddings", async (c) => {
    try {
      const mod = await import("../../embeddings-http.js");
      const handled = await honoToNodeDelegate(c, mod.handleOpenAiEmbeddingsHttpRequest, {
        auth: deps.getResolvedAuth(),
        trustedProxies: deps.trustedProxies,
        allowRealIpFallback: deps.allowRealIpFallback,
        rateLimiter: deps.rateLimiter,
      });
      return handled;
    } catch (err) {
      return c.json(
        { error: { message: `Embeddings 处理失败: ${String(err)}`, type: "delegate_error" } },
        503,
      );
    }
  });

  app.get("/v1/models", async (c) => {
    try {
      const mod = await import("../../models-http.js");
      const handled = await honoToNodeDelegate(c, mod.handleOpenAiModelsHttpRequest, {
        auth: deps.getResolvedAuth(),
        trustedProxies: deps.trustedProxies,
        allowRealIpFallback: deps.allowRealIpFallback,
        rateLimiter: deps.rateLimiter,
      });
      return handled;
    } catch (err) {
      return c.json(
        { error: { message: `Models 处理失败: ${String(err)}`, type: "delegate_error" } },
        503,
      );
    }
  });
}
