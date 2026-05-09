import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<AssistantConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
