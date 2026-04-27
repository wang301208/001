import {
  buildAgentMainSessionKey,
  normalizeAgentId,
  resolveAgentIdFromSessionKey,
} from "../session-key.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AutonomyCapabilityInventoryResult,
  AutonomyCancelResult,
  AutonomyGenesisPlanResult,
  AutonomyGovernanceProposalsEnvelope,
  AutonomyGovernanceReconcileResult,
  AutonomyGovernanceProposalsResult,
  AutonomyHealResult,
  AutonomyHistoryResult,
  AutonomyOverviewResult,
  AutonomyLoopRemoveResult,
  AutonomyLoopUpsertResult,
  AutonomyReplaySubmitResult,
  AutonomyShowResult,
  AutonomyStartResult,
  AutonomySuperviseResult,
} from "../types.ts";
import {
  formatMissingOperatorControlScopeMessage,
  formatMissingOperatorReadScopeMessage,
  isMissingOperatorControlScopeError,
  isMissingOperatorReadScopeError,
} from "./scope-errors.ts";

export type AutonomyNotifyPolicy = "" | "done_only" | "state_changes" | "silent";
export type AutonomyFlowStatus = "" | "queued" | "running";
export type AutonomySeedTaskRuntime = "" | "subagent" | "acp" | "cli" | "cron";
export type AutonomySeedTaskStatus = "" | "queued" | "running";
export type AutonomyReplayVerdictDraft = "pass" | "fail";
export type AutonomyHistoryModeFilter = "" | "heal" | "reconcile";
export type AutonomyHistorySourceFilter = "" | "manual" | "startup" | "supervisor";
export type AutonomyGovernanceReconcileMode = "apply_safe" | "force_apply_all";

export type AutonomyState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  autonomyWorkspaceScope?: string;
  autonomyHistoryMode?: AutonomyHistoryModeFilter;
  autonomyHistorySource?: AutonomyHistorySourceFilter;
  autonomyHistoryLimit?: string;
  autonomyLoading: boolean;
  autonomyLoadingKey?: string | null;
  autonomyResultKey?: string | null;
  autonomyError: string | null;
  autonomyResult: AutonomyShowResult | null;
  autonomyOverviewLoading: boolean;
  autonomyOverviewLoadingKey?: string | null;
  autonomyOverviewError: string | null;
  autonomyOverviewResult: AutonomyOverviewResult | null;
  autonomyCapabilitiesLoading: boolean;
  autonomyCapabilitiesLoadingKey?: string | null;
  autonomyCapabilitiesError: string | null;
  autonomyCapabilitiesResult: AutonomyCapabilityInventoryResult | null;
  autonomyGenesisLoading: boolean;
  autonomyGenesisLoadingKey?: string | null;
  autonomyGenesisError: string | null;
  autonomyGenesisResult: AutonomyGenesisPlanResult | null;
  autonomyHistoryLoading: boolean;
  autonomyHistoryLoadingKey?: string | null;
  autonomyHistoryError: string | null;
  autonomyHistoryResult: AutonomyHistoryResult | null;
  autonomyStartBusy: boolean;
  autonomyStartBusyKey?: string | null;
  autonomyStartError: string | null;
  autonomyStartResult: AutonomyStartResult | null;
  autonomyReplayBusy: boolean;
  autonomyReplayBusyKey?: string | null;
  autonomyReplayError: string | null;
  autonomyReplayResult: AutonomyReplaySubmitResult | null;
  autonomyCancelBusy: boolean;
  autonomyCancelBusyKey?: string | null;
  autonomyCancelError: string | null;
  autonomyCancelResult: AutonomyCancelResult | null;
  autonomyLoopBusy: boolean;
  autonomyLoopBusyKey?: string | null;
  autonomyLoopError: string | null;
  autonomyLoopResult: AutonomyLoopUpsertResult | AutonomyLoopRemoveResult | null;
  autonomyHealBusy: boolean;
  autonomyHealError: string | null;
  autonomySuperviseBusy: boolean;
  autonomySuperviseError: string | null;
  autonomySuperviseResult: AutonomySuperviseResult | null;
  autonomyGovernanceBusy: boolean;
  autonomyGovernanceError: string | null;
  autonomyGovernanceResult: AutonomyGovernanceProposalsResult | null;
  autonomyGovernanceReconcileBusy: boolean;
  autonomyGovernanceReconcileError: string | null;
  autonomyGovernanceReconcileResult: AutonomyGovernanceReconcileResult | null;
  autonomyReconcileBusy: boolean;
  autonomyReconcileError: string | null;
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
  sessionKey?: string;
};

export type LoadAutonomyProfileParams = {
  agentId: string;
  sessionKey?: string | null;
};

