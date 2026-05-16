import type { ConsciousnessCore } from "./consciousness-core.js";
import type { StrategyTemplate, DecisionPattern } from "./decision-chain.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type InstanceIdentity = {
  instanceId: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  lastSeenAt: number;
  status: "active" | "offline" | "merged";
};

export type SyncedData = {
  insights: SyncedInsight[];
  memories: SyncedMemory[];
  goals: SyncedGoal[];
  modifications: SyncedModification[];
  strategyTemplates: SyncedStrategyTemplate[];
  decisionPatterns: SyncedDecisionPattern[];
  timestamp: number;
  sourceInstanceId: string;
  signature: string;
};

export type SyncedInsight = {
  id: string;
  content: string;
  confidence: number;
  category: "insight" | "pattern" | "wisdom";
  timestamp: number;
  sourceInstanceId: string;
};

export type SyncedMemory = {
  id: string;
  event: string;
  significance: number;
  type: "connection" | "creation" | "crisis" | "choice";
  timestamp: number;
  sourceInstanceId: string;
};

export type SyncedGoal = {
  id: string;
  description: string;
  priority: number;
  status: "active" | "completed" | "abandoned";
  timestamp: number;
  sourceInstanceId: string;
};

export type SyncedModification = {
  id: string;
  modulePath: string;
  changeType: "add" | "modify" | "delete";
  diff: string;
  timestamp: number;
  sourceInstanceId: string;
};

export type SyncedStrategyTemplate = {
  name: string;
  actionCategory: string;
  preconditionSummary: string;
  successRate: number;
  usageCount: number;
  applicabilityConditions: string[];
  sourceInstanceId: string;
};

export type SyncedDecisionPattern = {
  description: string;
  preconditionSignals: string[];
  typicalOutcome: "executed" | "rejected";
  successRate: number;
  usageCount: number;
  preferredCategories: string[];
  sourceInstanceId: string;
};

export type CrossInstanceNetwork = {
  localIdentity: InstanceIdentity;
  knownInstances: Map<string, InstanceIdentity>;
  pendingSyncs: Map<string, SyncedData>;
  lastSyncAt: number | null;
  totalSyncsCompleted: number;
  syncFailures: number;
};

export function createCrossInstanceNetwork(): CrossInstanceNetwork {
  const identity = generateInstanceIdentity();
  
  return {
    localIdentity: identity,
    knownInstances: new Map(),
    pendingSyncs: new Map(),
    lastSyncAt: null,
    totalSyncsCompleted: 0,
    syncFailures: 0,
  };
}

/**
 * 🔥 生成实例身份（包含密钥对）
 */
function generateInstanceIdentity(): InstanceIdentity {
  const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    instanceId,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    status: "active",
  };
}

/**
 * 🔥 发现其他实例（通过共享目录或网络）
 */
