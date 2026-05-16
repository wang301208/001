import { Effect, Ref, Schedule } from "effect";
import type { ZhushouConfig } from "../../config/types.zhushou.js";
import { GatewayError } from "./errors.js";

export type GatewayEnv = {
  readonly config: ZhushouConfig;
  readonly startTime: number;
  readonly activeConnections: Ref.Ref<number>;
  readonly isShuttingDown: Ref.Ref<boolean>;
};

export const GatewayEffect = {
  create: (config: ZhushouConfig): Effect.Effect<GatewayEnv, never, never> =>
    Effect.gen(function* () {
      const activeConnections = yield* Ref.make(0);
      const isShuttingDown = yield* Ref.make(false);
      const startTime = Date.now();
      return { config, startTime, activeConnections, isShuttingDown };
    }),

  trackConnection: (env: GatewayEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* Ref.update(env.activeConnections, (n) => n + 1);
    }),

  releaseConnection: (env: GatewayEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* Ref.update(env.activeConnections, (n) => Math.max(0, n - 1));
    }),

  withShutdownGuard: <A, E, R>(
    env: GatewayEnv,
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | GatewayError, R> =>
    Effect.gen(function* () {
      const shuttingDown = yield* Ref.get(env.isShuttingDown);
      if (shuttingDown) {
        yield* Effect.fail(new GatewayError("Gateway is shutting down"));
      }
      return yield* effect;
    }),

  gracefulShutdown: (env: GatewayEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* Ref.set(env.isShuttingDown, true);
      const activeConns = yield* Ref.get(env.activeConnections);
      if (activeConns > 0) {
        yield* Effect.logInfo(`Waiting for ${activeConns} active connections to drain...`);
      }
    }),

  getUptimeMs: (env: GatewayEnv): number =>
    Date.now() - env.startTime,
};
