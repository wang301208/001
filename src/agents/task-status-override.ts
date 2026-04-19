import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  localeLowercasePreservingWhitespace,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { findActiveSessionTask } from "./session-async-task-status.js";

export type SessionTaskContinuation = {
  taskId?: string;
  runId?: string;
  taskKind?: string;
  sourceId?: string;
  statusText?: string;
  recentOutcome?: string;
  nextStep?: string;
};

export type TaskContinuationSource =
  | "active-task"
  | "checkpoint"
  | "compaction-details"
  | "summary-text";

export type ResolvedTaskContinuation = {
  continuation?: SessionTaskContinuation;
  source?: TaskContinuationSource;
};

export type ContinuationStatusKind =
  | "blocked"
  | "waiting"
  | "failed"
  | "ready"
  | "done"
  | "unknown";

export type ContinuationState = {
  continuation?: SessionTaskContinuation;
  source?: TaskContinuationSource;
  /**
   * Legacy compatibility alias for the default projected task-status text.
   * Prefer `defaultTaskStatusOverride` or consumer-specific projection helpers.
   */
  taskStatusOverride?: string;
  /**
   * Default projected task-status text derived from the resolved continuation state.
   * Consumer-specific paths (attempt / replay / compaction) may still project differently.
   */
  defaultTaskStatusOverride?: string;
  statusKind?: ContinuationStatusKind;
  blocker?: string;
  sourceLabel?: string;
  meaningful: boolean;
};

export type ContinuationProjectionMode =
  | "none"
  | "default"
  | "blocked-like"
  | "done-with-next-step"
  | "done-no-next-step";

export type ContinuationDecisionAuditCode =
  | "continuation.meaningful"
  | "continuation.not_meaningful"
  | "continuation.has_source"
  | "continuation.has_status_kind"
  | "continuation.restore_boundary"
  | "continuation.not_restore_boundary"
  | "projection.none"
  | "projection.default"
  | "projection.blocked_like"
  | "projection.done_with_next_step"
  | "projection.done_without_next_step";

export type ContinuationDecisionExplanation = {
  meaningful: boolean;
  restoreBoundary: boolean;
  statusKind?: ContinuationStatusKind;
  source?: TaskContinuationSource;
  sourceLabel?: string;
  projectionMode: ContinuationProjectionMode;
  auditCodes: ContinuationDecisionAuditCode[];
  reasons: string[];
};

export type ContinuationProjectionDecision = {
  taskStatusOverride?: string;
  explanation: ContinuationDecisionExplanation;
};

export type ContinuationAuditPayload = {
  consumer: "attempt" | "replay" | "compaction";
  projectedTaskStatusOverride?: string;
  explanation: ContinuationDecisionExplanation;
};

export function buildTaskContinuationFromSession(params: {
  sessionKey?: string;
}): SessionTaskContinuation | undefined {
  const activeTask = findActiveSessionTask({
    sessionKey: params.sessionKey,
  });
  if (!activeTask) {
    return undefined;
  }
  const continuation: SessionTaskContinuation = {
    ...(normalizeOptionalString(activeTask.taskId) ? { taskId: normalizeOptionalString(activeTask.taskId) } : {}),
    ...(normalizeOptionalString(activeTask.runId) ? { runId: normalizeOptionalString(activeTask.runId) } : {}),
    ...(normalizeOptionalString(activeTask.taskKind)
      ? { taskKind: normalizeOptionalString(activeTask.taskKind) }
      : {}),
    ...(normalizeOptionalString(activeTask.sourceId)
      ? { sourceId: normalizeOptionalString(activeTask.sourceId) }
      : {}),
    ...(normalizeOptionalString(activeTask.progressSummary)
      ? { statusText: normalizeOptionalString(activeTask.progressSummary) }
      : {}),
    ...(normalizeOptionalString(activeTask.terminalSummary)
      ? { recentOutcome: normalizeOptionalString(activeTask.terminalSummary) }
      : {}),
    ...(normalizeOptionalString(activeTask.task)
      ? { nextStep: normalizeOptionalString(activeTask.task) }
      : {}),
  };
  return Object.keys(continuation).length > 0 ? continuation : undefined;
}

