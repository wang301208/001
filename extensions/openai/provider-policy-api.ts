import type { ModelProviderConfig } from "zhushou/plugin-sdk/provider-model-types";

export function normalizeConfig(params: { provider: string; providerConfig: ModelProviderConfig }) {
  return params.providerConfig;
}
