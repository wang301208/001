// Defaults for agent metadata when upstream does not supply them.
// Keep this aligned with the product-level latest-model baseline.
export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_MODEL = "gpt-4o";
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;

// Fallback models in order of preference if default is unavailable
export const FALLBACK_MODELS = [
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
] as const;

export function resolveDefaultModelFallback(params: {
  availableModels: string[];
}): string {
  for (const candidate of FALLBACK_MODELS) {
    if (params.availableModels.includes(candidate)) {
      return candidate;
    }
  }
  return DEFAULT_MODEL;
}
