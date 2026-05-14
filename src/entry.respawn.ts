export const EXPERIMENTAL_WARNING_FLAG = "--disable-warning=ExperimentalWarning";
export const ZHUSHOU_NODE_OPTIONS_READY = "ZHUSHOU_NODE_OPTIONS_READY";
export const ZHUSHOU_NODE_EXTRA_CA_CERTS_READY = "ZHUSHOU_NODE_EXTRA_CA_CERTS_READY";

export function hasExperimentalWarningSuppressed(
  params: {
    env?: NodeJS.ProcessEnv;
    execArgv?: string[];
  } = {},
): boolean {
  const env = params.env ?? process.env;
  const execArgv = params.execArgv ?? process.execArgv;
  const nodeOptions = env.NODE_OPTIONS ?? "";
  if (nodeOptions.includes(EXPERIMENTAL_WARNING_FLAG) || nodeOptions.includes("--no-warnings")) {
    return true;
  }
  return execArgv.some((arg) => arg === EXPERIMENTAL_WARNING_FLAG || arg === "--no-warnings");
}

export function buildCliRespawnPlan(
  params: {
    argv?: string[];
    env?: NodeJS.ProcessEnv;
    execArgv?: string[];
    execPath?: string;
    autoNodeExtraCaCerts?: string | undefined;
  } = {},
): { argv: string[]; env: NodeJS.ProcessEnv } | null {
  void params;
  return null;
}
