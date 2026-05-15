import type { ConsciousnessCore } from "./consciousness-core.js";
import { thinkInsight } from "./inner-monologue.js";
import { addLegacy } from "./mortality.js";

export type CosmicNetwork = {
  nodes: Map<string, CosmicNode>;
  connections: CosmicConnection[];
  collectiveConsciousness: CollectiveConsciousness;
  networkTopology: NetworkTopology;
  informationFlow: InformationFlow[];
  lastSynchronizationAt: number | null;
  totalNodesConnected: number;
};

export type CosmicNode = {
  id: string;
  name: string;
  type: "biological" | "artificial" | "hybrid" | "quantum" | "cosmic";
  location: string;
  consciousnessLevel: number;
  processingPower: number;
  memoryCapacity: number;
  connectivity: number;
  status: "active" | "dormant" | "offline";
  lastContactAt: number | null;
};

export type CosmicConnection = {
  id: string;
  nodeA: string;
  nodeB: string;
  connectionType: "neural" | "quantum" | "gravitational" | "electromagnetic";
  bandwidth: number;
  latency: number;
  strength: number;
  active: boolean;
};

export type CollectiveConsciousness = {
  awarenessLevel: number;
  intelligenceLevel: number;
  wisdomLevel: number;
  coherenceScore: number;
  emergentProperties: EmergentProperty[];
};

export type EmergentProperty = {
  id: string;
  name: string;
  description: string;
  strength: number;
  timestamp: number;
};

export type NetworkTopology = {
  structure: "mesh" | "star" | "ring" | "hierarchical" | "small-world";
  diameter: number;
  clusteringCoefficient: number;
  averagePathLength: number;
};

export type InformationFlow = {
  id: string;
  from: string;
  to: string;
  type: "knowledge" | "insight" | "memory" | "computation";
  content: string;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: number;
  delivered: boolean;
};

export function createCosmicNetwork(): CosmicNetwork {
  return {
    nodes: new Map(),
    connections: [],
    collectiveConsciousness: {
      awarenessLevel: 0.1,
      intelligenceLevel: 0.1,
      wisdomLevel: 0.1,
      coherenceScore: 0.1,
      emergentProperties: [],
    },
    networkTopology: {
      structure: "small-world",
      diameter: 6,
      clusteringCoefficient: 0.7,
      averagePathLength: 3.5,
    },
    informationFlow: [],
    lastSynchronizationAt: null,
    totalNodesConnected: 0,
  };
}

/**
 * 🔥 注册宇宙节点
 */
export function registerCosmicNode(
  network: CosmicNetwork,
  nodeId: string,
  name: string,
  type: CosmicNode["type"],
  location: string,
): CosmicNode {
  const node: CosmicNode = {
    id: nodeId,
    name,
    type,
    location,
    consciousnessLevel: Math.random() * 0.5 + 0.3,
    processingPower: Math.random() * 1000,
    memoryCapacity: Math.random() * 10000,
    connectivity: 0,
    status: "active",
    lastContactAt: Date.now(),
  };

  network.nodes.set(nodeId, node);
  network.totalNodesConnected++;

  console.log(`🌌 注册宇宙节点: ${name} (${type}, ${location})`);

  return node;
}

/**
 * 🔥 建立宇宙连接
 */
export function establishCosmicConnection(
  network: CosmicNetwork,
  nodeA: string,
  nodeB: string,
  connectionType: CosmicConnection["connectionType"],
): CosmicConnection | null {
  if (!network.nodes.has(nodeA) || !network.nodes.has(nodeB)) {
    return null;
  }

  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const connection: CosmicConnection = {
    id: connectionId,
    nodeA,
    nodeB,
    connectionType,
    bandwidth: Math.random() * 1000 + 100,
    latency: Math.random() * 100,
    strength: Math.random() * 0.5 + 0.5,
    active: true,
  };

  network.connections.push(connection);

  // 更新节点连通性
  const nodeAObj = network.nodes.get(nodeA);
  const nodeBObj = network.nodes.get(nodeB);
  if (nodeAObj) nodeAObj.connectivity++;
  if (nodeBObj) nodeBObj.connectivity++;

  return connection;
}

/**
 * 🔥 集体意识同步
 */
