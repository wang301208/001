/**
 * 错误处理增强模块
 * 
 * 提供重试机制、降级策略、错误分类等功能
 */

import { createSubsystemLogger } from '../logging/subsystem.js';

const log = createSubsystemLogger('error-handler');

// ==================== 错误分类 ====================

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  INTERNAL_ERROR = 'internal_error',
  EXTERNAL_SERVICE = 'external_service',
  UNKNOWN = 'unknown',
}

export interface ClassifiedError {
  originalError: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
  metadata?: Record<string, any>;
}

export class ErrorClassifier {
  /**
   * 分类错误
   */
  classify(error: unknown): ClassifiedError {
    const err = error instanceof Error ? error : new Error(String(error));

    const category = this.categorize(err);
    const severity = this.assessSeverity(category, err);
    const retryable = this.isRetryable(category, err);

    return {
      originalError: err,
      category,
      severity,
      message: err.message,
      retryable,
      metadata: this.extractMetadata(err),
    };
  }

  /**
   * 判断错误类别
   */
  private categorize(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enetunreach')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      name.includes('timeout')
    ) {
      return ErrorCategory.TIMEOUT;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('bad request')
    ) {
      return ErrorCategory.VALIDATION;
    }

    // Authentication errors
    if (
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('401')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Authorization errors
    if (
      message.includes('authorization') ||
      message.includes('forbidden') ||
      message.includes('403')
    ) {
      return ErrorCategory.AUTHORIZATION;
    }

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return ErrorCategory.RATE_LIMIT;
    }

    // Resource not found
    if (
      message.includes('not found') ||
      message.includes('404')
    ) {
      return ErrorCategory.RESOURCE_NOT_FOUND;
    }

    // External service errors
    if (
      message.includes('external') ||
      message.includes('third-party') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * 评估错误严重程度
   */
  private assessSeverity(category: ErrorCategory, error: Error): ErrorSeverity {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return ErrorSeverity.HIGH;

      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.EXTERNAL_SERVICE:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.RATE_LIMIT:
        return ErrorSeverity.LOW;

      case ErrorCategory.VALIDATION:
      case ErrorCategory.RESOURCE_NOT_FOUND:
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * 判断是否可重试
   */
  private isRetryable(category: ErrorCategory, error: Error): boolean {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.RATE_LIMIT:
      case ErrorCategory.EXTERNAL_SERVICE:
        return true;

      case ErrorCategory.VALIDATION:
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
      case ErrorCategory.RESOURCE_NOT_FOUND:
        return false;

      default:
        return true; // 默认认为可重试
    }
  }

  /**
   * 提取元数据
   */
  private extractMetadata(error: Error): Record<string, any> {
    const metadata: Record<string, any> = {
      name: error.name,
      stack: error.stack,
    };

    // 尝试从错误对象中提取额外信息
    const errorAny = error as any;
    if (errorAny.code) metadata.code = errorAny.code;
    if (errorAny.statusCode) metadata.statusCode = errorAny.statusCode;
    if (errorAny.status) metadata.status = errorAny.status;

    return metadata;
  }
}

// ==================== 重试机制 ====================

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryableErrors?: ErrorCategory[];
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryHandler {
  private classifier = new ErrorClassifier();

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      jitter = true,
      retryableErrors,
      onRetry,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classified = this.classifier.classify(lastError);

        // 检查是否应该重试
        if (attempt > maxRetries) {
          log.error(`Operation failed after ${maxRetries} retries`, lastError);
          throw lastError;
        }

        if (!classified.retryable) {
          log.warn(`Non-retryable error encountered: ${classified.category}`, lastError);
          throw lastError;
        }

        if (retryableErrors && !retryableErrors.includes(classified.category)) {
          log.warn(
            `Error category ${classified.category} not in retryable list`,
            lastError
          );
          throw lastError;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt, baseDelay, maxDelay, backoffFactor, jitter);

        log.warn(
          `Attempt ${attempt}/${maxRetries + 1} failed, retrying in ${delay}ms...`,
          lastError
        );

        // 调用重试回调
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // 等待后重试
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Unknown error during retry');
  }

  /**
   * 计算延迟时间（指数退避 + 抖动）
   */
  private calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    backoffFactor: number,
    jitter: boolean
  ): number {
    let delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      // 添加 ±25% 的随机抖动
      const jitterRange = delay * 0.25;
      delay = delay + (Math.random() * 2 - 1) * jitterRange;
    }

    return Math.max(0, Math.round(delay));
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== 降级策略 ====================

export interface FallbackStrategy<T> {
  name: string;
  execute: () => Promise<T>;
  priority: number; // 优先级，数字越小优先级越高
}

export class FallbackHandler<T> {
  private strategies: FallbackStrategy<T>[] = [];
  private classifier = new ErrorClassifier();

