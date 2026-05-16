import type { ModelProvider } from "./provider.js";

export type FallbackChainEntry = {
  provider: ModelProvider;
  model: string;
  priority: number;
};

export class ModelFallbackChain {
  private chain: FallbackChainEntry[] = [];

  add(provider: ModelProvider, model: string, priority: number): void {
    this.chain.push({ provider, model, priority });
    this.chain.sort((a, b) => a.priority - b.priority);
  }

  getChain(): readonly FallbackChainEntry[] {
    return this.chain;
  }

  getNextAfter(providerId: string, model: string): FallbackChainEntry | undefined {
    const idx = this.chain.findIndex((e) => e.provider.id === providerId && e.model === model);
    if (idx === -1 || idx >= this.chain.length - 1) {return undefined;}
    return this.chain[idx + 1];
  }

  getForModel(model: string): FallbackChainEntry[] {
    const direct = this.chain.filter((e) => e.model === model);
    if (direct.length > 0) {return direct;}
    const prefix = model.split(":")[0];
    return this.chain.filter((e) => e.model.startsWith(prefix) || e.provider.models.some((m) => m === model));
  }

  remove(providerId: string, model: string): void {
    this.chain = this.chain.filter((e) => !(e.provider.id === providerId && e.model === model));
  }

  clear(): void {
    this.chain = [];
  }
}
