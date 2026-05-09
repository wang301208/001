/** Display name for the product in all user-facing wizard text. */
export const PRODUCT_NAME = "助手";

/** CLI binary name — used in command examples shown to users. */
export const CLI_COMMAND = "assistant";

/** Base URL for documentation links. */
export const DOCS_BASE_URL = "https://docs.assistant.ai";

/** Default config file path displayed in wizard messages. */
export const CONFIG_FILE_DEFAULT_PATH = "~/.assistant/assistant.json";

/** Environment variable names referenced in wizard output. */
export const ENV_VARS = {
  GATEWAY_TOKEN: "ASSISTANT_GATEWAY_TOKEN",
  GATEWAY_PASSWORD: "ASSISTANT_GATEWAY_PASSWORD",
  GATEWAY_PORT: "ASSISTANT_GATEWAY_PORT",
  CONFIG_PATH: "ASSISTANT_CONFIG_PATH",
} as const;

export type EnvVarKey = keyof typeof ENV_VARS;

/** Build a docs URL with the given path segment. */
export function docsUrl(path: string): string {
  return `${DOCS_BASE_URL}/${path.replace(/^\//, "")}`;
}
