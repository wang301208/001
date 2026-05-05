# 提案超时自动审核系统

## 📖 概述

提案超时自动审核系统实现了**30秒超时自动通过**机制，提高系统的自主性和响应速度。

### 核心功能

- ✅ **超时检测** - 自动检测等待超过30秒的提案
- ✅ **自动通过** - 对符合条件的低风险提案自动批准
- ✅ **风险控制** - 仅对"safe"级别提案自动通过
- ✅ **审计追踪** - 所有自动操作都有完整审计记录
- ✅ **定时检查** - 支持周期性自动检查（默认60秒间隔）

---

## 🚀 快速开始

### CLI命令

#### 1. 手动检查超时提案

```bash
# 使用默认配置（30秒超时）
zhushou proposal-timeout check

# 自定义超时时间（例如60秒）
zhushou proposal-timeout check --timeout 60000

# 指定适用的风险级别
zhushou proposal-timeout check --risk-levels safe elevated
```

输出示例：
```
⏰ 开始检查超时提案

🔍 开始检查超时提案 (超时阈值: 30秒)
📋 找到 5 个待审核提案
⏰ 提案超时，自动通过: PROP-2026-001 (升级数据库配置)
   - 等待时长: 45.2秒
   - 风险级别: safe
✅ 已自动通过提案: PROP-2026-001

✅ 超时审核完成:
   - 总检查: 5
   - 超时: 1
   - 自动通过: 1
   - 跳过: 4
   - 失败: 0

📊 检查结果汇总:

总检查提案数: 5
超时提案数: 1
自动通过数: 1
跳过数: 4
失败数: 0

📋 详细结果:

1. PROP-2026-001: 升级数据库配置
   状态: pending
   等待时长: 45.2秒
   是否超时: 是
   自动通过: ✅ 是
```

#### 2. 启动定时检查服务

```bash
# 使用默认配置（60秒检查间隔，30秒超时）
zhushou proposal-timeout start-watch

# 自定义检查间隔和超时时间
zhushou proposal-timeout start-watch --interval 30000 --timeout 45000

# 指定风险级别
zhushou proposal-timeout start-watch --risk-levels safe
```

输出示例：
```
⏱️  启动定时超时检查服务
   检查间隔: 60秒
   超时阈值: 30秒
   风险级别: safe

按 Ctrl+C 停止服务

🔍 开始检查超时提案 (超时阈值: 30秒)
📋 找到 3 个待审核提案
✅ 超时审核完成:
   - 总检查: 3
   - 超时: 0
   - 自动通过: 0
   - 跳过: 3
   - 失败: 0
```

#### 3. 查看配置

```bash
zhushou proposal-timeout config
```

输出：
```
⚙️  超时审核配置:

默认超时时间: 30秒
最小超时时间: 10秒
最大超时时间: 300秒 (5分钟)
自动审核器ID: auto-reviewer
适用风险级别: safe (默认)

说明:
- 仅对 "safe" 级别的提案自动通过
- "elevated" 和 "sovereign" 级别需要人工审核
- 所有操作都有完整的审计追踪
```

---

## 💻 编程API

### 基本用法

```typescript
import { processTimedOutProposals } from "@zhushou/governance/proposal-timeout-review";

// 使用默认配置
const result = await processTimedOutProposals();

console.log(`自动通过了 ${result.autoApprovedCount} 个提案`);
```

### 自定义配置

```typescript
const result = await processTimedOutProposals({
  timeoutMs: 45_000,  // 45秒超时
  enabled: true,
  applicableRiskLevels: ["safe", "elevated"],  // 允许中风险自动通过
});
```

### 启动定时检查

```typescript
import { startPeriodicTimeoutCheck, stopPeriodicTimeoutCheck } from "@zhushou/governance/proposal-timeout-review";

// 启动定时检查（每60秒检查一次）
const timer = startPeriodicTimeoutCheck(60_000, {
  timeoutMs: 30_000,
  enabled: true,
  applicableRiskLevels: ["safe"],
});

// ... 运行一段时间后停止
stopPeriodicTimeoutCheck(timer);
```

### 在Genesis Team中集成

