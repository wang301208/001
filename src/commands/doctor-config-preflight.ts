import { readConfigFileSnapshot } from "../config/io.js";
import { formatConfigIssueLines } from "../config/issue-format.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { note } from "../terminal/note.js";
import { noteIncludeConfinementWarning } from "./doctor-config-analysis.js";

export type DoctorConfigPreflightResult = {
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>;
  baseConfig: ZhushouConfig;
};

export async function runDoctorConfigPreflight(
  options: {
    migrateState?: boolean;
    migrateLegacyConfig?: boolean;
    invalidConfigNote?: string | false;
  } = {},
): Promise<DoctorConfigPreflightResult> {
  void options.migrateState;
  void options.migrateLegacyConfig;

  const snapshot = await readConfigFileSnapshot();
  const invalidConfigNote =
    options.invalidConfigNote ?? "Config invalid; doctor will run with best-effort config.";
  if (
    invalidConfigNote &&
    snapshot.exists &&
    !snapshot.valid &&
    snapshot.legacyIssues.length === 0
  ) {
    note(invalidConfigNote, "Config");
    noteIncludeConfinementWarning(snapshot);
  }

  const warnings = snapshot.warnings ?? [];
  if (warnings.length > 0) {
    note(formatConfigIssueLines(warnings, "-").join("\n"), "Config warnings");
  }

  return {
    snapshot,
    baseConfig: snapshot.sourceConfig ?? snapshot.config ?? {},
  };
}
