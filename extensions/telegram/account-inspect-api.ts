import type { ZhushouConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: ZhushouConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
