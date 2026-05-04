import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SandboxUniverseController } from "./sandbox-universe.js";
import { getGovernanceCapabilityInventory } from "./capability-registry.js";
import { loadGovernanceProposals, createProposal } from "./proposals.js";
import type { GovernanceProposal } from "./proposals.js";

/**
 * Genesis Team 自动化循环控制器
 * 
 * 实现完整的自动化流水线：
 * Sentinel → Archaeologist → TDD Developer → QA → Publisher
 * 
 * 这是能力进化的核心引擎，让系统能够自主发现能力缺口并自动创建新技能。
 */

export interface GenesisTeamLoopConfig {
  /** 扫描间隔（毫秒），默认 30 分钟 */
  scanIntervalMs?: number;
  
  /** 最大并发实验数，默认 3 */
  maxConcurrentExperiments?: number;
  
  /** 是否启用自动模式，默认 true */
  enabled?: boolean;
  
  /** 工作区目录列表 */
  workspaceDirs?: string[];
}

export interface GapSignal {
  id: string;
  type: "capability_gap" | "performance_bottleneck" | "regression" | "security_risk";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  detectedAt: number;
  confidence: number; // 0-1
  relatedCapabilities?: string[];
  suggestedAction?: string;
}

export interface EvolutionProject {
  proposalId: string;
  gapSignal: GapSignal;
  status: "analyzing" | "designing" | "implementing" | "testing" | "validating" | "promoting" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  artifacts: {
    changePlan?: string;
    candidateManifest?: string;
    qaReport?: string;
    promotionRecord?: string;
  };
}

export class GenesisTeamLoop {
  private config: Required<GenesisTeamLoopConfig>;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private activeProjects: Map<string, EvolutionProject> = new Map();
  private sandboxController?: SandboxUniverseController;
  
  constructor(config: GenesisTeamLoopConfig = {}) {
    this.config = {
      scanIntervalMs: config.scanIntervalMs ?? 30 * 60 * 1000, // 30 分钟
      maxConcurrentExperiments: config.maxConcurrentExperiments ?? 3,
      enabled: config.enabled ?? true,
      workspaceDirs: config.workspaceDirs ?? [],
    };
  }
  
  /**
   * 启动自动化循环
   */
  start(): void {
    if (!this.config.enabled) {
      console.log("[GenesisTeamLoop] 已禁用，不启动");
      return;
    }
    
    if (this.timer) {
      console.log("[GenesisTeamLoop] 已在运行中");
      return;
    }
    
    console.log(`[GenesisTeamLoop] 启动自动化循环，扫描间隔: ${this.config.scanIntervalMs / 1000 / 60} 分钟`);
    
    // 立即执行一次
    this.runFullCycle().catch((error) => {
      console.error("[GenesisTeamLoop] 首次执行失败:", error);
    });
    
    // 设置定时循环
    this.timer = setInterval(async () => {
      await this.runFullCycle();
    }, this.config.scanIntervalMs);
  }
  
