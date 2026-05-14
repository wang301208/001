import fsSync from "node:fs";

function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0;
}

/**
 * 在 Linux 上通过读取 /proc/<pid>/status 检查进程是否为僵尸进程。
 * 在非 Linux 平台或无法读取 proc 文件时返回 false。
 */
function isZombieProcess(pid: number): boolean {
  if (process.platform !== "linux") {
    return false;
  }
  try {
    const status = fsSync.readFileSync(`/proc/${pid}/status`, "utf8");
    const stateMatch = status.match(/^State:\s+(\S)/m);
    return stateMatch?.[1] === "Z";
  } catch {
    return false;
  }
}

export function isPidAlive(pid: number): boolean {
  if (!isValidPid(pid)) {
    return false;
  }
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (isZombieProcess(pid)) {
    return false;
  }
  return true;
}

/**
 * 从 /proc/<pid>/stat 读取进程启动时间（字段 22 "starttime"）。
 * 返回自系统启动以来的时钟滴答数，在非 Linux 平台或无法
 * 读取 proc 文件时返回 null。
 *
 * 用于检测 PID 回收：如果同一 PID 的两次读取返回不同的
 * starttime，则该 PID 已被不同进程重用。
 */
export function getProcessStartTime(pid: number): number | null {
  if (process.platform !== "linux") {
    return null;
  }
  if (!isValidPid(pid)) {
    return null;
  }
  try {
    const stat = fsSync.readFileSync(`/proc/${pid}/stat`, "utf8");
    const commEndIndex = stat.lastIndexOf(")");
    if (commEndIndex < 0) {
      return null;
    }
    // comm 字段（字段 2）用括号包裹且可包含空格，
    // 因此在最后一个 ")" 后拆分以可靠地获取字段 3..N。
    const afterComm = stat.slice(commEndIndex + 1).trimStart();
    const fields = afterComm.split(/\s+/);
    // 字段 22（starttime）= comm 拆分后的索引 19（字段 3 为索引 0）。
    const starttime = Number(fields[19]);
    return Number.isInteger(starttime) && starttime >= 0 ? starttime : null;
  } catch {
    return null;
  }
}
