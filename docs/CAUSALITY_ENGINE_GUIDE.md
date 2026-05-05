# 因果关系引擎使用指南

## 📖 概述

因果关系引擎（Causality Engine）是助手系统的核心组件，提供事件因果追踪、因果图构建、根因分析和因果推理功能。

### 核心能力

1. **因果事件记录** - 记录事件及其因果关系
2. **因果图构建** - 构建事件之间的因果网络
3. **根因分析** - 追溯问题的根本原因
4. **因果推理** - 基于已知因果推断可能的结果
5. **反事实推理** - "如果X没有发生，Y会发生吗？"

---

## 🚀 快速开始

### 1. CLI命令使用

#### 添加因果事件

```bash
# 添加一个动作事件
zhushou causality add-event \
  --id "system-start" \
  --type action \
  --description "系统启动" \
  --actor "executor" \
  --strength strong \
  --confidence 0.95

# 添加一个反应事件（有因果关系）
zhushou causality add-event \
  --id "services-ready" \
  --type reaction \
  --description "服务就绪" \
  --causes system-start \
  --strength strong \
  --confidence 0.9

# 添加一个错误事件
zhushou causality add-event \
  --id "db-connection-failed" \
  --type error \
  --description "数据库连接失败" \
  --strength moderate \
  --confidence 0.8
```

#### 查看统计信息

```bash
zhushou causality stats
```

输出示例：
```
📊 因果图统计信息

总事件数: 15
总边数: 12
平均度数: 1.60
最大深度: 4
连通分量: 2

事件类型分布:
  - action: 5
  - reaction: 7
  - error: 3

时间范围:
  - 最早: 2026-05-04T10:00:00.000Z
  - 最晚: 2026-05-04T12:30:00.000Z
```

#### 追溯原因

```bash
# 追溯某个事件的直接原因
zhushou causality trace-causes --event-id "api-timeout"

# 追溯更深层的原因（深度=5）
zhushou causality trace-causes --event-id "api-timeout" --depth 5
```

#### 追溯结果

```bash
# 查看某个事件导致的所有结果
zhushou causality trace-effects --event-id "config-change" --depth 3
```

#### 根因分析

```bash
# 对故障进行根因分析
zhushou causality root-cause --event-id "system-crash" --max-depth 5
```

输出示例：
```
🎯 对事件 system-crash 进行根因分析

目标事件: system-crash

置信度: 85.3%

根因 (3个):

1. 根因 [error]: 内存泄漏在模块X (由 garbage-collector 执行)
   距离: 3 步
   强度: 75.0%

2. 根因 [error]: 配置错误导致资源限制过低
   距离: 2 步
   强度: 68.5%

3. 根因 [decision]: 选择了不合适的缓存策略
   距离: 4 步
   强度: 52.3%

建议:

  1. 修复根本错误: 内存泄漏在模块X
  2. 重新评估决策: 选择了不合适的缓存策略
  3. 优化操作执行: 配置错误导致资源限制过低
```

#### 因果推理

```bash
# 推断某个决策的可能结果
zhushou causality infer --premise-id "upgrade-database"
```

输出示例：
```
🧠 基于前提事件 upgrade-database 进行因果推理

前提事件: upgrade-database

推理置信度: 78.5%

可能的结果 (4个):

1. 数据库性能提升
   概率: 85.0%
   时间范围: immediate

2. 需要迁移脚本
   概率: 90.0%
   时间范围: immediate
   条件: migration-required

3. 可能出现兼容性问题
   概率: 45.0%
   时间范围: short-term

4. 备份策略需要更新
   概率: 70.0%
   时间范围: medium-term

推理解释:
基于事件 "升级数据库" (decision)
高概率结果 (2个): 数据库性能提升, 需要迁移脚本
中等概率结果 (2个): 可能出现兼容性问题, 备份策略需要更新
推理依据: 历史因果模式和事件类型分析
```

#### 反事实推理

```bash
# 分析如果某个事件没有发生会怎样
zhushou causality counterfactual \
  --event-id "security-patch-applied" \
  --scenario "如果没有应用安全补丁"
```

输出示例：
```
💭 反事实推理: 如果没有应用安全补丁

原始事件: security-patch-applied

假设场景: 如果没有应用安全补丁

预测结果:
  会发生改变: 是
  概率: 72.5%
  解释: 如果 "应用安全补丁" 没有发生:
3 个事件可能会受到不同影响
可能的替代结果: [假设] 如果没有 "应用安全补丁", 可能发生: 系统被攻击; [假设] 如果没有 "应用安全补丁", 可能发生: 数据泄露; [假设] 如果没有 "应用安全补丁", 可能发生: 服务中断

关键依赖 (3个):

  1. vulnerability-detected
  2. patch-available
  3. deployment-scheduled

置信度: 70.0%
```

