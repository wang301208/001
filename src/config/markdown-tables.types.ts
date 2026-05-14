import type { MarkdownTableMode } from "./types.base.js";
import type { ZhushouConfig } from "./types.zhushou.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<ZhushouConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
