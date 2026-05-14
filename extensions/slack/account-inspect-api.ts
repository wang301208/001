import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: ZhushouConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
