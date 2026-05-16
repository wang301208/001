export type ProviderResponse = {
  ok: true;
  data: unknown;
  latencyMs: number;
  tokensUsed?: { prompt: number; completion: number; total: number };
  costUsd?: number;
} | {
  ok: false;
  error: string;
  status: number;
  retryable: boolean;
};

export type ModelProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  priority: number;
  maxConcurrency: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  costPerToken?: { prompt: number; completion: number };
  latencyProfile?: { p50Ms: number; p99Ms: number };
  customHeaders?: Record<string, string>;

  chatCompletion(request: Request, signal?: AbortSignal): Promise<ProviderResponse>;
  embedding?(request: Request, signal?: AbortSignal): Promise<ProviderResponse>;
  healthCheck(): Promise<boolean>;
};
