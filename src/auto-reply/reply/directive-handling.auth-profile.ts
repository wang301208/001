import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { resolveDirectiveHandlingAuthProfileStore } from "./directive-handling.auth-store.js";

export function resolveProfileOverride(params: {
  rawProfile?: string;
  provider: string;
  cfg: OpenClawConfig;
  agentDir?: string;
}): { profileId?: string; error?: string } {
  const raw = normalizeOptionalString(params.rawProfile);
  if (!raw) {
    return {};
  }
  const store = resolveDirectiveHandlingAuthProfileStore(params.agentDir);
  const profile = store.profiles[raw];
  if (!profile) {
    return { error: `Auth profile "${raw}" not found.` };
  }
  if (profile.provider !== params.provider) {
    return {
      error: `Auth profile "${raw}" is for ${profile.provider}, not ${params.provider}.`,
    };
  }
  return { profileId: raw };
}
