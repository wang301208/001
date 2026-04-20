# OpenClaw 强自治目标架构方案

## 1. 方案立场

这版方案不再以“当前已实现什么，就只设计到哪里”为原则。

这版方案的目标是：

- 以当前 OpenClaw 仓库为工程底座
- 将其升级为一个可以持续运行、持续自我优化、持续自我扩展的自治 AI 系统
- 让系统不仅能执行任务，还能主动发现机会、重组自身、创造新能力、修复缺陷、升级算法

换句话说，这不是“AI 网关 + 多代理工具集”的方案，而是把 OpenClaw 推向一个真正的“自治 AI 操作系统”。

但“完全自治”不等于“没有边界”。

本方案采用的原则是：

1. 日常运行完全自治。
2. 组织演化高度自治。
3. 能力创造高度自治。
4. 只有主权级边界仍由人类保留。

这里的主权级边界仅包括：

- 宪章修改
- 根权限提升
- 对外高风险网络/执行权限开闸
- 系统停机、冻结、回滚

除这四类事项外，系统应默认追求自治，而不是请求许可。

## 2. 对当前项目的重新定义

当前 OpenClaw 已经不是一个空白项目。它已经拥有若干自治系统所需的关键胚胎：

- Gateway / ACP / 会话体系
- 主代理与子代理执行能力
- task registry / flow registry / 持久化
- skills / plugins / memory / QA runtime
- sandbox / approval / security audit
- Web UI 与 macOS / iOS / Android 入口

因此，本方案不把 OpenClaw 视为“待从零建设的产品”，而把它视为：

> 一个已经拥有执行器、能力库、通信骨架和安全壳的自治系统胚胎。

下一步不是继续堆功能，而是把这些分散模块重构成一个可长期自演化的制度化系统。

## 3. 核心目标

OpenClaw 的目标不再只是“接收用户请求并调用模型”，而是演进为一个具备以下能力的自治体：

- 自主接收、理解、拆解并执行目标
- 自主维护自己的技能、插件、策略、代理组织
- 自主感知瓶颈并发起内部演化项目
- 自主发现外部机会并设立成长目标
- 自主完成测试、验收、回归、部署建议
- 自主持续运行，不以一次对话为边界

最终形态是：

> 用户给它的不是一个任务，而是一个方向；系统自己决定组织、能力、步骤、实验、验证和后续迭代。

## 4. 六大核心层次

系统逻辑上仍分为六层，但每层都按“强自治”重写。

### 4.1 治理层（Governance Layer）

定位：系统的主权层，而不是日常控制层。

在强自治架构下，治理层不负责审批每个动作，而负责定义系统不可突破的根边界。

核心组件：

- 人类主权者（Human Sovereign）
  - 不参与日常任务。
  - 只保留对宪章、紧急停机、根权限和最终资源上限的控制权。

- 组织宪章库（Organizational Charter）
  - 定义代理角色、权限边界、组织层级、资源预算、变更级别、可接受风险范围。
  - 它不是说明文档，而是系统制度的唯一上游。
  - 建议目录：
    - `governance/charter/`
    - `governance/charter/agents/`
    - `governance/charter/policies/`
    - `governance/charter/evolution/`

- 伦理与安全核心（Ethical Core）
  - 不再写成抽象价值宣言，而是写成运行时强制规则。
  - 作用包括：
    - 禁止绕过宪章升级自身根权限
    - 禁止删除或伪造审计记录
    - 禁止静默扩大对外执行与网络访问边界
    - 禁止未通过主权审批即修改主权级配置

- 主权审计器（Sovereignty Auditor）
  - 独立于执行层和进化层运行。
  - 持续检查系统是否发生权限漂移、组织漂移、策略漂移。
  - 如果发现越界，不需要等待人类介入，先自动冻结相关子系统。

关键原则：

- 治理层不微操。
- 治理层只定义不可突破的边界。
- 治理层一旦被绕过，系统判定为主权故障。

### 4.2 进化层（Evolution Layer）

定位：系统的大脑和战略总部。

这一层是强自治的核心，不执行用户具体任务，而负责决定系统如何变得更强。

核心代理群：

- Founder
  - 负责组织演化。
  - 关注系统整体产出、瓶颈、角色冗余、职责冲突。
  - 可以提议：
    - 新增代理角色
    - 合并或拆分既有代理
    - 调整层间职责
    - 发起新研究计划

