import { formatErrorMessage } from "../../infra/errors.js";
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
  ErrorCodes,
  errorShape,
  validateGovernanceAgentParams,
  validateGovernanceCapabilityAssetRegistryParams,
  validateGovernanceCapabilityInventoryParams,
  validateGovernanceGenesisPlanParams,
  validateGovernanceOverviewParams,
  validateGovernanceTeamParams,
  validateGovernanceProposalsApplyParams,
  validateGovernanceProposalsApplyManyParams,
  validateGovernanceProposalsCreateParams,
  validateGovernanceProposalsListParams,
  validateGovernanceProposalsReconcileParams,
  validateGovernanceProposalsRevertParams,
  validateGovernanceProposalsRevertManyParams,
  validateGovernanceProposalsReviewParams,
  validateGovernanceProposalsReviewManyParams,
  validateGovernanceProposalsSynthesizeParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";
import { assertValidParams } from "./validation.js";

function respondGovernanceFailure(respond: RespondFn, error: unknown) {
  const message = formatErrorMessage(error) || "governance operation failed";
  const code = /not found|must be|already|required|invalid|unsupported|exists|escape/i.test(message)
    ? ErrorCodes.INVALID_REQUEST
    : ErrorCodes.UNAVAILABLE;
  respond(false, undefined, errorShape(code, message));
}

