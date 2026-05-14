import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";

export function registerStdioGatewayCli(program: Command) {
  program
    .command("stdio-gateway", { hidden: true })
    .description("Run the embedded Node gateway over stdin/stdout JSON-RPC")
    .action(async () => {
      try {
        const { runGatewayStdioBridge } = await import("../gateway/stdio-bridge.js");
        await runGatewayStdioBridge();
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
