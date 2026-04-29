import { loadConfig } from "../config/config.js";
import { info } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { listTasksForFlowId } from "../tasks/runtime-internal.js";
import {
  cancelFlowById,
  getFlowTaskSummary,
  retryBlockedFlowAsQueuedTaskRun,
} from "../tasks/task-executor.js";
import type { TaskFlowRecord, TaskFlowStatus } from "../tasks/task-flow-registry.types.js";
import {
  getTaskFlowById,
  listTaskFlowRecords,
  resolveTaskFlowForLookupToken,
} from "../tasks/task-flow-runtime-internal.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";
import { isRich, theme } from "../terminal/theme.js";

const ID_PAD = 10;
const STATUS_PAD = 10;
const MODE_PAD = 14;
const REV_PAD = 6;
const CTRL_PAD = 20;

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 1) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 1)}…`;
}

function safeFlowDisplayText(value: string | undefined, maxChars?: number): string {
  const sanitized = sanitizeTerminalText(value ?? "").trim();
  if (!sanitized) {
    return "n/a";
  }
  return typeof maxChars === "number" ? truncate(sanitized, maxChars) : sanitized;
}

function shortToken(value: string | undefined, maxChars = ID_PAD): string {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return "n/a";
  }
  return truncate(trimmed, maxChars);
}

function formatFlowStatusCell(status: TaskFlowStatus, rich: boolean) {
  const padded = status.padEnd(STATUS_PAD);
  if (!rich) {
    return padded;
  }
  if (status === "succeeded") {
    return theme.success(padded);
  }
  if (status === "failed" || status === "lost") {
    return theme.error(padded);
  }
  if (status === "running") {
    return theme.accentBright(padded);
  }
  if (status === "blocked") {
    return theme.warn(padded);
  }
  return theme.muted(padded);
}

function formatFlowRows(flows: TaskFlowRecord[], rich: boolean) {
  const header = [
    "TaskFlow".padEnd(ID_PAD),
    "Mode".padEnd(MODE_PAD),
    "Status".padEnd(STATUS_PAD),
    "Rev".padEnd(REV_PAD),
    "Controller".padEnd(CTRL_PAD),
    "Tasks".padEnd(14),
    "Goal",
  ].join(" ");
  const lines = [rich ? theme.heading(header) : header];
  for (const flow of flows) {
    const taskSummary = getFlowTaskSummary(flow.flowId);
    const counts = `${taskSummary.active} active/${taskSummary.total} total`;
    lines.push(
      [
        shortToken(flow.flowId).padEnd(ID_PAD),
        flow.syncMode.padEnd(MODE_PAD),
        formatFlowStatusCell(flow.status, rich),
        String(flow.revision).padEnd(REV_PAD),
        safeFlowDisplayText(flow.controllerId, CTRL_PAD).padEnd(CTRL_PAD),
        counts.padEnd(14),
        safeFlowDisplayText(flow.goal, 80),
      ].join(" "),
    );
  }
  return lines;
}

function formatFlowListSummary(flows: TaskFlowRecord[]) {
  const active = flows.filter(
    (flow) => flow.status === "queued" || flow.status === "running",
  ).length;
  const blocked = flows.filter((flow) => flow.status === "blocked").length;
  const cancelRequested = flows.filter((flow) => flow.cancelRequestedAt != null).length;
  return `${active} active · ${blocked} blocked · ${cancelRequested} cancel-requested · ${flows.length} total`;
}

function summarizeWait(flow: TaskFlowRecord): string {
  if (flow.waitJson == null) {
    return "n/a";
  }
  if (
    typeof flow.waitJson === "string" ||
    typeof flow.waitJson === "number" ||
    typeof flow.waitJson === "boolean"
  ) {
    return String(flow.waitJson);
  }
  if (Array.isArray(flow.waitJson)) {
    return `array(${flow.waitJson.length})`;
  }
  return Object.keys(flow.waitJson).toSorted().join(", ") || "object";
}

function summarizeFlowState(flow: TaskFlowRecord): string | null {
  if (flow.status === "blocked") {
    if (flow.blockedSummary) {
      return flow.blockedSummary;
    }
    if (flow.blockedTaskId) {
      return `blocked by ${flow.blockedTaskId}`;
    }
    return "blocked";
  }
  if (flow.status === "waiting" && flow.waitJson != null) {
    return summarizeWait(flow);
  }
  return null;
}

const MAX_MANAGED_FLOW_AUTO_RETRIES = 2;
const AUTO_RETRY_REASON_HINTS = [
  /writable session/i,
  /authorization required/i,
  /permission denied/i,
];

function readFlowAutoRetryAttempts(flow: TaskFlowRecord): number {
  const state = flow.stateJson;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return 0;
  }
  const autoRetry = (state as { autoRetry?: { attempts?: number } }).autoRetry;
  return typeof autoRetry?.attempts === "number" ? autoRetry.attempts : 0;
}

export function shouldAutoRetryBlockedFlow(flow: TaskFlowRecord): boolean {
  if (flow.cancelRequestedAt != null) {
    return false;
  }
  if (flow.status !== "blocked") {
    return false;
  }
  if (readFlowAutoRetryAttempts(flow) >= MAX_MANAGED_FLOW_AUTO_RETRIES) {
    return false;
  }
  if (!flow.blockedTaskId && !flow.blockedSummary) {
    return false;
  }
  const reason = flow.blockedSummary?.trim() || flow.currentStep?.trim() || "";
  if (!reason) {
    return false;
  }
  if (/waiting on child task output/i.test(reason)) {
    return listTasksForFlowId(flow.flowId).length > 0;
  }
  return AUTO_RETRY_REASON_HINTS.some((pattern) => pattern.test(reason));
}

function describeFlowContinuationDecision(flow: TaskFlowRecord): {
  action: "resume" | "wait" | "report" | "done" | "cancelled";
  reason: string;
  autoRetryEligible: boolean;
} {
  if (flow.cancelRequestedAt != null) {
    return {
      action: "cancelled",
      reason: "Cancellation has been requested for this flow.",
      autoRetryEligible: false,
    };
  }
  if (flow.status === "queued" || flow.status === "running") {
    return {
      action: "resume",
      reason: flow.currentStep?.trim() || "Continue the active flow.",
      autoRetryEligible: false,
    };
  }
  if (flow.status === "waiting") {
    return {
      action: "wait",
      reason:
        flow.currentStep?.trim() ||
        "Wait for the required condition or external input before resuming.",
      autoRetryEligible: false,
    };
  }
  if (flow.status === "blocked") {
    const reason =
      flow.blockedSummary?.trim() ||
      flow.currentStep?.trim() ||
      "The flow is blocked and needs intervention before it can resume.";
    const autoRetryEligible = shouldAutoRetryBlockedFlow(flow);
    const attempts = readFlowAutoRetryAttempts(flow);
    if (autoRetryEligible) {
      return {
        action: "resume",
        reason: `${reason} Auto-retry is allowed for this blocker.`,
        autoRetryEligible,
      };
    }
    if (attempts >= MAX_MANAGED_FLOW_AUTO_RETRIES) {
      return {
        action: "report",
        reason: `${reason} Auto-retry budget exhausted; report or intervene manually.`,
        autoRetryEligible,
      };
    }
    return {
      action: "report",
      reason: `${reason} Auto-retry is not allowed for this blocker; review and intervene manually.`,
      autoRetryEligible,
    };
  }
  if (flow.status === "succeeded") {
    return {
      action: "done",
      reason: flow.currentStep?.trim() || "The flow has completed successfully.",
      autoRetryEligible: false,
    };
  }
  if (flow.status === "failed" || flow.status === "lost") {
    return {
      action: "report",
      reason:
        flow.currentStep?.trim() || "The flow ended in a non-success state and should be reviewed.",
      autoRetryEligible: false,
    };
  }
  return {
    action: "cancelled",
    reason: flow.currentStep?.trim() || "The flow will not continue.",
    autoRetryEligible: false,
  };
}

export async function flowsListCommand(
  opts: { json?: boolean; status?: string },
  runtime: RuntimeEnv,
) {
  const statusFilter = opts.status?.trim();
  const flows = listTaskFlowRecords().filter((flow) => {
    if (statusFilter && flow.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          count: flows.length,
          status: statusFilter ?? null,
          flows: flows.map((flow) => ({
            ...flow,
            continuationDecision: describeFlowContinuationDecision(flow),
            tasks: listTasksForFlowId(flow.flowId),
            taskSummary: getFlowTaskSummary(flow.flowId),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(info(`TaskFlows: ${flows.length}`));
  runtime.log(info(`TaskFlow pressure: ${formatFlowListSummary(flows)}`));
  if (statusFilter) {
    runtime.log(info(`Status filter: ${statusFilter}`));
  }
  if (flows.length === 0) {
    runtime.log("No TaskFlows found.");
    return;
  }
  const rich = isRich();
  for (const line of formatFlowRows(flows, rich)) {
    runtime.log(line);
  }
}

export async function flowsShowCommand(
  opts: { json?: boolean; lookup: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveTaskFlowForLookupToken(opts.lookup);
  if (!flow) {
    runtime.error(`TaskFlow not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const tasks = listTasksForFlowId(flow.flowId);
  const taskSummary = getFlowTaskSummary(flow.flowId);
  const stateSummary = summarizeFlowState(flow);

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          ...flow,
          tasks,
          taskSummary,
        },
        null,
        2,
      ),
    );
    return;
  }

  const continuationDecision = describeFlowContinuationDecision(flow);
  const lines = [
    "TaskFlow:",
    `flowId: ${flow.flowId}`,
    `status: ${flow.status}`,
    `goal: ${safeFlowDisplayText(flow.goal)}`,
    `currentStep: ${safeFlowDisplayText(flow.currentStep)}`,
    `nextAction: ${safeFlowDisplayText(continuationDecision.action)}`,
    `nextReason: ${safeFlowDisplayText(continuationDecision.reason)}`,
    `autoRetryEligible: ${continuationDecision.autoRetryEligible ? "yes" : "no"}`,
    `owner: ${safeFlowDisplayText(flow.ownerKey)}`,
    `notify: ${flow.notifyPolicy}`,
    ...(stateSummary ? [`state: ${safeFlowDisplayText(stateSummary)}`] : []),
    ...(flow.cancelRequestedAt
      ? [`cancelRequestedAt: ${new Date(flow.cancelRequestedAt).toISOString()}`]
      : []),
    `createdAt: ${new Date(flow.createdAt).toISOString()}`,
    `updatedAt: ${new Date(flow.updatedAt).toISOString()}`,
    `endedAt: ${flow.endedAt ? new Date(flow.endedAt).toISOString() : "n/a"}`,
    `tasks: ${taskSummary.total} total · ${taskSummary.active} active · ${taskSummary.failures} issues`,
  ];
  for (const line of lines) {
    runtime.log(line);
  }
  if (tasks.length === 0) {
    runtime.log("Linked tasks: none");
    return;
  }
  runtime.log("Linked tasks:");
  for (const task of tasks) {
    const safeLabel = safeFlowDisplayText(task.label ?? task.task);
    runtime.log(`- ${task.taskId} ${task.status} ${task.runId ?? "n/a"} ${safeLabel}`);
  }
}

