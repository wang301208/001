import { Type } from "@sinclair/typebox";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import {
  getGovernanceAgent,
  getGovernanceCapabilityAssetRegistry,
  getGovernanceCapabilityInventory,
  getGovernanceGenesisPlan,
  getGovernanceOverview,
  getGovernanceTeam,
  reconcileGovernanceProposals,
  synthesizeGovernanceProposals,
} from "../../governance/control-plane.js";
import {
  applyGovernanceProposal,
  applyGovernanceProposals,
  createGovernanceProposal,
  listGovernanceProposals,
  revertGovernanceProposalApply,
  revertGovernanceProposalApplies,
  reviewGovernanceProposal,
  reviewGovernanceProposals,
} from "../../governance/proposals.js";
import {
  GOVERNANCE_TOOL_DISPLAY_SUMMARY,
  describeGovernanceTool,
} from "../tool-description-presets.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const GovernanceToolSchema = Type.Object({
  action: Type.Union([
    Type.Literal("overview"),
    Type.Literal("agent"),
    Type.Literal("team"),
    Type.Literal("capability_inventory"),
    Type.Literal("asset_registry"),
    Type.Literal("genesis_plan"),
    Type.Literal("proposals_list"),
    Type.Literal("proposals_synthesize"),
    Type.Literal("proposals_reconcile"),
    Type.Literal("proposal_create"),
    Type.Literal("proposal_review"),
    Type.Literal("proposals_review_many"),
    Type.Literal("proposal_apply"),
    Type.Literal("proposals_apply_many"),
    Type.Literal("proposal_revert"),
    Type.Literal("proposals_revert_many"),
  ]),
  agentId: Type.Optional(
    Type.String({
      description:
        "Agent id to inspect for action=agent. Defaults to the current requester agent when available.",
    }),
  ),
  agentIds: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description:
        "Governance agent ids for capability_inventory, genesis_plan, or proposals_synthesize. Defaults to the full charter scope.",
    }),
  ),
  workspaceDirs: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description:
        "Explicit workspace directories for capability_inventory, genesis_plan, or proposals_synthesize when governance capability scope must be constrained.",
    }),
  ),
  teamId: Type.Optional(
    Type.String({
      description: "Governed team id for team or genesis_plan.",
    }),
  ),
  proposalId: Type.Optional(Type.String()),
  proposalIds: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      description:
        "Explicit governance proposal ids for batch review/apply/revert actions.",
    }),
  ),
  title: Type.Optional(Type.String()),
  rationale: Type.Optional(Type.String()),
  status: Type.Optional(
    Type.Union([
      Type.Literal("pending"),
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("applied"),
    ]),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal("apply_safe"), Type.Literal("force_apply_all")]),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
  operations: Type.Optional(
    Type.Array(
      Type.Object(
        {
          kind: Type.Union([Type.Literal("write"), Type.Literal("delete")]),
          path: Type.String(),
          content: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  ),
  decision: Type.Optional(Type.Union([Type.Literal("approve"), Type.Literal("reject")])),
  decisionNote: Type.Optional(Type.String()),
  continueOnError: Type.Optional(Type.Boolean()),
  createdByAgentId: Type.Optional(Type.String()),
  createdBySessionKey: Type.Optional(Type.String()),
  decidedBy: Type.Optional(Type.String()),
  appliedBy: Type.Optional(Type.String()),
  revertedBy: Type.Optional(Type.String()),
});

function resolveRequesterAgentId(sessionKey?: string): string | undefined {
  return sessionKey?.trim() ? parseAgentSessionKey(sessionKey)?.agentId : undefined;
}

function readProposalOperationsParam(params: Record<string, unknown>) {
  const raw = params.operations;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ToolInputError("operations required");
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ToolInputError(`operations[${index}] invalid`);
    }
    const kind = "kind" in entry ? entry.kind : undefined;
    const targetPath = "path" in entry ? entry.path : undefined;
    const content = "content" in entry ? entry.content : undefined;
    if ((kind !== "write" && kind !== "delete") || typeof targetPath !== "string") {
      throw new ToolInputError(`operations[${index}] invalid`);
    }
    if (kind === "write" && typeof content !== "string") {
      throw new ToolInputError(`operations[${index}].content required`);
    }
    return {
      kind,
      path: targetPath,
      ...(typeof content === "string" ? { content } : {}),
    };
  });
}

