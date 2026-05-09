import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export type BusinessTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type BusinessTaskDuration = "short" | "medium" | "long";
export type BusinessTaskPriority = "high" | "medium" | "low";

export type BusinessTaskContext = {
  domain: string;
  domainLabel?: string;
  accessMode: string;
  accessModeLabel?: string;
  object?: string;
  acceptanceCriteria?: string;
  payload?: Record<string, unknown>;
};

export type BusinessTaskRecord = {
  id: string;
  agentId: string;
  name: string;
  goal: string;
  status: BusinessTaskStatus;
  progress: number;
  duration: BusinessTaskDuration;
  priority: BusinessTaskPriority;
  group: string;
  business: BusinessTaskContext;
  autonomy?: {
    sessionKey?: string;
    flowId?: string;
    started?: unknown;
  };
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
};

type BusinessTaskSnapshot = {
  version: 1;
  tasks: BusinessTaskRecord[];
};

function resolveBusinessTaskStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "business", "tasks.json");
}

function createTaskId(now = Date.now()) {
  return `bt_${now}_${Math.random().toString(36).slice(2, 10)}`;
}

function readSnapshot(): BusinessTaskSnapshot {
  const filePath = resolveBusinessTaskStorePath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BusinessTaskSnapshot>;
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks as BusinessTaskRecord[] : [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { version: 1, tasks: [] };
    }
    throw error;
  }
}

function writeSnapshot(snapshot: BusinessTaskSnapshot) {
  const filePath = resolveBusinessTaskStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function listBusinessTasks(params: {
  status?: BusinessTaskStatus;
  limit?: number;
} = {}): BusinessTaskRecord[] {
  const tasks = readSnapshot().tasks
    .filter((task) => !params.status || task.status === params.status)
    .sort((a, b) => b.createdAt - a.createdAt);
  return typeof params.limit === "number" && params.limit > 0 ? tasks.slice(0, params.limit) : tasks;
}

export function createBusinessTask(params: {
  agentId: string;
  name: string;
  goal: string;
  duration: BusinessTaskDuration;
  priority: BusinessTaskPriority;
  group: string;
  business: BusinessTaskContext;
}): BusinessTaskRecord {
  const now = Date.now();
  const snapshot = readSnapshot();
  const task: BusinessTaskRecord = {
    id: createTaskId(now),
    agentId: params.agentId,
    name: params.name,
    goal: params.goal,
    status: "running",
    progress: 0,
    duration: params.duration,
    priority: params.priority,
    group: params.group,
    business: params.business,
    createdAt: now,
    updatedAt: now,
  };
  snapshot.tasks = [task, ...snapshot.tasks];
  writeSnapshot(snapshot);
  return task;
}

export function updateBusinessTask(
  id: string,
  patch: Partial<Pick<BusinessTaskRecord, "status" | "progress" | "error" | "autonomy">>,
): BusinessTaskRecord | null {
  const snapshot = readSnapshot();
  const index = snapshot.tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    return null;
  }
  const current = snapshot.tasks[index]!;
  const nextStatus = patch.status ?? current.status;
  const next: BusinessTaskRecord = {
    ...current,
    ...patch,
    status: nextStatus,
    progress: typeof patch.progress === "number" ? Math.max(0, Math.min(100, patch.progress)) : current.progress,
    updatedAt: Date.now(),
    ...(nextStatus === "completed" || nextStatus === "failed" || nextStatus === "cancelled"
      ? { completedAt: Date.now() }
      : {}),
  };
  snapshot.tasks[index] = next;
  writeSnapshot(snapshot);
  return next;
}

export function deleteBusinessTask(id: string): BusinessTaskRecord | null {
  const snapshot = readSnapshot();
  const index = snapshot.tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    return null;
  }
  const [deleted] = snapshot.tasks.splice(index, 1);
  writeSnapshot(snapshot);
  return deleted ?? null;
}
