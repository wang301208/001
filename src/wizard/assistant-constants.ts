/** Display name for the product in all user-facing wizard text. */
export const PRODUCT_NAME = "助手";

/** CLI binary name — used in command examples shown to users. */
export const CLI_COMMAND = "zhushou";

/** Base URL for documentation links. */
export const DOCS_BASE_URL = "https://docs.zhushou.ai";

/** Default config file path displayed in wizard messages. */
export const CONFIG_FILE_DEFAULT_PATH = "~/.zhushou/zhushou.json";

/** Environment variable names referenced in wizard output. */
export const ENV_VARS = {
  GATEWAY_TOKEN: "ZHUSHOU_GATEWAY_TOKEN",
  GATEWAY_PASSWORD: "ZHUSHOU_GATEWAY_PASSWORD",
  GATEWAY_PORT: "ZHUSHOU_GATEWAY_PORT",
  CONFIG_PATH: "ZHUSHOU_CONFIG_PATH",
} as const;

export type EnvVarKey = keyof typeof ENV_VARS;

/** Build a docs URL with the given path segment. */
export function docsUrl(path: string): string {
  return `${DOCS_BASE_URL}/${path.replace(/^\//, "")}`;
}
