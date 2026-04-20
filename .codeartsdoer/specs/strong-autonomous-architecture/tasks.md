# 强自治目标架构方案 - 编码任务规划

## 文档信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 状态 | 草稿 |
| 创建日期 | 2025-04-20 |
| 功能名称 | strong-autonomous-architecture |
| 对应需求 | spec.md v1.0.0 |
| 对应设计 | design.md v1.0.0 |

---

## 任务概览

| 统计项 | 数量 |
|--------|------|
| 主任务 | 12 |
| 子任务 | 48 |
| 覆盖需求数 | 44 |

---

## 1. 治理层实现任务

### 1.1 实现宪章加载器 (CharterLoader)

**需求映射**: REQ-GOV-001

**任务描述**: 创建宪章加载器模块，负责加载和验证 `governance/charter/` 目录下的所有宪章配置文件。

**输入**:
- 现有宪章配置文件 (`governance/charter/constitution.yaml`, `governance/charter/policies/*.yaml`, `governance/charter/agents/*.yaml`)
- 设计文档中的接口定义

**输出**:
- `src/governance/charter-loader.ts` - 宪章加载器实现
- `src/governance/charter-loader.test.ts` - 单元测试
- `src/types/charter.ts` - 类型定义

**验收标准**:
- [ ] 能够加载 constitution.yaml 主配置文件
- [ ] 能够加载 policies/ 目录下的所有策略文件
- [ ] 能够加载 agents/ 目录下的所有代理蓝图文件
- [ ] 启动时验证所有必填字段，缺失时报错
- [ ] 支持缓存已加载的宪章配置
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 1.1.1 创建宪章类型定义
- 创建 `src/types/charter.ts`
- 定义 `CharterConfig`, `ConstitutionalPrinciple`, `SovereignBoundaries`, `InstitutionalLayers`, `MutationClass`, `PromotionPipeline` 等接口
- 导出所有类型

#### 1.1.2 实现宪章文件加载
- 实现 `loadCharterFile(filePath: string)` 函数
- 使用 `js-yaml` 解析 YAML 文件
- 处理文件不存在和解析错误

#### 1.1.3 实现宪章验证
- 实现 `validateCharter(config: CharterConfig)` 函数
- 验证必填字段存在
- 验证字段类型正确
- 验证引用的代理蓝图文件存在

#### 1.1.4 实现 CharterLoader 类
- 实现 `load(charterDir: string)` 方法
- 实现 `validate(config: CharterConfig)` 方法
- 实现 `getAgentBlueprint(agentId: string)` 方法
- 实现 `getPolicy(policyId: string)` 方法
- 实现缓存机制

#### 1.1.5 编写单元测试
- 测试正常加载场景
- 测试文件缺失场景
- 测试格式无效场景
- 测试缓存功能

---

### 1.2 实现伦理与安全核心 (EthicalCore)

**需求映射**: REQ-GOV-003

**任务描述**: 创建伦理与安全核心模块，实现运行时强制规则，防止绕过主权边界。

**输入**:
- 设计文档中的 EthicalCore 接口定义
- 内置规则定义

**输出**:
- `src/governance/ethical-core.ts` - 伦理核心实现
- `src/governance/ethical-core.test.ts` - 单元测试
- `src/types/ethical.ts` - 类型定义

**验收标准**:
- [ ] 实现四条内置安全规则
- [ ] 规则检查在操作执行前进行
- [ ] 违规时记录安全事件
- [ ] 违规时执行强制动作（拒绝/冻结）
- [ ] 规则不可被运行时修改
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 1.2.1 创建伦理类型定义
- 定义 `EthicalRule`, `OperationContext`, `EthicalCheckResult`, `EnforcementAction` 接口

#### 1.2.2 实现内置规则
- 实现 `no-root-privilege-escalation` 规则
- 实现 `no-audit-tampering` 规则
- 实现 `no-silent-network-expansion` 规则
- 实现 `no-sovereign-config-modification` 规则

#### 1.2.3 实现 EthicalCore 类
- 实现 `registerRule(rule: EthicalRule)` 方法
- 实现 `checkOperation(context: OperationContext)` 方法
- 实现 `enforce(action: EnforcementAction)` 方法
- 实现规则注册和检查流程

#### 1.2.4 编写单元测试
- 测试每条规则的正常通过场景
- 测试每条规则的违规场景
- 测试强制动作执行

---

### 1.3 实现主权审计器 (SovereigntyAuditor)

**需求映射**: REQ-GOV-004

**任务描述**: 创建主权审计器模块，独立运行，持续检查权限漂移、组织漂移、策略漂移。

