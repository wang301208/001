/**
 * 因果关系引擎 (Causality Engine)
 * 
 * 提供事件因果追踪、因果图构建、根因分析和因果推理功能
 * 
 * 核心能力:
 * 1. 因果事件记录 - 记录事件及其因果关系
 * 2. 因果图构建 - 构建事件之间的因果网络
 * 3. 根因分析 - 追溯问题的根本原因
 * 4. 因果推理 - 基于已知因果推断可能的结果
 * 5. 反事实推理 - "如果X没有发生，Y会发生吗？"
 */

import { EventEmitter } from "node:events";

// ==================== 类型定义 ====================

/**
 * 因果事件类型
 */
export type CausalEventType = 
  | "action"           // 主动行为
  | "reaction"         // 被动反应
  | "decision"         // 决策点
  | "observation"      // 观察事件
  | "error"            // 错误事件
  | "state_change"     // 状态变更
  | "external_event";  // 外部事件

/**
 * 因果关系强度
 */
export type CausalStrength = 
  | "strong"    // 强因果（确定性）
  | "moderate"  // 中等因果（概率性）
  | "weak";     // 弱因果（相关性）

/**
 * 因果事件节点
 */
export interface CausalEvent {
  id: string;                    // 事件唯一ID
  timestamp: number;             // 时间戳
  type: CausalEventType;         // 事件类型
  description: string;           // 事件描述
  actor?: string;                // 执行者（代理ID或系统组件）
  context?: Record<string, any>; // 上下文信息
  
  // 因果元数据
  causes: string[];              // 导致此事件的原因事件ID列表
  effects: string[];             // 此事件导致的结果事件ID列表
  strength: CausalStrength;      // 因果强度
  confidence: number;            // 置信度 (0-1)
  
  // 证据
  evidence?: CausalEvidence[];   // 支持因果关系的证据
  
  // 元数据
  metadata?: {
    tags?: string[];
    priority?: "low" | "medium" | "high" | "critical";
    category?: string;
  };
}

/**
 * 因果证据
 */
export interface CausalEvidence {
  type: "temporal" | "statistical" | "mechanistic" | "counterfactual";
  description: string;
  strength: number; // 0-1
  source?: string;  // 证据来源
}

/**
 * 因果路径
 */
export interface CausalPath {
  eventId: string;
  path: string[];          // 事件ID序列
  totalStrength: number;   // 路径总强度（各边强度的乘积）
  length: number;          // 路径长度
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  targetEventId: string;
  rootCauses: Array<{
    eventId: string;
    event: CausalEvent;
    distance: number;      // 距离目标事件的步数
    strength: number;      // 因果强度
    explanation: string;   // 解释
  }>;
  causalChain: CausalPath[];
  confidence: number;
  recommendations: string[];
}

/**
 * 因果推理结果
 */
export interface CausalInference {
  premiseEventId: string;
  possibleEffects: Array<{
    eventId?: string;      // 如果已发生
    description: string;
    probability: number;   // 发生概率
    timeframe?: string;    // 预期时间范围
    conditions?: string[]; // 前置条件
  }>;
  reasoning: string;
  confidence: number;
}

/**
 * 反事实推理结果
 */
export interface CounterfactualAnalysis {
  originalEventId: string;
  hypotheticalScenario: string;  // "如果X没有发生"
  predictedOutcome: {
    wouldHappen: boolean;
    alternativeEvents: string[];
    probability: number;
    explanation: string;
  };
  keyDependencies: string[];  // 关键依赖事件
  confidence: number;
}

/**
 * 因果图统计
 */
export interface CausalGraphStats {
  totalEvents: number;
  totalEdges: number;
  avgDegree: number;
  maxDepth: number;
  connectedComponents: number;
  eventTypeDistribution: Record<CausalEventType, number>;
  timeRange: {
    earliest: number;
    latest: number;
  };
}

// ==================== 因果图类 ====================

export class CausalGraph extends EventEmitter {
  private events: Map<string, CausalEvent> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // 邻接表
  private reverseAdjacencyList: Map<string, Set<string>> = new Map(); // 反向邻接表
  
