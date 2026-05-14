import { extractZhushouTextForPhase } from "../../shared/chat-message-content.js";
import { sanitizeZhushouVisibleTextWithProfile } from "../../shared/text/zhushou-visible-text.js";
import { sanitizeUserFacingText } from "../pi-embedded-helpers/sanitize-user-facing-text.js";

export function stripToolMessages(messages: unknown[]): unknown[] {
  return messages.filter((msg) => {
    if (!msg || typeof msg !== "object") {
      return true;
    }
    const role = (msg as { role?: unknown }).role;
    return role !== "toolResult" && role !== "tool";
  });
}

/**
 * Sanitize text content to strip tool call markers and thinking tags.
 * This ensures user-facing text doesn't leak internal tool representations.
 */
export function sanitizeTextContent(text: string): string {
  return sanitizeZhushouVisibleTextWithProfile(text, "history");
}

export function hasZhushouPhaseMetadata(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  if ((message as { role?: unknown }).role !== "assistant") {
    return false;
  }
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (block) =>
      block &&
      typeof block === "object" &&
      typeof (block as { textSignature?: unknown }).textSignature === "string",
  );
}
export function extractZhushouText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  if ((message as { role?: unknown }).role !== "assistant") {
    return undefined;
  }
  const joined =
    extractZhushouTextForPhase(message, {
      phase: "final_answer",
      sanitizeText: sanitizeTextContent,
      joinWith: "",
    }) ??
    extractZhushouTextForPhase(message, {
      sanitizeText: sanitizeTextContent,
      joinWith: "",
    });
  const stopReason = (message as { stopReason?: unknown }).stopReason;
  // Gate on stopReason only — a non-error response with a stale/background errorMessage
  // should not have its content rewritten with error templates (#13935).
  const errorContext = stopReason === "error";

  return joined ? sanitizeUserFacingText(joined, { errorContext }) : undefined;
}
