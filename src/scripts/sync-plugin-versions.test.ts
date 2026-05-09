import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncPluginVersions } from "../../scripts/sync-plugin-versions.js";
import { cleanupTempDirs, makeTempDir } from "../../test/helpers/temp-dir.js";

const tempDirs: string[] = [];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("syncPluginVersions", () => {
  afterEach(() => {
    cleanupTempDirs(tempDirs);
  });

  it("preserves workspace assistant devDependencies and plugin host floors", () => {
    const rootDir = makeTempDir(tempDirs, "assistant-sync-plugin-versions-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "assistant",
      version: "2026.4.1",
    });
    writeJson(path.join(rootDir, "extensions/bluebubbles/package.json"), {
      name: "@assistant/bluebubbles",
      version: "2026.3.30",
      devDependencies: {
        assistant: "workspace:*",
      },
      peerDependencies: {
        assistant: ">=2026.3.30",
      },
      assistant: {
        install: {
          minHostVersion: ">=2026.3.30",
        },
        compat: {
          pluginApi: ">=2026.3.30",
        },
        build: {
          assistantVersion: "2026.3.30",
        },
      },
    });

    const summary = syncPluginVersions(rootDir);
    const updatedPackage = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/bluebubbles/package.json"), "utf8"),
    ) as {
      version?: string;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      assistant?: {
        install?: {
          minHostVersion?: string;
        };
        compat?: {
          pluginApi?: string;
        };
        build?: {
          assistantVersion?: string;
        };
      };
    };

    expect(summary.updated).toContain("@assistant/bluebubbles");
    expect(updatedPackage.version).toBe("2026.4.1");
    expect(updatedPackage.devDependencies?.assistant).toBe("workspace:*");
    expect(updatedPackage.peerDependencies?.assistant).toBe(">=2026.4.1");
    expect(updatedPackage.assistant?.install?.minHostVersion).toBe(">=2026.3.30");
    expect(updatedPackage.assistant?.compat?.pluginApi).toBe(">=2026.4.1");
    expect(updatedPackage.assistant?.build?.assistantVersion).toBe("2026.4.1");
  });
});