  constructor() {
    super();
  }

  /**
   * 添加因果事件
   */
  addEvent(event: CausalEvent): void {
    if (this.events.has(event.id)) {
      throw new Error(`Event ${event.id} already exists`);
    }

    this.events.set(event.id, event);
    
    // 初始化邻接表
    if (!this.adjacencyList.has(event.id)) {
      this.adjacencyList.set(event.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(event.id)) {
      this.reverseAdjacencyList.set(event.id, new Set());
    }

    // 建立因果边
    for (const causeId of event.causes) {
      this.addCausalEdge(causeId, event.id, event.strength);
    }

    this.emit("eventAdded", event);
  }

  /**
   * 添加因果边
   */
  addCausalEdge(fromId: string, toId: string, strength: CausalStrength = "moderate"): void {
    if (!this.events.has(fromId) || !this.events.has(toId)) {
      throw new Error(`Both events must exist before adding edge`);
    }

    // 添加到邻接表
    this.adjacencyList.get(fromId)?.add(toId);
    this.reverseAdjacencyList.get(toId)?.add(fromId);

    // 更新事件的causes和effects
    const fromEvent = this.events.get(fromId)!;
    const toEvent = this.events.get(toId)!;
    
    if (!fromEvent.effects.includes(toId)) {
      fromEvent.effects.push(toId);
    }
    if (!toEvent.causes.includes(fromId)) {
      toEvent.causes.push(fromId);
    }

    this.emit("edgeAdded", { from: fromId, to: toId, strength });
  }

  /**
   * 获取事件
   */
  getEvent(id: string): CausalEvent | undefined {
    return this.events.get(id);
  }

  /**
   * 获取事件的所有原因
   */
  getCauses(eventId: string, depth: number = Infinity): CausalEvent[] {
    const visited = new Set<string>();
    const causes: CausalEvent[] = [];
    
    this._traverseBackward(eventId, depth, visited, causes);
    
    return causes;
  }

  /**
   * 获取事件的所有结果
   */
  getEffects(eventId: string, depth: number = Infinity): CausalEvent[] {
    const visited = new Set<string>();
    const effects: CausalEvent[] = [];
    
    this._traverseForward(eventId, depth, visited, effects);
    
    return effects;
  }

  /**
   * 查找所有因果路径
   */
  findAllPaths(fromId: string, toId: string, maxLength: number = 10): CausalPath[] {
    const paths: CausalPath[] = [];
    const visited = new Set<string>();
    
    this._dfs(fromId, toId, [fromId], visited, paths, maxLength);
    
    // 计算每条路径的总强度
    return paths.map(path => ({
      ...path,
      totalStrength: this._calculatePathStrength(path.path),
    }));
  }

  /**
   * 根因分析
   */
  analyzeRootCause(eventId: string, maxDepth: number = 5): RootCauseAnalysis {
    const targetEvent = this.events.get(eventId);
    if (!targetEvent) {
      throw new Error(`Event ${eventId} not found`);
    }

    // 找到所有根节点（没有原因的节点）
    const rootCauses: Array<{
      eventId: string;
      event: CausalEvent;
      distance: number;
      strength: number;
      explanation: string;
    }> = [];

    const visited = new Set<string>();
    this._findRootCauses(eventId, 0, maxDepth, visited, rootCauses);

    // 按强度和距离排序
    rootCauses.sort((a, b) => {
      // 优先强度，其次距离
      if (b.strength !== a.strength) return b.strength - a.strength;
      return a.distance - b.distance;
    });

    // 生成因果链
    const causalChains = rootCauses.slice(0, 5).map(rc => ({
      eventId: rc.eventId,
      path: this._findShortestPath(rc.eventId, eventId),
      totalStrength: rc.strength,
      length: rc.distance,
    }));

    // 生成建议
    const recommendations = this._generateRecommendations(rootCauses, targetEvent);

    return {
      targetEventId: eventId,
      rootCauses: rootCauses.slice(0, 10), // 最多返回10个根因
      causalChains,
      confidence: this._calculateConfidence(rootCauses),
      recommendations,
    };
  }

  /**
   * 因果推理：给定前提事件，推断可能的结果
   */
  inferEffects(premiseEventId: string): CausalInference {
    const premiseEvent = this.events.get(premiseEventId);
    if (!premiseEvent) {
      throw new Error(`Event ${premiseEventId} not found`);
    }

    // 获取直接和间接影响
    const directEffects = this.getEffects(premiseEventId, 1);
    const indirectEffects = this.getEffects(premiseEventId, 3);

    // 基于历史模式推断可能的结果
    const possibleEffects = this._predictPossibleEffects(premiseEvent, directEffects, indirectEffects);

    return {
      premiseEventId,
      possibleEffects,
      reasoning: this._generateReasoning(premiseEvent, possibleEffects),
      confidence: this._calculateInferenceConfidence(possibleEffects),
    };
  }

  /**
   * 反事实推理：如果某事件没有发生，会发生什么？
   */
  analyzeCounterfactual(eventId: string, scenario: string): CounterfactualAnalysis {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // 找出依赖此事件的所有事件
    const dependentEvents = this.getEffects(eventId, Infinity);
    
    // 分析哪些事件会受到影响
    const affectedEvents = dependentEvents.filter(e => 
      e.causes.includes(eventId) || this._hasCausalDependency(e.id, eventId)
    );

    // 预测替代结果
    const alternativeEvents = this._predictAlternatives(event, affectedEvents);

    return {
      originalEventId: eventId,
      hypotheticalScenario: scenario,
      predictedOutcome: {
        wouldHappen: alternativeEvents.length > 0,
        alternativeEvents: alternativeEvents.map(e => e.description),
        probability: this._calculateCounterfactualProbability(event, affectedEvents),
        explanation: this._generateCounterfactualExplanation(event, affectedEvents, alternativeEvents),
      },
      keyDependencies: affectedEvents.slice(0, 5).map(e => e.id),
      confidence: 0.7, // 反事实推理通常置信度较低
    };
  }

  /**
   * 获取因果图统计
   */
  getStats(): CausalGraphStats {
    const eventTypeDistribution: Record<CausalEventType, number> = {
      action: 0,
      reaction: 0,
      decision: 0,
      observation: 0,
      error: 0,
      state_change: 0,
      external_event: 0,
    };

    let totalEdges = 0;
    let maxDepth = 0;

    for (const event of this.events.values()) {
      eventTypeDistribution[event.type]++;
      totalEdges += event.effects.length;
      
      // 计算最大深度
      const depth = this._calculateDepth(event.id);
      maxDepth = Math.max(maxDepth, depth);
    }

    const totalEvents = this.events.size;
    const avgDegree = totalEvents > 0 ? (totalEdges * 2) / totalEvents : 0;

    // 计算连通分量
    const connectedComponents = this._countConnectedComponents();

    const timestamps = Array.from(this.events.values()).map(e => e.timestamp);
    const timeRange = {
      earliest: Math.min(...timestamps),
      latest: Math.max(...timestamps),
    };

    return {
      totalEvents,
      totalEdges,
      avgDegree,
      maxDepth,
      connectedComponents,
      eventTypeDistribution,
      timeRange,
    };
  }

  /**
   * 导出因果图为JSON
   */
  exportToJSON(): any {
    return {
      events: Array.from(this.events.values()),
      edges: Array.from(this.adjacencyList.entries()).flatMap(([from, tos]) =>
        Array.from(tos).map(to => ({ from, to }))
      ),
      stats: this.getStats(),
    };
  }

  /**
   * 清空因果图
   */
  clear(): void {
    this.events.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.emit("cleared");
  }

  // ==================== 私有方法 ====================

  private _traverseBackward(
    eventId: string,
    depth: number,
    visited: Set<string>,
    results: CausalEvent[]
  ): void {
    if (depth <= 0 || visited.has(eventId)) return;
    
    visited.add(eventId);
    const event = this.events.get(eventId);
    if (!event) return;

    for (const causeId of event.causes) {
      const causeEvent = this.events.get(causeId);
      if (causeEvent && !visited.has(causeId)) {
        results.push(causeEvent);
        this._traverseBackward(causeId, depth - 1, visited, results);
      }
    }
  }

  private _traverseForward(
    eventId: string,
    depth: number,
    visited: Set<string>,
    results: CausalEvent[]
  ): void {
    if (depth <= 0 || visited.has(eventId)) return;
    
    visited.add(eventId);
    const event = this.events.get(eventId);
    if (!event) return;

    for (const effectId of event.effects) {
      const effectEvent = this.events.get(effectId);
      if (effectEvent && !visited.has(effectId)) {
        results.push(effectEvent);
        this._traverseForward(effectId, depth - 1, visited, results);
      }
    }
  }

  private _dfs(
    currentId: string,
    targetId: string,
    path: string[],
    visited: Set<string>,
    paths: CausalPath[],
    maxLength: number
  ): void {
    if (path.length > maxLength) return;
    
    if (currentId === targetId) {
      paths.push({
        eventId: targetId,
        path: [...path],
        totalStrength: 0, // 稍后计算
        length: path.length,
      });
      return;
    }

    visited.add(currentId);
    
    const neighbors = this.adjacencyList.get(currentId);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          path.push(neighborId);
          this._dfs(neighborId, targetId, path, visited, paths, maxLength);
          path.pop();
        }
      }
    }
    
    visited.delete(currentId);
  }

  private _calculatePathStrength(path: string[]): number {
    if (path.length < 2) return 1.0;
    
    let strength = 1.0;
    for (let i = 0; i < path.length - 1; i++) {
      const fromEvent = this.events.get(path[i]);
      if (fromEvent) {
        const edgeStrength = this._strengthToNumber(fromEvent.strength);
        strength *= edgeStrength;
      }
    }
    
    return strength;
  }

  private _strengthToNumber(strength: CausalStrength): number {
    switch (strength) {
      case "strong": return 0.9;
      case "moderate": return 0.6;
      case "weak": return 0.3;
      default: return 0.5;
    }
  }

  private _findRootCauses(
    eventId: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    results: Array<{
      eventId: string;
      event: CausalEvent;
      distance: number;
      strength: number;
      explanation: string;
    }>
  ): void {
    if (currentDepth > maxDepth || visited.has(eventId)) return;
    
    visited.add(eventId);
    const event = this.events.get(eventId);
    if (!event) return;

    // 如果没有原因，这是一个根节点
    if (event.causes.length === 0) {
      results.push({
        eventId: event.id,
        event,
        distance: currentDepth,
        strength: this._calculateCausalStrength(eventId, event.id),
        explanation: this._generateRootCauseExplanation(event),
      });
      return;
    }

    // 继续向上追溯
    for (const causeId of event.causes) {
      this._findRootCauses(causeId, currentDepth + 1, maxDepth, visited, results);
    }
  }

  private _calculateCausalStrength(fromId: string, toId: string): number {
    // 简化的强度计算：基于路径上的最小强度
    const path = this._findShortestPath(fromId, toId);
    if (path.length === 0) return 0;
    
    let minStrength = 1.0;
    for (const eventId of path) {
      const event = this.events.get(eventId);
      if (event) {
        const s = this._strengthToNumber(event.strength);
        minStrength = Math.min(minStrength, s);
      }
    }
    
    return minStrength;
  }

  private _findShortestPath(fromId: string, toId: string): string[] {
    // BFS找最短路径
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: fromId, path: [fromId] }];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (nodeId === toId) {
        return path;
      }

      const neighbors = this.adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ nodeId: neighborId, path: [...path, neighborId] });
          }
        }
      }
    }

    return [];
  }

  private _generateRecommendations(
    rootCauses: Array<{ eventId: string; event: CausalEvent; distance: number; strength: number; explanation: string }>,
    targetEvent: CausalEvent
  ): string[] {
    const recommendations: string[] = [];

    // 基于根因类型生成建议
    for (const rc of rootCauses.slice(0, 3)) {
      switch (rc.event.type) {
        case "error":
          recommendations.push(`修复根本错误: ${rc.event.description}`);
          break;
        case "decision":
          recommendations.push(`重新评估决策: ${rc.event.description}`);
          break;
        case "action":
          recommendations.push(`优化操作执行: ${rc.event.description}`);
          break;
        default:
          recommendations.push(`监控和改进: ${rc.event.description}`);
      }
    }

    // 通用建议
    if (rootCauses.length > 3) {
      recommendations.push("考虑简化系统以减少因果链复杂度");
    }

    return recommendations;
  }

  private _calculateConfidence(
    rootCauses: Array<{ strength: number }>
  ): number {
    if (rootCauses.length === 0) return 0;
    
    // 基于根因数量和强度计算置信度
    const avgStrength = rootCauses.reduce((sum, rc) => sum + rc.strength, 0) / rootCauses.length;
    const countFactor = Math.min(1, rootCauses.length / 5); // 最多5个根因
    
    return avgStrength * (0.7 + 0.3 * countFactor);
  }

  private _predictPossibleEffects(
    premiseEvent: CausalEvent,
    directEffects: CausalEvent[],
    indirectEffects: CausalEvent[]
  ): Array<{
    eventId?: string;
    description: string;
    probability: number;
    timeframe?: string;
    conditions?: string[];
  }> {
    const effects: Array<{
      eventId?: string;
      description: string;
      probability: number;
      timeframe?: string;
      conditions?: string[];
    }> = [];

    // 直接影响（高概率）
    for (const effect of directEffects) {
      effects.push({
        eventId: effect.id,
        description: effect.description,
        probability: 0.8,
        timeframe: "immediate",
        conditions: effect.metadata?.tags,
      });
    }

    // 间接影响（中等概率）
    for (const effect of indirectEffects.slice(0, 5)) {
      if (!directEffects.find(d => d.id === effect.id)) {
        effects.push({
          eventId: effect.id,
          description: effect.description,
          probability: 0.5,
          timeframe: "short-term",
          conditions: effect.metadata?.tags,
        });
      }
    }

    // 基于模式推断的潜在影响
    const potentialEffects = this._inferPotentialEffects(premiseEvent);
    effects.push(...potentialEffects);

    return effects;
  }

  private _inferPotentialEffects(premiseEvent: CausalEvent): Array<{
    description: string;
    probability: number;
    timeframe?: string;
  }> {
    // 基于事件类型和历史模式推断
    const potentialEffects: Array<{
      description: string;
      probability: number;
      timeframe?: string;
    }> = [];

    switch (premiseEvent.type) {
      case "error":
        potentialEffects.push({
          description: "可能导致级联故障",
          probability: 0.6,
          timeframe: "short-term",
        });
        break;
      case "decision":
        potentialEffects.push({
          description: "可能触发后续行动",
          probability: 0.7,
          timeframe: "medium-term",
        });
        break;
      case "state_change":
        potentialEffects.push({
          description: "可能影响相关组件",
          probability: 0.5,
          timeframe: "immediate",
        });
        break;
    }

    return potentialEffects;
  }

  private _generateReasoning(
    premiseEvent: CausalEvent,
    effects: Array<{ description: string; probability: number }>
  ): string {
    const highProbEffects = effects.filter(e => e.probability > 0.7);
    const mediumProbEffects = effects.filter(e => e.probability > 0.4 && e.probability <= 0.7);

    let reasoning = `基于事件 "${premiseEvent.description}" (${premiseEvent.type})`;
    
    if (highProbEffects.length > 0) {
      reasoning += `\n高概率结果 (${highProbEffects.length}个): ${highProbEffects.map(e => e.description).join(", ")}`;
    }
    
    if (mediumProbEffects.length > 0) {
      reasoning += `\n中等概率结果 (${mediumProbEffects.length}个): ${mediumProbEffects.map(e => e.description).join(", ")}`;
    }

    reasoning += `\n推理依据: 历史因果模式和事件类型分析`;

    return reasoning;
  }

  private _calculateInferenceConfidence(
    effects: Array<{ probability: number }>
  ): number {
    if (effects.length === 0) return 0.3;
    
    const avgProbability = effects.reduce((sum, e) => sum + e.probability, 0) / effects.length;
    const countBonus = Math.min(0.2, effects.length * 0.05);
    
    return Math.min(0.95, avgProbability + countBonus);
  }

  private _predictAlternatives(
    removedEvent: CausalEvent,
    affectedEvents: CausalEvent[]
  ): CausalEvent[] {
    // 简化的替代预测：基于受影响事件的类型
    const alternatives: CausalEvent[] = [];

    for (const affected of affectedEvents.slice(0, 3)) {
      // 创建假设的替代事件
      alternatives.push({
        ...affected,
        id: `${affected.id}_alternative`,
        description: `[假设] 如果没有 "${removedEvent.description}", 可能发生: ${affected.description}`,
        causes: affected.causes.filter(c => c !== removedEvent.id),
      });
    }

    return alternatives;
  }

  private _calculateCounterfactualProbability(
    removedEvent: CausalEvent,
    affectedEvents: CausalEvent[]
  ): number {
    if (affectedEvents.length === 0) return 0;
    
    // 基于受影响事件的数量和强度估算
    const avgStrength = affectedEvents.reduce((sum, e) => {
      return sum + this._strengthToNumber(e.strength);
    }, 0) / affectedEvents.length;

    return Math.max(0.1, 1 - avgStrength);
  }

  private _generateCounterfactualExplanation(
    removedEvent: CausalEvent,
    affectedEvents: CausalEvent[],
    alternatives: CausalEvent[]
  ): string {
    let explanation = `如果 "${removedEvent.description}" 没有发生:\n`;
    
    if (affectedEvents.length === 0) {
      explanation += "没有其他事件会受到直接影响";
    } else {
      explanation += `${affectedEvents.length} 个事件可能会受到不同影响\n`;
      if (alternatives.length > 0) {
        explanation += `可能的替代结果: ${alternatives.map(a => a.description).join("; ")}`;
      }
    }

    return explanation;
  }

  private _hasCausalDependency(eventId: string, dependencyId: string): boolean {
    // 检查eventId是否依赖于dependencyId
    const event = this.events.get(eventId);
    if (!event) return false;

    if (event.causes.includes(dependencyId)) return true;

    // 递归检查
    for (const causeId of event.causes) {
      if (this._hasCausalDependency(causeId, dependencyId)) return true;
    }

    return false;
  }

  private _calculateDepth(eventId: string, visited: Set<string> = new Set()): number {
    if (visited.has(eventId)) return 0;
    visited.add(eventId);

    const event = this.events.get(eventId);
    if (!event || event.causes.length === 0) return 0;

    let maxDepth = 0;
    for (const causeId of event.causes) {
      const depth = this._calculateDepth(causeId, new Set(visited));
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  private _countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    for (const eventId of this.events.keys()) {
      if (!visited.has(eventId)) {
        components++;
        this._bfsVisit(eventId, visited);
      }
    }

    return components;
  }

  private _bfsVisit(startId: string, visited: Set<string>): void {
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // 访问后继
      const successors = this.adjacencyList.get(currentId);
      if (successors) {
        for (const successorId of successors) {
          if (!visited.has(successorId)) {
            visited.add(successorId);
            queue.push(successorId);
          }
        }
      }

      // 访问前驱
      const predecessors = this.reverseAdjacencyList.get(currentId);
      if (predecessors) {
        for (const predecessorId of predecessors) {
          if (!visited.has(predecessorId)) {
            visited.add(predecessorId);
            queue.push(predecessorId);
          }
        }
      }
    }
  }

  private _generateRootCauseExplanation(event: CausalEvent): string {
    return `根因 [${event.type}]: ${event.description}${event.actor ? ` (由 ${event.actor} 执行)` : ""}`;
  }
}

// ==================== 单例实例 ====================

let globalCausalGraph: CausalGraph | null = null;

export function getCausalGraph(): CausalGraph {
  if (!globalCausalGraph) {
    globalCausalGraph = new CausalGraph();
  }
  return globalCausalGraph;
}

export function resetCausalGraph(): void {
  globalCausalGraph = null;
}
