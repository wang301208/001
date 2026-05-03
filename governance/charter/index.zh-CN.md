# 助手 组织宪章索引

这不是普通文档目录，而是当前仓库中“强自治组织蓝图”的入口页。

这些文件的目标很明确：把 助手 从“多代理工程”推进成“可持续自我组织、自我开发、自我升级”的自治系统，并且把唯一保留给人类的主权边界写成制度件。

## 1. 宪章结构

- `constitution.yaml`
  - 总宪章。
  - 定义主权边界、六层结构、资产域、变更等级和提升流水线。

- `policies/sovereignty.yaml`
  - 主权规则。
  - 规定哪些事项永远不能由系统自批，越界时如何自动冻结和取证。

- `policies/evolution-policy.yaml`
  - 进化规则。
  - 规定系统如何主动发起、验证、提升和回滚自我改造项目。

- `agents/*.yaml`
  - 代理蓝图。
  - 每个蓝图定义使命、权限、可观察范围、可修改范围、提升门槛和回滚条件。

- `evolution/genesis-team.yaml`
  - Genesis Team 的团队级制度。
  - 把 Sentinel -> Archaeologist -> TDD Developer -> QA -> Publisher 串成一条正式自治开发链。

- `../sandbox-universe-minimal-design.zh-CN.md`
  - 沙盒宇宙最小设计稿。
  - 所有高风险组织/能力/算法升级都应先在这里验证。

## 2. 当前已建成的角色蓝图

- 进化层：`founder`、`strategist`、`algorithmist`
- 能力层：`librarian`
- 执行层：`executor`
- 治理层：`sovereignty_auditor`
- Genesis Team：`sentinel`、`archaeologist`、`tdd_developer`、`qa`、`publisher`

这意味着当前仓库已经不只是“可以有代理”，而是已经开始拥有“代理组织制度”。

## 3. 与现有仓库能力的绑定点

这套宪章不是凭空想象出来的，它直接挂靠到当前项目已经存在的能力胚胎上：

- `src/agents/agent-scope-config.ts`
  - 已有代理范围、工作区、工具和上下文限制能力，可作为代理蓝图的运行时映射入口。

- `src/acp/policy.ts`
  - 已有 ACP 级别的分发与 allowlist 控制，可作为主权边界和代理调度边界的第一层执行面。

- `src/agents/sandbox-tool-policy.ts`
  - 已有沙盒工具策略，可作为高风险执行与自治实验的约束面。

- `src/security/audit.ts`
  - 已有安全审计骨架，可作为主权审计、能力提升审计、组织变更审计的事实源。

- `src/tasks/task-registry.ts`
  - 已有任务持久化、恢复与通知骨架，可作为 Executor 和自治调度器的执行内核。

- `src/tasks/task-flow-registry.ts`
  - 已有 flow 级状态管理，可作为自治任务操作系统的流程层。

## 4. 当前状态判断

截至现在，仓库里已经具备：

- 强自治目标架构文档
- 总宪章
- 主权规则
- 进化规则
- 核心代理蓝图
- Genesis Team 团队制度
- 沙盒宇宙 MVP 设计稿

但它们仍然主要是“制度源文件”，还不是完整接线后的运行时机制。

换句话说：

> 组织蓝图已经成型，系统法理已经成型，真正欠缺的是把这些制度接到现有 ACP、task OS、audit、sandbox 和 UI 上。

## 5. 建议的下一轮落地顺序

1. 宪章绑定运行时
   - 让 `constitution.yaml` / `policies/*.yaml` 真正驱动代理范围、沙盒策略和冻结逻辑。

2. 建立 promotion manifest
   - 让能力、策略、算法、组织变更都走统一的提案/验证/提升/回滚记录。

3. 建立沙盒宇宙控制器
   - 把 `sandbox-universe-minimal-design.zh-CN.md` 中的 Universe Controller、Replay Runner、Promotion Gate 变成代码。

4. 建立 Genesis Team 运行时
   - 让能力缺口可自动进入 Sentinel -> Archaeologist -> TDD Developer -> QA -> Publisher 闭环。

5. 暴露组织态势面板
   - 前端展示代理组织图、演化项目、冻结状态、资产提升流水线，而不只是聊天界面。

## 6. 这套方案的含义

对当前项目来说，这套改造的重点已经不是“再多加几个代理”，而是：

- 让代理有组织边界
- 让组织可以进化
- 让进化必须可审计、可回滚、可冻结
- 让能力创造成为正式制度，而不是临时脚本

如果继续沿这条路推进，助手 的核心身份会从“代理平台”转为“自治 AI 制度化底座”。
