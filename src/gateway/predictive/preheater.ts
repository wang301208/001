export type PredictionModel = {
  predictAccessProbability(key: string): number;
  update(key: string, accessed: boolean): void;
  getPreheatCandidates(threshold: number): string[];
};

export function createPredictionModel(): PredictionModel {
  const accessHistory = new Map<string, { hits: number; misses: number; lastAccess: number; frequency: number[] }>();
  const windowSize = 10;

  return {
    predictAccessProbability(key) {
      const history = accessHistory.get(key);
      if (!history || history.hits + history.misses === 0) {
        return 0;
      }
      const recentFreq = history.frequency.slice(-windowSize);
      const recentHits = recentFreq.filter((f) => f > 0).length;
      return recentHits / Math.max(recentFreq.length, 1);
    },

    update(key, accessed) {
      let history = accessHistory.get(key);
      if (!history) {
        history = { hits: 0, misses: 0, lastAccess: 0, frequency: [] };
        accessHistory.set(key, history);
      }

      if (accessed) {
        history.hits++;
      } else {
        history.misses++;
      }
      history.lastAccess = Date.now();
      history.frequency.push(accessed ? 1 : 0);
      if (history.frequency.length > windowSize * 2) {
        history.frequency = history.frequency.slice(-windowSize);
      }
    },

    getPreheatCandidates(threshold) {
      const candidates: { key: string; probability: number }[] = [];
      for (const [key] of accessHistory) {
        const prob = this.predictAccessProbability(key);
        if (prob >= threshold) {
          candidates.push({ key, probability: prob });
        }
      }
      candidates.sort((a, b) => b.probability - a.probability);
      return candidates.map((c) => c.key);
    },
  };
}

export type PredictivePreheater = {
  onAccess(key: string): void;
  preheat(): Promise<string[]>;
  getStats(): { trackedKeys: number; preheatedKeys: number; hitRate: number };
};

export function createPredictivePreheater(
  loader: (key: string) => Promise<unknown>,
  opts?: { threshold?: number; maxConcurrentPreheats?: number; preheatIntervalMs?: number },
): PredictivePreheater {
  const model = createPredictionModel();
  const threshold = opts?.threshold ?? 0.7;
  const maxConcurrent = opts?.maxConcurrentPreheats ?? 5;
  const intervalMs = opts?.preheatIntervalMs ?? 30_000;
  const preheated = new Set<string>();
  let totalPreheats = 0;
  let successfulPreheats = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  return {
    onAccess(key) {
      model.update(key, true);
    },

    async preheat() {
      const candidates = model.getPreheatCandidates(threshold).slice(0, maxConcurrent);
      const results: string[] = [];

      const batch = candidates.filter((k) => !preheated.has(k));
      const chunks: string[][] = [];
      for (let i = 0; i < batch.length; i += maxConcurrent) {
        chunks.push(batch.slice(i, i + maxConcurrent));
      }

      for (const chunk of chunks) {
        const settled = await Promise.allSettled(chunk.map(async (key) => {
          totalPreheats++;
          await loader(key);
          preheated.add(key);
          successfulPreheats++;
          results.push(key);
        }));
        for (let i = 0; i < settled.length; i++) {
          if (settled[i].status === "rejected") {
            model.update(chunk[i], false);
          }
        }
      }

      return results;
    },

    getStats() {
      return {
        trackedKeys: model.getPreheatCandidates(0).length,
        preheatedKeys: preheated.size,
        hitRate: totalPreheats > 0 ? successfulPreheats / totalPreheats : 0,
      };
    },
  };
}
