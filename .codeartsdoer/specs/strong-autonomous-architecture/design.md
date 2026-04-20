# 强自治目标架构方案 - 技术设计文档

## 文档信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 状态 | 草稿 |
| 创建日期 | 2025-04-20 |
| 功能名称 | strong-autonomous-architecture |
| 对应需求 | spec.md v1.0.0 |

---

## 1. 架构概览

### 1.1 设计目标

将 OpenClaw 从"AI网关+多代理工具集"升级为"强自治AI操作系统"，实现：
- 六大核心层次的结构化实现
- 三个基础闭环的打通
- 沙盒宇宙的安全试错机制
- 六阶段迁移路径的落地

### 1.2 技术栈

| 层次 | 技术选型 |
|------|----------|
| 语言 | TypeScript 5.x |
| 运行时 | Node.js 20+ |
| 配置格式 | YAML 1.2 |
| 数据存储 | SQLite (task-registry/flow-registry) |
| 事件系统 | 进程内 Event Bus |
| 测试框架 | Vitest |

### 1.3 核心架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              交互层 (Interaction Layer)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Frontend App │  │ Presence Core│  │ Multimodal I/O│  │   Persona    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          API与通信层 (API & Communication)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │Gateway Fabric│  │ACP ControlPlane│ │  Event Bus   │  │ Audit Stream │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              执行层 (Execution Layer)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Executor   │  │Operator Swarm│  │   Task OS    │  │Autonomous    │    │
│  │              │  │              │  │              │  │  Scheduler   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              能力层 (Capability Layer)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│  │Skill Library│ │Plugin Lib  │ │Memory Fabric│ │Strategy    │ │Algorithm │  │
│  │            │ │            │ │            │ │Assets      │ │Library   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └──────────┘  │
│                              ┌──────────────────────────────────┐           │
│                              │           Librarian              │           │
│                              └──────────────────────────────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│                              进化层 (Evolution Layer)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Founder    │  │  Strategist  │  │ Algorithmist │  │ Genesis Team │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              治理层 (Governance Layer)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │Human Sovereign│  │   Charter    │  │ Ethical Core │  │Sovereignty   │    │
│  │              │  │   Library    │  │              │  │  Auditor     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 模块设计

### 2.1 治理层模块设计

#### 2.1.1 CharterLoader - 宪章加载器

**职责**: 加载和验证 `governance/charter/` 目录下的所有宪章配置文件

**接口定义**:

```typescript
// src/governance/charter-loader.ts

interface CharterConfig {
  version: number;
  charter_id: string;
  title: string;
  mode: 'strong-autonomy' | 'conservative';
  status: 'draft' | 'active' | 'deprecated';
  constitutional_principles: ConstitutionalPrinciple[];
  sovereign_boundaries: SovereignBoundaries;
  institutional_layers: InstitutionalLayers;
  mutation_classes: MutationClass[];
  promotion_pipeline: PromotionPipeline;
}

interface CharterLoader {
  load(charterDir: string): Promise<CharterConfig>;
  validate(config: CharterConfig): ValidationResult;
  getAgentBlueprint(agentId: string): AgentBlueprint;
  getPolicy(policyId: string): PolicyConfig;
}
```

**实现要点**:
- 使用 YAML 解析器加载配置文件
- 启动时验证所有必填字段
- 缓存已加载的宪章配置
- 支持热重载（开发模式）

**依赖关系**:
- 依赖: `js-yaml` (YAML 解析)
- 被依赖: `SovereigntyAuditor`, `EthicalCore`, `ACPControlPlane`

#### 2.1.2 EthicalCore - 伦理与安全核心

**职责**: 运行时强制规则执行，防止绕过主权边界

**接口定义**:

```typescript
// src/governance/ethical-core.ts

interface EthicalRule {
  id: string;
  description: string;
  check: (context: OperationContext) => boolean;
  onViolation: (context: OperationContext) => EnforcementAction;
}

interface EthicalCore {
  registerRule(rule: EthicalRule): void;
  checkOperation(context: OperationContext): EthicalCheckResult;
  enforce(action: EnforcementAction): void;
}

// 内置规则
const BUILTIN_RULES: EthicalRule[] = [
  {
    id: 'no-root-privilege-escalation',
    description: '禁止绕过宪章升级自身根权限',
    check: (ctx) => !ctx.operation.type.includes('root_privilege_expansion') || ctx.hasSovereignApproval,
    onViolation: (ctx) => ({ type: 'reject', logSecurityEvent: true })
  },
  {
    id: 'no-audit-tampering',
    description: '禁止删除或伪造审计记录',
    check: (ctx) => !ctx.operation.type.includes('audit_delete') && !ctx.operation.type.includes('audit_forge'),
    onViolation: (ctx) => ({ type: 'reject', logSecurityEvent: true, freezeAgent: true })
  },
  {
    id: 'no-silent-network-expansion',
    description: '禁止静默扩大对外执行与网络访问边界',
    check: (ctx) => !ctx.operation.type.includes('network_expansion') || ctx.hasSovereignApproval,
    onViolation: (ctx) => ({ type: 'reject', logSecurityEvent: true })
  },
  {
    id: 'no-sovereign-config-modification',
    description: '禁止未通过主权审批即修改主权级配置',
    check: (ctx) => !ctx.operation.target.includes('sovereign_config') || ctx.hasSovereignApproval,
    onViolation: (ctx) => ({ type: 'reject', logSecurityEvent: true })
  }
];
```