export async function flowsCancelCommand(opts: { lookup: string }, runtime: RuntimeEnv) {
  const flow = resolveTaskFlowForLookupToken(opts.lookup);
  if (!flow) {
    runtime.error(`Flow not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = await cancelFlowById({
    cfg: loadConfig(),
    flowId: flow.flowId,
  });
  if (!result.found) {
    runtime.error(result.reason ?? `Flow not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  if (!result.cancelled) {
    runtime.error(result.reason ?? `Could not cancel TaskFlow: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const updated = getTaskFlowById(flow.flowId) ?? result.flow ?? flow;
  runtime.log(`Cancelled ${updated.flowId} (${updated.syncMode}) with status ${updated.status}.`);
}

export async function flowsRetryCommand(opts: { lookup: string }, runtime: RuntimeEnv) {
  const flow = resolveTaskFlowForLookupToken(opts.lookup);
  if (!flow) {
    runtime.error(`Flow not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = retryBlockedFlowAsQueuedTaskRun({
    flowId: flow.flowId,
  });
  if (!result.found) {
    runtime.error(result.reason ?? `Flow not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  if (!result.retried || !result.task) {
    const updated = getTaskFlowById(flow.flowId) ?? flow;
    const activeTask = listTasksForFlowId(flow.flowId).find(
      (task) => task.status === "queued" || task.status === "running",
    );
    if (
      activeTask &&
      (updated.status === "queued" || updated.status === "running") &&
      (result.reason === "Latest TaskFlow task is not blocked." ||
        result.reason === "Flow is not blocked.")
    ) {
      runtime.log(
        `Retried ${updated.flowId} as queued task ${activeTask.taskId} (parent ${activeTask.parentTaskId ?? "n/a"}) with status ${updated.status}.`,
      );
      return;
    }
    runtime.error(result.reason ?? `Could not retry TaskFlow: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const updated = getTaskFlowById(flow.flowId) ?? flow;
  runtime.log(
    `Retried ${updated.flowId} as queued task ${result.task.taskId} (parent ${result.task.parentTaskId ?? "n/a"}) with status ${updated.status}.`,
  );
}