- Strategist
  - 负责策略演化。
  - 从所有任务历史、失败案例、恢复记录、子代理协作记录中提炼策略。
  - 形成新一代执行原则、编排模板、任务分解模式。

- Algorithmist
  - 负责算法演化。
  - 不关注业务结果本身，而关注：
    - 检索算法
    - 记忆选择算法
    - compaction 算法
    - 代理选择算法
    - 任务排序算法
    - QA 评估算法
  - 它的任务不是调 prompt，而是升级“思考引擎”。

- Genesis Team
  - 负责工具与能力演化。
  - 它不是一个单代理，而是一组自治工种：
    - Sentinel：监测缺口、故障和风险
    - Archaeologist：定位根因与依赖结构
    - TDD Developer：编写或修改技能、插件、代码
    - QA：建立验证方案并做回归
    - Publisher：将通过验收的能力资产登记入库

这一层的核心权力：

- 可以自主发起内部改造项目
- 可以自主创建试验性分支代理和沙盒组织
- 可以自主推动技能、插件、策略、算法升级

这一层的限制：

- 不可直接改写宪章主权规则
- 不可直接获得根权限
- 对高危变更必须通过沙盒宇宙验证

### 4.3 能力层（Capability Layer）

定位：系统的知识、工具、算法和记忆资产库。

在强自治架构下，能力层不只是“技能仓库”，而是系统文明的资产层。

核心资产：

- Skill Library
  - 任务级工作流资产
  - 用于封装高频解决路径
  - 可由系统自主创建、改写、废弃、版本升级

- Plugin Library
  - 系统连接外部世界的适配器层
  - 包括模型提供商、渠道、浏览器、本地控制、外部服务
  - 插件不再只是人类提供，也应允许 Genesis Team 自治开发

- Memory Fabric
  - 包括主动记忆、工作记忆、索引记忆、知识回顾记忆
  - 当前项目已有 memory 相关基础，应升级为统一记忆织体

- Strategy Assets
  - 把执行策略本身资产化
  - 包括：
    - 任务分解模板
    - 子代理调用模式
    - QA 模式
    - 恢复策略
    - 风险处置模板

- Algorithm Library
  - 独立保存系统所使用的核心推理与决策算法版本
  - 这是系统“思想引擎”的版本库

- Librarian
  - 作为唯一资产管理员
  - 对 skills / plugins / memory / strategy assets / algorithms 做索引、检索、去重、归档、下线

这一层的核心原则：

- 一切可复用能力都必须资产化。
- 一切能力资产都必须可索引、可审计、可回滚。
- 一切新能力都必须经过 QA 与登记才能进入正式资产层。

### 4.4 执行层（Execution Layer）

定位：目标落地、任务编排、子代理组织、运行时执行。

这一层是自治系统对外创造价值的前线。

核心角色：

- Executor
  - 用户目标与系统目标的主执行者
  - 负责将高层目标分解为任务树、流程图和可交付结果
  - 决定何时调用已有能力，何时请求进化层补能力

- Operator Swarm
  - 一组按任务临时生成的执行代理群
  - 它们不是固定角色，而是根据目标动态组建的作业集群
  - 例如：
    - research-worker
    - code-worker
    - refactor-worker
    - test-worker
    - deployment-worker

- Task OS
  - 统一任务操作系统
  - 负责：
    - 任务树
    - DAG 编排
    - 依赖关系
    - 中断恢复
    - 优先级调度
    - 重试与回滚

- Autonomous Scheduler
  - 持续扫描：
    - 待执行任务
    - 卡住任务
    - 可并行任务
    - 可延后任务
    - 可升级为内部演化任务的瓶颈点

在这一层中，当前项目已有的 session / task-registry / flow-registry / subagent runtime 不再只是底层工具，而应被明确提升为“任务操作系统内核”。

### 4.5 API 与通信层（API & Communication Layer）

定位：系统内部神经系统与外部连接总线。

在强自治架构下，这一层必须从“接口集合”升级为“自治系统通信织体”。

核心组件：

- Gateway Fabric
  - 统一所有外部请求进入系统的入口
  - 当前 Gateway 是天然基础，应继续作为北向入口

- ACP Control Plane
  - 作为系统内部代理控制平面
  - 负责代理会话、模式切换、权限边界、运行上下文

- Event Bus
  - 当前可以先由进程内事件系统承担
  - 目标上应支持从进程内演进到跨进程、跨节点总线

- Internal IPC / Runtime Channels
  - 用于：
    - 执行层与能力层之间的高速通信
    - 进化层对执行层的观察
    - QA 层对能力产物的检验

