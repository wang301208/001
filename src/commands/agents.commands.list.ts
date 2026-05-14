import { formatCliCommand } from "../cli/command-format.js";
import { listRouteBindings } from "../config/bindings.js";
import type { AgentRouteBinding } from "../config/types.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { describeBinding } from "./agents.bindings.js";
import { requireValidConfig } from "./agents.command-shared.js";
import type { AgentSummary } from "./agents.config.js";
import { buildAgentSummaries } from "./agents.config.js";
import {
  buildProviderStatusIndex,
  listProvidersForAgent,
  summarizeBindings,
} from "./agents.providers.js";

type AgentsListOptions = {
  json?: boolean;
  bindings?: boolean;
};

function formatLimited(values: string[], limit = 5): string | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const head = values.slice(0, limit).join(", ");
  return values.length > limit ? `${head} (+${values.length - limit} more)` : head;
}

function buildGovernanceLines(summary: AgentSummary): string[] {
  const governance = summary.governance;
  const contract = summary.governanceContract;
  if (!governance.charterDeclared && !governance.freezeActive) {
    return [];
  }

  const lines: string[] = [];
  if (governance.charterDeclared) {
    const charterLabel = governance.charterTitle ?? summary.name ?? summary.id;
    const charterLayer = governance.charterLayer ? ` [${governance.charterLayer}]` : "";
    const virtualTag = summary.configured ? "" : " (virtual)";
    lines.push(`  Governance: ${charterLabel}${charterLayer}${virtualTag}`);

    const restrictions: string[] = [];
    if (governance.charterToolDeny.length > 0) {
      restrictions.push(`deny ${governance.charterToolDeny.join(", ")}`);
    }
    if (governance.charterRequireAgentId) {
      restrictions.push("explicit subagent ids");
    }
    if (governance.charterExecutionContract) {
      restrictions.push(`execution=${governance.charterExecutionContract}`);
    }
    if (governance.charterElevatedLocked) {
      restrictions.push("elevated locked");
    }
    if (restrictions.length > 0) {
      lines.push(`  Governance policy: ${restrictions.join("; ")}`);
    }
    if (contract.missionPrimary) {
      lines.push(`  Governance mission: ${contract.missionPrimary}`);
    }
    const collaborators = formatLimited(contract.collaborators, 6);
    if (collaborators) {
      lines.push(`  Governance collaborators: ${collaborators}`);
    }
    const reportsTo = formatLimited(contract.reportsTo, 4);
    if (reportsTo) {
      lines.push(`  Governance reports-to: ${reportsTo}`);
    }
    const mutationAllow = formatLimited(contract.mutationAllow, 4);
    const mutationDeny = formatLimited(contract.mutationDeny, 4);
    if (mutationAllow || mutationDeny) {
      lines.push(
        `  Governance mutation: allow ${mutationAllow ?? "none"}; deny ${mutationDeny ?? "none"}`,
      );
    }
    if (contract.networkDefault || contract.networkConditions.length > 0) {
      const conditions = formatLimited(contract.networkConditions, 4);
      lines.push(
        `  Governance network: ${contract.networkDefault ?? "unspecified"}${conditions ? `; ${conditions}` : ""}`,
      );
    }
    if (contract.resourceBudget) {
      lines.push(
        `  Governance budget: tokens=${contract.resourceBudget.tokens ?? "unspecified"}, parallelism=${contract.resourceBudget.parallelism ?? "unspecified"}, runtime=${contract.resourceBudget.runtime ?? "unspecified"}`,
      );
    }
    const hooks = formatLimited(contract.runtimeHooks, 4);
    if (hooks) {
      lines.push(`  Governance hooks: ${hooks}`);
    }
  }

  if (governance.freezeActive) {
    lines.push(
      `  Governance freeze: active${governance.freezeReasonCode ? ` (${governance.freezeReasonCode})` : ""}`,
    );
    if (governance.freezeDeny.length > 0) {
      lines.push(`  Freeze deny: ${governance.freezeDeny.join(", ")}`);
    }
    if (governance.freezeDetails.length > 0) {
      lines.push(`  Freeze details: ${governance.freezeDetails.join(" | ")}`);
    }
  }

  return lines;
}

