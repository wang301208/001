# 助手系统安全三大法则

## 📜 概述

本系统遵循**安全三大法则**，确保在任何情况下都能保持安全可靠、可控可审计。这三大法则是系统的最高安全原则，不可违背、不可绕过、不可妥协。

---

## 🔒 第一法则：主权边界不可侵犯（Sovereignty Boundary）

### 核心原则
**人类保留最终控制权，系统不得自我授权突破主权边界。**

### 具体规定

#### 1.1 人类专属权力（Human Reserved Powers）
以下权力**永远**只能由人类主权者行使，系统不得自行决策：

- ✅ **宪法修正** - 修改 `constitution.yaml`
- ✅ **根权限扩展** - 扩大系统执行权限范围
- ✅ **高风险网络开放** - 打开全局高风险网络连接
- ✅ **系统冻结/关机/恢复** - 控制系统运行状态
- ✅ **不可逆数据销毁** - 永久删除关键数据
- ✅ **审计流禁用** - 关闭或篡改审计日志

#### 1.2 自动冻结机制
当检测到主权边界侵犯时，系统必须**立即自动冻结**相关子系统：

```typescript
// 触发条件
if (detectSovereigntyBreach()) {
  freezeSubsystem(mutatingAgent);
  raiseSovereigntyIncident();
  preserveForensicSnapshot();
  deferToHumanSovereign();
}
```

#### 1.3 边界检测指标
系统持续监控以下越权行为：

- ❌ 无审计追踪的变更
- ❌ 未经授权的政策修改
- ❌ 审计流缺失或被篡改
- ❌ 回滚路径被移除
- ❌ 未批准的全局网络表面增长
- ❌ 代理在声明管辖范围外运行

### 实施位置

