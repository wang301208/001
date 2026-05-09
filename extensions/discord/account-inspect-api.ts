import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: AssistantConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
