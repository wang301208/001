import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<ZhushouConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
