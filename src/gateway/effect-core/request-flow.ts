import { Effect, Ref, Layer } from "effect";
import { GatewayEffect, type GatewayEnv } from "./gateway-effect.js";
import { ModelEffect, type ModelEnv } from "./model-effect.js";
import { ChannelEffect, type ChannelEnv } from "./channel-effect.js";
import { SessionEffect, type SessionEnv } from "./session-effect.js";
import { GatewayError, ModelError, ChannelError, SessionError } from "./errors.js";

export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
  clientIp: string;
  startedAt: number;
  model?: string;
  channel?: string;
  sessionId?: string;
};

export type RequestResult = {
  status: number;
  durationMs: number;
  bytesSent: number;
  cacheHit: boolean;
  defenseAction: string;
};

export type RequestFlowEnv = {
  gateway: GatewayEnv;
  model: ModelEnv;
  channel: ChannelEnv;
  session: SessionEnv;
};

export const RequestFlowEffect = {
  initialize: (config: unknown, modelId: string, channelId: string, sessionId: string): Effect.Effect<RequestFlowEnv, never, never> =>
    Effect.gen(function* () {
      const gateway = yield* GatewayEffect.create(config as never);
      const model = yield* ModelEffect.create(modelId);
      const channel = yield* ChannelEffect.create(channelId);
      const session = yield* SessionEffect.create(sessionId);
      return { gateway, model, channel, session };
    }),

  processRequest: <A>(
    env: RequestFlowEnv,
    ctx: RequestContext,
    handler: Effect.Effect<A, GatewayError | ModelError | ChannelError | SessionError>,
  ): Effect.Effect<A, GatewayError | ModelError | ChannelError | SessionError> =>
    Effect.gen(function* () {
      yield* GatewayEffect.withShutdownGuard(env.gateway, Effect.gen(function* () {
        yield* GatewayEffect.trackConnection(env.gateway);
      }));

      const result = yield* Effect.gen(function* () {
        yield* ChannelEffect.trackRequest(env.channel);
        yield* SessionEffect.trackRequest(env.session);

        const guardedHandler = yield* ModelEffect.withCircuitBreaker(
          env.model,
          GatewayEffect.withShutdownGuard(env.gateway, handler),
          { failureThreshold: 5 },
        );

        return guardedHandler;
      });

      yield* GatewayEffect.releaseConnection(env.gateway);
      return result;
    }),

  safeExecute: <A>(
    env: RequestFlowEnv,
    ctx: RequestContext,
    handler: Effect.Effect<A, GatewayError | ModelError | ChannelError | SessionError>,
  ): Effect.Effect<
    { success: true; value: A; durationMs: number } | { success: false; error: string; durationMs: number },
    never,
    never
  > =>
    Effect.gen(function* () {
      const start = performance.now();
      const result = yield* Effect.either(
        RequestFlowEffect.processRequest(env, ctx, handler),
      );
      const durationMs = performance.now() - start;

      if (result._tag === "Right") {
        return { success: true as const, value: result.right, durationMs };
      }

      const error = result.left;
      let errorMessage = "未知错误";
      if (error instanceof GatewayError) errorMessage = `网关错误: ${error.message}`;
      else if (error instanceof ModelError) errorMessage = `模型错误: ${error.message}`;
      else if (error instanceof ChannelError) errorMessage = `通道错误: ${error.message}`;
      else if (error instanceof SessionError) errorMessage = `会话错误: ${error.message}`;

      return { success: false as const, error: errorMessage, durationMs };
    }),

  gracefulShutdown: (env: RequestFlowEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* GatewayEffect.gracefulShutdown(env.gateway);
      yield* ChannelEffect.deactivate(env.channel);
      yield* SessionEffect.deactivate(env.session);
    }),

  getMetrics: (env: RequestFlowEnv): Effect.Effect<{
    gateway: { uptimeMs: number };
    model: { modelId: string; totalRequests: number; totalErrors: number; avgLatencyMs: number; errorRate: number; circuitOpen: boolean };
    channel: { channelId: string; isActive: boolean; requestCount: number; errorCount: number };
    session: { sessionId: string; isActive: boolean; requestCount: number; lastActivityAt: number };
  }, never, never> =>
    Effect.gen(function* () {
      const modelMetrics = yield* ModelEffect.getMetrics(env.model);
      const channelState = yield* ChannelEffect.getState(env.channel);
      const sessionState = yield* SessionEffect.getState(env.session);
      return {
        gateway: { uptimeMs: GatewayEffect.getUptimeMs(env.gateway) },
        model: modelMetrics,
        channel: channelState,
        session: sessionState,
      };
    }),
};

export function createEffectRequestHandler() {
  let flowEnv: RequestFlowEnv | null = null;

  return {
    async initialize(config: unknown, modelId: string, channelId: string, sessionId: string) {
      flowEnv = await Effect.runPromise(RequestFlowEffect.initialize(config, modelId, channelId, sessionId));
    },

    async handle<T>(ctx: RequestContext, handler: Effect.Effect<T, GatewayError | ModelError | ChannelError | SessionError>): Promise<{ success: boolean; value?: T; error?: string; durationMs: number }> {
      if (!flowEnv) {
        throw new Error("Effect请求流未初始化");
      }
      const result = await Effect.runPromise(RequestFlowEffect.safeExecute(flowEnv, ctx, handler));
      if (result.success) {
        return { success: true, value: result.value, durationMs: result.durationMs };
      }
      return { success: false, error: result.error, durationMs: result.durationMs };
    },

    async shutdown() {
      if (flowEnv) {
        await Effect.runPromise(RequestFlowEffect.gracefulShutdown(flowEnv));
        flowEnv = null;
      }
    },

    async getMetrics() {
      if (!flowEnv) return null;
      return Effect.runPromise(RequestFlowEffect.getMetrics(flowEnv));
    },
  };
}
