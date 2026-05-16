export type EventBusMessage = {
  id: string;
  subject: string;
  payload: unknown;
  timestamp: number;
  source: string;
  correlationId?: string;
  replyTo?: string;
};

export type EventBusSubscription = {
  id: string;
  subject: string;
  handler: (msg: EventBusMessage) => Promise<void>;
  active: boolean;
};

export type EventBus = {
  publish(subject: string, payload: unknown, opts?: { correlationId?: string; replyTo?: string }): Promise<string>;
  subscribe(subject: string, handler: (msg: EventBusMessage) => Promise<void>): () => void;
  request(subject: string, payload: unknown, timeoutMs?: number): Promise<EventBusMessage>;
  unsubscribe(subscriptionId: string): void;
  getSubscriptions(): EventBusSubscription[];
  getStats(): { published: number; received: number; activeSubscriptions: number; pendingRequests: number };
};

export function createLocalEventBus(sourceId: string): EventBus {
  const subscriptions = new Map<string, EventBusSubscription[]>();
  const allSubscriptions = new Map<string, EventBusSubscription>();
  const pendingRequests = new Map<string, { resolve: (msg: EventBusMessage) => void; timeout: ReturnType<typeof setTimeout> }>();
  let published = 0;
  let received = 0;

  function matchSubject(pattern: string, subject: string): boolean {
    if (pattern === subject) {
      return true;
    }
    if (pattern.endsWith(".>")) {
      return subject.startsWith(pattern.slice(0, -2));
    }
    if (pattern.includes(".*")) {
      const patternParts = pattern.split(".");
      const subjectParts = subject.split(".");
      if (patternParts.length !== subjectParts.length) {
        return false;
      }
      return patternParts.every((p, i) => p === "*" || p === subjectParts[i]);
    }
    return false;
  }

  return {
    async publish(subject, payload, opts) {
      const id = crypto.randomUUID();
      const msg: EventBusMessage = {
        id,
        subject,
        payload,
        timestamp: Date.now(),
        source: sourceId,
        correlationId: opts?.correlationId,
        replyTo: opts?.replyTo,
      };

      published++;

      const pending = pendingRequests.get(subject);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.delete(subject);
        pending.resolve(msg);
        return id;
      }

      if (opts?.replyTo) {
        const replyPending = pendingRequests.get(opts.replyTo);
        if (replyPending) {
          clearTimeout(replyPending.timeout);
          pendingRequests.delete(opts.replyTo);
          replyPending.resolve(msg);
          return id;
        }
      }

      const matchingSubs: EventBusSubscription[] = [];
      for (const [pattern, subs] of subscriptions) {
        if (matchSubject(pattern, subject)) {
          matchingSubs.push(...subs);
        }
      }

      await Promise.allSettled(
        matchingSubs.filter((s) => s.active).map(async (sub) => {
          received++;
          await sub.handler(msg);
        }),
      );

      return id;
    },

    subscribe(subject, handler) {
      const subId = crypto.randomUUID();
      const sub: EventBusSubscription = { id: subId, subject, handler, active: true };

      let subs = subscriptions.get(subject);
      if (!subs) {
        subs = [];
        subscriptions.set(subject, subs);
      }
      subs.push(sub);
      allSubscriptions.set(subId, sub);

      return () => {
        sub.active = false;
        allSubscriptions.delete(subId);
        const subsList = subscriptions.get(subject);
        if (subsList) {
          const idx = subsList.indexOf(sub);
          if (idx !== -1) {
            subsList.splice(idx, 1);
          }
          if (subsList.length === 0) {
            subscriptions.delete(subject);
          }
        }
      };
    },

    async request(subject, payload, timeoutMs = 10_000) {
      const replyTo = `_reply.${crypto.randomUUID()}`;
      const promise = new Promise<EventBusMessage>((resolve) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(replyTo);
          resolve({
            id: "",
            subject: "_timeout",
            payload: null,
            timestamp: Date.now(),
            source: "event-bus",
            correlationId: subject,
          });
        }, timeoutMs);
        pendingRequests.set(replyTo, { resolve, timeout });
      });

      await this.publish(subject, payload, { replyTo });
      return promise;
    },

    unsubscribe(subscriptionId) {
      const sub = allSubscriptions.get(subscriptionId);
      if (sub) {
        sub.active = false;
        allSubscriptions.delete(subscriptionId);
      }
    },

    getSubscriptions() {
      return [...allSubscriptions.values()];
    },

    getStats() {
      return {
        published,
        received,
        activeSubscriptions: [...allSubscriptions.values()].filter((s) => s.active).length,
        pendingRequests: pendingRequests.size,
      };
    },
  };
}
