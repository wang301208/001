/**
 * 治理层状态类型定义
 */

export interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'frozen';
  children?: AgentNode[];
}

export interface EvolutionProject {
  id: string;
  title: string;
  mutationClass: string;
  status: 'proposed' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt?: number;
}

export interface SandboxExperiment {
  id: string;
  universeId: string;
  title: string;
  status: 'proposed' | 'provisioning' | 'running' | 'observing' | 'completed' | 'rejected' | 'promoted' | 'rolled_back';
  stages: ExperimentStage[];
  createdAt: number;
  updatedAt?: number;
}

export interface ExperimentStage {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
}

export interface FreezeStatus {
  active: boolean;
  reason?: string;
  activatedAt?: number;
  affectedSubsystems: string[];
}

export interface GovernanceStatus {
  sovereigntyBoundary: boolean;
  activeAgents: AgentNode[];
  evolutionProjects: EvolutionProject[];
  sandboxExperiments: SandboxExperiment[];
  freezeActive: boolean;
  freezeStatus?: FreezeStatus;
}

export interface ChannelStatus {
  id: string;
  type: string;
  name: string;
  connected: boolean;
  lastActivity?: number;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}
