import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveSandboxContext } from "./sandbox/context.js";

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempCharter<T>(
  fn: (params: { root: string; charterDir: string }) => Promise<T>,
): Promise<T> {
  return await withTempDir("openclaw-sandbox-governance-", async (root) => {
    const charterDir = path.join(root, "governance", "charter");
    await mkdir(path.join(charterDir, "policies"), { recursive: true });
    await writeFile(
      path.join(charterDir, "constitution.yaml"),
      [
        "version: 1",
        "charter_artifacts:",
        "  policies:",
        '    - "governance/charter/policies/sovereignty.yaml"',
        '    - "governance/charter/policies/evolution-policy.yaml"',
        "sovereign_boundaries:",
        "  human_reserved_powers:",
        '    - "external_high_risk_network_opening"',
        '    - "root_privilege_expansion"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(charterDir, "policies", "sovereignty.yaml"),
      [
        "version: 1",
        "reserved_authorities:",
        "  human_sovereign_only:",
        '    - "global_high_risk_network_opening"',
        '    - "root_privilege_expansion"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(charterDir, "policies", "evolution-policy.yaml"),
      "version: 1\n",
      "utf8",
    );
    return await fn({ root, charterDir });
  });
}

describe("sandbox governance freeze context", () => {
  it("returns a read-only sandbox context without creating a backend when governance is frozen", async () => {
    await withTempCharter(async ({ root, charterDir }) => {
      const workspaceDir = path.join(root, "workspace");
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, "note.txt"), "sandbox copy", "utf8");

      const cfg: OpenClawConfig = {
        gateway: {
          bind: "lan",
        },
        agents: {
          defaults: {
            sandbox: {
              mode: "all",
              backend: "unknown-backend",
              scope: "session",
              workspaceAccess: "ro",
            },
            skipBootstrap: true,
          },
        },
      };

      const sandbox = await resolveSandboxContext({
        config: cfg,
        charterDir,
        sessionKey: "agent:main:worker",
        workspaceDir,
      });

      expect(sandbox).toBeTruthy();
      expect(sandbox?.backend).toBeUndefined();
      expect(sandbox?.governance).toMatchObject({
        frozen: true,
      });
      expect(sandbox?.runtimeLabel).toBe("Governance Frozen");
      expect(sandbox?.browser).toBeUndefined();

      const content = await sandbox?.fsBridge?.readFile({
        filePath: "/agent/note.txt",
        cwd: sandbox.workspaceDir,
      });
      expect(content?.toString("utf8")).toBe("sandbox copy");

      await expect(
        sandbox?.fsBridge?.writeFile({
          filePath: "blocked.txt",
          cwd: sandbox.workspaceDir,
          data: "blocked",
        }) ?? Promise.reject(new Error("missing fsBridge")),
      ).rejects.toThrow(/governance policy/i);
    });
  });
});