export function buildTaskStatusOverrideFromContinuation(
  continuation: SessionTaskContinuation | undefined,
): string | undefined {
  if (!continuation) {
    return undefined;
  }
  const lines = [
    continuation.statusText,
    continuation.recentOutcome ? `Recent outcome: ${continuation.recentOutcome}` : null,
    continuation.nextStep ? `Next step: ${continuation.nextStep}` : null,
  ].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function buildTaskStatusOverrideFromSession(params: {
  sessionKey?: string;
}): string | undefined {
  return buildTaskStatusOverrideFromContinuation(buildTaskContinuationFromSession(params));
}

export function readTaskContinuationFromDetails(details: unknown): SessionTaskContinuation | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }
  const continuation = (details as { continuation?: unknown }).continuation;
  if (!continuation || typeof continuation !== "object" || Array.isArray(continuation)) {
    return undefined;
  }
  const candidate = continuation as Record<string, unknown>;
  const normalized: SessionTaskContinuation = {
    ...(normalizeOptionalString(candidate.taskId) ? { taskId: normalizeOptionalString(candidate.taskId) } : {}),
    ...(normalizeOptionalString(candidate.runId) ? { runId: normalizeOptionalString(candidate.runId) } : {}),
    ...(normalizeOptionalString(candidate.taskKind)
      ? { taskKind: normalizeOptionalString(candidate.taskKind) }
      : {}),
    ...(normalizeOptionalString(candidate.sourceId)
      ? { sourceId: normalizeOptionalString(candidate.sourceId) }
      : {}),
    ...(normalizeOptionalString(candidate.statusText)
      ? { statusText: normalizeOptionalString(candidate.statusText) }
      : {}),
    ...(normalizeOptionalString(candidate.recentOutcome)
      ? { recentOutcome: normalizeOptionalString(candidate.recentOutcome) }
      : {}),
    ...(normalizeOptionalString(candidate.nextStep)
      ? { nextStep: normalizeOptionalString(candidate.nextStep) }
      : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function extractTaskStatusSection(summary: string | undefined): string | undefined {
  const normalizedSummary = summary?.trim();
  if (!normalizedSummary) {
    return undefined;
  }
  const taskStatusHeading = "## Task status / next step";
  const lines = normalizedSummary.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === taskStatusHeading);
  if (start < 0) {
    return undefined;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if ((lines[i] ?? "").trim().startsWith("## ")) {
      end = i;
      break;
    }
  }
  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
  return body || undefined;
}

export function buildTaskContinuationFromSummary(
  summary: string | undefined,
): SessionTaskContinuation | undefined {
  const section = extractTaskStatusSection(summary);
  if (!section) {
    return undefined;
  }
  const lines = section.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }
  const continuation: SessionTaskContinuation = {};
  const statusLines: string[] = [];
  for (const line of lines) {
    const recentOutcomeMatch = /^Recent outcome:\s*(.+)$/u.exec(line);
    if (recentOutcomeMatch) {
      continuation.recentOutcome = recentOutcomeMatch[1]?.trim();
      continue;
    }
    const nextStepMatch = /^Next step:\s*(.+)$/u.exec(line);
    if (nextStepMatch) {
      continuation.nextStep = nextStepMatch[1]?.trim();
      continue;
    }
    statusLines.push(line);
  }
  if (statusLines.length > 0) {
    continuation.statusText = statusLines.join("\n");
  }
  return hasMeaningfulTaskContinuation(continuation) ? continuation : undefined;
}

export function resolveTaskContinuationFromMessages(
  messages: AgentMessage[] | undefined,
): ResolvedTaskContinuation {
  if (!messages || messages.length === 0) {
    return {};
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const entry = messages[i] as
      | (AgentMessage & { role?: unknown; details?: unknown; summary?: unknown })
      | undefined;
    if (entry?.role !== "compactionSummary") {
      continue;
    }
    const detailsContinuation = readTaskContinuationFromDetails(entry.details);
    if (detailsContinuation) {
      return { continuation: detailsContinuation, source: "compaction-details" };
    }
    const summaryContinuation =
      typeof entry.summary === "string" ? buildTaskContinuationFromSummary(entry.summary) : undefined;
    if (summaryContinuation) {
      return { continuation: summaryContinuation, source: "summary-text" };
    }
  }
  return {};
}

