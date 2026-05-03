# 强自治目标架构方案 - 需求规格说明书

## 文档信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 状态 | 草稿 |
| 创建日期 | 2025-04-20 |
| 功能名称 | strong-autonomous-architecture |
| 基于文档 | docs/zhushou-current-architecture-adapted.zh-CN.md |

---

## 1. 概述

### 1.1 项目背景

助手 当前已具备自治系统的关键胚胎：Gateway/ACP 会话体系、主代理与子代理执行能力、task/flow registry 持久化、skills/plugins/memory/QA runtime、sandbox/approval/security audit、多端 UI 入口。

本需求规格定义将 助手 从"AI网关+多代理工具集"升级为"强自治AI操作系统"的需求。

### 1.2 核心目标

系统应演进为具备以下能力的自治体：
- 自主接收、理解、拆解并执行目标
- 自主维护技能、插件、策略、代理组织
- 自主感知瓶颈并发起内部演化项目
- 自主发现外部机会并设立成长目标
- 自主完成测试、验收、回归、部署建议
- 自主持续运行，不以一次对话为边界

### 1.3 自治原则

| 原则 | 描述 |
|------|------|
| 日常运行完全自治 | 非主权级操作无需人类审批 |
| 组织演化高度自治 | 代理角色、权限、协作拓扑可自主调整 |
| 能力创造高度自治 | 技能、插件、策略可自主开发与升级 |
| 主权级边界人类保留 | 宪章修改、根权限、高风险网络、系统停机需人类批准 |

---

## 2. 功能需求

### 2.1 治理层需求 (Governance Layer)

#### REQ-GOV-001: 组织宪章库

**需求描述**: 系统应建立组织宪章库作为系统制度的唯一上游。

**验收标准**:
- **When** 系统启动时，**the system shall** 加载 `governance/charter/` 目录下的所有宪章配置文件
- **When** 宪章配置发生变更时，**the system shall** 验证变更是否符合主权边界规则
- **Where** 宪章定义了代理角色、权限边界、组织层级、资源预算、变更级别、可接受风险范围，**the system shall** 将其作为运行时强制规则执行
- **If** 宪章文件缺失或格式无效，**the system shall** 拒绝启动并报告具体错误

#### REQ-GOV-002: 人类主权者权限

**需求描述**: 人类主权者应保留对主权级边界的控制权，不参与日常任务。

**验收标准**:
- **When** 发起宪章修改请求时，**the system shall** 要求人类主权者显式批准
- **When** 发起根权限提升请求时，**the system shall** 要求人类主权者显式批准
- **When** 发起对外高风险网络/执行权限开闸请求时，**the system shall** 要求人类主权者显式批准
- **When** 发起系统停机、冻结、回滚请求时，**the system shall** 要求人类主权者显式批准
- **Where** 操作不涉及上述四类主权事项，**the system shall** 默认自治执行，不请求许可

#### REQ-GOV-003: 伦理与安全核心

**需求描述**: 系统应实现运行时强制规则，防止绕过主权边界。

**验收标准**:
- **If** 代理尝试绕过宪章升级自身根权限，**the system shall** 拒绝操作并记录安全事件
- **If** 代理尝试删除或伪造审计记录，**the system shall** 拒绝操作并记录安全事件
- **If** 代理尝试静默扩大对外执行与网络访问边界，**the system shall** 拒绝操作并记录安全事件
- **If** 代理尝试未通过主权审批即修改主权级配置，**the system shall** 拒绝操作并记录安全事件

#### REQ-GOV-004: 主权审计器

**需求描述**: 系统应具备独立于执行层和进化层运行的主权审计器。

**验收标准**:
- **When** 系统运行时，**the system shall** 持续检查是否发生权限漂移、组织漂移、策略漂移
- **If** 发现越界行为，**the system shall** 自动冻结相关子系统，无需等待人类介入
- **When** 冻结子系统时，**the system shall** 保留取证快照并生成主权事件报告
- **Where** 审计器自身运行，**the system shall** 确保其独立于执行层和进化层

---

### 2.2 进化层需求 (Evolution Layer)

#### REQ-EVO-001: Founder 代理 - 组织演化

