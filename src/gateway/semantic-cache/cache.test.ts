import { describe, it, expect } from "vitest";
import { createSemanticCache } from "../src/gateway/semantic-cache/cache.js";

describe("SemanticCache", () => {
  it("缓存未命中返回 miss", async () => {
    const cache = createSemanticCache(undefined, { maxEntries: 100, similarityThreshold: 0.95 });
    const result = await cache.get("hello world");
    expect(result.hit).toBe(false);
  });

  it("精确匹配命中缓存", async () => {
    const cache = createSemanticCache(undefined, { maxEntries: 100, similarityThreshold: 0.95 });
    await cache.set("hello world", { answer: "你好" });
    const result = await cache.get("hello world");
    expect(result.hit).toBe(true);
    expect(result.entry?.value).toEqual({ answer: "你好" });
  });

  it("统计信息正确", async () => {
    const cache = createSemanticCache(undefined, { maxEntries: 100, similarityThreshold: 0.95 });
    await cache.get("miss1");
    await cache.get("miss2");
    await cache.set("key1", "value1");
    await cache.get("key1");
    const stats = cache.getStats();
    expect(stats.totalMisses).toBe(2);
    expect(stats.totalHits).toBe(1);
    expect(stats.totalEntries).toBe(1);
  });

  it("invalidate 删除缓存项", async () => {
    const cache = createSemanticCache(undefined, { maxEntries: 100, similarityThreshold: 0.95 });
    await cache.set("key1", "value1");
    const hit = await cache.get("key1");
    expect(hit.hit).toBe(true);
    cache.invalidate("text:key1");
    const after = await cache.get("key1");
    expect(after.hit).toBe(false);
  });

  it("clear 清空所有缓存", async () => {
    const cache = createSemanticCache(undefined, { maxEntries: 100, similarityThreshold: 0.95 });
    await cache.set("a", 1);
    await cache.set("b", 2);
    cache.clear();
    expect(cache.getStats().totalEntries).toBe(0);
    expect(cache.getStats().totalHits).toBe(0);
  });
});