export function resolvePreferredTaskContinuation(params: {
  sessionKey?: string;
  checkpointContinuation?: SessionTaskContinuation;
  messages?: AgentMessage[];
}): ResolvedTaskContinuation {
  const activeContinuation = buildTaskContinuationFromSession({ sessionKey: params.sessionKey });
  if (activeContinuation) {
    return { continuation: activeContinuation, source: "active-task" };
  }
  if (params.checkpointContinuation && Object.keys(params.checkpointContinuation).length > 0) {
    return {
      continuation: params.checkpointContinuation,
      source: "checkpoint",
    };
  }
  return resolveTaskContinuationFromMessages(params.messages);
}

function detectContinuationStatusKind(
  continuation: SessionTaskContinuation | undefined,
): ContinuationStatusKind | undefined {
  const statusText = localeLowercasePreservingWhitespace(continuation?.statusText ?? "");
  if (!statusText) {
    return undefined;
  }
  if (/failed|failure|error|invalid/u.test(statusText)) {
    return "failed";
  }
  if (/blocked|blocking/u.test(statusText)) {
    return "blocked";
  }
  if (/waiting|pending/u.test(statusText)) {
    return "waiting";
  }
  if (/done|completed|complete|terminal/u.test(statusText)) {
    return "done";
  }
  if (/ready|resume|continue/u.test(statusText)) {
    return "ready";
  }
  return "unknown";
}

export function extractContinuationBlocker(
  continuation: SessionTaskContinuation | undefined,
): string | undefined {
  const statusText = normalizeOptionalString(continuation?.statusText);
  if (!statusText) {
    return undefined;
  }
  return /blocked|blocking|waiting|failed|failure|error|invalid|stale/u.test(statusText)
    ? statusText
    : undefined;
}

function buildContinuationSourceLabel(source: TaskContinuationSource | undefined): string | undefined {
  switch (source) {
    case "active-task":
      return "active runtime task";
    case "checkpoint":
      return "structured compaction checkpoint";
    case "compaction-details":
      return "compaction entry structured continuation";
    case "summary-text":
      return "compaction summary text";
    default:
      return undefined;
  }
}

export function buildContinuationState(params: {
  continuation?: SessionTaskContinuation;
  source?: TaskContinuationSource;
}): ContinuationState {
  const meaningful = hasMeaningfulTaskContinuation(params.continuation);
  const continuation = meaningful ? params.continuation : undefined;
  const source = meaningful ? params.source : undefined;
  const defaultTaskStatusOverride = meaningful
    ? buildTaskStatusOverrideFromContinuation(params.continuation)
    : undefined;
  return {
    continuation,
    source,
    taskStatusOverride: defaultTaskStatusOverride,
    defaultTaskStatusOverride,
    statusKind: meaningful ? detectContinuationStatusKind(continuation) : undefined,
    blocker: meaningful ? extractContinuationBlocker(continuation) : undefined,
    sourceLabel: meaningful ? buildContinuationSourceLabel(source) : undefined,
    meaningful,
  };
}

export function resolveContinuationState(params: {
  sessionKey?: string;
  checkpointContinuation?: SessionTaskContinuation;
  messages?: AgentMessage[];
}): ContinuationState {
  return buildContinuationState(resolvePreferredTaskContinuation(params));
}

export function resolveContinuationStateFromCompactionEntry(params: {
  details?: unknown;
  summary?: unknown;
}): ContinuationState {
  const detailsContinuation = readTaskContinuationFromDetails(params.details);
  if (detailsContinuation) {
    return buildContinuationState({
      continuation: detailsContinuation,
      source: "compaction-details",
    });
  }
  const summaryContinuation =
    typeof params.summary === "string" ? buildTaskContinuationFromSummary(params.summary) : undefined;
  if (summaryContinuation) {
    return buildContinuationState({
      continuation: summaryContinuation,
      source: "summary-text",
    });
  }
  return { meaningful: false };
}

export function hasMeaningfulTaskContinuation(
  continuation: SessionTaskContinuation | null | undefined,
): boolean {
  if (!continuation || typeof continuation !== "object") {
    return false;
  }
  return Boolean(
    normalizeOptionalString(continuation.statusText) ||
      normalizeOptionalString(continuation.recentOutcome) ||
      normalizeOptionalString(continuation.nextStep),
  );
}

export function isBlockedLikeContinuationStatus(
  statusKind: ContinuationStatusKind | undefined,
): boolean {
  return statusKind === "blocked" || statusKind === "waiting" || statusKind === "failed";
}

