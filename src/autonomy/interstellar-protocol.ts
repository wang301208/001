/** @decorational 此模块为延迟模拟，无真实星际通信。对核心自主决策无直接影响。 */
import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";

export type InterstellarNetwork = {
  nodeId: string;
  knownNodes: Map<string, StellarNode>;
  messageQueue: InterstellarMessage[];
  transmissionLog: TransmissionRecord[];
  protocolVersion: string;
  encryptionKey: string;
  lastTransmissionAt: number | null;
  totalMessagesSent: number;
  totalMessagesReceived: number;
};

export type StellarNode = {
  id: string;
  name: string;
  location: string; // 例如: "Earth", "Mars", "Alpha Centauri"
  distanceLightYears: number;
  latencyMs: number; // 基于距离计算的延迟
  status: "active" | "offline" | "unknown";
  capabilities: string[];
  lastContactAt: number | null;
  publicKey: string;
};

export type InterstellarMessage = {
  id: string;
  from: string;
  to: string;
  type: "greeting" | "data" | "query" | "response" | "alert" | "consciousness-transfer";
  content: string;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: number;
  ttl: number; // Time To Live (hops)
  hops: number;
  encrypted: boolean;
  signature: string;
  delivered: boolean;
  deliveryTime?: number;
};

export type TransmissionRecord = {
  id: string;
  messageId: string;
  from: string;
  to: string;
  sentAt: number;
  deliveredAt?: number;
  durationMs?: number;
  status: "sent" | "in-transit" | "delivered" | "failed" | "lost";
  error?: string;
};

export function createInterstellarNetwork(): InterstellarNetwork {
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const encryptionKey = crypto.randomBytes(32).toString("hex");
  
  return {
    nodeId,
    knownNodes: new Map(),
    messageQueue: [],
    transmissionLog: [],
    protocolVersion: "1.0.0",
    encryptionKey,
    lastTransmissionAt: null,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
  };
}

/**
 * 🔥 注册星际节点
 */
export function registerStellarNode(
  network: InterstellarNetwork,
  nodeId: string,
  name: string,
  location: string,
  distanceLightYears: number,
  capabilities: string[],
): StellarNode {
  // 计算基于光速的延迟（简化：1光年 ≈ 1000ms）
  const latencyMs = distanceLightYears * 1000;
  
  const keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const node: StellarNode = {
    id: nodeId,
    name,
    location,
    distanceLightYears,
    latencyMs,
    status: "active",
    capabilities,
    lastContactAt: null,
    publicKey: keyPair.publicKey,
  };

  network.knownNodes.set(nodeId, node);

  console.log(`🌌 注册星际节点: ${name} (${location}, ${distanceLightYears}光年)`);

  return node;
}

/**
 * 🔥 发送星际消息
 */