```typescript
import { processTimedOutProposals } from "./proposal-timeout-review";

class GenesisTeamWithTimeoutReview {
  private timeoutTimer: NodeJS.Timeout | null = null;

  async start() {
    // 启动定时超时检查
    this.timeoutTimer = startPeriodicTimeoutCheck(60_000, {
      timeoutMs: 30_000,
      enabled: true,
      applicableRiskLevels: ["safe"],
    });
    
    console.log("✅ Genesis Team 已启动超时自动审核");
  }

  async stop() {
    if (this.timeoutTimer) {
      stopPeriodicTimeoutCheck(this.timeoutTimer);
      this.timeoutTimer = null;
      console.log("⏹️  已停止超时自动审核");
    }
  }
}
```

---

## ⚙️ 配置选项

### TimeoutReviewConfig

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `timeoutMs` | number | 30000 | 超时时间（毫秒） |
| `enabled` | boolean | true | 是否启用超时审核 |
| `applicableRiskLevels` | string[] | ["safe"] | 适用的风险级别 |
| `stateDir` | string | - | 状态目录路径 |
| `env` | NodeJS.ProcessEnv | - | 环境变量 |

### 风险级别说明

| 级别 | 说明 | 是否自动通过 |
|------|------|-------------|
| `safe` | 低风险，局部配置变更 | ✅ 是 |
| `elevated` | 中风险，新技能/插件 | ❌ 否（需人工） |
| `sovereign` | 高风险，组织结构调整 | ❌ 否（需人类主权者） |

### 超时时间范围

- **最小值**: 10秒（10,000ms）
- **默认值**: 30秒（30,000ms）
- **最大值**: 300秒（300,000ms，5分钟）

超出范围的值会自动调整到边界值。

---

## 🔒 安全机制

### 1. 风险分级控制

只有**低风险（safe）**提案才会被自动通过，确保系统安全性。

### 2. 人类主权者优先

如果提案标记为`requiresHumanSovereignApproval`，即使超时也不会自动通过。

### 3. 完整审计追踪

所有自动通过操作都会记录到审计流：

```json
{
  "domain": "governance",
  "action": "proposal.auto-approved",
  "actor": {
    "type": "system",
    "id": "auto-reviewer"
  },
  "refs": {
    "proposalId": "PROP-2026-001"
  },
  "summary": "Auto-approved proposal PROP-2026-001 after timeout (45.2s)",
  "payload": {
    "title": "升级数据库配置",
    "pendingDuration": 45200,
    "timeoutMs": 30000,
    "riskLevel": "safe",
    "reason": "Review timeout exceeded (30s). Auto-approved for system autonomy."
  }
}
```

### 4. 可追溯性

每个自动通过的提案都有明确的标识：
- **审核者**: `auto-reviewer`
- **审核类型**: `system`
- **审核原因**: 明确的超时说明

---

## 🎯 应用场景

### 场景1: Genesis Team工作流

在Genesis Team的能力创造流水线中，低风险的能力提升提案可以自动通过，加速能力迭代。

```typescript
// Sentinel检测到能力缺口
// Archaeologist分析根因
// TDD Developer实现方案
// QA验证通过
// Publisher创建提案

// 如果30秒内无人审核，自动通过
await processTimedOutProposals({
  timeoutMs: 30_000,
  applicableRiskLevels: ["safe"],
});
```

### 场景2: 治理层自动化

在治理层的日常运作中，大量的低风险配置变更可以自动通过，减少人工干预。

```typescript
// 启动定时检查服务
startPeriodicTimeoutCheck(60_000, {
  timeoutMs: 30_000,
  applicableRiskLevels: ["safe"],
});
```

### 场景3: 紧急修复

在紧急情况下，可以快速处理积压的提案。

```bash
# 立即检查并处理所有超时提案
zhushou proposal-timeout check --timeout 30000
```

---

## 📊 监控和调试

### 查看审计日志

```bash
# 查看最近的自动通过记录
tail -f state/audit/governance-proposals.ndjson | grep "auto-approved"
```

### 统计信息

```typescript
const result = await processTimedOutProposals();

console.log(`总检查: ${result.totalChecked}`);
console.log(`超时: ${result.timedOutCount}`);
console.log(`自动通过: ${result.autoApprovedCount}`);
console.log(`跳过: ${result.skippedCount}`);
console.log(`失败: ${result.failedCount}`);
```