**输入**:
- 设计文档中的 SovereigntyAuditor 接口定义
- CharterLoader 提供的宪章配置

**输出**:
- `src/governance/sovereignty-auditor.ts` - 主权审计器实现
- `src/governance/sovereignty-auditor.test.ts` - 单元测试
- `src/types/audit.ts` - 类型定义

**验收标准**:
- [ ] 能够检测权限漂移
- [ ] 能够检测组织漂移
- [ ] 能够检测策略漂移
- [ ] 发现越界时自动冻结相关子系统
- [ ] 冻结时保留取证快照
- [ ] 审计器独立于执行层和进化层运行
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 1.3.1 创建审计类型定义
- 定义 `DriftDetection`, `DriftEvidence`, `ForensicSnapshot` 接口

#### 1.3.2 实现漂移检测
- 实现 `detectPermissionDrift()` 函数
- 实现 `detectOrganizationDrift()` 函数
- 实现 `detectPolicyDrift()` 函数

#### 1.3.3 实现 SovereigntyAuditor 类
- 实现 `start()` 和 `stop()` 方法
- 实现 `scan()` 方法
- 实现 `freezeSubsystem(subsystemId: string)` 方法
- 实现 `preserveForensicSnapshot(drift: DriftDetection)` 方法
- 实现定时扫描机制

#### 1.3.4 编写单元测试
- 测试权限漂移检测
- 测试组织漂移检测
- 测试策略漂移检测
- 测试冻结功能
- 测试取证快照保存

---

### 1.4 实现主权审批流程 (SovereignApproval)

**需求映射**: REQ-GOV-002

**任务描述**: 创建主权审批流程模块，处理需要人类主权者批准的操作。

**输入**:
- 设计文档中的 SovereignApproval 接口定义
- PresenceCore (用于通知人类)

**输出**:
- `src/governance/sovereign-approval.ts` - 主权审批实现
- `src/governance/sovereign-approval.test.ts` - 单元测试

**验收标准**:
- [ ] 能够创建主权请求
- [ ] 主权请求通过 PresenceCore 通知人类
- [ ] 请求有超时机制
- [ ] 批准/拒绝记录到审计流
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 1.4.1 创建主权请求类型定义
- 定义 `SovereignRequest`, `SovereignRequestType`, `ApprovalStatus` 接口

#### 1.4.2 实现 SovereignApproval 类
- 实现 `createRequest(type, payload)` 方法
- 实现 `approve(requestId, sovereignId)` 方法
- 实现 `reject(requestId, sovereignId, reason)` 方法
- 实现 `getPendingRequests()` 方法
- 实现超时检查机制

#### 1.4.3 编写单元测试
- 测试请求创建
- 测试批准流程
- 测试拒绝流程
- 测试超时机制

---

## 2. 进化层实现任务

### 2.1 实现 Genesis Team

**需求映射**: REQ-EVO-004

**任务描述**: 创建 Genesis Team 模块，负责工具与能力演化，包含 Sentinel、Archaeologist、TDD Developer、QA、Publisher 五个角色。

**输入**:
- 设计文档中的 Genesis Team 接口定义
- Librarian (用于资产注册)

**输出**:
- `src/evolution/genesis-team.ts` - Genesis Team 协调器
- `src/evolution/sentinel.ts` - Sentinel 实现
- `src/evolution/archaeologist.ts` - Archaeologist 实现
- `src/evolution/tdd-developer.ts` - TDD Developer 实现
- `src/evolution/qa.ts` - QA 实现
- `src/evolution/publisher.ts` - Publisher 实现
- 对应的单元测试文件

**验收标准**:
- [ ] Sentinel 能够检测缺口、故障和风险
- [ ] Archaeologist 能够定位根因与依赖结构
- [ ] TDD Developer 能够编写技能和插件
- [ ] QA 能够执行验证和回归测试
- [ ] Publisher 能够发布能力资产
- [ ] Genesis Team 工作流正确串联
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 2.1.1 实现 Sentinel
- 实现 `scan()` 方法检测问题
- 实现 `classify(issue)` 方法分类问题
- 实现 `triggerArchaeologist(issue)` 方法触发下游

#### 2.1.2 实现 Archaeologist
- 实现 `analyze(issue)` 方法分析根因
- 实现 `identifyDependencies(analysis)` 方法识别依赖
- 实现 `generateFixProposal(analysis)` 方法生成修复方案

#### 2.1.3 实现 TDD Developer
- 实现 `developSkill(proposal)` 方法开发技能
- 实现 `developPlugin(proposal)` 方法开发插件
- 实现 `writeTests(draft)` 方法编写测试