#### 路径分析

```bash
# 查找两个事件之间的所有因果路径
zhushou causality paths --from "user-login" --to "data-exported"
```

输出示例：
```
🛤️  查找从 user-login 到 data-exported 的因果路径

找到 2 条路径:

1. 路径: user-login → auth-success → session-created → data-accessed → data-exported
   长度: 5
   总强度: 42.5%

2. 路径: user-login → auth-success → admin-panel-accessed → data-exported
   长度: 4
   总强度: 38.7%
```

#### 导出因果图

```bash
# 导出为JSON文件
zhushou causality export --output causal-graph.json
```

#### 清空因果图

```bash
# ⚠️ 警告：这将删除所有因果数据
zhushou causality clear
```

---

## 💻 编程API使用

### 基本用法

```typescript
import { getCausalGraph, CausalEvent } from "@zhushou/governance/causality-engine";

const graph = getCausalGraph();

// 1. 添加事件
const event1: CausalEvent = {
  id: "event-1",
  timestamp: Date.now(),
  type: "action",
  description: "用户登录",
  actor: "auth-service",
  causes: [],
  effects: [],
  strength: "strong",
  confidence: 0.95,
};

graph.addEvent(event1);

// 2. 添加有因果关系的事件
const event2: CausalEvent = {
  id: "event-2",
  timestamp: Date.now() + 1000,
  type: "reaction",
  description: "会话创建",
  causes: ["event-1"],
  effects: [],
  strength: "strong",
  confidence: 0.9,
};

graph.addEvent(event2);

// 3. 追溯原因
const causes = graph.getCauses("event-2");
console.log(`事件2的原因: ${causes.map(c => c.description).join(", ")}`);

// 4. 追溯结果
const effects = graph.getEffects("event-1");
console.log(`事件1的结果: ${effects.map(e => e.description).join(", ")}`);
```

### 根因分析

```typescript
// 创建故障传播链
graph.addEvent({
  id: "root-cause",
  timestamp: 1000,
  type: "error",
  description: "数据库连接池耗尽",
  causes: [],
  effects: [],
  strength: "strong",
  confidence: 0.95,
});

graph.addEvent({
  id: "intermediate",
  timestamp: 2000,
  type: "error",
  description: "API请求超时",
  causes: ["root-cause"],
  effects: [],
  strength: "strong",
  confidence: 0.9,
});

graph.addEvent({
  id: "symptom",
  timestamp: 3000,
  type: "error",
  description: "用户看到错误页面",
  causes: ["intermediate"],
  effects: [],
  strength: "moderate",
  confidence: 0.8,
});

// 执行根因分析
const analysis = graph.analyzeRootCause("symptom");

console.log(`根因数量: ${analysis.rootCauses.length}`);
console.log(`主要根因: ${analysis.rootCauses[0].explanation}`);
console.log(`建议: ${analysis.recommendations.join("\n")}`);
```

### 因果推理

```typescript
// 添加前提事件和已知结果
graph.addEvent({
  id: "premise",
  timestamp: 1000,
  type: "decision",
  description: "决定采用微服务架构",
  causes: [],
  effects: ["effect-1", "effect-2"],
  strength: "strong",
  confidence: 0.9,
});

graph.addEvent({
  id: "effect-1",
  timestamp: 2000,
  type: "state_change",
  description: "系统复杂度增加",
  causes: ["premise"],
  effects: [],
  strength: "strong",
  confidence: 0.85,
});

// 进行因果推理
const inference = graph.inferEffects("premise");

console.log(`可能的结果数量: ${inference.possibleEffects.length}`);
inference.possibleEffects.forEach(effect => {
  console.log(`- ${effect.description} (概率: ${(effect.probability * 100).toFixed(1)}%)`);
});
console.log(`推理解释: ${inference.reasoning}`);
```

### 反事实推理

```typescript
// 添加关键事件
graph.addEvent({
  id: "critical-decision",
  timestamp: 1000,
  type: "decision",
  description: "选择NoSQL数据库",
  causes: [],
  effects: ["consequence"],
  strength: "strong",
  confidence: 0.9,
});

graph.addEvent({
  id: "consequence",
  timestamp: 2000,
  type: "state_change",
  description: "查询性能优化",
  causes: ["critical-decision"],
  effects: [],
  strength: "strong",
  confidence: 0.85,
});

// 进行反事实分析
const counterfactual = graph.analyzeCounterfactual(
  "critical-decision",
  "如果选择了关系型数据库"
);

console.log(`预测结果: ${counterfactual.predictedOutcome.explanation}`);
console.log(`替代事件: ${counterfactual.predictedOutcome.alternativeEvents.join(", ")}`);
```

