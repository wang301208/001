import { listKnownChannelEnvVarNames } from "../secrets/channel-env-vars.js";
import { listKnownProviderAuthEnvVarNames } from "../secrets/provider-env-vars.js";

const CORE_SHELL_ENV_EXPECTED_KEYS = ["ZHUSHOU_GATEWAY_TOKEN", "ZHUSHOU_GATEWAY_PASSWORD"];

export function resolveShellEnvExpectedKeys(env: NodeJS.ProcessEnv): string[] {
  return [
    ...new Set([
      ...listKnownProviderAuthEnvVarNames({ env }),
      ...listKnownChannelEnvVarNames({ env }),
      ...CORE_SHELL_ENV_EXPECTED_KEYS,
    ]),
  ];
}