#### 2.1.4 实现 QA
- 实现 `validate(draft)` 方法验证资产
- 实现 `runRegression(draft)` 方法回归测试
- 实现 `generateReport(result)` 方法生成报告

#### 2.1.5 实现 Publisher
- 实现 `publish(asset)` 方法发布资产
- 实现 `registerWithLibrarian(asset)` 方法注册资产

#### 2.1.6 实现 Genesis Team 协调器
- 实现工作流串联逻辑
- 实现状态管理
- 实现错误处理

#### 2.1.7 编写单元测试
- 测试每个角色的独立功能
- 测试工作流串联
- 测试错误处理

---

### 2.2 实现 Founder 代理

**需求映射**: REQ-EVO-001

**任务描述**: 创建 Founder 代理模块，负责组织演化。

**输入**:
- 设计文档中的 Founder 接口定义
- SandboxUniverse (用于验证)
- SovereignApproval (用于主权审批)

**输出**:
- `src/evolution/founder.ts` - Founder 实现
- `src/evolution/founder.test.ts` - 单元测试

**验收标准**:
- [ ] 能够扫描组织健康状态
- [ ] 能够检测系统瓶颈
- [ ] 能够生成组织变更提案
- [ ] 提案能够提交到沙盒验证
- [ ] 宪章修改能够转交主权审批
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 2.2.1 实现 Founder 类
- 实现 `scanOrganization()` 方法
- 实现 `detectBottlenecks()` 方法
- 实现 `generateProposal(bottleneck)` 方法
- 实现 `submitToSandbox(proposal)` 方法
- 实现 `requestPromotionVote(experiment)` 方法

#### 2.2.2 编写单元测试
- 测试组织扫描
- 测试瓶颈检测
- 测试提案生成
- 测试沙盒提交

---

### 2.3 实现 Strategist 代理

**需求映射**: REQ-EVO-002

**任务描述**: 创建 Strategist 代理模块，负责策略演化。

**输入**:
- 设计文档中的 Strategist 接口定义
- Task Registry (用于历史分析)
- Librarian (用于资产注册)

**输出**:
- `src/evolution/strategist.ts` - Strategist 实现
- `src/evolution/strategist.test.ts` - 单元测试

**验收标准**:
- [ ] 能够分析任务历史
- [ ] 能够提取执行模式
- [ ] 能够生成策略资产
- [ ] 策略能够在沙盒中验证
- [ ] 策略能够通过 Librarian 注册
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 2.3.1 实现 Strategist 类
- 实现 `analyzeHistory(timeRange)` 方法
- 实现 `extractPatterns(analysis)` 方法
- 实现 `generateStrategyAsset(pattern)` 方法
- 实现 `validateInSandbox(asset)` 方法
- 实现 `registerWithLibrarian(asset)` 方法

#### 2.3.2 编写单元测试
- 测试历史分析
- 测试模式提取
- 测试策略生成
- 测试沙盒验证

---

### 2.4 实现 Algorithmist 代理

**需求映射**: REQ-EVO-003

**任务描述**: 创建 Algorithmist 代理模块，负责算法演化。

**输入**:
- 设计文档中的 Algorithmist 接口定义
- SandboxUniverse (用于实验)

**输出**:
- `src/evolution/algorithmist.ts` - Algorithmist 实现
- `src/evolution/algorithmist.test.ts` - 单元测试

**验收标准**:
- [ ] 能够检测算法瓶颈
- [ ] 能够发起算法研究项目
- [ ] 能够运行对比实验
- [ ] 能够生成升级建议
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 2.4.1 实现 Algorithmist 类
- 实现 `detectAlgorithmBottlenecks()` 方法
- 实现 `proposeResearch(bottleneck)` 方法
- 实现 `runExperiment(proposal)` 方法
- 实现 `comparePerformance(experiment)` 方法
- 实现 `generateUpgradeSuggestion(result)` 方法

#### 2.4.2 编写单元测试
- 测试瓶颈检测
- 测试实验运行
- 测试性能对比
- 测试升级建议生成

---

## 3. 能力层实现任务

### 3.1 实现 Librarian 资产管理员

**需求映射**: REQ-CAP-001, REQ-CAP-002

**任务描述**: 创建 Librarian 模块，作为唯一资产管理员，统一管理所有能力资产。

**输入**:
- 设计文档中的 Librarian 接口定义
- 现有 skills/, plugins/ 目录结构

**输出**:
- `src/capability/librarian.ts` - Librarian 实现
- `src/capability/asset-index.ts` - 资产索引
- `src/capability/librarian.test.ts` - 单元测试
- `src/types/asset.ts` - 类型定义