**需求描述**: 系统应具备 Founder 代理负责组织演化。

**验收标准**:
- **When** Founder 检测到系统瓶颈、角色冗余或职责冲突时，**the system shall** 生成组织变更提案
- **Where** Founder 提议新增代理角色、合并或拆分既有代理、调整层间职责，**the system shall** 在沙盒宇宙中验证
- **When** 组织变更通过沙盒验证后，**the system shall** 生成升级投票请求
- **If** 组织变更涉及宪章修改，**the system shall** 转交人类主权者审批

#### REQ-EVO-002: Strategist 代理 - 策略演化

**需求描述**: 系统应具备 Strategist 代理负责策略演化。

**验收标准**:
- **When** Strategist 分析任务历史、失败案例、恢复记录、子代理协作记录时，**the system shall** 提炼新一代执行策略
- **Where** 策略资产包括任务分解模板、子代理调用模式、QA模式、恢复策略、风险处置模板，**the system shall** 将其资产化存储
- **When** 新策略生成后，**the system shall** 在沙盒宇宙中进行回放验证
- **When** 策略验证通过后，**the system shall** 通过 Librarian 登记入库

#### REQ-EVO-003: Algorithmist 代理 - 算法演化

**需求描述**: 系统应具备 Algorithmist 代理负责算法演化。

**验收标准**:
- **Where** 算法范围包括检索算法、记忆选择算法、compaction算法、代理选择算法、任务排序算法、QA评估算法，**the system shall** 支持版本迭代
- **When** Algorithmist 发起算法研究项目时，**the system shall** 在沙盒宇宙中做对比实验
- **When** 新算法性能优于旧算法时，**the system shall** 生成升级建议
- **If** 算法变更涉及主权级边界，**the system shall** 转交人类主权者审批

#### REQ-EVO-004: Genesis Team - 工具与能力演化

**需求描述**: 系统应具备 Genesis Team 负责工具与能力演化。

**验收标准**:
- **When** Sentinel 检测到缺口、故障或风险时，**the system shall** 生成问题报告并触发 Archaeologist
- **When** Archaeologist 定位根因与依赖结构后，**the system shall** 生成修复方案并触发 TDD Developer
- **When** TDD Developer 编写或修改技能、插件、代码后，**the system shall** 触发 QA 验证
- **When** QA 完成验证与回归测试后，**the system shall** 触发 Publisher 发布
- **When** Publisher 发布能力资产时，**the system shall** 通过 Librarian 登记入库

---

### 2.3 能力层需求 (Capability Layer)

#### REQ-CAP-001: 能力资产统一管理

**需求描述**: 系统应将所有可复用能力资产化并统一管理。

**验收标准**:
- **Where** 资产类型包括 skills、plugins、memory、strategy_assets、algorithms、agent_blueprints，**the system shall** 统一纳入资产台账
- **When** 新资产创建时，**the system shall** 分配唯一版本标识并建立索引
- **When** 资产更新时，**the system shall** 保留历史版本并支持回滚
- **When** 资产废弃时，**the system shall** 检查依赖关系并提示影响范围

#### REQ-CAP-002: Librarian 资产管理员

**需求描述**: 系统应具备 Librarian 作为唯一资产管理员。

**验收标准**:
- **When** 代理请求检索资产时，**the system shall** 通过 Librarian 提供索引和检索服务
- **When** 新资产注册时，**the system shall** 通过 Librarian 执行去重检查
- **When** 资产归档时，**the system shall** 通过 Librarian 更新资产目录
- **When** 资产下线时，**the system shall** 通过 Librarian 检查并处理依赖影响

#### REQ-CAP-003: 资产准入门槛

**需求描述**: 所有新能力资产必须经过验证才能进入正式资产层。

**验收标准**:
- **When** 新资产提交时，**the system shall** 执行功能验证
- **When** 功能验证通过后，**the system shall** 执行回归验证
- **When** 回归验证通过后，**the system shall** 执行安全验证
- **If** 资产涉及宪章或根权限变更，**the system shall** 执行主权级变更审查
- **Where** 所有验证通过，**the system shall** 将资产登记入库并发布

