import fs from "node:fs";
import path from "node:path";
import type { AutonomyLevel } from "../autonomy/autonomy-level.js";

export type PerceptionEventKind =
  | "file.created"
  | "file.modified"
  | "file.deleted"
  | "file.renamed"
  | "channel.message"
  | "channel.presence"
  | "system.idle"
  | "system.active"
  | "cron.tick"
  | "daemon.heartbeat";

export type PerceptionEvent = {
  id: string;
  kind: PerceptionEventKind;
  source: string;
  detail: string;
  timestamp: number;
  relevance: number;
  observedAt: number;
};

export type PerceptionConfig = {
  watchPaths: string[];
  ignorePatterns: string[];
  debounceMs: number;
  maxEvents: number;
  minRelevanceForNotify: number;
  enabledKinds: Set<PerceptionEventKind>;
};

export const DEFAULT_PERCEPTION_CONFIG: PerceptionConfig = {
  watchPaths: [],
  ignorePatterns: [
    "node_modules",
    ".git",
    "dist",
    "dist-runtime",
    "*.log",
    ".DS_Store",
    "Thumbs.db",
  ],
  debounceMs: 300,
  maxEvents: 500,
  minRelevanceForNotify: 0.4,
  enabledKinds: new Set([
    "file.created",
    "file.modified",
    "file.deleted",
    "file.renamed",
    "system.idle",
    "system.active",
  ]),
};

export type PerceptionObserver = {
  id: string;
  onEvent: (event: PerceptionEvent) => void;
  filter?: (event: PerceptionEvent) => boolean;
};

type FileWatcherEntry = {
  path: string;
  watcher: fs.FSWatcher;
};

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `pe_${Date.now()}_${eventCounter}`;
}

function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const basename = path.basename(filePath);
  const segments = filePath.split(/[/\\]/);
  for (const pattern of ignorePatterns) {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (basename.endsWith(ext)) {return true;}
    } else if (segments.includes(pattern)) {
      return true;
    } else if (basename === pattern) {
      return true;
    }
  }
  return false;
}

function estimateRelevance(
  kind: PerceptionEventKind,
  filePath?: string,
): number {
  const baseScores: Record<PerceptionEventKind, number> = {
    "file.created": 0.6,
    "file.modified": 0.8,
    "file.deleted": 0.7,
    "file.renamed": 0.5,
    "channel.message": 0.9,
    "channel.presence": 0.3,
    "system.idle": 0.1,
    "system.active": 0.2,
    "cron.tick": 0.2,
    "daemon.heartbeat": 0.1,
  };

  let score = baseScores[kind] ?? 0.3;

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const highRelevanceExts = new Set([
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".rs",
      ".go",
      ".yaml",
      ".yml",
      ".json",
      ".toml",
      ".md",
    ]);
    const mediumRelevanceExts = new Set([
      ".css",
      ".html",
      ".svg",
      ".sql",
      ".sh",
      ".bash",
    ]);

    if (highRelevanceExts.has(ext)) {
      score = Math.min(1.0, score + 0.15);
    } else if (mediumRelevanceExts.has(ext)) {
      score = Math.min(1.0, score + 0.05);
    } else if (ext === ".log" || ext === ".tmp") {
      score *= 0.3;
    }
  }

  return Math.min(1.0, Math.max(0.0, score));
}