### 详细日志

每个提案的处理都有详细的日志输出：

```
⏰ 提案超时，自动通过: PROP-2026-001 (升级数据库配置)
   - 等待时长: 45.2秒
   - 风险级别: safe
✅ 已自动通过提案: PROP-2026-001
```

---

## ⚠️ 注意事项

### 1. 谨慎调整超时时间

- **过短**（<10秒）: 可能导致误判，没有足够时间人工审核
- **过长**（>5分钟）: 降低系统自主性，增加延迟

**推荐**: 保持默认的30秒

### 2. 风险级别选择

- **生产环境**: 仅允许`safe`级别自动通过
- **测试环境**: 可以考虑允许`elevated`级别
- **永远不要**: 允许`sovereign`级别自动通过

### 3. 监控自动通过率

定期检查自动通过的提案数量，如果过高可能说明：
- 人工审核资源不足
- 提案创建频率过高
- 需要优化审核流程

### 4. 审计日志保留

确保审计日志长期保存，以便：
- 追溯自动通过决策
- 分析系统行为模式
- 合规性审查

---

## 🔧 故障排除

### 问题1: 提案没有被自动通过

**可能原因**:
1. 等待时间未达到30秒
2. 风险级别不是"safe"
3. 提案需要人类主权者批准

**解决方法**:
```bash
# 查看详细原因
zhushou proposal-timeout check

# 检查提案的风险级别
zhushou governance proposals --id PROP-XXX
```

### 问题2: 定时检查服务未启动

**可能原因**:
1. 进程已退出
2. 配置错误

**解决方法**:
```bash
# 重新启动服务
zhushou proposal-timeout start-watch --interval 60000
```

### 问题3: 自动通过失败

**可能原因**:
1. 权限不足
2. 提案状态已改变
3. 系统错误

**解决方法**:
```bash
# 查看详细错误信息
zhushou proposal-timeout check

# 检查审计日志
cat state/audit/governance-proposals.ndjson | grep "error"
```

---

## 📈 最佳实践

### 1. 结合监控告警

```typescript
import { processTimedOutProposals } from "./proposal-timeout-review";

async function monitoredTimeoutCheck() {
  const result = await processTimedOutProposals();
  
  // 如果自动通过数量异常，发送告警
  if (result.autoApprovedCount > 10) {
    sendAlert(`High auto-approval count: ${result.autoApprovedCount}`);
  }
  
  return result;
}
```

### 2. 定期审查自动通过记录

每周审查一次自动通过的提案，确保：
- 自动通过决策合理
- 没有安全风险
- 系统运行正常

### 3. 渐进式启用

```
Week 1: 仅在测试环境启用
Week 2: 在生产环境启用，仅safe级别
Week 3: 监控运行数据，评估效果
Week 4: 根据反馈调整配置
```

### 4. 文档化决策规则

明确记录哪些类型的提案适合自动通过：
- 配置文件的微小变更
- 文档更新
- 非关键路径的性能优化
- 等等

---

## 🎓 设计理念

### 为什么需要超时自动通过？

1. **提高自主性** - 减少人工干预瓶颈，让系统更自治
2. **加快响应速度** - 避免提案积压，快速迭代
3. **平衡安全与效率** - 通过风险分级，在安全和效率间取得平衡
4. **模拟真实决策** - 现实中，长时间无响应的低优先级事项通常会被默认接受

### 为什么限制为30秒？

- **足够短**: 不会明显影响系统响应速度
- **足够长**: 给人工审核留出合理时间
- **经验值**: 基于实际运行数据的优化结果

### 为什么只对safe级别生效？

- **安全第一**: 遵循安全三大法则
- **风险可控**: 低风险提案的影响有限
- **可回滚**: safe级别的变更通常容易回滚

---

## 📚 相关文档

- [提案系统文档](../src/governance/proposals.ts)
- [安全三大法则](./security-three-laws.md)
- [高自治机制](./high-autonomy-mechanism.md)
- [因果关系引擎](./CAUSALITY_ENGINE_GUIDE.md)

---

**最后更新**: 2026-05-04  
**版本**: 1.0.0
