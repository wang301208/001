import {
  diagnosticLogger as diag,
  logLaneDequeue,
  logLaneEnqueue,
} from "../logging/diagnostic-runtime.js";
import { resolveGlobalSingleton } from "../shared/global-singleton.js";
import { CommandLane } from "./lanes.js";
/**
 * 当排队命令因所在通道被清除而被拒绝时抛出的专用错误类型。
 * 发后即忘的排队任务调用者可以捕获（或忽略）此特定类型，
 * 以避免未处理拒绝的噪音。
 */
export class CommandLaneClearedError extends Error {
  constructor(lane?: string) {
    super(lane ? `命令通道 "${lane}" 已清除` : "命令通道已清除");
    this.name = "CommandLaneClearedError";
  }
}

/**
 * 当新命令因网关正在排空准备重启而被拒绝时抛出的专用错误类型。
 */
export class GatewayDrainingError extends Error {
  constructor() {
    super("网关正在排空准备重启；不接受新任务");
    this.name = "GatewayDrainingError";
  }
}

// 最小化进程内队列，序列化命令执行。
// 默认通道（"main"）保持现有行为。额外通道允许
// 低风险并行（如定时任务），而不会交错主自动回复
// 工作流的 stdin / 日志。

type QueueEntry = {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  enqueuedAt: number;
  warnAfterMs: number;
  onWait?: (waitMs: number, queuedAhead: number) => void;
};

type LaneState = {
  lane: string;
  queue: QueueEntry[];
  activeTaskIds: Set<number>;
  maxConcurrent: number;
  draining: boolean;
  generation: number;
};

