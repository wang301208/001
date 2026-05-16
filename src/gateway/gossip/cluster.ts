import type { EventBus } from "../event-bus/bus.js";

export type GossipNode = {
  id: string;
  address: string;
  port: number;
  state: "alive" | "suspect" | "dead";
  incarnation: number;
  metadata: Record<string, unknown>;
  lastHeartbeat: number;
};

export type GossipMessage = {
  type: "ping" | "ack" | "ping-req" | "sync" | "compound" | "suspect" | "alive" | "dead";
  source: string;
  target?: string;
  payload: GossipNode[];
  timestamp: number;
  incarnation: number;
};

export type GossipClusterConfig = {
  suspectTimeoutMs?: number;
  deadTimeoutMs?: number;
  cleanupTimeoutMs?: number;
  gossipIntervalMs?: number;
  fanout?: number;
};

export type GossipCluster = {
  getMembers(): GossipNode[];
  getAliveMembers(): GossipNode[];
  getLocalNode(): GossipNode;
  join(seedNodes: { address: string; port: number }[]): Promise<void>;
  leave(): Promise<void>;
  updateMetadata(metadata: Record<string, unknown>): void;
  onMemberChange(handler: (event: { node: GossipNode; state: GossipNode["state"] }) => void): () => void;
  getClusterSize(): number;
  isPartitioned(): boolean;
  receiveMessage(msg: GossipMessage): GossipMessage | null;
  getClusterHealth(): { total: number; alive: number; suspect: number; dead: number; partitioned: boolean };
  getStateDigest(): Map<string, { state: GossipNode["state"]; incarnation: number }>;
};

