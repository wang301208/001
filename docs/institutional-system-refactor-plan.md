# 助手制度化系统重构实施方案

## 📋 项目愿景

将助手从一个"多代理工程平台"演进为一个**可持续自我组织、自我开发、自我升级的自治 AI 制度化系统**。

> **核心转变**: 从"接收用户请求并调用模型" → "自主决定组织、能力、步骤、实验、验证和后续迭代"

---

## 🎯 当前状态评估（2026.4.16）

### ✅ 已完成的基础设施

#### 1. 治理层宪章体系
- ✅ `governance/charter/constitution.yaml` - 总宪章（231行，定义六层架构、主权边界、突变分类）
- ✅ `governance/charter/policies/sovereignty.yaml` - 主权规则（130行，决策矩阵、越界检测）
- ✅ `governance/charter/policies/evolution-policy.yaml` - 进化规则（140行，提案流程、沙盒验证）
- ✅ `governance/charter/agents/*.yaml` - 11个代理蓝图（Founder, Strategist, Algorithmist, Librarian, Executor, Sovereignty Auditor, Sentinel, Archaeologist, TDD Developer, QA, Publisher）
- ✅ `governance/charter/evolution/genesis-team.yaml` - Genesis Team团队制度
- ✅ `governance/charter/capability/asset-registry.yaml` - 能力资产注册表

#### 2. 治理层代码实现（src/governance/）
- ✅ `capability-registry.ts` (60.5KB) - 能力注册表系统
- ✅ `capability-asset-registry.ts` (12.8KB) - 能力资产管理
- ✅ `sandbox-universe.ts` (49.4KB) - 沙盒宇宙控制器
- ✅ `proposals.ts` (52.1KB) - 提案系统
- ✅ `autonomy-proposals.ts` (29.7KB) - 自治提案
- ✅ `control-plane.ts` (24.0KB) - 控制面板
- ✅ `charter-agents.ts` (22.2KB) - 宪章代理管理
- ✅ `charter-runtime.ts` (17.8KB) - 宪章运行时
- ✅ `sovereignty-auditor.ts` (5.0KB) - 主权审计器
- ✅ `sovereignty-incidents.ts` (12.9KB) - 主权事件管理
- ✅ `runtime-contract.ts` (10.3KB) - 运行时契约

#### 3. CLI 命令集成
- ✅ `zhushou governance overview` - 治理概览
- ✅ `zhushou governance proposals` - 提案管理
- ✅ `zhushou autonomy capability-inventory` - 能力清单
- ✅ `zhushou autonomy genesis-plan` - Genesis 规划
- ✅ `zhushou autonomy architecture-readiness` - 架构就绪度检查
- ✅ `zhushou autonomy activate` - 激活自治系统

#### 4. 测试覆盖
- ✅ 23个测试文件，覆盖治理层核心功能
- ✅ sandbox-universe.test.ts (13.6KB)
- ✅ capability-registry.test.ts (13.4KB)
- ✅ autonomy-proposals.test.ts (11.4KB)
- ✅ proposals.test.ts (21.9KB)

### ⚠️ 待整合的关键缺口

