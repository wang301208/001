import type { AuthProfileStore } from "../agents/auth-profiles/types.js";
import type { FallbackAttempt } from "../agents/model-fallback.types.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import type {
  GeneratedImageAsset,
  ImageGenerationIgnoredOverride,
  ImageGenerationNormalization,
  ImageGenerationProvider,
  ImageGenerationResolution,
  ImageGenerationSourceImage,
} from "./types.js";

export type GenerateImageParams = {
  cfg: ZhushouConfig;
  prompt: string;
  agentDir?: string;
  authStore?: AuthProfileStore;
  modelOverride?: string;
  count?: number;
  size?: string;
  aspectRatio?: string;
  resolution?: ImageGenerationResolution;
  inputImages?: ImageGenerationSourceImage[];
};

export type GenerateImageRuntimeResult = {
  images: GeneratedImageAsset[];
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
  normalization?: ImageGenerationNormalization;
  metadata?: Record<string, unknown>;
  ignoredOverrides: ImageGenerationIgnoredOverride[];
};

export type ListRuntimeImageGenerationProvidersParams = {
  config?: ZhushouConfig;
};

export type RuntimeImageGenerationProvider = ImageGenerationProvider;
