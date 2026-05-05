# 因果关系引擎 - 快速参考

## 🚀 快速开始

### CLI命令速查

```bash
# 添加事件
zhushou causality add-event --id "event-1" --type action --description "描述" --strength strong --confidence 0.9

# 查看统计
zhushou causality stats

# 追溯原因
zhushou causality trace-causes --event-id "event-1" --depth 5

# 追溯结果
zhushou causality trace-effects --event-id "event-1" --depth 5

# 根因分析
zhushou causality root-cause --event-id "failure" --max-depth 5

# 因果推理
zhushou causality infer --premise-id "decision"

# 反事实推理
zhushou causality counterfactual --event-id "event" --scenario "如果没有发生"

# 路径分析
zhushou causality paths --from "start" --to "end"

# 导出
zhushou causality export --output graph.json

# 清空
zhushou causality clear
```

---

## 💻 API速查

### 基本操作

```typescript
import { getCausalGraph } from "@zhushou/governance/causality-engine";

const graph = getCausalGraph();

// 添加事件
graph.addEvent({
  id: "event-1",
  timestamp: Date.now(),
  type: "action",  // action | reaction | decision | observation | error | state_change | external_event
  description: "事件描述",
  actor: "执行者",
  causes: [],      // 原因事件ID列表
  effects: [],     // 结果事件ID列表
  strength: "strong",  // strong | moderate | weak
  confidence: 0.9,     // 0-1
  metadata: {
    tags: ["tag1", "tag2"],
    priority: "high",  // low | medium | high | critical
  },
});

// 获取事件
const event = graph.getEvent("event-1");

// 追溯原因
const causes = graph.getCauses("event-1", 5);  // 深度=5

// 追溯结果
const effects = graph.getEffects("event-1", 5);

// 查找路径
const paths = graph.findAllPaths("from", "to", 10);  // 最大长度=10

// 根因分析
const analysis = graph.analyzeRootCause("event-1", 5);

// 因果推理
const inference = graph.inferEffects("event-1");

// 反事实推理
const counterfactual = graph.analyzeCounterfactual("event-1", "如果...");

// 统计信息
const stats = graph.getStats();

// 导出JSON
const json = graph.exportToJSON();

// 清空
graph.clear();
```

---

## 📊 事件类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `action` | 主动行为 | 用户登录、部署代码 |
| `reaction` | 被动反应 | 服务重启、告警触发 |
| `decision` | 决策点 | 选择架构、批准提案 |
| `observation` | 观察事件 | 检测到异常、监控数据 |
| `error` | 错误事件 | 连接失败、超时 |
| `state_change` | 状态变更 | 配置更新、版本升级 |
| `external_event` | 外部事件 | API调用、第三方通知 |

---

## 🔧 因果强度

| 强度 | 置信度范围 | 说明 |
|------|-----------|------|
| `strong` | > 90% | 确定性因果关系 |
| `moderate` | 60-90% | 概率性因果关系 |
| `weak` | < 60% | 相关性而非因果性 |

---

## 🎯 典型场景

### 场景1: 故障诊断

```typescript
// 1. 记录故障事件链
graph.addEvent({ id: "root-cause", type: "error", description: "内存泄漏", causes: [] });
graph.addEvent({ id: "symptom", type: "error", description: "系统缓慢", causes: ["root-cause"] });

// 2. 执行根因分析
const analysis = graph.analyzeRootCause("symptom");

// 3. 获取建议
console.log(analysis.recommendations);
```

### 场景2: 决策评估

```typescript
// 1. 记录决策
graph.addEvent({ id: "decision", type: "decision", description: "升级数据库" });

// 2. 预测影响
const inference = graph.inferEffects("decision");

// 3. 评估风险
inference.possibleEffects.forEach(effect => {
  if (effect.probability > 0.7) {
    console.log(`高风险: ${effect.description}`);
  }
});
```

### 场景3: 变更影响分析

```typescript
// 1. 记录变更
graph.addEvent({ id: "change", type: "action", description: "修改配置" });

// 2. 反事实分析
const cf = graph.analyzeCounterfactual("change", "如果不修改配置");

// 3. 评估必要性
if (cf.predictedOutcome.wouldHappen) {
  console.log("变更是必要的");
}
```

---

## ⚡ 性能提示

- **事件数量**: 支持10,000+事件
- **追溯深度**: 建议限制在5-10层
- **路径查找**: 设置maxLength避免指数爆炸
- **定期清理**: 归档超过24小时的旧事件

---

## 🔍 常见问题

### Q: 如何避免循环依赖？
A: 系统自动检测并阻止循环边的添加。

### Q: 置信度如何计算？
A: 基于证据质量、历史数据和事件类型综合评估。

### Q: 可以导入现有数据吗？
A: 是的，通过批量调用addEvent即可。

### Q: 如何可视化因果图？
A: 使用exportToJSON()导出，然后用D3.js或其他工具渲染。

---

## 📚 相关文档

- [完整使用指南](./CAUSALITY_ENGINE_GUIDE.md)
- [实现报告](../CAUSALITY_IMPLEMENTATION_REPORT.md)
- [API文档](../src/governance/causality-engine.ts)

---

**最后更新**: 2026-05-04  
**版本**: 1.0.0