**验收标准**:
- [ ] 能够索引和检索资产
- [ ] 能够注册新资产
- [ ] 能够执行去重检查
- [ ] 能够管理版本历史
- [ ] 能够执行回滚
- [ ] 能够分析依赖影响
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 3.1.1 创建资产类型定义
- 定义 `Asset`, `AssetType`, `AssetManifest`, `AssetDependency`, `AssetIndex` 接口

#### 3.1.2 实现资产索引
- 实现 `AssetIndex` 类
- 实现按 ID、类型、名称、依赖的索引
- 实现索引持久化

#### 3.1.3 实现 Librarian 类
- 实现 `index(asset)` 方法
- 实现 `search(query)` 方法
- 实现 `getById(id)` 和 `getByName(name)` 方法
- 实现 `register(draft)` 方法
- 实现 `checkDuplicate(draft)` 方法
- 实现 `getVersionHistory(assetId)` 方法
- 实现 `rollback(assetId, version)` 方法
- 实现 `getDependents(assetId)` 方法
- 实现 `checkImpact(assetId)` 方法

#### 3.1.4 编写单元测试
- 测试索引和检索
- 测试注册和去重
- 测试版本管理
- 测试依赖分析

---

### 3.2 实现资产晋升流水线

**需求映射**: REQ-CAP-003

**任务描述**: 创建资产晋升流水线模块，管理资产从沙盒到正式系统的晋升流程。

**输入**:
- 设计文档中的 PromotionPipeline 接口定义
- SandboxUniverse, QA, AuditStream

**输出**:
- `src/capability/promotion-pipeline.ts` - 晋升流水线实现
- `src/capability/promotion-pipeline.test.ts` - 单元测试

**验收标准**:
- [ ] 能够创建晋升提案
- [ ] 能够运行沙盒实验
- [ ] 能够执行 QA 验证
- [ ] 能够执行审计审查
- [ ] 能够做出晋升决策
- [ ] 能够执行晋升后观察
- [ ] 能够回滚
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 3.2.1 创建晋升类型定义
- 定义 `PromotionStage`, `PromotionProposal`, `PromotionDecision` 接口

#### 3.2.2 实现 PromotionPipeline 类
- 实现 `createProposal(asset)` 方法
- 实现 `runSandboxExperiment(proposal)` 方法
- 实现 `runQAValidation(experiment)` 方法
- 实现 `runAuditReview(validation)` 方法
- 实现 `makePromotionDecision(review)` 方法
- 实现 `observePostPromotion(decision)` 方法
- 实现 `getPipelineStatus(proposalId)` 方法
- 实现 `rollback(proposalId)` 方法

#### 3.2.3 编写单元测试
- 测试每个晋升阶段
- 测试完整晋升流程
- 测试回滚功能

---

## 4. 执行层实现任务

### 4.1 实现 Executor 主执行者

**需求映射**: REQ-EXE-001

**任务描述**: 创建 Executor 模块，作为用户目标与系统目标的主执行者。

**输入**:
- 设计文档中的 Executor 接口定义
- Librarian, TaskOS, GenesisTeam

**输出**:
- `src/execution/executor.ts` - Executor 实现
- `src/execution/executor.test.ts` - 单元测试

**验收标准**:
- [ ] 能够接收和分解目标
- [ ] 能够检索和调用能力
- [ ] 能够检测能力缺口
- [ ] 能够请求进化层补能力
- [ ] 能够记录效果和反哺记忆
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 4.1.1 实现 Executor 类
- 实现 `receiveGoal(goal)` 方法
- 实现 `decomposeGoal(goal)` 方法
- 实现 `selectCapabilities(tasks)` 方法
- 实现 `detectCapabilityGaps(tasks)` 方法
- 实现 `requestEvolution(gaps)` 方法
- 实现 `execute(tree)` 方法
- 实现 `recordEffect(result)` 方法
- 实现 `feedbackToMemory(result)` 方法

#### 4.1.2 编写单元测试
- 测试目标分解
- 测试能力选择
- 测试缺口检测
- 测试执行流程

---

### 4.2 实现 Operator Swarm 动态作业集群

**需求映射**: REQ-EXE-002

**任务描述**: 创建 Operator Swarm 模块，支持按任务临时生成执行代理群。

**输入**:
- 设计文档中的 OperatorSwarm 接口定义
- ACP Control Plane

**输出**:
- `src/execution/operator-swarm.ts` - Operator Swarm 实现
- `src/execution/operator-swarm.test.ts` - 单元测试

