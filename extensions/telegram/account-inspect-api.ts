import type { AssistantConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: AssistantConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