export type StartAutonomyFlowParams = LoadAutonomyProfileParams & {
  goal?: string;
  controllerId?: string;
  currentStep?: string;
  workspaceDirs?: string[];
  notifyPolicy?: Exclude<AutonomyNotifyPolicy, "">;
  status?: Exclude<AutonomyFlowStatus, "">;
  seedTaskEnabled?: boolean;
  seedTaskRuntime?: Exclude<AutonomySeedTaskRuntime, "">;
  seedTaskStatus?: Exclude<AutonomySeedTaskStatus, "">;
  seedTaskLabel?: string;
  seedTaskTask?: string;
};

export type CancelAutonomyFlowParams = LoadAutonomyProfileParams & {
  flowId?: string;
};

export type SubmitAutonomySandboxReplayParams = LoadAutonomyProfileParams & {
  flowId?: string;
  replayPassed: boolean;
  qaPassed: boolean;
  auditPassed?: boolean;
};

export type UpsertAutonomyLoopParams = LoadAutonomyProfileParams & {
  everyMs?: number;
  workspaceDirs?: string[];
};

export type RemoveAutonomyLoopParams = LoadAutonomyProfileParams & {
  jobId?: string;
};

function hasSelectedAgentMismatch(state: AutonomyState, agentId: string): boolean {
  return Boolean(state.agentsSelectedId && state.agentsSelectedId !== agentId);
}

function resolveAutonomyErrorMessage(
  err: unknown,
  target: "autonomy profile" | "autonomy overview" | "autonomy control",
): string {
  if (target === "autonomy control" && isMissingOperatorControlScopeError(err)) {
    return formatMissingOperatorControlScopeMessage(target);
  }
  return isMissingOperatorReadScopeError(err)
    ? formatMissingOperatorReadScopeMessage(target)
    : String(err);
}

export function resolveAutonomySessionKey(params: LoadAutonomyProfileParams): string {
  const agentId = normalizeAgentId(params.agentId);
  const provided = params.sessionKey?.trim();
  if (provided && resolveAgentIdFromSessionKey(provided) === agentId) {
    return provided;
  }
  return buildAgentMainSessionKey({ agentId });
}

export function buildAutonomyRequestKey(params: LoadAutonomyProfileParams): string {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  return `${agentId}:${sessionKey}`;
}

