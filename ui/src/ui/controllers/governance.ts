import { normalizeAgentId } from "../session-key.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  GovernanceAgentResult,
  GovernanceCapabilityAssetRegistryResult,
  GovernanceCapabilityInventoryResult,
  GovernanceGenesisPlanResult,
  GovernanceOverviewResult,
  GovernanceProposalOperation,
  GovernanceProposalsApplyManyResult,
  GovernanceProposalsApplyResult,
  GovernanceProposalsCreateResult,
  GovernanceProposalsListResult,
  GovernanceProposalsReconcileResult,
  GovernanceProposalsRevertManyResult,
  GovernanceProposalsRevertResult,
  GovernanceProposalsReviewManyResult,
  GovernanceProposalsReviewResult,
  GovernanceProposalsSynthesizeResult,
  GovernanceTeamResult,
} from "../types.ts";
import {
  formatMissingOperatorControlScopeMessage,
  formatMissingOperatorReadScopeMessage,
  isMissingOperatorControlScopeError,
  isMissingOperatorReadScopeError,
} from "./scope-errors.ts";

export type GovernanceProposalStatusFilter = "" | "pending" | "approved" | "rejected" | "applied";
export type GovernanceProposalDecision = "approve" | "reject";
export type GovernanceProposalReconcileMode = "apply_safe" | "force_apply_all";

const GOVERNANCE_PROPOSAL_BATCH_BUSY_ID = "__batch__";

export type GovernanceState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  governanceOverviewLoading: boolean;
  governanceOverviewError: string | null;
  governanceOverviewResult: GovernanceOverviewResult | null;
  governanceAssetRegistryLoading: boolean;
  governanceAssetRegistryLoadingKey?: string | null;
  governanceAssetRegistryError: string | null;
  governanceAssetRegistryResult: GovernanceCapabilityAssetRegistryResult | null;
  governanceCapabilitiesLoading: boolean;
  governanceCapabilitiesLoadingKey?: string | null;
  governanceCapabilitiesError: string | null;
  governanceCapabilitiesResult: GovernanceCapabilityInventoryResult | null;
  governanceGenesisLoading: boolean;
  governanceGenesisLoadingKey?: string | null;
  governanceGenesisError: string | null;
  governanceGenesisResult: GovernanceGenesisPlanResult | null;
  governanceAgentLoading: boolean;
  governanceAgentLoadingId?: string | null;
  governanceAgentError: string | null;
  governanceAgentResult: GovernanceAgentResult | null;
  governanceTeamLoading: boolean;
  governanceTeamLoadingId?: string | null;
  governanceTeamError: string | null;
  governanceTeamResult: GovernanceTeamResult | null;
  governanceProposalsLoading: boolean;
  governanceProposalsLoadingKey?: string | null;
  governanceProposalsResultKey?: string | null;
  governanceProposalsError: string | null;
  governanceProposalsResult: GovernanceProposalsListResult | null;
  governanceProposalSynthesizeBusy?: boolean;
  governanceProposalSynthesizeError: string | null;
  governanceProposalSynthesizeResult: GovernanceProposalsSynthesizeResult | null;
  governanceProposalReconcileBusy?: boolean;
  governanceProposalReconcileError: string | null;
  governanceProposalReconcileResult: GovernanceProposalsReconcileResult | null;
  governanceProposalCreateBusy?: boolean;
  governanceProposalCreateError: string | null;
  governanceProposalCreateResult: GovernanceProposalsCreateResult | null;
  governanceProposalActionBusyId?: string | null;
  governanceProposalActionError: string | null;
  agentsSelectedId?: string | null;
  agentsPanel?:
    | "overview"
    | "files"
    | "tools"
    | "skills"
    | "channels"
    | "cron"
    | "governance"
    | "autonomy";
};

function hasSelectedAgentMismatch(state: GovernanceState, agentId: string): boolean {
  return Boolean(state.agentsSelectedId && state.agentsSelectedId !== agentId);
}

