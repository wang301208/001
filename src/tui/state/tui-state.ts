import type { AgentSummary, SessionInfo, SessionScope, QueuedMessage } from "../tui-types.js";
import type { GovernanceStatus } from "../tui-governance-panel.js";

export type TuiState = {
  agentDefaultId: string;
  sessionMainKey: string;
  sessionScope: SessionScope;
  agents: AgentSummary[];
  currentAgentId: string;
  currentSessionKey: string;
  currentSessionId: string | null;
  activeChatRunId: string | null;
  pendingOptimisticUserMessage: boolean;
  historyLoaded: boolean;
  sessionInfo: SessionInfo;
  initialSessionApplied: boolean;
  isConnected: boolean;
  autoMessageSent: boolean;
  toolsExpanded: boolean;
  showThinking: boolean;
  connectionStatus: string;
  activityStatus: string;
  queuedMessages: QueuedMessage[];
  governanceStatus: GovernanceStatus | null;
  showGovernancePanel: boolean;
  lastCtrlCAt: number;
  exitRequested: boolean;
};

export type TuiStateKey = keyof TuiState;

export type TuiStateChangeEntry = {
  key: TuiStateKey;
  prevValue: unknown;
  nextValue: unknown;
  reason: string | undefined;
  timestamp: number;
};

export type TuiStateListener = (prevValue: unknown, nextValue: unknown) => void;

export type TuiComputedEntry<K extends string, V> = {
  key: K;
  compute: (state: TuiState) => V;
};
