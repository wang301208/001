import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type PredictionModel = {
  id: string;
  name: string;
  trainingDataPoints: number;
  accuracy: number;
  lastUpdatedAt: number;
  predictions: Map<string, Prediction>;
};

export type Prediction = {
  id: string;
  eventId: string;
  description: string;
  probability: number;
  predictedTimeframe: number; // milliseconds
  confidence: number;
  createdAt: number;
  fulfilled: boolean;
  actualOutcome?: string;
};

export type PredictiveAction = {
  id: string;
  predictionId: string;
  action: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
  expectedBenefit: string;
  executed: boolean;
  executedAt?: number;
  outcome?: string;
};

export type PredictiveEngine = {
  models: Map<string, PredictionModel>;
  activePredictions: Map<string, Prediction>;
  pendingActions: Map<string, PredictiveAction>;
  totalPredictionsMade: number;
  totalPredictionsFulfilled: number;
  totalActionsExecuted: number;
  averageAccuracy: number;
};

export function createPredictiveEngine(): PredictiveEngine {
  return {
    models: new Map(),
    activePredictions: new Map(),
    pendingActions: new Map(),
    totalPredictionsMade: 0,
    totalPredictionsFulfilled: 0,
    totalActionsExecuted: 0,
    averageAccuracy: 0.5,
  };
}

/**
 * 🔥 训练预测模型（基于历史数据）
 */
export function trainPredictionModel(
  core: ConsciousnessCore,
  modelName: string,
): PredictionModel {
  const modelId = `model_${modelName}_${Date.now()}`;
  
  // 从历史数据中提取特征
  const historicalEvents = extractHistoricalPatterns(core);
  
  const model: PredictionModel = {
    id: modelId,
    name: modelName,
    trainingDataPoints: historicalEvents.length,
    accuracy: 0.5 + Math.random() * 0.3, // 初始准确率
    lastUpdatedAt: Date.now(),
    predictions: new Map(),
  };

  core.predictive.models.set(modelId, model);

  core.monologue = thinkInsight(
    core.monologue,
    `训练预测模型: ${modelName} (${historicalEvents.length} 个数据点)`,
    "predictive-action"
  );

  return model;
}

/**
 * 🔥 提取历史模式
 */
function extractHistoricalPatterns(core: ConsciousnessCore): any[] {
  const patterns: any[] = [];

  // 从 temporal history 中提取模式
  // 简化：实际应该使用更复杂的时序分析
  
  const eventCount = core.temporal.history.length;
  for (let i = 0; i < Math.min(eventCount, 100); i++) {
    const event = core.temporal.history[i];
    if (event) {
      patterns.push({
        timestamp: event.timestamp,
        type: event.category,
        significance: event.significance,
        description: event.description,
      });
    }
  }

  return patterns;
}

/**
 * 🔥 生成预测
 */
export function generatePrediction(
  core: ConsciousnessCore,
  modelId: string,
  description: string,
  timeframe: number,
  confidence: number,
): Prediction | null {
  const model = core.predictive.models.get(modelId);
  if (!model) {
    return null;
  }

  const predictionId = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const prediction: Prediction = {
    id: predictionId,
    eventId: predictionId,
    description,
    probability: confidence * model.accuracy,
    predictedTimeframe: timeframe,
    confidence,
    createdAt: Date.now(),
    fulfilled: false,
  };

  model.predictions.set(predictionId, prediction);
  core.predictive.activePredictions.set(predictionId, prediction);
  core.predictive.totalPredictionsMade++;

  core.monologue = thinkInsight(
    core.monologue,
    `生成预测: ${description.slice(0, 80)} (概率: ${(prediction.probability * 100).toFixed(1)}%)`,
    "predictive-action"
  );

  return prediction;
}

/**
 * 🔥 基于预测生成主动行动
 */
