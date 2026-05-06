import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";

export type ChatType = "direct" | "group" | "channel";
export type ChannelType =
  | "matrix"
  | "slack"
  | "discord"
  | "telegram"
  | "whatsapp"
  | "feishu"
  | "line"
  | ChatType;

export function normalizeChatType(raw?: string): ChatType | undefined {
  const value = normalizeOptionalLowercaseString(raw);
  if (!value) {
    return undefined;
  }
  if (value === "direct" || value === "dm") {
    return "direct";
  }
  if (value === "group") {
    return "group";
  }
  if (value === "channel") {
    return "channel";
  }
  return undefined;
}
