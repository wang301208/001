# 沙盒宇宙最小运行机制设计稿

## 1. 目标

沙盒宇宙不是测试环境的别名。

它的职责是让 OpenClaw 可以在不污染正式系统的前提下，安全地进行以下行为：

- 组织结构试验
- 技能与插件试验
- 执行策略试验
- 算法版本试验
- 代理角色试验

一句话定义：

> 正式系统负责持续创造价值，沙盒宇宙负责持续制造未来。

## 2. 设计原则

1. 与正式系统逻辑同构，但资源隔离。
2. 默认允许高变更密度实验，但禁止越过主权边界。
3. 所有实验必须可回放、可比较、可废弃。
4. 未通过提升门槛的实验不得进入正式系统。

## 3. MVP 范围

第一阶段不追求“完整第二宇宙”，而追求足够支撑组织、能力、策略、算法试验的最小闭环。

MVP 仅包含六个部件：

### 3.1 Universe Controller

职责：

- 创建沙盒实验
- 为实验分配唯一 universe_id
- 挂接实验预算、输入、目标、终止条件
- 维护实验状态机

建议状态：

- `proposed`
- `provisioning`
- `running`
- `observing`
- `completed`
- `rejected`
- `promoted`
- `rolled_back`

### 3.2 Snapshot Builder

职责：

- 从正式系统提取可实验的最小快照
- 快照对象包括：
  - agent blueprints
  - strategy assets
  - algorithm versions
  - selected skills/plugins
  - historical replay datasets

要求：

- 快照必须带版本指纹
- 快照必须可追溯到正式系统源版本

### 3.3 Experiment Workspace

职责：

- 为每个 universe 提供独立工作区
- 容纳试验性代理蓝图、技能、插件、策略与算法

最小目录建议：

```text
sandbox-universe/
  universes/
    <universe-id>/
      manifest.json
      charter/
      agents/
      skills/
      plugins/
      strategy-assets/
      algorithms/
      replay-data/
      reports/
```

### 3.4 Replay Runner

职责：

- 使用历史任务、历史失败案例、历史恢复案例做重放
- 对比“正式版本”与“候选版本”的表现差异

最小比较指标：

- 成功率
- 平均完成时长
- 平均 token 消耗
- 子代理调用次数
- compaction 触发频率
- QA 通过率
- 错误恢复能力

### 3.5 Promotion Gate

职责：

- 对实验产物做多门槛检查

最小门槛：

1. 功能有效
2. 不低于现网基线
3. 具备 QA 验证
4. 具备审计记录
5. 具备回滚方案

只有通过全部门槛的实验，才能生成 promotion candidate。

### 3.6 Rollback Engine

职责：

- 如果提升后出现回归，自动恢复到上一稳定资产版本
- 保留事故现场与对照数据

最小回滚对象：

- 技能版本
- 插件版本
- 策略资产版本
- 算法版本
- 代理蓝图版本

## 4. 三类实验

MVP 先支持三类，不一次做全。

### 4.1 能力实验

场景：

- 新 skill
- skill 升级
- plugin 原型

流程：

- 由 Genesis Team 或相关自治代理发起
- 在沙盒里安装/生成能力产物
- 运行 QA 和任务重放
- 输出 capability promotion report

### 4.2 策略实验

场景：

- 新任务分解模板
- 新子代理协作模式
- 新恢复策略

流程：

- 由 Strategist 发起
- 使用历史任务回放对照
- 输出 strategy comparison report

### 4.3 算法实验

场景：

- 新 compaction 算法
- 新记忆选择算法
- 新调度算法

流程：

- 由 Algorithmist 发起
- 在相同输入集上做 A/B 试验
- 输出 algorithm benchmark report

## 5. 与当前 OpenClaw 的接入映射

沙盒宇宙不需要等所有子系统重写完才开始建设。

最小接入可以基于现有项目能力做：

- 会话与执行：
  - 使用现有 session / subagent 执行体系作为实验运行内核

- 任务与流程：
  - 使用 task registry / flow registry 记录实验任务与状态

- 能力资产：
  - 使用现有 skills / extensions / plugin-sdk 作为试验材料

- QA：
  - 使用 qa runtime 作为最小验收机制

- 审计：
  - 将实验 proposal、实验结果、promotion、rollback 写入统一审计流

## 6. 实验清单对象

建议每个实验都以 manifest 驱动。

最小字段：

```json
{
  "universeId": "univ_20260420_001",
  "type": "algorithm",
  "owner": "algorithmist",
  "title": "Compaction policy v2 trial",
  "baseline": {
    "strategyAssetVersion": "compaction-policy@1.3.0"
  },
  "candidate": {
    "strategyAssetVersion": "compaction-policy@2.0.0-alpha"
  },
  "replayDataset": "flows/compaction-hotspots-2026-04",
  "budget": {
    "maxTokens": 2000000,
    "maxRuns": 500
  },
  "promotionGate": {
    "requiresQaPass": true,
    "requiresRollbackPlan": true
  }
}
```

## 7. 提升机制

实验产物进入正式系统的流程应当固定化：

1. 生成 proposal
2. 创建 sandbox universe
3. 构建快照
4. 执行 replay / QA / benchmark
5. 生成报告
6. 进入 promotion gate
7. 提升到正式资产库
8. 进入观察期

如果是高风险变更，再追加：

9. 主权级审查

## 8. 最小角色分工

为避免一开始组织过重，沙盒宇宙的 MVP 只要求以下角色：

- `Founder`
  - 负责组织实验批准与资源分配

- `Strategist`
  - 负责策略实验

- `Algorithmist`
  - 负责算法实验

- `Genesis Team`
  - 负责能力产物构造与修复

- `QA`
  - 负责最小验收

- `Sovereignty Auditor`
  - 负责防止试验结果越权进入正式系统

## 9. 第一阶段不做什么

为了尽快起步，MVP 明确不做：

- 多节点分布式宇宙调度
- 全量生产流量镜像
- 自动主权级批准
- 完整图形化宇宙控制台
- 任意代码无限制自修改

## 10. 验收标准

如果满足以下条件，就说明“沙盒宇宙最小机制”成立：

1. 能从正式系统提取一份可复现实验快照。
2. 能在隔离工作区内运行试验性代理/策略/算法。
3. 能对候选版本与基线做回放对照。
4. 能输出 promotion report 与 rollback plan。
5. 能阻止未过门槛的试验性成果进入正式系统。

## 11. 最终判断

没有沙盒宇宙，完全自治必然退化为高风险自修改。

有了沙盒宇宙，OpenClaw 才真正具备以下条件：

- 在不失控的前提下持续自我试错
- 在不破坏正式系统的前提下持续自我升级
- 在有证据而不是有冲动的前提下推动组织和算法演化

因此，沙盒宇宙不是锦上添花，而是强自治架构的必需品。
