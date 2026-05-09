import type { AssistantConfig } from "assistant/plugin-sdk/config-runtime";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<AssistantConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
