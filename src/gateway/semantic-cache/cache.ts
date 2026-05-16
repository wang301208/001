export type CacheConfig = {
  maxEntries?: number;
  similarityThreshold?: number;
  ttlMs?: number;
  embeddingDimension?: number;
  enableMetrics?: boolean;
};

export type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  embedding: number[];
  createdAt: number;
  accessedAt: number;
  hitCount: number;
  tokenCount?: number;
};

export type SemanticCache<T = unknown> = {
  get(query: string | number[]): Promise<{ hit: boolean; entry?: CacheEntry<T> }>;
  set(query: string | number[], value: T, tokenCount?: number): Promise<void>;
  invalidate(key: string): void;
  clear(): void;
  getStats(): CacheStats;
};

export type CacheStats = {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  avgSimilarity: number;
  evictions: number;
  memoryEstimateBytes: number;
};

export function createSemanticCache<T = unknown>(
  embeddingFn?: (text: string) => Promise<number[]>,
  config?: CacheConfig,
): SemanticCache<T> {
  const maxEntries = config?.maxEntries ?? 1000;
  const threshold = config?.similarityThreshold ?? 0.92;
  const ttlMs = config?.ttlMs ?? 300_000;
  const dim = config?.embeddingDimension ?? 1536;

  const entries = new Map<string, CacheEntry<T>>();
  let totalHits = 0;
  let totalMisses = 0;
  let evictions = 0;
  let similaritySum = 0;
  let similarityCount = 0;

  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {return 0;}
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  function simpleHashEmbedding(text: string, dimension: number): number[] {
    const embedding = Array.from({ length: dimension }, () => 0);
    const normalized = text.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      for (let j = 0; j < dimension; j++) {
        embedding[j] += Math.sin(charCode * (i + 1) * (j + 1) * 0.001) * 0.1;
      }
    }
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return norm === 0 ? embedding : embedding.map((v) => v / norm);
  }

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (now - entry.createdAt > ttlMs) {
        entries.delete(key);
        evictions++;
      }
    }
  }

  function evictOldest(): void {
    if (entries.size <= maxEntries) {return;}
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of entries) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      entries.delete(oldestKey);
      evictions++;
    }
  }

  return {
    async get(query) {
      evictExpired();

      const embedding = typeof query === "string"
        ? (embeddingFn ? await embeddingFn(query) : simpleHashEmbedding(query, dim))
        : query;

      let bestEntry: CacheEntry<T> | null = null;
      let bestSimilarity = 0;

      for (const entry of entries.values()) {
        const sim = cosineSimilarity(embedding, entry.embedding);
        if (sim > bestSimilarity && sim >= threshold) {
          bestSimilarity = sim;
          bestEntry = entry;
        }
      }

      if (bestEntry) {
        totalHits++;
        similaritySum += bestSimilarity;
        similarityCount++;
        bestEntry.accessedAt = Date.now();
        bestEntry.hitCount++;
        return { hit: true, entry: bestEntry };
      }

      totalMisses++;
      return { hit: false };
    },

    async set(query, value, tokenCount) {
      evictExpired();
      evictOldest();

      const embedding = typeof query === "string"
        ? (embeddingFn ? await embeddingFn(query) : simpleHashEmbedding(query, dim))
        : query;

      const key = typeof query === "string"
        ? `text:${query.slice(0, 64)}`
        : `vec:${embedding.slice(0, 4).join(",")}`;

      const entry: CacheEntry<T> = {
        key,
        value,
        embedding,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        hitCount: 0,
        tokenCount,
      };

      entries.set(key, entry);
    },

    invalidate(key) {
      entries.delete(key);
    },

    clear() {
      entries.clear();
      totalHits = 0;
      totalMisses = 0;
      evictions = 0;
      similaritySum = 0;
      similarityCount = 0;
    },

    getStats() {
      const total = totalHits + totalMisses;
      let memoryEstimate = 0;
      for (const entry of entries.values()) {
        memoryEstimate += entry.embedding.length * 8;
        memoryEstimate += JSON.stringify(entry.value).length * 2;
      }
      return {
        totalEntries: entries.size,
        totalHits,
        totalMisses,
        hitRate: total > 0 ? totalHits / total : 0,
        avgSimilarity: similarityCount > 0 ? similaritySum / similarityCount : 0,
        evictions,
        memoryEstimateBytes: memoryEstimate,
      };
    },
  };
}
