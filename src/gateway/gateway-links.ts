import {
  inspectBestEffortPrimaryTailnetIPv4,
  pickBestEffortPrimaryLanIPv4,
} from "../infra/network-discovery-display.js";
import { isValidIPv4 } from "./net.js";

export type GatewayBindMode = "auto" | "lan" | "loopback" | "custom" | "tailnet";

export function resolveGatewayHost(params: {
  bind?: GatewayBindMode;
  customBindHost?: string;
}): string {
  const bind = params.bind ?? "loopback";
  const customBindHost = params.customBindHost?.trim();
  const { tailnetIPv4 } = inspectBestEffortPrimaryTailnetIPv4();
  if (bind === "custom" && customBindHost && isValidIPv4(customBindHost)) {
    return customBindHost;
  }
  if (bind === "tailnet" && tailnetIPv4) {
    return tailnetIPv4;
  }
  if (bind === "lan") {
    return pickBestEffortPrimaryLanIPv4() ?? "127.0.0.1";
  }
  return "127.0.0.1";
}

export function resolveGatewayLinks(params: {
  port: number;
  bind?: GatewayBindMode;
  customBindHost?: string;
}): { httpUrl: string; wsUrl: string } {
  const host = resolveGatewayHost({
    bind: params.bind,
    customBindHost: params.customBindHost,
  });
  return {
    httpUrl: `http://${host}:${params.port}`,
    wsUrl: `ws://${host}:${params.port}`,
  };
}