---

### 2.4 执行层需求 (Execution Layer)

#### REQ-EXE-001: Executor 主执行者

**需求描述**: 系统应具备 Executor 作为用户目标与系统目标的主执行者。

**验收标准**:
- **When** 接收高层目标时，**the system shall** 将其分解为任务树、流程图和可交付结果
- **When** 执行需要调用已有能力时，**the system shall** 通过 Librarian 检索并调用
- **When** 执行发现能力缺口时，**the system shall** 向进化层请求补能力
- **When** 任务执行完成时，**the system shall** 记录效果并反哺记忆与策略

#### REQ-EXE-002: Operator Swarm 动态作业集群

**需求描述**: 系统应支持按任务临时生成执行代理群。

**验收标准**:
- **When** 任务需要特定工种时，**the system shall** 动态生成对应 worker（research-worker、code-worker、refactor-worker、test-worker、deployment-worker）
- **When** 任务完成时，**the system shall** 解散临时 worker 并回收资源
- **Where** worker 权限，**the system shall** 根据任务需求动态分配最小必要权限

#### REQ-EXE-003: Task OS 任务操作系统

**需求描述**: 系统应具备统一任务操作系统内核。

**验收标准**:
- **When** 任务提交时，**the system shall** 建立任务树和 DAG 编排
- **When** 任务存在依赖关系时，**the system shall** 按依赖顺序调度执行
- **When** 任务中断时，**the system shall** 保存状态并支持恢复
- **When** 任务失败时，**the system shall** 根据重试策略执行重试或回滚
- **When** 多任务并发时，**the system shall** 按优先级调度

#### REQ-EXE-004: Autonomous Scheduler 自主调度器

**需求描述**: 系统应具备持续运行的自主调度器。

**验收标准**:
- **When** 调度器运行时，**the system shall** 持续扫描待执行任务
- **When** 发现卡住任务时，**the system shall** 触发诊断和恢复流程
- **When** 发现可并行任务时，**the system shall** 并行调度执行
- **When** 发现瓶颈点时，**the system shall** 评估是否升级为内部演化任务

---

### 2.5 API与通信层需求 (API & Communication Layer)

#### REQ-API-001: Gateway Fabric 统一入口

**需求描述**: 系统应通过 Gateway Fabric 统一所有外部请求入口。

**验收标准**:
- **When** 外部请求到达时，**the system shall** 通过 Gateway Fabric 统一接收
- **When** 请求需要路由时，**the system shall** 根据请求类型路由到对应处理单元
- **Where** Gateway 作为北向入口，**the system shall** 保持与现有 Gateway 兼容

#### REQ-API-002: ACP Control Plane 代理控制平面

**需求描述**: 系统应具备 ACP Control Plane 管理代理会话和权限边界。

**验收标准**:
- **When** 代理会话建立时，**the system shall** 通过 ACP Control Plane 管理会话状态
- **When** 代理模式切换时，**the system shall** 通过 ACP Control Plane 执行切换
- **When** 代理权限边界变更时，**the system shall** 通过 ACP Control Plane 验证并执行
- **Where** 运行上下文，**the system shall** 通过 ACP Control Plane 维护

#### REQ-API-003: Audit Stream 审计流

**需求描述**: 系统应具备统一审计流记录所有自治行为。

**验收标准**:
- **When** 组织变更发生时，**the system shall** 记录到审计流
- **When** 权限变更发生时，**the system shall** 记录到审计流
- **When** 能力产物发布时，**the system shall** 记录到审计流
- **When** 算法版本切换时，**the system shall** 记录到审计流
- **When** 任务失败与回滚时，**the system shall** 记录到审计流
- **Where** 审计流，**the system shall** 确保不可篡改且机器可验证

---

### 2.6 交互层需求 (Interaction Layer)

#### REQ-INT-001: Presence Core 持续存在感

**需求描述**: 系统应具备持续在线存在感，支持主动发起交互。

**验收标准**:
- **When** 发现高优先级机会时，**the system shall** 主动通知用户
- **When** 发现主权风险时，**the system shall** 主动告警并请求人类介入
- **When** 完成阶段性成果时，**the system shall** 主动汇报进度
- **When** 需要主权者决策时，**the system shall** 主动发起决策请求

