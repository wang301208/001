import type { ZhushouConfig } from "../config/types.zhushou.js";
import { listWorkspaceScopedAgentIds, resolveAgentWorkspaceDir } from "./agent-scope.js";

export function listAgentWorkspaceDirs(cfg: ZhushouConfig): string[] {
  const dirs = new Set<string>();
  for (const agentId of listWorkspaceScopedAgentIds(cfg)) {
    dirs.add(resolveAgentWorkspaceDir(cfg, agentId));
  }
  return [...dirs];
}
