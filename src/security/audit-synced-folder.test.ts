import { describe, expect, it } from "vitest";
import { collectSyncedFolderFindings } from "./audit-extra.sync.js";

describe("security audit synced folder findings", () => {
  it("warns when state/config look like a synced folder", () => {
    const findings = collectSyncedFolderFindings({
      stateDir: "/Users/test/Dropbox/.zhushou",
      configPath: "/Users/test/Dropbox/.zhushou/zhushou.json",
    });

    expect(
      findings.some(
        (finding) => finding.checkId === "fs.synced_dir" && finding.severity === "warn",
      ),
    ).toBe(true);
  });
});
