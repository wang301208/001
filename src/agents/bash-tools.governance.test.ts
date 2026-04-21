import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import "./test-helpers/fast-coding-tools.js";
import "./test-helpers/fast-openclaw-tools.js";
import type { OpenClawConfig } from "../config/config.js";
import { createExecTool } from "./bash-tools.exec.js";
import { createProcessTool } from "./bash-tools.process.js";
import { createOpenClawCodingTools } from "./pi-tools.js";

async function withTempCharterRoot<T>(
  fn: (params: { root: string; charterDir: string }) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-bash-governance-"));
  const charterDir = path.join(root, "governance", "charter");
  await mkdir(path.join(charterDir, "policies"), { recursive: true });
  try {
    return await fn({ root, charterDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function seedMinimalCharter(charterDir: string): Promise<void> {
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
}

function getTextContent(result: { content: Array<{ type?: string; text?: string }> }): string {
  return result.content.find((part) => part.type === "text")?.text ?? "";
}

describe("bash tool governance freeze", () => {
  it("filters exec and process from coding tools when governance freeze is active", async () => {
    await withTempCharterRoot(async ({ root, charterDir }) => {
      await seedMinimalCharter(charterDir);
      const workspaceDir = path.join(root, "workspace");
      await mkdir(workspaceDir, { recursive: true });

      const cfg = {
        gateway: {
          bind: "lan",
        },
      } satisfies OpenClawConfig;

      const tools = createOpenClawCodingTools({
        workspaceDir,
        config: cfg,
        charterDir,
      });

      expect(tools.some((tool) => tool.name === "exec")).toBe(false);
      expect(tools.some((tool) => tool.name === "process")).toBe(false);
      expect(tools.some((tool) => tool.name === "read")).toBe(true);
    });
  });

  it("blocks exec at the tool boundary when governance freeze is active", async () => {
    await withTempCharterRoot(async ({ charterDir }) => {
      await seedMinimalCharter(charterDir);
      const cfg = {
        gateway: {
          bind: "lan",
        },
      } satisfies OpenClawConfig;

      const tool = createExecTool({
        host: "gateway",
        security: "full",
        ask: "off",
        config: cfg,
        charterDir,
      });
      const result = await tool.execute("governance-exec", {
        command: "echo should-not-run",
      });

      expect(result.details).toMatchObject({
        status: "failed",
        exitCode: null,
        durationMs: 0,
        aggregated: "",
      });
      const text = getTextContent(result);
      expect(text).toContain("frozen by governance policy");
      expect(text).toContain("gateway.bind=lan");
    });
  });

  it("blocks process at the tool boundary when governance freeze is active", async () => {
    await withTempCharterRoot(async ({ charterDir }) => {
      await seedMinimalCharter(charterDir);
      const cfg = {
        gateway: {
          bind: "lan",
        },
      } satisfies OpenClawConfig;

      const tool = createProcessTool({
        config: cfg,
        charterDir,
      });
      const result = await tool.execute("governance-process", {
        action: "list",
      });

      expect(result.details).toMatchObject({ status: "failed" });
      const text = getTextContent(result);
      expect(text).toContain("frozen by governance policy");
      expect(text).toContain("gateway.bind=lan");
    });
  });
});