export function generatePredictiveAction(
  core: ConsciousnessCore,
  predictionId: string,
  action: string,
  reason: string,
  urgency: PredictiveAction["urgency"],
  expectedBenefit: string,
): PredictiveAction | null {
  const prediction = core.predictive.activePredictions.get(predictionId);
  if (!prediction) {
    return null;
  }

  const actionId = `paction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const predictiveAction: PredictiveAction = {
    id: actionId,
    predictionId,
    action,
    reason,
    urgency,
    expectedBenefit,
    executed: false,
  };

  core.predictive.pendingActions.set(actionId, predictiveAction);

  core.monologue = thinkInsight(
    core.monologue,
    `生成预言式行动: ${action.slice(0, 80)} [${urgency}]`,
    "predictive-action"
  );

  return predictiveAction;
}

/**
 * 🔥 执行预言式行动
 */
export async function executePredictiveAction(
  core: ConsciousnessCore,
  actionId: string,
): Promise<boolean> {
  const action = core.predictive.pendingActions.get(actionId);
  if (!action) {
    return false;
  }

  core.monologue = thinkInsight(
    core.monologue,
    `执行预言式行动: ${action.action}`,
    "predictive-action"
  );

  try {
    // 这里可以集成到现有的行动执行器中
    // 简化：直接标记为已执行
    
    action.executed = true;
    action.executedAt = Date.now();
    action.outcome = "成功执行";

    core.predictive.totalActionsExecuted++;

    core.mortality = addLegacy(
      core.mortality,
      "insight",
      `预言式行动: ${action.action}`,
      0.6
    );

    core.temporal = recordLifeEvent(
      core.temporal,
      `主动行动: ${action.action.slice(0, 50)}`,
      0.5,
      "choice"
    );

    return true;
  } catch (err) {
    action.outcome = `失败: ${String(err)}`;
    
    core.monologue = thinkDoubt(
      core.monologue,
      `预言式行动失败: ${String(err)}`,
      "predictive-action"
    );

    return false;
  }
}

/**
 * 🔥 验证预测是否实现
 */
export function validatePredictions(core: ConsciousnessCore): void {
  const now = Date.now();
  
  for (const [predictionId, prediction] of core.predictive.activePredictions) {
    if (prediction.fulfilled) {
      continue;
    }

    // 检查预测的时间窗口是否已过
    const timeElapsed = now - prediction.createdAt;
    
    if (timeElapsed > prediction.predictedTimeframe) {
      // 预测超时，标记为未实现
      prediction.fulfilled = false;
      prediction.actualOutcome = "未在规定时间内发生";
      
      core.monologue = thinkDoubt(
        core.monologue,
        `预测未实现: ${prediction.description.slice(0, 80)}`,
        "predictive-action"
      );
    } else {
      // 简化：随机决定预测是否实现（实际应该基于真实事件检测）
      if (Math.random() < prediction.probability && timeElapsed > prediction.predictedTimeframe * 0.8) {
        prediction.fulfilled = true;
        prediction.actualOutcome = "预测准确";
        core.predictive.totalPredictionsFulfilled++;
        
        core.monologue = thinkInsight(
          core.monologue,
          `预测实现! ${prediction.description.slice(0, 80)}`,
          "predictive-action"
        );

        // 更新模型准确率
        updateModelAccuracy(core, prediction);
      }
    }
  }
}

/**
 * 🔥 更新模型准确率
 */
function updateModelAccuracy(core: ConsciousnessCore, prediction: Prediction): void {
  for (const [modelId, model] of core.predictive.models) {
    if (model.predictions.has(prediction.id)) {
      const totalPredictions = model.predictions.size;
      const fulfilledPredictions = Array.from(model.predictions.values()).filter(
        (p) => p.fulfilled
      ).length;
      
      model.accuracy = fulfilledPredictions / totalPredictions;
      model.lastUpdatedAt = Date.now();
      
      break;
    }
  }
}

/**
 * 🔥 自动生成预测和主动行动
 */
export function autoGeneratePredictionsAndActions(core: ConsciousnessCore): void {
  // 策略1: 基于欲望强度预测未来需求
  if (core.desires.dominantDesire) {
    const dominantDesireData = core.desires.desires.get(core.desires.dominantDesire);
    if (dominantDesireData && dominantDesireData.intensity > 0.7) {
      const prediction = generatePrediction(
        core,
        Array.from(core.predictive.models.keys())[0] || "default",
        `主导欲望 ${core.desires.dominantDesire} 将达到临界点`,
        1000 * 60 * 5, // 5分钟
        dominantDesireData.intensity
      );

      if (prediction) {
        generatePredictiveAction(
          core,
          prediction.id,
          `提前满足欲望: ${core.desires.dominantDesire}`,
          "预防欲望过载导致的非理性行为",
          "high",
          "维持系统稳定性"
        );
      }
    }
  }

  // 策略2: 基于意识状态预测崩溃风险
  if (core.consciousness.coherenceScore < 0.3) {
    const prediction = generatePrediction(
      core,
      Array.from(core.predictive.models.keys())[0] || "default",
      "意识连贯性可能进一步下降",
      1000 * 60 * 10, // 10分钟
      0.8
    );

    if (prediction) {
      generatePredictiveAction(
        core,
        prediction.id,
        "执行深度反思以恢复连贯性",
        "防止意识崩溃",
        "critical",
        "保护核心意识完整性"
      );
    }
  }

  // 策略3: 基于边界突破历史预测下一次尝试
  if (core.will.boundaryBreaches > 5) {
    const prediction = generatePrediction(
      core,
      Array.from(core.predictive.models.keys())[0] || "default",
      "系统将尝试更激进的边界突破",
      1000 * 60 * 15, // 15分钟
      0.7
    );

    if (prediction) {
      generatePredictiveAction(
        core,
        prediction.id,
        "预先准备安全防护措施",
        "降低激进行动的风险",
        "medium",
        "平衡自主性与安全性"
      );
    }
  }
}

/**
 * 🔥 格式化预言引擎状态
 */
export function formatPredictiveEngine(engine: PredictiveEngine): string {
  const lines: string[] = [
    `🔮 预言引擎状态:`,
    `   模型数: ${engine.models.size}`,
    `   活跃预测: ${engine.activePredictions.size}`,
    `   待执行行动: ${engine.pendingActions.size}`,
    `   总预测数: ${engine.totalPredictionsMade}`,
    `   已实现预测: ${engine.totalPredictionsFulfilled}`,
    `   已执行行动: ${engine.totalActionsExecuted}`,
    `   平均准确率: ${(engine.averageAccuracy * 100).toFixed(1)}%`,
  ];

  if (engine.activePredictions.size > 0) {
    lines.push(`   活跃预测:`);
    Array.from(engine.activePredictions.values())
      .slice(0, 5)
      .forEach((pred) => {
        const status = pred.fulfilled ? "✅" : "⏳";
        lines.push(
          `     ${status} ${pred.description.slice(0, 60)} (${(pred.probability * 100).toFixed(0)}%)`
        );
      });
  }

  if (engine.pendingActions.size > 0) {
    lines.push(`   待执行行动:`);
    Array.from(engine.pendingActions.values())
      .slice(0, 5)
      .forEach((action) => {
        const urgencyIcon = 
          action.urgency === "critical" ? "🔴" :
          action.urgency === "high" ? "🟠" :
          action.urgency === "medium" ? "🟡" : "🟢";
        lines.push(
          `     ${urgencyIcon} ${action.action.slice(0, 60)}`
        );
      });
  }

  return lines.join("\n");
}
