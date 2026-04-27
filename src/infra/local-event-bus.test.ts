import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  configureLocalEventBusAdapter,
  onLocalEventBusEvent,
  publishLocalEventBusEvent,
  resetLocalEventBusForTest,
} from "./local-event-bus.js";

describe("local-event-bus", () => {
  beforeEach(() => {
    resetLocalEventBusForTest();
  });

  test("publishes events to listeners and preserves sequence", () => {
    const seen: number[] = [];
    const stop = onLocalEventBusEvent((event) => {
      seen.push(event.seq);
    });

    publishLocalEventBusEvent({
      topic: "agent.lifecycle",
      source: "test",
      payload: { status: "queued" },
    });
    publishLocalEventBusEvent({
      topic: "agent.lifecycle",
      source: "test",
      payload: { status: "running" },
    });

    stop();

    expect(seen).toEqual([1, 2]);
  });

  test("forwards events to the configured adapter", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    configureLocalEventBusAdapter({
      kind: "memory-forwarder",
      publish,
    });

    const event = publishLocalEventBusEvent({
      topic: "system.event.enqueued",
      source: "test",
      payload: { sessionKey: "main" },
    });

    await Promise.resolve();

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.eventId,
        topic: "system.event.enqueued",
        source: "test",
      }),
    );
  });
});
