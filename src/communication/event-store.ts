/**
 * 事件持久化存储
 * 
 * 将消息总线的事件持久化到 SQLite/LanceDB，支持历史查询和回放
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BusEvent, HistoryFilter } from './message-bus.js';

// ==================== 类型定义 ====================

/**
 * 存储选项
 */
export interface EventStoreOptions {
  /** 存储路径 */
  storagePath: string;
  /** 最大存储事件数 */
  maxEvents?: number;
  /** 是否启用索引 */
  enableIndexing?: boolean;
  /** 索引字段 */
  indexFields?: string[];
}

/**
 * 事件存储接口
 */
export interface EventStore {
  /** 存储事件 */
  store(event: BusEvent): Promise<void>;
  
  /** 批量存储事件 */
  storeBatch(events: BusEvent[]): Promise<void>;
  
  /** 查询事件 */
  query(filter: HistoryFilter): Promise<BusEvent[]>;
  
  /** 按ID获取事件 */
  getById(eventId: string): Promise<BusEvent | null>;
  
  /** 删除过期事件 */
  cleanup(cutoffTimestamp: number): Promise<number>;
  
  /** 获取统计信息 */
  getStats(): Promise<EventStoreStats>;
  
  /** 关闭存储 */
  close(): Promise<void>;
}

/**
 * 存储统计信息
 */
export interface EventStoreStats {
  totalEvents: number;
  oldestEvent: number | null;
  newestEvent: number | null;
  eventTypes: Record<string, number>;
  storageSize: number; // 字节
}

// ==================== SQLite 事件存储实现 ====================

/**
 * SQLite 事件存储
 * 
 * 使用 better-sqlite3 或 sqlite3 存储事件
 */
export class SQLiteEventStore implements EventStore {
  private db: any; // Database instance
  private options: Required<EventStoreOptions>;
  private initialized: boolean = false;
  
  constructor(options: EventStoreOptions) {
    this.options = {
      storagePath: options.storagePath,
      maxEvents: options.maxEvents ?? 100000,
      enableIndexing: options.enableIndexing ?? true,
      indexFields: options.indexFields ?? ['type', 'source.type', 'timestamp'],
    };
  }
  
  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // 动态导入 better-sqlite3（如果可用）
      const { default: Database } = await import('better-sqlite3');
      
      // 确保目录存在
      const dir = path.dirname(this.options.storagePath);
      await fs.mkdir(dir, { recursive: true });
      
      // 打开数据库
      this.db = new Database(this.options.storagePath);
      
      // 启用 WAL 模式以提高并发性能
      this.db.pragma('journal_mode = WAL');
      
      // 创建表
      this.createTables();
      
      // 创建索引
      if (this.options.enableIndexing) {
        this.createIndexes();
      }
      