type ActiveTaskWaiter = {
  activeTaskIds: Set<number>;
  resolve: (value: { drained: boolean }) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

function isExpectedNonErrorLaneFailure(err: unknown): boolean {
  return err instanceof Error && err.name === "LiveSessionModelSwitchError";
}

/**
 * 将队列运行时状态保存在 globalThis 上，使每个打包入口/分块在
 * 生产构建中共享相同的通道、计数器和排空标志。
 */
const COMMAND_QUEUE_STATE_KEY = Symbol.for("zhushou.commandQueueState");

function getQueueState() {
  const state = resolveGlobalSingleton(COMMAND_QUEUE_STATE_KEY, () => ({
    gatewayDraining: false,
    lanes: new Map<string, LaneState>(),
    activeTaskWaiters: new Set<ActiveTaskWaiter>(),
    nextTaskId: 1,
  }));
  // 模式迁移：单例可能由较旧代码版本（例如 v2026.4.2）创建，
  // 不包含 `activeTaskWaiters`。SIGUSR1 进程内重启后，新代码通过
  // `resolveGlobalSingleton` 继承了陈旧对象，因为 Symbol 键已存在于
  // globalThis。补丁缺失字段使下游消费者看到有效 Set 而非 `undefined`。
  if (!state.activeTaskWaiters) {
    state.activeTaskWaiters = new Set<ActiveTaskWaiter>();
  }
  return state;
}

function normalizeLane(lane: string): string {
  return lane.trim() || CommandLane.Main;
}

function getLaneDepth(state: LaneState): number {
  return state.queue.length + state.activeTaskIds.size;
}

function getLaneState(lane: string): LaneState {
  const queueState = getQueueState();
  const existing = queueState.lanes.get(lane);
  if (existing) {
    return existing;
  }
  const created: LaneState = {
    lane,
    queue: [],
    activeTaskIds: new Set(),
    maxConcurrent: 1,
    draining: false,
    generation: 0,
  };
  queueState.lanes.set(lane, created);
  return created;
}

function completeTask(state: LaneState, taskId: number, taskGeneration: number): boolean {
  if (taskGeneration !== state.generation) {
    return false;
  }
  state.activeTaskIds.delete(taskId);
  return true;
}

function hasPendingActiveTasks(taskIds: Set<number>): boolean {
  const queueState = getQueueState();
  for (const state of queueState.lanes.values()) {
    for (const taskId of state.activeTaskIds) {
      if (taskIds.has(taskId)) {
        return true;
      }
    }
  }
  return false;
}

function resolveActiveTaskWaiter(waiter: ActiveTaskWaiter, result: { drained: boolean }): void {
  const queueState = getQueueState();
  if (!queueState.activeTaskWaiters.delete(waiter)) {
    return;
  }
  if (waiter.timeout) {
    clearTimeout(waiter.timeout);
  }
  waiter.resolve(result);
}

function notifyActiveTaskWaiters(): void {
  const queueState = getQueueState();
  for (const waiter of Array.from(queueState.activeTaskWaiters)) {
    if (waiter.activeTaskIds.size === 0 || !hasPendingActiveTasks(waiter.activeTaskIds)) {
      resolveActiveTaskWaiter(waiter, { drained: true });
    }
  }
}

function drainLane(lane: string) {
  const state = getLaneState(lane);
  if (state.draining) {
    if (state.activeTaskIds.size === 0 && state.queue.length > 0) {
      diag.warn(
        `drainLane blocked: lane=${lane} draining=true active=0 queue=${state.queue.length}`,
      );
    }
    return;
  }
  state.draining = true;

  const pump = () => {
    try {
      while (state.activeTaskIds.size < state.maxConcurrent && state.queue.length > 0) {
        const entry = state.queue.shift() as QueueEntry;
        const waitedMs = Date.now() - entry.enqueuedAt;
        if (waitedMs >= entry.warnAfterMs) {
          try {
            entry.onWait?.(waitedMs, state.queue.length);
          } catch (err) {
            diag.error(`lane onWait callback failed: lane=${lane} error="${String(err)}"`);
          }
          diag.warn(
            `lane wait exceeded: lane=${lane} waitedMs=${waitedMs} queueAhead=${state.queue.length}`,
          );
        }
        logLaneDequeue(lane, waitedMs, state.queue.length);
        const taskId = getQueueState().nextTaskId++;
        const taskGeneration = state.generation;
        state.activeTaskIds.add(taskId);
        void (async () => {
          const startTime = Date.now();
          try {
            const result = await entry.task();
            const completedCurrentGeneration = completeTask(state, taskId, taskGeneration);
            if (completedCurrentGeneration) {
              notifyActiveTaskWaiters();
              diag.debug(
                `lane task done: lane=${lane} durationMs=${Date.now() - startTime} active=${state.activeTaskIds.size} queued=${state.queue.length}`,
              );
              pump();
            }
            entry.resolve(result);
          } catch (err) {
            const completedCurrentGeneration = completeTask(state, taskId, taskGeneration);
            const isProbeLane = lane.startsWith("auth-probe:") || lane.startsWith("session:probe-");
            if (!isProbeLane && !isExpectedNonErrorLaneFailure(err)) {
              diag.error(
                `lane task error: lane=${lane} durationMs=${Date.now() - startTime} error="${String(err)}"`,
              );
            } else if (!isProbeLane) {
              diag.debug(
                `lane task interrupted: lane=${lane} durationMs=${Date.now() - startTime} reason="${String(err)}"`,
              );
            }
            if (completedCurrentGeneration) {
              notifyActiveTaskWaiters();
              pump();
            }
            entry.reject(err);
          }
        })();
      }
    } finally {
      state.draining = false;
    }
  };

  pump();
}

/**
 * 标记网关正在排空准备重启，使新的入队操作快速失败并抛出
 * `GatewayDrainingError`，而非在关闭时被静默终止。
 */
export function markGatewayDraining(): void {
  getQueueState().gatewayDraining = true;
}

export function setCommandLaneConcurrency(lane: string, maxConcurrent: number) {
  const cleaned = normalizeLane(lane);
  const state = getLaneState(cleaned);
  state.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
  drainLane(cleaned);
}

export function enqueueCommandInLane<T>(
  lane: string,
  task: () => Promise<T>,
  opts?: {
    warnAfterMs?: number;
    onWait?: (waitMs: number, queuedAhead: number) => void;
  },
): Promise<T> {
  const queueState = getQueueState();
  if (queueState.gatewayDraining) {
    return Promise.reject(new GatewayDrainingError());
  }
  const cleaned = normalizeLane(lane);
  const warnAfterMs = opts?.warnAfterMs ?? 2_000;
  const state = getLaneState(cleaned);
  return new Promise<T>((resolve, reject) => {
    state.queue.push({
      task: () => task(),
      resolve: (value) => resolve(value as T),
      reject,
      enqueuedAt: Date.now(),
      warnAfterMs,
      onWait: opts?.onWait,
    });
    logLaneEnqueue(cleaned, getLaneDepth(state));
    drainLane(cleaned);
  });
}

export function enqueueCommand<T>(
  task: () => Promise<T>,
  opts?: {
    warnAfterMs?: number;
    onWait?: (waitMs: number, queuedAhead: number) => void;
  },
): Promise<T> {
  return enqueueCommandInLane(CommandLane.Main, task, opts);
}

export function getQueueSize(lane: string = CommandLane.Main) {
  const resolved = normalizeLane(lane);
  const state = getQueueState().lanes.get(resolved);
  if (!state) {
    return 0;
  }
  return getLaneDepth(state);
}

export function getTotalQueueSize() {
  let total = 0;
  for (const s of getQueueState().lanes.values()) {
    total += getLaneDepth(s);
  }
  return total;
}

export function clearCommandLane(lane: string = CommandLane.Main) {
  const cleaned = normalizeLane(lane);
  const state = getQueueState().lanes.get(cleaned);
  if (!state) {
    return 0;
  }
  const removed = state.queue.length;
  const pending = state.queue.splice(0);
  for (const entry of pending) {
    entry.reject(new CommandLaneClearedError(cleaned));
  }
  return removed;
}

/**
 * 仅测试使用的硬重置，丢弃所有队列状态，包括前代保留的
 * 排队工作。当测试套件需要在共享 worker 运行间获得
 * 隔离基线时使用。
 */
export function resetCommandQueueStateForTest(): void {
  const queueState = getQueueState();
  queueState.gatewayDraining = false;
  queueState.lanes.clear();
  for (const waiter of Array.from(queueState.activeTaskWaiters)) {
    resolveActiveTaskWaiter(waiter, { drained: true });
  }
  queueState.nextTaskId = 1;
}

/**
 * 将所有通道运行时状态重置为空闲。用于 SIGUSR1 进程内重启后，
 * 被中断任务的 finally 块可能未执行，留下陈旧的活动任务 ID
 * 永久阻塞新工作的排空。
 *
 * 递增通道代数并清除执行计数器，使旧进行中任务的陈旧完成
 * 被忽略。排队条目被故意保留 — 它们代表应仍在重启后
 * 执行的待处理用户工作。
 *
 * 重置后，排空仍有排队条目的通道，使保留的工作立即被泵送，
 * 而非等待未来的 `enqueueCommandInLane()` 调用（可能永远不会来）。
 */
export function resetAllLanes(): void {
  const queueState = getQueueState();
  queueState.gatewayDraining = false;
  const lanesToDrain: string[] = [];
  for (const state of queueState.lanes.values()) {
    state.generation += 1;
    state.activeTaskIds.clear();
    state.draining = false;
    if (state.queue.length > 0) {
      lanesToDrain.push(state.lane);
    }
  }
  // 在完整重置通过后排空，使所有通道先处于干净状态。
  for (const lane of lanesToDrain) {
    drainLane(lane);
  }
  notifyActiveTaskWaiters();
}

/**
 * 返回所有通道中当前正在执行的任务总数
 * （不包括已排队但未开始的条目）。
 */
export function getActiveTaskCount(): number {
  const queueState = getQueueState();
  let total = 0;
  for (const s of queueState.lanes.values()) {
    total += s.activeTaskIds.size;
  }
  return total;
}

/**
 * 等待所有通道中当前活动的任务完成。
 * 以短间隔轮询；当无活动任务或 `timeoutMs` 超时时解决
 * （以先到者为准）。
 *
 * 此调用之后入队的新任务被忽略 — 仅等待已执行中的任务。
 */
export function waitForActiveTasks(timeoutMs: number): Promise<{ drained: boolean }> {
  const queueState = getQueueState();
  const activeAtStart = new Set<number>();
  for (const state of queueState.lanes.values()) {
    for (const taskId of state.activeTaskIds) {
      activeAtStart.add(taskId);
    }
  }

  if (activeAtStart.size === 0) {
    return Promise.resolve({ drained: true });
  }
  if (timeoutMs <= 0) {
    return Promise.resolve({ drained: false });
  }

  return new Promise((resolve) => {
    const waiter: ActiveTaskWaiter = {
      activeTaskIds: activeAtStart,
      resolve,
    };
    waiter.timeout = setTimeout(() => {
      resolveActiveTaskWaiter(waiter, { drained: false });
    }, timeoutMs);
    queueState.activeTaskWaiters.add(waiter);
    notifyActiveTaskWaiters();
  });
}
