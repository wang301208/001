// 内存引擎使用的 QMD/会话/查询辅助的实际工作区合约。

export { extractKeywords, isQueryStopWordToken } from "./host/query-expansion.js";
export {
  buildSessionEntry,
  listSessionFilesForAgent,
  loadDreamingNarrativeTranscriptPathSetForAgent,
  normalizeSessionTranscriptPathForComparison,
  sessionPathForFile,
  type BuildSessionEntryOptions,
  type SessionFileEntry,
} from "./host/session-files.js";
export { parseUsageCountedSessionIdFromFileName } from "../config/sessions/artifacts.js";
export { parseQmdQueryJson, type QmdQueryResult } from "./host/qmd-query-parser.js";
export {
  deriveQmdScopeChannel,
  deriveQmdScopeChatType,
  isQmdScopeAllowed,
} from "./host/qmd-scope.js";
export {
  checkQmdBinaryAvailability,
  resolveCliSpawnInvocation,
  runCliCommand,
} from "./host/qmd-process.js";
