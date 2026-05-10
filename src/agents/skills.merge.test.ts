import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeSkill } from "./skills.e2e-test-helpers.js";
import { mergeWorkspaceSkills } from "./skills.js";

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("mergeWorkspaceSkills", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-skills-merge-"));
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("deduplicates identical files, reports conflicting files, and creates a new merged skill", async () => {
    const alphaDir = path.join(workspaceDir, "skills", "alpha");
    const betaDir = path.join(workspaceDir, "skills", "beta");
    await writeSkill({
      dir: alphaDir,
      name: "alpha",
      description: "Alpha workflow",
      body: ["# Alpha", "", "Shared step.", "", "Alpha-only step."].join("\n"),
    });
    await writeSkill({
      dir: betaDir,
      name: "beta",
      description: "Beta workflow",
      body: ["# Beta", "", "Shared step.", "", "Beta-only step."].join("\n"),
    });
    await fs.mkdir(path.join(alphaDir, "scripts"), { recursive: true });
    await fs.mkdir(path.join(betaDir, "scripts"), { recursive: true });
    await fs.writeFile(path.join(alphaDir, "scripts", "shared.js"), "export const shared = true;\n");
    await fs.writeFile(path.join(betaDir, "scripts", "shared.js"), "export const shared = true;\n");
    await fs.writeFile(path.join(alphaDir, "scripts", "alpha.js"), "export const alpha = true;\n");
    await fs.writeFile(path.join(betaDir, "scripts", "beta.js"), "export const beta = true;\n");
    await fs.writeFile(path.join(alphaDir, "config.json"), "{\"source\":\"alpha\"}\n");
    await fs.writeFile(path.join(betaDir, "config.json"), "{\"source\":\"beta\"}\n");

    const result = await mergeWorkspaceSkills({
      workspaceDir,
      sourceSkillNames: ["alpha", "beta"],
      targetName: "alpha-beta",
      description: "Merged alpha and beta workflow",
    });

    const targetDir = path.join(workspaceDir, "skills", "alpha-beta");
    expect(result).toMatchObject({
      ok: true,
      targetSkillName: "alpha-beta",
      sourceSkills: ["alpha", "beta"],
      targetDir,
    });
    expect(result.deduplicatedFiles).toContain("scripts/shared.js");
    expect(result.conflicts).toEqual([
      {
        path: "config.json",
        sources: ["alpha", "beta"],
        resolution: "namespaced",
      },
    ]);

    const skillMd = await readText(path.join(targetDir, "SKILL.md"));
    expect(skillMd).toContain("name: alpha-beta");
    expect(skillMd).toContain("description: Merged alpha and beta workflow");
    expect(skillMd).toContain("Sources");
    expect(skillMd).toContain("alpha");
    expect(skillMd).toContain("beta");
    expect(skillMd.match(/Shared step\./g)).toHaveLength(1);
    expect(skillMd).toContain("Alpha-only step.");
    expect(skillMd).toContain("Beta-only step.");

    expect(await readText(path.join(targetDir, "scripts", "shared.js"))).toBe(
      "export const shared = true;\n",
    );
    expect(await pathExists(path.join(targetDir, "scripts", "alpha.js"))).toBe(true);
    expect(await pathExists(path.join(targetDir, "scripts", "beta.js"))).toBe(true);
    expect(await readText(path.join(targetDir, "merged-assets", "alpha", "config.json"))).toBe(
      "{\"source\":\"alpha\"}\n",
    );
    expect(await readText(path.join(targetDir, "merged-assets", "beta", "config.json"))).toBe(
      "{\"source\":\"beta\"}\n",
    );
  });

  it("can reject conflicting files before creating the target skill", async () => {
    const alphaDir = path.join(workspaceDir, "skills", "alpha");
    const betaDir = path.join(workspaceDir, "skills", "beta");
    await writeSkill({ dir: alphaDir, name: "alpha", description: "Alpha workflow" });
    await writeSkill({ dir: betaDir, name: "beta", description: "Beta workflow" });
    await fs.writeFile(path.join(alphaDir, "tool.txt"), "alpha\n");
    await fs.writeFile(path.join(betaDir, "tool.txt"), "beta\n");

    await expect(
      mergeWorkspaceSkills({
        workspaceDir,
        sourceSkillNames: ["alpha", "beta"],
        targetName: "strict-merge",
        conflictStrategy: "fail",
      }),
    ).rejects.toThrow('Conflicting skill file "tool.txt"');

    expect(await pathExists(path.join(workspaceDir, "skills", "strict-merge"))).toBe(false);
  });
});