export function createLocalGossipCluster(
  localId: string,
  localAddress: string,
  localPort: number,
  config?: GossipClusterConfig,
  eventBus?: EventBus,
): GossipCluster {
  const members = new Map<string, GossipNode>();
  const suspectTimeoutMs = config?.suspectTimeoutMs ?? 10_000;
  const deadTimeoutMs = config?.deadTimeoutMs ?? 30_000;
  const cleanupTimeoutMs = config?.cleanupTimeoutMs ?? 60_000;
  const gossipIntervalMs = config?.gossipIntervalMs ?? 1_000;
  const fanout = config?.fanout ?? 3;

  const localNode: GossipNode = {
    id: localId,
    address: localAddress,
    port: localPort,
    state: "alive",
    incarnation: 1,
    metadata: { startedAt: Date.now() },
    lastHeartbeat: Date.now(),
  };
  members.set(localId, localNode);

  const changeHandlers = new Set<(event: { node: GossipNode; state: GossipNode["state"] }) => void>();
  let suspectTimer: ReturnType<typeof setInterval> | null = null;
  let deadTimer: ReturnType<typeof setInterval> | null = null;
  let gossipTimer: ReturnType<typeof setInterval> | null = null;

  function notifyHandlers(node: GossipNode, state: GossipNode["state"]) {
    eventBus?.publish("gossip.member-change", { nodeId: node.id, state, address: node.address, port: node.port });
    for (const handler of changeHandlers) {
      handler({ node, state });
    }
  }

  function mergeMemberState(remote: GossipNode): void {
    const local = members.get(remote.id);
    if (!local) {
      members.set(remote.id, { ...remote });
      notifyHandlers(remote, remote.state);
      return;
    }

    if (remote.incarnation > local.incarnation) {
      const oldState = local.state;
      Object.assign(local, {
        state: remote.state,
        incarnation: remote.incarnation,
        metadata: remote.metadata,
        lastHeartbeat: remote.state === "alive" ? Date.now() : local.lastHeartbeat,
      });
      if (oldState !== remote.state) {
        notifyHandlers(local, remote.state);
      }
    } else if (remote.incarnation === local.incarnation && remote.state === "alive" && local.state !== "alive") {
      local.state = "alive";
      local.lastHeartbeat = Date.now();
      notifyHandlers(local, "alive");
    }
  }

  function startFailureDetection() {
    if (suspectTimer) return;

    suspectTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, member] of members) {
        if (id === localId) continue;
        const elapsed = now - member.lastHeartbeat;
        if (member.state === "alive" && elapsed > suspectTimeoutMs) {
          member.state = "suspect";
          member.incarnation++;
          notifyHandlers(member, "suspect");
          eventBus?.publish("gossip.suspect", { nodeId: id, elapsed });
        }
        if (member.state === "suspect" && elapsed > deadTimeoutMs) {
          member.state = "dead";
          member.incarnation++;
          notifyHandlers(member, "dead");
          eventBus?.publish("gossip.dead", { nodeId: id, elapsed });
        }
      }
    }, suspectTimeoutMs / 2);

    deadTimer = setInterval(() => {
      for (const [id, member] of members) {
        if (member.state === "dead" && Date.now() - member.lastHeartbeat > cleanupTimeoutMs) {
          members.delete(id);
          eventBus?.publish("gossip.removed", { nodeId: id });
        }
      }
    }, cleanupTimeoutMs / 2);

    gossipTimer = setInterval(() => {
      const aliveMembers = [...members.values()].filter((m) => m.id !== localId && m.state === "alive");
      if (aliveMembers.length === 0) return;

      const targets: GossipNode[] = [];
      const shuffled = aliveMembers.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(fanout, shuffled.length); i++) {
        targets.push(shuffled[i]);
      }

      const allMembers = [...members.values()];
      for (const target of targets) {
        eventBus?.publish("gossip.send", {
          type: "sync",
          source: localId,
          target: target.id,
          payload: allMembers,
          timestamp: Date.now(),
          incarnation: localNode.incarnation,
        });
      }

      localNode.lastHeartbeat = Date.now();
    }, gossipIntervalMs);
  }

  return {
    getMembers() {
      return [...members.values()];
    },

    getAliveMembers() {
      return [...members.values()].filter((m) => m.state === "alive");
    },

    getLocalNode() {
      return localNode;
    },

    async join(seedNodes) {
      for (const seed of seedNodes) {
        const memberId = `${seed.address}:${seed.port}`;
        if (!members.has(memberId) && memberId !== localId) {
          const node: GossipNode = {
            id: memberId,
            address: seed.address,
            port: seed.port,
            state: "alive",
            incarnation: 0,
            metadata: {},
            lastHeartbeat: Date.now(),
          };
          members.set(memberId, node);
          eventBus?.publish("gossip.join", { nodeId: memberId, address: seed.address, port: seed.port });
        }
      }
      localNode.lastHeartbeat = Date.now();
      startFailureDetection();
    },

    async leave() {
      localNode.state = "dead";
      localNode.incarnation++;
      notifyHandlers(localNode, "dead");
      eventBus?.publish("gossip.leave", { nodeId: localId });

      if (suspectTimer) clearInterval(suspectTimer);
      if (deadTimer) clearInterval(deadTimer);
      if (gossipTimer) clearInterval(gossipTimer);
      suspectTimer = null;
      deadTimer = null;
      gossipTimer = null;
    },

    updateMetadata(metadata) {
      Object.assign(localNode.metadata, metadata);
      localNode.incarnation++;
      localNode.lastHeartbeat = Date.now();
    },

    onMemberChange(handler) {
      changeHandlers.add(handler);
      return () => { changeHandlers.delete(handler); };
    },

    getClusterSize() {
      return members.size;
    },

    isPartitioned() {
      const aliveCount = [...members.values()].filter((m) => m.state === "alive").length;
      return aliveCount < members.size / 2;
    },

    receiveMessage(msg) {
      if (msg.target && msg.target !== localId) return null;

      switch (msg.type) {
        case "ping":
          return { type: "ack", source: localId, target: msg.source, payload: [localNode], timestamp: Date.now(), incarnation: localNode.incarnation };

        case "ack":
          for (const node of msg.payload) {
            mergeMemberState(node);
          }
          return null;

        case "sync":
          for (const node of msg.payload) {
            mergeMemberState(node);
          }
          return { type: "sync", source: localId, target: msg.source, payload: [...members.values()], timestamp: Date.now(), incarnation: localNode.incarnation };

        case "suspect": {
          for (const node of msg.payload) {
            const local = members.get(node.id);
            if (local && local.state === "alive" && node.incarnation >= local.incarnation) {
              local.state = "suspect";
              local.incarnation = node.incarnation;
              notifyHandlers(local, "suspect");
            }
          }
          return null;
        }

        case "alive": {
          for (const node of msg.payload) {
            mergeMemberState({ ...node, state: "alive" });
          }
          return null;
        }

        case "dead": {
          for (const node of msg.payload) {
            mergeMemberState({ ...node, state: "dead" });
          }
          return null;
        }

        default:
          return null;
      }
    },

    getClusterHealth() {
      const all = [...members.values()];
      return {
        total: all.length,
        alive: all.filter((m) => m.state === "alive").length,
        suspect: all.filter((m) => m.state === "suspect").length,
        dead: all.filter((m) => m.state === "dead").length,
        partitioned: this.isPartitioned(),
      };
    },

    getStateDigest() {
      const digest = new Map<string, { state: GossipNode["state"]; incarnation: number }>();
      for (const [id, node] of members) {
        digest.set(id, { state: node.state, incarnation: node.incarnation });
      }
      return digest;
    },
  };
}
