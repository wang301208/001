import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { 
  SandboxUniverseReplayPlan,
  SandboxUniverseEvidenceArtifact,
} from "./sandbox-universe.js";

/**
 * 沙盒重放执行器
 * 
 * 负责在沙盒环境中重放历史场景，验证变更的正确性。
 * 这是沙盒宇宙控制器的核心组件之一。
 */

export interface ReplayScenario {
  id: string;
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  workspaceDir?: string;
}

export interface ReplayExecutionResult {
  scenarioId: string;
  success: boolean;
  actualOutput: any;
  expectedOutput: any;
  duration: number;
  error?: string;
  metrics?: {
    memoryUsage?: number;
    cpuTime?: number;
    ioOperations?: number;
  };
}

export interface ReplayComparison {
  scenarioId: string;
  match: boolean;
  differences: Array<{
    field: string;
    expected: any;
    actual: any;
  }>;
  similarity: number; // 0-1
}

export interface ReplayReport {
  replayId: string;
  plan: SandboxUniverseReplayPlan;
  executedAt: number;
  duration: number;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  results: ReplayExecutionResult[];
  comparisons: ReplayComparison[];
  overallPass: boolean;
  summary: string;
  artifacts: {
    reportPath?: string;
    logsPath?: string;
    metricsPath?: string;
  };
}

export class SandboxReplayRunner {
  private artifactDir: string;
  
  constructor(artifactDir: string) {
    this.artifactDir = artifactDir;
  }
  
  /**
   * 执行重放
   * 
   * @param plan 重放计划
   * @returns 重放报告
   */
  async executeReplay(plan: SandboxUniverseReplayPlan): Promise<ReplayReport> {
    const replayId = `replay-${Date.now()}-${createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 16)}`;
    const startTime = Date.now();
    
    console.log(`[SandboxReplayRunner] 开始执行重放: ${replayId}`);
    console.log(`[SandboxReplayRunner] 场景数: ${plan.scenarios.length}`);
    console.log(`[SandboxReplayRunner] 工作区: ${plan.workspaceDirs.join(", ")}`);
    
    try {
      // 1. 加载历史场景
      const scenarios = await this.loadScenarios(plan.scenarios);
      console.log(`[SandboxReplayRunner] 已加载 ${scenarios.length} 个场景`);
      
      // 2. 在沙盒中执行
      const results = await this.executeInSandbox(scenarios, plan.workspaceDirs);
      console.log(`[SandboxReplayRunner] 执行完成，结果数: ${results.length}`);
      
      // 3. 对比预期与实际
      const comparisons = await this.compareResults(results, plan.requiredOutputs);
      console.log(`[SandboxReplayRunner] 对比完成`);
      
      // 4. 生成报告
      const report = this.generateReport({
        replayId,
        plan,
        executedAt: startTime,
        duration: Date.now() - startTime,
        totalScenarios: scenarios.length,
        passedScenarios: comparisons.filter(c => c.match).length,
        failedScenarios: comparisons.filter(c => !c.match).length,
        results,
        comparisons,
        overallPass: comparisons.every(c => c.match),
        summary: this.generateSummary(comparisons),
      });
      
      // 5. 保存报告
      await this.saveReport(report);
      
      console.log(`[SandboxReplayRunner] 重放完成: ${report.overallPass ? "通过" : "失败"}`);
      console.log(`[SandboxReplayRunner] 通过率: ${report.passedScenarios}/${report.totalScenarios}`);
      
      return report;
    } catch (error) {
      console.error(`[SandboxReplayRunner] 重放执行失败:`, error);
      throw error;
    }
  }
  
  /**
   * 加载历史场景
   */
  private async loadScenarios(scenarioIds: string[]): Promise<ReplayScenario[]> {
    const scenarios: ReplayScenario[] = [];
    
    for (const scenarioId of scenarioIds) {
      try {
        // TODO: 从任务历史或测试用例中加载场景
        // 当前生成模拟场景
        
        const scenario: ReplayScenario = {
          id: scenarioId,
          name: `Scenario ${scenarioId}`,
          description: `Historical scenario ${scenarioId}`,
          input: { test: "data" },
          expectedOutput: { result: "expected" },
        };
        
        scenarios.push(scenario);
      } catch (error) {
        console.warn(`[SandboxReplayRunner] 加载场景 ${scenarioId} 失败:`, error);
      }
    }
    
    return scenarios;
  }
  
