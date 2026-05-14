export { DEFAULT_ACCOUNT_ID } from "zhushou/plugin-sdk/account-id";
export {
  buildTokenChannelStatusSummary,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
} from "zhushou/plugin-sdk/channel-status";
export { createScopedChannelConfigAdapter } from "zhushou/plugin-sdk/channel-config-helpers";
export type { ChannelPlugin } from "zhushou/plugin-sdk/channel-core";
export type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";

const DISCORD_CHANNEL_META = {
  id: "discord",
  label: "Discord",
  selectionLabel: "Discord (Bot API)",
  detailLabel: "Discord Bot",
  docsPath: "/channels/discord",
  docsLabel: "discord",
  blurb: "very well supported right now.",
  systemImage: "bubble.left.and.bubble.right",
  markdownCapable: true,
} as const;

export function getChatChannelMeta(id: string) {
  if (id !== DISCORD_CHANNEL_META.id) {
    throw new Error(`Unsupported Discord channel meta lookup: ${id}`);
  }
  return DISCORD_CHANNEL_META;
}
