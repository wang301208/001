export const ZHUSHOU_CLI_ENV_VAR = "ZHUSHOU_CLI";
export const ZHUSHOU_CLI_ENV_VALUE = "1";

export function markZhushouExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [ZHUSHOU_CLI_ENV_VAR]: ZHUSHOU_CLI_ENV_VALUE,
  };
}

export function ensureZhushouExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[ZHUSHOU_CLI_ENV_VAR] = ZHUSHOU_CLI_ENV_VALUE;
  return env;
}