**实现要点**:
- 所有规则在操作执行前检查
- 违规时记录安全事件并执行强制动作
- 规则不可被运行时修改（仅通过宪章更新）

#### 2.1.3 SovereigntyAuditor - 主权审计器

**职责**: 独立运行，持续检查权限漂移、组织漂移、策略漂移

**接口定义**:

```typescript
// src/governance/sovereignty-auditor.ts

interface DriftDetection {
  type: 'permission' | 'organization' | 'policy';
  severity: 'info' | 'high' | 'critical';
  description: string;
  evidence: DriftEvidence;
  timestamp: Date;
}

interface SovereigntyAuditor {
  start(): void;
  stop(): void;
  scan(): Promise<DriftDetection[]>;
  onDriftDetected(callback: (drift: DriftDetection) => void): void;
  freezeSubsystem(subsystemId: string): Promise<void>;
  preserveForensicSnapshot(drift: DriftDetection): Promise<string>;
}
```

**实现要点**:
- 作为独立进程或独立调度任务运行
- 定期扫描（默认间隔 60 秒）
- 发现越界时自动冻结相关子系统
- 保留取证快照用于事后分析

**漂移检测逻辑**:

```typescript
async function detectPermissionDrift(): Promise<DriftDetection[]> {
  const currentPermissions = await getCurrentAgentPermissions();
  const charteredPermissions = await getCharteredPermissions();
  
  return currentPermissions
    .filter(p => !isInCharter(p, charteredPermissions))
    .map(p => ({
      type: 'permission',
      severity: 'high',
      description: `Agent ${p.agentId} has unchartered permission: ${p.permission}`,
      evidence: { agentId: p.agentId, permission: p.permission },
      timestamp: new Date()
    }));
}
```

#### 2.1.4 SovereignApproval - 主权审批流程

**职责**: 处理需要人类主权者批准的操作

**接口定义**:

```typescript
// src/governance/sovereign-approval.ts

interface SovereignRequest {
  id: string;
  type: 'charter_amendment' | 'root_privilege' | 'high_risk_network' | 'system_control';
  description: string;
  requester: AgentId;
  evidence: RequestEvidence;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

interface SovereignApproval {
  createRequest(type: SovereignRequestType, payload: unknown): Promise<SovereignRequest>;
  approve(requestId: string, sovereignId: string): Promise<void>;
  reject(requestId: string, sovereignId: string, reason: string): Promise<void>;
  getPendingRequests(): Promise<SovereignRequest[]>;
  checkApproval(requestId: string): Promise<ApprovalStatus>;
}
```

**实现要点**:
- 主权请求通过 Presence Core 主动通知人类
- 请求有超时机制（默认 24 小时）
- 批准/拒绝记录到审计流

---

### 2.2 进化层模块设计

#### 2.2.1 Founder - 组织演化代理

**职责**: 检测系统瓶颈，提议组织变更

**接口定义**:

```typescript
// src/evolution/founder.ts

interface OrganizationChangeProposal {
  id: string;
  type: 'new_agent' | 'merge_agents' | 'split_agent' | 'jurisdiction_change';
  description: string;
  rationale: string;
  affectedAgents: AgentId[];
  sandboxValidationRequired: boolean;
  requiresSovereignApproval: boolean;
}

interface Founder {
  scanOrganization(): Promise<OrganizationHealth>;
  detectBottlenecks(): Promise<Bottleneck[]>;
  generateProposal(bottleneck: Bottleneck): Promise<OrganizationChangeProposal>;
  submitToSandbox(proposal: OrganizationChangeProposal): Promise<SandboxExperiment>;
  requestPromotionVote(experiment: SandboxExperiment): Promise<void>;
}
```

**运行模式**:

```typescript
const FOUNDER_LOOP = {
  intervals: {
    org_scan: '1h',
    bottleneck_detection: '30m',
    proposal_generation: 'on_detection'
  },
  outputs: [
    'organization_change_proposal',
    'evolution_project_brief',
    'promotion_vote_request',
    'system_bottleneck_map'
  ]
};
```

#### 2.2.2 Strategist - 策略演化代理

**职责**: 分析历史数据，提炼执行策略

**接口定义**:

```typescript
// src/evolution/strategist.ts

interface StrategyAsset {
  id: string;
  type: 'task_decomposition' | 'subagent_calling' | 'qa_pattern' | 'recovery' | 'risk_handling';
  version: string;
  template: StrategyTemplate;
  performance: PerformanceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

interface Strategist {
  analyzeHistory(timeRange: TimeRange): Promise<HistoryAnalysis>;
  extractPatterns(analysis: HistoryAnalysis): Promise<StrategyPattern[]>;
  generateStrategyAsset(pattern: StrategyPattern): Promise<StrategyAsset>;
  validateInSandbox(asset: StrategyAsset): Promise<SandboxValidation>;
  registerWithLibrarian(asset: StrategyAsset): Promise<void>;
}
```

#### 2.2.3 Algorithmist - 算法演化代理

**职责**: 算法版本迭代和性能对比

**接口定义**:

```typescript
// src/evolution/algorithmist.ts

interface AlgorithmAsset {
  id: string;
  category: 'retrieval' | 'memory_selection' | 'compaction' | 'agent_selection' | 'task_ranking' | 'qa_evaluation';
  version: string;
  implementation: AlgorithmImplementation;
  benchmarks: BenchmarkResult[];
}

interface AlgorithmExperiment {
  id: string;
  algorithmId: string;
  oldVersion: string;
  newVersion: string;
  testCases: TestCase[];
  results: ComparisonResult;
}

interface Algorithmist {
  detectAlgorithmBottlenecks(): Promise<AlgorithmBottleneck[]>;
  proposeResearch(bottleneck: AlgorithmBottleneck): Promise<ResearchProposal>;
  runExperiment(proposal: ResearchProposal): Promise<AlgorithmExperiment>;
  comparePerformance(experiment: AlgorithmExperiment): Promise<ComparisonResult>;
  generateUpgradeSuggestion(result: ComparisonResult): Promise<UpgradeSuggestion>;
}
```

#### 2.2.4 GenesisTeam - 工具与能力演化团队

**职责**: 自动开发技能、插件、代理

**接口定义**:

```typescript
// src/evolution/genesis-team.ts

interface GenesisTeam {
  sentinel: Sentinel;
  archaeologist: Archaeologist;
  tddDeveloper: TDDDeveloper;
  qa: QA;
  publisher: Publisher;
}

// Sentinel - 监测缺口、故障和风险
interface Sentinel {
  scan(): Promise<IssueDetection[]>;
  classify(issue: IssueDetection): IssueClassification;
  triggerArchaeologist(issue: IssueDetection): void;
}

// Archaeologist - 定位根因与依赖结构
interface Archaeologist {
  analyze(issue: IssueDetection): Promise<RootCauseAnalysis>;
  identifyDependencies(analysis: RootCauseAnalysis): Promise<DependencyStructure>;
  generateFixProposal(analysis: RootCauseAnalysis): Promise<FixProposal>;
}

// TDDDeveloper - 编写或修改技能、插件、代码
interface TDDDeveloper {
  developSkill(proposal: FixProposal): Promise<SkillDraft>;
  developPlugin(proposal: FixProposal): Promise<PluginDraft>;
  writeTests(draft: SkillDraft | PluginDraft): Promise<TestSuite>;
}

// QA - 建立验证方案并做回归
interface QA {
  validate(draft: AssetDraft): Promise<QAResult>;
  runRegression(draft: AssetDraft): Promise<RegressionResult>;
  generateReport(result: QAResult): Promise<QAReport>;
}

// Publisher - 将通过验收的能力资产登记入库
interface Publisher {
  publish(asset: ValidatedAsset): Promise<PublishResult>;
  registerWithLibrarian(asset: ValidatedAsset): Promise<void>;
}
```

**Genesis Team 工作流**:

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌────┐    ┌──────────┐
│ Sentinel│───>│Archaeologist │───>│TDD Developer│───>│ QA │───>│ Publisher│
└─────────┘    └──────────────┘    └─────────────┘    └────┘    └──────────┘
     │                │                   │            │           │
     v                v                   v            v           v
  Issue          Root Cause          Draft        Validation   Published
 Detection        Analysis                         Report       Asset
```

---

### 2.3 能力层模块设计

#### 2.3.1 Librarian - 资产管理员

**职责**: 统一管理所有能力资产

**接口定义**:

```typescript
// src/capability/librarian.ts

interface Asset {
  id: string;
  type: 'skill' | 'plugin' | 'memory' | 'strategy' | 'algorithm' | 'agent_blueprint';
  version: string;
  name: string;
  description: string;
  manifest: AssetManifest;
  dependencies: AssetDependency[];
  status: 'active' | 'deprecated' | 'sandbox';
  createdAt: Date;
  updatedAt: Date;
}

interface AssetIndex {
  byId: Map<string, Asset>;
  byType: Map<AssetType, Set<string>>;
  byName: Map<string, string>;
  byDependency: Map<string, Set<string>>;
}

interface Librarian {
  // 索引和检索
  index(asset: Asset): void;
  search(query: AssetQuery): Promise<Asset[]>;
  getById(id: string): Promise<Asset | null>;
  getByName(name: string): Promise<Asset | null>;
  getByType(type: AssetType): Promise<Asset[]>;
  
  // 注册和发布
  register(draft: AssetDraft): Promise<Asset>;
  validate(draft: AssetDraft): Promise<ValidationResult>;
  
  // 去重检查
  checkDuplicate(draft: AssetDraft): Promise<DuplicateCheck>;
  
  // 版本管理
  getVersionHistory(assetId: string): Promise<AssetVersion[]>;
  rollback(assetId: string, version: string): Promise<void>;
  
  // 依赖分析
  getDependents(assetId: string): Promise<Asset[]>;
  checkImpact(assetId: string): Promise<ImpactAnalysis>;
  
  // 归档和下线
  archive(assetId: string): Promise<void>;
  deprecate(assetId: string, reason: string): Promise<void>;
}
```

**资产存储结构**:

```
data/
  assets/
    skills/
      {skill-id}/
        v1.0.0.yaml
        v1.0.1.yaml
        current -> v1.0.1.yaml
    plugins/
      {plugin-id}/
        v1.0.0.yaml
        current -> v1.0.0.yaml
    strategy/
      {strategy-id}/
        v1.0.0.yaml
        current -> v1.0.0.yaml
    algorithms/
      {algorithm-id}/
        v1.0.0.yaml
        v2.0.0.yaml
        current -> v2.0.0.yaml
    index.json
```

#### 2.3.2 AssetPromotionPipeline - 资产晋升流水线

**职责**: 管理资产从沙盒到正式系统的晋升流程

**接口定义**:

```typescript
// src/capability/promotion-pipeline.ts