  /**
   * 注册降级策略
   */
  registerStrategy(strategy: FallbackStrategy<T>): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
    log.debug(`Fallback strategy registered: ${strategy.name} (priority: ${strategy.priority})`);
  }

  /**
   * 执行主操作，失败时自动降级
   */
  async executeWithFallback(
    primaryOperation: () => Promise<T>,
    fallbackCategories?: ErrorCategory[]
  ): Promise<T> {
    // 尝试主操作
    try {
      return await primaryOperation();
    } catch (error) {
      const classified = this.classifier.classify(error);

      // 检查是否应该使用降级策略
      if (fallbackCategories && !fallbackCategories.includes(classified.category)) {
        log.warn(
          `Error category ${classified.category} not in fallback categories, rethrowing`
        );
        throw error;
      }

      log.warn(
        `Primary operation failed (${classified.category}), trying fallback strategies...`
      );

      // 依次尝试降级策略
      return this.tryFallbackStrategies();
    }
  }

  /**
   * 尝试降级策略
   */
  private async tryFallbackStrategies(): Promise<T> {
    for (const strategy of this.strategies) {
      try {
        log.info(`Trying fallback strategy: ${strategy.name}`);
        const result = await strategy.execute();
        log.info(`Fallback strategy succeeded: ${strategy.name}`);
        return result;
      } catch (error) {
        log.warn(`Fallback strategy failed: ${strategy.name}`, error);
        // 继续尝试下一个策略
      }
    }

    throw new Error('All fallback strategies failed');
  }
}

// ==================== 断路器模式 ====================

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  halfOpenMaxAttempts?: number;
}

export enum CircuitState {
  CLOSED = 'closed', // 正常状态
  OPEN = 'open', // 断开状态
  HALF_OPEN = 'half_open', // 半开状态
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;

  private failureThreshold: number;
  private recoveryTimeout: number;
  private halfOpenMaxAttempts: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeout = options.recoveryTimeout ?? 60000; // 1 minute
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 3;
  }

  /**
   * 执行受断路器保护的操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 检查是否允许执行
    if (!this.allowExecution()) {
      throw new Error(
        `Circuit breaker is ${this.state}, operation not allowed`
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 检查是否允许执行
   */
  private allowExecution(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // 检查是否过了恢复超时
        if (
          this.lastFailureTime &&
          Date.now() - this.lastFailureTime > this.recoveryTimeout
        ) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // 限制半开状态的尝试次数
        return this.halfOpenAttempts < this.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  /**
   * 成功回调
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态下成功，恢复到关闭状态
      this.transitionTo(CircuitState.CLOSED);
    } else {
      // 重置失败计数
      this.failureCount = 0;
    }
  }

  /**
   * 失败回调
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        // 半开状态尝试次数用尽，回到断开状态
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.failureCount >= this.failureThreshold) {
      // 失败次数达到阈值，断开电路
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    log.info(`Circuit breaker state changed: ${oldState} → ${newState}`);

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
      this.lastFailureTime = null;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 手动重置断路器
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * 手动断开断路器
   */
  trip(): void {
    this.transitionTo(CircuitState.OPEN);
  }
}

// ==================== 错误追踪器 ====================

export interface ErrorRecord {
  timestamp: number;
  error: Error;
  classified: ClassifiedError;
  context?: Record<string, any>;
}

export class ErrorTracker {
  private records: ErrorRecord[] = [];
  private maxRecords: number;
  private classifier = new ErrorClassifier();

  constructor(maxRecords: number = 10000) {
    this.maxRecords = maxRecords;
  }

  /**
   * 记录错误
   */
  record(error: unknown, context?: Record<string, any>): void {
    const classified = this.classifier.classify(error);
    const err = error instanceof Error ? error : new Error(String(error));

    this.records.push({
      timestamp: Date.now(),
      error: err,
      classified,
      context,
    });

    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // 记录日志
    log.error(
      `Error recorded: ${classified.category} (${classified.severity})`,
      err
    );
  }

  /**
   * 查询错误记录
   */
  query(filter?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    timeRange?: { start: number; end: number };
    limit?: number;
  }): ErrorRecord[] {
    let result = [...this.records];

    if (filter?.category) {
      result = result.filter((r) => r.classified.category === filter.category);
    }

    if (filter?.severity) {
      result = result.filter((r) => r.classified.severity === filter.severity);
    }

    if (filter?.timeRange) {
      result = result.filter(
        (r) =>
          r.timestamp >= filter.timeRange!.start &&
          r.timestamp <= filter.timeRange!.end
      );
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 获取统计信息
   */
  getStats(timeRange?: { start: number; end: number }): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    retryableCount: number;
  } {
    let records = this.records;

    if (timeRange) {
      records = records.filter(
        (r) => r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
    }

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let retryableCount = 0;

    for (const record of records) {
      const category = record.classified.category;
      const severity = record.classified.severity;

      byCategory[category] = (byCategory[category] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;

      if (record.classified.retryable) {
        retryableCount++;
      }
    }

    return {
      total: records.length,
      byCategory,
      bySeverity,
      retryableCount,
    };
  }

  /**
   * 清除记录
   */
  clear(): void {
    this.records = [];
  }
}

// ==================== 导出单例实例 ====================

export const errorClassifier = new ErrorClassifier();

export const retryHandler = new RetryHandler();

export const errorTracker = new ErrorTracker();

export const fallbackHandler = new FallbackHandler<unknown>();

export const circuitBreaker = new CircuitBreaker();