function resolveAgentIdsParam(params: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(params.agentIds)) {
    return undefined;
  }
  const agentIds = params.agentIds.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return agentIds.length > 0 ? agentIds : undefined;
}

function resolveProposalIdsParam(params: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(params.proposalIds)) {
    return undefined;
  }
  const proposalIds = params.proposalIds.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return proposalIds.length > 0 ? proposalIds : undefined;
}

function resolveWorkspaceDirsParam(
  params: Record<string, unknown>,
  defaultWorkspaceDir?: string,
): string[] | undefined {
  if (Array.isArray(params.workspaceDirs)) {
    const workspaceDirs = params.workspaceDirs.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    if (workspaceDirs.length > 0) {
      return workspaceDirs;
    }
  }
  const normalizedWorkspaceDir = defaultWorkspaceDir?.trim();
  return normalizedWorkspaceDir ? [normalizedWorkspaceDir] : undefined;
}

export function createGovernanceTool(opts?: {
  agentSessionKey?: string;
  workspaceDir?: string;
}): AnyAgentTool {
  return {
    label: "Governance",
    name: "governance",
    displaySummary: GOVERNANCE_TOOL_DISPLAY_SUMMARY,
    description: describeGovernanceTool(),
    parameters: GovernanceToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", {
        required: true,
      });
      const requesterAgentId = resolveRequesterAgentId(opts?.agentSessionKey);

      if (action === "overview") {
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          overview: getGovernanceOverview(),
        });
      }

      if (action === "capability_inventory") {
        const agentIds = resolveAgentIdsParam(params);
        const workspaceDirs = resolveWorkspaceDirsParam(params, opts?.workspaceDir);
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          capabilityInventory: getGovernanceCapabilityInventory({
            ...(agentIds?.length ? { agentIds } : {}),
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          }),
        });
      }

      if (action === "asset_registry") {
        const agentIds = resolveAgentIdsParam(params);
        const workspaceDirs = resolveWorkspaceDirsParam(params, opts?.workspaceDir);
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          assetRegistry: getGovernanceCapabilityAssetRegistry({
            ...(agentIds?.length ? { agentIds } : {}),
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          }),
        });
      }

      if (action === "genesis_plan") {
        const agentIds = resolveAgentIdsParam(params);
        const workspaceDirs = resolveWorkspaceDirsParam(params, opts?.workspaceDir);
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          genesisPlan: getGovernanceGenesisPlan({
            ...(agentIds?.length ? { agentIds } : {}),
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
            ...(typeof params.teamId === "string" ? { teamId: params.teamId } : {}),
          }),
        });
      }

      if (action === "proposals_list") {
        const status = readStringParam(params, "status");
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalLedger: await listGovernanceProposals({
            ...(status ? { status: status as "pending" | "approved" | "rejected" | "applied" } : {}),
            ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
          }),
        });
      }

      if (action === "proposals_synthesize") {
        const agentIds = resolveAgentIdsParam(params);
        const workspaceDirs = resolveWorkspaceDirsParam(params, opts?.workspaceDir);
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalSynthesis: await synthesizeGovernanceProposals({
            ...(agentIds?.length ? { agentIds } : {}),
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
          }),
        });
      }

      if (action === "proposals_reconcile") {
        const agentIds = resolveAgentIdsParam(params);
        const workspaceDirs = resolveWorkspaceDirsParam(params, opts?.workspaceDir);
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalReconciled: await reconcileGovernanceProposals({
            ...(agentIds?.length ? { agentIds } : {}),
            ...(workspaceDirs?.length ? { workspaceDirs } : {}),
            ...(readStringParam(params, "mode")
              ? {
                  mode: readStringParam(params, "mode") as
                    | "apply_safe"
                    | "force_apply_all",
                }
              : {}),
            createdByAgentId: readStringParam(params, "createdByAgentId") ?? requesterAgentId,
            createdBySessionKey:
              readStringParam(params, "createdBySessionKey") ?? opts?.agentSessionKey,
            ...(readStringParam(params, "decidedBy")
              ? { decidedBy: readStringParam(params, "decidedBy") }
              : {}),
            ...(readStringParam(params, "decisionNote")
              ? { decisionNote: readStringParam(params, "decisionNote") }
              : {}),
            ...(readStringParam(params, "appliedBy")
              ? { appliedBy: readStringParam(params, "appliedBy") }
              : {}),
          }),
        });
      }

      if (action === "proposal_create") {
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalCreated: await createGovernanceProposal({
            title: readStringParam(params, "title", {
              required: true,
            }),
            rationale: readStringParam(params, "rationale"),
            createdByAgentId: readStringParam(params, "createdByAgentId") ?? requesterAgentId,
            createdBySessionKey: readStringParam(params, "createdBySessionKey") ?? opts?.agentSessionKey,
            operations: readProposalOperationsParam(params),
          }),
        });
      }

      const agentId = readStringParam(params, "agentId") ?? requesterAgentId;
      if (action === "agent") {
        if (!agentId) {
          throw new ToolInputError("agentId required");
        }
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          agent: getGovernanceAgent({
            agentId,
          }),
        });
      }

      if (action === "team") {
        const teamId = readStringParam(params, "teamId");
        if (!teamId) {
          throw new ToolInputError("teamId required");
        }
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          team: getGovernanceTeam({
            teamId,
          }),
        });
      }

      if (action === "proposal_review") {
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalReviewed: await reviewGovernanceProposal({
            proposalId: readStringParam(params, "proposalId", {
              required: true,
            }),
            decision: readStringParam(params, "decision", {
              required: true,
            }) as "approve" | "reject",
            decidedBy:
              readStringParam(params, "decidedBy") ?? requesterAgentId ?? "governance-tool",
            decidedByType: "agent",
            decisionNote: readStringParam(params, "decisionNote"),
          }),
        });
      }

      if (action === "proposals_review_many") {
        const proposalIds = resolveProposalIdsParam(params);
        const status = readStringParam(params, "status");
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalsReviewed: await reviewGovernanceProposals({
            ...(proposalIds?.length ? { proposalIds } : {}),
            ...(status
              ? { status: status as "pending" | "approved" | "rejected" | "applied" }
              : {}),
            ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
            decision: readStringParam(params, "decision", {
              required: true,
            }) as "approve" | "reject",
            decidedBy:
              readStringParam(params, "decidedBy") ?? requesterAgentId ?? "governance-tool",
            decidedByType: "agent",
            decisionNote: readStringParam(params, "decisionNote"),
            ...(typeof params.continueOnError === "boolean"
              ? { continueOnError: params.continueOnError }
              : {}),
          }),
        });
      }

      if (action === "proposal_apply") {
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalApplied: await applyGovernanceProposal({
            proposalId: readStringParam(params, "proposalId", {
              required: true,
            }),
            appliedBy:
              readStringParam(params, "appliedBy") ?? requesterAgentId ?? "governance-tool",
            appliedByType: "agent",
          }),
        });
      }

      if (action === "proposals_apply_many") {
        const proposalIds = resolveProposalIdsParam(params);
        const status = readStringParam(params, "status");
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalsApplied: await applyGovernanceProposals({
            ...(proposalIds?.length ? { proposalIds } : {}),
            ...(status
              ? { status: status as "pending" | "approved" | "rejected" | "applied" }
              : {}),
            ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
            appliedBy:
              readStringParam(params, "appliedBy") ?? requesterAgentId ?? "governance-tool",
            appliedByType: "agent",
            ...(typeof params.continueOnError === "boolean"
              ? { continueOnError: params.continueOnError }
              : {}),
          }),
        });
      }

      if (action === "proposal_revert") {
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalReverted: await revertGovernanceProposalApply({
            proposalId: readStringParam(params, "proposalId", {
              required: true,
            }),
            revertedBy:
              readStringParam(params, "revertedBy") ?? requesterAgentId ?? "governance-tool",
          }),
        });
      }

      if (action === "proposals_revert_many") {
        const proposalIds = resolveProposalIdsParam(params);
        const status = readStringParam(params, "status");
        return jsonResult({
          action,
          ...(requesterAgentId ? { requesterAgentId } : {}),
          proposalsReverted: await revertGovernanceProposalApplies({
            ...(proposalIds?.length ? { proposalIds } : {}),
            ...(status
              ? { status: status as "pending" | "approved" | "rejected" | "applied" }
              : {}),
            ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
            revertedBy:
              readStringParam(params, "revertedBy") ?? requesterAgentId ?? "governance-tool",
            ...(typeof params.continueOnError === "boolean"
              ? { continueOnError: params.continueOnError }
              : {}),
          }),
        });
      }

      throw new ToolInputError(`Unknown governance action "${action}".`);
    },
  };
}