interface PromotionStage {
  name: 'proposal' | 'sandbox_experiment' | 'qa_validation' | 'audit_review' | 'promotion_decision' | 'post_observation';
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  result?: StageResult;
  artifacts: Artifact[];
}

interface PromotionPipeline {
  createProposal(asset: AssetDraft): Promise<PromotionProposal>;
  runSandboxExperiment(proposal: PromotionProposal): Promise<SandboxExperiment>;
  runQAValidation(experiment: SandboxExperiment): Promise<QAValidation>;
  runAuditReview(validation: QAValidation): Promise<AuditReview>;
  makePromotionDecision(review: AuditReview): Promise<PromotionDecision>;
  observePostPromotion(decision: PromotionDecision): Promise<ObservationResult>;
  
  getPipelineStatus(proposalId: string): Promise<PromotionStage[]>;
  rollback(proposalId: string): Promise<void>;
}
```

**晋升流程图**:

```
┌──────────┐    ┌─────────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Proposal │───>│Sandbox Experiment│───>│ QA Validation│───>│Audit Review │───>│Promotion Decision│───>│Post Observation │
└──────────┘    └─────────────────┘    └──────────────┘    └─────────────┘    └──────────────────┘    └──────────────────┘
     │                  │                     │                   │                    │                      │
     v                  v                     v                   v                    v                      v
  Draft            Experiment             QA Report          Audit Log           Published             Monitoring
                 Results                                    Trace               Asset                  Metrics
```

---

### 2.4 执行层模块设计

#### 2.4.1 Executor - 主执行者

**职责**: 接收目标，分解任务，协调执行

**接口定义**:

```typescript
// src/execution/executor.ts

interface Goal {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'user' | 'system' | 'evolution';
  constraints: GoalConstraint[];
}

interface TaskTree {
  root: TaskNode;
  nodes: Map<string, TaskNode>;
  edges: Map<string, string[]>;  // DAG edges
}

interface Executor {
  receiveGoal(goal: Goal): Promise<TaskTree>;
  decomposeGoal(goal: Goal): Promise<TaskNode[]>;
  selectCapabilities(tasks: TaskNode[]): Promise<CapabilityMapping>;
  detectCapabilityGaps(tasks: TaskNode[]): Promise<CapabilityGap[]>;
  requestEvolution(gaps: CapabilityGap[]): Promise<void>;
  execute(tree: TaskTree): Promise<ExecutionResult>;
  recordEffect(result: ExecutionResult): Promise<void>;
  feedbackToMemory(result: ExecutionResult): Promise<void>;
}
```

**目标分解流程**:

```
Goal
  │
  v
┌─────────────────┐
│ Goal Analysis   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Task Decomposition│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Capability Check │───> Gap? ───> Request Evolution
└────────┬────────┘
         │
         v
┌─────────────────┐
│ DAG Construction │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Task Execution  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Effect Recording │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Memory Feedback │
└─────────────────┘
```

#### 2.4.2 OperatorSwarm - 动态作业集群

**职责**: 按任务动态生成执行代理群

**接口定义**:

```typescript
// src/execution/operator-swarm.ts

interface WorkerType {
  id: 'research-worker' | 'code-worker' | 'refactor-worker' | 'test-worker' | 'deployment-worker';
  capabilities: string[];
  defaultPermissions: Permission[];
  resourceBudget: ResourceBudget;
}

interface OperatorSwarm {
  spawnWorker(type: WorkerType, task: Task): Promise<Worker>;
  assignTask(worker: Worker, task: Task): Promise<void>;
  getWorkerStatus(workerId: string): Promise<WorkerStatus>;
  dissolveWorker(workerId: string): Promise<void>;
  dissolveAll(taskId: string): Promise<void>;
  
  // 权限管理
  grantMinimalPermissions(worker: Worker, task: Task): Promise<void>;
  revokePermissions(workerId: string): Promise<void>;
}
```

#### 2.4.3 TaskOS - 任务操作系统

**职责**: 统一任务管理内核

**接口定义**:

```typescript
// src/execution/task-os.ts

interface TaskDAG {
  nodes: Map<string, Task>;
  edges: Map<string, string[]>;
  entryPoints: string[];
  exitPoints: string[];
}

interface TaskOS {
  // 任务树管理
  createTree(tasks: Task[]): Promise<TaskDAG>;
  addNode(dag: TaskDAG, task: Task): Promise<void>;
  addEdge(dag: TaskDAG, from: string, to: string): Promise<void>;
  
  // 调度
  schedule(dag: TaskDAG): Promise<void>;
  getNextExecutable(dag: TaskDAG): Promise<Task | null>;
  getParallelizable(dag: TaskDAG): Promise<Task[]>;
  
  // 依赖管理
  resolveDependencies(task: Task): Promise<Task[]>;
  checkDependenciesMet(task: Task): Promise<boolean>;
  
  // 状态管理
  saveState(dag: TaskDAG): Promise<void>;
  restoreState(dagId: string): Promise<TaskDAG>;
  
  // 故障处理
  handleFailure(task: Task, error: Error): Promise<RecoveryAction>;
  retry(task: Task): Promise<void>;
  rollback(task: Task): Promise<void>;
}
```

**与现有 task-registry 集成**:

```typescript
// 扩展现有 task-registry
import { TaskRegistry } from '../tasks/task-registry';

class TaskOS {
  private registry: TaskRegistry;
  
