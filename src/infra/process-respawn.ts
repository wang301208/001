type RespawnMode = "spawned" | "supervised" | "disabled" | "failed";

export type GatewayRespawnResult = {
  mode: RespawnMode;
  pid?: number;
  detail?: string;
};

/**
 * Attempt to restart this process with a fresh PID.
 * Automatic process respawn is intentionally disabled. Callers that need a
 * restart should keep the existing process and perform an in-process restart.
 */
export function restartGatewayProcessWithFreshPid(): GatewayRespawnResult {
  return {
    mode: "disabled",
    detail: "automatic gateway restart disabled",
  };
}
