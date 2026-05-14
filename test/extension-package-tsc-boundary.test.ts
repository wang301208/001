import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CHECK_EXTENSION_PACKAGE_BOUNDARY_BIN = resolve(
  REPO_ROOT,
  "scripts/check-extension-package-tsc-boundary.mjs",
);
const SHOULD_RUN_BOUNDARY_SCRIPT_WRAPPER =
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.ZHUSHOU_RUN_EXTENSION_PACKAGE_BOUNDARY_TEST === "1";

function runNode(args: string[], timeout: number): Promise<{
  error?: Error;
  status: number | null;
  stderr: string;
  stdout: string;
}> {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolveResult({
        error: new Error(`timed out after ${timeout}ms`),
        status: null,
        stdout,
        stderr,
      });
    }, timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      clearTimeout(timer);
      settled = true;
      resolveResult({ error, status: null, stdout, stderr });
    });
    child.on("close", (status) => {
      if (settled) {
        return;
      }
      clearTimeout(timer);
      settled = true;
      resolveResult({ status, stdout, stderr });
    });
  });
}

const formatRunFailure = (result: Awaited<ReturnType<typeof runNode>>) =>
  `${result.stdout}\n${result.stderr}\n${result.error?.message ?? ""}`;

// The CI check-additional job runs this script directly. Avoid duplicating the cold
// 97-extension compile inside the full node test shard.
describe.skipIf(!SHOULD_RUN_BOUNDARY_SCRIPT_WRAPPER)(
  "opt-in extension package TypeScript boundaries",
  () => {
    it("typechecks each opt-in extension cleanly through @zhushou/plugin-sdk", async () => {
      const result = await runNode(
        [CHECK_EXTENSION_PACKAGE_BOUNDARY_BIN, "--mode=compile"],
        420_000,
      );
      expect(result.status, formatRunFailure(result)).toBe(0);
    }, 450_000);

    it("fails when opt-in extensions import src/cli through a relative path", async () => {
      const result = await runNode([CHECK_EXTENSION_PACKAGE_BOUNDARY_BIN, "--mode=canary"], 180_000);
      expect(result.status, formatRunFailure(result)).toBe(0);
    }, 210_000);
  },
);