#### REQ-INT-002: 系统状态可视化

**需求描述**: 前端应展示系统内部状态，而非仅展示结果。

**验收标准**:
- **When** 用户查看系统状态时，**the system shall** 展示当前组织图
- **When** 用户查看任务状态时，**the system shall** 展示任务运行图
- **When** 用户查看能力状态时，**the system shall** 展示能力资产状态
- **When** 用户查看演化状态时，**the system shall** 展示正在进行的内部演化计划

---

### 2.7 沙盒宇宙需求 (Sandbox Universe)

#### REQ-SBX-001: 沙盒宇宙隔离环境

**需求描述**: 系统应建立沙盒宇宙用于安全试错和升级。

**验收标准**:
- **When** 需要测试新组织结构时，**the system shall** 在沙盒宇宙中模拟
- **When** 需要测试新技能、新插件、新代理角色时，**the system shall** 在沙盒宇宙中验证
- **When** 需要试验新策略与新算法时，**the system shall** 在沙盒宇宙中实验
- **When** 需要 A/B 实验时，**the system shall** 在沙盒宇宙中回放历史任务

#### REQ-SBX-002: 沙盒到正式系统晋升

**需求描述**: 沙盒成果必须通过门槛才能进入正式系统。

**验收标准**:
- **When** 沙盒成果提交晋升时，**the system shall** 执行功能验证
- **When** 功能验证通过后，**the system shall** 执行回归验证
- **When** 回归验证通过后，**the system shall** 执行安全验证
- **If** 成果涉及宪章或根权限变更，**the system shall** 执行主权级变更审查
- **Where** 所有门槛通过，**the system shall** 晋升到正式系统

---

### 2.8 代理自动开发需求

#### REQ-AUTO-001: 自动技能开发

**需求描述**: 系统应具备自动技能开发能力。

**验收标准**:
- **When** 执行层发现技能缺口时，**the system shall** 自动生成技能提案
- **When** 技能提案生成后，**the system shall** 自动补充脚本、说明、依赖、参数模板
- **When** 技能开发完成，**the system shall** 自动进入 QA 流程

#### REQ-AUTO-002: 自动插件开发

**需求描述**: 系统应具备自动插件开发能力。

**验收标准**:
- **When** 检测到新外部系统或新工具接口需求时，**the system shall** 自动生成插件原型
- **When** 插件原型生成后，**the system shall** 自动生成 manifest、runtime surface、测试样例

#### REQ-AUTO-003: 自动代理开发

**需求描述**: 系统应具备自动代理开发能力。

**验收标准**:
- **When** Founder 检测到组织瓶颈时，**the system shall** 自动提出新代理角色提案
- **When** 代理角色提案生成后，**the system shall** 明确其职责、权限、上游下游关系
- **When** 代理角色定义完成，**the system shall** 在沙盒中创建试验版代理

#### REQ-AUTO-004: 自动策略与算法开发

**需求描述**: 系统应具备自动策略与算法开发能力。

**验收标准**:
- **When** 检测到策略瓶颈时，**the system shall** 生成策略迭代提案
- **When** 检测到算法瓶颈时，**the system shall** 生成算法研究提案
- **When** 提案生成后，**the system shall** 在沙盒中做回放与对照实验

---

### 2.9 代理蓝图需求

#### REQ-BLUE-001: 代理蓝图标准格式

**需求描述**: 每个代理蓝图必须定义完整的治理字段。

**验收标准**:
- **Where** 代理蓝图文件，**the system shall** 包含以下必填字段：
  - `id`: 代理唯一标识
  - `role`: 代理角色类型
  - `mission`: 代理使命描述
  - `jurisdiction`: 管辖范围（can_observe, can_decide, cannot_decide）
  - `authority`: 权限级别与范围
  - `allowed_subagents`: 允许调用的子代理列表
  - `allowed_tools`: 允许使用的工具列表
  - `resource_budget`: 资源预算（tokens, parallelism, runtime）
  - `network_scope`: 网络访问范围
  - `memory_scope`: 记忆访问范围
  - `mutation_scope`: 变更范围（allow, deny）
  - `qa_requirements`: QA 验证要求
  - `promotion_policy`: 晋升策略
  - `rollback_policy`: 回滚策略