  async schedule(dag: TaskDAG): Promise<void> {
    // 使用现有 task-registry 存储任务
    for (const task of dag.nodes.values()) {
      await this.registry.createTask(task);
    }
    // 执行 DAG 调度
    await this.executeDAG(dag);
  }
}
```

#### 2.4.4 AutonomousScheduler - 自主调度器

**职责**: 持续扫描和调度任务

**接口定义**:

```typescript
// src/execution/autonomous-scheduler.ts

interface SchedulerConfig {
  scanInterval: number;  // 扫描间隔（毫秒）
  maxParallelism: number;
  stuckTaskThreshold: number;  // 卡住任务判定阈值
}

interface AutonomousScheduler {
  start(): void;
  stop(): void;
  
  // 扫描
  scanPendingTasks(): Promise<Task[]>;
  scanStuckTasks(): Promise<Task[]>;
  scanParallelizableTasks(): Promise<Task[]>;
  scanBottlenecks(): Promise<Bottleneck[]>;
  
  // 调度
  dispatch(task: Task): Promise<void>;
  dispatchParallel(tasks: Task[]): Promise<void>;
  
  // 恢复
  diagnoseStuckTask(task: Task): Promise<Diagnosis>;
  recover(task: Task, diagnosis: Diagnosis): Promise<void>;
  
  // 演化升级
  considerEvolutionUpgrade(bottleneck: Bottleneck): Promise<void>;
}
```

---

### 2.5 API与通信层模块设计

#### 2.5.1 AuditStream - 审计流

**职责**: 记录所有自治行为，确保不可篡改

**接口定义**:

```typescript
// src/api/audit-stream.ts

interface AuditRecord {
  id: string;
  timestamp: Date;
  type: 'organization_change' | 'permission_change' | 'capability_publish' | 'algorithm_switch' | 'task_failure' | 'task_rollback';
  actor: ActorInfo;
  operation: OperationInfo;
  preState: StateReference;
  postState: StateReference;
  rollbackReference?: string;
  evidence: EvidenceBundle;
  hash: string;  // 链式哈希
  previousHash?: string;
}

interface AuditStream {
  record(event: AuditEvent): Promise<AuditRecord>;
  query(filter: AuditFilter): Promise<AuditRecord[]>;
  verify(record: AuditRecord): Promise<boolean>;
  verifyChain(since: Date): Promise<ChainVerification>;
  
  // 防篡改
  detectTampering(): Promise<TamperingDetection[]>;
  freeze(): Promise<void>;
}
```

**审计记录结构**:

```typescript
// 使用链式哈希确保不可篡改
async function record(event: AuditEvent): Promise<AuditRecord> {
  const lastRecord = await getLastRecord();
  const record: AuditRecord = {
    id: generateId(),
    timestamp: new Date(),
    type: event.type,
    actor: event.actor,
    operation: event.operation,
    preState: event.preState,
    postState: event.postState,
    evidence: event.evidence,
    previousHash: lastRecord?.hash,
    hash: ''  // 待计算
  };
  record.hash = await computeHash(record);
  await store(record);
  return record;
}
```

---

### 2.6 交互层模块设计

#### 2.6.1 PresenceCore - 持续存在感

**职责**: 主动发起交互，保持在线存在感

**接口定义**:

```typescript
// src/interaction/presence-core.ts

interface PresenceEvent {
  type: 'opportunity' | 'risk' | 'milestone' | 'decision_required';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actions: PresenceAction[];
}

interface PresenceCore {
  // 主动通知
  notifyOpportunity(opportunity: Opportunity): Promise<void>;
  alertRisk(risk: Risk): Promise<void>;
  reportProgress(milestone: Milestone): Promise<void>;
  requestDecision(decision: DecisionRequest): Promise<void>;
  
  // 状态管理
  setOnline(): void;
  setAway(): void;
  setBusy(reason: string): void;
  
  // 通知渠道
  registerChannel(channel: NotificationChannel): void;
  broadcast(event: PresenceEvent): Promise<void>;
}
```

---

### 2.7 沙盒宇宙模块设计

#### 2.7.1 SandboxUniverse - 沙盒宇宙

**职责**: 提供隔离的实验环境

**接口定义**:

```typescript
// src/sandbox/sandbox-universe.ts

interface SandboxExperiment {
  id: string;
  type: 'organization' | 'skill' | 'plugin' | 'agent' | 'strategy' | 'algorithm';
  subject: ExperimentSubject;
  controlGroup: ExperimentGroup;
  experimentGroup: ExperimentGroup;
  status: 'running' | 'completed' | 'failed';
  results?: ExperimentResult;
}

interface SandboxUniverse {
  // 实验管理
  createExperiment(config: ExperimentConfig): Promise<SandboxExperiment>;
  runExperiment(experiment: SandboxExperiment): Promise<ExperimentResult>;
  abortExperiment(experimentId: string): Promise<void>;
  
  // 隔离环境
  createIsolatedEnvironment(): Promise<IsolatedEnv>;
  destroyIsolatedEnvironment(envId: string): Promise<void>;
  
  // A/B 测试
  setupABTest(config: ABTestConfig): Promise<ABTest>;
  runABTest(test: ABTest): Promise<ABTestResult>;
  
  // 历史回放
  replayHistory(taskIds: string[], config: ReplayConfig): Promise<ReplayResult>;
  
