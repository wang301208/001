import type { ChannelDoctorConfigMutation } from "zhushou/plugin-sdk/channel-contract";
import type { ZhushouConfig } from "zhushou/plugin-sdk/config-runtime";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: ZhushouConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
