import fs from "node:fs/promises";

type SessionHeaderEntry = { type: "session"; id?: string; cwd?: string };
type SessionMessageEntry = { type: "message"; message?: { role?: string } };

/**
 * pi-coding-agent SessionManager persistence quirk:
 * - If the file exists but has no zhushou message, SessionManager marks itself `flushed=true`
 *   and will never persist the initial user message.
 * - If the file doesn't exist yet, SessionManager builds a new session in memory and flushes
 *   header+user+zhushou once the first zhushou arrives (good).
 *
 * This normalizes the file/session state so the first user prompt is persisted before the first
 * zhushou entry, even for pre-created session files.
 */
export async function prepareSessionManagerForRun(params: {
  sessionManager: unknown;
  sessionFile: string;
  hadSessionFile: boolean;
  sessionId: string;
  cwd: string;
}): Promise<void> {
  const sm = params.sessionManager as {
    sessionId: string;
    flushed: boolean;
    fileEntries: Array<SessionHeaderEntry | SessionMessageEntry | { type: string }>;
    byId?: Map<string, unknown>;
    labelsById?: Map<string, unknown>;
    leafId?: string | null;
  };

  const header = sm.fileEntries.find((e): e is SessionHeaderEntry => e.type === "session");
  const hasZhushou = sm.fileEntries.some(
    (e) => e.type === "message" && (e as SessionMessageEntry).message?.role === "assistant",
  );

  if (!params.hadSessionFile && header) {
    header.id = params.sessionId;
    header.cwd = params.cwd;
    sm.sessionId = params.sessionId;
    return;
  }

  if (params.hadSessionFile && header && !hasZhushou) {
    // Reset file so the first zhushou flush includes header+user+zhushou in order.
    await fs.writeFile(params.sessionFile, "", "utf-8");
    sm.fileEntries = [header];
    sm.byId?.clear?.();
    sm.labelsById?.clear?.();
    sm.leafId = null;
    sm.flushed = false;
  }
}