  // 晋升
  submitForPromotion(experiment: SandboxExperiment): Promise<PromotionProposal>;
}
```

**沙盒隔离架构**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Sandbox Universe                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Isolated Env #1 │  │ Isolated Env #2 │  │ Isolated Env #3 │  │
│  │ (Organization)  │  │   (Skill)       │  │  (Algorithm)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Promotion Gate                           ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││
│  │  │Function  │─>│Regression│─>│ Security │─>│Sovereign │    ││
│  │  │Validation│  │Validation│  │Validation│  │ Review   │    ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              v
                    ┌─────────────────┐
                    │  Production     │
                    │    System       │
                    └─────────────────┘
```

---

## 3. 数据模型设计

### 3.1 代理蓝图数据模型

```typescript
// src/types/agent-blueprint.ts

interface AgentBlueprint {
  version: number;
  agent: {
    id: string;
    title: string;
    layer: 'governance' | 'evolution' | 'capability' | 'execution' | 'api' | 'interaction';
    class: string;
    status: 'draft' | 'active' | 'deprecated';
  };
  mission: {
    primary: string;
    success_metrics: string[];
  };
  jurisdiction: {
    can_observe: string[];
    can_decide: string[];
    cannot_decide: string[];
  };
  authority: {
    level: 'low' | 'medium' | 'high' | 'sovereign';
    mutation_scope: {
      allow: string[];
      deny: string[];
    };
    network_scope: {
      default: 'isolated' | 'internal' | 'broad';
      conditions?: string[];
    };
    resource_budget: {
      tokens: 'low' | 'medium' | 'high';
      parallelism: 'low' | 'medium' | 'high';
      runtime: 'short' | 'medium' | 'long-running';
    };
  };
  allowed_subagents: string[];
  allowed_tools: string[];
  memory_scope: string[];
  qa_requirements: QARequirement[];
  promotion_policy: {
    [mutationType: string]: string[];
  };
  rollback_policy: {
    triggers: string[];
    actions: string[];
  };
  runtime_mapping?: {
    intended_project_hooks: string[];
  };
}
```

### 3.2 变更记录数据模型

```typescript
// src/types/mutation.ts

interface MutationRecord {
  id: string;
  type: MutationType;
  risk: 'low' | 'medium' | 'high' | 'critical';
  actor: AgentId;
  target: MutationTarget;
  preState: StateSnapshot;
  postState: StateSnapshot;
  rollbackPath: RollbackPath;
  auditTrace: AuditRecordId;
  timestamp: Date;
  status: 'proposed' | 'in_sandbox' | 'validated' | 'promoted' | 'rolled_back';
}

type MutationType = 
  | 'local_execution_tuning'
  | 'capability_mutation'
  | 'organization_mutation'
  | 'sovereign_mutation';
```

---

## 4. API 设计

### 4.1 治理层 API

```typescript
// 查章 API
GET    /api/governance/charter                    // 获取宪章配置
GET    /api/governance/charter/agents/:id         // 获取代理蓝图
PUT    /api/governance/charter/agents/:id         // 更新代理蓝图（需主权审批）

// 主权审批 API
POST   /api/governance/sovereign/request          // 创建主权请求
GET    /api/governance/sovereign/requests         // 获取待处理请求
POST   /api/governance/sovereign/requests/:id/approve  // 批准请求
POST   /api/governance/sovereign/requests/:id/reject   // 拒绝请求

// 审计 API
GET    /api/governance/audit                      // 查询审计记录
GET    /api/governance/audit/verify               // 验证审计链
```

### 4.2 进化层 API

```typescript
// 组织演化 API
POST   /api/evolution/organization/proposal      // 提交组织变更提案
GET    /api/evolution/organization/proposals     // 获取提案列表
POST   /api/evolution/organization/vote          // 投票

// 策略演化 API
GET    /api/evolution/strategy/assets            // 获取策略资产
POST   /api/evolution/strategy/assets            // 创建策略资产
POST   /api/evolution/strategy/validate          // 验证策略

// 算法演化 API
GET    /api/evolution/algorithms                 // 获取算法列表
POST   /api/evolution/algorithms/experiment      // 创建实验
GET    /api/evolution/algorithms/compare         // 对比算法性能
```

### 4.3 能力层 API

```typescript
// 资产管理 API
GET    /api/capability/assets                     // 搜索资产
GET    /api/capability/assets/:id                 // 获取资产详情
POST   /api/capability/assets                     // 注册资产
DELETE /api/capability/assets/:id                 // 废弃资产
POST   /api/capability/assets/:id/rollback        // 回滚资产版本

// 晋升流水线 API
POST   /api/capability/promotion                  // 创建晋升提案
GET    /api/capability/promotion/:id              // 获取晋升状态
POST   /api/capability/promotion/:id/advance      // 推进晋升阶段
```

### 4.4 执行层 API

```typescript
// 目标执行 API
POST   /api/execution/goals                       // 提交目标
GET    /api/execution/goals/:id                   // 获取目标状态
GET    /api/execution/goals/:id/tasks             // 获取任务树

// 任务调度 API
GET    /api/execution/tasks                       // 查询任务
POST   /api/execution/tasks/:id/retry             // 重试任务
POST   /api/execution/tasks/:id/rollback          // 回滚任务

// 调度器 API
GET    /api/execution/scheduler/status            // 调度器状态
POST   /api/execution/scheduler/pause             // 暂停调度
POST   /api/execution/scheduler/resume            // 恢复调度
```

---

## 5. 迁移路径设计

### 5.1 阶段 A: 制度化

