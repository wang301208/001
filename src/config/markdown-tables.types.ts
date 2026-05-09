import type { MarkdownTableMode } from "./types.base.js";
import type { AssistantConfig } from "./types.assistant.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<AssistantConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