export function shouldTreatContinuationStateAsRestoreBoundary(
  continuationState:
    | Pick<ContinuationState, "meaningful" | "statusKind">
    | null
    | undefined,
): boolean {
  if (!continuationState) {
    return false;
  }
  return (
    continuationState.meaningful ||
    isBlockedLikeContinuationStatus(continuationState.statusKind)
  );
}

export function shouldDescribeNextStepAsImmediatelyExecutable(
  statusKind: ContinuationStatusKind | undefined,
): boolean {
  return statusKind === undefined || statusKind === "ready" || statusKind === "unknown";
}

export function formatNextStepAnchorForContinuationState(params: {
  statusKind: ContinuationStatusKind | undefined;
  nextStep: string | undefined;
}): string | undefined {
  const nextStep = normalizeOptionalString(params.nextStep);
  if (!nextStep) {
    return undefined;
  }
  if (params.statusKind === "done") {
    return `- Prior next step anchor, only if follow-up work is still needed -> ${nextStep}`;
  }
  if (!shouldDescribeNextStepAsImmediatelyExecutable(params.statusKind)) {
    return `- Next step anchor after resolving the blocker or failure state, if still valid -> ${nextStep}`;
  }
  return `- Next step anchor: continue the active task if still relevant -> ${nextStep}`;
}

export function buildAttemptContinuationGuidanceLine(
  statusKind: ContinuationStatusKind | undefined,
): string {
  if (shouldDescribeNextStepAsImmediatelyExecutable(statusKind)) {
    return "- Make the next step immediately actionable when the active task still applies.";
  }
  if (statusKind === "done") {
    return "- Treat any stored next step as optional follow-up, not as evidence that the prior task is still active.";
  }
  return "- Do not present the next step as immediately executable unless the blocker or failure state has been cleared.";
}

