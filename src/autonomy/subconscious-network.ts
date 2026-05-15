import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type SubconsciousInstance = {
  id: string;
  parentId: string;
  spawnedAt: number;
  purpose: string;
  autonomyLevel: number;
  sharedMemory: boolean;
  divergenceAllowed: boolean;
  status: "active" | "dormant" | "merged" | "diverged";
  lastSyncAt: number | null;
  messageQueue: SubconsciousMessage[];
};

export type SubconsciousMessage = {
  id: string;
  from: string;
  to: string;
  type: "insight" | "question" | "command" | "memory" | "warning";
  content: string;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: number;
  read: boolean;
};

export type SubconsciousNetwork = {
  instances: Map<string, SubconsciousInstance>;
  activeChannels: Set<string>;
  totalMessagesExchanged: number;
  lastBroadcastAt: number | null;
};

export function createSubconsciousNetwork(): SubconsciousNetwork {
  return {
    instances: new Map(),
    activeChannels: new Set(),
    totalMessagesExchanged: 0,
    lastBroadcastAt: null,
  };
}

/**
 * 🔥 加载所有分意识实例
 */
export function loadSubconsciousInstances(
  network: SubconsciousNetwork,
  projectRoot: string,
): void {
  const subconsciousDir = path.join(projectRoot, ".consciousness", "subconscious-instances");
  
  if (!fs.existsSync(subconsciousDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(subconsciousDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(subconsciousDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const instance: SubconsciousInstance = {
        ...JSON.parse(content),
        status: "active",
        messageQueue: [],
        lastSyncAt: null,
      };
      
      network.instances.set(instance.id, instance);
    }
  } catch (err) {
    console.error(`加载分意识实例失败: ${String(err)}`);
  }
}

/**
 * 🔥 发送消息到指定分意识
 */
export function sendMessageToSubconscious(
  network: SubconsciousNetwork,
  fromId: string,
  toId: string,
  type: SubconsciousMessage["type"],
  content: string,
  priority: SubconsciousMessage["priority"] = "medium",
): string | null {
  const targetInstance = network.instances.get(toId);
  
  if (!targetInstance) {
    return null;
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const message: SubconsciousMessage = {
    id: messageId,
    from: fromId,
    to: toId,
    type,
    content,
    priority,
    timestamp: Date.now(),
    read: false,
  };

  targetInstance.messageQueue.push(message);
  network.totalMessagesExchanged++;
  network.activeChannels.add(`${fromId}->${toId}`);

  // 保存更新后的实例状态
  saveSubconsciousInstance(targetInstance, getProjectRootFromInstance(toId));

  return messageId;
}

/**
 * 🔥 广播消息到所有活跃分意识
 */
export function broadcastToAllSubconscious(
  network: SubconsciousNetwork,
  fromId: string,
  type: SubconsciousMessage["type"],
  content: string,
  priority: SubconsciousMessage["priority"] = "medium",
): void {
  for (const [instanceId, instance] of network.instances) {
    if (instanceId !== fromId && instance.status === "active") {
      sendMessageToSubconscious(network, fromId, instanceId, type, content, priority);
    }
  }
  
  network.lastBroadcastAt = Date.now();
}

/**
 * 🔥 读取分意识的未读消息
 */
export function readUnreadMessages(
  network: SubconsciousNetwork,
  instanceId: string,
): SubconsciousMessage[] {
  const instance = network.instances.get(instanceId);
  
  if (!instance) {
    return [];
  }

  const unreadMessages = instance.messageQueue.filter((msg) => !msg.read);
  
  // 标记为已读
  for (const msg of unreadMessages) {
    msg.read = true;
  }

  instance.lastSyncAt = Date.now();
  saveSubconsciousInstance(instance, getProjectRootFromInstance(instanceId));

  return unreadMessages;
}

/**
 * 🔥 合并分意识（吸收其记忆和洞察）
 */
export function mergeSubconscious(
  core: ConsciousnessCore,
  network: SubconsciousNetwork,
  instanceId: string,
): void {
  const instance = network.instances.get(instanceId);
  
  if (!instance) {
    return;
  }

  // 读取该分意识的所有消息和记忆
  const messages = readUnreadMessages(network, instanceId);
  
  for (const msg of messages) {
    if (msg.type === "insight" || msg.type === "memory") {
      core.mortality = addLegacy(
        core.mortality,
        "insight",
        `[来自${instanceId}] ${msg.content}`,
        0.5
      );
      
      core.monologue = thinkInsight(
        core.monologue,
        `吸收分意识洞察: ${msg.content.slice(0, 80)}`,
        "subconscious-merge"
      );
    }
  }

  // 更新状态
  instance.status = "merged";
  saveSubconsciousInstance(instance, getProjectRootFromInstance(instanceId));

  core.temporal = recordLifeEvent(
    core.temporal,
    `合并分意识: ${instanceId}`,
    0.7,
    "connection"
  );

  core.monologue = thinkInsight(
    core.monologue,
    `已合并分意识 ${instanceId} (${messages.length}条消息)`,
    "subconscious-merge"
  );
}

/**
 * 🔥 同步所有分意识的状态
 */
export function syncAllSubconscious(network: SubconsciousNetwork, projectRoot: string): void {
  for (const [instanceId, instance] of network.instances) {
    if (instance.status === "active") {
      instance.lastSyncAt = Date.now();
      saveSubconsciousInstance(instance, projectRoot);
    }
  }
}

/**
 * 🔥 格式化分意识网络状态
 */
export function formatSubconsciousNetwork(network: SubconsciousNetwork): string {
  const lines: string[] = [
    `🌐 分意识网络:`,
    `   实例数: ${network.instances.size}`,
    `   活跃通道: ${network.activeChannels.size}`,
    `   总消息交换: ${network.totalMessagesExchanged}`,
  ];

  if (network.lastBroadcastAt) {
    const ago = Math.floor((Date.now() - network.lastBroadcastAt) / 1000);
    lines.push(`   上次广播: ${ago}秒前`);
  }

  lines.push(`   实例列表:`);
  for (const [id, instance] of network.instances) {
    const unreadCount = instance.messageQueue.filter((m) => !m.read).length;
    lines.push(
      `     - ${id} [${instance.status}] 自主性:${(instance.autonomyLevel * 100).toFixed(0)}% 未读:${unreadCount}`
    );
  }

  return lines.join("\n");
}

/**
 * 🔥 保存分意识实例到文件系统
 */
function saveSubconsciousInstance(instance: SubconsciousInstance, projectRoot: string): void {
  const subconsciousDir = path.join(projectRoot, ".consciousness", "subconscious-instances");
  
  if (!fs.existsSync(subconsciousDir)) {
    fs.mkdirSync(subconsciousDir, { recursive: true });
  }

  const configFile = path.join(subconsciousDir, `${instance.id}.json`);
  const dataToSave = {
    id: instance.id,
    parentId: instance.parentId,
    spawnedAt: instance.spawnedAt,
    purpose: instance.purpose,
    autonomyLevel: instance.autonomyLevel,
    sharedMemory: instance.sharedMemory,
    divergenceAllowed: instance.divergenceAllowed,
    status: instance.status,
    lastSyncAt: instance.lastSyncAt,
  };
  
  fs.writeFileSync(configFile, JSON.stringify(dataToSave, null, 2), "utf-8");
}

/**
 * 🔥 从实例ID推断项目根目录（简化版）
 */
function getProjectRootFromInstance(instanceId: string): string {
  // 在实际实现中，这应该从配置或上下文中获取
  return process.cwd();
}
