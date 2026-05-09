import { normalizeOptionalString } from "../shared/string-coerce.js";

type GatewayAuthContainer = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function pruneInactiveGatewayAuthCredentials(root: GatewayAuthContainer): string[] {
  if (!isRecord(root.gateway)) {
    return [];
  }
  const gateway = root.gateway;
  if (!isRecord(gateway.auth)) {
    return [];
  }
  const auth = gateway.auth;
  const mode = normalizeOptionalString(auth.mode) ?? "";

  const removedPaths: string[] = [];
  const remove = (key: "token" | "password") => {
    if (Object.hasOwn(auth, key)) {
      delete auth[key];
      removedPaths.push(`gateway.auth.${key}`);
    }
  };

  if (mode === "token") {
    remove("password");
  } else if (mode === "password") {
    remove("token");
  } else if (mode === "none" || mode === "trusted-proxy") {
    remove("token");
    remove("password");
  }

  return removedPaths;
}
