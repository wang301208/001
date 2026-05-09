import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: AssistantConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