      this.initialized = true;
      console.log('[SQLiteEventStore] Initialized at', this.options.storagePath);
    } catch (err) {
      console.error('[SQLiteEventStore] Failed to initialize:', err);
      throw err;
    }
  }
  
  /**
   * 存储事件
   */
  async store(event: BusEvent): Promise<void> {
    await this.ensureInitialized();
    
    const stmt = this.db.prepare(`
      INSERT INTO events (
        id, type, timestamp, source_type, source_id, source_name,
        payload, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.id,
      event.type,
      event.timestamp,
      event.source.type,
      event.source.id,
      event.source.name || null,
      JSON.stringify(event.payload),
      event.metadata ? JSON.stringify(event.metadata) : null,
      Date.now()
    );
    
    // 检查是否需要清理
    await this.checkAndCleanup();
  }
  
  /**
   * 批量存储事件
   */
  async storeBatch(events: BusEvent[]): Promise<void> {
    await this.ensureInitialized();
    
    if (events.length === 0) return;
    
    const transaction = this.db.transaction((events: BusEvent[]) => {
      const stmt = this.db.prepare(`
        INSERT INTO events (
          id, type, timestamp, source_type, source_id, source_name,
          payload, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const event of events) {
        stmt.run(
          event.id,
          event.type,
          event.timestamp,
          event.source.type,
          event.source.id,
          event.source.name || null,
          JSON.stringify(event.payload),
          event.metadata ? JSON.stringify(event.metadata) : null,
          Date.now()
        );
      }
    });
    
    transaction(events);
    
    // 检查是否需要清理
    await this.checkAndCleanup();
  }
  
  /**
   * 查询事件
   */
  async query(filter: HistoryFilter): Promise<BusEvent[]> {
    await this.ensureInitialized();
    
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    
    // 按类型过滤
    if (filter.types && filter.types.length > 0) {
      const placeholders = filter.types.map(() => '?').join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...filter.types);
    }
    
    // 按来源过滤
    if (filter.sources && filter.sources.length > 0) {
      const conditions = filter.sources.map(() => '(source_type = ? AND source_id = ?)');
      sql += ` AND (${conditions.join(' OR ')})`;
      for (const source of filter.sources) {
        params.push(source.type, source.id);
      }
    }
    
    // 按时间范围过滤
    if (filter.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filter.endTime);
    }
    
    // 排序（最新的在前）
    sql += ' ORDER BY timestamp DESC';
    
    // 分页
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const rows = this.db.prepare(sql).all(...params);
    
    return rows.map((row: any) => this.deserializeEvent(row));
  }
  
  /**
   * 按ID获取事件
   */
  async getById(eventId: string): Promise<BusEvent | null> {
    await this.ensureInitialized();
    
    const row = this.db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    
    if (!row) return null;
    
    return this.deserializeEvent(row);
  }
  
  /**
   * 删除过期事件
   */
  async cleanup(cutoffTimestamp: number): Promise<number> {
    await this.ensureInitialized();
    
    const result = this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoffTimestamp);
    
    return result.changes;
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<EventStoreStats> {
    await this.ensureInitialized();
    
    const totalEvents = this.db.prepare('SELECT COUNT(*) as count FROM events').get().count;
    
    const oldestEvent = this.db.prepare('SELECT MIN(timestamp) as ts FROM events').get().ts;
    const newestEvent = this.db.prepare('SELECT MAX(timestamp) as ts FROM events').get().ts;
    
    const eventTypesRows = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM events 
      GROUP BY type 
      ORDER BY count DESC
    `).all();
    
    const eventTypes: Record<string, number> = {};
    for (const row of eventTypesRows) {
      eventTypes[row.type] = row.count;
    }
    
    // 获取文件大小
    let storageSize = 0;
    try {
      const stats = await fs.stat(this.options.storagePath);
      storageSize = stats.size;
    } catch {
      // 文件不存在
    }
    
    return {
      totalEvents,
      oldestEvent: oldestEvent || null,
      newestEvent: newestEvent || null,
      eventTypes,
      storageSize,
    };
  }
  
  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  
  /**
   * 创建表
   */
  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_name TEXT,
        payload TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }
  
  /**
   * 创建索引
   */
  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `);
  }
  
  /**
   * 反序列化事件
   */
  private deserializeEvent(row: any): BusEvent {
    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      source: {
        type: row.source_type,
        id: row.source_id,
        name: row.source_name || undefined,
      },
      payload: JSON.parse(row.payload),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
  
  /**
   * 检查并清理
   */
  private async checkAndCleanup(): Promise<void> {
    const stats = await this.getStats();
    
    if (stats.totalEvents > this.options.maxEvents) {
      // 删除最旧的事件
      const excessCount = stats.totalEvents - this.options.maxEvents;
      
      const oldestIds = this.db.prepare(`
        SELECT id FROM events 
        ORDER BY timestamp ASC 
        LIMIT ?
      `).all(excessCount).map((row: any) => row.id);
      
      if (oldestIds.length > 0) {
        const placeholders = oldestIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM events WHERE id IN (${placeholders})`).run(...oldestIds);
      }
    }
  }
}

// ==================== 内存事件存储（用于测试） ====================

/**
 * 内存事件存储
 * 
 * 仅用于测试和开发环境
 */
export class InMemoryEventStore implements EventStore {
  private events: Map<string, BusEvent> = new Map();
  private options: Required<EventStoreOptions>;
  
  constructor(options: EventStoreOptions) {
    this.options = {
      storagePath: options.storagePath,
      maxEvents: options.maxEvents ?? 10000,
      enableIndexing: options.enableIndexing ?? false,
      indexFields: options.indexFields ?? [],
    };
  }
  
  async initialize(): Promise<void> {
    // 无需初始化
  }
  
  async store(event: BusEvent): Promise<void> {
    this.events.set(event.id, event);
    
    // 限制大小
    if (this.events.size > this.options.maxEvents) {
      const oldestId = Array.from(this.events.keys())[0];
      this.events.delete(oldestId);
    }
  }
  
  async storeBatch(events: BusEvent[]): Promise<void> {
    for (const event of events) {
      await this.store(event);
    }
  }
  
  async query(filter: HistoryFilter): Promise<BusEvent[]> {
    let events = Array.from(this.events.values());
    
    // 按类型过滤
    if (filter.types && filter.types.length > 0) {
      events = events.filter(e => filter.types!.includes(e.type));
    }
    
    // 按来源过滤
    if (filter.sources && filter.sources.length > 0) {
      events = events.filter(e => 
        filter.sources!.some(s => 
          s.type === e.source.type && s.id === e.source.id
        )
      );
    }
    
    // 按时间范围过滤
    if (filter.startTime) {
      events = events.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      events = events.filter(e => e.timestamp <= filter.endTime!);
    }
    
    // 排序
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return events.slice(offset, offset + limit);
  }
  
  async getById(eventId: string): Promise<BusEvent | null> {
    return this.events.get(eventId) || null;
  }
  
  async cleanup(cutoffTimestamp: number): Promise<number> {
    let count = 0;
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp < cutoffTimestamp) {
        this.events.delete(id);
        count++;
      }
    }
    return count;
  }
  
  async getStats(): Promise<EventStoreStats> {
    const events = Array.from(this.events.values());
    
    const eventTypes: Record<string, number> = {};
    for (const event of events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }
    
    return {
      totalEvents: events.length,
      oldestEvent: events.length > 0 ? Math.min(...events.map(e => e.timestamp)) : null,
      newestEvent: events.length > 0 ? Math.max(...events.map(e => e.timestamp)) : null,
      eventTypes,
      storageSize: 0,
    };
  }
  
  async close(): Promise<void> {
    this.events.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建事件存储
 */
export async function createEventStore(options: EventStoreOptions): Promise<EventStore> {
  // 尝试使用 SQLite
  try {
    const store = new SQLiteEventStore(options);
    await store.initialize();
    return store;
  } catch (err) {
    console.warn('[EventStore] SQLite not available, falling back to in-memory store:', err);
    
    // 回退到内存存储
    const store = new InMemoryEventStore(options);
    await store.initialize();
    return store;
  }
}
