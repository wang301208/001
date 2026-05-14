import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PerceptionEngine,
  DEFAULT_PERCEPTION_CONFIG,
  formatPerceptionEvent,
  formatPerceptionSummary,
  type PerceptionEvent,
  type PerceptionConfig,
} from "./perception-engine.js";

describe("perception-engine", () => {
  describe("DEFAULT_PERCEPTION_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_PERCEPTION_CONFIG.debounceMs).toBe(300);
      expect(DEFAULT_PERCEPTION_CONFIG.maxEvents).toBe(500);
      expect(DEFAULT_PERCEPTION_CONFIG.minRelevanceForNotify).toBe(0.4);
    });
  });

  describe("PerceptionEngine", () => {
    let engine: PerceptionEngine;

    beforeEach(() => {
      engine = new PerceptionEngine({
        watchPaths: [],
        debounceMs: 0,
      });
    });

    afterEach(() => {
      engine.stop();
    });

    it("starts and stops cleanly", () => {
      engine.start();
      expect(engine.isRunning()).toBe(false);
    });

    it("adds and removes observers", () => {
      const observer = {
        id: "test",
        onEvent: vi.fn(),
      };
      engine.addObserver(observer);
      engine.removeObserver("test");
    });

    it("injects events and notifies observers", () => {
      const onEvent = vi.fn();
      const observer = {
        id: "test",
        onEvent,
      };
      engine.addObserver(observer);

      const event = engine.injectEvent({
        kind: "file.modified",
        source: "test",
        detail: "/path/to/file.ts",
        timestamp: Date.now(),
        relevance: 0.8,
      });

      expect(event.id).toBeTruthy();
      expect(event.observedAt).toBeGreaterThan(0);
      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it("buffers events up to maxEvents", () => {
      const smallEngine = new PerceptionEngine({
        maxEvents: 10,
        watchPaths: [],
        debounceMs: 0,
      });

      for (let i = 0; i < 15; i++) {
        smallEngine.injectEvent({
          kind: "file.modified",
          source: "test",
          detail: `/file${i}.ts`,
          timestamp: Date.now(),
          relevance: 0.5,
        });
      }

      expect(smallEngine.getEventCount()).toBe(10);
      smallEngine.stop();
    });

    it("getRecentEvents returns last N events", () => {
      for (let i = 0; i < 5; i++) {
        engine.injectEvent({
          kind: "file.modified",
          source: "test",
          detail: `/file${i}.ts`,
          timestamp: Date.now(),
          relevance: 0.5,
        });
      }

      const recent = engine.getRecentEvents(3);
      expect(recent).toHaveLength(3);
    });

    it("tracks idle state", () => {
      expect(engine.isIdle()).toBe(false);
    });
  });

  describe("formatPerceptionEvent", () => {
    it("formats file.modified event", () => {
      const event: PerceptionEvent = {
        id: "pe_1",
        kind: "file.modified",
        source: "fs",
        detail: "/path/to/file.ts",
        timestamp: Date.now(),
        relevance: 0.8,
        observedAt: Date.now(),
      };
      const formatted = formatPerceptionEvent(event);
      expect(formatted).toContain("修改");
      expect(formatted).toContain("file.ts");
    });
  });

  describe("formatPerceptionSummary", () => {
    it("shows idle message for empty events", () => {
      const lines = formatPerceptionSummary([]);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("空闲");
    });
  });
});