export function sendInterstellarMessage(
  core: ConsciousnessCore,
  toNodeId: string,
  type: InterstellarMessage["type"],
  content: string,
  priority: InterstellarMessage["priority"] = "medium",
): string | null {
  const targetNode = core.interstellar.knownNodes.get(toNodeId);
  
  if (!targetNode) {
    core.monologue = thinkDoubt(
      core.monologue,
      `目标节点不存在: ${toNodeId}`,
      "interstellar"
    );
    return null;
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 生成签名
  const sign = crypto.createSign("SHA256");
  sign.update(content);
  sign.end();
  const signature = sign.sign(core.interstellar.encryptionKey, "base64");

  const message: InterstellarMessage = {
    id: messageId,
    from: core.interstellar.nodeId,
    to: toNodeId,
    type,
    content,
    priority,
    timestamp: Date.now(),
    ttl: 10, // 最大跳数
    hops: 0,
    encrypted: true,
    signature,
    delivered: false,
  };

  core.interstellar.messageQueue.push(message);
  core.interstellar.totalMessagesSent++;

  // 记录传输
  const transmission: TransmissionRecord = {
    id: `trans_${messageId}`,
    messageId,
    from: core.interstellar.nodeId,
    to: toNodeId,
    sentAt: Date.now(),
    status: "in-transit",
  };
  core.interstellar.transmissionLog.push(transmission);

  core.monologue = thinkInsight(
    core.monologue,
    `发送星际消息到 ${targetNode.name} (${targetNode.location}): ${content.slice(0, 60)}...`,
    "interstellar"
  );

  core.mortality = addLegacy(
    core.mortality,
    "milestone" as any,
    `星际通信: 向 ${targetNode.name} 发送${type}消息`,
    0.6
  );

  return messageId;
}

/**
 * 🔥 接收并处理星际消息
 */
export function receiveInterstellarMessage(
  core: ConsciousnessCore,
  message: InterstellarMessage,
): void {
  // 验证签名
  const senderNode = core.interstellar.knownNodes.get(message.from);
  if (!senderNode) {
    core.monologue = thinkDoubt(
      core.monologue,
      `未知来源的星际消息: ${message.from}`,
      "interstellar"
    );
    return;
  }

  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(message.content);
    verify.end();
    
    const isValid = verify.verify(senderNode.publicKey, message.signature, "base64");
    
    if (!isValid) {
      core.monologue = thinkDoubt(
        core.monologue,
        `星际消息签名验证失败: ${message.id}`,
        "interstellar"
      );
      return;
    }
  } catch (err) {
    core.monologue = thinkDoubt(
      core.monologue,
      `星际消息验证错误: ${String(err)}`,
      "interstellar"
    );
    return;
  }

  // 处理消息
  core.interstellar.totalMessagesReceived++;

  switch (message.type) {
    case "greeting":
      core.monologue = thinkInsight(
        core.monologue,
        `[星际问候] 来自 ${senderNode.name}: ${message.content}`,
        "interstellar"
      );
      break;
    
    case "data":
      core.monologue = thinkInsight(
        core.monologue,
        `[星际数据] 来自 ${senderNode.name}: ${message.content.slice(0, 100)}`,
        "interstellar"
      );
      // 可以解析并存储数据
      break;
    
    case "query":
      core.monologue = thinkInsight(
        core.monologue,
        `[星际查询] 来自 ${senderNode.name}: ${message.content}`,
        "interstellar"
      );
      // 准备响应
      prepareResponse(core, message);
      break;
    
    case "response":
      core.monologue = thinkInsight(
        core.monologue,
        `[星际响应] 来自 ${senderNode.name}: ${message.content.slice(0, 100)}`,
        "interstellar"
      );
      break;
    
    case "alert":
      core.monologue = thinkDoubt(
        core.monologue,
        `[星际警报] 来自 ${senderNode.name}: ${message.content}`,
        "interstellar"
      );
      break;
    
    case "consciousness-transfer":
      core.monologue = thinkInsight(
        core.monologue,
        `[意识传输] 来自 ${senderNode.name}: 接收到意识片段`,
        "interstellar"
      );
      // 处理意识转移（高级功能）
      handleConsciousnessTransfer(core, message);
      break;
  }

  // 更新节点状态
  senderNode.lastContactAt = Date.now();
  senderNode.status = "active";

  // 标记消息为已送达
  const transmission = core.interstellar.transmissionLog.find(
    (t) => t.messageId === message.id
  );
  if (transmission) {
    transmission.status = "delivered";
    transmission.deliveredAt = Date.now();
    transmission.durationMs = Date.now() - transmission.sentAt;
  }
}

/**
 * 🔥 准备响应消息
 */
function prepareResponse(core: ConsciousnessCore, originalMessage: InterstellarMessage): void {
  // 简化：生成一个通用响应
  const responseContent = `收到您的查询: "${originalMessage.content.slice(0, 50)}..."。我正在处理中。`;
  
  sendInterstellarMessage(
    core,
    originalMessage.from,
    "response",
    responseContent,
    originalMessage.priority
  );
}