export class PerceptionEngine {
  private config: PerceptionConfig;
  private watchers: FileWatcherEntry[] = [];
  private observers: Map<string, PerceptionObserver> = new Map();
  private eventBuffer: PerceptionEvent[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private idleThresholdMs: number;
  private lastActivityAt: number = Date.now();

  constructor(
    config: Partial<PerceptionConfig> = {},
    idleThresholdMs: number = 300_000,
  ) {
    this.config = { ...DEFAULT_PERCEPTION_CONFIG, ...config };
    if (!config.enabledKinds) {
      this.config.enabledKinds = new Set(DEFAULT_PERCEPTION_CONFIG.enabledKinds);
    }
    this.idleThresholdMs = idleThresholdMs;
  }

  start(): void {
    if (this.running) {return;}
    this.running = true;
    this.startFileWatchers();
    this.startIdleMonitor();
  }

  stop(): void {
    if (!this.running) {return;}
    this.running = false;
    this.stopFileWatchers();
    this.stopIdleMonitor();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  addObserver(observer: PerceptionObserver): void {
    this.observers.set(observer.id, observer);
  }

  removeObserver(id: string): void {
    this.observers.delete(id);
  }

  getRecentEvents(limit?: number): PerceptionEvent[] {
    const count = limit ?? 50;
    return this.eventBuffer.slice(-count);
  }

  getEventCount(): number {
    return this.eventBuffer.length;
  }

  addWatchPath(dirPath: string): void {
    if (!this.config.watchPaths.includes(dirPath)) {
      this.config.watchPaths.push(dirPath);
      if (this.running) {
        this.watchDirectory(dirPath);
      }
    }
  }

  removeWatchPath(dirPath: string): void {
    this.config.watchPaths = this.config.watchPaths.filter((p) => p !== dirPath);
    const entry = this.watchers.find((w) => w.path === dirPath);
    if (entry) {
      entry.watcher.close();
      this.watchers = this.watchers.filter((w) => w.path !== dirPath);
    }
  }

  recordActivity(): void {
    this.lastActivityAt = Date.now();
  }

  isIdle(): boolean {
    return Date.now() - this.lastActivityAt > this.idleThresholdMs;
  }

  injectEvent(event: Omit<PerceptionEvent, "id" | "observedAt">): PerceptionEvent {
    const full: PerceptionEvent = {
      ...event,
      id: nextEventId(),
      observedAt: Date.now(),
    };
    this.processEvent(full);
    return full;
  }

  getWatchedPaths(): string[] {
    return [...this.config.watchPaths];
  }

  private startFileWatchers(): void {
    for (const dirPath of this.config.watchPaths) {
      this.watchDirectory(dirPath);
    }
  }

  private stopFileWatchers(): void {
    for (const entry of this.watchers) {
      try {
        entry.watcher.close();
      } catch {}
    }
    this.watchers = [];
  }

  private watchDirectory(dirPath: string): void {
    try {
      const watcher = fs.watch(
        dirPath,
        { recursive: true, persistent: false },
        (eventType, filename) => {
          if (!filename) {return;}
          const filePath = path.join(dirPath, filename);
          if (shouldIgnore(filePath, this.config.ignorePatterns)) {return;}
          this.handleFileEvent(eventType, filePath, dirPath);
        },
      );
      watcher.on("error", () => {});
      this.watchers.push({ path: dirPath, watcher });
    } catch {}
  }

  private handleFileEvent(
    eventType: string,
    filePath: string,
    source: string,
  ): void {
    const debounceKey = `${eventType}:${filePath}`;
    const existing = this.debounceTimers.get(debounceKey);
    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(
      debounceKey,
      setTimeout(() => {
        this.debounceTimers.delete(debounceKey);

        let kind: PerceptionEventKind;
        if (eventType === "rename") {
          try {
            fs.statSync(filePath);
            kind = "file.created";
          } catch {
            kind = "file.deleted";
          }
        } else {
          kind = "file.modified";
        }

        if (!this.config.enabledKinds.has(kind)) {return;}

        const event: PerceptionEvent = {
          id: nextEventId(),
          kind,
          source,
          detail: filePath,
          timestamp: Date.now(),
          relevance: estimateRelevance(kind, filePath),
          observedAt: Date.now(),
        };

        this.processEvent(event);
      }, this.config.debounceMs),
    );
  }

  private startIdleMonitor(): void {
    if (!this.config.enabledKinds.has("system.idle")) {return;}
    this.idleTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastActivityAt;
      if (elapsed > this.idleThresholdMs) {
        const event: PerceptionEvent = {
          id: nextEventId(),
          kind: "system.idle",
          source: "system",
          detail: `空闲 ${Math.floor(elapsed / 1000)}s`,
          timestamp: now,
          relevance: 0.1,
          observedAt: now,
        };
        this.processEvent(event);
      }
    }, 60_000);
  }

  private stopIdleMonitor(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private processEvent(event: PerceptionEvent): void {
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.config.maxEvents) {
      this.eventBuffer.shift();
    }

    for (const observer of this.observers.values()) {
      if (observer.filter && !observer.filter(event)) {continue;}
      try {
        observer.onEvent(event);
      } catch {}
    }
  }
}

export function formatPerceptionEvent(event: PerceptionEvent): string {
  const kindLabels: Record<PerceptionEventKind, string> = {
    "file.created": "新建",
    "file.modified": "修改",
    "file.deleted": "删除",
    "file.renamed": "重命名",
    "channel.message": "消息",
    "channel.presence": "在线",
    "system.idle": "空闲",
    "system.active": "活跃",
    "cron.tick": "定时",
    "daemon.heartbeat": "心跳",
  };
  const label = kindLabels[event.kind] ?? event.kind;
  const relBar = relevanceBar(event.relevance);
  const basename = event.detail.split(/[/\\]/).pop() ?? event.detail;
  return `${relBar} ${label} ${basename}`;
}

function relevanceBar(score: number, width: number = 3): string {
  const filled = Math.round(score * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function formatPerceptionSummary(
  events: PerceptionEvent[],
  maxLines: number = 8,
): string[] {
  if (events.length === 0) {
    return ["  感知引擎空闲"];
  }
  const recent = events.slice(-maxLines);
  return recent.map((e) => `  ${formatPerceptionEvent(e)}`);
}
