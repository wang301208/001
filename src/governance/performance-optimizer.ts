/**
 * 性能优化模块
 * 
 * 提供缓存策略、懒加载、资源池管理等性能优化功能
 */

import { createSubsystemLogger } from '../logging/subsystem.js';

const log = createSubsystemLogger('performance-optimizer');

// ==================== 缓存管理器 ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      log.debug(`Cache expired: ${key}`);
      return null;
    }

    log.debug(`Cache hit: ${key}`);
    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });

    log.debug(`Cache set: ${key} (ttl: ${ttl ?? this.defaultTTL}ms)`);
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    log.info('Cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug(`Cleaned up ${cleaned} expired cache entries`);
    }

    return cleaned;
  }

  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      log.debug(`Evicted oldest cache entry: ${oldestKey}`);
    }
  }
}

// ==================== 懒加载管理器 ====================

interface LazyLoadOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class LazyLoader {
  private loadingPromises = new Map<string, Promise<any>>();
  private results = new Map<string, any>();

  /**
   * 懒加载资源
   */
  async load<T>(
    key: string,
    loader: () => Promise<T>,
    options: LazyLoadOptions = {}
  ): Promise<T> {
    const { timeout = 30000, retries = 3, retryDelay = 1000 } = options;

    // 如果已经加载完成，直接返回
    if (this.results.has(key)) {
      log.debug(`Lazy load cache hit: ${key}`);
      return this.results.get(key) as T;
    }

    // 如果正在加载中，等待现有加载完成
    if (this.loadingPromises.has(key)) {
      log.debug(`Lazy load waiting: ${key}`);
      return this.loadingPromises.get(key) as Promise<T>;
    }

    // 开始加载
    log.debug(`Starting lazy load: ${key}`);
    const promise = this.executeWithRetry(loader, retries, retryDelay, timeout);

    this.loadingPromises.set(key, promise);

    try {
      const result = await promise;
      this.results.set(key, result);
      this.loadingPromises.delete(key);
      log.info(`Lazy load completed: ${key}`);
      return result;
    } catch (error) {
      this.loadingPromises.delete(key);
      log.error(`Lazy load failed: ${key}`, error);
      throw error;
    }
  }

