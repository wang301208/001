import { Effect, Ref, Schedule } from "effect";
import { ModelError } from "./errors.js";

export type ModelEnv = {
  readonly modelId: string;
  readonly requestCount: Ref.Ref<number>;
  readonly errorCount: Ref.Ref<number>;
  readonly totalLatencyMs: Ref.Ref<number>;
  readonly circuitOpen: Ref.Ref<boolean>;
};

export const ModelEffect = {
  create: (modelId: string): Effect.Effect<ModelEnv, never, never> =>
    Effect.gen(function* () {
      const requestCount = yield* Ref.make(0);
      const errorCount = yield* Ref.make(0);
      const totalLatencyMs = yield* Ref.make(0);
      const circuitOpen = yield* Ref.make(false);
      return { modelId, requestCount, errorCount, totalLatencyMs, circuitOpen };
    }),

  withCircuitBreaker: <A, E>(
    env: ModelEnv,
    effect: Effect.Effect<A, E>,
    options?: { failureThreshold?: number },
  ): Effect.Effect<A, E | ModelError> =>
    Effect.gen(function* () {
      const isOpen = yield* Ref.get(env.circuitOpen);
      if (isOpen) {
        const errorCount = yield* Ref.get(env.errorCount);
        if (errorCount >= (options?.failureThreshold ?? 5)) {
          yield* Effect.fail(new ModelError("Circuit breaker open", env.modelId, true));
        }
        yield* Ref.set(env.circuitOpen, false);
      }

      yield* Ref.update(env.requestCount, (n) => n + 1);
      const start = performance.now();
      const result = yield* Effect.either(effect);
      const latency = performance.now() - start;
      yield* Ref.update(env.totalLatencyMs, (n) => n + latency);

      if (result._tag === "Left") {
        yield* Ref.update(env.errorCount, (n) => n + 1);
        const errCount = yield* Ref.get(env.errorCount);
        if (errCount >= (options?.failureThreshold ?? 5)) {
          yield* Ref.set(env.circuitOpen, true);
        }
        yield* Effect.fail(result.left);
      }

      yield* Ref.update(env.errorCount, (n) => Math.max(0, n - 1));
      return result.right;
    }),

  withRetry: <A, E>(
    effect: Effect.Effect<A, E>,
    options?: { maxRetries?: number; delayMs?: number },
  ): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.retry(
        Schedule.exponential(options?.delayMs ?? 1000).pipe(
          Schedule.compose(Schedule.recurs(options?.maxRetries ?? 2)),
        ),
      ),
    ),

  getMetrics: (env: ModelEnv): Effect.Effect<{
    modelId: string;
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    errorRate: number;
    circuitOpen: boolean;
  }, never, never> =>
    Effect.gen(function* () {
      const requests = yield* Ref.get(env.requestCount);
      const errors = yield* Ref.get(env.errorCount);
      const latency = yield* Ref.get(env.totalLatencyMs);
      const circuitOpen = yield* Ref.get(env.circuitOpen);
      return {
        modelId: env.modelId,
        totalRequests: requests,
        totalErrors: errors,
        avgLatencyMs: requests > 0 ? latency / requests : 0,
        errorRate: requests > 0 ? errors / requests : 0,
        circuitOpen,
      };
    }),
};
