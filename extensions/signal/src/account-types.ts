import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<ZhushouConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
