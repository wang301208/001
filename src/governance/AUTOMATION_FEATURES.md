# 助手制度化系统 - 自动化功能实现

本文档说明助手项目的自动化功能实现，包括 Genesis Team 自动化循环、沙盒重放执行器、晋升后观察器和 WebSocket 实时更新。

## 📋 目录

- [1. Genesis Team 自动化循环](#1-genesis-team-自动化循环)
- [2. 沙盒重放执行器](#2-沙盒重放执行器)
- [3. 晋升后观察器](#3-晋升后观察器)
- [4. WebSocket 实时更新](#4-websocket-实时更新)
- [5. 使用指南](#5-使用指南)
- [6. 配置选项](#6-配置选项)
- [7. 监控与调试](#7-监控与调试)

---

## 1. Genesis Team 自动化循环

### 概述

Genesis Team 自动化循环是能力进化的核心引擎，实现了从能力缺口检测到资产登记的完整自动化流水线：

```
Sentinel → Archaeologist → TDD Developer → QA → Publisher
```

### 架构

**文件**: `src/governance/genesis-team-loop.ts`

**核心类**: `GenesisTeamLoop`

**工作流程**:

1. **Sentinel 扫描** (每 30 分钟)
   - 检测能力缺口
   - 检测性能瓶颈
   - 检测回归信号
   - 生成 GapSignal

2. **创建 Evolution Project**
   - 为每个高优先级缺口创建提案
   - 跟踪项目状态

3. **Archaeologist 根因分析**
   - 分析问题根源
   - 制定变更计划
   - 生成 ChangePlan

4. **TDD Developer 构建**
   - 在沙盒中编写测试
   - 实现候选方案
   - 生成 CandidateManifest

5. **QA 验证**
   - 执行单元测试
   - 执行集成测试
   - 执行安全审计
   - 生成 QAReport

6. **Publisher 登记**
   - 验证所有制品
   - 注册到资产目录
   - 生成 PromotionRecord

### 使用方法

```bash
# 启动自动化循环
zhushou autonomy start-genesis-loop \
  --scan-interval 30 \
  --max-concurrent 3 \
  --workspace /path/to/workspace

# 查看状态
zhushou autonomy status
```

### 配置选项

```typescript
interface GenesisTeamLoopConfig {
  scanIntervalMs?: number;        // 扫描间隔（毫秒），默认 30 分钟
  maxConcurrentExperiments?: number; // 最大并发实验数，默认 3
  enabled?: boolean;              // 是否启用，默认 true
  workspaceDirs?: string[];       // 工作区目录列表
}
```

---

## 2. 沙盒重放执行器

### 概述

沙盒重放执行器负责在沙盒环境中重放历史场景，验证变更的正确性。这是沙盒宇宙控制器的核心组件之一。

### 架构

**文件**: `src/governance/sandbox-replay-runner.ts`

**核心类**: `SandboxReplayRunner`

**工作流程**:

1. **加载历史场景**
   - 从任务历史提取场景
   - 准备输入数据

2. **沙盒执行**
   - 在隔离环境中执行
   - 收集输出和指标

3. **结果对比**
   - 对比预期与实际
   - 计算相似度
   - 识别差异

4. **生成报告**
   - 生成详细的重放报告
   - 保存到 artifact 目录

### 使用示例

```typescript
import { SandboxReplayRunner } from "./governance/sandbox-replay-runner.js";

const runner = new SandboxReplayRunner("/path/to/artifacts");

const plan = {
  scenarios: ["scenario-1", "scenario-2"],
  workspaceDirs: ["/path/to/workspace"],
  requiredOutputs: ["output-1", "output-2"],
};

const report = await runner.executeReplay(plan);

console.log(`通过率: ${report.passedScenarios}/${report.totalScenarios}`);
console.log(`整体结果: ${report.overallPass ? "通过" : "失败"}`);
```

### 报告结构

```typescript
interface ReplayReport {
  replayId: string;
  plan: SandboxUniverseReplayPlan;
  executedAt: number;
  duration: number;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  results: ReplayExecutionResult[];
  comparisons: ReplayComparison[];
  overallPass: boolean;
  summary: string;
  artifacts: {
    reportPath?: string;
    logsPath?: string;
    metricsPath?: string;
  };
}
```

---

## 3. 晋升后观察器

### 概述

晋升后观察器负责监控已晋升资产的行为，检测回归并自动触发告警或回滚。这是确保系统稳定性的关键组件。

### 架构

**文件**: `src/governance/post-promotion-observer.ts`

**核心类**: `PostPromotionObserver`

**工作流程**:

1. **开始观察**
   - 订阅资产指标
   - 设置定时检查

2. **收集指标**
   - 使用量
   - 错误率
   - 响应时间
   - 成功率

3. **检测回归**
   - 错误率飙升检测
   - 性能退化检测
   - 功能回归检测
   - 安全违规检测

4. **触发回滚**（如果需要）
   - 评估严重性
   - 执行回滚计划
   - 通知相关人员

5. **发送告警**
   - 严重问题时立即告警
   - 提供详细诊断信息

### 使用示例

```typescript
import { PostPromotionObserver } from "./governance/post-promotion-observer.js";

const observer = new PostPromotionObserver({
  observationWindowMs: 24 * 60 * 60 * 1000, // 24 小时
  checkIntervalMs: 5 * 60 * 1000,           // 5 分钟
  autoRollbackEnabled: true,
  regressionThreshold: 0.05,                // 5% 错误率阈值
});

// 开始观察已晋升的资产
await observer.startObserving("promotion-123", "skill-abc");

// 获取观察历史
const history = observer.getObservationHistory("promotion-123");
```

### 配置选项

```typescript
interface PromotionObservationConfig {
  observationWindowMs?: number;   // 观察窗口（毫秒），默认 24 小时
  checkIntervalMs?: number;       // 检查间隔（毫秒），默认 5 分钟
  autoRollbackEnabled?: boolean;  // 是否启用自动回滚，默认 true
  regressionThreshold?: number;   // 回归阈值（错误率），默认 0.05 (5%)
}
```

### 回归检测类型

- **error_rate_spike**: 错误率飙升
- **performance_degradation**: 性能退化
- **functional_regression**: 功能回归
- **security_violation**: 安全违规

---

## 4. WebSocket 实时更新

### 概述

WebSocket 实时更新提供治理状态的实时推送，包括代理组织状态、演化项目状态、冻结状态等。支持离线缓存和自动重连。

### 架构

**前端 Hook**: `web/src/hooks/useGovernanceWebSocket.ts`

**核心功能**:

- `useGovernanceWebSocket`: WebSocket 连接管理
- `useGovernanceCache`: 离线缓存管理

**特性**:

- ✅ 实时推送治理状态更新
- ✅ 自动重连（最多 10 次尝试）
- ✅ 离线缓存（localStorage）
- ✅ 连接状态指示
- ✅ 错误处理

### 使用示例

```tsx
import { useGovernanceWebSocket, useGovernanceCache } from '../hooks/useGovernanceWebSocket';

function GovernancePage() {
  const { governanceStatus } = useAppStore();
  const { connected, error, reconnect, lastUpdate } = useGovernanceWebSocket({
    autoReconnect: true,
    reconnectInterval: 5000,
  });
  const { loadFromCache } = useGovernanceCache();
  
  // 如果没有实时数据，尝试从缓存加载
  if (!governanceStatus) {
    loadFromCache();
  }
  
  return (
    <div>
      {!connected && (
        <Alert color="yellow">
          无法连接到服务器，显示的是缓存数据
        </Alert>
      )}
      
      {connected && lastUpdate && (
        <Alert color="green">
          最后更新: {new Date(lastUpdate).toLocaleTimeString()}
        </Alert>
      )}
      
      {/* 渲染治理状态 */}
    </div>
  );
}
```

### WebSocket 消息格式

**订阅消息**:
```json
{
  "type": "subscribe",
  "channel": "governance"
}
```

**状态更新消息**:
```json
{
  "type": "governance_update",
  "payload": {
    "freezeActive": false,
    "activeAgents": [...],
    "evolutionProjects": [...],
    "sandboxExperiments": [...]
  }
}
```

**错误消息**:
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## 5. 使用指南

### 快速开始

#### 1. 启动 Genesis Team 自动化循环

```bash
# 基本用法
zhushou autonomy start-genesis-loop

# 自定义配置
zhushou autonomy start-genesis-loop \
  --scan-interval 15 \
  --max-concurrent 5 \
  --workspace /path/to/workspace
```

#### 2. 查看状态

```bash
zhushou autonomy status
```

#### 3. 访问前端面板

```bash
# 启动网关
zhushou gateway

# 访问治理层面板
open http://localhost:3000/governance
```

### 典型工作流

```
1. 启动自动化循环
   ↓
2. Sentinel 检测到能力缺口
   ↓
3. 自动创建 evolution project
   ↓
4. Archaeologist 分析根因
   ↓
5. TDD Developer 构建候选方案
   ↓
6. QA 验证
   ↓
7. Publisher 登记资产
   ↓
8. Post-Promotion Observer 开始观察
   ↓
9. 前端实时显示状态
```

---

## 6. 配置选项

### Genesis Team Loop 配置

```yaml
# .zhushou/config.yaml
autonomy:
  genesis_team_loop:
    enabled: true
    scan_interval: "30m"
    max_concurrent_experiments: 3
    workspace_dirs:
      - "./workspace"
```

### Post-Promotion Observer 配置

```yaml
# .zhushou/config.yaml
autonomy:
  post_promotion_observer:
    enabled: true
    observation_window: "24h"
    check_interval: "5m"
    auto_rollback: true
    regression_threshold: 0.05
```

### WebSocket 配置

```typescript
// web/src/config.ts
export const WS_CONFIG = {
  url: "ws://localhost:18789/ws/governance",
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
};
```

---

## 7. 监控与调试

### 日志输出

**Genesis Team Loop**:
```
[GenesisTeamLoop] 启动自动化循环，扫描间隔: 30 分钟
[Sentinel] 开始扫描能力缺口...
[Sentinel] 扫描完成，发现 2 个信号
[GenesisTeamLoop] 处理缺口: gap-abc123 (缺少图表生成技能...)
[Archaeologist] 开始根因分析: evo-123456
[TDD Developer] 开始构建候选方案: evo-123456
[QA] 开始验证: evo-123456
[Publisher] 开始登记资产: evo-123456
```

**Post-Promotion Observer**:
```
[PostPromotionObserver] 开始观察资产: skill-abc (晋升ID: promotion-123)
[PostPromotionObserver] 执行观察: obs-789
[PostPromotionObserver] ⚠️  严重告警: 检测到 2 个回归信号 (error_rate_spike, performance_degradation)
[PostPromotionObserver] 触发回滚: skill-abc, 原因: 错误率 8.50% 超过阈值 5.00%
```

**WebSocket**:
```
[useGovernanceWebSocket] 连接到: ws://localhost:18789/ws/governance
[useGovernanceWebSocket] 连接成功
[useGovernanceWebSocket] 收到治理状态更新
[useGovernanceWebSocket] 连接关闭: code=1000, reason=Normal closure
```

### 常见问题

#### Q1: Genesis Team Loop 没有检测到任何缺口？

**A**: 确保：
1. 工作区目录正确配置
2. 能力清单已初始化
3. 检查日志中的 `[Sentinel]` 输出

#### Q2: WebSocket 连接失败？

**A**: 检查：
1. 网关是否正在运行
2. WebSocket 端点是否正确配置
3. 防火墙是否阻止连接

#### Q3: 自动回滚没有触发？

**A**: 确认：
1. `autoRollbackEnabled` 设置为 `true`
2. 错误率超过 `regressionThreshold`
3. 检查 `[PostPromotionObserver]` 日志

### 性能调优

**调整扫描间隔**:
- 开发环境: 5-15 分钟
- 生产环境: 30-60 分钟

**调整并发数**:
- 低资源环境: 1-2
- 高资源环境: 5-10

**调整观察窗口**:
- 短期观察: 6-12 小时
- 长期观察: 24-72 小时

---

## 📚 相关文档

- [制度化系统重构方案](../../docs/institutional-system-refactor-plan.md)
- [安全三大法则](../../docs/security-three-laws.md)
- [高度自主机制](../../docs/high-autonomy-mechanism.md)
- [沙盒宇宙设计](../../governance/sandbox-universe-minimal-design.zh-CN.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-05-04  
**维护者**: 助手治理团队