#### REQ-BLUE-002: 变更范围控制

**需求描述**: 代理的变更范围必须明确定义。

**验收标准**:
- **When** 代理执行变更操作时，**the system shall** 检查操作是否在 mutation_scope.allow 范围内
- **If** 操作在 mutation_scope.deny 范围内，**the system shall** 拒绝操作
- **Where** mutation_scope.deny 包含 constitution，**the system shall** 禁止代理修改宪章

---

### 2.10 迁移路径需求

#### REQ-MIG-001: 阶段A - 制度化

**需求描述**: 系统应支持从当前状态迁移到制度化状态。

**验收标准**:
- **When** 执行阶段A迁移时，**the system shall** 引入 charter/constitution/sovereignty 配置
- **When** 迁移执行时，**the system shall** 将当前代理配置、ACP allowlist、sandbox policy、audit 统一映射到宪章

#### REQ-MIG-002: 阶段B - 资产化

**需求描述**: 系统应支持从制度化状态迁移到资产化状态。

**验收标准**:
- **When** 执行阶段B迁移时，**the system shall** 将 skills/plugins/memory/strategy/algorithms 统一纳入能力资产台账
- **When** 迁移完成时，**the system shall** 由 Librarian 接管编目

#### REQ-MIG-003: 阶段C - 自治开发化

**需求描述**: 系统应支持从资产化状态迁移到自治开发化状态。

**验收标准**:
- **When** 执行阶段C迁移时，**the system shall** 将自动技能开发、自动插件开发、自动QA、自动发布变成正式闭环
- **When** 迁移完成时，**the system shall** 让 Genesis Team 真正存在并运行

#### REQ-MIG-004: 阶段D - 组织自治化

**需求描述**: 系统应支持从自治开发化状态迁移到组织自治化状态。

**验收标准**:
- **When** 执行阶段D迁移时，**the system shall** 引入 Founder/Strategist/Algorithmist
- **When** 迁移完成时，**the system shall** 允许系统自主发起内部演化计划

#### REQ-MIG-005: 阶段E - 沙盒宇宙化

**需求描述**: 系统应支持从组织自治化状态迁移到沙盒宇宙化状态。

**验收标准**:
- **When** 执行阶段E迁移时，**the system shall** 正式建立自治实验环境
- **When** 迁移完成时，**the system shall** 确保所有组织、能力、算法升级先在沙盒中验证

#### REQ-MIG-006: 阶段F - 持续运行化

**需求描述**: 系统应支持从沙盒宇宙化状态迁移到持续运行化状态。

**验收标准**:
- **When** 执行阶段F迁移时，**the system shall** 配置系统长期驻留、长期监测、长期演化状态
- **When** 迁移完成时，**the system shall** 不再依赖单次会话触发

---

## 3. 非功能需求

### 3.1 安全性需求

#### NFR-SEC-001: 审计不可篡改

**需求描述**: 审计流必须不可篡改。

**验收标准**:
- **Where** 审计记录，**the system shall** 确保不可被删除或修改
- **If** 检测到审计篡改尝试，**the system shall** 触发安全事件并冻结相关代理

#### NFR-SEC-002: 最小权限原则

**需求描述**: 所有代理应遵循最小权限原则。

**验收标准**:
- **When** 分配代理权限时，**the system shall** 仅授予完成任务所需的最小权限集

### 3.2 可靠性需求

#### NFR-REL-001: 回滚路径

**需求描述**: 所有变更必须具备回滚路径。

**验收标准**:
- **When** 执行变更时，**the system shall** 先建立回滚路径
- **If** 变更失败，**the system shall** 能够通过回滚路径恢复到变更前状态

#### NFR-REL-002: 故障恢复

**需求描述**: 系统应具备故障自恢复能力。

**验收标准**:
- **When** 检测到子系统故障时，**the system shall** 自动诊断并尝试恢复
- **If** 自动恢复失败，**the system shall** 升级为演化任务