export const governanceHandlers: GatewayRequestHandlers = {
  "governance.overview": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceOverviewParams,
        "governance.overview",
        respond,
      )
    ) {
      return;
    }
    respond(true, getGovernanceOverview(), undefined);
  },
  "governance.agent": ({ params, respond }) => {
    if (!assertValidParams(params, validateGovernanceAgentParams, "governance.agent", respond)) {
      return;
    }
    respond(
      true,
      getGovernanceAgent({
        agentId: params.agentId,
      }),
      undefined,
    );
  },
  "governance.team": ({ params, respond }) => {
    if (!assertValidParams(params, validateGovernanceTeamParams, "governance.team", respond)) {
      return;
    }
    respond(
      true,
      getGovernanceTeam({
        teamId: params.teamId,
      }),
      undefined,
    );
  },
  "governance.capability.inventory": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceCapabilityInventoryParams,
        "governance.capability.inventory",
        respond,
      )
    ) {
      return;
    }
    respond(
      true,
      getGovernanceCapabilityInventory({
        ...(Array.isArray(params.agentIds) ? { agentIds: params.agentIds } : {}),
        ...(Array.isArray(params.workspaceDirs) ? { workspaceDirs: params.workspaceDirs } : {}),
      }),
      undefined,
    );
  },
  "governance.capability.assetRegistry": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceCapabilityAssetRegistryParams,
        "governance.capability.assetRegistry",
        respond,
      )
    ) {
      return;
    }
    respond(
      true,
      getGovernanceCapabilityAssetRegistry({
        ...(Array.isArray(params.agentIds) ? { agentIds: params.agentIds } : {}),
        ...(Array.isArray(params.workspaceDirs) ? { workspaceDirs: params.workspaceDirs } : {}),
      }),
      undefined,
    );
  },
  "governance.genesis.plan": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceGenesisPlanParams,
        "governance.genesis.plan",
        respond,
      )
    ) {
      return;
    }
    respond(
      true,
      getGovernanceGenesisPlan({
        ...(Array.isArray(params.agentIds) ? { agentIds: params.agentIds } : {}),
        ...(typeof params.teamId === "string" ? { teamId: params.teamId } : {}),
        ...(Array.isArray(params.workspaceDirs) ? { workspaceDirs: params.workspaceDirs } : {}),
      }),
      undefined,
    );
  },
  "governance.proposals.list": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsListParams,
        "governance.proposals.list",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await listGovernanceProposals({
          ...(params.status ? { status: params.status } : {}),
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.synthesize": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsSynthesizeParams,
        "governance.proposals.synthesize",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await synthesizeGovernanceProposals({
          ...(Array.isArray(params.agentIds) ? { agentIds: params.agentIds } : {}),
          ...(Array.isArray(params.workspaceDirs) ? { workspaceDirs: params.workspaceDirs } : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.reconcile": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsReconcileParams,
        "governance.proposals.reconcile",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await reconcileGovernanceProposals({
          ...(Array.isArray(params.agentIds) ? { agentIds: params.agentIds } : {}),
          ...(Array.isArray(params.workspaceDirs) ? { workspaceDirs: params.workspaceDirs } : {}),
          ...(typeof params.mode === "string" ? { mode: params.mode } : {}),
          ...(typeof params.createdByAgentId === "string"
            ? { createdByAgentId: params.createdByAgentId }
            : {}),
          ...(typeof params.createdBySessionKey === "string"
            ? { createdBySessionKey: params.createdBySessionKey }
            : {}),
          ...(typeof params.decidedBy === "string" ? { decidedBy: params.decidedBy } : {}),
          ...(typeof params.decisionNote === "string"
            ? { decisionNote: params.decisionNote }
            : {}),
          ...(typeof params.appliedBy === "string" ? { appliedBy: params.appliedBy } : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.create": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsCreateParams,
        "governance.proposals.create",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await createGovernanceProposal({
          title: params.title,
          rationale: params.rationale,
          createdByAgentId: params.createdByAgentId,
          createdBySessionKey: params.createdBySessionKey,
          operations: params.operations.map((entry) => ({
            kind: entry.kind,
            path: entry.path,
            ...(typeof entry.content === "string" ? { content: entry.content } : {}),
          })),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.review": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsReviewParams,
        "governance.proposals.review",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await reviewGovernanceProposal({
          proposalId: params.proposalId,
          decision: params.decision,
          decidedBy: params.decidedBy,
          decisionNote: params.decisionNote,
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.reviewMany": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsReviewManyParams,
        "governance.proposals.reviewMany",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await reviewGovernanceProposals({
          ...(Array.isArray(params.proposalIds) ? { proposalIds: params.proposalIds } : {}),
          ...(typeof params.status === "string" ? { status: params.status } : {}),
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
          decision: params.decision,
          decidedBy: params.decidedBy,
          ...(typeof params.decisionNote === "string" ? { decisionNote: params.decisionNote } : {}),
          ...(typeof params.continueOnError === "boolean"
            ? { continueOnError: params.continueOnError }
            : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.apply": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsApplyParams,
        "governance.proposals.apply",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await applyGovernanceProposal({
          proposalId: params.proposalId,
          appliedBy: params.appliedBy,
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.applyMany": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsApplyManyParams,
        "governance.proposals.applyMany",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await applyGovernanceProposals({
          ...(Array.isArray(params.proposalIds) ? { proposalIds: params.proposalIds } : {}),
          ...(typeof params.status === "string" ? { status: params.status } : {}),
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
          appliedBy: params.appliedBy,
          ...(typeof params.continueOnError === "boolean"
            ? { continueOnError: params.continueOnError }
            : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.revert": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsRevertParams,
        "governance.proposals.revert",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await revertGovernanceProposalApply({
          proposalId: params.proposalId,
          revertedBy: params.revertedBy,
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
  "governance.proposals.revertMany": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateGovernanceProposalsRevertManyParams,
        "governance.proposals.revertMany",
        respond,
      )
    ) {
      return;
    }
    try {
      respond(
        true,
        await revertGovernanceProposalApplies({
          ...(Array.isArray(params.proposalIds) ? { proposalIds: params.proposalIds } : {}),
          ...(typeof params.status === "string" ? { status: params.status } : {}),
          ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
          revertedBy: params.revertedBy,
          ...(typeof params.continueOnError === "boolean"
            ? { continueOnError: params.continueOnError }
            : {}),
        }),
        undefined,
      );
    } catch (error) {
      respondGovernanceFailure(respond, error);
    }
  },
};
