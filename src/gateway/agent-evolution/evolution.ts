export type PromptGene = {
  id: string;
  systemPrompt: string;
  temperature: number;
  fitness: number;
  generation: number;
  mutations: string[];
};

export type EvolutionConfig = {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  fitnessThreshold: number;
};

export type EvolutionResult = {
  bestGene: PromptGene;
  generations: number;
  totalEvaluations: number;
  convergence: boolean;
  history: { generation: number; bestFitness: number; avgFitness: number }[];
};

export type FitnessEvaluator = (gene: PromptGene) => Promise<number>;

export function createPromptEvolution(config?: Partial<EvolutionConfig>) {
  const cfg: EvolutionConfig = {
    populationSize: 20,
    maxGenerations: 50,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    eliteRatio: 0.2,
    fitnessThreshold: 0.95,
    ...config,
  };

  const population: PromptGene[] = [];
  let generation = 0;

  function mutate(gene: PromptGene): PromptGene {
    const mutations: string[] = [...gene.mutations];
    let prompt = gene.systemPrompt;
    let temperature = gene.temperature;

    if (Math.random() < cfg.mutationRate) {
      const additions = [
        "\nAlways be concise and direct.",
        "\nPrioritize accuracy over creativity.",
        "\nStructure your response with clear sections.",
        "\nUse examples to illustrate key points.",
        "\nVerify your reasoning before responding.",
        "\nConsider edge cases in your analysis.",
        "\nBreak complex problems into steps.",
      ];
      const addition = additions[Math.floor(Math.random() * additions.length)];
      prompt += addition;
      mutations.push(`added: ${addition.slice(0, 30)}`);
    }

    if (Math.random() < cfg.mutationRate) {
      const sentences = prompt.split("\n");
      if (sentences.length > 3) {
        const idx = Math.floor(Math.random() * sentences.length);
        sentences.splice(idx, 1);
        prompt = sentences.join("\n");
        mutations.push("removed-sentence");
      }
    }

    if (Math.random() < cfg.mutationRate * 0.5) {
      temperature = Math.max(0, Math.min(2, temperature + (Math.random() - 0.5) * 0.2));
      mutations.push(`temp-adjust: ${temperature.toFixed(2)}`);
    }

    return {
      id: crypto.randomUUID(),
      systemPrompt: prompt,
      temperature,
      fitness: 0,
      generation: gene.generation + 1,
      mutations,
    };
  }

  function crossover(parent1: PromptGene, parent2: PromptGene): PromptGene {
    const lines1 = parent1.systemPrompt.split("\n");
    const lines2 = parent2.systemPrompt.split("\n");
    const crossoverPoint = Math.floor(Math.random() * Math.min(lines1.length, lines2.length));
    const childPrompt = [...lines1.slice(0, crossoverPoint), ...lines2.slice(crossoverPoint)].join("\n");
    return {
      id: crypto.randomUUID(),
      systemPrompt: childPrompt,
      temperature: (parent1.temperature + parent2.temperature) / 2,
      fitness: 0,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      mutations: [`crossover: ${parent1.id.slice(0, 8)} + ${parent2.id.slice(0, 8)}`],
    };
  }

  function selectByTournament(tournamentSize = 3): PromptGene {
    const candidates: PromptGene[] = [];
    for (let i = 0; i < Math.min(tournamentSize, population.length); i++) {
      candidates.push(population[Math.floor(Math.random() * population.length)]);
    }
    return candidates.reduce((best, c) => (c.fitness > best.fitness ? c : best));
  }

  return {
    seed(initialPrompts: string[]): void {
      population.length = 0;
      generation = 0;
      for (let i = 0; i < cfg.populationSize; i++) {
        const basePrompt = initialPrompts[i % initialPrompts.length];
        population.push({
          id: crypto.randomUUID(),
          systemPrompt: basePrompt,
          temperature: 0.7,
          fitness: 0,
          generation: 0,
          mutations: [],
        });
      }
    },

    async evolve(evaluator: FitnessEvaluator): Promise<EvolutionResult> {
      const history: EvolutionResult["history"] = [];
      let totalEvaluations = 0;

      for (let gen = 0; gen < cfg.maxGenerations; gen++) {
        generation = gen;

        for (const gene of population) {
          if (gene.fitness === 0) {
            gene.fitness = await evaluator(gene);
            totalEvaluations++;
          }
        }

        population.sort((a, b) => b.fitness - a.fitness);

        const bestFitness = population[0].fitness;
        const avgFitness = population.reduce((s, g) => s + g.fitness, 0) / population.length;
        history.push({ generation: gen, bestFitness, avgFitness });

        if (bestFitness >= cfg.fitnessThreshold) {
          return { bestGene: population[0], generations: gen + 1, totalEvaluations, convergence: true, history };
        }

        const eliteCount = Math.ceil(cfg.populationSize * cfg.eliteRatio);
        const nextGen: PromptGene[] = population.slice(0, eliteCount);

        while (nextGen.length < cfg.populationSize) {
          if (Math.random() < cfg.crossoverRate) {
            const parent1 = selectByTournament();
            const parent2 = selectByTournament();
            const child = crossover(parent1, parent2);
            nextGen.push(mutate(child));
          } else {
            const parent = selectByTournament();
            nextGen.push(mutate(parent));
          }
        }

        population.length = 0;
        population.push(...nextGen.slice(0, cfg.populationSize));
      }

      population.sort((a, b) => b.fitness - a.fitness);
      return {
        bestGene: population[0],
        generations: cfg.maxGenerations,
        totalEvaluations,
        convergence: false,
        history,
      };
    },

    getPopulation(): readonly PromptGene[] {
      return population;
    },

    getGeneration(): number {
      return generation;
    },
  };
}

export type AdversarialEvaluator = {
  evaluate(gene: PromptGene): Promise<{ score: number; critique: string }>;
};

export function createAdversarialEvaluator(): AdversarialEvaluator {
  return {
    async evaluate(gene) {
      const lengthScore = Math.min(gene.systemPrompt.length / 500, 1) * 0.3;
      const structureScore = gene.systemPrompt.includes("\n") ? 0.3 : 0.1;
      const diversityScore = gene.mutations.length > 0 ? 0.2 : 0;
      const tempScore = gene.temperature >= 0.3 && gene.temperature <= 1.0 ? 0.2 : 0.1;
      const score = lengthScore + structureScore + diversityScore + tempScore;
      return {
        score,
        critique: score > 0.7 ? "Strong prompt with good structure" : "Prompt needs improvement",
      };
    },
  };
}