function normalizeRequestedAgentIds(agentIds?: string[]): string[] {
  return Array.from(
    new Set((agentIds ?? []).map((entry) => normalizeAgentId(entry)).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

function normalizeWorkspaceDirs(workspaceDirs?: string[]): string[] {
  return Array.from(
    new Set((workspaceDirs ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ).toSorted((left, right) => left.localeCompare(right));
}

export function parseAutonomyWorkspaceDirsDraft(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  return normalizeWorkspaceDirs(value.split(/[\r\n,]+/));
}

export function formatAutonomyWorkspaceDirsDraft(workspaceDirs?: string[]): string {
  return normalizeWorkspaceDirs(workspaceDirs).join("\n");
}

export function parseAutonomyHistoryLimitDraft(value?: string | null): number | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildFleetRequestKey(params: {
  kind: "overview" | "capabilities" | "genesis" | "history";
  sessionKey?: string | null;
  agentIds?: string[];
  teamId?: string | null;
  limit?: number;
  mode?: Exclude<AutonomyHistoryModeFilter, "">;
  source?: Exclude<AutonomyHistorySourceFilter, "">;
  workspaceDirs?: string[];
}): string {
  return JSON.stringify({
    kind: params.kind,
    sessionKey: params.sessionKey?.trim() || "",
    agentIds: normalizeRequestedAgentIds(params.agentIds),
    teamId: params.teamId?.trim() || "",
    limit: typeof params.limit === "number" ? params.limit : null,
    mode: params.mode ?? "",
    source: params.source ?? "",
    workspaceDirs: normalizeWorkspaceDirs(params.workspaceDirs),
  });
}

function projectAutonomySupervision(
  state: AutonomyState,
  result: AutonomySuperviseResult,
) {
  const { sessionKey, supervised } = result;
  state.autonomySuperviseResult = result;
  state.autonomyOverviewError = null;
  state.autonomyOverviewResult = {
    sessionKey,
    overview: supervised.overviewAfter,
  };
  state.autonomyHealError = null;
  state.autonomyGovernanceError = null;
  state.autonomyGovernanceResult = supervised.healed.governanceProposals ?? null;
  state.autonomyGovernanceReconcileError = null;
  state.autonomyGovernanceReconcileResult = supervised.governanceReconciled ?? null;
  state.autonomyReconcileError = null;
  if (supervised.capabilityInventory) {
    state.autonomyCapabilitiesError = null;
    state.autonomyCapabilitiesResult = {
      sessionKey,
      capabilities: supervised.capabilityInventory,
    };
  }
  if (supervised.genesisPlan) {
    state.autonomyGenesisError = null;
    state.autonomyGenesisResult = {
      sessionKey,
      genesisPlan: supervised.genesisPlan,
    };
  }
}

export function resetAutonomyState(state: AutonomyState, clearLoading = false) {
  state.autonomyResult = null;
  state.autonomyResultKey = null;
  state.autonomyError = null;
  state.autonomyStartError = null;
  state.autonomyStartResult = null;
  state.autonomyReplayError = null;
  state.autonomyReplayResult = null;
  state.autonomyCancelError = null;
  state.autonomyCancelResult = null;
  state.autonomyLoopError = null;
  state.autonomyLoopResult = null;
  state.autonomyOverviewError = null;
  state.autonomyOverviewResult = null;
  state.autonomyCapabilitiesError = null;
  state.autonomyCapabilitiesResult = null;
  state.autonomyGenesisError = null;
  state.autonomyGenesisResult = null;
  state.autonomyHistoryError = null;
  state.autonomyHistoryResult = null;
  state.autonomyHealError = null;
  state.autonomySuperviseError = null;
  state.autonomySuperviseResult = null;
  state.autonomyGovernanceError = null;
  state.autonomyGovernanceResult = null;
  state.autonomyGovernanceReconcileError = null;
  state.autonomyGovernanceReconcileResult = null;
  state.autonomyReconcileError = null;
  if (clearLoading) {
    state.autonomyLoading = false;
    state.autonomyLoadingKey = null;
    state.autonomyOverviewLoading = false;
    state.autonomyOverviewLoadingKey = null;
    state.autonomyCapabilitiesLoading = false;
    state.autonomyCapabilitiesLoadingKey = null;
    state.autonomyGenesisLoading = false;
    state.autonomyGenesisLoadingKey = null;
    state.autonomyHistoryLoading = false;
    state.autonomyHistoryLoadingKey = null;
    state.autonomyStartBusy = false;
    state.autonomyStartBusyKey = null;
    state.autonomyReplayBusy = false;
    state.autonomyReplayBusyKey = null;
    state.autonomyCancelBusy = false;
    state.autonomyCancelBusyKey = null;
    state.autonomyLoopBusy = false;
    state.autonomyLoopBusyKey = null;
    state.autonomyHealBusy = false;
    state.autonomySuperviseBusy = false;
    state.autonomyGovernanceBusy = false;
    state.autonomyGovernanceReconcileBusy = false;
    state.autonomyReconcileBusy = false;
  }
}

export async function loadAutonomyCapabilityInventory(
  state: AutonomyState,
  params?: { sessionKey?: string | null; agentIds?: string[]; workspaceDirs?: string[] },
) {
  const requestKey = buildFleetRequestKey({
    kind: "capabilities",
    sessionKey: params?.sessionKey,
    agentIds: params?.agentIds,
    workspaceDirs: params?.workspaceDirs,
  });
  if (
    !state.client ||
    !state.connected ||
    state.autonomyCapabilitiesLoadingKey === requestKey
  ) {
    return;
  }

  state.autonomyCapabilitiesLoading = true;
  state.autonomyCapabilitiesLoadingKey = requestKey;
  state.autonomyCapabilitiesError = null;
  try {
    const result = await state.client.request<AutonomyCapabilityInventoryResult>(
      "autonomy.capability.inventory",
      {
        ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
        ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    if (state.autonomyCapabilitiesLoadingKey === requestKey) {
      state.autonomyCapabilitiesResult = result;
    }
  } catch (err) {
    if (state.autonomyCapabilitiesLoadingKey === requestKey) {
      state.autonomyCapabilitiesError = resolveAutonomyErrorMessage(err, "autonomy overview");
    }
  } finally {
    if (state.autonomyCapabilitiesLoadingKey === requestKey) {
      state.autonomyCapabilitiesLoading = false;
      state.autonomyCapabilitiesLoadingKey = null;
    }
  }
}

export async function loadAutonomyGenesisPlan(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    teamId?: string | null;
    workspaceDirs?: string[];
  },
) {
  const requestKey = buildFleetRequestKey({
    kind: "genesis",
    sessionKey: params?.sessionKey,
    agentIds: params?.agentIds,
    teamId: params?.teamId,
    workspaceDirs: params?.workspaceDirs,
  });
  if (!state.client || !state.connected || state.autonomyGenesisLoadingKey === requestKey) {
    return;
  }

  state.autonomyGenesisLoading = true;
  state.autonomyGenesisLoadingKey = requestKey;
  state.autonomyGenesisError = null;
  try {
    const result = await state.client.request<AutonomyGenesisPlanResult>("autonomy.genesis.plan", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    if (state.autonomyGenesisLoadingKey === requestKey) {
      state.autonomyGenesisResult = result;
    }
  } catch (err) {
    if (state.autonomyGenesisLoadingKey === requestKey) {
      state.autonomyGenesisError = resolveAutonomyErrorMessage(err, "autonomy control");
    }
  } finally {
    if (state.autonomyGenesisLoadingKey === requestKey) {
      state.autonomyGenesisLoading = false;
      state.autonomyGenesisLoadingKey = null;
    }
  }
}

export async function loadAutonomyOverview(
  state: AutonomyState,
  params?: { sessionKey?: string | null; agentIds?: string[]; workspaceDirs?: string[] },
) {
  const requestKey = buildFleetRequestKey({
    kind: "overview",
    sessionKey: params?.sessionKey,
    agentIds: params?.agentIds,
    workspaceDirs: params?.workspaceDirs,
  });
  if (!state.client || !state.connected || state.autonomyOverviewLoadingKey === requestKey) {
    return;
  }

  state.autonomyOverviewLoading = true;
  state.autonomyOverviewLoadingKey = requestKey;
  state.autonomyOverviewError = null;
  try {
    const result = await state.client.request<AutonomyOverviewResult>("autonomy.overview", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    if (state.autonomyOverviewLoadingKey === requestKey) {
      state.autonomyOverviewResult = result;
      state.autonomyHealError = null;
      state.autonomyReconcileError = null;
    }
  } catch (err) {
    if (state.autonomyOverviewLoadingKey === requestKey) {
      state.autonomyOverviewError = resolveAutonomyErrorMessage(err, "autonomy overview");
    }
  } finally {
    if (state.autonomyOverviewLoadingKey === requestKey) {
      state.autonomyOverviewLoading = false;
      state.autonomyOverviewLoadingKey = null;
    }
  }
}

export async function loadAutonomyHistory(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    workspaceDirs?: string[];
    limit?: number;
    mode?: Exclude<AutonomyHistoryModeFilter, "">;
    source?: Exclude<AutonomyHistorySourceFilter, "">;
  },
) {
  const requestKey = buildFleetRequestKey({
    kind: "history",
    sessionKey: params?.sessionKey,
    agentIds: params?.agentIds,
    workspaceDirs: params?.workspaceDirs,
    limit: params?.limit,
    mode: params?.mode,
    source: params?.source,
  });
  if (!state.client || !state.connected || state.autonomyHistoryLoadingKey === requestKey) {
    return;
  }

  state.autonomyHistoryLoading = true;
  state.autonomyHistoryLoadingKey = requestKey;
  state.autonomyHistoryError = null;
  try {
    const result = await state.client.request<AutonomyHistoryResult>("autonomy.history", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      ...(typeof params?.limit === "number" ? { limit: params.limit } : {}),
      ...(params?.mode ? { mode: params.mode } : {}),
      ...(params?.source ? { source: params.source } : {}),
    });
    if (state.autonomyHistoryLoadingKey === requestKey) {
      state.autonomyHistoryResult = result;
    }
  } catch (err) {
    if (state.autonomyHistoryLoadingKey === requestKey) {
      state.autonomyHistoryError = resolveAutonomyErrorMessage(err, "autonomy overview");
    }
  } finally {
    if (state.autonomyHistoryLoadingKey === requestKey) {
      state.autonomyHistoryLoading = false;
      state.autonomyHistoryLoadingKey = null;
    }
  }
}

export async function loadAutonomyProfile(
  state: AutonomyState,
  params: LoadAutonomyProfileParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyLoading && state.autonomyLoadingKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyLoadingKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyLoading = true;
  state.autonomyLoadingKey = requestKey;
  state.autonomyResultKey = null;
  state.autonomyError = null;
  state.autonomyResult = null;
  try {
    const result = await state.client.request<AutonomyShowResult>("autonomy.show", {
      agentId,
      sessionKey,
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyResult = result;
    state.autonomyResultKey = requestKey;
    state.autonomyStartError = null;
    state.autonomyCancelError = null;
    state.autonomyLoopError = null;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyError = resolveAutonomyErrorMessage(err, "autonomy profile");
  } finally {
    if (state.autonomyLoadingKey === requestKey) {
      state.autonomyLoading = false;
      state.autonomyLoadingKey = null;
    }
  }
}

export async function startAutonomyFlow(
  state: AutonomyState,
  params: StartAutonomyFlowParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyStartBusy && state.autonomyStartBusyKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyStartBusyKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyStartBusy = true;
  state.autonomyStartBusyKey = requestKey;
  state.autonomyStartError = null;
  try {
    const result = await state.client.request<AutonomyStartResult>("autonomy.start", {
      agentId,
      sessionKey,
      ...(params.goal ? { goal: params.goal } : {}),
      ...(params.controllerId ? { controllerId: params.controllerId } : {}),
      ...(params.currentStep ? { currentStep: params.currentStep } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      ...(params.notifyPolicy ? { notifyPolicy: params.notifyPolicy } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.seedTaskEnabled === "boolean"
        ? { seedTaskEnabled: params.seedTaskEnabled }
        : {}),
      ...(params.seedTaskRuntime ? { seedTaskRuntime: params.seedTaskRuntime } : {}),
      ...(params.seedTaskStatus ? { seedTaskStatus: params.seedTaskStatus } : {}),
      ...(params.seedTaskLabel ? { seedTaskLabel: params.seedTaskLabel } : {}),
      ...(params.seedTaskTask ? { seedTaskTask: params.seedTaskTask } : {}),
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyStartResult = result;
    state.autonomyResultKey = requestKey;
    state.autonomyResult = {
      sessionKey: result.sessionKey,
      profile: result.started.profile,
      latestFlow: result.started.flow,
      ...(result.started.seedTask ? { latestSeedTask: result.started.seedTask } : {}),
      ...(state.autonomyResult?.loopJob ? { loopJob: state.autonomyResult.loopJob } : {}),
    };
    state.autonomyError = null;
    state.autonomyCancelError = null;
    state.autonomyLoopError = null;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyStartError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    if (state.autonomyStartBusyKey === requestKey) {
      state.autonomyStartBusy = false;
      state.autonomyStartBusyKey = null;
    }
  }
}

export async function submitAutonomySandboxReplay(
  state: AutonomyState,
  params: SubmitAutonomySandboxReplayParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyReplayBusy && state.autonomyReplayBusyKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyReplayBusyKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyReplayBusy = true;
  state.autonomyReplayBusyKey = requestKey;
  state.autonomyReplayError = null;
  try {
    const result = await state.client.request<AutonomyReplaySubmitResult>(
      "autonomy.replay.submit",
      {
        agentId,
        sessionKey,
        replayPassed: params.replayPassed,
        qaPassed: params.qaPassed,
        ...(typeof params.auditPassed === "boolean" ? { auditPassed: params.auditPassed } : {}),
        ...(params.flowId ? { flowId: params.flowId } : {}),
      },
    );
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyReplayResult = result;
    state.autonomyResultKey = requestKey;

    const previous = state.autonomyResult;
    const sameProfile = previous?.profile.id === result.submitted.profile.id;
    state.autonomyResult = {
      sessionKey: result.sessionKey,
      profile: result.submitted.profile,
      ...(result.submitted.outcome.flow
        ? { latestFlow: result.submitted.outcome.flow }
        : sameProfile && previous?.latestFlow
          ? { latestFlow: previous.latestFlow }
          : {}),
      ...(result.submitted.outcome.seedTask
        ? { latestSeedTask: result.submitted.outcome.seedTask }
        : sameProfile && previous?.latestSeedTask
          ? { latestSeedTask: previous.latestSeedTask }
          : {}),
      ...(sameProfile && previous?.loopJob ? { loopJob: previous.loopJob } : {}),
    };
    state.autonomyError = null;
    state.autonomyStartError = null;
    state.autonomyCancelError = null;
    state.autonomyLoopError = null;
    state.autonomyReplayError = result.submitted.outcome.applied
      ? null
      : (result.submitted.outcome.reason ?? null);
    await refreshVisibleAutonomyForCurrentSession(state);
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyReplayError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    if (state.autonomyReplayBusyKey === requestKey) {
      state.autonomyReplayBusy = false;
      state.autonomyReplayBusyKey = null;
    }
  }
}

export async function cancelAutonomyFlow(
  state: AutonomyState,
  params: CancelAutonomyFlowParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyCancelBusy && state.autonomyCancelBusyKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyCancelBusyKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyCancelBusy = true;
  state.autonomyCancelBusyKey = requestKey;
  state.autonomyCancelError = null;
  try {
    const result = await state.client.request<AutonomyCancelResult>("autonomy.cancel", {
      agentId,
      sessionKey,
      ...(params.flowId ? { flowId: params.flowId } : {}),
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyCancelResult = result;
    state.autonomyResultKey = requestKey;

    const previous = state.autonomyResult;
    const sameProfile = previous?.profile.id === result.cancelled.profile.id;
    state.autonomyResult = {
      sessionKey: result.sessionKey,
      profile: result.cancelled.profile,
      ...(result.cancelled.outcome.flow
        ? { latestFlow: result.cancelled.outcome.flow }
        : sameProfile && previous?.latestFlow
          ? { latestFlow: previous.latestFlow }
          : {}),
      ...(result.cancelled.outcome.seedTask
        ? { latestSeedTask: result.cancelled.outcome.seedTask }
        : sameProfile && previous?.latestSeedTask
          ? { latestSeedTask: previous.latestSeedTask }
          : {}),
      ...(sameProfile && previous?.loopJob ? { loopJob: previous.loopJob } : {}),
    };
    state.autonomyError = null;
    state.autonomyStartError = null;
    state.autonomyLoopError = null;
    state.autonomyCancelError = result.cancelled.outcome.cancelled
      ? null
      : (result.cancelled.outcome.reason ?? null);
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyCancelError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    if (state.autonomyCancelBusyKey === requestKey) {
      state.autonomyCancelBusy = false;
      state.autonomyCancelBusyKey = null;
    }
  }
}

export async function upsertAutonomyLoop(
  state: AutonomyState,
  params: UpsertAutonomyLoopParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyLoopBusy && state.autonomyLoopBusyKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyLoopBusyKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyLoopBusy = true;
  state.autonomyLoopBusyKey = requestKey;
  state.autonomyLoopError = null;
  try {
    const result = await state.client.request<AutonomyLoopUpsertResult>("autonomy.loop.upsert", {
      agentId,
      sessionKey,
      ...(typeof params.everyMs === "number" ? { everyMs: params.everyMs } : {}),
      ...(params.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyLoopResult = result;
    state.autonomyResultKey = requestKey;
    const previous = state.autonomyResult;
    const sameProfile = previous?.profile.id === result.upserted.profile.id;
    state.autonomyResult = {
      sessionKey: result.sessionKey,
      profile: result.upserted.profile,
      ...(sameProfile && previous?.latestFlow ? { latestFlow: previous.latestFlow } : {}),
      ...(sameProfile && previous?.latestSeedTask ? { latestSeedTask: previous.latestSeedTask } : {}),
      loopJob: result.upserted.loop as AutonomyShowResult["loopJob"],
    };
    state.autonomyError = null;
    state.autonomyStartError = null;
    state.autonomyCancelError = null;
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyLoopError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    if (state.autonomyLoopBusyKey === requestKey) {
      state.autonomyLoopBusy = false;
      state.autonomyLoopBusyKey = null;
    }
  }
}

export async function removeAutonomyLoop(
  state: AutonomyState,
  params: RemoveAutonomyLoopParams,
) {
  const agentId = normalizeAgentId(params.agentId);
  const sessionKey = resolveAutonomySessionKey(params);
  const requestKey = buildAutonomyRequestKey({ agentId, sessionKey });
  if (
    !state.client ||
    !state.connected ||
    !agentId ||
    (state.autonomyLoopBusy && state.autonomyLoopBusyKey === requestKey)
  ) {
    return;
  }

  const shouldIgnoreResponse = () =>
    state.autonomyLoopBusyKey !== requestKey || hasSelectedAgentMismatch(state, agentId);

  state.autonomyLoopBusy = true;
  state.autonomyLoopBusyKey = requestKey;
  state.autonomyLoopError = null;
  try {
    const result = await state.client.request<AutonomyLoopRemoveResult>("autonomy.loop.remove", {
      agentId,
      sessionKey,
      ...(params.jobId ? { jobId: params.jobId } : {}),
    });
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyLoopResult = result;
    state.autonomyResultKey = requestKey;
    const previous = state.autonomyResult;
    const sameProfile = previous?.profile.id === result.removed.profile.id;
    state.autonomyResult = {
      sessionKey: result.sessionKey,
      profile: result.removed.profile,
      ...(sameProfile && previous?.latestFlow ? { latestFlow: previous.latestFlow } : {}),
      ...(sameProfile && previous?.latestSeedTask ? { latestSeedTask: previous.latestSeedTask } : {}),
    };
    state.autonomyError = null;
    state.autonomyStartError = null;
    state.autonomyCancelError = null;
    state.autonomyLoopError = result.removed.removed ? null : (result.removed.reason ?? null);
  } catch (err) {
    if (shouldIgnoreResponse()) {
      return;
    }
    state.autonomyLoopError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    if (state.autonomyLoopBusyKey === requestKey) {
      state.autonomyLoopBusy = false;
      state.autonomyLoopBusyKey = null;
    }
  }
}

export async function reconcileAutonomyLoops(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    workspaceDirs?: string[];
    historyLimit?: number;
    historyMode?: Exclude<AutonomyHistoryModeFilter, "">;
    historySource?: Exclude<AutonomyHistorySourceFilter, "">;
  },
) {
  if (!state.client || !state.connected || state.autonomyReconcileBusy) {
    return;
  }

  state.autonomyReconcileBusy = true;
  state.autonomyReconcileError = null;
  try {
    await state.client.request<{
      sessionKey: string;
      reconciled: { createdCount: number; updatedCount: number };
    }>("autonomy.loop.reconcile", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    await loadAutonomyOverview(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
    });
    await loadAutonomyHistory(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
      ...(typeof params?.historyLimit === "number" ? { limit: params.historyLimit } : {}),
      ...(params?.historyMode ? { mode: params.historyMode } : {}),
      ...(params?.historySource ? { source: params.historySource } : {}),
    });
    const selectedAgentId = state.agentsSelectedId?.trim();
    if (selectedAgentId && state.agentsPanel === "autonomy") {
      await loadAutonomyProfile(state, {
        agentId: selectedAgentId,
        sessionKey: state.sessionKey,
      });
    }
  } catch (err) {
    state.autonomyReconcileError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    state.autonomyReconcileBusy = false;
  }
}

export async function healAutonomyFleet(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    workspaceDirs?: string[];
    historyLimit?: number;
    historyMode?: Exclude<AutonomyHistoryModeFilter, "">;
    historySource?: Exclude<AutonomyHistorySourceFilter, "">;
  },
) {
  if (!state.client || !state.connected || state.autonomyHealBusy) {
    return;
  }

  state.autonomyHealBusy = true;
  state.autonomyHealError = null;
  try {
    const result = await state.client.request<AutonomyHealResult>("autonomy.heal", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
    });
    state.autonomyGovernanceError = null;
    state.autonomyGovernanceResult = result.healed.governanceProposals ?? null;
    await loadAutonomyOverview(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
    });
    await loadAutonomyHistory(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
      ...(typeof params?.historyLimit === "number" ? { limit: params.historyLimit } : {}),
      ...(params?.historyMode ? { mode: params.historyMode } : {}),
      ...(params?.historySource ? { source: params.historySource } : {}),
    });
    const selectedAgentId = state.agentsSelectedId?.trim();
    if (selectedAgentId && state.agentsPanel === "autonomy") {
      await loadAutonomyProfile(state, {
        agentId: selectedAgentId,
        sessionKey: state.sessionKey,
      });
    }
  } catch (err) {
    state.autonomyHealError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    state.autonomyHealBusy = false;
  }
}

export async function superviseAutonomyFleet(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    workspaceDirs?: string[];
    teamId?: string | null;
    governanceMode?: AutonomyGovernanceReconcileMode | "none";
    decisionNote?: string;
    restartBlockedFlows?: boolean;
    includeCapabilityInventory?: boolean;
    includeGenesisPlan?: boolean;
    recordHistory?: boolean;
    historyLimit?: number;
    historyMode?: Exclude<AutonomyHistoryModeFilter, "">;
    historySource?: Exclude<AutonomyHistorySourceFilter, "">;
  },
) {
  if (!state.client || !state.connected || state.autonomySuperviseBusy) {
    return;
  }

  state.autonomySuperviseBusy = true;
  state.autonomySuperviseError = null;
  try {
    const result = await state.client.request<AutonomySuperviseResult>("autonomy.supervise", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      ...(params?.teamId?.trim() ? { teamId: params.teamId.trim() } : {}),
      ...(params?.governanceMode ? { governanceMode: params.governanceMode } : {}),
      ...(params?.decisionNote?.trim() ? { decisionNote: params.decisionNote.trim() } : {}),
      ...(typeof params?.restartBlockedFlows === "boolean"
        ? { restartBlockedFlows: params.restartBlockedFlows }
        : {}),
      ...(typeof params?.includeCapabilityInventory === "boolean"
        ? { includeCapabilityInventory: params.includeCapabilityInventory }
        : {}),
      ...(typeof params?.includeGenesisPlan === "boolean"
        ? { includeGenesisPlan: params.includeGenesisPlan }
        : {}),
      ...(typeof params?.recordHistory === "boolean" ? { recordHistory: params.recordHistory } : {}),
    });
    projectAutonomySupervision(state, result);
    await loadAutonomyHistory(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
      ...(typeof params?.historyLimit === "number" ? { limit: params.historyLimit } : {}),
      ...(params?.historyMode ? { mode: params.historyMode } : {}),
      ...(params?.historySource ? { source: params.historySource } : {}),
    });
    const selectedAgentId = state.agentsSelectedId?.trim();
    if (selectedAgentId && state.agentsPanel === "autonomy") {
      await loadAutonomyProfile(state, {
        agentId: selectedAgentId,
        sessionKey: state.sessionKey,
      });
    }
  } catch (err) {
    state.autonomySuperviseError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    state.autonomySuperviseBusy = false;
  }
}

export async function synthesizeAutonomyGovernanceProposals(
  state: AutonomyState,
  params?: { sessionKey?: string | null; agentIds?: string[]; workspaceDirs?: string[] },
) {
  if (!state.client || !state.connected || state.autonomyGovernanceBusy) {
    return;
  }

  state.autonomyGovernanceBusy = true;
  state.autonomyGovernanceError = null;
  try {
    const result = await state.client.request<AutonomyGovernanceProposalsEnvelope>(
      "autonomy.governance.proposals",
      {
        ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
        ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
        ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      },
    );
    state.autonomyGovernanceResult = result.governance;
  } catch (err) {
    state.autonomyGovernanceError = resolveAutonomyErrorMessage(err, "autonomy control");
  } finally {
    state.autonomyGovernanceBusy = false;
  }
}

export async function reconcileAutonomyGovernanceProposals(
  state: AutonomyState,
  params?: {
    sessionKey?: string | null;
    agentIds?: string[];
    workspaceDirs?: string[];
    mode?: AutonomyGovernanceReconcileMode;
    decisionNote?: string;
    historyLimit?: number;
    historyMode?: Exclude<AutonomyHistoryModeFilter, "">;
    historySource?: Exclude<AutonomyHistorySourceFilter, "">;
  },
) {
  if (!state.client || !state.connected || state.autonomyGovernanceReconcileBusy) {
    return;
  }

  state.autonomyGovernanceReconcileBusy = true;
  state.autonomyGovernanceReconcileError = null;
  state.autonomyGovernanceReconcileResult = null;
  try {
    const result = await state.client.request<{
      sessionKey: string;
      governanceReconciled: AutonomyGovernanceReconcileResult;
    }>("autonomy.governance.reconcile", {
      ...(params?.sessionKey?.trim() ? { sessionKey: params.sessionKey.trim() } : {}),
      ...(params?.agentIds?.length ? { agentIds: params.agentIds } : {}),
      ...(params?.workspaceDirs?.length ? { workspaceDirs: params.workspaceDirs } : {}),
      ...(params?.mode ? { mode: params.mode } : {}),
      ...(params?.decisionNote?.trim() ? { decisionNote: params.decisionNote.trim() } : {}),
    });
    state.autonomyGovernanceReconcileResult = result.governanceReconciled;
    await loadAutonomyOverview(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
    });
    await loadAutonomyHistory(state, {
      sessionKey: params?.sessionKey,
      agentIds: params?.agentIds,
      workspaceDirs: params?.workspaceDirs,
      ...(typeof params?.historyLimit === "number" ? { limit: params.historyLimit } : {}),
      ...(params?.historyMode ? { mode: params.historyMode } : {}),
      ...(params?.historySource ? { source: params.historySource } : {}),
    });
    const selectedAgentId = state.agentsSelectedId?.trim();
    if (selectedAgentId && state.agentsPanel === "autonomy") {
      await loadAutonomyProfile(state, {
        agentId: selectedAgentId,
        sessionKey: state.sessionKey,
      });
    }
  } catch (err) {
    state.autonomyGovernanceReconcileError = resolveAutonomyErrorMessage(
      err,
      "autonomy control",
    );
  } finally {
    state.autonomyGovernanceReconcileBusy = false;
  }
}

export function refreshVisibleAutonomyForCurrentSession(
  state: AutonomyState,
): Promise<void> | undefined {
  if (state.agentsPanel !== "autonomy") {
    return undefined;
  }
  const workspaceDirs = parseAutonomyWorkspaceDirsDraft(state.autonomyWorkspaceScope);
  const workspaceScopeInput = workspaceDirs.length > 0 ? { workspaceDirs } : {};
  const historyFilters = {
    ...(typeof parseAutonomyHistoryLimitDraft(state.autonomyHistoryLimit) === "number"
      ? { limit: parseAutonomyHistoryLimitDraft(state.autonomyHistoryLimit) }
      : {}),
    ...(state.autonomyHistoryMode ? { mode: state.autonomyHistoryMode } : {}),
    ...(state.autonomyHistorySource ? { source: state.autonomyHistorySource } : {}),
  };
  const selectedAgentId = state.agentsSelectedId?.trim();
  if (!selectedAgentId) {
    return Promise.all([
      loadAutonomyOverview(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
      loadAutonomyCapabilityInventory(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
      loadAutonomyGenesisPlan(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
      loadAutonomyHistory(state, {
        sessionKey: state.sessionKey,
        ...workspaceScopeInput,
        ...historyFilters,
      }),
    ]).then(() => undefined);
  }
  return Promise.all([
    loadAutonomyOverview(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
    loadAutonomyCapabilityInventory(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
    loadAutonomyGenesisPlan(state, { sessionKey: state.sessionKey, ...workspaceScopeInput }),
    loadAutonomyHistory(state, {
      sessionKey: state.sessionKey,
      ...workspaceScopeInput,
      ...historyFilters,
    }),
    loadAutonomyProfile(state, {
      agentId: selectedAgentId,
      sessionKey: state.sessionKey,
    }),
  ]).then(() => undefined);
}