#### 1. 宪章与运行时的深度绑定
**现状**: 宪章 YAML 文件存在，但未完全驱动运行时行为
**缺口**:
- ❌ constitution.yaml 未自动加载到 agent-scope-config.ts
- ❌ policies/*.yaml 未真正控制 sandbox policy 和 freeze logic
- ❌ 代理蓝图未自动映射到 ACP control plane

**影响**: 治理层仍是"文档"而非"运行时法律"

#### 2. 沙盒宇宙控制器 MVP
**现状**: sandbox-universe.ts 有完整类型定义和部分实现
**缺口**:
- ❌ Universe Controller 状态机未完全实现（proposed → provisioning → running → observing → completed/rejected/promoted/rolled_back）
- ❌ Replay Runner 未实现历史回放功能
- ❌ Promotion Gate 未与 QA runtime 深度集成
- ❌ 沙盒宇宙未暴露为独立的运行时服务

**影响**: 无法安全地进行组织、能力、策略、算法试验

#### 3. Genesis Team 运行时闭环
**现状**: Genesis Team 蓝图已定义，但各角色未形成自动化流水线
**缺口**:
- ❌ Sentinel 未持续扫描 telemetry 并自动打开 evolution project
- ❌ Archaeologist 未自动进行根因分析
- ❌ TDD Developer 未在 bounded workspace 中自动构建候选方案
- ❌ QA 未自动执行回归测试
- ❌ Publisher 未自动将通过验收的资产登记入库

**影响**: 能力创造仍是"手动触发"而非"制度化流水线"

#### 4. Promotion Manifest 统一记录系统
**现状**: 有 proposals.ts 和 autonomy-proposals.ts，但未形成统一的 manifest 格式
**缺口**:
- ❌ 缺少标准化的 promotion manifest schema
- ❌ 缺少 mandatory artifacts 的强制检查（proposal_record, experiment_report, qa_report, rollback_plan, asset_or_org_manifest）
- ❌ 缺少 post-promotion observation 机制

**影响**: 提升过程缺乏可追溯性和一致性

#### 5. 组织态势面板（前端 UI）
**现状**: 只有命令行输出，无可视化面板
**缺口**:
- ❌ 前端未展示代理组织图
- ❌ 前端未展示演化项目状态
- ❌ 前端未展示冻结状态
- ❌ 前端未展示资产提升流水线
- ❌ 前端未展示沙盒宇宙实验状态

**影响**: 人类主权者无法直观理解系统状态

---

## 🚀 重构实施路线图

### 第一阶段：宪章绑定运行时（Week 1-2）

**目标**: 让 constitution.yaml 真正成为运行时法律，而非静态文档

#### 任务 1.1: 宪章加载器
```typescript
// src/governance/charter-loader.ts
export async function loadConstitution(): Promise<ConstitutionRuntime> {
  // 1. 读取 constitution.yaml
  // 2. 解析 sovereign_boundaries
  // 3. 解析 institutional_layers
  // 4. 解析 mutation_classes
  // 5. 解析 promotion_pipeline
  // 6. 返回 ConstitutionRuntime 对象
}
```

**验收标准**:
- ✅ constitution.yaml 可在启动时加载
- ✅ sovereign_boundaries 可用于权限检查
- ✅ mutation_classes 可用于风险评估

#### 任务 1.2: 代理蓝图自动映射
```typescript
// src/governance/agent-blueprint-mapper.ts
export async function mapAgentBlueprintsToACP(): Promise<void> {
  // 1. 读取 governance/charter/agents/*.yaml
  // 2. 解析每个代理的 jurisdiction, authority, contract
  // 3. 映射到 ACP control plane 的 agent scope config
  // 4. 设置 allowed_tools, memory_scope, write_scope
  // 5. 配置 network_policy 和 escalation_policy
}
```

**验收标准**:
- ✅ 所有 11 个代理蓝图自动加载到运行时
- ✅ 代理的 allowed_tools 自动配置
- ✅ 代理的 write_scope 自动限制

#### 任务 1.3: 主权边界 enforcement
```typescript
// src/governance/sovereignty-enforcer.ts
export class SovereigntyEnforcer {
  async checkMutationAuthority(
    mutation: MutationRequest,
    actor: AgentIdentity
  ): Promise<AuthorityDecision> {
    // 1. 根据 mutation_class 判断风险等级
    // 2. 检查 actor 是否有权限
    // 3. 如果是 sovereign_mutation，要求 human_sovereign_approval
    // 4. 如果越界，自动触发 freeze
  }
  
  async enforceFreeze(target: SubsystemTarget): Promise<void> {
    // 1. 冻结目标子系统
    // 2. 记录 sovereignty_incident
    // 3. 通知 human_sovereign
  }
}
```

**验收标准**:
- ✅ sovereign_mutation 必须经过 human approval
- ✅ 越界行为自动触发 freeze
- ✅ 所有 enforcement 动作记录到 audit_stream

---

### 第二阶段：沙盒宇宙控制器 MVP（Week 3-4）

**目标**: 实现沙盒宇宙的最小可行闭环，支持安全的组织/能力/策略/算法试验

#### 任务 2.1: Universe Controller 状态机
```typescript
// src/governance/sandbox-universe-controller.ts
export class SandboxUniverseController {
  private state: SandboxUniverseState;
  
  async createExperiment(plan: SandboxUniverseExperimentPlan): Promise<string> {
    // 1. 生成 universe_id
    // 2. 创建 artifact_dir
    // 3. 初始化 state.json
    // 4. 设置状态为 "provisioning"
    // 5. 返回 universe_id
  }
  
  async transitionStage(
    universeId: string,
    fromStage: SandboxUniverseExperimentStageId,
    toStage: SandboxUniverseExperimentStageId,
    evidence: SandboxUniverseEvidenceArtifact[]
  ): Promise<void> {
    // 1. 验证 required_evidence 是否齐全
    // 2. 更新 stage status
    // 3. 记录 transition 到 audit_stream
    // 4. 如果进入 "completed"，触发 promotion_gate 检查
  }
  
  async promote(universeId: string): Promise<PromotionResult> {
    // 1. 检查所有 stages 是否 passed
    // 2. 检查 required_artifacts 是否齐全
    // 3. 调用 Promotion Gate
    // 4. 如果通过，标记为 "promoted"
    // 5. 否则标记为 "rejected"
  }
  
  async rollback(universeId: string): Promise<void> {
    // 1. 恢复 pre-experiment state
    // 2. 标记为 "rolled_back"
    // 3. 记录 rollback 原因
  }
}
```

**验收标准**:
- ✅ 可创建沙盒实验
- ✅ 状态机正确流转（proposed → ... → promoted/rejected/rolled_back）
- ✅ 所有 transitions 记录到 audit_stream

#### 任务 2.2: Replay Runner
```typescript
// src/governance/sandbox-replay-runner.ts
export class SandboxReplayRunner {
  async planReplay(universeId: string): Promise<SandboxUniverseReplayPlan> {
    // 1. 从 task_history 提取相关 scenarios
    // 2. 确定 workspace_dirs
    // 3. 定义 required_outputs
    // 4. 返回 replay plan
  }
  
  async executeReplay(plan: SandboxUniverseReplayPlan): Promise<ReplayReport> {
    // 1. 在沙盒环境中重放 scenarios
    // 2. 收集 outputs
    // 3. 对比 expected vs actual
    // 4. 生成 replay_report
    // 5. 记录到 artifact_dir
  }
}
```

**验收标准**:
- ✅ 可基于历史 task 生成 replay plan
- ✅ 可在沙盒中执行 replay
- ✅ 生成可比较的 replay_report

#### 任务 2.3: Promotion Gate
```typescript
// src/governance/promotion-gate.ts
export class PromotionGate {
  async evaluate(universeId: string): Promise<PromotionGateDecision> {
    // 1. 检查 freeze_active 是否为 true
    // 2. 检查所有 blockers 是否 cleared
    // 3. 检查 required_evidence 是否齐全
    // 4. 调用 QA runtime 进行最终验证
    // 5. 返回 decision (approve/reject)
  }
  
  async registerPromotion(
    universeId: string,
    decision: PromotionGateDecision
  ): Promise<void> {
    // 1. 创建 promotion_record
    // 2. 更新 asset_registry
    // 3. 通知 Librarian
    // 4. 记录到 audit_stream
  }
}
```

**验收标准**:
- ✅ Promotion Gate 可评估实验是否可提升
- ✅ 通过后自动注册到 asset_registry
- ✅ 所有 decisions 记录到 audit_stream

---

### 第三阶段：Genesis Team 运行时闭环（Week 5-6）

**目标**: 让能力缺口自动进入 Sentinel → Archaeologist → TDD Developer → QA → Publisher 流水线

#### 任务 3.1: Sentinel 持续扫描
```typescript
// src/governance/genesis-sentinel-loop.ts
export class SentinelLoop {
  async scan(): Promise<GapSignal[]> {
    // 1. 读取 task_history
    // 2. 读取 flow_history
    // 3. 读取 qa_failures
    // 4. 读取 capability_inventory
    // 5. 检测 gaps 和 risks
    // 6. 返回 gap_signals
  }
  
  async openEvolutionProject(signal: GapSignal): Promise<string> {
    // 1. 创建 evolution proposal
    // 2. 分配给 Archaeologist
    // 3. 记录到 governance_proposals
    // 4. 返回 proposal_id
  }
}
```

**验收标准**:
- ✅ Sentinel 每 N 分钟自动扫描
- ✅ 检测到 gap 后自动打开 evolution project
- ✅ 所有 signals 记录到 audit_stream

#### 任务 3.2: Archaeologist 根因分析
```typescript
// src/governance/genesis-archaeologist-loop.ts
export class ArchaeologistLoop {
  async analyzeRootCause(proposalId: string): Promise<ChangePlan> {
    // 1. 读取 proposal
    // 2. 分析依赖结构
    // 3. 定位 root cause
    // 4. 制定 change_plan
    // 5. 传递给 TDD Developer
    // 6. 返回 change_plan
  }
}
```

**验收标准**:
- ✅ Archaeologist 自动接收 proposal
- ✅ 生成详细的 change_plan
- ✅ 传递给 TDD Developer

#### 任务 3.3: TDD Developer 候选方案构建
```typescript
// src/governance/genesis-tdd-developer-loop.ts
export class TDDDeveloperLoop {
  async buildCandidate(changePlan: ChangePlan): Promise<CandidateManifest> {
    // 1. 在 bounded workspace 中工作
    // 2. 编写 tests first
    // 3. 实现 candidate code
    // 4. 运行 local validation
    // 5. 生成 candidate_manifest
    // 6. 传递给 QA
    // 7. 返回 candidate_manifest
  }
}
```

**验收标准**:
- ✅ TDD Developer 在 bounded workspace 中工作
- ✅ 生成 candidate_manifest
- ✅ 传递给 QA

#### 任务 3.4: QA 自动验证
```typescript
// src/governance/genesis-qa-loop.ts
export class QALoop {
  async validate(candidateManifest: CandidateManifest): Promise<QAReport> {
    // 1. 执行 functional tests
    // 2. 执行 regression tests
    // 3. 执行 security audit
    // 4. 生成 qa_report
    // 5. 如果通过，传递给 Publisher
    // 6. 否则返回 TDD Developer
    // 7. 返回 qa_report
  }
}
```

**验收标准**:
- ✅ QA 自动执行验证
- ✅ 生成 qa_report
- ✅ 通过后传递给 Publisher

#### 任务 3.5: Publisher 资产登记
```typescript
// src/governance/genesis-publisher-loop.ts
export class PublisherLoop {
  async promote(qaReport: QAReport): Promise<PromotionRecord> {
    // 1. 验证 qa_report
    // 2. 验证 audit_trace
    // 3. 验证 rollback_reference
    // 4. 调用 Librarian 注册资产
    // 5. 创建 promotion_record
    // 6. 记录到 audit_stream
    // 7. 返回 promotion_record
  }
}
```

**验收标准**:
- ✅ Publisher 自动登记通过的资产
- ✅ 调用 Librarian 更新 asset_registry
- ✅ 所有 promotions 记录到 audit_stream

---

### 第四阶段：Promotion Manifest 统一系统（Week 7）

**目标**: 建立标准化的 promotion manifest schema 和强制检查机制

#### 任务 4.1: Manifest Schema 定义
```typescript
// src/governance/promotion-manifest-schema.ts
export interface PromotionManifest {
  id: string;
  version: number;
  proposalId: string;
  universeId: string;
  mutationClass: MutationClass;
  artifacts: {
    proposalRecord: ArtifactReference;
    experimentReport: ArtifactReference;
    qaReport: ArtifactReference;
    rollbackPlan: ArtifactReference;
    assetOrOrgManifest: AssetManifest | OrganizationManifest;
  };
  promotionPipeline: {
    stages: PromotionStage[];
    currentStage: PromotionStageId;
    completedAt?: number;
  };
  auditTrail: AuditEntry[];
}
```

**验收标准**:
- ✅ 定义完整的 PromotionManifest schema
- ✅ 所有 5 个 mandatory artifacts 必须存在
- ✅ schema 用于验证所有 promotions

#### 任务 4.2: Manifest Validator
```typescript
// src/governance/promotion-manifest-validator.ts
export class PromotionManifestValidator {
  async validate(manifest: PromotionManifest): Promise<ValidationResult> {
    // 1. 检查所有 mandatory_artifacts 是否存在
    // 2. 检查 promotion_pipeline.stages 是否完整
    // 3. 检查 audit_trail 是否连续
    // 4. 检查 rollback_plan 是否有效
    // 5. 返回 validation_result
  }
}
```

**验收标准**:
- ✅ 拒绝不完整的 manifest
- ✅ 所有 validations 记录到 audit_stream

#### 任务 4.3: Post-Promotion Observation
```typescript
// src/governance/post-promotion-observer.ts
export class PostPromotionObserver {
  async observe(promotionId: string): Promise<ObservationReport> {
    // 1. 监控 promoted asset 的行为
    // 2. 检测 regressions
    // 3. 收集 performance metrics
    // 4. 生成 observation_report
    // 5. 如果发现严重问题，触发 rollback
  }
}
```

**验收标准**:
- ✅ 自动监控 promoted assets
- ✅ 发现 regressions 时自动告警
- ✅ 必要时自动触发 rollback

---

### 第五阶段：组织态势面板（Week 8-9）

**目标**: 在前端 UI 中可视化展示系统的组织状态

#### 任务 5.1: 后端 API
```typescript
// src/gateway/organization-status-api.ts
export interface OrganizationStatusAPI {
  getAgentTopology(): Promise<AgentTopology>;
  getEvolutionProjects(): Promise<EvolutionProject[]>;
  getFreezeStatus(): Promise<FreezeStatus>;
  getAssetPromotionPipeline(): Promise<AssetPromotionPipeline>;
  getSandboxUniverseStatus(): Promise<SandboxUniverseStatus>;
}
```

**验收标准**:
- ✅ 提供 REST API 或 WebSocket 接口
- ✅ 返回实时组织状态
- ✅ 支持订阅更新

#### 任务 5.2: 前端组件
```typescript
// web/src/components/organization-dashboard.tsx
export function OrganizationDashboard() {
  return (
    <div>
      <AgentTopologyGraph />
      <EvolutionProjectList />
      <FreezeStatusIndicator />
      <AssetPromotionPipeline />
      <SandboxUniverseMonitor />
    </div>
  );
}
```

**验收标准**:
- ✅ 展示代理组织图
- ✅ 展示演化项目状态
- ✅ 展示冻结状态
- ✅ 展示资产提升流水线
- ✅ 展示沙盒宇宙实验状态

#### 任务 5.3: 实时更新
```typescript
// web/src/hooks/use-organization-status.ts
export function useOrganizationStatus() {
  // 1. 订阅 WebSocket 更新
  // 2. 缓存最新状态
  // 3. 触发 UI 重新渲染
}
```

**验收标准**:
- ✅ UI 实时更新（延迟 < 1s）
- ✅ 支持离线缓存
- ✅ 支持手动刷新

---

## 📊 成功指标

### 技术指标
- ✅ 宪章加载时间 < 100ms
- ✅ 沙盒实验创建时间 < 5s
- ✅ Genesis Team 闭环周期 < 30min（从 gap detection 到 promotion）
- ✅ Promotion manifest 验证时间 < 1s
- ✅ UI 更新延迟 < 1s

### 业务指标
- ✅ 90% 的能力缺口在 1h 内被 Sentinel 检测
- ✅ 80% 的 evolution projects 在 24h 内完成闭环
- ✅ 0 次 sovereign boundary violation
- ✅ 100% 的 promotions 有完整的 audit trail
- ✅ 人类主权者可随时查看系统状态

---

## 🔧 技术栈与工具

### 现有技术（无需新增）
- Node.js >= 22.14.0
- TypeScript ES2023
- pnpm 10.32.1
- SQLite / LanceDB
- Vitest 测试框架
- Lit 前端框架

### 可能需要的新增依赖
- `js-yaml` - YAML 解析（如果尚未使用）
- `zod` - Schema 验证（已有 ^4.3.6）
- `ws` - WebSocket 支持（如果尚未使用）

---

## ⚠️ 风险与缓解

### 风险 1: 宪章与现有代码冲突
**缓解**: 
- 逐步迁移，先只读不写
- 保留 fallback 机制
- 充分测试后再启用 enforcement

### 风险 2: 沙盒性能开销
**缓解**:
- 使用轻量级隔离（workspace dirs，非完整容器）
- 并行执行多个沙盒实验
- 设置资源预算限制

### 风险 3: Genesis Team 误报率高
**缓解**:
- 初始阶段设置为 advisory mode
- 人工审核前 100 个 signals
- 逐步调整 detection thresholds

### 风险 4: UI 复杂度爆炸
**缓解**:
- 采用渐进式披露设计
- 优先展示最关键的信息
- 提供过滤和搜索功能

---

## 📅 里程碑

| 阶段 | 时间 | 交付物 | 验收标准 |
|------|------|--------|----------|
| 第一阶段 | Week 1-2 | 宪章绑定运行时 | constitution.yaml 驱动 agent scope 和 sandbox policy |
| 第二阶段 | Week 3-4 | 沙盒宇宙控制器 MVP | 可创建、执行、提升沙盒实验 |
| 第三阶段 | Week 5-6 | Genesis Team 运行时闭环 | Sentinel → Publisher 自动化流水线 |
| 第四阶段 | Week 7 | Promotion Manifest 系统 | 标准化 manifest schema 和强制检查 |
| 第五阶段 | Week 8-9 | 组织态势面板 | 前端可视化展示系统状态 |

---

## 🎓 学习与文档

### 必读文档
1. `docs/zhushou-current-architecture-adapted.zh-CN.md` - 强自治目标架构方案
2. `governance/sandbox-universe-minimal-design.zh-CN.md` - 沙盒宇宙最小设计稿
3. `governance/charter/index.zh-CN.md` - 组织宪章索引
4. `governance/charter/constitution.yaml` - 总宪章

### 关键代码文件
1. `src/governance/capability-registry.ts` - 能力注册表
2. `src/governance/sandbox-universe.ts` - 沙盒宇宙
3. `src/governance/proposals.ts` - 提案系统
4. `src/governance/control-plane.ts` - 控制面板

### 测试文件
1. `src/governance/sandbox-universe.test.ts`
2. `src/governance/capability-registry.test.ts`
3. `src/governance/autonomy-proposals.test.ts`

---

## 🤝 协作指南

### 开发者角色
- **架构师**: 负责整体设计和宪章维护
- **治理工程师**: 负责 src/governance/ 模块开发
- **前端工程师**: 负责组织态势面板开发
- **测试工程师**: 负责治理层测试覆盖

### 工作流程
1. 所有治理层变更必须先更新 charter YAML
2. 所有代码变更必须有对应的测试
3. 所有 promotions 必须有完整的 manifest
4. 所有 sovereign mutations 必须经过 human approval

---

## 📝 附录

### A. 术语表
- **Charter**: 宪章，定义系统的主权边界和组织规则
- **Sovereignty**: 主权，人类保留的最终控制权
- **Mutation Class**: 突变分类，根据风险等级划分变更类型
- **Promotion Pipeline**: 提升流水线，从提案到注册的完整流程
- **Sandbox Universe**: 沙盒宇宙，用于安全实验的隔离环境
- **Genesis Team**: 创始团队，负责能力创造的自治代理组

### B. 常见问题
**Q: 为什么需要沙盒宇宙？**
A: 沙盒宇宙允许系统在不污染正式环境的前提下进行高风险实验，确保演化的安全性。

**Q: Genesis Team 与普通代理有什么区别？**
A: Genesis Team 是专门负责能力创造的自治代理组，遵循严格的 TDD 流程和 QA 验证，而普通代理主要负责执行用户任务。

**Q: 人类主权者需要参与日常操作吗？**
A: 不需要。人类主权者只在四类事项上介入：宪章修改、根权限提升、对外高风险网络执行权限开放、系统停机/冻结/回滚。

### C. 参考资料
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Agent Control Protocol](https://github.com/anthropics/agent-control-protocol)

---

**文档版本**: 1.0  
**最后更新**: 2026-04-16  
**维护者**: 助手治理团队