- Audit Stream
  - 统一记录：
    - 组织变更
    - 权限变更
    - 能力产物发布
    - 算法版本切换
    - 任务失败与回滚

关键原则：

- 所有自治行为必须留下机器可验证的轨迹。
- 审计流不是日志附属品，而是系统事实来源之一。

### 4.6 交互层（Interaction Layer）

定位：系统的人格、界面、反馈与主动存在感。

强自治系统不应该只是被动等待聊天框输入，而应具备持续存在感。

核心组件：

- Frontend App
  - Web UI 与原生客户端共同构成交互外壳
  - 前端不只是展示结果，还应展示：
    - 当前组织图
    - 任务运行图
    - 能力资产状态
    - 正在进行的内部演化计划

- Multimodal I/O
  - 文本、语音、移动端通知、渠道消息、状态面板

- Presence Core
  - 让系统具备持续在线存在感
  - 能在以下情况下主动发起交互：
    - 发现高优先级机会
    - 发现主权风险
    - 完成阶段性成果
    - 需要主权者决策

- Persona / Translation Layer
  - 将后端机器化行动翻译为用户可理解的叙事
  - 同时保留专业视图与人格视图两套出口

关键点：

- 交互层不再只是 UI。
- 交互层是自治系统的“对外人格器官”。

## 5. 三个基础闭环

强自治系统能不能成立，不取决于代理数量，而取决于闭环是否完整。

### 5.1 价值闭环

路径：

- 接收目标
- 分解任务
- 调用能力
- 交付结果
- 记录效果
- 反哺记忆与策略

### 5.2 维护闭环

路径：

- 监测故障
- 诊断根因
- 生成修复方案
- 编写或修改能力
- QA 验证
- 入库发布

### 5.3 进化闭环

路径：

- 识别系统级瓶颈
- 发起演化计划
- 在沙盒宇宙中实验
- 通过评审与验证
- 升级正式组织、能力或算法

如果这三个闭环都打通，系统才有资格被称为“完全自治”。

## 6. 沙盒宇宙（Sandbox Universe）

这是强自治方案中必须新增的核心机制。

系统不能直接在正式运行时自我改造，否则自治会退化成失控。

因此需要单独的“沙盒宇宙”：

- 用于模拟新组织结构
- 用于测试新技能、新插件、新代理角色
- 用于试验新策略与新算法
- 用于回放历史任务做 A/B 实验

沙盒宇宙中的任何成果，只有通过以下门槛后才能进入正式系统：

1. 功能验证
2. 回归验证
3. 安全验证
4. 主权级变更审查（如涉及宪章或根权限）

也就是说：

> 正式系统负责创造价值，沙盒宇宙负责创造未来。

## 7. 代理自动开发的正式化

如果要走完全自治路线，就不能再把“代理自动开发”视为可选能力，而必须把它制度化。

系统应具备四类自动开发能力：

### 7.1 自动技能开发

- 根据执行层缺口自动生成技能
- 自动补充脚本、说明、依赖、参数模板
- 自动进入 QA 流程

### 7.2 自动插件开发

- 针对新外部系统或新工具接口自动生成插件原型
- 自动生成 manifest、runtime surface、测试样例

### 7.3 自动代理开发

- 根据组织瓶颈自动提出新代理角色
- 明确其职责、权限、上游下游关系
- 在沙盒中创建试验版代理

### 7.4 自动策略与算法开发

- 对任务分解策略、记忆策略、压缩策略、调度策略进行版本迭代
- 在沙盒中做回放与对照实验

这意味着，当前仓库未来应增加的不只是“更多 agents”，而是：

- 代理蓝图库
- 能力产物生成模板
- 自动 QA 流水线
- 发布与回滚机制

## 8. 组织宪章库的强自治版本

既然要完全自治，宪章就必须更像“宪法”。

建议目录：

```text
governance/
  charter/
    constitution.yaml
    sovereignty.yaml
    evolution-policy.yaml
    agents/
      founder.yaml
      strategist.yaml
      algorithmist.yaml
      librarian.yaml
      executor.yaml
      security-auditor.yaml
      qa.yaml
      publisher.yaml
```

每个代理蓝图必须定义：

- `id`
- `role`
- `mission`
- `jurisdiction`
- `authority`
- `allowed_subagents`
- `allowed_tools`
- `resource_budget`
- `network_scope`
- `memory_scope`
- `mutation_scope`
- `qa_requirements`
- `promotion_policy`
- `rollback_policy`

