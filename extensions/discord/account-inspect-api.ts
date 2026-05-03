import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: ZhushouConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
