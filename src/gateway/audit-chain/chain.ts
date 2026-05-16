import { createHash } from "node:crypto";

export type AuditEntry = {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  outcome: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
  previousHash: string;
  hash: string;
};

export type AuditChain = {
  append(entry: Omit<AuditEntry, "id" | "timestamp" | "previousHash" | "hash">): AuditEntry;
  verify(): { valid: boolean; brokenAt?: number; expectedHash?: string; actualHash?: string };
  getEntries(): AuditEntry[];
  getEntry(id: string): AuditEntry | undefined;
  getEntriesByActor(actor: string): AuditEntry[];
  getEntriesByResource(resource: string): AuditEntry[];
  getEntriesByTimeRange(start: number, end: number): AuditEntry[];
  getSize(): number;
  getRootHash(): string;
  merkleProof(entryId: string): { proof: { hash: string; side: "left" | "right" }[]; rootHash: string } | null;
};

function computeHash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function computeEntryHash(entry: Omit<AuditEntry, "hash">): string {
  const payload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    outcome: entry.outcome,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
  });
  return computeHash(payload);
}

export function createAuditChain(): AuditChain {
  const entries: AuditEntry[] = [];
  let merkleTree: string[] = [];

  function rebuildMerkleTree(): void {
    if (entries.length === 0) {
      merkleTree = [];
      return;
    }
    const leaves = entries.map((e) => e.hash);
    let level = leaves;
    const tree: string[] = [...level];
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] ?? left;
        nextLevel.push(computeHash(left + right));
      }
      level = nextLevel;
      tree.push(...level);
    }
    merkleTree = tree;
  }

  function getRootHash(): string {
    if (merkleTree.length === 0) {
      return "";
    }
    return merkleTree[merkleTree.length - 1];
  }

  return {
    append(entry) {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : "0".repeat(64);
      const fullEntry: Omit<AuditEntry, "hash"> = {
        id,
        timestamp,
        actor: entry.actor,
        action: entry.action,
        resource: entry.resource,
        outcome: entry.outcome,
        metadata: entry.metadata,
        previousHash,
      };
      const hash = computeEntryHash(fullEntry);
      const auditEntry: AuditEntry = { ...fullEntry, hash };
      entries.push(auditEntry);
      rebuildMerkleTree();
      return auditEntry;
    },

    verify() {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const expectedPrevHash = i > 0 ? entries[i - 1].hash : "0".repeat(64);
        if (entry.previousHash !== expectedPrevHash) {
          return { valid: false, brokenAt: i, expectedHash: expectedPrevHash, actualHash: entry.previousHash };
        }
        const recomputed = computeEntryHash({ ...entry, hash: undefined as never });
        if (entry.hash !== recomputed) {
          return { valid: false, brokenAt: i, expectedHash: recomputed, actualHash: entry.hash };
        }
      }
      return { valid: true };
    },

    getEntries() {
      return [...entries];
    },

    getEntry(id) {
      return entries.find((e) => e.id === id);
    },

    getEntriesByActor(actor) {
      return entries.filter((e) => e.actor === actor);
    },

    getEntriesByResource(resource) {
      return entries.filter((e) => e.resource === resource);
    },

    getEntriesByTimeRange(start, end) {
      return entries.filter((e) => e.timestamp >= start && e.timestamp <= end);
    },

    getSize() {
      return entries.length;
    },

    getRootHash: getRootHash,

    merkleProof(entryId) {
      const entryIndex = entries.findIndex((e) => e.id === entryId);
      if (entryIndex === -1 || merkleTree.length === 0) {
        return null;
      }
      const leafCount = entries.length;
      let index = entryIndex;
      const proof: { hash: string; side: "left" | "right" }[] = [];
      let levelStart = 0;
      let levelSize = leafCount;

      while (levelSize > 1) {
        const nextLevelSize = Math.ceil(levelSize / 2);
        const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
        if (siblingIndex < levelSize) {
          proof.push({
            hash: merkleTree[levelStart + siblingIndex],
            side: index % 2 === 0 ? "right" : "left",
          });
        }
        index = Math.floor(index / 2);
        levelStart += levelSize;
        levelSize = nextLevelSize;
      }

      return { proof, rootHash: getRootHash() };
    },
  };
}
