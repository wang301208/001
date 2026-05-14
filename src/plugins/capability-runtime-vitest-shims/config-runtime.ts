import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { ZhushouConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): ZhushouConfig | null {
  return null;
}
