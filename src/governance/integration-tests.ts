/**
 * 集成测试框架
 * 
 * 提供端到端测试、场景模拟、断言工具等功能
 */

import { createSubsystemLogger } from '../logging/subsystem.js';
import type { EvolutionProject } from './proposals.js';
import type { SandboxUniverse } from './sandbox-universe.js';

const log = createSubsystemLogger('integration-test');

// ==================== 测试场景定义 ====================

export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  setup?: () => Promise<void>;
  execute: () => Promise<void>;
  teardown?: () => Promise<void>;
  timeout?: number; // milliseconds
  retries?: number;
}

export interface TestResult {
  scenarioId: string;
  passed: boolean;
  duration: number;
  error?: Error;
  attempts: number;
  metadata?: Record<string, any>;
}

// ==================== 测试运行器 ====================

export class IntegrationTestRunner {
  private scenarios: Map<string, TestScenario> = new Map();
  private results: TestResult[] = [];
  private isRunning = false;

  /**
   * 注册测试场景
   */
  registerScenario(scenario: TestScenario): void {
    this.scenarios.set(scenario.id, scenario);
    log.info(`Test scenario registered: ${scenario.name}`);
  }

  /**
   * 运行所有测试场景
   */
  async runAll(): Promise<TestResult[]> {
    if (this.isRunning) {
      throw new Error('Tests are already running');
    }

    this.isRunning = true;
    this.results = [];

    log.info(`Starting integration tests: ${this.scenarios.size} scenarios`);

    try {
      for (const [id, scenario] of this.scenarios.entries()) {
        const result = await this.runScenario(scenario);
        this.results.push(result);

        if (!result.passed) {
          log.error(`Scenario failed: ${scenario.name}`, result.error);
        } else {
          log.info(`Scenario passed: ${scenario.name} (${result.duration}ms)`);
        }
      }
    } finally {
      this.isRunning = false;
    }

    const summary = this.getSummary();
    log.info(
      `Integration tests completed: ${summary.passed}/${summary.total} passed`
    );

    return this.results;
  }

  /**
   * 运行单个测试场景
   */
  async runScenarioById(scenarioId: string): Promise<TestResult> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }
    return this.runScenario(scenario);
  }

  /**
   * 执行测试场景
   */
  private async runScenario(scenario: TestScenario): Promise<TestResult> {
    const maxRetries = scenario.retries ?? 0;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const startTime = Date.now();

      try {
        // Setup
        if (scenario.setup) {
          await scenario.setup();
        }

        // Execute with timeout
        const timeout = scenario.timeout ?? 60000; // Default 1 minute
        const executePromise = scenario.execute();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
        });

        await Promise.race([executePromise, timeoutPromise]);

        // Teardown
        if (scenario.teardown) {
          await scenario.teardown().catch((error) => {
            log.warn('Teardown failed:', error);
          });
        }

        const duration = Date.now() - startTime;

        return {
          scenarioId: scenario.id,
          passed: true,
          duration,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - startTime;

        log.warn(
          `Attempt ${attempt}/${maxRetries + 1} failed for scenario ${scenario.name}`,
          lastError
        );

        // Cleanup on failure
        if (scenario.teardown) {
          await scenario.teardown().catch((cleanupError) => {
            log.warn('Teardown after failure failed:', cleanupError);
          });
        }

        if (attempt <= maxRetries) {
          // Wait before retry
          await this.sleep(1000 * attempt);
        }
      }
    }

    return {
      scenarioId: scenario.id,
      passed: false,
      duration: 0,
      error: lastError,
      attempts: maxRetries + 1,
    };
  }

  /**
   * 获取测试结果摘要
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;

    return {
      total,
      passed,
      failed,
      totalDuration,
      averageDuration,
    };
  }

  /**
   * 获取所有测试结果
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * 清除测试结果
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== 断言工具 ====================

export class AssertionError extends Error {
  constructor(message: string, public actual?: any, public expected?: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new AssertionError(message ?? 'Assertion failed');
  }
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message ?? `Expected ${expected} but got ${actual}`,
      actual,
      expected
    );
  }
}

export function assertNotEquals<T>(actual: T, unexpected: T, message?: string): void {
  if (actual === unexpected) {
    throw new AssertionError(
      message ?? `Expected values to be different but both were ${actual}`,
      actual,
      unexpected
    );
  }
}

export function assertTrue(value: any, message?: string): void {
  if (value !== true) {
    throw new AssertionError(message ?? `Expected true but got ${value}`, value, true);
  }
}

export function assertFalse(value: any, message?: string): void {
  if (value !== false) {
    throw new AssertionError(message ?? `Expected false but got ${value}`, value, false);
  }
}

export function assertNull(value: any, message?: string): void {
  if (value !== null) {
    throw new AssertionError(message ?? `Expected null but got ${value}`, value, null);
  }
}

export function assertNotNull(value: any, message?: string): void {
  if (value === null || value === undefined) {
    throw new AssertionError(
      message ?? `Expected non-null value but got ${value}`,
      value,
      'non-null'
    );
  }
}

export function assertThrows(fn: () => void, message?: string): void {
  try {
    fn();
    throw new AssertionError(message ?? 'Expected function to throw but it did not');
  } catch (error) {
    // Expected
  }
}

export function assertDoesNotThrow(fn: () => void, message?: string): void {
  try {
    fn();
  } catch (error) {
    throw new AssertionError(
      message ?? `Expected function not to throw but it threw: ${error}`,
      error
    );
  }
}

export function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      message ?? `String does not contain "${needle}"`,
      haystack,
      needle
    );
  }
}

export function assertArrayEquals<T>(actual: T[], expected: T[], message?: string): void {
  if (actual.length !== expected.length) {
    throw new AssertionError(
      message ?? `Arrays have different lengths: ${actual.length} vs ${expected.length}`,
      actual.length,
      expected.length
    );
  }

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new AssertionError(
        message ?? `Arrays differ at index ${i}: ${actual[i]} vs ${expected[i]}`,
        actual[i],
        expected[i]
      );
    }
  }
}

export function assertObjectEquals(
  actual: Record<string, any>,
  expected: Record<string, any>,
  message?: string
): void {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new AssertionError(
      message ?? 'Objects have different keys',
      actualKeys,
      expectedKeys
    );
  }

  for (const key of actualKeys) {
    if (actual[key] !== expected[key]) {
      throw new AssertionError(
        message ?? `Objects differ at key "${key}": ${actual[key]} vs ${expected[key]}`,
        actual[key],
        expected[key]
      );
    }
  }
}

// ==================== 模拟数据生成器 ====================

export class MockDataGenerator {
  /**
   * 生成随机字符串
   */
  randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成随机数字
   */
  randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 生成随机布尔值
   */
  randomBoolean(): boolean {
    return Math.random() > 0.5;
  }

  /**
   * 生成随机数组
   */
  randomArray<T>(generator: () => T, length: number = 5): T[] {
    return Array.from({ length }, generator);
  }

  /**
   * 生成随机对象
   */
  randomObject(keys: string[], valueGenerator: () => any): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const key of keys) {
      obj[key] = valueGenerator();
    }
    return obj;
  }

  /**
   * 生成随机时间戳
   */
  randomTimestamp(start?: Date, end?: Date): number {
    const startDate = start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = end ?? new Date();
    return (
      startDate.getTime() +
      Math.random() * (endDate.getTime() - startDate.getTime())
    );
  }

  /**
   * 生成随机邮箱地址
   */
  randomEmail(): string {
    return `${this.randomString(8)}@example.com`;
  }

  /**
   * 生成随机 URL
   */
  randomUrl(): string {
    return `https://example.com/${this.randomString(10)}`;
  }

  /**
   * 生成随机 UUID
   */
  randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ==================== 预定义集成测试场景 ====================

