import type { Hono } from "hono";
import type { GatewayHonoEnv } from "../app.js";

export function registerMetricsRoutes(app: Hono<GatewayHonoEnv>): void {
  app.get("/metrics", (c) => {
    const gateway = c.get("gateway");
    const readiness = gateway.getReadiness?.();
    const ready = readiness?.ready ? 1 : 0;
    const failing = readiness?.failing ?? [];
    const uptimeMs = readiness?.uptimeMs ?? process.uptime() * 1000;

    const lines: string[] = [];
    writeGauge(lines, "zhushou_gateway_up", "Whether the zhushou gateway HTTP server is responding.", 1);
    writeGauge(lines, "zhushou_gateway_ready", "Whether the zhushou gateway reports readiness.", ready);
    writeGauge(lines, "zhushou_gateway_uptime_seconds", "Zhushou gateway uptime in seconds.", uptimeMs / 1000);
    writeGauge(lines, "zhushou_gateway_failing_dependencies", "Number of dependencies failing readiness checks.", failing.length);
    for (const dep of failing) {
      writeGauge(lines, "zhushou_gateway_dependency_ready", "Readiness of a named zhushou gateway dependency.", 0, { dependency: dep });
    }

    c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    c.header("Cache-Control", "no-store");
    return c.text(`${lines.join("\n")}\n`);
  });
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function writeGauge(
  lines: string[],
  name: string,
  help: string,
  value: number,
  labels?: Record<string, string>,
): void {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  const labelStr = labels
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(",")}}`
    : "";
  lines.push(`${name}${labelStr} ${value}`);
}