function resolveGovernanceErrorMessage(
  err: unknown,
  target:
    | "governance overview"
    | "governance asset registry"
    | "governance capabilities"
    | "governance genesis"
    | "governance agent"
    | "governance team"
    | "governance proposals"
    | "governance control",
): string {
  if (target === "governance control" && isMissingOperatorControlScopeError(err)) {
    return formatMissingOperatorControlScopeMessage(target);
  }
  return isMissingOperatorReadScopeError(err)
    ? formatMissingOperatorReadScopeMessage(target)
    : String(err);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeGovernanceProposalPath(value: string, label = "operation.path"): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} required.`);
  }
  const posixInput = normalized.replace(/\\/gu, "/");
  const stripped = posixInput.startsWith("governance/charter/")
    ? posixInput.slice("governance/charter/".length)
    : posixInput;
  if (!stripped || stripped.startsWith("/")) {
    throw new Error(`${label} must stay within governance/charter.`);
  }
  const segments = stripped.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`${label} must stay within governance/charter.`);
  }
  return segments.join("/");
}

function normalizeGovernanceProposalOperation(
  value: unknown,
  index: number,
): GovernanceProposalOperation {
  if (!isRecord(value)) {
    throw new Error(`Proposal operation at index ${index} must be an object.`);
  }
  const kind = value.kind;
  if (kind !== "write" && kind !== "delete") {
    throw new Error(`Proposal operation kind at index ${index} must be write or delete.`);
  }
  if (typeof value.path !== "string") {
    throw new Error(`Proposal operation path at index ${index} must be a string.`);
  }
  const path = normalizeGovernanceProposalPath(value.path, `operation.path at index ${index}`);
  if (kind === "write") {
    if (typeof value.content !== "string") {
      throw new Error(`Write proposal operation at index ${index} requires string content.`);
    }
    return {
      kind,
      path,
      content: value.content,
    };
  }
  return {
    kind,
    path,
  };
}

export function parseGovernanceProposalOperationsDraft(value: string): GovernanceProposalOperation[] {
  const raw = value.trim();
  if (!raw) {
    throw new Error("Proposal operations JSON required.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Proposal operations JSON must be valid JSON.");
  }
  const entries =
    Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.operations) ? parsed.operations : null;
  if (!entries || entries.length === 0) {
    throw new Error("Proposal operations must be a non-empty array.");
  }
  return entries.map((entry, index) => normalizeGovernanceProposalOperation(entry, index));
}

export function buildGovernanceProposalOperationsDraftTemplate(agentId?: string): string {
  const normalizedAgentId = normalizeAgentId(agentId || "draft") || "draft";
  return JSON.stringify(
    [
      {
        kind: "write",
        path: `agents/${normalizedAgentId}.yaml`,
        content: `version: 1\nagent:\n  id: "${normalizedAgentId}"\n`,
      },
    ],
    null,
    2,
  );
}

export function resetGovernanceState(state: GovernanceState, clearLoading = false) {
  state.governanceOverviewError = null;
  state.governanceOverviewResult = null;
  state.governanceAssetRegistryError = null;
  state.governanceAssetRegistryResult = null;
  state.governanceCapabilitiesError = null;
  state.governanceCapabilitiesResult = null;
  state.governanceGenesisError = null;
  state.governanceGenesisResult = null;
  state.governanceAgentError = null;
  state.governanceAgentResult = null;
  state.governanceTeamError = null;
  state.governanceTeamResult = null;
  state.governanceProposalsError = null;
  state.governanceProposalsResult = null;
  state.governanceProposalsResultKey = null;
  state.governanceProposalSynthesizeError = null;
  state.governanceProposalSynthesizeResult = null;
  state.governanceProposalReconcileError = null;
  state.governanceProposalReconcileResult = null;
  state.governanceProposalCreateError = null;
  state.governanceProposalCreateResult = null;
  state.governanceProposalActionError = null;
  if (clearLoading) {
    state.governanceOverviewLoading = false;
    state.governanceAssetRegistryLoading = false;
    state.governanceAssetRegistryLoadingKey = null;
    state.governanceCapabilitiesLoading = false;
    state.governanceCapabilitiesLoadingKey = null;
    state.governanceGenesisLoading = false;
    state.governanceGenesisLoadingKey = null;
    state.governanceAgentLoading = false;
    state.governanceAgentLoadingId = null;
    state.governanceTeamLoading = false;
    state.governanceTeamLoadingId = null;
    state.governanceProposalsLoading = false;
    state.governanceProposalsLoadingKey = null;
    state.governanceProposalSynthesizeBusy = false;
    state.governanceProposalReconcileBusy = false;
    state.governanceProposalCreateBusy = false;
    state.governanceProposalActionBusyId = null;
  }
}

function buildGovernanceProposalsRequestKey(params?: {
  status?: Exclude<GovernanceProposalStatusFilter, "">;
  limit?: number;
}): string {
  const statusKey = params?.status ?? "all";
  const limitKey = typeof params?.limit === "number" ? String(params.limit) : "default";
  return `${statusKey}:${limitKey}`;
}

function normalizeRequestedAgentIds(agentIds?: string[]): string[] {
  return Array.from(
    new Set((agentIds ?? []).map((entry) => normalizeAgentId(entry)).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function normalizeGovernanceProposalIds(proposalIds?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const proposalId of proposalIds ?? []) {
    const trimmed = proposalId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeWorkspaceDirs(workspaceDirs?: string[]): string[] {
  return Array.from(
    new Set((workspaceDirs ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

export function parseGovernanceAgentIdsDraft(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  return normalizeRequestedAgentIds(value.split(/[\r\n,]+/));
}

export function formatGovernanceAgentIdsDraft(agentIds?: string[]): string {
  return normalizeRequestedAgentIds(agentIds).join("\n");
}

export function parseGovernanceWorkspaceDirsDraft(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  return normalizeWorkspaceDirs(value.split(/[\r\n,]+/));
}

export function formatGovernanceWorkspaceDirsDraft(workspaceDirs?: string[]): string {
  return normalizeWorkspaceDirs(workspaceDirs).join("\n");
}

export function parseGovernanceListLimitDraft(value?: string | null): number | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildGovernanceFleetRequestKey(params: {
  kind: "assetRegistry" | "capabilities" | "genesis";
  agentIds?: string[];
  teamId?: string | null;
  workspaceDirs?: string[];
}): string {
  return JSON.stringify({
    kind: params.kind,
    agentIds: normalizeRequestedAgentIds(params.agentIds),
    teamId: params.teamId?.trim() || "",
    workspaceDirs: normalizeWorkspaceDirs(params.workspaceDirs),
  });
}

function resolveSelectedGovernanceAgentIds(state: GovernanceState): string[] | undefined {
  const agentId = normalizeAgentId(state.agentsSelectedId ?? "");
  return agentId ? [agentId] : undefined;
}

function normalizeGovernanceTeamId(teamId?: string | null): string {
  return teamId?.trim() ?? "";
}

export async function loadGovernanceOverview(state: GovernanceState) {
  if (!state.client || !state.connected || state.governanceOverviewLoading) {
    return;
  }

  state.governanceOverviewLoading = true;
  state.governanceOverviewError = null;
  try {
    const result = await state.client.request<GovernanceOverviewResult>("governance.overview", {});
    state.governanceOverviewResult = result;
  } catch (err) {
    state.governanceOverviewError = resolveGovernanceErrorMessage(err, "governance overview");
  } finally {
    state.governanceOverviewLoading = false;
  }
}

export async function loadGovernanceCapabilityInventory(
  state: GovernanceState,
  params?: { agentIds?: string[]; workspaceDirs?: string[] },
) {
  const requestKey = buildGovernanceFleetRequestKey({
    kind: "capabilities",
    agentIds: params?.agentIds,
    workspaceDirs: params?.workspaceDirs,
  });
  if (
    !state.client ||
    !state.connected ||
    state.governanceCapabilitiesLoadingKey === requestKey
  ) {
    return;
  }

  const shouldIgnoreResponse = () => state.governanceCapabilitiesLoadingKey !== requestKey;

  state.governanceCapabilitiesLoading = true;
  state.governanceCapabilitiesLoadingKey = requestKey;
  state.governanceCapabilitiesError = null;
  try {
    const result = await state.client.request<GovernanceCapabilityInventoryResult>(
      "governance.capability.inventory",
      {
        ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceCapabilitiesResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceCapabilitiesError = resolveGovernanceErrorMessage(
      err,
      "governance capabilities",
    );
  } finally {
    if (state.governanceCapabilitiesLoadingKey === requestKey) {
      state.governanceCapabilitiesLoading = false;
      state.governanceCapabilitiesLoadingKey = null;
    }
  }
}

export async function loadGovernanceCapabilityAssetRegistry(
  state: GovernanceState,
  params?: { agentIds?: string[]; workspaceDirs?: string[] },
) {
  const requestKey = buildGovernanceFleetRequestKey({
    kind: "assetRegistry",
    agentIds: params?.agentIds,
    workspaceDirs: params?.workspaceDirs,
  });
  if (
    !state.client ||
    !state.connected ||
    state.governanceAssetRegistryLoadingKey === requestKey
  ) {
    return;
  }

  const shouldIgnoreResponse = () => state.governanceAssetRegistryLoadingKey !== requestKey;

  state.governanceAssetRegistryLoading = true;
  state.governanceAssetRegistryLoadingKey = requestKey;
  state.governanceAssetRegistryError = null;
  try {
    const result = await state.client.request<GovernanceCapabilityAssetRegistryResult>(
      "governance.capability.assetRegistry",
      {
        ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceAssetRegistryResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceAssetRegistryError = resolveGovernanceErrorMessage(
      err,
      "governance asset registry",
    );
  } finally {
    if (state.governanceAssetRegistryLoadingKey === requestKey) {
      state.governanceAssetRegistryLoading = false;
      state.governanceAssetRegistryLoadingKey = null;
    }
  }
}

export async function loadGovernanceGenesisPlan(
  state: GovernanceState,
  params?: { agentIds?: string[]; teamId?: string; workspaceDirs?: string[] },
) {
  const requestKey = buildGovernanceFleetRequestKey({
    kind: "genesis",
    agentIds: params?.agentIds,
    teamId: params?.teamId,
    workspaceDirs: params?.workspaceDirs,
  });
  if (!state.client || !state.connected || state.governanceGenesisLoadingKey === requestKey) {
    return;
  }

  const shouldIgnoreResponse = () => state.governanceGenesisLoadingKey !== requestKey;

  state.governanceGenesisLoading = true;
  state.governanceGenesisLoadingKey = requestKey;
  state.governanceGenesisError = null;
  try {
    const result = await state.client.request<GovernanceGenesisPlanResult>(
      "governance.genesis.plan",
      {
        ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params?.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
        ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceGenesisResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceGenesisError = resolveGovernanceErrorMessage(err, "governance genesis");
  } finally {
    if (state.governanceGenesisLoadingKey === requestKey) {
      state.governanceGenesisLoading = false;
      state.governanceGenesisLoadingKey = null;
    }
  }
}

export async function loadGovernanceAgent(
  state: GovernanceState,
  params: { agentId: string },
) {
  const agentId = normalizeAgentId(params.agentId);
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.governanceAgentLoading && state.governanceAgentLoadingId === agentId)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.governanceAgentLoadingId !== agentId || hasSelectedAgentMismatch(state, agentId);

  state.governanceAgentLoading = true;
  state.governanceAgentLoadingId = agentId;
  state.governanceAgentError = null;
  try {
    const result = await state.client.request<GovernanceAgentResult>("governance.agent", {
      agentId,
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceAgentResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceAgentError = resolveGovernanceErrorMessage(err, "governance agent");
  } finally {
    if (state.governanceAgentLoadingId === agentId) {
      state.governanceAgentLoading = false;
      state.governanceAgentLoadingId = null;
    }
  }
}

export async function loadGovernanceTeam(
  state: GovernanceState,
  params: { teamId: string },
) {
  const teamId = normalizeGovernanceTeamId(params.teamId);
  if (
    !state.client ||
    !state.connected ||
    !teamId ||
    (state.governanceTeamLoading && state.governanceTeamLoadingId === teamId)
  ) {
    return;
  }

  const shouldIgnoreResponse = () => state.governanceTeamLoadingId !== teamId;

  state.governanceTeamLoading = true;
  state.governanceTeamLoadingId = teamId;
  state.governanceTeamError = null;
  try {
    const result = await state.client.request<GovernanceTeamResult>("governance.team", {
      teamId,
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceTeamResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceTeamError = resolveGovernanceErrorMessage(err, "governance team");
  } finally {
    if (state.governanceTeamLoadingId === teamId) {
      state.governanceTeamLoading = false;
      state.governanceTeamLoadingId = null;
    }
  }
}

export async function loadGovernanceProposals(
  state: GovernanceState,
  params?: { status?: Exclude<GovernanceProposalStatusFilter, "">; limit?: number },
) {
  const requestKey = buildGovernanceProposalsRequestKey(params);
  if (
    !state.client ||
    !state.connected ||
    (state.governanceProposalsLoading && state.governanceProposalsLoadingKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () => state.governanceProposalsLoadingKey !== requestKey;

  state.governanceProposalsLoading = true;
  state.governanceProposalsLoadingKey = requestKey;
  state.governanceProposalsResultKey = null;
  state.governanceProposalsError = null;
  try {
    const result = await state.client.request<GovernanceProposalsListResult>(
      "governance.proposals.list",
      {
        ...(params?.status ? { status: params.status } : {}),
        ...(typeof params?.limit === "number" ? { limit: params.limit } : {}),
      },
    );
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceProposalsResultKey = requestKey;
    state.governanceProposalsResult = result;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.governanceProposalsError = resolveGovernanceErrorMessage(err, "governance proposals");
  } finally {
    if (state.governanceProposalsLoadingKey === requestKey) {
      state.governanceProposalsLoading = false;
      state.governanceProposalsLoadingKey = null;
    }
  }
}

async function refreshGovernanceWorkbench(
  state: GovernanceState,
  params?: {
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const agentIds =
    params?.agentIds && params.agentIds.length > 0
      ? normalizeRequestedAgentIds(params.agentIds)
      : resolveSelectedGovernanceAgentIds(state);
  await loadGovernanceOverview(state);
  await loadGovernanceCapabilityAssetRegistry(state, {
    ...(agentIds ? { agentIds } : {}),
    ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  await loadGovernanceCapabilityInventory(state, {
    ...(agentIds ? { agentIds } : {}),
    ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  await loadGovernanceGenesisPlan(state, {
    ...(agentIds ? { agentIds } : {}),
    ...(params?.teamId ? { teamId: params.teamId } : {}),
    ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
  });
  const teamId =
    normalizeGovernanceTeamId(params?.teamId) ||
    normalizeGovernanceTeamId(state.governanceGenesisResult?.teamId) ||
    normalizeGovernanceTeamId(state.governanceTeamResult?.teamId);
  if (teamId) {
    await loadGovernanceTeam(state, { teamId });
  }
  await loadGovernanceProposals(state, params);
  const selectedAgentId = state.agentsSelectedId?.trim();
  if (selectedAgentId && state.agentsPanel === "governance") {
    await loadGovernanceAgent(state, {
      agentId: selectedAgentId,
    });
  }
}

export async function createGovernanceProposalEntry(
  state: GovernanceState,
  params: {
    title: string;
    rationale?: string;
    createdByAgentId?: string;
    createdBySessionKey?: string;
    operations: GovernanceProposalOperation[];
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  if (!state.client || !state.connected || state.governanceProposalCreateBusy) {
    return;
  }

  state.governanceProposalCreateBusy = true;
  state.governanceProposalCreateError = null;
  state.governanceProposalCreateResult = null;
  try {
    const result = await state.client.request<GovernanceProposalsCreateResult>(
      "governance.proposals.create",
      {
        title: params.title.trim(),
        ...(params.rationale?.trim() ? { rationale: params.rationale.trim() } : {}),
        ...(params.createdByAgentId?.trim()
          ? { createdByAgentId: normalizeAgentId(params.createdByAgentId.trim()) }
          : {}),
        ...(params.createdBySessionKey?.trim()
          ? { createdBySessionKey: params.createdBySessionKey.trim() }
          : {}),
        operations: params.operations.map((operation, index) =>
          normalizeGovernanceProposalOperation(operation, index),
        ),
      },
    );
    state.governanceProposalCreateResult = result;
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalCreateError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    state.governanceProposalCreateBusy = false;
  }
}

export async function synthesizeGovernanceProposals(
  state: GovernanceState,
  params: {
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  if (!state.client || !state.connected || state.governanceProposalSynthesizeBusy) {
    return;
  }

  state.governanceProposalSynthesizeBusy = true;
  state.governanceProposalSynthesizeError = null;
  state.governanceProposalSynthesizeResult = null;
  try {
    const result = await state.client.request<GovernanceProposalsSynthesizeResult>(
      "governance.proposals.synthesize",
      {
        ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    state.governanceProposalSynthesizeResult = result;
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalSynthesizeError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    state.governanceProposalSynthesizeBusy = false;
  }
}

export async function reconcileGovernanceProposals(
  state: GovernanceState,
  params: {
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
    mode?: GovernanceProposalReconcileMode;
    createdByAgentId?: string;
    createdBySessionKey?: string;
    decidedBy?: string;
    decisionNote?: string;
    appliedBy?: string;
  },
) {
  if (!state.client || !state.connected || state.governanceProposalReconcileBusy) {
    return;
  }

  state.governanceProposalReconcileBusy = true;
  state.governanceProposalReconcileError = null;
  state.governanceProposalReconcileResult = null;
  try {
    const result = await state.client.request<GovernanceProposalsReconcileResult>(
      "governance.proposals.reconcile",
      {
        ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
        ...(params.mode ? { mode: params.mode } : {}),
        ...(params.createdByAgentId?.trim()
          ? { createdByAgentId: params.createdByAgentId.trim() }
          : {}),
        ...(params.createdBySessionKey?.trim()
          ? { createdBySessionKey: params.createdBySessionKey.trim() }
          : {}),
        ...(params.decidedBy?.trim() ? { decidedBy: params.decidedBy.trim() } : {}),
        ...(params.decisionNote?.trim()
          ? { decisionNote: params.decisionNote.trim() }
          : {}),
        ...(params.appliedBy?.trim() ? { appliedBy: params.appliedBy.trim() } : {}),
      },
    );
    state.governanceProposalReconcileResult = result;
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalReconcileError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    state.governanceProposalReconcileBusy = false;
  }
}

export async function reviewGovernanceProposalEntry(
  state: GovernanceState,
  params: {
    proposalId: string;
    decision: GovernanceProposalDecision;
    decidedBy: string;
    decisionNote?: string;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalId = params.proposalId.trim();
  if (
    !state.client ||
    !state.connected ||
    !proposalId ||
    state.governanceProposalActionBusyId === proposalId
  ) {
    return;
  }

  state.governanceProposalActionBusyId = proposalId;
  state.governanceProposalActionError = null;
  try {
    await state.client.request<GovernanceProposalsReviewResult>("governance.proposals.review", {
      proposalId,
      decision: params.decision,
      decidedBy: params.decidedBy,
      ...(params.decisionNote ? { decisionNote: params.decisionNote } : {}),
    });
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === proposalId) {
      state.governanceProposalActionBusyId = null;
    }
  }
}

function summarizeGovernanceBatchFailure(params: {
  action: "review" | "apply" | "revert";
  matchedCount: number;
  failedCount: number;
  stoppedEarly: boolean;
}): string {
  if (params.failedCount <= 0) {
    return "";
  }
  const actionLabel =
    params.action === "review"
      ? "review"
      : params.action === "apply"
        ? "apply"
        : "revert";
  return params.stoppedEarly
    ? `Governance batch ${actionLabel} stopped early after ${params.failedCount}/${params.matchedCount} failure(s).`
    : `Governance batch ${actionLabel} completed with ${params.failedCount}/${params.matchedCount} failure(s).`;
}

export async function reviewGovernanceProposalEntries(
  state: GovernanceState,
  params: {
    proposalIds?: string[];
    decision: GovernanceProposalDecision;
    decidedBy: string;
    decisionNote?: string;
    continueOnError?: boolean;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalIds = normalizeGovernanceProposalIds(params.proposalIds);
  if (
    !state.client ||
    !state.connected ||
    state.governanceProposalActionBusyId ||
    proposalIds.length === 0
  ) {
    return;
  }

  state.governanceProposalActionBusyId = GOVERNANCE_PROPOSAL_BATCH_BUSY_ID;
  state.governanceProposalActionError = null;
  try {
    const result = await state.client.request<GovernanceProposalsReviewManyResult>(
      "governance.proposals.reviewMany",
      {
        proposalIds,
        decision: params.decision,
        decidedBy: params.decidedBy,
        ...(params.decisionNote ? { decisionNote: params.decisionNote } : {}),
        ...(typeof params.continueOnError === "boolean"
          ? { continueOnError: params.continueOnError }
          : {}),
      },
    );
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    state.governanceProposalActionError =
      summarizeGovernanceBatchFailure({
        action: "review",
        matchedCount: result.selection.matchedProposalIds.length,
        failedCount: result.failedCount,
        stoppedEarly: result.stoppedEarly,
      }) || null;
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === GOVERNANCE_PROPOSAL_BATCH_BUSY_ID) {
      state.governanceProposalActionBusyId = null;
    }
  }
}

export async function applyGovernanceProposalEntry(
  state: GovernanceState,
  params: {
    proposalId: string;
    appliedBy: string;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalId = params.proposalId.trim();
  if (
    !state.client ||
    !state.connected ||
    !proposalId ||
    state.governanceProposalActionBusyId === proposalId
  ) {
    return;
  }

  state.governanceProposalActionBusyId = proposalId;
  state.governanceProposalActionError = null;
  try {
    await state.client.request<GovernanceProposalsApplyResult>("governance.proposals.apply", {
      proposalId,
      appliedBy: params.appliedBy,
    });
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === proposalId) {
      state.governanceProposalActionBusyId = null;
    }
  }
}

export async function applyGovernanceProposalEntries(
  state: GovernanceState,
  params: {
    proposalIds?: string[];
    appliedBy: string;
    continueOnError?: boolean;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalIds = normalizeGovernanceProposalIds(params.proposalIds);
  if (
    !state.client ||
    !state.connected ||
    state.governanceProposalActionBusyId ||
    proposalIds.length === 0
  ) {
    return;
  }

  state.governanceProposalActionBusyId = GOVERNANCE_PROPOSAL_BATCH_BUSY_ID;
  state.governanceProposalActionError = null;
  try {
    const result = await state.client.request<GovernanceProposalsApplyManyResult>(
      "governance.proposals.applyMany",
      {
        proposalIds,
        appliedBy: params.appliedBy,
        ...(typeof params.continueOnError === "boolean"
          ? { continueOnError: params.continueOnError }
          : {}),
      },
    );
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    state.governanceProposalActionError =
      summarizeGovernanceBatchFailure({
        action: "apply",
        matchedCount: result.selection.matchedProposalIds.length,
        failedCount: result.failedCount,
        stoppedEarly: result.stoppedEarly,
      }) || null;
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === GOVERNANCE_PROPOSAL_BATCH_BUSY_ID) {
      state.governanceProposalActionBusyId = null;
    }
  }
}

export async function revertGovernanceProposalEntry(
  state: GovernanceState,
  params: {
    proposalId: string;
    revertedBy: string;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalId = params.proposalId.trim();
  if (
    !state.client ||
    !state.connected ||
    !proposalId ||
    state.governanceProposalActionBusyId === proposalId
  ) {
    return;
  }

  state.governanceProposalActionBusyId = proposalId;
  state.governanceProposalActionError = null;
  try {
    await state.client.request<GovernanceProposalsRevertResult>("governance.proposals.revert", {
      proposalId,
      revertedBy: params.revertedBy,
    });
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === proposalId) {
      state.governanceProposalActionBusyId = null;
    }
  }
}

export async function revertGovernanceProposalEntries(
  state: GovernanceState,
  params: {
    proposalIds?: string[];
    revertedBy: string;
    continueOnError?: boolean;
    agentIds?: string[];
    status?: Exclude<GovernanceProposalStatusFilter, "">;
    limit?: number;
    teamId?: string;
    workspaceDirs?: string[];
  },
) {
  const proposalIds = normalizeGovernanceProposalIds(params.proposalIds);
  if (
    !state.client ||
    !state.connected ||
    state.governanceProposalActionBusyId ||
    proposalIds.length === 0
  ) {
    return;
  }

  state.governanceProposalActionBusyId = GOVERNANCE_PROPOSAL_BATCH_BUSY_ID;
  state.governanceProposalActionError = null;
  try {
    const result = await state.client.request<GovernanceProposalsRevertManyResult>(
      "governance.proposals.revertMany",
      {
        proposalIds,
        revertedBy: params.revertedBy,
        ...(typeof params.continueOnError === "boolean"
          ? { continueOnError: params.continueOnError }
          : {}),
      },
    );
    await refreshGovernanceWorkbench(state, {
      ...(params.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(params.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    state.governanceProposalActionError =
      summarizeGovernanceBatchFailure({
        action: "revert",
        matchedCount: result.selection.matchedProposalIds.length,
        failedCount: result.failedCount,
        stoppedEarly: result.stoppedEarly,
      }) || null;
  } catch (err) {
    state.governanceProposalActionError = resolveGovernanceErrorMessage(
      err,
      "governance control",
    );
  } finally {
    if (state.governanceProposalActionBusyId === GOVERNANCE_PROPOSAL_BATCH_BUSY_ID) {
      state.governanceProposalActionBusyId = null;
    }
  }
}
