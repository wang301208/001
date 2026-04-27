import type { OpenClawConfig } from "../config/types.openclaw.js";
import { listWorkspaceScopedAgentIds, resolveAgentWorkspaceDir } from "./agent-scope.js";

export function listAgentWorkspaceDirs(cfg: OpenClawConfig): string[] {
  const dirs = new Set<string>();
  for (const agentId of listWorkspaceScopedAgentIds(cfg)) {
    dirs.add(resolveAgentWorkspaceDir(cfg, agentId));
  }
  return [...dirs];
}