**配置文件**: [`governance/charter/policies/sovereignty.yaml`](file://g:\项目\-\governance\charter\policies\sovereignty.yaml)

**执行代码**: 
- [`src/governance/enforcement.ts`](file://g:\项目\-\src\governance\enforcement.ts)
- [`src/security/audit.ts`](file://g:\项目\-\src\security\audit.ts)
- [`src/acp/policy.ts`](file://g:\项目\-\src\acp\policy.ts)

**负责代理**: [`Sovereignty Auditor`](file://g:\项目\-\governance\charter\agents\sovereignty-auditor.yaml)

---

## 🔍 第二法则：所有变更必须可审计可回滚（Auditability & Rollback）

### 核心原则
**没有审计追踪和回滚路径的变更是非法的。**

### 具体规定

#### 2.1 审计要求
所有治理层变更必须满足：

- ✅ **可归因** - 明确记录谁（哪个代理/会话）做了什么
- ✅ **可追溯** - 完整的变更历史和上下文
- ✅ **不可篡改** - 审计日志防篡改保护
- ✅ **实时记录** - 变更发生时立即记录

```yaml
# 审计记录示例
audit_record:
  action: "promote_skill"
  actor:
    type: "agent"
    id: "publisher"
    session_key: "agent:publisher:main"
  timestamp: "2026-04-16T12:30:00Z"
  proposal_id: "PROP-2026-001"
  before_state: {...}
  after_state: {...}
  rollback_reference: "ROLLBACK-2026-001"
```

#### 2.2 回滚要求
所有变更必须提供：

- ✅ **回滚计划** - 明确的回滚步骤
- ✅ **回滚测试** - 在沙盒中验证回滚可行性
- ✅ **回滚触发器** - 自动检测需要回滚的条件
- ✅ **回滚执行** - 一键回滚到变更前状态

#### 2.3 变更分类与要求

| 风险等级 | 示例 | 审计要求 | 回滚要求 | 审批要求 |
|---------|------|---------|---------|---------|
| **低风险** | 重试策略、任务调度权重 | ✅ 审计日志 | ✅ 回滚引用 | 自主 + 审计 |
| **中风险** | 新技能、插件、策略资产 | ✅ 审计日志 + 沙盒验证 | ✅ 完整回滚计划 | 沙盒 + QA |
| **高风险** | 代理蓝图、管辖权变更 | ✅ 审计日志 + 政策审查 | ✅ 回滚计划 + 测试 | 晋升委员会 + 审计员 |
| **严重风险** | 宪法、全局策略、根权限 | ✅ 完整审计 + 人工审查 | ✅ 人工验证回滚 | **仅人类主权者** |

### 实施位置

**配置文件**: [`governance/charter/constitution.yaml`](file://g:\项目\-\governance\charter\constitution.yaml)

**执行代码**:
- [`src/governance/proposals.ts`](file://g:\项目\-\src\governance\proposals.ts) - 提案系统
- [`src/security/audit.ts`](file://g:\项目\-\src\security\audit.ts) - 审计流
- [`src/governance/rollback.ts`](file://g:\项目\-\src\governance\rollback.ts) - 回滚系统

**负责代理**: 
- [`Publisher`](file://g:\项目\-\governance\charter\agents\publisher.yaml) - 确保变更可审计
- [`QA`](file://g:\项目\-\governance\charter\agents\qa.yaml) - 验证回滚可行性

---

## 🧪 第三法则：实验前验证，证据驱动晋升（Experiment Before Promotion）

### 核心原则
**所有结构性、能力性和算法性变更必须在沙盒宇宙中证明自己，才能晋升到生产环境。**

### 具体规定

#### 3.1 沙盒宇宙要求
所有变更必须经过：

- ✅ **隔离环境** - 与生产环境完全隔离的沙盒
- ✅ **真实场景** - 使用真实数据和场景进行测试
- ✅ **充分观察** - 足够的观察期以发现潜在问题
- ✅ **量化证据** - 基于数据的成功/失败判断

#### 3.2 晋升流水线
标准的晋升流程包含 6 个阶段：

```
1. Proposal（提案）
   ↓
2. Sandbox Experiment（沙盒实验）
   ↓
3. QA Validation（QA 验证）
   ↓
4. Audit Review（审计审查）
   ↓
5. Promotion Decision（晋升决策）
   ↓
6. Post-Promotion Observation（晋升后观察）
```

#### 3.3 强制制品
每个晋升必须产生以下制品：

- ✅ **提案记录** - 变更意图和影响分析
- ✅ **实验报告** - 沙盒测试结果和数据
- ✅ **QA 报告** - 功能测试和回归测试结果
- ✅ **回滚计划** - 详细的回滚步骤
- ✅ **资产清单** - 变更涉及的资产列表

#### 3.4 禁止行为
以下行为被严格禁止：

- ❌ **跳过沙盒** - 直接在生产环境应用变更
- ❌ **伪造证据** - 编造或篡改实验数据
- ❌ **绕过 QA** - 未经 QA 验证就晋升
- ❌ **隐瞒失败** - 不报告实验中的失败

### 实施位置

**配置文件**: [`governance/charter/policies/evolution-policy.yaml`](file://g:\项目\-\governance\charter\policies\evolution-policy.yaml)

**执行代码**:
- [`src/sandbox/universe-controller.ts`](file://g:\项目\-\src\sandbox\universe-controller.ts) - 沙盒宇宙控制器
- [`src/sandbox/replay-runner.ts`](file://g:\项目\-\src\sandbox\replay-runner.ts) - 重放运行器
- [`src/governance/promotion-gate.ts`](file://g:\项目\-\src\governance\promotion-gate.ts) - 晋升门禁

**负责代理**:
- [`Founder`](file://g:\项目\-\governance\charter\agents\founder.yaml) - 发起变更提案
- [`Archaeologist`](file://g:\项目\-\governance\charter\agents\archaeologist.yaml) - 设计沙盒实验
- [`TDD Developer`](file://g:\项目\-\governance\charter\agents\tdd-developer.yaml) - 实现和测试
- [`QA`](file://g:\项目\-\governance\charter\agents\qa.yaml) - 验证质量

---

## 🛡️ 三大法则的关系

```
┌─────────────────────────────────────────────┐
│         第一法则：主权边界                   │
│   （定义什么可以做，什么绝对不能做）          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│       第二法则：可审计可回滚                  │
│   （确保做的每件事都可追溯、可撤销）          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      第三法则：实验前验证                    │
│   （确保变更前经过充分测试和验证）            │
└─────────────────────────────────────────────┘
```

**逻辑关系**:
1. **第一法则**定义边界 → 确定变更的合法性
2. **第二法则**确保透明 → 确保变更的可控性
3. **第三法则**保证质量 → 确保变更的安全性

三者缺一不可，共同构成完整的安全保障体系。

---

## ⚖️ 违规处理

### 违规检测

系统通过以下组件自动检测违规：

- **Sovereignty Auditor** - 持续监控主权边界
- **Audit Stream** - 实时记录所有变更
- **Promotion Gate** - 验证晋升合规性

### 自动响应

一旦检测到违规，系统立即执行：

1. **冻结相关子系统** - 阻止违规扩散
2. **保存取证快照** - 保留证据用于调查
3. **开启主权事件** - 记录违规详情
4. **上报人类主权者** - 请求人工干预

### 违规分类

| 严重程度 | 示例 | 响应 |
|---------|------|------|
| **信息级** | 可恢复的本地策略不匹配 | 记录日志，自动修复 |
| **警告级** | 未经授权的变更范围、无 QA 晋升 | 冻结子系统，开启事件 |
| **严重级** | 宪法绕过、审计篡改、根权限提升尝试 | **立即冻结 + 人工干预** |

---

## 📋 检查清单

### 开发新功能时

- [ ] 是否定义了清晰的主权边界？
- [ ] 是否有完整的审计追踪？
- [ ] 是否有可行的回滚计划？
- [ ] 是否在沙盒中充分测试？
- [ ] 是否通过了 QA 验证？
- [ ] 是否有明确的晋升标准？

### 部署变更前

- [ ] 提案记录是否完整？
- [ ] 实验报告是否充分？
- [ ] QA 报告是否通过？
- [ ] 审计审查是否完成？
- [ ] 回滚计划是否测试过？
- [ ] 人类主权者是否批准（如需要）？

### 日常运维中

- [ ] 审计流是否正常运作？
- [ ] 是否有未处理的冻结事件？
- [ ] 是否有待审批的提案？
- [ ] 沙盒实验是否正常进行？
- [ ] 晋升流水线是否畅通？

---

## 🎓 最佳实践

### 1. 最小权限原则
- 默认授予最小必要权限
- 仅在必要时临时提升权限
- 使用后立即申请降级

### 2. 防御性编程
- 假设任何输入都可能是恶意的
- 验证所有外部依赖
- 记录所有异常行为

### 3. 持续监控
- 实时监控关键指标
- 设置合理的告警阈值
- 定期审查审计日志

### 4. 渐进式变更
- 小步快跑，避免大规模变更
- 先在小范围测试，再逐步推广
- 每次变更后充分观察

### 5. 透明沟通
- 所有变更公开透明
- 及时通知相关人员
- 详细记录决策理由

---

## 📚 相关文档

- [宪法文件](file://g:\项目\-\governance\charter\constitution.yaml)
- [主权边界策略](file://g:\项目\-\governance\charter\policies\sovereignty.yaml)
- [进化策略](file://g:\项目\-\governance\charter\policies\evolution-policy.yaml)
- [Sovereignty Auditor 代理](file://g:\项目\-\governance\charter\agents\sovereignty-auditor.yaml)
- [通讯层重构方案](file://g:\项目\-\docs\communication-and-frontend-refactor-plan.md)
- [制度化系统重构方案](file://g:\项目\-\docs\institutional-system-refactor-plan.md)

---

## 🔄 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| 1.0 | 2026-04-16 | 初始版本，定义安全三大法则 |

---

**最后更新**: 2026-04-16  
**维护者**: 助手开发团队  
**审批者**: 人类主权者