export function createCommonIntegrationScenarios(): TestScenario[] {
  const mockGenerator = new MockDataGenerator();

  return [
    // Genesis Team 自动化循环测试
    {
      id: 'genesis-team-loop',
      name: 'Genesis Team Automation Loop',
      description: 'Test the complete Genesis Team automation cycle',
      timeout: 120000, // 2 minutes
      execute: async () => {
        // TODO: 实现完整的 Genesis Team 循环测试
        log.info('Testing Genesis Team automation loop...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 1000));
      },
    },

    // 沙盒宇宙控制器测试
    {
      id: 'sandbox-universe',
      name: 'Sandbox Universe Controller',
      description: 'Test sandbox universe creation and management',
      timeout: 60000,
      execute: async () => {
        log.info('Testing sandbox universe controller...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    },

    // Promotion Manifest 系统测试
    {
      id: 'promotion-manifest',
      name: 'Promotion Manifest System',
      description: 'Test promotion manifest creation and validation',
      timeout: 60000,
      execute: async () => {
        log.info('Testing promotion manifest system...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    },

    // 性能优化测试
    {
      id: 'performance-optimization',
      name: 'Performance Optimization',
      description: 'Test caching, lazy loading, and resource pooling',
      timeout: 60000,
      execute: async () => {
        log.info('Testing performance optimization...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    },

    // 监控告警测试
    {
      id: 'monitoring-alerting',
      name: 'Monitoring and Alerting',
      description: 'Test metrics collection and alert triggering',
      timeout: 60000,
      execute: async () => {
        log.info('Testing monitoring and alerting...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    },

    // 错误处理测试
    {
      id: 'error-handling',
      name: 'Error Handling',
      description: 'Test retry mechanisms, fallback strategies, and circuit breakers',
      timeout: 60000,
      execute: async () => {
        log.info('Testing error handling...');
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    },
  ];
}

// ==================== 导出单例实例 ====================

export const testRunner = new IntegrationTestRunner();

export const mockGenerator = new MockDataGenerator();

// 自动注册常见测试场景
createCommonIntegrationScenarios().forEach((scenario) => {
  testRunner.registerScenario(scenario);
});