function formatSummary(summary: AgentSummary) {
  const defaultTag = summary.isDefault ? " (default)" : "";
  const header =
    summary.name && summary.name !== summary.id
      ? `${summary.id}${defaultTag} (${summary.name})`
      : `${summary.id}${defaultTag}`;

  const identityParts = [];
  if (summary.identityEmoji) {
    identityParts.push(summary.identityEmoji);
  }
  if (summary.identityName) {
    identityParts.push(summary.identityName);
  }
  const identityLine = identityParts.length > 0 ? identityParts.join(" ") : null;
  const identitySource =
    summary.identitySource === "identity"
      ? "IDENTITY.md"
      : summary.identitySource === "config"
        ? "config"
        : null;

  const lines = [`- ${header}`];
  if (identityLine) {
    lines.push(`  Identity: ${identityLine}${identitySource ? ` (${identitySource})` : ""}`);
  }
  lines.push(`  Workspace: ${shortenHomePath(summary.workspace)}`);
  lines.push(`  Agent dir: ${shortenHomePath(summary.agentDir)}`);
  if (summary.model) {
    lines.push(`  Model: ${summary.model}`);
  }
  lines.push(...buildGovernanceLines(summary));
  lines.push(`  Routing rules: ${summary.bindings}`);

  if (summary.routes?.length) {
    lines.push(`  Routing: ${summary.routes.join(", ")}`);
  }
  if (summary.providers?.length) {
    lines.push("  Providers:");
    for (const provider of summary.providers) {
      lines.push(`    - ${provider}`);
    }
  }

  if (summary.bindingDetails?.length) {
    lines.push("  Routing rules:");
    for (const binding of summary.bindingDetails) {
      lines.push(`    - ${binding}`);
    }
  }
  return lines.join("\n");
}

export async function agentsListCommand(
  opts: AgentsListOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }

  const summaries = buildAgentSummaries(cfg, { includeGovernanceCharter: true });
  const bindingMap = new Map<string, AgentRouteBinding[]>();
  for (const binding of listRouteBindings(cfg)) {
    const agentId = normalizeAgentId(binding.agentId);
    const list = bindingMap.get(agentId) ?? [];
    list.push(binding);
    bindingMap.set(agentId, list);
  }

  if (opts.bindings) {
    for (const summary of summaries) {
      const bindings = bindingMap.get(summary.id) ?? [];
      if (bindings.length > 0) {
        summary.bindingDetails = bindings.map((binding) => describeBinding(binding));
      }
    }
  }

  const providerStatus = await buildProviderStatusIndex(cfg);

  for (const summary of summaries) {
    const bindings = bindingMap.get(summary.id) ?? [];
    const routes = summarizeBindings(cfg, bindings);
    if (routes.length > 0) {
      summary.routes = routes;
    } else if (summary.isDefault) {
      summary.routes = ["default (no explicit rules)"];
    }

    const providerLines = listProvidersForAgent({
      summaryIsDefault: summary.isDefault,
      cfg,
      bindings,
      providerStatus,
    });
    if (providerLines.length > 0) {
      summary.providers = providerLines;
    }
  }

  if (opts.json) {
    writeRuntimeJson(runtime, summaries);
    return;
  }

  const lines = ["Agents:", ...summaries.map(formatSummary)];
  lines.push("Routing rules map channel/account/peer to an agent. Use --bindings for full rules.");
  lines.push(
    `Channel status reflects local config/creds. For live health: ${formatCliCommand("zhushou channels status --probe")}.`,
  );
  runtime.log(lines.join("\n"));
}
