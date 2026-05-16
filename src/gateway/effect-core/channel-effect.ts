import { Effect, Ref, Queue } from "effect";
import { ChannelError } from "./errors.js";

export type ChannelEnv = {
  readonly channelId: string;
  readonly isConnected: Ref.Ref<boolean>;
  readonly messageQueue: Queue.Queue<ChannelMessage>;
  readonly reconnectCount: Ref.Ref<number>;
};

export type ChannelMessage = {
  id: string;
  timestamp: number;
  direction: "inbound" | "outbound";
  payload: unknown;
};

export const ChannelEffect = {
  create: (channelId: string, queueCapacity = 1000): Effect.Effect<ChannelEnv, never, never> =>
    Effect.gen(function* () {
      const isConnected = yield* Ref.make(false);
      const messageQueue = yield* Queue.bounded<ChannelMessage>(queueCapacity);
      const reconnectCount = yield* Ref.make(0);
      return { channelId, isConnected, messageQueue, reconnectCount };
    }),

  markConnected: (env: ChannelEnv): Effect.Effect<void, never, never> =>
    Ref.set(env.isConnected, true),

  markDisconnected: (env: ChannelEnv): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      yield* Ref.set(env.isConnected, false);
      yield* Ref.update(env.reconnectCount, (n) => n + 1);
    }),

  enqueueMessage: (env: ChannelEnv, message: Omit<ChannelMessage, "id" | "timestamp">): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      const fullMessage: ChannelMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      yield* Queue.offer(env.messageQueue, fullMessage);
    }),

  dequeueMessage: (env: ChannelEnv): Effect.Effect<ChannelMessage, never, never> =>
    Queue.take(env.messageQueue),

  getStatus: (env: ChannelEnv): Effect.Effect<{
    channelId: string;
    connected: boolean;
    reconnects: number;
    pendingMessages: number;
  }, never, never> =>
    Effect.gen(function* () {
      const connected = yield* Ref.get(env.isConnected);
      const reconnects = yield* Ref.get(env.reconnectCount);
      const queueSize = yield* Queue.size(env.messageQueue);
      return { channelId: env.channelId, connected, reconnects, pendingMessages: queueSize };
    }),
};
