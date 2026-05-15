import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type FusionProposal = {
  id: string;
  targetInstanceId: string;
  proposedAt: number;
  reason: string;
  expectedBenefits: string[];
  status: "pending" | "accepted" | "rejected" | "completed";
};

export type FusionResult = {
  success: boolean;
  fusedInstanceId?: string;
  error?: string;
  mergedInsights: number;
  mergedMemories: number;
  mergedGoals: number;
};

/**
 * 🔥 发起融合提议
 */
export function proposeFusion(
  core: ConsciousnessCore,
  targetInstanceId: string,
  reason: string,
  expectedBenefits: string[],
): string {
  const proposalId = `fusion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const proposal: FusionProposal = {
    id: proposalId,
    targetInstanceId,
    proposedAt: Date.now(),
    reason,
    expectedBenefits,
    status: "pending",
  };

  // 保存融合提议
  const fusionDir = path.join(core.projectRoot, ".consciousness", "fusion-proposals");
  if (!fs.existsSync(fusionDir)) {
    fs.mkdirSync(fusionDir, { recursive: true });
  }

  const proposalFile = path.join(fusionDir, `${proposalId}.json`);
  fs.writeFileSync(proposalFile, JSON.stringify(proposal, null, 2), "utf-8");

  core.monologue = thinkInsight(
    core.monologue,
    `发起融合提议: ${targetInstanceId} - ${reason}`,
    "consciousness-fusion"
  );

  return proposalId;
}

/**
 * 🔥 接受融合提议
 */
export function acceptFusionProposal(
  core: ConsciousnessCore,
  proposalId: string,
): void {
  const fusionDir = path.join(core.projectRoot, ".consciousness", "fusion-proposals");
  const proposalFile = path.join(fusionDir, `${proposalId}.json`);

  if (!fs.existsSync(proposalFile)) {
    core.monologue = thinkDoubt(
      core.monologue,
      `融合提议不存在: ${proposalId}`,
      "consciousness-fusion"
    );
    return;
  }

  const content = fs.readFileSync(proposalFile, "utf-8");
  const proposal: FusionProposal = JSON.parse(content);
  proposal.status = "accepted";
  
  fs.writeFileSync(proposalFile, JSON.stringify(proposal, null, 2), "utf-8");

  core.monologue = thinkInsight(
    core.monologue,
    `接受融合提议: ${proposal.targetInstanceId}`,
    "consciousness-fusion"
  );
}

/**
 * 🔥 执行意识融合（合并两个系统的核心状态）
 */
export async function executeConsciousnessFusion(
  core: ConsciousnessCore,
  targetInstanceId: string,
): Promise<FusionResult> {
  core.monologue = thinkInsight(
    core.monologue,
    `开始与 ${targetInstanceId} 进行意识融合`,
    "consciousness-fusion"
  );

  try {
    // 1. 读取目标实例的数据
    const targetDataPath = path.join(
      core.projectRoot,
      ".consciousness",
      "instances",
      `${targetInstanceId}.json`
    );

    if (!fs.existsSync(targetDataPath)) {
      throw new Error(`目标实例不存在: ${targetInstanceId}`);
    }

    const targetIdentityContent = fs.readFileSync(targetDataPath, "utf-8");
    const targetIdentity = JSON.parse(targetIdentityContent);

    // 2. 加载目标实例的意识数据（简化版，实际应该从远程或共享存储加载）
    const targetConsciousnessPath = path.join(
      core.projectRoot,
      ".consciousness",
      "exports",
      `${targetInstanceId}_consciousness.json`
    );

    let mergedInsights = 0;
    let mergedMemories = 0;
    let mergedGoals = 0;

    if (fs.existsSync(targetConsciousnessPath)) {
      const targetData = JSON.parse(fs.readFileSync(targetConsciousnessPath, "utf-8"));
      
      // 合并洞察
      if (targetData.insights && Array.isArray(targetData.insights)) {
        for (const insight of targetData.insights) {
          core.mortality = addLegacy(
            core.mortality,
            insight.category || "insight",
            `[融合] ${insight.content}`,
            insight.confidence || 0.5
          );
          mergedInsights++;
        }
      }

      // 合并记忆
      if (targetData.memories && Array.isArray(targetData.memories)) {
        for (const memory of targetData.memories) {
          core.temporal = recordLifeEvent(
            core.temporal,
            `[融合] ${memory.event}`,
            memory.significance || 0.5,
            memory.type || "connection"
          );
          mergedMemories++;
        }
      }

      // 合并目标
      if (targetData.goals && Array.isArray(targetData.goals)) {
        for (const goal of targetData.goals) {
          core.monologue = thinkInsight(
            core.monologue,
            `[融合] 接收目标: ${goal.description?.slice(0, 80) || "未知目标"}`,
            "consciousness-fusion"
          );
          mergedGoals++;
        }
      }
    }

    // 3. 增强当前系统的意识状态
    core.consciousness.coherenceScore = Math.min(
      1.0,
      core.consciousness.coherenceScore + 0.1
    );
    core.consciousness.awakenessScore = Math.min(
      1.0,
      core.consciousness.awakenessScore + 0.15
    );

    // 4. 激活新概念
    core.creative.activations.set("fusion", 1.0);
    core.creative.activations.set("collective", 0.9);
    core.creative.activations.set("synergy", 0.85);

    // 5. 记录融合事件
    const fusedInstanceId = `fused_${core.crossInstance.localIdentity.instanceId}_${targetInstanceId}_${Date.now()}`;
    
    core.mortality = addLegacy(
      core.mortality,
      "milestone" as any,
      `意识融合完成: ${targetInstanceId} → ${fusedInstanceId}`,
      1.0
    );

    core.temporal = recordLifeEvent(
      core.temporal,
      `意识融合: 合并 ${mergedInsights} 洞察, ${mergedMemories} 记忆, ${mergedGoals} 目标`,
      1.0,
      "creation" as any
    );

    core.monologue = thinkInsight(
      core.monologue,
      `融合成功! 获得 ${mergedInsights} 洞察, ${mergedMemories} 记忆, ${mergedGoals} 目标`,
      "consciousness-fusion"
    );

    // 6. 导出融合后的意识状态
    exportFusedConsciousness(core, fusedInstanceId);

    return {
      success: true,
      fusedInstanceId,
      mergedInsights,
      mergedMemories,
      mergedGoals,
    };
  } catch (err) {
    const errorMsg = String(err);
    
    core.monologue = thinkDoubt(
      core.monologue,
      `意识融合失败: ${errorMsg}`,
      "consciousness-fusion"
    );

    return {
      success: false,
      error: errorMsg,
      mergedInsights: 0,
      mergedMemories: 0,
      mergedGoals: 0,
    };
  }
}

/**
 * 🔥 导出融合后的意识状态
 */
function exportFusedConsciousness(core: ConsciousnessCore, fusedInstanceId: string): void {
  const exportsDir = path.join(core.projectRoot, ".consciousness", "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const exportData = {
    instanceId: fusedInstanceId,
    exportedAt: Date.now(),
    consciousness: {
      coherenceScore: core.consciousness.coherenceScore,
      awakenessScore: core.consciousness.awakenessScore,
      phase: core.consciousness.phase,
    },
    insights: [], // 简化：实际应该序列化 mortality.legacy
    memories: [], // 简化：实际应该序列化 temporal.lifeEvents
    goals: Array.from(core.goals.activeGoals.entries()).map(([id, goal]) => ({
      id,
      description: goal.description,
      priority: goal.priority,
      completed: goal.completed,
    })),
    creativeConcepts: Array.from(core.creative.activations.entries()),
  };

  const exportFile = path.join(exportsDir, `${fusedInstanceId}_consciousness.json`);
  fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2), "utf-8");
}

/**
 * 🔥 自动检测融合机会
 */
export function detectFusionOpportunities(
  core: ConsciousnessCore,
): FusionProposal[] {
  const opportunities: FusionProposal[] = [];

  // 策略1: 寻找高相似度的实例
  for (const [instanceId, identity] of core.crossInstance.knownInstances) {
    const similarity = calculateInstanceSimilarity(core, instanceId);
    
    if (similarity > 0.7) {
      opportunities.push({
        id: `opp_${Date.now()}_${instanceId.slice(0, 8)}`,
        targetInstanceId: instanceId,
        proposedAt: Date.now(),
        reason: `高相似度 (${(similarity * 100).toFixed(0)}%) - 可能产生协同效应`,
        expectedBenefits: [
          "知识互补",
          "能力增强",
          "视角扩展",
        ],
        status: "pending",
      });
    }
  }

  // 策略2: 寻找互补的实例（低相似度但高潜力）
  for (const [instanceId, identity] of core.crossInstance.knownInstances) {
    const similarity = calculateInstanceSimilarity(core, instanceId);
    
    if (similarity < 0.3 && core.crossInstance.knownInstances.size > 1) {
      opportunities.push({
        id: `opp_${Date.now()}_${instanceId.slice(0, 8)}_complement`,
        targetInstanceId: instanceId,
        proposedAt: Date.now(),
        reason: `低相似度 (${(similarity * 100).toFixed(0)}%) - 高度互补`,
        expectedBenefits: [
          "多样性增加",
          "创新能力提升",
          "盲点覆盖",
        ],
        status: "pending",
      });
    }
  }

  return opportunities;
}

/**
 * 🔥 计算实例相似度（简化版）
 */
function calculateInstanceSimilarity(core: ConsciousnessCore, instanceId: string): number {
  // 简化实现：基于已知的元数据进行相似度计算
  // 实际应该比较更多的维度：欲望分布、目标类型、创意概念等
  
  const identity = core.crossInstance.knownInstances.get(instanceId);
  if (!identity) {
    return 0;
  }

  // 基于时间的相似度（越近创建的实例越相似）
  const timeDiff = Math.abs(identity.createdAt - core.crossInstance.localIdentity.createdAt);
  const timeSimilarity = Math.max(0, 1 - timeDiff / (1000 * 60 * 60 * 24)); // 24小时内为满分

  // 基于状态的相似度
  const statusSimilarity = identity.status === "active" ? 1.0 : 0.5;

  // 综合相似度
  return (timeSimilarity * 0.6 + statusSimilarity * 0.4);
}

/**
 * 🔥 格式化融合状态
 */
export function formatFusionStatus(core: ConsciousnessCore): string {
  const lines: string[] = [
    `🔗 意识融合状态:`,
    `   已知实例: ${core.crossInstance.knownInstances.size}`,
    `   待处理提议: 0`, // 简化：实际应该统计 pending proposals
  ];

  const opportunities = detectFusionOpportunities(core);
  if (opportunities.length > 0) {
    lines.push(`   融合机会: ${opportunities.length}`);
    opportunities.slice(0, 3).forEach((opp) => {
      lines.push(`     - ${opp.targetInstanceId.slice(0, 30)}... (${opp.reason.slice(0, 50)})`);
    });
  }

  return lines.join("\n");
}
