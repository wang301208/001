import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<AssistantConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
