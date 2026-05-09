import type { AssistantConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: AssistantConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
