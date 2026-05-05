/**
 * 因果关系引擎测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CausalGraph, getCausalGraph, resetCausalGraph } from "./causality-engine.js";

describe("CausalGraph", () => {
  let graph: CausalGraph;

  beforeEach(() => {
    resetCausalGraph();
    graph = new CausalGraph();
  });

  describe("基本操作", () => {
    it("应该能够添加事件", () => {
      const event = {
        id: "event-1",
        timestamp: Date.now(),
        type: "action" as const,
        description: "测试事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      };

      graph.addEvent(event);
      
      expect(graph.getEvent("event-1")).toBeDefined();
      expect(graph.getEvent("event-1")?.description).toBe("测试事件");
    });

    it("添加重复事件应该抛出错误", () => {
      const event = {
        id: "event-1",
        timestamp: Date.now(),
        type: "action" as const,
        description: "测试事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      };

      graph.addEvent(event);
      expect(() => graph.addEvent(event)).toThrow();
    });

    it("应该能够添加因果边", () => {
      const event1 = {
        id: "event-1",
        timestamp: Date.now(),
        type: "action" as const,
        description: "原因事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      };

      const event2 = {
        id: "event-2",
        timestamp: Date.now() + 1000,
        type: "reaction" as const,
        description: "结果事件",
        causes: ["event-1"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.8,
      };

      graph.addEvent(event1);
      graph.addEvent(event2);

      expect(graph.getEvent("event-1")?.effects).toContain("event-2");
      expect(graph.getEvent("event-2")?.causes).toContain("event-1");
    });
  });

  describe("因果追溯", () => {
    it("应该能够获取事件的原因", () => {
      // 创建因果链: A -> B -> C
      const eventA = {
        id: "A",
        timestamp: 1000,
        type: "action" as const,
        description: "初始动作",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.95,
      };

      const eventB = {
        id: "B",
        timestamp: 2000,
        type: "reaction" as const,
        description: "中间反应",
        causes: ["A"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.8,
      };

      const eventC = {
        id: "C",
        timestamp: 3000,
        type: "reaction" as const,
        description: "最终结果",
        causes: ["B"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.75,
      };

      graph.addEvent(eventA);
      graph.addEvent(eventB);
      graph.addEvent(eventC);

      const causesOfC = graph.getCauses("C");
      expect(causesOfC).toHaveLength(2);
      expect(causesOfC.map(e => e.id)).toEqual(expect.arrayContaining(["A", "B"]));
    });

    it("应该能够获取事件的结果", () => {
      // 创建因果链: A -> B -> C
      const eventA = {
        id: "A",
        timestamp: 1000,
        type: "action" as const,
        description: "初始动作",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.95,
      };

      const eventB = {
        id: "B",
        timestamp: 2000,
        type: "reaction" as const,
        description: "中间反应",
        causes: ["A"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.8,
      };

      const eventC = {
        id: "C",
        timestamp: 3000,
        type: "reaction" as const,
        description: "最终结果",
        causes: ["B"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.75,
      };

      graph.addEvent(eventA);
      graph.addEvent(eventB);
      graph.addEvent(eventC);

      const effectsOfA = graph.getEffects("A");
      expect(effectsOfA).toHaveLength(2);
      expect(effectsOfA.map(e => e.id)).toEqual(expect.arrayContaining(["B", "C"]));
    });

    it("应该限制追溯深度", () => {
      // 创建长链: A -> B -> C -> D -> E
      for (let i = 0; i < 5; i++) {
        graph.addEvent({
          id: `E${i}`,
          timestamp: 1000 + i * 1000,
          type: "action" as const,
          description: `事件 ${i}`,
          causes: i > 0 ? [`E${i - 1}`] : [],
          effects: [],
          strength: "moderate" as const,
          confidence: 0.8,
        });
      }

      const causes = graph.getCauses("E4", 2);
      expect(causes.length).toBeLessThanOrEqual(2);
    });
  });

  describe("路径查找", () => {
    it("应该能够找到所有因果路径", () => {
      // 创建图: A -> B -> D, A -> C -> D
      graph.addEvent({
        id: "A",
        timestamp: 1000,
        type: "action" as const,
        description: "起点",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      graph.addEvent({
        id: "B",
        timestamp: 2000,
        type: "reaction" as const,
        description: "路径1",
        causes: ["A"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.8,
      });

      graph.addEvent({
        id: "C",
        timestamp: 2000,
        type: "reaction" as const,
        description: "路径2",
        causes: ["A"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.8,
      });

      graph.addEvent({
        id: "D",
        timestamp: 3000,
        type: "reaction" as const,
        description: "终点",
        causes: ["B", "C"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.75,
      });

      const paths = graph.findAllPaths("A", "D");
      expect(paths).toHaveLength(2);
      
      const pathIds = paths.map(p => p.path.join("->"));
      expect(pathIds).toEqual(expect.arrayContaining([
        "A->B->D",
        "A->C->D",
      ]));
    });
  });

  describe("根因分析", () => {
    it("应该能够分析根因", () => {
      // 创建故障传播链
      graph.addEvent({
        id: "root-cause",
        timestamp: 1000,
        type: "error" as const,
        description: "数据库连接失败",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.95,
      });

      graph.addEvent({
        id: "intermediate",
        timestamp: 2000,
        type: "error" as const,
        description: "API请求超时",
        causes: ["root-cause"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      graph.addEvent({
        id: "symptom",
        timestamp: 3000,
        type: "error" as const,
        description: "用户界面显示错误",
        causes: ["intermediate"],
        effects: [],
        strength: "moderate" as const,
        confidence: 0.8,
      });

      const analysis = graph.analyzeRootCause("symptom");
      
      expect(analysis.targetEventId).toBe("symptom");
      expect(analysis.rootCauses.length).toBeGreaterThan(0);
      expect(analysis.rootCauses[0].eventId).toBe("root-cause");
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it("应该为复杂问题生成建议", () => {
      // 创建多根因场景
      for (let i = 0; i < 5; i++) {
        graph.addEvent({
          id: `root-${i}`,
          timestamp: 1000 + i,
          type: "error" as const,
          description: `根因 ${i}`,
          causes: [],
          effects: ["final"],
          strength: "moderate" as const,
          confidence: 0.7,
        });
      }

      graph.addEvent({
        id: "final",
        timestamp: 2000,
        type: "error" as const,
        description: "系统故障",
        causes: ["root-0", "root-1", "root-2", "root-3", "root-4"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      const analysis = graph.analyzeRootCause("final");
      expect(analysis.recommendations).toContain("考虑简化系统以减少因果链复杂度");
    });
  });

  describe("因果推理", () => {
    it("应该能够推断可能的结果", () => {
      const premiseEvent = {
        id: "premise",
        timestamp: 1000,
        type: "decision" as const,
        description: "决定升级系统",
        causes: [],
        effects: ["effect-1"],
        strength: "strong" as const,
        confidence: 0.9,
      };

      const effectEvent = {
        id: "effect-1",
        timestamp: 2000,
        type: "state_change" as const,
        description: "系统版本更新",
        causes: ["premise"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.85,
      };

      graph.addEvent(premiseEvent);
      graph.addEvent(effectEvent);

      const inference = graph.inferEffects("premise");
      
      expect(inference.premiseEventId).toBe("premise");
      expect(inference.possibleEffects.length).toBeGreaterThan(0);
      expect(inference.confidence).toBeGreaterThan(0);
      expect(inference.reasoning).toContain("决定升级系统");
    });
  });

  describe("反事实推理", () => {
    it("应该能够进行反事实分析", () => {
      const event = {
        id: "critical-event",
        timestamp: 1000,
        type: "action" as const,
        description: "关键配置变更",
        causes: [],
        effects: ["consequence"],
        strength: "strong" as const,
        confidence: 0.9,
      };

      const consequence = {
        id: "consequence",
        timestamp: 2000,
        type: "state_change" as const,
        description: "系统行为改变",
        causes: ["critical-event"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.85,
      };

      graph.addEvent(event);
      graph.addEvent(consequence);

      const counterfactual = graph.analyzeCounterfactual(
        "critical-event",
        "如果关键配置变更没有发生"
      );

      expect(counterfactual.originalEventId).toBe("critical-event");
      expect(counterfactual.hypotheticalScenario).toBe("如果关键配置变更没有发生");
      expect(counterfactual.predictedOutcome.explanation).toBeDefined();
    });
  });

  describe("统计信息", () => {
    it("应该能够获取因果图统计", () => {
      // 添加多个事件
      for (let i = 0; i < 10; i++) {
        graph.addEvent({
          id: `event-${i}`,
          timestamp: 1000 + i * 100,
          type: i % 2 === 0 ? "action" : "reaction",
          description: `事件 ${i}`,
          causes: i > 0 ? [`event-${i - 1}`] : [],
          effects: [],
          strength: "moderate" as const,
          confidence: 0.8,
        });
      }

      const stats = graph.getStats();
      
      expect(stats.totalEvents).toBe(10);
      expect(stats.totalEdges).toBe(9);
      expect(stats.eventTypeDistribution.action).toBe(5);
      expect(stats.eventTypeDistribution.reaction).toBe(5);
      expect(stats.timeRange.earliest).toBe(1000);
      expect(stats.timeRange.latest).toBe(1900);
    });

    it("应该正确计算连通分量", () => {
      // 创建两个独立的子图
      graph.addEvent({
        id: "A1",
        timestamp: 1000,
        type: "action" as const,
        description: "子图1",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      graph.addEvent({
        id: "A2",
        timestamp: 2000,
        type: "reaction" as const,
        description: "子图1-2",
        causes: ["A1"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.85,
      });

      graph.addEvent({
        id: "B1",
        timestamp: 1000,
        type: "action" as const,
        description: "子图2",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      const stats = graph.getStats();
      expect(stats.connectedComponents).toBe(2);
    });
  });

  describe("导出功能", () => {
    it("应该能够导出为JSON", () => {
      graph.addEvent({
        id: "test-event",
        timestamp: 1000,
        type: "action" as const,
        description: "测试事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      const json = graph.exportToJSON();
      
      expect(json.events).toBeDefined();
      expect(json.edges).toBeDefined();
      expect(json.stats).toBeDefined();
      expect(json.events.length).toBe(1);
    });
  });

  describe("清空功能", () => {
    it("应该能够清空因果图", () => {
      graph.addEvent({
        id: "event-1",
        timestamp: 1000,
        type: "action" as const,
        description: "测试事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      expect(graph.getStats().totalEvents).toBe(1);
      
      graph.clear();
      
      expect(graph.getStats().totalEvents).toBe(0);
    });
  });

  describe("事件监听", () => {
    it("应该在添加事件时触发事件", () => {
      const listener = vi.fn();
      graph.on("eventAdded", listener);

      graph.addEvent({
        id: "event-1",
        timestamp: 1000,
        type: "action" as const,
        description: "测试事件",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      expect(listener).toHaveBeenCalled();
    });

    it("应该在添加边时触发事件", () => {
      const listener = vi.fn();
      graph.on("edgeAdded", listener);

      graph.addEvent({
        id: "A",
        timestamp: 1000,
        type: "action" as const,
        description: "事件A",
        causes: [],
        effects: [],
        strength: "strong" as const,
        confidence: 0.9,
      });

      graph.addEvent({
        id: "B",
        timestamp: 2000,
        type: "reaction" as const,
        description: "事件B",
        causes: ["A"],
        effects: [],
        strength: "strong" as const,
        confidence: 0.85,
      });

      expect(listener).toHaveBeenCalled();
    });
  });
});

describe("全局单例", () => {
  beforeEach(() => {
    resetCausalGraph();
  });

  it("应该返回相同的实例", () => {
    const graph1 = getCausalGraph();
    const graph2 = getCausalGraph();
    
    expect(graph1).toBe(graph2);
  });

  it("重置后应该创建新实例", () => {
    const graph1 = getCausalGraph();
    resetCausalGraph();
    const graph2 = getCausalGraph();
    
    expect(graph1).not.toBe(graph2);
  });
});