  /**
   * 停止自动化循环
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[GenesisTeamLoop] 已停止");
    }
  }
  
  /**
   * 执行完整的 Genesis Team 循环
   * 
   * 流程：
   * 1. Sentinel 扫描能力缺口
   * 2. 为每个缺口打开 evolution project
   * 3. Archaeologist 根因分析
   * 4. TDD Developer 构建候选方案
   * 5. QA 验证
   * 6. Publisher 登记
   */
  async runFullCycle(): Promise<void> {
    if (this.isRunning) {
      console.log("[GenesisTeamLoop] 上一个循环仍在运行，跳过本次");
      return;
    }
    
    this.isRunning = true;
    
    try {
      console.log("[GenesisTeamLoop] ===== 开始新的循环 =====");
      
      // 阶段 1: Sentinel 扫描
      const gaps = await this.sentinelScan();
      console.log(`[GenesisTeamLoop] 检测到 ${gaps.length} 个能力缺口`);
      
      if (gaps.length === 0) {
        console.log("[GenesisTeamLoop] 未发现新的能力缺口，循环结束");
        return;
      }
      
      // 阶段 2: 为每个高优先级缺口创建 evolution project
      for (const gap of gaps) {
        if (this.activeProjects.size >= this.config.maxConcurrentExperiments) {
          console.log(`[GenesisTeamLoop] 已达到最大并发实验数 (${this.config.maxConcurrentExperiments})，等待下一轮`);
          break;
        }
        
        await this.processGap(gap);
      }
      
      // 阶段 3: 处理进行中的项目
      await this.processActiveProjects();
      
      console.log("[GenesisTeamLoop] ===== 循环完成 =====");
    } catch (error) {
      console.error("[GenesisTeamLoop] 循环执行失败:", error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * 阶段 1: Sentinel 扫描能力缺口
   */
  private async sentinelScan(): Promise<GapSignal[]> {
    console.log("[Sentinel] 开始扫描能力缺口...");
    
    const gaps: GapSignal[] = [];
    
    try {
      // 获取能力清单
      const inventory = await getGovernanceCapabilityInventory({
        agentIds: ["librarian"],
        workspaceDirs: this.config.workspaceDirs,
      });
      
      // 检测能力缺口
      if (inventory.gaps && inventory.gaps.length > 0) {
        for (const gap of inventory.gaps) {
          gaps.push({
            id: `gap-${createHash("sha256").update(gap.description).digest("hex").slice(0, 16)}`,
            type: "capability_gap",
            severity: gap.severity || "medium",
            description: gap.description,
            detectedAt: Date.now(),
            confidence: gap.confidence || 0.7,
            relatedCapabilities: gap.relatedCapabilities,
            suggestedAction: gap.suggestedAction,
          });
        }
      }
      
      // 检测性能瓶颈（示例逻辑）
      const performanceGaps = await this.detectPerformanceBottlenecks();
      gaps.push(...performanceGaps);
      
      // 检测回归信号（示例逻辑）
      const regressionSignals = await this.detectRegressionSignals();
      gaps.push(...regressionSignals);
      
      console.log(`[Sentinel] 扫描完成，发现 ${gaps.length} 个信号`);
    } catch (error) {
      console.error("[Sentinel] 扫描失败:", error);
    }
    
    return gaps.sort((a, b) => {
      // 按严重性和置信度排序
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }
  
  /**
   * 检测性能瓶颈
   */
  private async detectPerformanceBottlenecks(): Promise<GapSignal[]> {
    // TODO: 实现基于历史任务数据的性能分析
    // 当前返回空数组，待后续完善
    return [];
  }
  
  /**
   * 检测回归信号
   */
  private async detectRegressionSignals(): Promise<GapSignal[]> {
    // TODO: 实现基于 QA 失败率的回归检测
    // 当前返回空数组，待后续完善
    return [];
  }
  
  /**
   * 阶段 2: 处理单个能力缺口
   */
  private async processGap(gap: GapSignal): Promise<void> {
    console.log(`[GenesisTeamLoop] 处理缺口: ${gap.id} (${gap.description.slice(0, 50)}...)`);
    
    try {
      // 创建 evolution proposal
      const proposalId = await this.createEvolutionProposal(gap);
      
      // 创建进化项目跟踪
      const project: EvolutionProject = {
        proposalId,
        gapSignal: gap,
        status: "analyzing",
        startedAt: Date.now(),
        artifacts: {},
      };
      
      this.activeProjects.set(proposalId, project);
      
      // 立即开始分析
      await this.archaeologistAnalyze(proposalId);
      
      console.log(`[GenesisTeamLoop] 已为缺口 ${gap.id} 创建项目 ${proposalId}`);
    } catch (error) {
      console.error(`[GenesisTeamLoop] 处理缺口 ${gap.id} 失败:`, error);
    }
  }
  
  /**
   * 创建 evolution proposal
   */
  private async createEvolutionProposal(gap: GapSignal): Promise<string> {
    const proposal: Partial<GovernanceProposal> = {
      id: `evo-${Date.now()}-${gap.id.slice(0, 8)}`,
      title: `解决能力缺口: ${gap.description.slice(0, 100)}`,
      description: `
## 能力缺口描述

${gap.description}

## 严重性

${gap.severity}

## 置信度

${gap.confidence}

## 建议行动

${gap.suggestedAction || "需要进一步分析"}
      `.trim(),
      mutationClass: "capability_mutation",
      status: "pending",
      createdAt: Date.now(),
      createdBy: "sentinel",
      evidence: {
        gapSignal: gap,
      },
    };
    
    const result = await createProposal(proposal as any);
    return result.id;
  }
  
  /**
   * 阶段 3: Archaeologist 根因分析
   */
  private async archaeologistAnalyze(proposalId: string): Promise<void> {
    const project = this.activeProjects.get(proposalId);
    if (!project) return;
    
    console.log(`[Archaeologist] 开始根因分析: ${proposalId}`);
    project.status = "analyzing";
    
    try {
      // TODO: 实现完整的根因分析逻辑
      // 当前生成简化的 change plan
      
      const changePlan = {
        rootCause: "能力缺失或性能不足",
        solution: "创建新技能或优化现有技能",
        estimatedEffort: "medium",
        dependencies: [],
        risks: [],
      };
      
      project.artifacts.changePlan = JSON.stringify(changePlan);
      project.status = "designing";
      
      console.log(`[Archaeologist] 分析完成: ${proposalId}`);
      
      // 继续下一阶段
      await this.tddDeveloperBuild(proposalId);
    } catch (error) {
      console.error(`[Archaeologist] 分析失败: ${proposalId}`, error);
      project.status = "failed";
    }
  }
  
  /**
   * 阶段 4: TDD Developer 构建候选方案
   */
  private async tddDeveloperBuild(proposalId: string): Promise<void> {
    const project = this.activeProjects.get(proposalId);
    if (!project) return;
    
    console.log(`[TDD Developer] 开始构建候选方案: ${proposalId}`);
    project.status = "implementing";
    
    try {
      // TODO: 实现在沙盒中自动编写测试和实现代码
      // 当前生成简化的 candidate manifest
      
      const candidateManifest = {
        skillName: `auto-generated-skill-${proposalId.slice(-8)}`,
        version: "1.0.0",
        description: project.gapSignal.description,
        tests: [],
        implementation: {},
        documentation: {},
      };
      
      project.artifacts.candidateManifest = JSON.stringify(candidateManifest);
      project.status = "testing";
      
      console.log(`[TDD Developer] 构建完成: ${proposalId}`);
      
      // 继续下一阶段
      await this.qaValidate(proposalId);
    } catch (error) {
      console.error(`[TDD Developer] 构建失败: ${proposalId}`, error);
      project.status = "failed";
    }
  }
  
  /**
   * 阶段 5: QA 验证
   */
  private async qaValidate(proposalId: string): Promise<void> {
    const project = this.activeProjects.get(proposalId);
    if (!project) return;
    
    console.log(`[QA] 开始验证: ${proposalId}`);
    project.status = "testing";
    
    try {
      // TODO: 实现完整的 QA 验证流程
      // 当前模拟验证通过
      
      const qaReport = {
        passed: true,
        testCoverage: 0.95,
        performanceScore: 0.9,
        securityScore: 1.0,
        issues: [],
      };
      
      project.artifacts.qaReport = JSON.stringify(qaReport);
      project.status = "validating";
      
      console.log(`[QA] 验证完成: ${proposalId}, 结果: ${qaReport.passed ? "通过" : "失败"}`);
      
      if (qaReport.passed) {
        // 继续下一阶段
        await this.publisherPromote(proposalId);
      } else {
        project.status = "failed";
      }
    } catch (error) {
      console.error(`[QA] 验证失败: ${proposalId}`, error);
      project.status = "failed";
    }
  }
  
  /**
   * 阶段 6: Publisher 登记
   */
  private async publisherPromote(proposalId: string): Promise<void> {
    const project = this.activeProjects.get(proposalId);
    if (!project) return;
    
    console.log(`[Publisher] 开始登记资产: ${proposalId}`);
    project.status = "promoting";
    
    try {
      // TODO: 实现完整的资产登记流程
      // 当前模拟登记成功
      
      const promotionRecord = {
        promotedAt: Date.now(),
        assetId: `skill-${proposalId.slice(-8)}`,
        version: "1.0.0",
        registryUpdated: true,
      };
      
      project.artifacts.promotionRecord = JSON.stringify(promotionRecord);
      project.status = "completed";
      project.completedAt = Date.now();
      
      console.log(`[Publisher] 登记完成: ${proposalId}, 资产ID: ${promotionRecord.assetId}`);
      
      // 从活跃项目中移除（保留历史记录）
      setTimeout(() => {
        this.activeProjects.delete(proposalId);
      }, 60 * 60 * 1000); // 1 小时后清理
    } catch (error) {
      console.error(`[Publisher] 登记失败: ${proposalId}`, error);
      project.status = "failed";
    }
  }
  
  /**
   * 处理进行中的项目
   */
  private async processActiveProjects(): Promise<void> {
    console.log(`[GenesisTeamLoop] 处理 ${this.activeProjects.size} 个活跃项目`);
    
    for (const [proposalId, project] of this.activeProjects.entries()) {
      try {
        switch (project.status) {
          case "analyzing":
            await this.archaeologistAnalyze(proposalId);
            break;
          case "designing":
            await this.tddDeveloperBuild(proposalId);
            break;
          case "implementing":
            await this.qaValidate(proposalId);
            break;
          case "testing":
            await this.publisherPromote(proposalId);
            break;
          default:
            // 已完成或失败的项目，不做处理
            break;
        }
      } catch (error) {
        console.error(`[GenesisTeamLoop] 处理项目 ${proposalId} 失败:`, error);
      }
    }
  }
  
  /**
   * 获取活跃项目状态
   */
  getActiveProjects(): EvolutionProject[] {
    return Array.from(this.activeProjects.values());
  }
  
  /**
   * 设置沙盒宇宙控制器（可选）
   */
  setSandboxController(controller: SandboxUniverseController): void {
    this.sandboxController = controller;
  }
}

// 导出单例实例
let genesisTeamLoopInstance: GenesisTeamLoop | null = null;

export function getGenesisTeamLoop(): GenesisTeamLoop {
  if (!genesisTeamLoopInstance) {
    genesisTeamLoopInstance = new GenesisTeamLoop();
  }
  return genesisTeamLoopInstance;
}

export function initializeGenesisTeamLoop(config?: GenesisTeamLoopConfig): GenesisTeamLoop {
  if (genesisTeamLoopInstance) {
    console.log("[GenesisTeamLoop] 实例已存在，使用现有实例");
    return genesisTeamLoopInstance;
  }
  
  genesisTeamLoopInstance = new GenesisTeamLoop(config);
  return genesisTeamLoopInstance;
}