**验收标准**:
- [ ] 能够动态生成 worker
- [ ] 能够分配最小必要权限
- [ ] 能够解散 worker 并回收资源
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 4.2.1 实现 OperatorSwarm 类
- 实现 `spawnWorker(type, task)` 方法
- 实现 `assignTask(worker, task)` 方法
- 实现 `getWorkerStatus(workerId)` 方法
- 实现 `dissolveWorker(workerId)` 方法
- 实现 `dissolveAll(taskId)` 方法
- 实现 `grantMinimalPermissions(worker, task)` 方法
- 实现 `revokePermissions(workerId)` 方法

#### 4.2.2 编写单元测试
- 测试 worker 生成
- 测试权限分配
- 测试资源回收

---

### 4.3 实现 Task OS 任务操作系统

**需求映射**: REQ-EXE-003

**任务描述**: 创建 Task OS 模块，作为统一任务管理内核，扩展现有 task-registry。

**输入**:
- 设计文档中的 TaskOS 接口定义
- 现有 `src/tasks/task-registry.ts`

**输出**:
- `src/execution/task-os.ts` - Task OS 实现
- `src/execution/task-os.test.ts` - 单元测试

**验收标准**:
- [ ] 能够建立任务树和 DAG 编排
- [ ] 能够按依赖顺序调度执行
- [ ] 能够保存和恢复状态
- [ ] 能够处理失败和回滚
- [ ] 与现有 task-registry 兼容
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 4.3.1 实现 TaskDAG 数据结构
- 实现 DAG 构建和验证
- 实现拓扑排序
- 实现并行度分析

#### 4.3.2 实现 TaskOS 类
- 实现 `createTree(tasks)` 方法
- 实现 `schedule(dag)` 方法
- 实现 `getNextExecutable(dag)` 方法
- 实现 `getParallelizable(dag)` 方法
- 实现 `saveState(dag)` 方法
- 实现 `restoreState(dagId)` 方法
- 实现 `handleFailure(task, error)` 方法
- 实现 `retry(task)` 和 `rollback(task)` 方法

#### 4.3.3 集成现有 task-registry
- 扩展 TaskRegistry 接口
- 保持向后兼容

#### 4.3.4 编写单元测试
- 测试 DAG 构建
- 测试调度逻辑
- 测试状态管理
- 测试故障处理

---

### 4.4 实现 Autonomous Scheduler 自主调度器

**需求映射**: REQ-EXE-004

**任务描述**: 创建 Autonomous Scheduler 模块，持续扫描和调度任务。

**输入**:
- 设计文档中的 AutonomousScheduler 接口定义
- TaskOS, TaskRegistry

**输出**:
- `src/execution/autonomous-scheduler.ts` - 自主调度器实现
- `src/execution/autonomous-scheduler.test.ts` - 单元测试

**验收标准**:
- [ ] 能够持续扫描待执行任务
- [ ] 能够检测和处理卡住任务
- [ ] 能够并行调度任务
- [ ] 能够评估瓶颈并升级为演化任务
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 4.4.1 实现 AutonomousScheduler 类
- 实现 `start()` 和 `stop()` 方法
- 实现 `scanPendingTasks()` 方法
- 实现 `scanStuckTasks()` 方法
- 实现 `scanParallelizableTasks()` 方法
- 实现 `scanBottlenecks()` 方法
- 实现 `dispatch(task)` 和 `dispatchParallel(tasks)` 方法
- 实现 `diagnoseStuckTask(task)` 方法
- 实现 `recover(task, diagnosis)` 方法
- 实现 `considerEvolutionUpgrade(bottleneck)` 方法

#### 4.4.2 编写单元测试
- 测试任务扫描
- 测试卡住任务处理
- 测试并行调度
- 测试瓶颈评估

---

## 5. API与通信层实现任务

### 5.1 实现 Audit Stream 审计流

**需求映射**: REQ-API-003, NFR-SEC-001

**任务描述**: 创建 Audit Stream 模块，记录所有自治行为，确保不可篡改。

**输入**:
- 设计文档中的 AuditStream 接口定义

**输出**:
- `src/api/audit-stream.ts` - 审计流实现
- `src/api/audit-stream.test.ts` - 单元测试

**验收标准**:
- [ ] 能够记录审计事件
- [ ] 使用链式哈希确保不可篡改
- [ ] 能够检测篡改
- [ ] 能够验证审计链完整性
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 5.1.1 创建审计类型定义
- 定义 `AuditRecord`, `AuditEvent`, `AuditFilter` 接口

