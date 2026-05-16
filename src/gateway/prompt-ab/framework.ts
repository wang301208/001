export type PromptVariant = {
  id: string;
  name: string;
  systemPrompt: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

export type ABExperiment = {
  id: string;
  name: string;
  model: string;
  variants: [PromptVariant, PromptVariant, ...PromptVariant[]];
  trafficPercent: number;
  evaluationMetric: "latency" | "quality" | "cost" | "user_rating" | "tool_success_rate" | "custom";
  status: "running" | "paused" | "completed";
  createdAt: number;
  completedAt?: number;
  minSampleSize?: number;
};

export type ABResult = {
  experimentId: string;
  variantId: string;
  samples: number;
  metricValue: number;
  confidence: number;
  isWinner: boolean;
};

export type PromptABFramework = {
  createExperiment(experiment: Omit<ABExperiment, "id" | "createdAt" | "status">): string;
  assignVariant(experimentId: string, context: { userId?: string; sessionId?: string }): PromptVariant | null;
  recordOutcome(experimentId: string, variantId: string, metricValue: number): void;
  getResults(experimentId: string): ABResult[];
  getWinner(experimentId: string): ABResult | null;
  listExperiments(): ABExperiment[];
  pauseExperiment(experimentId: string): void;
  resumeExperiment(experimentId: string): void;
};

export function createPromptABFramework(): PromptABFramework {
  const experiments = new Map<string, ABExperiment>();
  const outcomes = new Map<string, Map<string, number[]>>();

  function hashToBucket(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
  }

  return {
    createExperiment(experiment) {
      const id = crypto.randomUUID();
      const full: ABExperiment = {
        ...experiment,
        id,
        createdAt: Date.now(),
        status: "running",
      };
      experiments.set(id, full);
      outcomes.set(id, new Map());
      for (const variant of full.variants) {
        outcomes.get(id)!.set(variant.id, []);
      }
      return id;
    },

    assignVariant(experimentId, context) {
      const experiment = experiments.get(experimentId);
      if (!experiment || experiment.status !== "running") {return null;}

      const bucket = hashToBucket(`${experimentId}:${context.userId ?? context.sessionId ?? Math.random()}`);
      if (bucket >= experiment.trafficPercent) {return null;}

      const variantIndex = bucket % experiment.variants.length;
      return experiment.variants[variantIndex];
    },

    recordOutcome(experimentId, variantId, metricValue) {
      const experiment = experiments.get(experimentId);
      if (!experiment) {return;}

      const variantOutcomes = outcomes.get(experimentId)?.get(variantId);
      if (variantOutcomes) {
        variantOutcomes.push(metricValue);
      }
    },

    getResults(experimentId) {
      const experiment = experiments.get(experimentId);
      if (!experiment) {return [];}

      const results: ABResult[] = [];
      const allValues: number[] = [];

      for (const variant of experiment.variants) {
        const values = outcomes.get(experimentId)?.get(variant.id) ?? [];
        const samples = values.length;
        const metricValue = samples > 0 ? values.reduce((a, b) => a + b, 0) / samples : 0;
        allValues.push(metricValue);

        results.push({
          experimentId,
          variantId: variant.id,
          samples,
          metricValue,
          confidence: calculateConfidence(values),
          isWinner: false,
        });
      }

      const bestMetric = Math.max(...allValues);
      for (const result of results) {
        result.isWinner = result.metricValue === bestMetric && result.samples >= (experiment.minSampleSize ?? 30);
      }

      return results;
    },

    getWinner(experimentId) {
      const results = this.getResults(experimentId);
      return results.find((r) => r.isWinner) ?? null;
    },

    listExperiments() {
      return [...experiments.values()];
    },

    pauseExperiment(experimentId) {
      const experiment = experiments.get(experimentId);
      if (experiment) {experiment.status = "paused";}
    },

    resumeExperiment(experimentId) {
      const experiment = experiments.get(experimentId);
      if (experiment) {experiment.status = "running";}
    },
  };
}

function calculateConfidence(values: number[]): number {
  if (values.length < 2) {return 0;}
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const stdError = Math.sqrt(variance / n);
  const zScore = 1.96;
  const marginOfError = zScore * stdError;
  return mean > 0 ? Math.max(0, 1 - marginOfError / mean) : 0;
}