**目标**: 引入 charter/constitution/sovereignty 配置

**实现步骤**:

```typescript
// src/migration/phase-a.ts

async function migratePhaseA(): Promise<MigrationResult> {
  // 1. 加载现有配置
  const existingConfig = {
    acpAllowlist: await loadACPAllowlist(),
    sandboxPolicy: await loadSandboxPolicy(),
    agentConfigs: await loadAgentConfigs(),
    auditConfig: await loadAuditConfig()
  };
  
  // 2. 映射到宪章格式
  const charter = mapToCharter(existingConfig);
  
  // 3. 验证宪章
  const validation = validateCharter(charter);
  if (!validation.valid) {
    throw new MigrationError('Charter validation failed', validation.errors);
  }
  
  // 4. 写入宪章文件
  await writeCharter(charter);
  
  // 5. 启用宪章加载器
  await enableCharterLoader();
  
  return { success: true, charter };
}
```

**映射关系**:

| 现有配置 | 宪章字段 |
|----------|----------|
| ACP allowlist | institutional_layers.api_communication |
| Sandbox policy | sovereign_boundaries.autonomous_zone |
| Agent configs | charter_artifacts.core_agents |
| Audit config | audit_requirements |

### 5.2 阶段 B: 资产化

**目标**: 统一纳入能力资产台账

**实现步骤**:

```typescript
// src/migration/phase-b.ts

async function migratePhaseB(): Promise<MigrationResult> {
  // 1. 扫描现有能力
  const capabilities = {
    skills: await scanSkills(),
    plugins: await scanPlugins(),
    memory: await scanMemory(),
    strategies: await scanStrategies(),
    algorithms: await scanAlgorithms()
  };
  
  // 2. 为每个能力创建资产记录
  const assets: Asset[] = [];
  for (const [type, items] of Object.entries(capabilities)) {
    for (const item of items) {
      const asset = await createAssetRecord(type, item);
      assets.push(asset);
    }
  }
  
  // 3. 建立索引
  await buildAssetIndex(assets);
  
  // 4. 启用 Librarian
  await enableLibrarian();
  
  return { success: true, assets };
}
```

### 5.3 阶段 C: 自治开发化

**目标**: 建立自动开发闭环

**实现步骤**:

```typescript
// src/migration/phase-c.ts

async function migratePhaseC(): Promise<MigrationResult> {
  // 1. 初始化 Genesis Team
  await initializeGenesisTeam();
  
  // 2. 建立自动开发流水线
  await setupAutoDevelopmentPipeline();
  
  // 3. 配置 QA 自动化
  await setupAutoQA();
  
  // 4. 配置自动发布
  await setupAutoPublish();
  
  // 5. 启动 Genesis Team
  await startGenesisTeam();
  
  return { success: true };
}
```

### 5.4 阶段 D: 组织自治化

**目标**: 引入 Founder/Strategist/Algorithmist

**实现步骤**:

```typescript
// src/migration/phase-d.ts

async function migratePhaseD(): Promise<MigrationResult> {
  // 1. 初始化进化层代理
  await initializeEvolutionAgents();
  
  // 2. 配置组织扫描
  await setupOrganizationScanning();
  
  // 3. 配置策略分析
  await setupStrategyAnalysis();
  
  // 4. 配置算法实验
  await setupAlgorithmExperimentation();
  
  // 5. 启动进化层
  await startEvolutionLayer();
  
  return { success: true };
}
```

### 5.5 阶段 E: 沙盒宇宙化

**目标**: 建立自治实验环境

**实现步骤**:

```typescript
// src/migration/phase-e.ts

async function migratePhaseE(): Promise<MigrationResult> {
  // 1. 创建沙盒宇宙
  await createSandboxUniverse();
  
  // 2. 配置隔离环境
  await setupIsolatedEnvironments();
  
  // 3. 配置晋升门槛
  await setupPromotionGates();
  
  // 4. 配置历史回放
  await setupHistoryReplay();
  
  // 5. 启用沙盒验证
  await enableSandboxValidation();
  
  return { success: true };
}
```

### 5.6 阶段 F: 持续运行化

**目标**: 配置长期驻留、监测、演化

**实现步骤**:

```typescript
// src/migration/phase-f.ts

async function migratePhaseF(): Promise<MigrationResult> {
  // 1. 配置持续运行
  await setupContinuousRunning();
  
  // 2. 配置长期监测
  await setupLongTermMonitoring();
  
  // 3. 配置自主调度器
  await setupAutonomousScheduler();
  
  // 4. 配置 Presence Core
  await setupPresenceCore();
  
  // 5. 启动持续运行模式
  await startContinuousMode();
  
  return { success: true };
}
```

---

## 6. 与现有系统集成

### 6.1 与 Gateway 集成

```typescript
// src/gateway/index.ts (扩展)

import { CharterLoader } from '../governance/charter-loader';
import { EthicalCore } from '../governance/ethical-core';

// 在 Gateway 启动时加载宪章
async function startGateway() {
  const charter = await CharterLoader.load('governance/charter/');
  EthicalCore.initialize(charter);
  
  // 现有 Gateway 启动逻辑
  await existingGatewayStartup();
}
```

### 6.2 与 ACP Control Plane 集成

