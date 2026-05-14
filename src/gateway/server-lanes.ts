import { resolveAgentMaxConcurrent, resolveSubagentMaxConcurrent } from "../config/agent-limits.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { setCommandLaneConcurrency } from "../process/command-queue.js";
import { CommandLane } from "../process/lanes.js";

export function applyGatewayLaneConcurrency(cfg: ZhushouConfig) {
  setCommandLaneConcurrency(CommandLane.Cron, cfg.cron?.maxConcurrentRuns ?? 1);
  setCommandLaneConcurrency(CommandLane.Main, resolveAgentMaxConcurrent(cfg));
  setCommandLaneConcurrency(CommandLane.Subagent, resolveSubagentMaxConcurrent(cfg));
}
