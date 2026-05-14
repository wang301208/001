// 内存文件/后端访问的聚焦运行时合约。

export { listMemoryFiles, normalizeExtraMemoryPaths } from "./host/internal.js";
export { readAgentMemoryFile } from "./host/read-file.js";
export { resolveMemoryBackendConfig } from "./host/backend-config.js";
export type {
  MemorySearchManager,
  MemorySearchRuntimeDebug,
  MemorySearchResult,
} from "./host/types.js";
