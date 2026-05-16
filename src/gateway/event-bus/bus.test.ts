import { describe, it, expect } from "vitest";
import { createLocalEventBus } from "../src/gateway/event-bus/bus.js";

describe("EventBus", () => {
  it("发布和订阅消息", async () => {
    const bus = createLocalEventBus("test");
    const received: unknown[] = [];
    bus.subscribe("test.subject", async (msg) => {
      received.push(msg.payload);
    });
    await bus.publish("test.subject", { hello: "world" });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ hello: "world" });
  });

  it("通配符订阅", async () => {
    const bus = createLocalEventBus("test");
    const received: string[] = [];
    bus.subscribe("test.*", async (msg) => {
      received.push(msg.subject);
    });
    await bus.publish("test.a", 1);
    await bus.publish("test.b", 2);
    await bus.publish("other.c", 3);
    expect(received).toEqual(["test.a", "test.b"]);
  });

  it("深度通配符订阅", async () => {
    const bus = createLocalEventBus("test");
    const received: string[] = [];
    bus.subscribe("test.>", async (msg) => {
      received.push(msg.subject);
    });
    await bus.publish("test.a.b.c", 1);
    await bus.publish("test.x", 2);
    expect(received).toHaveLength(2);
  });

  it("请求-回复模式", async () => {
    const bus = createLocalEventBus("test");
    bus.subscribe("rpc.add", async (msg) => {
      const { a, b } = msg.payload as { a: number; b: number };
      await bus.publish(msg.replyTo!, a + b);
    });
    const reply = await bus.request("rpc.add", { a: 3, b: 4 }, 2000);
    expect(reply.payload).toBe(7);
  });

  it("取消订阅", async () => {
    const bus = createLocalEventBus("test");
    let count = 0;
    const unsub = bus.subscribe("test.sub", async () => {
      count++;
    });
    await bus.publish("test.sub", 1);
    expect(count).toBe(1);
    unsub();
    await bus.publish("test.sub", 2);
    expect(count).toBe(1);
  });

  it("统计信息正确", async () => {
    const bus = createLocalEventBus("test");
    bus.subscribe("stats.test", async () => {});
    await bus.publish("stats.test", 1);
    await bus.publish("stats.test", 2);
    const stats = bus.getStats();
    expect(stats.published).toBe(2);
    expect(stats.received).toBe(2);
    expect(stats.activeSubscriptions).toBe(1);
  });
});
