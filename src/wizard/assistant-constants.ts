/** Display name for the product in all user-facing wizard text. */
export const PRODUCT_NAME = "助手";

/** CLI binary name — used in command examples shown to users. */
export const CLI_COMMAND = "openclaw";

/** Base URL for documentation links. */
export const DOCS_BASE_URL = "https://docs.openclaw.ai";

/** Default config file path displayed in wizard messages. */
export const CONFIG_FILE_DEFAULT_PATH = "~/.openclaw/openclaw.json";

/** Environment variable names referenced in wizard output. */
export const ENV_VARS = {
  GATEWAY_TOKEN: "OPENCLAW_GATEWAY_TOKEN",
  GATEWAY_PASSWORD: "OPENCLAW_GATEWAY_PASSWORD",
  GATEWAY_PORT: "OPENCLAW_GATEWAY_PORT",
  CONFIG_PATH: "OPENCLAW_CONFIG_PATH",
} as const;

export type EnvVarKey = keyof typeof ENV_VARS;

/** Build a docs URL with the given path segment. */
export function docsUrl(path: string): string {
  return `${DOCS_BASE_URL}/${path.replace(/^\//, "")}`;
}