### 路径查找

```typescript
// 查找两个事件之间的所有路径
const paths = graph.findAllPaths("start-event", "end-event", 10);

paths.forEach((path, index) => {
  console.log(`路径 ${index + 1}: ${path.path.join(" → ")}`);
  console.log(`  长度: ${path.length}`);
  console.log(`  总强度: ${(path.totalStrength * 100).toFixed(1)}%`);
});
```

### 统计信息

```typescript
const stats = graph.getStats();

console.log(`总事件数: ${stats.totalEvents}`);
console.log(`总边数: ${stats.totalEdges}`);
console.log(`平均度数: ${stats.avgDegree.toFixed(2)}`);
console.log(`最大深度: ${stats.maxDepth}`);
console.log(`连通分量: ${stats.connectedComponents}`);

// 事件类型分布
for (const [type, count] of Object.entries(stats.eventTypeDistribution)) {
  if (count > 0) {
    console.log(`  ${type}: ${count}`);
  }
}
```

### 事件监听

```typescript
// 监听事件添加
graph.on("eventAdded", (event) => {
  console.log(`新事件: ${event.id} - ${event.description}`);
});

// 监听边添加
graph.on("edgeAdded", ({ from, to, strength }) => {
  console.log(`新因果边: ${from} → ${to} (强度: ${strength})`);
});

// 监听清空
graph.on("cleared", () => {
  console.log("因果图已清空");
});
```

---

## 🎯 实际应用场景

### 场景1: 故障诊断

```typescript
// 当系统发生故障时，使用根因分析快速定位问题
async function diagnoseFailure(failureEventId: string) {
  const graph = getCausalGraph();
  const analysis = graph.analyzeRootCause(failureEventId);
  
  console.log("=== 故障诊断报告 ===\n");
  console.log(`故障事件: ${failureEventId}\n`);
  
  console.log("根本原因:");
  analysis.rootCauses.forEach((rc, i) => {
    console.log(`${i + 1}. ${rc.explanation}`);
    console.log(`   置信度: ${(rc.strength * 100).toFixed(1)}%`);
  });
  
  console.log("\n建议措施:");
  analysis.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  
  return analysis;
}
```

### 场景2: 决策支持

```typescript
// 在做出重要决策前，预测可能的结果
async function evaluateDecision(decisionEventId: string) {
  const graph = getCausalGraph();
  const inference = graph.inferEffects(decisionEventId);
  
  console.log("=== 决策影响评估 ===\n");
  console.log(`决策: ${decisionEventId}\n`);
  
  console.log("可能的结果:");
  inference.possibleEffects.forEach((effect, i) => {
    const riskLevel = effect.probability > 0.7 ? "高风险" : 
                     effect.probability > 0.4 ? "中风险" : "低风险";
    console.log(`${i + 1}. ${effect.description}`);
    console.log(`   概率: ${(effect.probability * 100).toFixed(1)}% (${riskLevel})`);
    if (effect.timeframe) {
      console.log(`   时间: ${effect.timeframe}`);
    }
  });
  
  console.log(`\n整体置信度: ${(inference.confidence * 100).toFixed(1)}%`);
  
  return inference;
}
```

### 场景3: 变更影响分析

```typescript
// 在进行系统变更前，分析如果不这样做会怎样
async function analyzeChangeImpact(changeEventId: string, scenario: string) {
  const graph = getCausalGraph();
  const counterfactual = graph.analyzeCounterfactual(changeEventId, scenario);
  
  console.log("=== 变更影响分析 ===\n");
  console.log(`变更: ${changeEventId}`);
  console.log(`假设: ${scenario}\n`);
  
  console.log("预测结果:");
  console.log(`  会产生影响: ${counterfactual.predictedOutcome.wouldHappen ? "是" : "否"}`);
  console.log(`  影响概率: ${(counterfactual.predictedOutcome.probability * 100).toFixed(1)}%`);
  console.log(`  解释: ${counterfactual.predictedOutcome.explanation}\n`);
  
  if (counterfactual.keyDependencies.length > 0) {
    console.log("关键依赖:");
    counterfactual.keyDependencies.forEach(dep => {
      console.log(`  - ${dep}`);
    });
  }
  
  return counterfactual;
}
```

### 场景4: Genesis Team集成

