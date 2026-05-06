/**
 * 高级自主增强模块
 * 
 * 实现 Level 5 完全自治的关键能力：
 * 1. 战略规划自主 - 系统能够制定长期发展策略
 * 2. 资源调度自主 - 智能分配计算资源
 * 3. 学习进化自主 - 从历史数据中学习优化
 * 4. 协作协调自主 - 多代理间的智能协作
 */

import { createSubsystemLogger } from '../logging/subsystem.js';
import { metricsCollector, notificationManager, alertEngine } from './monitoring-alerting.js';
import { cacheManager, lazyLoader, performanceMonitor } from './performance-optimizer.js';
import { errorClassifier, retryHandler, circuitBreaker } from './error-handler.js';

const log = createSubsystemLogger('advanced-autonomy');

// ==================== 战略规划引擎 ====================

export interface StrategicGoal {
  id: string;
  name: string;
  description: string;
  priority: number; // 1-10
  timeframe: 'short' | 'medium' | 'long'; // <3月, 3-12月, >12月
  successMetrics: Array<{
    metric: string;
    target: number;
    current?: number;
  }>;
  dependencies?: string[];
  status: 'planning' | 'active' | 'completed' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export interface StrategicPlan {
  id: string;
  name: string;
  version: string;
  goals: StrategicGoal[];
  roadmap: Array<{
    phase: string;
    duration: string;
    objectives: string[];
    milestones: string[];
  }>;
  resourceAllocation: {
    compute: number; // 百分比
    storage: number;
    network: number;
  };
  riskAssessment: Array<{
    risk: string;
    probability: number; // 0-1
    impact: number; // 1-10
    mitigation: string;
  }>;
  createdAt: number;
  expiresAt: number;
}

export class StrategicPlanner {
  private plans: Map<string, StrategicPlan> = new Map();
  private activeGoals: Map<string, StrategicGoal> = new Map();
  private planningInterval: NodeJS.Timeout | null = null;

  /**
   * 创建战略规划
   */
  async createPlan(name: string, timeframeMonths: number): Promise<StrategicPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 分析当前状态
    const currentState = await this.analyzeCurrentState();
    
    // 识别机会和挑战
    const opportunities = await this.identifyOpportunities(currentState);
    const challenges = await this.identifyChallenges(currentState);
    
    // 生成战略目标
    const goals = await this.generateGoals(opportunities, challenges, timeframeMonths);
    
    // 制定路线图
    const roadmap = this.createRoadmap(goals, timeframeMonths);
    
    // 资源分配
    const resourceAllocation = this.allocateResources(goals);
    
    // 风险评估
    const riskAssessment = await this.assessRisks(goals);
    
    const plan: StrategicPlan = {
      id: planId,
      name,
      version: '1.0.0',
      goals,
      roadmap,
      resourceAllocation,
      riskAssessment,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeframeMonths * 30 * 24 * 60 * 60 * 1000,
    };
    
    this.plans.set(planId, plan);
    
    // 激活目标
    goals.forEach(goal => {
      if (goal.status === 'active') {
        this.activeGoals.set(goal.id, goal);
      }
    });
    
    log.info(`Strategic plan created: ${name} (${goals.length} goals)`);
    
    return plan;
  }

  /**
   * 分析当前状态
   */
  private async analyzeCurrentState(): Promise<{
    capabilities: number;
    performance: Record<string, any>;
    resources: Record<string, any>;
    issues: Array<{ type: string; severity: string; description: string }>;
  }> {
    // TODO: 集成实际的状态分析
    return {
      capabilities: 0,
      performance: {},
      resources: {},
      issues: [],
    };
  }

  /**
   * 识别机会
   */
  private async identifyOpportunities(currentState: any): Promise<Array<{
    type: string;
    description: string;
    potential: number;
    effort: number;
  }>> {
    // TODO: 实现机会识别逻辑
    return [];
  }

  /**
   * 识别挑战
   */
  private async identifyChallenges(currentState: any): Promise<Array<{
    type: string;
    description: string;
    urgency: number;
    complexity: number;
  }>> {
    // TODO: 实现挑战识别逻辑
    return [];
  }

