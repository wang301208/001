import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveGovernanceCharterDir } from "./charter-paths.js";

describe("governance charter path resolution", () => {
  it("resolves charter directory from package root instead of compiled module depth", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "assistant-charter-cwd-"));
    const packageRoot = await mkdtemp(path.join(os.tmpdir(), "assistant-charter-paths-"));
    try {
      await mkdir(path.join(packageRoot, "dist"), { recursive: true });
      await mkdir(path.join(packageRoot, "governance", "charter"), { recursive: true });
      await writeFile(path.join(packageRoot, "package.json"), '{"name":"assistant"}\n', "utf8");

      const moduleUrl = pathToFileURL(path.join(packageRoot, "dist", "charter-runtime.js")).href;

      expect(
        resolveGovernanceCharterDir({
          moduleUrl,
          argv1: path.join(packageRoot, "assistant.mjs"),
          cwd,
        }),
      ).toBe(path.join(packageRoot, "governance", "charter"));
    } finally {
      await rm(packageRoot, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
