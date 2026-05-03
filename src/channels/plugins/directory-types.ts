import type { ZhushouConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: ZhushouConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
