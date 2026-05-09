import { buildChannelConfigSchema, GoogleChatConfigSchema } from "assistant/plugin-sdk/googlechat";

export const GoogleChatChannelConfigSchema = buildChannelConfigSchema(GoogleChatConfigSchema);