### 3.3 可观测性需求

#### NFR-OBS-001: 全链路追踪

**需求描述**: 所有自治行为必须可追踪。

**验收标准**:
- **Where** 自治行为，**the system shall** 记录完整的执行轨迹
- **When** 查询行为历史时，**the system shall** 能够追溯完整的决策链

---

## 4. 约束条件

### 4.1 技术约束

- 必须基于现有 助手 代码库演进，不重写
- 必须保持与现有 Gateway、ACP、task-registry、flow-registry 的兼容
- 必须使用 TypeScript 作为主要开发语言
- 必须支持 YAML 格式的配置文件

### 4.2 业务约束

- 主权级边界必须由人类保留
- 系统停机必须由人类批准
- 宪章修改必须由人类批准

### 4.3 已存在文件约束

以下文件已存在，需求规格应基于这些文件：
- `governance/charter/constitution.yaml` - 组织宪章
- `governance/charter/policies/sovereignty.yaml` - 主权策略
- `governance/charter/policies/evolution-policy.yaml` - 演化策略
- `governance/charter/agents/*.yaml` - 代理蓝图（12个）
- `governance/charter/evolution/genesis-team.yaml` - Genesis Team 定义
- `governance/sandbox-universe-minimal-design.zh-CN.md` - 沙盒宇宙设计

---

## 5. 术语表

| 术语 | 定义 |
|------|------|
| 强自治 | 系统在非主权级操作上完全自主，仅在主权级边界需要人类介入 |
| 主权级边界 | 宪章修改、根权限提升、高风险网络开闸、系统停机等关键决策 |
| 宪章 | 系统制度的唯一上游，定义代理角色、权限边界、组织层级等 |
| 沙盒宇宙 | 用于安全试错的隔离环境，所有变更必须先在沙盒中验证 |
| Genesis Team | 负责工具与能力演化的代理群：Sentinel、Archaeologist、TDD Developer、QA、Publisher |
| 能力资产 | skills、plugins、memory、strategy_assets、algorithms 等可复用能力 |
| mutation_scope | 代理可变更的范围定义，包含 allow 和 deny 列表 |
| promotion_policy | 试验性成果升级为正式能力的门槛定义 |
| rollback_policy | 升级失败后的自动回滚策略 |

---

## 6. 附录

### 6.1 六大核心层次架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    交互层 (Interaction)                      │
│  Frontend App │ Presence Core │ Multimodal I/O │ Persona    │
├─────────────────────────────────────────────────────────────┤
│                 API与通信层 (API & Communication)            │
│  Gateway Fabric │ ACP Control Plane │ Event Bus │ Audit     │
├─────────────────────────────────────────────────────────────┤
│                    执行层 (Execution)                        │
│  Executor │ Operator Swarm │ Task OS │ Autonomous Scheduler │
├─────────────────────────────────────────────────────────────┤
│                    能力层 (Capability)                       │
│  Skills │ Plugins │ Memory │ Strategy │ Algorithms │ Librarian │
├─────────────────────────────────────────────────────────────┤
│                    进化层 (Evolution)                        │
│  Founder │ Strategist │ Algorithmist │ Genesis Team         │
├─────────────────────────────────────────────────────────────┤
│                    治理层 (Governance)                       │
│  Human Sovereign │ Charter │ Ethical Core │ Sovereignty Auditor │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 三个基础闭环

**价值闭环**: 接收目标 → 分解任务 → 调用能力 → 交付结果 → 记录效果 → 反哺记忆与策略

**维护闭环**: 监测故障 → 诊断根因 → 生成修复方案 → 编写或修改能力 → QA验证 → 入库发布

**进化闭环**: 识别系统级瓶颈 → 发起演化计划 → 在沙盒宇宙中实验 → 通过评审与验证 → 升级正式组织/能力/算法

### 6.3 迁移路径

```
当前状态 → 阶段A(制度化) → 阶段B(资产化) → 阶段C(自治开发化)
         → 阶段D(组织自治化) → 阶段E(沙盒宇宙化) → 阶段F(持续运行化)
```
