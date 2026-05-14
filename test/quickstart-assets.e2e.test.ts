import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("quickstart assets", () => {
  it("documents install, setup, and first conversation from the repository root", () => {
    const readme = readRepoFile("README.md");
    const quickstart = readRepoFile("docs/quickstart.md");

    for (const text of [readme, quickstart]) {
      expect(text).toContain("pnpm install");
      expect(text).toContain("pnpm build");
      expect(text).toContain("zhushou onboard");
      expect(text).toContain("zhushou tui");
      expect(text).toContain("zhushou tui --message");
    }
  });

  it("documents CLI commands, key bindings, personality, and sessions", () => {
    const cli = readRepoFile("docs/cli.md");

    expect(cli).toContain("Ctrl+L");
    expect(cli).toContain("Ctrl+G");
    expect(cli).toContain("Ctrl+P");
    expect(cli).toContain("Shift+Tab");
    expect(cli).toContain("/session");
    expect(cli).toContain("/model");
    expect(cli).toContain("systemPromptOverride");
  });

  it("documents config path, providers, models, and option discovery", () => {
    const config = readRepoFile("docs/configuration.md");

    expect(config).toContain("~/.wang301208/zhushou.json");
    expect(config).toContain("ZHUSHOU_STATE_DIR");
    expect(config).toContain("ZHUSHOU_CONFIG_PATH");
    expect(config).toContain("models.providers");
    expect(config).toContain("agents.defaults.model");
    expect(config).toContain("openai-completions");
    expect(config).toContain("anthropic-messages");
    expect(config).toContain("google-generative-ai");
    expect(config).toContain("ollama");
  });

  it("ships a quickstart smoke script wired to package scripts", () => {
    const pkg = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(existsSync(join(repoRoot, "scripts/quickstart-smoke.mjs"))).toBe(true);
    expect(pkg.scripts?.["quickstart:smoke"]).toBe("node scripts/quickstart-smoke.mjs");
  });
});
