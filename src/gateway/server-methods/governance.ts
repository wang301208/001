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

/**
 * 将后端 GovernanceOverviewResult 适配为前端友好的 GovernanceStatus 格式
 */
function adaptGovernanceOverviewForFrontend(overview: any): any {
  // 提取代理节点
  const activeAgents = extractActiveAgentsFromOrganization(overview.organization);
  
  // 提取演化项目（从提案中）
  const evolutionProjects = extractEvolutionProjectsFromProposals(overview.proposals);
  
  // 加载沙盒实验（简化版本，实际需要从 sandbox-universe 读取）
  const sandboxExperiments: any[] = [];
  
  // 构建冻结状态
  const freezeStatus = overview.enforcement?.active
    ? {
        active: true,
        reason: overview.enforcement.reasonCode || 'enforcement_active',
        activatedAt: overview.observedAt,
        affectedSubsystems: overview.enforcement.freezeTargets || [],
      }
    : undefined;
  
  return {
    sovereigntyBoundary: !overview.sovereignty?.open || overview.sovereignty.open === 0,
    activeAgents,
    evolutionProjects,
    sandboxExperiments,
    freezeActive: overview.enforcement?.active || false,
    freezeStatus,
  };
}

/**
 * 从组织信息中提取活跃的代理节点
 */
function extractActiveAgentsFromOrganization(organization: any): any[] {
  if (!organization || !organization.agents) {
    return [];
  }
  
  return organization.agents.map((agent: any) => ({
    id: agent.id,
    name: agent.title || agent.name || agent.id,
    role: agent.layer || agent.role || 'unknown',
    status: agent.governance?.freezeActive ? 'frozen' : 'active',
  }));
}

/**
 * 从提案账本中提取演化项目
 */
function extractEvolutionProjectsFromProposals(proposals: any): any[] {
  if (!proposals || !proposals.items) {
    return [];
  }
  
  return proposals.items
    .filter((p: any) => p.type === 'evolution' || p.category === 'evolution' || isEvolutionProposal(p))
    .map((p: any) => ({
      id: p.id,
      title: p.title || 'Untitled Proposal',
      mutationClass: p.mutationClass || mapProposalTypeToMutationClass(p.type || p.category),
      status: mapProposalStatusToProjectStatus(p.status),
      progress: calculateProjectProgress(p.status),
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt,
    }));
}

/**
 * 判断是否为演化类提案
 */
function isEvolutionProposal(proposal: any): boolean {
  const evolutionKeywords = ['evolution', 'mutation', 'upgrade', 'migrate', 'refactor'];
  const title = (proposal.title || '').toLowerCase();
  const description = (proposal.description || '').toLowerCase();
  
  return evolutionKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  );
}

/**
 * 将提案类型映射为变异类别
 */
function mapProposalTypeToMutationClass(type: string): string {
  const typeMap: Record<string, string> = {
    'evolution': 'evolution',
    'mutation': 'mutation',
    'upgrade': 'upgrade',
    'migration': 'migration',
    'refactor': 'refactor',
  };
  return typeMap[type] || 'general';
}

/**
 * 将提案状态映射为项目状态
 */
function mapProposalStatusToProjectStatus(proposalStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'proposed',
    'approved': 'running',
    'applied': 'completed',
    'rejected': 'failed',
  };
  return statusMap[proposalStatus] || 'proposed';
}

/**
 * 根据提案状态计算项目进度
 */
function calculateProjectProgress(proposalStatus: string): number {
  switch (proposalStatus) {
    case 'pending': return 0;
    case 'approved': return 50;
    case 'applied': return 100;
    case 'rejected': return 0;
    default: return 0;
  }
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
    
    const overview = getGovernanceOverview();
    // 使用适配器转换为前端友好的格式
    const adapted = adaptGovernanceOverviewForFrontend(overview);
    respond(true, adapted, undefined);
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
