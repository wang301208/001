import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<ZhushouConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
