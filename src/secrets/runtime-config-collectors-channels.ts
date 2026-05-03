import { getBootstrapChannelSecrets } from "../channels/plugins/bootstrap-registry.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { loadBundledChannelSecretContractApi } from "./channel-contract-api.js";
import { type ResolverContext, type SecretDefaults } from "./runtime-shared.js";

export function collectChannelConfigAssignments(params: {
  config: ZhushouConfig;
  defaults: SecretDefaults | undefined;
  context: ResolverContext;
}): void {
  const channelIds = Object.keys(params.config.channels ?? {});
  if (channelIds.length === 0) {
    return;
  }
  for (const channelId of channelIds) {
    const contract = loadBundledChannelSecretContractApi(channelId);
    const collectRuntimeConfigAssignments =
      contract?.collectRuntimeConfigAssignments ??
      getBootstrapChannelSecrets(channelId)?.collectRuntimeConfigAssignments;
    collectRuntimeConfigAssignments?.(params);
  }
}
