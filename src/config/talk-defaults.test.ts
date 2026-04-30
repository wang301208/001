import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildConfigDocBaseline,
  flattenConfigDocBaselineEntries,
  normalizeConfigDocBaselineHelpPath,
} from "./doc-baseline.js";
import { FIELD_HELP } from "./schema.help.js";
import {
  describeTalkSilenceTimeoutDefaults,
  TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM,
} from "./talk-defaults.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("talk silence timeout defaults", () => {
  it("keeps help text and docs aligned with the policy", async () => {
    const defaultsDescription = describeTalkSilenceTimeoutDefaults();
    const baseline = await buildConfigDocBaseline();
    const talkEntry = flattenConfigDocBaselineEntries(baseline).find(
      (entry) => entry.path === normalizeConfigDocBaselineHelpPath("talk.silenceTimeoutMs"),
    );

    expect(FIELD_HELP["talk.silenceTimeoutMs"]).toContain(defaultsDescription);
    expect(talkEntry?.help).toContain(defaultsDescription);
    const docPaths = ["docs/gateway/configuration-reference.md", "docs/nodes/talk.md"];
    for (const docPath of docPaths) {
      const absolutePath = path.join(repoRoot, docPath);
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      expect(readRepoFile(docPath)).toContain(defaultsDescription);
    }
  });

  it("keeps terminal runtime defaults available for supported platforms", () => {
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.macos).toBeGreaterThan(0);
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.ios).toBeGreaterThan(0);
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.android).toBeGreaterThan(0);
  });
});