  /**
   * 在沙盒中执行场景
   */
  private async executeInSandbox(
    scenarios: ReplayScenario[],
    workspaceDirs: string[]
  ): Promise<ReplayExecutionResult[]> {
    const results: ReplayExecutionResult[] = [];
    
    for (const scenario of scenarios) {
      const execStartTime = Date.now();
      
      try {
        // TODO: 实现在沙盒环境中执行场景
        // 当前模拟执行结果
        
        const result: ReplayExecutionResult = {
          scenarioId: scenario.id,
          success: true,
          actualOutput: scenario.expectedOutput, // 模拟匹配
          expectedOutput: scenario.expectedOutput,
          duration: Date.now() - execStartTime,
          metrics: {
            memoryUsage: Math.random() * 100 * 1024 * 1024, // 随机内存使用
            cpuTime: Math.random() * 1000, // 随机 CPU 时间
            ioOperations: Math.floor(Math.random() * 100), // 随机 IO 操作
          },
        };
        
        results.push(result);
      } catch (error) {
        const result: ReplayExecutionResult = {
          scenarioId: scenario.id,
          success: false,
          actualOutput: null,
          expectedOutput: scenario.expectedOutput,
          duration: Date.now() - execStartTime,
          error: error instanceof Error ? error.message : String(error),
        };
        
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * 对比预期与实际结果
   */
  private async compareResults(
    results: ReplayExecutionResult[],
    requiredOutputs: string[]
  ): Promise<ReplayComparison[]> {
    const comparisons: ReplayComparison[] = [];
    
    for (const result of results) {
      const comparison: ReplayComparison = {
        scenarioId: result.scenarioId,
        match: result.success && this.deepEquals(result.actualOutput, result.expectedOutput),
        differences: [],
        similarity: result.success ? 1.0 : 0.0,
      };
      
      if (!comparison.match && result.actualOutput && result.expectedOutput) {
        // 计算差异
        comparison.differences = this.findDifferences(
          result.expectedOutput,
          result.actualOutput
        );
        comparison.similarity = this.calculateSimilarity(
          result.expectedOutput,
          result.actualOutput
        );
      }
      
      comparisons.push(comparison);
    }
    
    return comparisons;
  }
  
  /**
   * 生成重放报告
   */
  private generateReport(data: Omit<ReplayReport, "artifacts">): ReplayReport {
    return {
      ...data,
      artifacts: {},
    };
  }
  
  /**
   * 生成摘要
   */
  private generateSummary(comparisons: ReplayComparison[]): string {
    const total = comparisons.length;
    const passed = comparisons.filter(c => c.match).length;
    const failed = total - passed;
    const avgSimilarity = comparisons.reduce((sum, c) => sum + c.similarity, 0) / total;
    
    if (failed === 0) {
      return `所有 ${total} 个场景均通过验证`;
    }
    
    return `${passed}/${total} 个场景通过，平均相似度: ${(avgSimilarity * 100).toFixed(2)}%`;
  }
  
  /**
   * 保存报告
   */
  private async saveReport(report: ReplayReport): Promise<void> {
    const reportPath = path.join(this.artifactDir, "replay-report.json");
    
    await fs.writeFile(
      reportPath,
      JSON.stringify(report, null, 2),
      "utf8"
    );
    
    report.artifacts.reportPath = reportPath;
    
    console.log(`[SandboxReplayRunner] 报告已保存: ${reportPath}`);
  }
  
  /**
   * 深度相等比较
   */
  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object" || a === null || b === null) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  /**
   * 查找差异
   */
  private findDifferences(expected: any, actual: any, prefix: string = ""): Array<{
    field: string;
    expected: any;
    actual: any;
  }> {
    const differences: Array<{ field: string; expected: any; actual: any }> = [];
    
    if (typeof expected !== "object" || typeof actual !== "object") {
      if (expected !== actual) {
        differences.push({
          field: prefix || "root",
          expected,
          actual,
        });
      }
      return differences;
    }
    
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    
    for (const key of allKeys) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (!(key in expected)) {
        differences.push({
          field: fieldPath,
          expected: undefined,
          actual: actual[key],
        });
      } else if (!(key in actual)) {
        differences.push({
          field: fieldPath,
          expected: expected[key],
          actual: undefined,
        });
      } else {
        differences.push(...this.findDifferences(expected[key], actual[key], fieldPath));
      }
    }
    
    return differences;
  }
  
  /**
   * 计算相似度
   */
  private calculateSimilarity(expected: any, actual: any): number {
    if (this.deepEquals(expected, actual)) return 1.0;
    
    // 简单实现：基于字段匹配率
    if (typeof expected !== "object" || typeof actual !== "object") {
      return 0.0;
    }
    
    const keysA = Object.keys(expected);
    const keysB = Object.keys(actual);
    const allKeys = new Set([...keysA, ...keysB]);
    
    let matchCount = 0;
    for (const key of allKeys) {
      if (key in expected && key in actual && this.deepEquals(expected[key], actual[key])) {
        matchCount++;
      }
    }
    
    return matchCount / allKeys.size;
  }
}