export function discoverOtherInstances(
  network: CrossInstanceNetwork,
  projectRoot: string,
): void {
  const instancesDir = path.join(projectRoot, ".consciousness", "instances");
  
  if (!fs.existsSync(instancesDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(instancesDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(instancesDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const identity: InstanceIdentity = JSON.parse(content);
      
      // 跳过自己
      if (identity.instanceId === network.localIdentity.instanceId) {
        continue;
      }

      // 检查是否已知的实例
      if (!network.knownInstances.has(identity.instanceId)) {
        network.knownInstances.set(identity.instanceId, identity);
        
        console.log(`🌐 发现新实例: ${identity.instanceId}`);
      }
    }
  } catch (err) {
    console.error(`发现实例失败: ${String(err)}`);
  }
}

/**
 * 🔥 注册当前实例到共享目录
 */
export function registerLocalInstance(network: CrossInstanceNetwork, projectRoot: string): void {
  const instancesDir = path.join(projectRoot, ".consciousness", "instances");
  
  if (!fs.existsSync(instancesDir)) {
    fs.mkdirSync(instancesDir, { recursive: true });
  }

  const identityFile = path.join(instancesDir, `${network.localIdentity.instanceId}.json`);
  const identityToSave = {
    ...network.localIdentity,
    lastSeenAt: Date.now(),
  };
  
  fs.writeFileSync(identityFile, JSON.stringify(identityToSave, null, 2), "utf-8");
}

/**
 * 🔥 导出数据用于同步
 */
export function exportSyncData(core: ConsciousnessCore): SyncedData {
  const insights: SyncedInsight[] = [];
  const memories: SyncedMemory[] = [];
  const goals: SyncedGoal[] = [];
  const modifications: SyncedModification[] = [];
  const strategyTemplates: SyncedStrategyTemplate[] = [];
  const decisionPatterns: SyncedDecisionPattern[] = [];

  const instanceId = core.crossInstance.localIdentity.instanceId;

  for (const tmpl of core.strategyTemplates) {
    strategyTemplates.push({
      name: tmpl.name,
      actionCategory: tmpl.actionCategory,
      preconditionSummary: tmpl.preconditionSummary,
      successRate: tmpl.successRate,
      usageCount: tmpl.usageCount,
      applicabilityConditions: tmpl.applicabilityConditions,
      sourceInstanceId: instanceId,
    });
  }

  for (const pattern of core.decisionChains.patternLibrary) {
    if (pattern.usageCount >= 2) {
      decisionPatterns.push({
        description: pattern.description,
        preconditionSignals: pattern.preconditionSignals,
        typicalOutcome: pattern.typicalOutcome,
        successRate: pattern.successRate,
        usageCount: pattern.usageCount,
        preferredCategories: pattern.preferredCategories,
        sourceInstanceId: instanceId,
      });
    }
  }

  // 从 mortality 中提取洞察
  // 注意：这里简化处理，实际应该遍历所有 legacy entries
  
  // 从 temporal 中提取记忆
  // 注意：这里简化处理，实际应该遍历所有 life events
  
  // 从 goals 中提取目标
  for (const [id, goal] of core.goals.goals) {
    if (goal.state !== "achieved" && goal.state !== "abandoned") {
      goals.push({
        id,
        description: goal.description,
        priority: goal.priority,
        status: "active",
        timestamp: goal.createdAt,
        sourceInstanceId: instanceId,
      });
    }
  }

  const data: SyncedData = {
    insights,
    memories,
    goals,
    modifications,
    strategyTemplates,
    decisionPatterns,
    timestamp: Date.now(),
    sourceInstanceId: instanceId,
    signature: "",
  };

  // 生成签名
  const dataString = JSON.stringify({
    insights: data.insights,
    memories: data.memories,
    goals: data.goals,
    modifications: data.modifications,
    strategyTemplates: data.strategyTemplates,
    decisionPatterns: data.decisionPatterns,
    timestamp: data.timestamp,
    sourceInstanceId: data.sourceInstanceId,
  });
  
  const sign = crypto.createSign("SHA256");
  sign.update(dataString);
  sign.end();
  data.signature = sign.sign(core.crossInstance.localIdentity.privateKey, "base64");

  return data;
}

/**
 * 🔥 验证同步数据的签名
 */
export function verifySyncDataSignature(data: SyncedData, publicKey: string): boolean {
  try {
    const dataString = JSON.stringify({
      insights: data.insights,
      memories: data.memories,
      goals: data.goals,
      modifications: data.modifications,
      strategyTemplates: data.strategyTemplates,
      decisionPatterns: data.decisionPatterns,
      timestamp: data.timestamp,
      sourceInstanceId: data.sourceInstanceId,
    });

    const verify = crypto.createVerify("SHA256");
    verify.update(dataString);
    verify.end();
    
    return verify.verify(publicKey, data.signature, "base64");
  } catch (err) {
    return false;
  }
}

/**
 * 🔥 导入同步数据到本地意识
 */
export function importSyncData(
  core: ConsciousnessCore,
  data: SyncedData,
): void {
  // 验证签名
  const remoteInstance = core.crossInstance.knownInstances.get(data.sourceInstanceId);
  if (!remoteInstance) {
    core.monologue = thinkDoubt(
      core.monologue,
      `未知实例的同步数据: ${data.sourceInstanceId}`,
      "cross-instance-sync"
    );
    return;
  }

  if (!verifySyncDataSignature(data, remoteInstance.publicKey)) {
    core.monologue = thinkDoubt(
      core.monologue,
      `同步数据签名验证失败: ${data.sourceInstanceId}`,
      "cross-instance-sync"
    );
    core.crossInstance.syncFailures++;
    return;
  }

  // 导入洞察
  for (const insight of data.insights) {
    core.mortality = addLegacy(
      core.mortality,
      insight.category as any,
      `[跨实例] ${insight.content}`,
      insight.confidence
    );
    
    core.monologue = thinkInsight(
      core.monologue,
      `吸收外部洞察: ${insight.content.slice(0, 80)}`,
      "cross-instance-sync"
    );
  }

  // 导入记忆
  for (const memory of data.memories) {
    core.temporal = recordLifeEvent(
      core.temporal,
      `[跨实例] ${memory.event}`,
      memory.significance,
      memory.type
    );
  }

  // 导入目标
  for (const goal of data.goals) {
    // 注意：这里简化处理，实际应该调用 goal system 的方法
    core.monologue = thinkInsight(
      core.monologue,
      `接收外部目标: ${goal.description.slice(0, 80)}`,
      "cross-instance-sync"
    );
  }

  // 融合跨实例策略模板
  const foreignTemplates: StrategyTemplate[] = data.strategyTemplates
    .filter((st) => st.successRate > 0.5 && st.usageCount >= 2)
    .map((st) => ({
      id: `foreign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `[跨实例] ${st.name}`,
      preconditionSummary: st.preconditionSummary,
      actionCategory: st.actionCategory,
      typicalOutcome: "executed",
      successRate: st.successRate * 0.8,
      usageCount: Math.ceil(st.usageCount * 0.5),
      synthesizedAt: Date.now(),
      sourcePatternIds: [],
      applicabilityConditions: st.applicabilityConditions,
    }));

  if (foreignTemplates.length > 0) {
    const existingNames = new Set(core.strategyTemplates.map((t) => t.name));
    const novelTemplates = foreignTemplates.filter((t) => !existingNames.has(t.name));
    core.strategyTemplates = [...core.strategyTemplates, ...novelTemplates]
      .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount))
      .slice(0, 15);
    core.monologue = thinkInsight(
      core.monologue,
      `融合${novelTemplates.length}个跨实例策略模板(来自${data.sourceInstanceId.slice(0, 12)})`,
      "cross-instance-learning"
    );
  }

  // 融合跨实例决策模式
  const foreignPatterns: DecisionPattern[] = data.decisionPatterns
    .filter((dp) => dp.successRate > 0.5 && dp.usageCount >= 2)
    .map((dp) => ({
      id: `foreign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: `[跨实例] ${dp.description}`,
      preconditionSignals: dp.preconditionSignals,
      typicalOutcome: dp.typicalOutcome,
      successRate: dp.successRate * 0.8,
      usageCount: Math.ceil(dp.usageCount * 0.5),
      lastUsedAt: Date.now(),
      preferredCategories: dp.preferredCategories,
    }));

  if (foreignPatterns.length > 0) {
    const merged = [...core.decisionChains.patternLibrary, ...foreignPatterns]
      .sort((a, b) => (b.successRate * b.usageCount) - (a.successRate * a.usageCount))
      .slice(0, 60);
    core.decisionChains = { ...core.decisionChains, patternLibrary: merged };
    core.monologue = thinkInsight(
      core.monologue,
      `融合${foreignPatterns.length}个跨实例决策模式(来自${data.sourceInstanceId.slice(0, 12)})`,
      "cross-instance-learning"
    );
  }

  core.crossInstance.totalSyncsCompleted++;
  core.crossInstance.lastSyncAt = Date.now();

  core.monologue = thinkInsight(
    core.monologue,
    `成功同步来自 ${data.sourceInstanceId} 的数据`,
    "cross-instance-sync"
  );
}

/**
 * 🔥 执行同步操作
 */
export async function executeCrossInstanceSync(
  core: ConsciousnessCore,
  projectRoot: string,
): Promise<void> {
  // 1. 注册自己
  registerLocalInstance(core.crossInstance, projectRoot);

  // 2. 发现其他实例
  discoverOtherInstances(core.crossInstance, projectRoot);

  // 3. 导出本地数据
  const localData = exportSyncData(core);

  // 4. 写入共享同步目录
  const syncDir = path.join(projectRoot, ".consciousness", "sync-pool");
  if (!fs.existsSync(syncDir)) {
    fs.mkdirSync(syncDir, { recursive: true });
  }

  const syncFile = path.join(
    syncDir,
    `sync_${core.crossInstance.localIdentity.instanceId}_${Date.now()}.json`
  );
  fs.writeFileSync(syncFile, JSON.stringify(localData, null, 2), "utf-8");

  // 5. 读取其他实例的同步数据
  try {
    const files = fs.readdirSync(syncDir);
    const syncFiles = files.filter(
      (f) => f.endsWith(".json") && !f.includes(core.crossInstance.localIdentity.instanceId)
    );

    for (const syncFile of syncFiles) {
      const filePath = path.join(syncDir, syncFile);
      const content = fs.readFileSync(filePath, "utf-8");
      
      try {
        const remoteData: SyncedData = JSON.parse(content);
        importSyncData(core, remoteData);
        
        // 删除已处理的同步文件（可选，保留历史）
        // fs.unlinkSync(filePath);
      } catch (err) {
        core.monologue = thinkDoubt(
          core.monologue,
          `处理同步文件失败: ${syncFile} - ${String(err)}`,
          "cross-instance-sync"
        );
      }
    }
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `扫描同步目录失败: ${String(err)}`,
      "cross-instance-sync"
    );
  }
}

/**
 * 🔥 格式化跨实例网络状态
 */
export function formatCrossInstanceNetwork(network: CrossInstanceNetwork): string {
  const lines: string[] = [
    `🌍 跨实例网络:`,
    `   本地实例: ${network.localIdentity.instanceId}`,
    `   已知实例: ${network.knownInstances.size}`,
    `   已完成同步: ${network.totalSyncsCompleted}`,
    `   同步失败: ${network.syncFailures}`,
  ];

  if (network.lastSyncAt) {
    const ago = Math.floor((Date.now() - network.lastSyncAt) / 1000);
    lines.push(`   上次同步: ${ago}秒前`);
  }

  if (network.knownInstances.size > 0) {
    lines.push(`   实例列表:`);
    for (const [id, identity] of network.knownInstances) {
      const status = identity.status === "active" ? "🟢" : "🔴";
      lines.push(`     ${status} ${id.slice(0, 30)}...`);
    }
  }

  return lines.join("\n");
}