#### 5.1.2 实现 AuditStream 类
- 实现 `record(event)` 方法（含链式哈希计算）
- 实现 `query(filter)` 方法
- 实现 `verify(record)` 方法
- 实现 `verifyChain(since)` 方法
- 实现 `detectTampering()` 方法
- 实现 `freeze()` 方法

#### 5.1.3 编写单元测试
- 测试记录功能
- 测试链式哈希
- 测试篡改检测
- 测试链验证

---

## 6. 交互层实现任务

### 6.1 实现 Presence Core 持续存在感

**需求映射**: REQ-INT-001

**任务描述**: 创建 Presence Core 模块，支持主动发起交互，保持在线存在感。

**输入**:
- 设计文档中的 PresenceCore 接口定义
- 现有通知渠道

**输出**:
- `src/interaction/presence-core.ts` - Presence Core 实现
- `src/interaction/presence-core.test.ts` - 单元测试

**验收标准**:
- [ ] 能够主动通知机会
- [ ] 能够告警风险
- [ ] 能够汇报进度
- [ ] 能够请求决策
- [ ] 能够广播到多个渠道
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 6.1.1 实现 PresenceCore 类
- 实现 `notifyOpportunity(opportunity)` 方法
- 实现 `alertRisk(risk)` 方法
- 实现 `reportProgress(milestone)` 方法
- 实现 `requestDecision(decision)` 方法
- 实现 `setOnline()`, `setAway()`, `setBusy()` 方法
- 实现 `registerChannel(channel)` 方法
- 实现 `broadcast(event)` 方法

#### 6.1.2 编写单元测试
- 测试各类通知
- 测试状态管理
- 测试多渠道广播

---

## 7. 沙盒宇宙实现任务

### 7.1 实现 Sandbox Universe 沙盒宇宙

**需求映射**: REQ-SBX-001, REQ-SBX-002

**任务描述**: 创建 Sandbox Universe 模块，提供隔离的实验环境。

**输入**:
- 设计文档中的 SandboxUniverse 接口定义
- 现有 sandbox 机制

**输出**:
- `src/sandbox/sandbox-universe.ts` - 沙盒宇宙实现
- `src/sandbox/isolated-env.ts` - 隔离环境
- `src/sandbox/promotion-gate.ts` - 晋升门槛
- 对应的单元测试文件

**验收标准**:
- [ ] 能够创建隔离环境
- [ ] 能够运行实验
- [ ] 能够执行 A/B 测试
- [ ] 能够回放历史任务
- [ ] 能够执行晋升门槛验证
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 7.1.1 实现隔离环境
- 实现 `createIsolatedEnvironment()` 方法
- 实现 `destroyIsolatedEnvironment(envId)` 方法
- 实现资源隔离

#### 7.1.2 实现 SandboxUniverse 类
- 实现 `createExperiment(config)` 方法
- 实现 `runExperiment(experiment)` 方法
- 实现 `abortExperiment(experimentId)` 方法
- 实现 `setupABTest(config)` 方法
- 实现 `runABTest(test)` 方法
- 实现 `replayHistory(taskIds, config)` 方法
- 实现 `submitForPromotion(experiment)` 方法

#### 7.1.3 实现晋升门槛
- 实现功能验证门槛
- 实现回归验证门槛
- 实现安全验证门槛
- 实现主权审查门槛

#### 7.1.4 编写单元测试
- 测试隔离环境
- 测试实验运行
- 测试 A/B 测试
- 测试晋升门槛

---

## 8. 迁移路径实现任务

### 8.1 实现六阶段迁移路径

**需求映射**: REQ-MIG-001 ~ REQ-MIG-006

**任务描述**: 实现从当前状态到强自治架构的六阶段迁移路径。

**输入**:
- 设计文档中的迁移路径设计
- 现有配置文件

**输出**:
- `src/migration/phase-a.ts` - 阶段A实现
- `src/migration/phase-b.ts` - 阶段B实现
- `src/migration/phase-c.ts` - 阶段C实现
- `src/migration/phase-d.ts` - 阶段D实现
- `src/migration/phase-e.ts` - 阶段E实现
- `src/migration/phase-f.ts` - 阶段F实现
- `src/migration/index.ts` - 迁移协调器
- 对应的单元测试文件

**验收标准**:
- [ ] 阶段A能够完成制度化迁移
- [ ] 阶段B能够完成资产化迁移
- [ ] 阶段C能够完成自治开发化迁移
- [ ] 阶段D能够完成组织自治化迁移
- [ ] 阶段E能够完成沙盒宇宙化迁移
- [ ] 阶段F能够完成持续运行化迁移
- [ ] 每个阶段都有回滚路径
- [ ] 单元测试覆盖率 ≥ 80%

