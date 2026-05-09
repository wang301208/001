import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { AssistantConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): AssistantConfig | null {
  return null;
}
