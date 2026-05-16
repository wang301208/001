export type ConfigParameter = {
  path: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  step: number;
  impact: "low" | "medium" | "high";
};

export type ConfigEvaluation = {
  parameters: Record<string, number>;
  metrics: Record<string, number>;
  fitness: number;
};

export type ConfigEvolution = {
  registerParameter(param: ConfigParameter): void;
  getCurrentConfig(): Record<string, number>;
  evaluateAndAdapt(metrics: Record<string, number>): ConfigEvaluation;
  rollback(): void;
  getHistory(): { timestamp: number; config: Record<string, number>; fitness: number }[];
  getSuggestions(): ConfigSuggestion[];
};

export type ConfigSuggestion = {
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
  expectedImprovement: number;
};

export function createConfigEvolution(): ConfigEvolution {
  const parameters = new Map<string, ConfigParameter>();
  const history: { timestamp: number; config: Record<string, number>; fitness: number }[] = [];
  const currentValues = new Map<string, number>();
  let lastFitness = 0;

  return {
    registerParameter(param) {
      parameters.set(param.path, param);
      currentValues.set(param.path, param.currentValue);
    },

    getCurrentConfig() {
      return Object.fromEntries(currentValues);
    },

    evaluateAndAdapt(metrics) {
      const config = Object.fromEntries(currentValues);
      const latency = metrics.p99LatencyMs ?? metrics.avgLatencyMs ?? 1000;
      const errorRate = metrics.errorRate ?? 0;
      const throughput = metrics.throughput ?? 10;

      const fitness = (1 / (1 + latency / 1000)) * (1 - errorRate) * Math.min(throughput / 100, 1);

      if (fitness > lastFitness * 0.95 || history.length === 0) {
        for (const [path, param] of parameters) {
          const current = currentValues.get(path) ?? param.currentValue;
          let adjustment = 0;
          if (latency > 3000 && param.impact === "high") {
            adjustment = -param.step;
          } else if (errorRate > 0.1) {
            adjustment = -param.step * 0.5;
          } else if (throughput < 50 && param.impact === "high") {
            adjustment = param.step;
          } else {
            adjustment = (Math.random() - 0.5) * param.step;
          }
          currentValues.set(path, Math.max(param.minValue, Math.min(param.maxValue, current + adjustment)));
        }
        lastFitness = fitness;
      } else {
        for (const [path, param] of parameters) {
          const current = currentValues.get(path) ?? param.currentValue;
          currentValues.set(path, Math.max(param.minValue, Math.min(param.maxValue, current - (current - param.currentValue) * 0.1)));
        }
      }

      history.push({ timestamp: Date.now(), config: Object.fromEntries(currentValues), fitness });
      if (history.length > 100) {
        history.shift();
      }

      return { parameters: Object.fromEntries(currentValues), metrics, fitness };
    },

    rollback() {
      if (history.length > 1) {
        history.pop();
        const previous = history[history.length - 1];
        for (const [key, value] of Object.entries(previous.config)) {
          currentValues.set(key, value);
        }
      } else {
        for (const [path, param] of parameters) {
          currentValues.set(path, param.currentValue);
        }
      }
    },

    getHistory() {
      return [...history];
    },

    getSuggestions() {
      const suggestions: ConfigSuggestion[] = [];
      for (const [path, param] of parameters) {
        const current = currentValues.get(path) ?? param.currentValue;
        if (current > param.currentValue * 1.5) {
          suggestions.push({
            parameter: path,
            currentValue: current,
            suggestedValue: param.currentValue,
            reason: `当前值 ${current} 超过默认 ${param.currentValue} 的 50%，建议回归`,
            expectedImprovement: 0.1,
          });
        }
      }
      return suggestions;
    },
  };
}