**子任务**:

#### 8.1.1 实现阶段A - 制度化
- 实现配置映射逻辑
- 实现宪章生成
- 实现宪章验证
- 实现回滚

#### 8.1.2 实现阶段B - 资产化
- 实现能力扫描
- 实现资产记录创建
- 实现索引构建
- 实现回滚

#### 8.1.3 实现阶段C - 自治开发化
- 实现 Genesis Team 初始化
- 实现自动开发流水线配置
- 实现回滚

#### 8.1.4 实现阶段D - 组织自治化
- 实现进化层代理初始化
- 实现组织扫描配置
- 实现回滚

#### 8.1.5 实现阶段E - 沙盒宇宙化
- 实现沙盒宇宙创建
- 实现隔离环境配置
- 实现晋升门槛配置
- 实现回滚

#### 8.1.6 实现阶段F - 持续运行化
- 实现持续运行配置
- 实现长期监测配置
- 实现自主调度器启动
- 实现回滚

#### 8.1.7 实现迁移协调器
- 实现阶段检测
- 实现阶段执行
- 实现进度报告
- 实现全局回滚

#### 8.1.8 编写单元测试
- 测试每个阶段的迁移逻辑
- 测试回滚功能
- 测试协调器

---

## 9. 系统集成任务

### 9.1 集成到现有系统

**需求映射**: 所有需求

**任务描述**: 将新模块集成到现有 OpenClaw 系统。

**输入**:
- 所有新实现的模块
- 现有 Gateway, ACP, Task Registry

**输出**:
- 更新的 `src/entry.ts` - 启动入口
- 更新的 `src/gateway/index.ts` - Gateway 集成
- 更新的 `src/acp/control-plane/manager.ts` - ACP 集成
- 集成测试

**验收标准**:
- [ ] 系统能够正常启动
- [ ] 宪章在启动时加载
- [ ] 伦理规则在操作前检查
- [ ] 审计流正常记录
- [ ] 与现有功能兼容
- [ ] 集成测试通过

**子任务**:

#### 9.1.1 更新启动入口
- 在 `src/entry.ts` 中添加宪章加载
- 添加 EthicalCore 初始化
- 添加 SovereigntyAuditor 启动

#### 9.1.2 集成到 Gateway
- 在请求处理前检查伦理规则
- 记录审计事件

#### 9.1.3 集成到 ACP Control Plane
- 在会话创建时检查权限边界
- 集成主权审计

#### 9.1.4 集成到 Task Registry
- 扩展为 TaskOS
- 集成审计流

#### 9.1.5 编写集成测试
- 测试启动流程
- 测试请求处理流程
- 测试任务执行流程

---

## 10. 测试与文档任务

### 10.1 完善测试覆盖

**任务描述**: 确保所有模块测试覆盖率达标。

**验收标准**:
- [ ] 所有模块单元测试覆盖率 ≥ 80%
- [ ] 集成测试覆盖关键流程
- [ ] 沙盒测试验证晋升流程

**子任务**:

#### 10.1.1 补充缺失的单元测试
- 检查覆盖率报告
- 补充未覆盖的测试用例

#### 10.1.2 编写集成测试
- 测试治理层集成
- 测试进化层集成
- 测试执行层集成

#### 10.1.3 编写沙盒测试
- 测试晋升流程
- 测试 A/B 测试
- 测试历史回放

---

### 10.2 更新文档

**任务描述**: 更新项目文档，记录强自治架构。

**验收标准**:
- [ ] 更新 README 说明强自治模式
- [ ] 更新配置文档
- [ ] 添加迁移指南

**子任务**:

#### 10.2.1 更新 README
- 添加强自治架构说明
- 添加配置示例

#### 10.2.2 编写配置文档
- 文档化宪章配置
- 文档化迁移配置

#### 10.2.3 编写迁移指南
- 文档化六阶段迁移
- 文档化回滚步骤

---

## 任务依赖关系

