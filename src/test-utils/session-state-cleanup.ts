import { drainSessionWriteLockStateForTest } from "../agents/session-write-lock.js";
import { clearSessionStoreCaches } from "../config/sessions/store-cache.js";
import { drainSessionStoreLockQueuesForTest } from "../config/sessions/store-lock-state.js";
import { drainFileLockStateForTest } from "../infra/file-lock.js";
import {
  drainTaskRegistryBackgroundWorkForTests,
  resetTaskRegistryForTests,
} from "../tasks/runtime-internal.js";
import { resetTaskFlowRegistryForTests } from "../tasks/task-flow-runtime-internal.js";

let fileLockDrainerForTests: typeof drainFileLockStateForTest | null = null;
let sessionStoreLockQueueDrainerForTests: typeof drainSessionStoreLockQueuesForTest | null = null;
let sessionWriteLockDrainerForTests: typeof drainSessionWriteLockStateForTest | null = null;

export function setSessionStateCleanupRuntimeForTests(params: {
  drainFileLockStateForTest?: typeof drainFileLockStateForTest | null;
  drainSessionStoreLockQueuesForTest?: typeof drainSessionStoreLockQueuesForTest | null;
  drainSessionWriteLockStateForTest?: typeof drainSessionWriteLockStateForTest | null;
}): void {
  if ("drainFileLockStateForTest" in params) {
    fileLockDrainerForTests = params.drainFileLockStateForTest ?? null;
  }
  if ("drainSessionStoreLockQueuesForTest" in params) {
    sessionStoreLockQueueDrainerForTests = params.drainSessionStoreLockQueuesForTest ?? null;
  }
  if ("drainSessionWriteLockStateForTest" in params) {
    sessionWriteLockDrainerForTests = params.drainSessionWriteLockStateForTest ?? null;
  }
}

export function resetSessionStateCleanupRuntimeForTests(): void {
  fileLockDrainerForTests = null;
  sessionStoreLockQueueDrainerForTests = null;
  sessionWriteLockDrainerForTests = null;
}

export async function cleanupSessionStateForTest(): Promise<void> {
  await drainTaskRegistryBackgroundWorkForTests();
  resetTaskRegistryForTests({ persist: false });
  resetTaskFlowRegistryForTests({ persist: false });
  await (sessionStoreLockQueueDrainerForTests ?? drainSessionStoreLockQueuesForTest)();
  clearSessionStoreCaches();
  await (fileLockDrainerForTests ?? drainFileLockStateForTest)();
  await (sessionWriteLockDrainerForTests ?? drainSessionWriteLockStateForTest)();
}
