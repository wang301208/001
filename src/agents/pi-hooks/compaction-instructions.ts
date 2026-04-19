/**
 * Compaction instruction utilities.
 *
 * Provides default language-preservation instructions and a precedence-based
 * resolver for customInstructions used during context compaction summaries.
 */

/**
 * Default instructions injected into every safeguard-mode compaction summary.
 * Preserves conversation language and persona while keeping the SDK's required
 * summary structure intact.
 */
export const DEFAULT_COMPACTION_INSTRUCTIONS =
  "Write the summary body in the primary language used in the conversation.\n" +
  "Focus on continuation-critical facts only.\n" +
  "Preserve the user's current goal, important decisions, completed work, current task status, current subtask when known, recent meaningful outcome, the most important immediately actionable next step, constraints or preferences, pending tasks, important verification results, and any important files, commands, config changes, or outputs.\n" +
  "Preserve blockers, waiting reasons, failed attempts, and invalidated paths when they matter for continuation or avoiding loops.\n" +
  "Remove filler, repeated status chatter, and low-value tool noise.\n" +
  "Keep the required summary structure and section headers unchanged.\n" +
  "Do not translate or alter code, file paths, identifiers, commands, or error messages.";

/**
 * Upper bound on custom instruction length to prevent prompt bloat.
 * ~800 chars ≈ ~200 tokens — keeps summarization quality stable.
 */
const MAX_INSTRUCTION_LENGTH = 800;

function truncateUnicodeSafe(s: string, maxCodePoints: number): string {
  const chars = Array.from(s);
  if (chars.length <= maxCodePoints) {
    return s;
  }
  return chars.slice(0, maxCodePoints).join("");
}

function normalize(s: string | undefined): string | undefined {
  if (s == null) {
    return undefined;
  }
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve compaction instructions with precedence:
 *   event (SDK) → runtime (config) → DEFAULT constant.
 *
 * Each input is normalized first (trim + empty→undefined) so that blank
 * strings don't short-circuit the fallback chain.
 */
export function resolveCompactionInstructions(
  eventInstructions: string | undefined,
  runtimeInstructions: string | undefined,
  continuityHint?: string,
): string {
  const resolved =
    normalize(eventInstructions) ??
    normalize(runtimeInstructions) ??
    DEFAULT_COMPACTION_INSTRUCTIONS;
  const hint = normalize(continuityHint);
  const combined = hint ? `${resolved}\n${hint}` : resolved;
  return truncateUnicodeSafe(combined, MAX_INSTRUCTION_LENGTH);
}

/**
 * Compose split-turn instructions by combining the SDK's turn-prefix
 * instructions with the resolved compaction instructions.
 */
export function composeSplitTurnInstructions(
  turnPrefixInstructions: string,
  resolvedInstructions: string,
): string {
  return [turnPrefixInstructions, "Additional requirements:", resolvedInstructions].join("\n\n");
}
