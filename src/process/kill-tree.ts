import { spawn } from "node:child_process";

const DEFAULT_GRACE_MS = 3000;
const MAX_GRACE_MS = 60_000;

/**
 * 尽力终止进程树并优雅关闭。
 * - Windows：使用 taskkill /T 包含后代进程。先发送 SIGTERM 等价信号
 *   （不带 /F），进程存活则强制终止。
 * - Unix：先向进程组发送 SIGTERM，等待宽限期后发送 SIGKILL。
 *
 * 这使子进程有机会清理（关闭连接、删除临时文件、终止自身的子进程）
 * 然后再被强制终止。
 */
export function killProcessTree(pid: number, opts?: { graceMs?: number }): void {
  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }

  const graceMs = normalizeGraceMs(opts?.graceMs);

  if (process.platform === "win32") {
    killProcessTreeWindows(pid, graceMs);
    return;
  }

  killProcessTreeUnix(pid, graceMs);
}

function normalizeGraceMs(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GRACE_MS;
  }
  return Math.max(0, Math.min(MAX_GRACE_MS, Math.floor(value)));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessTreeUnix(pid: number, graceMs: number): void {
  // 步骤 1：尝试向进程组发送优雅的 SIGTERM
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // 进程组不存在或无权限 - 尝试直接终止
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // 已退出
      return;
    }
  }

  // 步骤 2：等待宽限期，若仍存活则 SIGKILL
  setTimeout(() => {
    if (isProcessAlive(-pid)) {
      try {
        process.kill(-pid, "SIGKILL");
        return;
      } catch {
        // 继续尝试直接终止 pid
      }
    }
    if (!isProcessAlive(pid)) {
      return;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 进程在存活检查和终止之间已退出
    }
  }, graceMs).unref(); // 不阻塞事件循环退出
}

function runTaskkill(args: string[]): void {
  try {
    spawn("taskkill", args, {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
  } catch {
    // 忽略 taskkill 启动失败
  }
}

function killProcessTreeWindows(pid: number, graceMs: number): void {
  // 步骤 1：尝试优雅终止（taskkill 不带 /F）
  runTaskkill(["/T", "/PID", String(pid)]);

  // 步骤 2：等待宽限期，仅在 pid 仍存在时强制终止。
  // 避免在优雅关闭后无条件延迟 /F 终止。
  setTimeout(() => {
    if (!isProcessAlive(pid)) {
      return;
    }
    runTaskkill(["/F", "/T", "/PID", String(pid)]);
  }, graceMs).unref(); // 不阻塞事件循环退出
}
