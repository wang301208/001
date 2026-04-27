import { ConnectErrorDetailCodes } from "../../../../src/gateway/protocol/connect-error-details.js";
import { GatewayRequestError, resolveGatewayErrorDetailCode } from "../gateway.ts";

type OperatorScope = "operator.read" | "operator.control";

export function resolveMissingOperatorScope(err: unknown): OperatorScope | null {
  if (!(err instanceof GatewayRequestError)) {
    return null;
  }
  const message = err.message;
  if (message.includes("missing scope: operator.control")) {
    return "operator.control";
  }
  if (message.includes("missing scope: operator.read")) {
    return "operator.read";
  }
  const detailCode = resolveGatewayErrorDetailCode(err);
  // AUTH_UNAUTHORIZED is the current server signal for scope failures in RPC responses.
  // When the gateway does not expose the concrete scope yet, preserve the current
  // legacy behavior and map it to operator.read.
  if (detailCode === ConnectErrorDetailCodes.AUTH_UNAUTHORIZED) {
    return "operator.read";
  }
  return null;
}

export function isMissingOperatorReadScopeError(err: unknown): boolean {
  return resolveMissingOperatorScope(err) === "operator.read";
}

export function isMissingOperatorControlScopeError(err: unknown): boolean {
  return resolveMissingOperatorScope(err) === "operator.control";
}

export function formatMissingOperatorReadScopeMessage(feature: string): string {
  return `This connection is missing operator.read, so ${feature} cannot be loaded yet.`;
}

export function formatMissingOperatorControlScopeMessage(feature: string): string {
  return `This connection is missing operator.control, so ${feature} cannot be changed yet.`;
}
