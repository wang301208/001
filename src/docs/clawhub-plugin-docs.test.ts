import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateExternalCodePluginPackageJson } from "../../packages/plugin-package-contract/src/index.js";
import { readExistingUtf8Files, readOptionalUtf8 } from "./test-doc-helpers.js";

const DOCS_ROOT = path.join(process.cwd(), "docs");
const pluginDocs = [
  path.join(DOCS_ROOT, "tools", "clawhub.md"),
  path.join(DOCS_ROOT, "plugins", "building-plugins.md"),
  path.join(DOCS_ROOT, "plugins", "sdk-setup.md"),
  path.join(DOCS_ROOT, "plugins", "sdk-provider-plugins.md"),
];

function extractNamedJsonBlock(markdown: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(
      `^[ \\t]*\\\`\\\`\\\`json ${escapedLabel}\\n([\\s\\S]*?)\\n[ \\t]*\\\`\\\`\\\``,
      "m",
    ),
  );
  if (!match?.[1]) {
    throw new Error(`Missing json code block for ${label}`);
  }
  return JSON.parse(match[1].trim()) as unknown;
}

describe("ClawHub plugin docs", () => {
  it("keeps the canonical plugin-publish snippets contract-valid", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(
        path.join(DOCS_ROOT, "snippets", "plugin-publish", "minimal-package.json"),
        "utf8",
      ),
    ) as unknown;
    const pluginManifest = JSON.parse(
      await fs.readFile(
        path.join(DOCS_ROOT, "snippets", "plugin-publish", "minimal-zhushou.plugin.json"),
        "utf8",
      ),
    ) as { id?: unknown; configSchema?: unknown };

    expect(validateExternalCodePluginPackageJson(packageJson).issues).toEqual([]);
    expect(typeof pluginManifest.id).toBe("string");
    expect(pluginManifest.configSchema).toBeTruthy();
  });

  it("does not tell plugin authors to use bare clawhub publish", async () => {
    for (const { markdown } of await readExistingUtf8Files(pluginDocs)) {
      expect(markdown).not.toMatch(/(^|[\s`])clawhub publish\b/);
    }
  });

  it("keeps the canonical package snippet embedded in the primary plugin docs", async () => {
    const snippet = JSON.parse(
      await fs.readFile(
        path.join(DOCS_ROOT, "snippets", "plugin-publish", "minimal-package.json"),
        "utf8",
      ),
    ) as unknown;
    const buildingPlugins = await readOptionalUtf8(
      path.join(DOCS_ROOT, "plugins", "building-plugins.md"),
    );
    const sdkSetup = await readOptionalUtf8(path.join(DOCS_ROOT, "plugins", "sdk-setup.md"));

    if (buildingPlugins) {
      expect(extractNamedJsonBlock(buildingPlugins, "package.json")).toEqual(snippet);
    }
    if (sdkSetup) {
      expect(extractNamedJsonBlock(sdkSetup, "zhushou-clawhub-package.json")).toEqual(snippet);
    }
  });
});