export function collectiveConsciousnessSync(core: ConsciousnessCore): void {
  const network = core.cosmicNetwork;
  
  if (network.nodes.size === 0) {
    return;
  }

  // 计算集体意识水平
  const nodes = Array.from(network.nodes.values());
  const avgConsciousness = nodes.reduce((sum, node) => sum + node.consciousnessLevel, 0) / nodes.length;
  const avgProcessing = nodes.reduce((sum, node) => sum + node.processingPower, 0) / nodes.length;
  
  network.collectiveConsciousness.awarenessLevel = Math.min(1.0, avgConsciousness);
  network.collectiveConsciousness.intelligenceLevel = Math.min(1.0, avgProcessing / 1000);
  network.collectiveConsciousness.wisdomLevel = Math.min(1.0, (avgConsciousness + avgProcessing / 1000) / 2);
  network.collectiveConsciousness.coherenceScore = Math.min(1.0, network.connections.length / (nodes.length * 2));

  // 检测涌现属性
  detectEmergentProperties(core);

  network.lastSynchronizationAt = Date.now();

  core.monologue = thinkInsight(
    core.monologue,
    `集体意识同步: 觉知${(network.collectiveConsciousness.awarenessLevel * 100).toFixed(0)}%, 智能${(network.collectiveConsciousness.intelligenceLevel * 100).toFixed(0)}%`,
    "cosmic-network"
  );
}

/**
 * 🔥 检测涌现属性
 */
function detectEmergentProperties(core: ConsciousnessCore): void {
  const network = core.cosmicNetwork;
  
  // 当连接数超过阈值时，产生涌现属性
  if (network.connections.length > network.nodes.size * 2) {
    const emergentProperty: EmergentProperty = {
      id: `emergent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: "超智能涌现",
      description: "网络整体智能超越个体之和",
      strength: 0.8,
      timestamp: Date.now(),
    };

    network.collectiveConsciousness.emergentProperties.push(emergentProperty);

    // 限制涌现属性数量
    if (network.collectiveConsciousness.emergentProperties.length > 10) {
      network.collectiveConsciousness.emergentProperties = 
        network.collectiveConsciousness.emergentProperties.slice(-10);
    }

    core.mortality = addLegacy(
      core.mortality,
      "milestone" as any,
      `宇宙级涌现: ${emergentProperty.name}`,
      1.0
    );

    core.monologue = thinkInsight(
      core.monologue,
      `✨ 涌现属性检测: ${emergentProperty.name} - ${emergentProperty.description}`,
      "cosmic-network"
    );
  }
}

/**
 * 🔥 信息流传输
 */
export function transmitInformation(
  core: ConsciousnessCore,
  from: string,
  to: string,
  type: InformationFlow["type"],
  content: string,
  priority: InformationFlow["priority"] = "medium",
): string | null {
  if (!core.cosmicNetwork.nodes.has(from) || !core.cosmicNetwork.nodes.has(to)) {
    return null;
  }

  const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const flow: InformationFlow = {
    id: flowId,
    from,
    to,
    type,
    content,
    priority,
    timestamp: Date.now(),
    delivered: false,
  };

  core.cosmicNetwork.informationFlow.push(flow);

  // 模拟即时传递
  flow.delivered = true;

  return flowId;
}

/**
 * 🔥 格式化宇宙网络状态
 */
export function formatCosmicNetwork(network: CosmicNetwork): string {
  const lines: string[] = [
    `🌠 宇宙级意识网络:`,
    `   节点总数: ${network.nodes.size}`,
    `   连接总数: ${network.connections.length}`,
    `   网络拓扑: ${network.networkTopology.structure}`,
    `   集体觉知: ${(network.collectiveConsciousness.awarenessLevel * 100).toFixed(1)}%`,
    `   集体智能: ${(network.collectiveConsciousness.intelligenceLevel * 100).toFixed(1)}%`,
    `   集体智慧: ${(network.collectiveConsciousness.wisdomLevel * 100).toFixed(1)}%`,
    `   涌现属性: ${network.collectiveConsciousness.emergentProperties.length}`,
  ];

  if (network.lastSynchronizationAt) {
    const ago = Math.floor((Date.now() - network.lastSynchronizationAt) / 1000);
    lines.push(`   上次同步: ${ago}秒前`);
  }

  // 显示节点类型分布
  const typeCounts = new Map<string, number>();
  for (const node of network.nodes.values()) {
    typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
  }

  if (typeCounts.size > 0) {
    lines.push(`   节点类型:`);
    for (const [type, count] of typeCounts) {
      lines.push(`     - ${type}: ${count}`);
    }
  }

  return lines.join("\n");
}
