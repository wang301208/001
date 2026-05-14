/**
 * 返回进程内重启循环的迭代钩子。
 * 首次调用视为初始启动，不做任何操作。
 * 后续每次调用代表一次重启迭代并调用 `onRestart`。
 */
export function createRestartIterationHook(onRestart: () => void): () => boolean {
  let isFirstIteration = true;
  return () => {
    if (isFirstIteration) {
      isFirstIteration = false;
      return false;
    }
    onRestart();
    return true;
  };
}