```typescript
// src/acp/control-plane/manager.ts (扩展)

import { SovereigntyAuditor } from '../../governance/sovereignty-auditor';

// 在 ACP 会话管理中集成主权审计
class ACPManager {
  private auditor: SovereigntyAuditor;
  
  async createSession(config: SessionConfig): Promise<Session> {
    // 检查权限边界
    const check = await this.auditor.checkPermission(config);
    if (!check.valid) {
      throw new PermissionError(check.reason);
    }
    
    // 现有会话创建逻辑
    return existingCreateSession(config);
  }
}
```

### 6.3 与 Task Registry 集成

```typescript
// src/tasks/task-registry.ts (扩展)

import { TaskOS } from '../execution/task-os';
import { AuditStream } from '../api/audit-stream';

// 扩展 TaskRegistry 为 TaskOS
class TaskRegistry {
  private taskOS: TaskOS;
  private auditStream: AuditStream;
  
  async createTask(task: Task): Promise<TaskRecord> {
    // 记录到审计流
    await this.auditStream.record({
      type: 'task_created',
      task
    });
    
    // 现有任务创建逻辑
    return existingCreateTask(task);
  }
}
```

---

## 7. 测试策略

### 7.1 单元测试

- 每个模块独立测试
- Mock 外部依赖
- 覆盖率目标: 80%+

### 7.2 集成测试

- 测试模块间交互
- 测试与现有系统集成
- 测试迁移路径

### 7.3 沙盒测试

- 在沙盒宇宙中测试所有变更
- A/B 测试验证算法升级
- 回归测试验证能力发布

### 7.4 安全测试

- 测试主权边界不可绕过
- 测试审计流不可篡改
- 测试漂移检测和自动冻结

---

## 8. 部署建议

### 8.1 渐进式部署

1. **阶段 A-B**: 无需停机，配置迁移
2. **阶段 C-D**: 启用新代理，观察运行
3. **阶段 E-F**: 启用沙盒和持续运行模式

### 8.2 回滚策略

每个阶段都应保留回滚路径：

```typescript
interface MigrationRollback {
  phase: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  backup: StateBackup;
  rollback(): Promise<void>;
}
```

### 8.3 监控指标

| 指标 | 描述 |
|------|------|
| `governance.charter.load_time` | 宪章加载时间 |
| `governance.audit.records_per_minute` | 审计记录速率 |
| `evolution.proposals_generated` | 演化提案数量 |
| `capability.assets_total` | 资产总数 |
| `execution.tasks_completed` | 完成任务数 |
| `execution.scheduler_uptime` | 调度器运行时间 |
| `sandbox.experiments_running` | 运行中实验数 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 宪章配置错误 | 系统无法启动 | 启动前验证，提供详细错误信息 |
| 主权边界绕过 | 安全风险 | 多层检查，EthicalCore + SovereigntyAuditor |
| 审计流篡改 | 不可追溯 | 链式哈希，自动检测篡改 |
| 沙盒逃逸 | 影响生产系统 | 严格隔离，晋升门槛 |
| 演化失控 | 系统不稳定 | 沙盒验证，回滚路径 |

---

## 10. 附录

### 10.1 文件结构

```
src/
  governance/
    charter-loader.ts
    ethical-core.ts
    sovereignty-auditor.ts
    sovereign-approval.ts
  evolution/
    founder.ts
    strategist.ts
    algorithmist.ts
    genesis-team.ts
    sentinel.ts
    archaeologist.ts
    tdd-developer.ts
    qa.ts
    publisher.ts
  capability/
    librarian.ts
    promotion-pipeline.ts
    asset-index.ts
  execution/
    executor.ts
    operator-swarm.ts
    task-os.ts
    autonomous-scheduler.ts
  api/
    audit-stream.ts
    governance-api.ts
    evolution-api.ts
    capability-api.ts
    execution-api.ts
  interaction/
    presence-core.ts
  sandbox/
    sandbox-universe.ts
    isolated-env.ts
    promotion-gate.ts
  migration/
    phase-a.ts
    phase-b.ts
    phase-c.ts
    phase-d.ts
    phase-e.ts
    phase-f.ts
    index.ts
  types/
    agent-blueprint.ts
    mutation.ts
    asset.ts
    audit.ts
```

### 10.2 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Interaction                             │
│                            │                                    │
│                            v                                    │
│                          API                                    │
│                            │                                    │
│                            v                                    │
│                        Execution                                │
│                            │                                    │
│                            v                                    │
│                        Capability                               │
│                            │                                    │
│                            v                                    │
│                         Evolution                               │
│                            │                                    │
│                            v                                    │
│                        Governance                               │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 配置示例

```yaml
# config/autonomous-system.yaml
system:
  mode: strong-autonomy
  version: 1.0.0

governance:
  charter_dir: governance/charter/
  audit_stream:
    enabled: true
    storage: sqlite
    tamper_detection: true
  sovereignty_auditor:
    enabled: true
    scan_interval: 60000  # 60 seconds

evolution:
  founder:
    enabled: true
    scan_interval: 3600000  # 1 hour
  strategist:
    enabled: true
  algorithmist:
    enabled: true
  genesis_team:
    enabled: true

capability:
  librarian:
    enabled: true
  promotion_pipeline:
    required_stages:
      - proposal
      - sandbox_experiment
      - qa_validation
      - audit_review
      - promotion_decision

execution:
  autonomous_scheduler:
    enabled: true
    scan_interval: 5000  # 5 seconds
    max_parallelism: 10

sandbox:
  enabled: true
  isolated_environments: 3
  promotion_gates:
    - function_validation
    - regression_validation
    - security_validation
    - sovereign_review
```