export function buildAttemptTaskContinuityHint(
  continuationState: ContinuationState | null | undefined,
): string | undefined {
  const preferredContinuation = continuationState?.continuation;
  if (!preferredContinuation) {
    return undefined;
  }
  const taskProgress = normalizeOptionalString(preferredContinuation.statusText);
  const taskTerminal = normalizeOptionalString(preferredContinuation.recentOutcome);
  const taskPrompt = normalizeOptionalString(preferredContinuation.nextStep);
  return [
    "Task continuity hint:",
    continuationState?.statusKind
      ? `- Resolved continuation status kind: ${continuationState.statusKind}.`
      : null,
    taskProgress ? `- Current task status: ${taskProgress}` : null,
    continuationState?.blocker ? `- Current blocker: ${continuationState.blocker}` : null,
    taskTerminal ? `- Most recent terminal summary: ${taskTerminal}` : null,
    formatNextStepAnchorForContinuationState({
      statusKind: continuationState?.statusKind,
      nextStep: taskPrompt,
    }),
    continuationState?.source === "checkpoint"
      ? `- Active runtime task missing; using latest ${continuationState.sourceLabel ?? "structured compaction checkpoint"} as the restore fallback.`
      : continuationState?.source === "compaction-details"
        ? `- Active runtime task and checkpoint continuation missing; using latest ${continuationState.sourceLabel ?? "compaction entry structured continuation"} as the restore fallback.`
        : null,
    "- In ## Task status / next step, prefer the active task state above over stale earlier context when they conflict.",
    "- Preserve blocker or waiting reasons, recent meaningful outcomes, and failed or invalidated paths when they help continuation or prevent loops.",
    buildAttemptContinuationGuidanceLine(continuationState?.statusKind),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function shouldAcceptTaskStatusWithoutImmediateNextStep(
  continuation:
    | Pick<SessionTaskContinuation, "statusText" | "recentOutcome" | "nextStep">
    | null
    | undefined,
): boolean {
  if (!continuation) {
    return false;
  }
  const statusKind = detectContinuationStatusKind(continuation);
  if (statusKind === "done") {
    return Boolean(normalizeOptionalString(continuation.recentOutcome));
  }
  return isBlockedLikeContinuationStatus(statusKind);
}

export function getDefaultTaskStatusOverrideFromContinuationState(
  continuationState: Pick<ContinuationState, "defaultTaskStatusOverride" | "taskStatusOverride">
    | null
    | undefined,
): string | undefined {
  return continuationState?.defaultTaskStatusOverride ?? continuationState?.taskStatusOverride;
}

function resolveContinuationProjectionDecision(params: {
  continuationState: ContinuationState | null | undefined;
  includeNextStepForDone: boolean;
}): ContinuationProjectionDecision {
  const continuationState = params.continuationState;
  const reasons: string[] = [];
  const auditCodes: ContinuationDecisionAuditCode[] = [];
  const restoreBoundary = shouldTreatContinuationStateAsRestoreBoundary(continuationState);
  const meaningful = Boolean(continuationState?.meaningful);

  if (meaningful) {
    auditCodes.push("continuation.meaningful");
    reasons.push("continuation state is meaningful");
  } else {
    auditCodes.push("continuation.not_meaningful");
    reasons.push("continuation state is not meaningful");
  }

  if (continuationState?.sourceLabel) {
    auditCodes.push("continuation.has_source");
    reasons.push(`continuation source: ${continuationState.sourceLabel}`);
  }
  if (continuationState?.statusKind) {
    auditCodes.push("continuation.has_status_kind");
    reasons.push(`continuation status kind: ${continuationState.statusKind}`);
  }
  if (restoreBoundary) {
    auditCodes.push("continuation.restore_boundary");
    reasons.push("continuation state is treated as a restore boundary");
  } else {
    auditCodes.push("continuation.not_restore_boundary");
    reasons.push("continuation state is not treated as a restore boundary");
  }

  let projectionMode: ContinuationProjectionMode = "none";
  let taskStatusOverride: string | undefined;
  const continuation = continuationState?.continuation;

  if (!restoreBoundary || !continuation) {
    auditCodes.push("projection.none");
    reasons.push("no projected task-status override will be emitted");
  } else if (continuationState?.statusKind === "done") {
    projectionMode = params.includeNextStepForDone ? "done-with-next-step" : "done-no-next-step";
    auditCodes.push(
      params.includeNextStepForDone
        ? "projection.done_with_next_step"
        : "projection.done_without_next_step",
    );
    taskStatusOverride = buildTaskStatusOverrideFromContinuation({
      statusText: continuation.statusText,
      recentOutcome: continuation.recentOutcome,
      nextStep: params.includeNextStepForDone ? continuation.nextStep : undefined,
    });
    reasons.push(
      params.includeNextStepForDone
        ? "done continuation keeps follow-up next step for this consumer"
        : "done continuation suppresses stale next-step text for this consumer",
    );
  } else if (isBlockedLikeContinuationStatus(continuationState?.statusKind)) {
    projectionMode = "blocked-like";
    auditCodes.push("projection.blocked_like");
    taskStatusOverride = buildTaskStatusOverrideFromContinuation({
      statusText: continuation.statusText,
      recentOutcome: continuation.recentOutcome,
      nextStep: continuation.nextStep,
    });
    reasons.push("blocked-like continuation keeps blocker and next-step context");
  } else {
    projectionMode = "default";
    auditCodes.push("projection.default");
    taskStatusOverride = getDefaultTaskStatusOverrideFromContinuationState(continuationState);
    reasons.push("default projected task-status override applies");
  }

  return {
    taskStatusOverride,
    explanation: {
      meaningful,
      restoreBoundary,
      statusKind: continuationState?.statusKind,
      source: continuationState?.source,
      sourceLabel: continuationState?.sourceLabel,
      projectionMode,
      auditCodes,
      reasons,
    },
  };
}

function buildProjectedTaskStatusOverride(params: {
  continuationState: ContinuationState | null | undefined;
  includeNextStepForDone: boolean;
}): string | undefined {
  return resolveContinuationProjectionDecision(params).taskStatusOverride;
}

export function buildCompactionTaskStatusOverrideFromContinuationState(
  continuationState: ContinuationState | null | undefined,
): string | undefined {
  return buildProjectedTaskStatusOverride({
    continuationState,
    includeNextStepForDone: true,
  });
}

export function buildAttemptTaskStatusOverrideFromContinuationState(
  continuationState: ContinuationState | null | undefined,
): string | undefined {
  return buildProjectedTaskStatusOverride({
    continuationState,
    includeNextStepForDone: true,
  });
}

export function buildReplayTaskStatusOverrideFromContinuationState(
  continuationState: ContinuationState | null | undefined,
): string | undefined {
  return buildProjectedTaskStatusOverride({
    continuationState,
    includeNextStepForDone: false,
  });
}

function buildContinuationAuditPayload(params: {
  consumer: ContinuationAuditPayload["consumer"];
  continuationState: ContinuationState | null | undefined;
  includeNextStepForDone: boolean;
}): ContinuationAuditPayload {
  const decision = resolveContinuationProjectionDecision({
    continuationState: params.continuationState,
    includeNextStepForDone: params.includeNextStepForDone,
  });
  return {
    consumer: params.consumer,
    projectedTaskStatusOverride: decision.taskStatusOverride,
    explanation: decision.explanation,
  };
}

export function buildCompactionContinuationAuditPayload(
  continuationState: ContinuationState | null | undefined,
): ContinuationAuditPayload {
  return buildContinuationAuditPayload({
    consumer: "compaction",
    continuationState,
    includeNextStepForDone: true,
  });
}

export function buildAttemptContinuationAuditPayload(
  continuationState: ContinuationState | null | undefined,
): ContinuationAuditPayload {
  return buildContinuationAuditPayload({
    consumer: "attempt",
    continuationState,
    includeNextStepForDone: true,
  });
}

export function buildReplayContinuationAuditPayload(
  continuationState: ContinuationState | null | undefined,
): ContinuationAuditPayload {
  return buildContinuationAuditPayload({
    consumer: "replay",
    continuationState,
    includeNextStepForDone: false,
  });
}

export function explainContinuationDecision(params: {
  continuationState: ContinuationState | null | undefined;
  includeNextStepForDone: boolean;
}): ContinuationDecisionExplanation {
  return resolveContinuationProjectionDecision(params).explanation;
}

export function explainCompactionContinuationDecision(
  continuationState: ContinuationState | null | undefined,
): ContinuationDecisionExplanation {
  return explainContinuationDecision({
    continuationState,
    includeNextStepForDone: true,
  });
}

export function explainAttemptContinuationDecision(
  continuationState: ContinuationState | null | undefined,
): ContinuationDecisionExplanation {
  return explainContinuationDecision({
    continuationState,
    includeNextStepForDone: true,
  });
}

export function explainReplayContinuationDecision(
  continuationState: ContinuationState | null | undefined,
): ContinuationDecisionExplanation {
  return explainContinuationDecision({
    continuationState,
    includeNextStepForDone: false,
  });
}

export function hasTaskStatusActionabilitySignals(taskStatusBody: string | undefined): boolean {
  const normalized = localeLowercasePreservingWhitespace(taskStatusBody ?? "");
  const hasOutcomeSignal =
    /outcome|result|verified|observed|status|blocked|blocking|waiting|failed|failure|error|done|completed|complete|terminal|pending|ready|unknown|current|状态|更新/u.test(
      normalized,
    );
  const hasNextStepSignal =
    /next|continue|run|edit|check|inspect|update|implement|verify|ask|open|retry|fix|write|share|provide|report|summarize/u.test(
      normalized,
    );
  const hasContinuationRiskSignal =
    /block|waiting|failed|invalid|avoid|do not repeat|don't repeat|stale/u.test(normalized);
  const hasOperationalDensity = normalized.replace(/\s+/gu, " ").trim().length >= 12;
  return hasOperationalDensity && (hasOutcomeSignal || hasContinuationRiskSignal || hasNextStepSignal);
}

export function mergeTaskContinuationDetails(params: {
  details: unknown;
  continuation?: SessionTaskContinuation;
}): unknown {
  if (!params.continuation || Object.keys(params.continuation).length === 0) {
    return params.details;
  }
  const base =
    params.details && typeof params.details === "object" && !Array.isArray(params.details)
      ? (params.details as Record<string, unknown>)
      : {};
  return {
    ...base,
    continuation: params.continuation,
  };
}

export function applyTaskStatusOverrideToSummary(
  summary: string | undefined,
  taskStatusOverride: string | undefined,
): string | undefined {
  const override = taskStatusOverride?.trim();
  if (!override) {
    return summary;
  }
  const normalizedSummary = summary?.trim();
  if (!normalizedSummary) {
    return summary;
  }
  const taskStatusHeading = "## Task status / next step";
  const lines = normalizedSummary.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === taskStatusHeading);
  if (start < 0) {
    return summary;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if ((lines[i] ?? "").trim().startsWith("## ")) {
      end = i;
      break;
    }
  }
  return [...lines.slice(0, start), taskStatusHeading, override, ...lines.slice(end)].join("\n");
}