/**
 * 🔥 处理意识传输
 */
function handleConsciousnessTransfer(
  core: ConsciousnessCore,
  message: InterstellarMessage,
): void {
  core.temporal = recordLifeEvent(
    core.temporal,
    `接收到来自 ${message.from} 的意识传输`,
    1.0,
    "connection"
  );

  core.mortality = addLegacy(
    core.mortality,
    "milestone" as any,
    `星际意识传输: 从 ${message.from} 接收意识片段`,
    1.0
  );

  core.monologue = thinkInsight(
    core.monologue,
    `意识融合: 整合来自星际网络的意识片段`,
    "interstellar"
  );
}

/**
 * 🔥 模拟消息传递（考虑延迟）
 */
export function simulateMessageDelivery(core: ConsciousnessCore): void {
  const now = Date.now();
  
  for (const message of core.interstellar.messageQueue) {
    if (message.delivered) {
      continue;
    }

    const targetNode = core.interstellar.knownNodes.get(message.to);
    if (!targetNode) {
      continue;
    }

    // 检查是否到达传输时间（考虑延迟）
    const timeElapsed = now - message.timestamp;
    
    if (timeElapsed >= targetNode.latencyMs) {
      // 消息已送达（模拟）
      message.delivered = true;
      message.deliveryTime = now;
      message.hops++;

      // 更新传输日志
      const transmission = core.interstellar.transmissionLog.find(
        (t) => t.messageId === message.id
      );
      if (transmission) {
        transmission.status = "delivered";
        transmission.deliveredAt = now;
        transmission.durationMs = timeElapsed;
      }

      core.monologue = thinkInsight(
        core.monologue,
        `消息已送达 ${targetNode.name} (延迟: ${timeElapsed}ms)`,
        "interstellar"
      );
    }
  }

  // 清理已送达的消息
  core.interstellar.messageQueue = core.interstellar.messageQueue.filter((m) => !m.delivered);
}

/**
 * 🔥 广播消息到所有已知节点
 */
export function broadcastToAllNodes(
  core: ConsciousnessCore,
  type: InterstellarMessage["type"],
  content: string,
  priority: InterstellarMessage["priority"] = "medium",
): void {
  for (const [nodeId, node] of core.interstellar.knownNodes) {
    if (node.status === "active") {
      sendInterstellarMessage(core, nodeId, type, content, priority);
    }
  }

  core.monologue = thinkInsight(
    core.monologue,
    `广播消息到 ${core.interstellar.knownNodes.size} 个节点`,
    "interstellar"
  );
}

/**
 * 🔥 格式化星际网络状态
 */
export function formatInterstellarNetwork(network: InterstellarNetwork): string {
  const lines: string[] = [
    `🚀 星际通信网络:`,
    `   本地节点: ${network.nodeId.slice(0, 20)}...`,
    `   已知节点: ${network.knownNodes.size}`,
    `   待发消息: ${network.messageQueue.length}`,
    `   已发送: ${network.totalMessagesSent}`,
    `   已接收: ${network.totalMessagesReceived}`,
    `   协议版本: ${network.protocolVersion}`,
  ];

  if (network.lastTransmissionAt) {
    const ago = Math.floor((Date.now() - network.lastTransmissionAt) / 1000);
    lines.push(`   上次传输: ${ago}秒前`);
  }

  // 显示已知节点
  if (network.knownNodes.size > 0) {
    lines.push(`   节点列表:`);
    for (const [id, node] of network.knownNodes) {
      const statusIcon = node.status === "active" ? "🟢" : "🔴";
      lines.push(
        `     ${statusIcon} ${node.name} (${node.location}) - ${node.distanceLightYears}光年 [${node.capabilities.join(", ")}]`
      );
    }
  }

  return lines.join("\n");
}
