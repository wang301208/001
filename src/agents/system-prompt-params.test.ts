import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import { buildSystemPromptParams } from "./system-prompt-params.js";

async function makeTempDir(label: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `zhushou-${label}-`));
}

async function makeRepoRoot(root: string): Promise<void> {
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
}

function buildParams(params: {
  config?: ZhushouConfig;
  workspaceDir?: string;
  cwd?: string;
  agentId?: string;
}) {
  return buildSystemPromptParams({
    config: params.config,
    agentId: params.agentId,
    workspaceDir: params.workspaceDir,
    cwd: params.cwd,
    runtime: {
      host: "host",
      os: "os",
      arch: "arch",
      node: "node",
      model: "model",
    },
  });
}

describe("buildSystemPromptParams repo root", () => {
  it("detects repo root from workspaceDir", async () => {
    const temp = await makeTempDir("workspace");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(repoRoot, "nested", "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const { runtimeInfo } = buildParams({ workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("falls back to cwd when workspaceDir has no repo", async () => {
    const temp = await makeTempDir("cwd");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(temp, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const { runtimeInfo } = buildParams({ workspaceDir, cwd: repoRoot });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("uses configured repoRoot when valid", async () => {
    const temp = await makeTempDir("config");
    const repoRoot = path.join(temp, "config-root");
    const workspaceDir = path.join(temp, "workspace");
    await fs.mkdir(repoRoot, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(workspaceDir);

    const config: ZhushouConfig = {
      agents: {
        defaults: {
          repoRoot,
        },
      },
    };

    const { runtimeInfo } = buildParams({ config, workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("ignores invalid repoRoot config and auto-detects", async () => {
    const temp = await makeTempDir("invalid");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(repoRoot, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const config: ZhushouConfig = {
      agents: {
        defaults: {
          repoRoot: path.join(temp, "missing"),
        },
      },
    };

    const { runtimeInfo } = buildParams({ config, workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("returns undefined when no repo is found", async () => {
    const workspaceDir = await makeTempDir("norepo");

    const { runtimeInfo } = buildParams({ workspaceDir });

    expect(runtimeInfo.repoRoot).toBeUndefined();
  });

  it("includes the default profile canvas root in runtimeInfo", async () => {
    const workspaceDir = await makeTempDir("canvas-root");

    const { runtimeInfo } = buildParams({ workspaceDir });

    expect(runtimeInfo.canvasRootDir).toBe(path.resolve(path.join(resolveStateDir(), "canvas")));
  });

  it("includes combined charter and runtime governance prompt when agentId is provided", async () => {
    const workspaceDir = await makeTempDir("governance");
    const config: ZhushouConfig = {
      agents: {
        list: [{ id: "main", workspace: workspaceDir }],
      },
    };

    const { runtimeInfo } = buildParams({
      config,
      workspaceDir,
      agentId: "executor",
    });

    expect(runtimeInfo.governancePrompt).toContain("## Organizational Charter");
    expect(runtimeInfo.governancePrompt).toContain("Charter role: Executor (executor)");
    expect(runtimeInfo.governancePrompt).toContain("## Governance Runtime State");
    expect(runtimeInfo.governancePrompt).toContain("execution=strict-agentic");
    expect(runtimeInfo.governancePrompt).toContain("explicit subagent ids");
  });
});