```typescript
// 在Genesis Team工作流中使用因果关系追踪
import { getCausalGraph } from "./causality-engine";

class GenesisTeamWithCausality {
  private graph = getCausalGraph();
  
  async detectGap(gapSignal: any) {
    // 记录缺口检测事件
    this.graph.addEvent({
      id: `gap-${Date.now()}`,
      timestamp: Date.now(),
      type: "observation",
      description: `检测到能力缺口: ${gapSignal.description}`,
      actor: "sentinel",
      causes: [],
      effects: [],
      strength: "strong",
      confidence: 0.9,
      metadata: {
        tags: ["gap-detection", "sentinel"],
        priority: gapSignal.severity,
      },
    });
    
    // ... 继续工作流
  }
  
  async analyzeRootCause(gapId: string) {
    // 使用因果引擎进行根因分析
    const analysis = this.graph.analyzeRootCause(gapId);
    
    // 记录分析结果
    this.graph.addEvent({
      id: `analysis-${Date.now()}`,
      timestamp: Date.now(),
      type: "decision",
      description: `根因分析完成: ${analysis.rootCauses.length}个根因`,
      actor: "archaeologist",
      causes: [gapId],
      effects: [],
      strength: "moderate",
      confidence: analysis.confidence,
    });
    
    return analysis;
  }
}
```

---

## 📊 最佳实践

### 1. 事件ID命名规范

```typescript
// ✅ 好的命名
"genesis.gap-detection.2026-05-04"
"executor.task-failure.api-timeout"
"governance.proposal.approved.db-upgrade"

// ❌ 避免的命名
"event1"
"e1"
"test"
```

### 2. 因果强度选择

```typescript
// strong: 确定性因果关系（>90%置信度）
strength: "strong"  // 例如：数据库宕机 → 服务不可用

// moderate: 概率性因果关系（60-90%置信度）
strength: "moderate"  // 例如：代码重构 → 可能引入bug

// weak: 相关性而非因果性（<60%置信度）
strength: "weak"  // 例如：周一 → 系统负载高（可能是巧合）
```

### 3. 置信度设置

```typescript
// 基于证据质量设置置信度
confidence: 0.95  // 有完整日志和监控数据
confidence: 0.8   // 有部分证据
confidence: 0.6   // 基于推测
confidence: 0.4   // 高度不确定
```

### 4. 定期清理

```typescript
// 定期清理过旧的因果数据
setInterval(() => {
  const graph = getCausalGraph();
  const stats = graph.getStats();
  
  if (stats.totalEvents > 10000) {
    console.warn("因果图过大，考虑归档旧数据");
    // 实现归档逻辑
  }
}, 24 * 60 * 60 * 1000); // 每天检查
```

### 5. 事件标签使用

```typescript
// 使用标签进行分类和过滤
metadata: {
  tags: ["production", "critical", "database"],
  priority: "high",
  category: "infrastructure",
}
```

---

## 🔧 高级功能

### 自定义证据类型

```typescript
interface CausalEvidence {
  type: "temporal" | "statistical" | "mechanistic" | "counterfactual";
  description: string;
  strength: number;
  source?: string;
}

// 添加带证据的事件
const event: CausalEvent = {
  id: "performance-improvement",
  timestamp: Date.now(),
  type: "state_change",
  description: "系统性能提升50%",
  causes: ["cache-optimization"],
  effects: [],
  strength: "strong",
  confidence: 0.9,
  evidence: [
    {
      type: "statistical",
      description: "基准测试显示响应时间从200ms降至100ms",
      strength: 0.95,
      source: "performance-test-suite",
    },
    {
      type: "temporal",
      description: "性能提升发生在缓存优化部署后",
      strength: 0.85,
    },
  ],
};
```

### 批量导入事件

```typescript
async function importEventsFromLog(logFile: string) {
  const graph = getCausalGraph();
  const logs = await parseLogFile(logFile);
  
  for (const log of logs) {
    graph.addEvent({
      id: log.id,
      timestamp: log.timestamp,
      type: mapLogTypeToCausalType(log.type),
      description: log.message,
      actor: log.service,
      causes: extractCauses(log),
      effects: [],
      strength: determineStrength(log),
      confidence: calculateConfidence(log),
    });
  }
  
  console.log(`导入了 ${logs.length} 个事件`);
}
```

### 可视化导出

```typescript
function exportForVisualization(graph: CausalGraph) {
  const json = graph.exportToJSON();
  
  // 转换为D3.js格式
  const d3Format = {
    nodes: json.events.map(e => ({
      id: e.id,
      label: e.description,
      type: e.type,
      size: e.effects.length + e.causes.length,
    })),
    links: json.edges.map(e => ({
      source: e.from,
      target: e.to,
      value: 1,
    })),
  };
  
  return d3Format;
}
```

---

## 📚 相关文档

- [因果关系引擎API文档](../src/governance/causality-engine.ts)
- [测试用例](../src/governance/causality-engine.test.ts)
- [CLI命令参考](./causality.ts)

---

**最后更新**: 2026-05-04  
**版本**: 1.0.0
