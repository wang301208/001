import { Effect, Ref } from "effect";
import { SessionError } from "./errors.js";

export type SessionEnv = {
  readonly sessionKey: string;
  readonly messageCount: Ref.Ref<number>;
  readonly tokenUsage: Ref.Ref<{ prompt: number; completion: number }>;
  readonly createdAt: number;
  readonly lastActiveAt: Ref.Ref<number>;
};

export const SessionEffect = {
  create: (sessionKey: string): Effect.Effect<SessionEnv, never, never> =>
    Effect.gen(function* () {
      const messageCount = yield* Ref.make(0);
      const tokenUsage = yield* Ref.make({ prompt: 0, completion: 0 });
      const lastActiveAt = yield* Ref.make(Date.now());
      return { sessionKey, messageCount, tokenUsage, createdAt: Date.now(), lastActiveAt };
    }),

  trackMessage: (env: SessionEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* Ref.update(env.messageCount, (n) => n + 1);
      yield* Ref.set(env.lastActiveAt, Date.now());
    }),

  trackTokenUsage: (env: SessionEnv, prompt: number, completion: number): Effect.Effect<void, never, never> =>
    Ref.update(env.tokenUsage, (usage) => ({
      prompt: usage.prompt + prompt,
      completion: usage.completion + completion,
    })),

  getMetrics: (env: SessionEnv): Effect.Effect<{
    sessionKey: string;
    messageCount: number;
    tokenUsage: { prompt: number; completion: number };
    totalTokens: number;
    createdAt: number;
    lastActiveAt: number;
    idleMs: number;
  }, never, never> =>
    Effect.gen(function* () {
      const messages = yield* Ref.get(env.messageCount);
      const tokens = yield* Ref.get(env.tokenUsage);
      const lastActive = yield* Ref.get(env.lastActiveAt);
      return {
        sessionKey: env.sessionKey,
        messageCount: messages,
        tokenUsage: tokens,
        totalTokens: tokens.prompt + tokens.completion,
        createdAt: env.createdAt,
        lastActiveAt: lastActive,
        idleMs: Date.now() - lastActive,
      };
    }),
};
