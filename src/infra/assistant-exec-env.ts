export const ASSISTANT_CLI_ENV_VAR = "ASSISTANT_CLI";
export const ASSISTANT_CLI_ENV_VALUE = "1";

export function markAssistantExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [ASSISTANT_CLI_ENV_VAR]: ASSISTANT_CLI_ENV_VALUE,
  };
}

export function ensureAssistantExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[ASSISTANT_CLI_ENV_VAR] = ASSISTANT_CLI_ENV_VALUE;
  return env;
}