```
1.1 CharterLoader ──────────────────┐
                                    │
1.2 EthicalCore ────────────────────┼──> 9.1 系统集成
                                    │
1.3 SovereigntyAuditor ─────────────┤
                                    │
1.4 SovereignApproval ──────────────┘

2.1 Genesis Team ───────────────────┐
2.2 Founder ────────────────────────┤
2.3 Strategist ─────────────────────┼──> 8.1 迁移路径
2.4 Algorithmist ───────────────────┘

3.1 Librarian ──────────────────────┐
                                    │
3.2 PromotionPipeline ──────────────┴──> 7.1 Sandbox Universe

4.1 Executor ───────────────────────┐
4.2 OperatorSwarm ──────────────────┤
4.3 TaskOS ─────────────────────────┼──> 9.1 系统集成
4.4 AutonomousScheduler ────────────┘

5.1 AuditStream ───────────────────────> 1.3 SovereigntyAuditor

6.1 PresenceCore ───────────────────────> 1.4 SovereignApproval

7.1 Sandbox Universe ───────────────────> 3.2 PromotionPipeline

8.1 迁移路径 ───────────────────────────> 9.1 系统集成

9.1 系统集成 ───────────────────────────> 10.1 测试覆盖

10.1 测试覆盖 ──────────────────────────> 10.2 更新文档
```

---

## 执行优先级

| 优先级 | 任务 | 原因 |
|--------|------|------|
| P0 | 1.1 CharterLoader | 其他模块依赖宪章配置 |
| P0 | 1.2 EthicalCore | 安全基础，必须优先实现 |
| P0 | 5.1 AuditStream | 审计是所有操作的基础 |
| P1 | 1.3 SovereigntyAuditor | 治理层核心 |
| P1 | 1.4 SovereignApproval | 主权审批流程 |
| P1 | 3.1 Librarian | 能力层基础 |
| P2 | 4.3 TaskOS | 执行层核心 |
| P2 | 4.4 AutonomousScheduler | 自主运行基础 |
| P2 | 7.1 Sandbox Universe | 演化验证基础 |
| P3 | 2.1-2.4 进化层代理 | 依赖基础设施 |
| P3 | 4.1-4.2 Executor/OperatorSwarm | 依赖 TaskOS |
| P4 | 6.1 PresenceCore | 交互增强 |
| P4 | 8.1 迁移路径 | 依赖所有模块 |
| P5 | 9.1 系统集成 | 最后集成 |
| P5 | 10.1-10.2 测试与文档 | 收尾工作 |

---

## 预估工作量

| 任务 | 预估时间 | 复杂度 |
|------|----------|--------|
| 1.1 CharterLoader | 2天 | 中 |
| 1.2 EthicalCore | 2天 | 中 |
| 1.3 SovereigntyAuditor | 3天 | 高 |
| 1.4 SovereignApproval | 2天 | 中 |
| 2.1 Genesis Team | 4天 | 高 |
| 2.2 Founder | 2天 | 中 |
| 2.3 Strategist | 2天 | 中 |
| 2.4 Algorithmist | 2天 | 中 |
| 3.1 Librarian | 3天 | 高 |
| 3.2 PromotionPipeline | 2天 | 中 |
| 4.1 Executor | 3天 | 高 |
| 4.2 OperatorSwarm | 2天 | 中 |
| 4.3 TaskOS | 3天 | 高 |
| 4.4 AutonomousScheduler | 2天 | 中 |
| 5.1 AuditStream | 2天 | 中 |
| 6.1 PresenceCore | 2天 | 中 |
| 7.1 Sandbox Universe | 4天 | 高 |
| 8.1 迁移路径 | 3天 | 高 |
| 9.1 系统集成 | 3天 | 高 |
| 10.1 测试覆盖 | 2天 | 中 |
| 10.2 更新文档 | 1天 | 低 |

**总计**: 约 48 人天

---

## 附录：代码生成提示模板

### A.1 模块实现提示模板

```
请实现以下 TypeScript 模块：

**模块路径**: {module_path}
**职责**: {description}

**接口定义**:
```typescript
{interface_definition}
```

**实现要求**:
1. 严格遵循接口定义
2. 使用强类型，避免 any
3. 实现完整的错误处理
4. 添加详细的 JSDoc 注释
5. 编写对应的单元测试

**依赖模块**: {dependencies}

**参考设计文档**: .codeartsdoer/specs/strong-autonomous-architecture/design.md
```

### A.2 测试用例提示模板

```
请为以下模块编写单元测试：

**模块路径**: {module_path}
**测试路径**: {test_path}

**测试场景**:
{test_scenarios}

**测试要求**:
1. 使用 Vitest 测试框架
2. 覆盖率目标 ≥ 80%
3. 测试正常和异常场景
4. 使用 mock 隔离外部依赖
```

### A.3 集成提示模板

```
请将以下新模块集成到现有系统：

**新模块**: {new_module}
**集成点**: {integration_point}
**现有代码**: {existing_code}

**集成要求**:
1. 保持向后兼容
2. 不破坏现有功能
3. 添加必要的配置项
4. 更新启动流程
```
