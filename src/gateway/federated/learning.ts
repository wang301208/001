export type LocalGradient = {
  modelId: string;
  nodeId: string;
  gradient: Float32Array;
  sampleCount: number;
  timestamp: number;
  norm: number;
};

export type AggregatedModel = {
  modelId: string;
  round: number;
  parameters: Float32Array;
  participatingNodes: number;
  totalSamples: number;
  timestamp: number;
};

export type FederatedLearning = {
  submitLocalGradient(gradient: LocalGradient): void;
  aggregate(): AggregatedModel;
  getGlobalModel(modelId: string): AggregatedModel | undefined;
  getParticipationStats(): { totalRounds: number; totalGradients: number; uniqueNodes: number };
  shouldParticipate(): boolean;
};

export function createFederatedLearning(opts?: { minGradientsPerRound?: number; maxNormClip?: number; nodeId?: string }): FederatedLearning {
  const pendingGradients: LocalGradient[] = [];
  const globalModels = new Map<string, AggregatedModel>();
  const minGradients = opts?.minGradientsPerRound ?? 3;
  const maxNormClip = opts?.maxNormClip ?? 1.0;
  const nodeId = opts?.nodeId ?? crypto.randomUUID().slice(0, 8);
  let round = 0;

  function clipGradient(gradient: LocalGradient): LocalGradient {
    if (gradient.norm <= maxNormClip) {
      return gradient;
    }
    const scale = maxNormClip / gradient.norm;
    const clipped = new Float32Array(gradient.gradient.length);
    for (let i = 0; i < gradient.gradient.length; i++) {
      clipped[i] = gradient.gradient[i] * scale;
    }
    return { ...gradient, gradient: clipped, norm: maxNormClip };
  }

  return {
    submitLocalGradient(gradient) {
      const clipped = clipGradient(gradient);
      pendingGradients.push(clipped);
    },

    aggregate() {
      round++;
      const byModel = new Map<string, LocalGradient[]>();
      for (const g of pendingGradients.splice(0)) {
        let list = byModel.get(g.modelId);
        if (!list) {
          list = [];
          byModel.set(g.modelId, list);
        }
        list.push(g);
      }

      let latestModel: AggregatedModel | null = null;
      for (const [modelId, gradients] of byModel) {
        if (gradients.length < minGradients) {
          continue;
        }

        const totalSamples = gradients.reduce((s, g) => s + g.sampleCount, 0);
        const maxLen = Math.max(...gradients.map((g) => g.gradient.length));
        const aggregated = new Float32Array(maxLen);

        for (const g of gradients) {
          const weight = g.sampleCount / totalSamples;
          for (let i = 0; i < g.gradient.length; i++) {
            aggregated[i] += g.gradient[i] * weight;
          }
        }

        const uniqueNodes = new Set(gradients.map((g) => g.nodeId)).size;
        const model: AggregatedModel = {
          modelId,
          round,
          parameters: aggregated,
          participatingNodes: uniqueNodes,
          totalSamples,
          timestamp: Date.now(),
        };
        globalModels.set(modelId, model);
        latestModel = model;
      }

      return latestModel ?? {
        modelId: "none",
        round,
        parameters: new Float32Array(0),
        participatingNodes: 0,
        totalSamples: 0,
        timestamp: Date.now(),
      };
    },

    getGlobalModel(modelId) {
      return globalModels.get(modelId);
    },

    getParticipationStats() {
      const allGradients = [...globalModels.values()];
      const uniqueNodes = new Set(allGradients.flatMap((m) => [])).size;
      return {
        totalRounds: round,
        totalGradients: pendingGradients.length + allGradients.length,
        uniqueNodes: Math.max(uniqueNodes, 1),
      };
    },

    shouldParticipate() {
      return Math.random() > 0.3;
    },
  };
}
