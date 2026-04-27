export const EXEC_TOOL_DISPLAY_SUMMARY = "Run shell commands that start now.";
export const PROCESS_TOOL_DISPLAY_SUMMARY = "Inspect and control running exec sessions.";
export const CRON_TOOL_DISPLAY_SUMMARY = "Schedule cron jobs, reminders, and wake events.";
export const SESSIONS_LIST_TOOL_DISPLAY_SUMMARY =
  "List visible sessions and optional recent messages.";
export const SESSIONS_HISTORY_TOOL_DISPLAY_SUMMARY =
  "Read sanitized message history for a visible session.";
export const SESSIONS_SEND_TOOL_DISPLAY_SUMMARY = "Send a message to another visible session.";
export const SESSIONS_SPAWN_TOOL_DISPLAY_SUMMARY = "Spawn sub-agent or ACP sessions.";
export const SESSION_STATUS_TOOL_DISPLAY_SUMMARY = "Show session status, usage, and model state.";
export const AUTONOMY_TOOL_DISPLAY_SUMMARY =
  "Inspect autonomy profiles, supervise fleet convergence, and start managed autonomy flows.";
export const GOVERNANCE_TOOL_DISPLAY_SUMMARY =
  "Inspect or mutate the charter proposal ledger, governance freeze state, and agent contracts.";
export const UPDATE_PLAN_TOOL_DISPLAY_SUMMARY = "Track a short structured work plan.";

export function describeSessionsListTool(): string {
  return [
    "List visible sessions with optional filters for kind, recent activity, and last messages.",
    "Use this to discover a target session before calling sessions_history or sessions_send.",
  ].join(" ");
}

export function describeSessionsHistoryTool(): string {
  return [
    "Fetch sanitized message history for a visible session.",
    "Supports limits and optional tool messages; use this to inspect another session before replying, debugging, or resuming work.",
  ].join(" ");
}

export function describeSessionsSendTool(): string {
  return [
    "Send a message into another visible session by sessionKey or label.",
    "Use this to delegate follow-up work to an existing session; waits for the target run and returns the updated assistant reply when available.",
  ].join(" ");
}

export function describeSessionsSpawnTool(): string {
  return [
    'Spawn an isolated session with `runtime="subagent"` or `runtime="acp"`.',
    '`mode="run"` is one-shot and `mode="session"` is persistent or thread-bound.',
    "Subagents inherit the parent workspace directory automatically.",
    "Use this when the work should happen in a fresh child session instead of the current one.",
  ].join(" ");
}

export function describeSessionStatusTool(): string {
  return [
    "Show a /status-equivalent session status card for the current or another visible session, including usage, time, cost when available, and linked background task context.",
    "Optional `model` sets a per-session model override; `model=default` resets overrides.",
    "Use this for questions like what model is active or how a session is configured.",
  ].join(" ");
}

export function describeAutonomyTool(): string {
  return [
    "List supported autonomy profiles, inspect a specific governance-backed autonomy profile, heal or supervise a scoped fleet, or start a managed autonomy flow bound to the current session.",
    "Use this to launch Founder, Strategist, or Librarian autonomy loops, reconcile governed loop drift, and run a one-shot supervision pass that can synthesize or apply governance repairs automatically.",
  ].join(" ");
}

export function describeGovernanceTool(): string {
  return [
    "Inspect the organizational charter control plane, including freeze state, charter artifacts, governance findings, capability inventory, capability asset registry drift, genesis planning state, proposal ledger state, team posture, and per-agent governance contracts.",
    "Use this when an agent must verify its authority, collaborators, or current governance constraints before mutating the system, or when it needs to create, review, apply, or revert governed charter proposals.",
  ].join(" ");
}

export function describeUpdatePlanTool(): string {
  return [
    "Update the current structured work plan for this run.",
    "Use this for non-trivial multi-step work so the plan stays current while execution continues.",
    "Keep steps short, mark at most one step as `in_progress`, and skip this tool for simple one-step tasks.",
  ].join(" ");
}