  /**
   * 生成战略目标
   */
  private async generateGoals(
    opportunities: any[],
    challenges: any[],
    timeframeMonths: number
  ): Promise<StrategicGoal[]> {
    const goals: StrategicGoal[] = [];
    
    // 基于机会生成增长目标
    for (const opp of opportunities.slice(0, 3)) {
      goals.push({
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: `Leverage ${opp.type}`,
        description: opp.description,
        priority: Math.round(opp.potential / opp.effort * 10),
        timeframe: timeframeMonths < 3 ? 'short' : timeframeMonths < 12 ? 'medium' : 'long',
        successMetrics: [{
          metric: 'capability_score',
          target: opp.potential * 10,
        }],
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    // 基于挑战生成改进目标
    for (const chal of challenges.slice(0, 2)) {
      goals.push({
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: `Address ${chal.type}`,
        description: chal.description,
        priority: Math.round(chal.urgency * chal.complexity),
        timeframe: 'short',
        successMetrics: [{
          metric: 'issue_resolution_rate',
          target: 100,
        }],
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    return goals;
  }

  /**
   * 创建路线图
   */
  private createRoadmap(goals: StrategicGoal[], timeframeMonths: number): StrategicPlan['roadmap'] {
    const phases: StrategicPlan['roadmap'] = [];
    
    if (timeframeMonths <= 3) {
      phases.push({
        phase: 'Phase 1: Quick Wins',
        duration: `${timeframeMonths} months`,
        objectives: goals.filter(g => g.timeframe === 'short').map(g => g.name),
        milestones: ['Initial implementation', 'Testing and validation', 'Deployment'],
      });
    } else if (timeframeMonths <= 12) {
      phases.push(
        {
          phase: 'Phase 1: Foundation',
          duration: '3 months',
          objectives: goals.filter(g => g.timeframe === 'short').map(g => g.name),
          milestones: ['Core capabilities established', 'Basic infrastructure ready'],
        },
        {
          phase: 'Phase 2: Expansion',
          duration: '6 months',
          objectives: goals.filter(g => g.timeframe === 'medium').map(g => g.name),
          milestones: ['Extended functionality', 'Performance optimization'],
        },
        {
          phase: 'Phase 3: Maturity',
          duration: '3 months',
          objectives: goals.filter(g => g.timeframe === 'long').map(g => g.name),
          milestones: ['Full feature set', 'Production readiness'],
        }
      );
    } else {
      phases.push(
        {
          phase: 'Year 1: Foundation & Growth',
          duration: '12 months',
          objectives: goals.slice(0, 5).map(g => g.name),
          milestones: ['Core platform established', 'First major release'],
        },
        {
          phase: 'Year 2: Scaling & Optimization',
          duration: '12 months',
          objectives: goals.slice(5, 10).map(g => g.name),
          milestones: ['Scale to production', 'Performance targets met'],
        },
        {
          phase: 'Year 3+: Innovation & Leadership',
          duration: `${timeframeMonths - 24} months`,
          objectives: goals.slice(10).map(g => g.name),
          milestones: ['Industry leadership', 'Continuous innovation'],
        }
      );
    }
    
    return phases;
  }

  /**
   * 资源分配
   */
  private allocateResources(goals: StrategicGoal[]): StrategicPlan['resourceAllocation'] {
    const totalPriority = goals.reduce((sum, g) => sum + g.priority, 0);
    
    return {
      compute: Math.min(80, Math.round(totalPriority / goals.length * 10)),
      storage: Math.min(70, Math.round(totalPriority / goals.length * 8)),
      network: Math.min(60, Math.round(totalPriority / goals.length * 6)),
    };
  }

  /**
   * 风险评估
   */
  private async assessRisks(goals: StrategicGoal[]): Promise<StrategicPlan['riskAssessment']> {
    // TODO: 实现风险评估逻辑
    return [
      {
        risk: 'Resource constraints',
        probability: 0.3,
        impact: 7,
        mitigation: 'Implement resource pooling and optimization',
      },
      {
        risk: 'Technical complexity',
        probability: 0.5,
        impact: 6,
        mitigation: 'Incremental development with regular reviews',
      },
    ];
  }

  /**
   * 启动定期规划更新
   */
  startPeriodicPlanning(intervalMs: number = 7 * 24 * 60 * 60 * 1000): void {
    // 每周重新规划一次
    this.planningInterval = setInterval(async () => {
      await this.updatePlans();
    }, intervalMs);
    
    log.info('Periodic strategic planning started');
  }

  /**
   * 更新规划
   */
  private async updatePlans(): Promise<void> {
    log.info('Updating strategic plans...');
    
    // 检查目标进度
    for (const [goalId, goal] of this.activeGoals.entries()) {
      const progress = await this.measureGoalProgress(goal);
      
      if (progress >= 100) {
        goal.status = 'completed';
        log.info(`Goal completed: ${goal.name}`);
        
        // 通知完成
        await notificationManager.send({
          alertId: `goal-completed-${goalId}`,
          alertName: 'Strategic Goal Completed',
          severity: 'info',
          message: `Goal "${goal.name}" has been completed successfully`,
          timestamp: Date.now(),
        });
      }
    }
    
    // 清理过期计划
    const now = Date.now();
    for (const [planId, plan] of this.plans.entries()) {
      if (now > plan.expiresAt) {
        this.plans.delete(planId);
        log.info(`Expired plan removed: ${plan.name}`);
      }
    }
  }

  /**
   * 测量目标进度
   */
  private async measureGoalProgress(goal: StrategicGoal): Promise<number> {
    // TODO: 实现实际的进度测量
    return 0;
  }

  /**
   * 获取所有规划
   */
  getPlans(): StrategicPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * 获取活跃目标
   */
  getActiveGoals(): StrategicGoal[] {
    return Array.from(this.activeGoals.values());
  }
}

// ==================== 资源调度器 ====================

export interface ResourceRequest {
  id: string;
  requester: string;
  resourceType: 'compute' | 'memory' | 'storage' | 'network';
  amount: number;
  priority: number; // 1-10
  deadline?: number;
  metadata?: Record<string, any>;
}

export interface ResourceAllocation {
  requestId: string;
  allocated: number;
  startTime: number;
  endTime?: number;
  status: 'allocated' | 'released' | 'expired';
}

export class ResourceScheduler {
  private allocations: Map<string, ResourceAllocation> = new Map();
  private pendingRequests: ResourceRequest[] = [];
  private totalResources: Map<string, number> = new Map([
    ['compute', 100],
    ['memory', 100],
    ['storage', 100],
    ['network', 100],
  ]);
  private usedResources: Map<string, number> = new Map([
    ['compute', 0],
    ['memory', 0],
    ['storage', 0],
    ['network', 0],
  ]);

  /**
   * 请求资源
   */
  async requestResource(request: ResourceRequest): Promise<ResourceAllocation> {
    const available = this.getAvailableResources(request.resourceType);
    
    if (available >= request.amount) {
      // 立即分配
      return this.allocateResource(request);
    } else {
      // 加入等待队列
      this.pendingRequests.push(request);
      log.info(`Resource request queued: ${request.id} (waiting for ${request.resourceType})`);
      
      // 尝试通过优先级调度释放资源
      await this.tryPreemptiveScheduling(request);
      
      // 如果仍然无法满足，等待
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const nowAvailable = this.getAvailableResources(request.resourceType);
          if (nowAvailable >= request.amount) {
            clearInterval(checkInterval);
            this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
            resolve(this.allocateResource(request));
          } else if (request.deadline && Date.now() > request.deadline) {
            clearInterval(checkInterval);
            this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
            reject(new Error(`Resource request timeout: ${request.id}`));
          }
        }, 1000);
      });
    }
  }

  /**
   * 分配资源
   */
  private allocateResource(request: ResourceRequest): ResourceAllocation {
    const used = this.usedResources.get(request.resourceType) || 0;
    this.usedResources.set(request.resourceType, used + request.amount);
    
    const allocation: ResourceAllocation = {
      requestId: request.id,
      allocated: request.amount,
      startTime: Date.now(),
      status: 'allocated',
    };
    
    this.allocations.set(request.id, allocation);
    
    log.info(`Resource allocated: ${request.id} (${request.amount} ${request.resourceType})`);
    
    return allocation;
  }

  /**
   * 释放资源
   */
  releaseResource(requestId: string): void {
    const allocation = this.allocations.get(requestId);
    if (!allocation) {
      log.warn(`Allocation not found: ${requestId}`);
      return;
    }
    
    // 找到对应的请求以获取资源类型
    const request = this.pendingRequests.find(r => r.id === requestId);
    if (request) {
      const used = this.usedResources.get(request.resourceType) || 0;
      this.usedResources.set(request.resourceType, Math.max(0, used - allocation.allocated));
    }
    
    allocation.status = 'released';
    allocation.endTime = Date.now();
    
    log.info(`Resource released: ${requestId}`);
  }

  /**
   * 获取可用资源
   */
  private getAvailableResources(resourceType: string): number {
    const total = this.totalResources.get(resourceType) || 0;
    const used = this.usedResources.get(resourceType) || 0;
    return Math.max(0, total - used);
  }

  /**
   * 尝试抢占式调度
   */
  private async tryPreemptiveScheduling(highPriorityRequest: ResourceRequest): Promise<void> {
    // 查找低优先级的分配
    const lowPriorityAllocations = Array.from(this.allocations.values())
      .filter(alloc => alloc.status === 'allocated')
      .filter(alloc => {
        // 找到对应的请求
        const req = this.pendingRequests.find(r => r.id === alloc.requestId);
        return req && req.priority < highPriorityRequest.priority;
      });
    
    // 如果找到可以释放的资源
    for (const alloc of lowPriorityAllocations) {
      const available = this.getAvailableResources(highPriorityRequest.resourceType);
      if (available >= highPriorityRequest.amount) {
        break;
      }
      
      // 释放低优先级资源
      this.releaseResource(alloc.requestId);
      log.info(`Preempted resource allocation: ${alloc.requestId}`);
    }
  }

  /**
   * 获取资源使用统计
   */
  getResourceStats(): Record<string, { total: number; used: number; available: number; usagePercent: number }> {
    const stats: Record<string, any> = {};
    
    for (const [type, total] of this.totalResources.entries()) {
      const used = this.usedResources.get(type) || 0;
      const available = total - used;
      const usagePercent = (used / total) * 100;
      
      stats[type] = {
        total,
        used,
        available,
        usagePercent: Math.round(usagePercent * 100) / 100,
      };
    }
    
    return stats;
  }
}

// ==================== 学习进化引擎 ====================

export interface LearningRecord {
  id: string;
  timestamp: number;
  eventType: string;
  context: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
  performance: {
    duration?: number;
    quality?: number; // 0-1
    efficiency?: number; // 0-1
  };
  lessonsLearned: Array<{
    insight: string;
    confidence: number; // 0-1
    applicability: string[];
  }>;
}

export interface AdaptationRule {
  id: string;
  condition: (context: Record<string, any>) => boolean;
  action: (context: Record<string, any>) => Promise<void>;
  triggerCount: number;
  successRate: number;
  lastTriggered?: number;
}

export class LearningEngine {
  private learningRecords: LearningRecord[] = [];
  private adaptationRules: Map<string, AdaptationRule> = new Map();
  private maxRecords: number;

  constructor(maxRecords: number = 100000) {
    this.maxRecords = maxRecords;
  }

  /**
   * 记录学习事件
   */
  recordLearning(event: Omit<LearningRecord, 'id' | 'timestamp'>): void {
    const record: LearningRecord = {
      ...event,
      id: `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    this.learningRecords.push(record);
    
    // 限制记录数量
    if (this.learningRecords.length > this.maxRecords) {
      this.learningRecords = this.learningRecords.slice(-this.maxRecords);
    }
    
    // 提取经验教训
    this.extractInsights(record);
    
    // 更新适应规则
    this.updateAdaptationRules(record);
    
    log.debug(`Learning recorded: ${event.eventType} (${event.outcome})`);
  }

  /**
   * 提取经验教训
   */
  private extractInsights(record: LearningRecord): void {
    // TODO: 实现机器学习算法来提取洞察
    // 这里使用简单的启发式方法
    
    if (record.outcome === 'failure') {
      // 从失败中学习
      const lesson = {
        insight: `Avoid similar approach in ${record.eventType}`,
        confidence: 0.7,
        applicability: [record.eventType],
      };
      record.lessonsLearned.push(lesson);
    } else if (record.outcome === 'success' && record.performance.quality! > 0.8) {
      // 从成功中学习最佳实践
      const lesson = {
        insight: `Replicate successful pattern in ${record.eventType}`,
        confidence: 0.8,
        applicability: [record.eventType],
      };
      record.lessonsLearned.push(lesson);
    }
  }

  /**
   * 更新适应规则
   */
  private updateAdaptationRules(record: LearningRecord): void {
    // 根据学习记录自动创建或更新适应规则
    // TODO: 实现更复杂的规则学习算法
  }

  /**
   * 注册适应规则
   */
  registerAdaptationRule(rule: Omit<AdaptationRule, 'triggerCount' | 'successRate'>): void {
    this.adaptationRules.set(rule.id, {
      ...rule,
      triggerCount: 0,
      successRate: 0,
    });
    
    log.info(`Adaptation rule registered: ${rule.id}`);
  }

  /**
   * 应用适应规则
   */
  async applyAdaptationRules(context: Record<string, any>): Promise<void> {
    for (const [ruleId, rule] of this.adaptationRules.entries()) {
      if (rule.condition(context)) {
        try {
          await rule.action(context);
          rule.triggerCount++;
          rule.lastTriggered = Date.now();
          
          log.info(`Adaptation rule applied: ${ruleId}`);
        } catch (error) {
          log.error(`Adaptation rule failed: ${ruleId}`, error);
        }
      }
    }
  }

  /**
   * 获取学习统计
   */
  getLearningStats(timeRange?: { start: number; end: number }): {
    totalEvents: number;
    successRate: number;
    averageQuality: number;
    topInsights: Array<{ insight: string; count: number }>;
  } {
    let records = this.learningRecords;
    
    if (timeRange) {
      records = records.filter(
        r => r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
    }
    
    const total = records.length;
    const successes = records.filter(r => r.outcome === 'success').length;
    const successRate = total > 0 ? (successes / total) * 100 : 0;
    
    const qualities = records.map(r => r.performance.quality || 0);
    const averageQuality = qualities.length > 0
      ? qualities.reduce((a, b) => a + b, 0) / qualities.length
      : 0;
    
    // 统计最常见的洞察
    const insightCounts: Record<string, number> = {};
    records.forEach(r => {
      r.lessonsLearned.forEach(lesson => {
        insightCounts[lesson.insight] = (insightCounts[lesson.insight] || 0) + 1;
      });
    });
    
    const topInsights = Object.entries(insightCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([insight, count]) => ({ insight, count }));
    
    return {
      totalEvents: total,
      successRate: Math.round(successRate * 100) / 100,
      averageQuality: Math.round(averageQuality * 100) / 100,
      topInsights,
    };
  }

  /**
   * 获取适应规则列表
   */
  getAdaptationRules(): AdaptationRule[] {
    return Array.from(this.adaptationRules.values());
  }
}

// ==================== 协作协调器 ====================

export interface AgentCapability {
  agentId: string;
  capabilities: string[];
  currentLoad: number; // 0-100
  availability: 'available' | 'busy' | 'offline';
  performance: {
    avgResponseTime: number;
    successRate: number;
    qualityScore: number;
  };
}

export interface CollaborationTask {
  id: string;
  description: string;
  requiredCapabilities: string[];
  priority: number; // 1-10
  deadline?: number;
  assignedAgents: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export class CollaborationCoordinator {
  private agents: Map<string, AgentCapability> = new Map();
  private tasks: Map<string, CollaborationTask> = new Map();
  private collaborationHistory: Array<{
    taskId: string;
    agents: string[];
    outcome: 'success' | 'failure';
    duration: number;
  }> = [];

  /**
   * 注册代理
   */
  registerAgent(agent: AgentCapability): void {
    this.agents.set(agent.agentId, agent);
    log.info(`Agent registered: ${agent.agentId} (${agent.capabilities.join(', ')})`);
  }

  /**
   * 注销代理
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    log.info(`Agent unregistered: ${agentId}`);
  }

  /**
   * 创建协作任务
   */
  async createTask(task: Omit<CollaborationTask, 'id' | 'createdAt' | 'status' | 'assignedAgents'>): Promise<CollaborationTask> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: CollaborationTask = {
      ...task,
      id: taskId,
      createdAt: Date.now(),
      status: 'pending',
      assignedAgents: [],
    };
    
    this.tasks.set(taskId, fullTask);
    
    // 自动分配代理
    await this.assignAgents(fullTask);
    
    log.info(`Collaboration task created: ${taskId}`);
    
    return fullTask;
  }

  /**
   * 分配代理
   */
  private async assignAgents(task: CollaborationTask): Promise<void> {
    // 查找具备所需能力的代理
    const candidates = Array.from(this.agents.values())
      .filter(agent => agent.availability === 'available')
      .filter(agent => 
        task.requiredCapabilities.every(cap => 
          agent.capabilities.includes(cap)
        )
      )
      .sort((a, b) => {
        // 按负载和性能排序
        const loadScoreA = 100 - a.currentLoad;
        const loadScoreB = 100 - b.currentLoad;
        const perfScoreA = a.performance.qualityScore * a.performance.successRate;
        const perfScoreB = b.performance.qualityScore * b.performance.successRate;
        
        return (loadScoreA + perfScoreA) - (loadScoreB + perfScoreB);
      });
    
    // 选择最优的代理组合
    const selectedAgents = candidates.slice(0, Math.min(3, candidates.length));
    
    if (selectedAgents.length === 0) {
      log.warn(`No suitable agents found for task: ${task.id}`);
      task.status = 'failed';
      return;
    }
    
    task.assignedAgents = selectedAgents.map(a => a.agentId);
    task.status = 'in_progress';
    
    // 更新代理状态
    selectedAgents.forEach(agent => {
      agent.availability = 'busy';
      agent.currentLoad = Math.min(100, agent.currentLoad + 20);
    });
    
    log.info(`Agents assigned to task ${task.id}: ${task.assignedAgents.join(', ')}`);
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string, success: boolean): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.warn(`Task not found: ${taskId}`);
      return;
    }
    
    task.status = success ? 'completed' : 'failed';
    task.completedAt = Date.now();
    
    // 释放代理
    task.assignedAgents.forEach(agentId => {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.availability = 'available';
        agent.currentLoad = Math.max(0, agent.currentLoad - 20);
      }
    });
    
    // 记录协作历史
    this.collaborationHistory.push({
      taskId,
      agents: task.assignedAgents,
      outcome: success ? 'success' : 'failure',
      duration: task.completedAt - task.createdAt,
    });
    
    log.info(`Task ${taskId} ${success ? 'completed' : 'failed'}`);
  }

  /**
   * 获取协作效率统计
   */
  getCollaborationStats(): {
    totalTasks: number;
    successRate: number;
    averageDuration: number;
    agentUtilization: Record<string, number>;
  } {
    const total = this.collaborationHistory.length;
    const successes = this.collaborationHistory.filter(h => h.outcome === 'success').length;
    const successRate = total > 0 ? (successes / total) * 100 : 0;
    
    const durations = this.collaborationHistory.map(h => h.duration);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    // 计算代理利用率
    const agentUtilization: Record<string, number> = {};
    this.agents.forEach((agent, agentId) => {
      const taskCount = this.collaborationHistory.filter(h => 
        h.agents.includes(agentId)
      ).length;
      agentUtilization[agentId] = total > 0 ? (taskCount / total) * 100 : 0;
    });
    
    return {
      totalTasks: total,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      agentUtilization,
    };
  }
}

// ==================== 导出单例实例 ====================

export const strategicPlanner = new StrategicPlanner();

export const resourceScheduler = new ResourceScheduler();

export const learningEngine = new LearningEngine();

export const collaborationCoordinator = new CollaborationCoordinator();
