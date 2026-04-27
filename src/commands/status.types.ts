import type { ChannelId } from "../channels/plugins/types.public.js";
import type { AgentToolGovernanceSummary } from "../governance/tool-governance-summary.js";
import type { TaskAuditSummary } from "../tasks/task-registry.audit.js";
import type { TaskRegistrySummary } from "../tasks/task-registry.types.js";

export type SessionStatus = {
  agentId?: string;
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  sessionId?: string;
  updatedAt: number | null;
  age: number | null;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
  traceLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number | null;
  totalTokensFresh: boolean;
  cacheRead?: number;
  cacheWrite?: number;
  remainingTokens: number | null;
  percentUsed: number | null;
  model: string | null;
  contextTokens: number | null;
  flags: string[];
};

export type HeartbeatStatus = {
  agentId: string;
  name?: string;
  configured?: boolean;
  governance?: AgentToolGovernanceSummary;
  enabled: boolean;
  every: string;
  everyMs: number | null;
};

export type StatusCapabilitySummary = {
  requestedAgentIds: string[];
  totalEntries: number;
  gapCount: number;
  criticalGapCount: number;
  warningGapCount: number;
  infoGapCount: number;
  topGapIds: string[];
};

export type StatusGenesisSummary = {
  teamId: string;
  teamTitle?: string;
  mode: "repair" | "build" | "steady_state";
  blockerCount: number;
  blockers: string[];
  focusGapIds: string[];
  stageCounts: {
    ready: number;
    waiting: number;
    blocked: number;
  };
};

export type StatusGovernanceTeamSummary = {
  teamId: string;
  declared: boolean;
  memberCount: number;
  missingMemberCount: number;
  missingMemberIds: string[];
  freezeActiveMemberCount: number;
  freezeActiveMemberIds: string[];
  runtimeHookCount: number;
  effectiveToolDenyCount: number;
};

export type StatusGovernanceSnapshot = {
  observedAt: number;
  discovered: boolean;
  freezeActive: boolean;
  freezeReasonCode?: string;
  proposalSummary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    applied: number;
  };
  findingSummary: {
    critical: number;
    warn: number;
    info: number;
  };
  capabilitySummary: StatusCapabilitySummary;
  genesisSummary: StatusGenesisSummary;
  teamSummary?: StatusGovernanceTeamSummary;
};

export type StatusAutonomySnapshot = {
  observedAt: number;
  fleetSummary: {
    totalProfiles: number;
    healthy: number;
    idle: number;
    drift: number;
    missingLoop: number;
    activeFlows: number;
    driftAgentIds: string[];
    missingLoopAgentIds: string[];
  };
  replaySummary?: {
    totalRunners: number;
    ready: number;
    passed: number;
    failed: number;
    promotable: number;
    blocked: number;
    readyAgentIds: string[];
    promotableAgentIds: string[];
    blockedAgentIds: string[];
  };
  capabilitySummary: StatusCapabilitySummary;
  genesisSummary: StatusGenesisSummary;
  lastSupervisorRun?: {
    observedAt: number;
    mode: "heal" | "reconcile";
    changed: boolean;
    agentIds: string[];
    changedAgentIds: string[];
    totals: {
      totalProfiles: number;
      changed: number;
      unchanged: number;
      loopCreated: number;
      loopUpdated: number;
      flowStarted: number;
      flowRestarted: number;
    };
  };
};

export type StatusSummary = {
  runtimeVersion?: string | null;
  linkChannel?: {
    id: ChannelId;
    label: string;
    linked: boolean;
    authAgeMs: number | null;
  };
  heartbeat: {
    defaultAgentId: string;
    agents: HeartbeatStatus[];
  };
  channelSummary: string[];
  queuedSystemEvents: string[];
  governance?: StatusGovernanceSnapshot;
  autonomy?: StatusAutonomySnapshot;
  tasks: TaskRegistrySummary;
  taskAudit: TaskAuditSummary;
  sessions: {
    paths: string[];
    count: number;
    defaults: { model: string | null; contextTokens: number | null };
    recent: SessionStatus[];
    byAgent: Array<{
      agentId: string;
      name?: string;
      configured?: boolean;
      governance?: AgentToolGovernanceSummary;
      path: string;
      count: number;
      recent: SessionStatus[];
    }>;
  };
};