  /**
   * 执行带重试的加载
   */
  private async executeWithRetry<T>(
    loader: () => Promise<T>,
    retries: number,
    retryDelay: number,
    timeout: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
        });

        return await Promise.race([loader(), timeoutPromise]);
      } catch (error) {
        lastError = error as Error;
        log.warn(`Lazy load attempt ${attempt}/${retries} failed:`, error);

        if (attempt < retries) {
          await this.sleep(retryDelay * attempt); // 指数退避
        }
      }
    }

    throw lastError ?? new Error('Unknown error during lazy load');
  }

  /**
   * 预加载资源
   */
  preload<T>(key: string, loader: () => Promise<T>): void {
    if (!this.loadingPromises.has(key) && !this.results.has(key)) {
      log.debug(`Preloading: ${key}`);
      this.load(key, loader).catch((error) => {
        log.warn(`Preload failed: ${key}`, error);
      });
    }
  }

  /**
   * 清除已加载的资源
   */
  invalidate(key: string): void {
    this.results.delete(key);
    this.loadingPromises.delete(key);
    log.debug(`Invalidated lazy load: ${key}`);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.results.clear();
    this.loadingPromises.clear();
    log.info('Lazy loader cleared');
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== 资源池管理器 ====================

interface ResourcePoolOptions {
  minSize?: number;
  maxSize?: number;
  idleTimeout?: number;
}

export class ResourcePool<T> {
  private pool: T[] = [];
  private inUse = new Set<T>();
  private minSize: number;
  private maxSize: number;
  private idleTimeout: number;
  private creator: () => Promise<T>;
  private destroyer: (resource: T) => Promise<void>;
  private healthChecker: (resource: T) => Promise<boolean>;

  constructor(
    creator: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    healthChecker: (resource: T) => Promise<boolean>,
    options: ResourcePoolOptions = {}
  ) {
    this.creator = creator;
    this.destroyer = destroyer;
    this.healthChecker = healthChecker;
    this.minSize = options.minSize ?? 1;
    this.maxSize = options.maxSize ?? 10;
    this.idleTimeout = options.idleTimeout ?? 60000; // 1 minute

    // 初始化最小资源数
    this.initialize().catch((error) => {
      log.error('Failed to initialize resource pool:', error);
    });
  }

  /**
   * 获取资源
   */
  async acquire(): Promise<T> {
    // 尝试从池中获取空闲资源
    while (this.pool.length > 0) {
      const resource = this.pool.shift()!;
      
      // 检查资源健康状态
      const isHealthy = await this.healthChecker(resource);
      if (isHealthy) {
        this.inUse.add(resource);
        log.debug(`Resource acquired from pool. In use: ${this.inUse.size}`);
        return resource;
      } else {
        // 资源不健康，销毁并继续
        await this.destroyer(resource);
        log.debug('Destroyed unhealthy resource');
      }
    }

    // 如果池中没有资源且未达到最大限制，创建新资源
    if (this.inUse.size < this.maxSize) {
      const resource = await this.creator();
      this.inUse.add(resource);
      log.debug(`New resource created. In use: ${this.inUse.size}`);
      return resource;
    }

    // 达到最大限制，等待资源释放
    log.warn('Resource pool exhausted, waiting for available resource');
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (this.pool.length > 0) {
          clearInterval(checkInterval);
          const resource = await this.acquire();
          resolve(resource);
        }
      }, 100);
    });
  }

  /**
   * 释放资源
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      log.warn('Attempted to release resource not in use');
      return;
    }

    this.inUse.delete(resource);

    // 检查资源健康状态
    const isHealthy = await this.healthChecker(resource);
    if (isHealthy && this.pool.length < this.maxSize) {
      this.pool.push(resource);
      log.debug(`Resource returned to pool. Pool size: ${this.pool.length}`);
    } else {
      await this.destroyer(resource);
      log.debug('Destroyed released resource');
    }

    // 确保最小资源数
    await this.ensureMinSize();
  }

  /**
   * 获取池状态
   */
  getStatus(): {
    poolSize: number;
    inUseCount: number;
    totalCapacity: number;
  } {
    return {
      poolSize: this.pool.length,
      inUseCount: this.inUse.size,
      totalCapacity: this.pool.length + this.inUse.size,
    };
  }

  /**
   * 关闭资源池
   */
  async close(): Promise<void> {
    log.info('Closing resource pool...');

    // 销毁池中所有资源
    for (const resource of this.pool) {
      await this.destroyer(resource);
    }
    this.pool = [];

    // 等待所有使用中的资源释放后销毁
    while (this.inUse.size > 0) {
      await this.sleep(100);
    }

    log.info('Resource pool closed');
  }

  /**
   * 初始化资源池
   */
  private async initialize(): Promise<void> {
    for (let i = 0; i < this.minSize; i++) {
      const resource = await this.creator();
      this.pool.push(resource);
    }
    log.info(`Resource pool initialized with ${this.minSize} resources`);
  }

  /**
   * 确保最小资源数
   */
  private async ensureMinSize(): Promise<void> {
    while (this.pool.length < this.minSize) {
      const resource = await this.creator();
      this.pool.push(resource);
    }
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== 批量处理器 ====================

interface BatchProcessorOptions<T> {
  batchSize?: number;
  flushInterval?: number;
  processor: (items: T[]) => Promise<void>;
}

export class BatchProcessor<T> {
  private buffer: T[] = [];
  private batchSize: number;
  private flushInterval: number;
  private processor: (items: T[]) => Promise<void>;
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(options: BatchProcessorOptions<T>) {
    this.batchSize = options.batchSize ?? 100;
    this.flushInterval = options.flushInterval ?? 5000; // 5 seconds
    this.processor = options.processor;

    // 启动定时刷新
    this.startFlushTimer();
  }

  /**
   * 添加项目到批处理队列
   */
  async add(item: T): Promise<void> {
    this.buffer.push(item);

    // 如果达到批次大小，立即刷新
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * 手动刷新批处理队列
   */
  async flush(): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) {
      return;
    }

    this.isProcessing = true;
    const items = [...this.buffer];
    this.buffer = [];

    try {
      await this.processor(items);
      log.debug(`Batch processed: ${items.length} items`);
    } catch (error) {
      log.error('Batch processing failed:', error);
      // 失败的项目重新加入队列
      this.buffer.unshift(...items);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.flushInterval);
  }

  /**
   * 停止批处理器
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 刷新剩余项目
    await this.flush();
    log.info('Batch processor stopped');
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.buffer.length;
  }
}

// ==================== 性能监控器 ====================

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number;

  constructor(maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics;
  }

  /**
   * 记录指标
   */
  record(name: string, value: number, unit: string = 'ms'): void {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now(),
    });

    // 限制指标数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * 记录操作耗时
   */
  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await operation();
    } finally {
      const duration = Date.now() - start;
      this.record(name, duration, 'ms');
      log.debug(`${name}: ${duration}ms`);
    }
  }

  /**
   * 获取指标统计
   */
  getStats(name: string, windowMs: number = 60000): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const now = Date.now();
    const relevant = this.metrics
      .filter((m) => m.name === name && now - m.timestamp < windowMs)
      .map((m) => m.value)
      .sort((a, b) => a - b);

    if (relevant.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sum = relevant.reduce((a, b) => a + b, 0);
    const count = relevant.length;

    return {
      count,
      avg: sum / count,
      min: relevant[0],
      max: relevant[count - 1],
      p50: this.percentile(relevant, 50),
      p95: this.percentile(relevant, 95),
      p99: this.percentile(relevant, 99),
    };
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 获取所有指标名称
   */
  getMetricNames(): string[] {
    return [...new Set(this.metrics.map((m) => m.name))];
  }

  /**
   * 清除指标
   */
  clear(): void {
    this.metrics = [];
  }
}

// ==================== 导出单例实例 ====================

export const cacheManager = new CacheManager({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000,
});

export const lazyLoader = new LazyLoader();

export const performanceMonitor = new PerformanceMonitor();

// 定期清理过期缓存
setInterval(() => {
  cacheManager.cleanup();
}, 60000); // 每分钟
