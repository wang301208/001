import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../../routing/session-key.js";
import {
  resolveGovernanceCharterCollaborationPolicy,
  resolveGovernanceCharterAgentBlueprint,
} from "../../governance/charter-agents.js";
import {
  resolveAgentToolGovernanceSummary,
  type AgentToolGovernanceSummary,
} from "../../governance/tool-governance-summary.js";
import {
  resolveAgentGovernanceRuntimeContract,
  type AgentGovernanceRuntimeContract,
} from "../../governance/runtime-contract.js";
import { resolveAgentConfig } from "../agent-scope.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const AgentsListToolSchema = Type.Object({});

type AgentListEntry = {
  id: string;
  name?: string;
  configured: boolean;
  charterDeclared: boolean;
  charterTitle?: string;
  charterLayer?: string;
  governance: AgentToolGovernanceSummary;
  contract: AgentGovernanceRuntimeContract;
  allowedBy: Array<"self" | "config" | "charter">;
};

export function createAgentsListTool(opts?: {
  agentSessionKey?: string;
  /** Explicit agent ID override for cron/hook sessions. */
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Agents",
    name: "agents_list",
    description:
      'List OpenClaw agent ids you can target with `sessions_spawn` when `runtime="subagent"` (based on subagent allowlists and governance charter topology).',
    parameters: AgentsListToolSchema,
    execute: async () => {
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterInternalKey =
        typeof opts?.agentSessionKey === "string" && opts.agentSessionKey.trim()
          ? resolveInternalSessionKey({
              key: opts.agentSessionKey,
              alias,
              mainKey,
            })
          : alias;
      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ??
          parseAgentSessionKey(requesterInternalKey)?.agentId ??
          DEFAULT_AGENT_ID,
      );

      const resolvedAllowAgents =
        resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ??
        cfg?.agents?.defaults?.subagents?.allowAgents;
      const allowAgents = Array.isArray(resolvedAllowAgents) ? resolvedAllowAgents : [];
      const hasConfigAllowConstraint = Array.isArray(resolvedAllowAgents);
      const allowAny = allowAgents.some((value) => value.trim() === "*");
      const allowSet = new Set(
        allowAgents
          .filter((value) => value.trim() && value.trim() !== "*")
          .map((value) => normalizeAgentId(value)),
      );
      const charterPolicy = resolveGovernanceCharterCollaborationPolicy(requesterAgentId);
      const charterCollaborators = new Set(charterPolicy.collaboratorAgentIds);

      const configuredAgents = Array.isArray(cfg.agents?.list) ? cfg.agents?.list : [];
      const configuredIds = configuredAgents.map((entry) => normalizeAgentId(entry.id));
      const configuredNameMap = new Map<string, string>();
      for (const entry of configuredAgents) {
        const name = entry?.name?.trim() ?? "";
        if (!name) {
          continue;
        }
        configuredNameMap.set(normalizeAgentId(entry.id), name);
      }

      const allowedBy = new Map<string, Set<"self" | "config" | "charter">>();
      const markAllowed = (id: string, source: "self" | "config" | "charter") => {
        const normalized = normalizeAgentId(id);
        const existing = allowedBy.get(normalized) ?? new Set<"self" | "config" | "charter">();
        existing.add(source);
        allowedBy.set(normalized, existing);
      };
      markAllowed(requesterAgentId, "self");
      if (charterPolicy.charterDeclared) {
        for (const id of charterCollaborators) {
          if (!hasConfigAllowConstraint || allowAny || allowSet.has(id)) {
            markAllowed(id, "charter");
          }
          if (allowSet.has(id)) {
            markAllowed(id, "config");
          }
        }
      } else if (allowAny) {
        for (const id of configuredIds) {
          markAllowed(id, "config");
        }
      } else {
        for (const id of allowSet) {
          markAllowed(id, "config");
        }
      }

      const all = Array.from(allowedBy.keys());
      const rest = all
        .filter((id) => id !== requesterAgentId)
        .toSorted((a, b) => a.localeCompare(b));
      const ordered = [requesterAgentId, ...rest];
      const agents: AgentListEntry[] = ordered.map((id) => {
        const blueprint = resolveGovernanceCharterAgentBlueprint(id);
        const governance = resolveAgentToolGovernanceSummary({ cfg, agentId: id });
        const contract = resolveAgentGovernanceRuntimeContract({ cfg, agentId: id });
        return {
          id,
          name: configuredNameMap.get(id),
          configured: configuredIds.includes(id),
          charterDeclared: Boolean(blueprint),
          charterTitle: blueprint?.title,
          charterLayer: blueprint?.layer,
          governance,
          contract,
          allowedBy: Array.from(allowedBy.get(id) ?? []).toSorted(),
        };
      });

      return jsonResult({
        requester: requesterAgentId,
        allowAny: charterPolicy.charterDeclared ? false : allowAny,
        charterEnforced: charterPolicy.charterDeclared,
        agents,
      });
    },
  };
}
