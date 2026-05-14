// 对可容忍基于辅助解析的进程本地缓存和注册表是安全的。
// 不要将此用于必须跨分割运行时分块存活的活跃可变状态；
// 应将这些保持为直接的 globalThis[Symbol.for(...)] 查找。
export function resolveGlobalSingleton<T>(key: symbol, create: () => T): T {
  const globalStore = globalThis as Record<PropertyKey, unknown>;
  if (Object.prototype.hasOwnProperty.call(globalStore, key)) {
    return globalStore[key] as T;
  }
  const created = create();
  globalStore[key] = created;
  return created;
}

export function resolveGlobalMap<TKey, TValue>(key: symbol): Map<TKey, TValue> {
  return resolveGlobalSingleton(key, () => new Map<TKey, TValue>());
}
