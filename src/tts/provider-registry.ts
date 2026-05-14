import type { ZhushouConfig } from "../config/types.js";
import { resolvePluginCapabilityProviders } from "../plugins/capability-provider-runtime.js";
import {
  buildCapabilityProviderMaps,
  normalizeCapabilityProviderId,
} from "../plugins/provider-registry-shared.js";
import type { SpeechProviderPlugin } from "../plugins/types.js";
import type { SpeechProviderId } from "./provider-types.js";

export function normalizeSpeechProviderId(
  providerId: string | undefined,
): SpeechProviderId | undefined {
  return normalizeCapabilityProviderId(providerId);
}

function resolveSpeechProviderPluginEntries(cfg?: ZhushouConfig): SpeechProviderPlugin[] {
  return resolvePluginCapabilityProviders({
    key: "speechProviders",
    cfg,
  });
}

function buildProviderMaps(cfg?: ZhushouConfig): {
  canonical: Map<string, SpeechProviderPlugin>;
  aliases: Map<string, SpeechProviderPlugin>;
} {
  return buildCapabilityProviderMaps(resolveSpeechProviderPluginEntries(cfg));
}

export function listSpeechProviders(cfg?: ZhushouConfig): SpeechProviderPlugin[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

export function getSpeechProvider(
  providerId: string | undefined,
  cfg?: ZhushouConfig,
): SpeechProviderPlugin | undefined {
  const normalized = normalizeSpeechProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}

export function canonicalizeSpeechProviderId(
  providerId: string | undefined,
  cfg?: ZhushouConfig,
): SpeechProviderId | undefined {
  const normalized = normalizeSpeechProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return getSpeechProvider(normalized, cfg)?.id ?? normalized;
}