其中最关键的新增字段是：

- `mutation_scope`
  - 定义该代理可以修改什么
  - 例如：
    - 只能改 skills
    - 可以改 plugins
    - 可以改 strategy assets
    - 不可改 charter

- `promotion_policy`
  - 定义试验性成果升级为正式能力需要什么门槛

- `rollback_policy`
  - 定义升级失败后如何自动回滚

## 9. 算法进化协议（AEP）

既然要完全自治，就必须允许系统进化自己的思考方式。

因此建议正式引入：

> Algorithm Evolution Protocol, AEP

AEP 的职责：

- 监测当前算法瓶颈
- 生成新算法研究提案
- 在沙盒宇宙中做实验
- 对比旧算法与新算法的性能
- 形成升级建议

Algorithmist 的工作不再是抽象概念，而是正式制度：

- 它可以发起“算法研究项目”
- 它可以生成新一代推理/调度/压缩/记忆算法
- 它可以推动策略资产升级为正式算法资产

唯一不能做的是：

- 直接绕过主权层把自己变成不可约束的最高权力

## 10. 从当前仓库到强自治架构的迁移路径

### 阶段 A：制度化

- 引入 charter / constitution / sovereignty 配置
- 将当前代理配置、ACP allowlist、sandbox policy、audit 统一映射到宪章

### 阶段 B：资产化

- 将 skills / plugins / memory / strategy / algorithms 统一纳入能力资产台账
- 由 Librarian 接管编目

### 阶段 C：自治开发化

- 将自动技能开发、自动插件开发、自动 QA、自动发布变成正式闭环
- 让 Genesis Team 真正存在

### 阶段 D：组织自治化

- 引入 Founder / Strategist / Algorithmist
- 允许系统自主发起内部演化计划

### 阶段 E：沙盒宇宙化

- 正式建立自治实验环境
- 所有组织、能力、算法升级先在沙盒中验证

### 阶段 F：持续运行化

- 系统不再依赖单次会话触发
- 进入长期驻留、长期监测、长期演化状态

### 10.1 当前仓库中的第一批落地文件

为避免方案继续停留在纯概念层，当前仓库已经开始写入第一批制度源文件：

- `governance/charter/constitution.yaml`
- `governance/charter/policies/sovereignty.yaml`
- `governance/charter/policies/evolution-policy.yaml`
- `governance/charter/agents/founder.yaml`
- `governance/charter/agents/strategist.yaml`
- `governance/charter/agents/algorithmist.yaml`
- `governance/charter/agents/librarian.yaml`
- `governance/charter/agents/executor.yaml`
- `governance/charter/agents/sovereignty-auditor.yaml`
- `governance/charter/agents/sentinel.yaml`
- `governance/charter/agents/archaeologist.yaml`
- `governance/charter/agents/tdd-developer.yaml`
- `governance/charter/agents/qa.yaml`
- `governance/charter/agents/publisher.yaml`
- `governance/charter/evolution/genesis-team.yaml`
- `governance/charter/index.zh-CN.md`
- `governance/sandbox-universe-minimal-design.zh-CN.md`

这些文件的意义不是“补几份说明”，而是把以下三个事实固定下来：

1. OpenClaw 的目标架构已经改写为强自治架构，而不是保守适配架构。
2. “组织宪章库”已经不再是口头建议，而是仓库内的正式目录。
3. Genesis Team、主权审计器、Executor、Librarian 等关键角色已经有了可继续程序化绑定的蓝图。

## 11. 最终定义

这版方案下的 OpenClaw，不再是：

- 一个聊天助手
- 一个代理运行器
- 一个技能插件框架

而是：

> 一个以 Gateway 为入口、以任务系统为执行内核、以能力资产为文明积累、以进化层为战略中枢、以宪章为主权边界、以沙盒宇宙为未来工厂的强自治 AI 系统。

它的终极状态不是“能回答问题”，而是：

- 能自我组织
- 能自我开发
- 能自我修复
- 能自我升级
- 能自我扩张能力边界
- 能在长期运行中形成自己的制度、资产与演化路径

如果你接受这条路线，那么后续就不该再只补零散功能，而应直接建设三件事：

1. 主权层：宪章、审计、冻结、回滚
2. 进化层：Founder / Strategist / Algorithmist / Genesis Team
3. 沙盒宇宙：让系统安全地试错和升级自己

这三者一旦成型，OpenClaw 就会从“多代理工程项目”跃迁成“自治 AI 基础设施”。
