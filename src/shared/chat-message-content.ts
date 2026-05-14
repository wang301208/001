import { readStringValue } from "./string-coerce.js";

export function extractFirstTextBlock(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const content = (message as { content?: unknown }).content;
  const inline = readStringValue(content);
  if (inline !== undefined) {
    return inline;
  }
  if (!Array.isArray(content) || content.length === 0) {
    return undefined;
  }
  const first = content[0];
  if (!first || typeof first !== "object") {
    return undefined;
  }
  return readStringValue((first as { text?: unknown }).text);
}

export type ZhushouPhase = "commentary" | "final_answer";

export function normalizeZhushouPhase(value: unknown): ZhushouPhase | undefined {
  return value === "commentary" || value === "final_answer" ? value : undefined;
}

export function parseZhushouTextSignature(
  value: unknown,
): { id?: string; phase?: ZhushouPhase } | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  if (!value.startsWith("{")) {
    return { id: value };
  }
  try {
    const parsed = JSON.parse(value) as { id?: unknown; phase?: unknown; v?: unknown };
    if (parsed.v !== 1) {
      return null;
    }
    return {
      ...(typeof parsed.id === "string" ? { id: parsed.id } : {}),
      ...(normalizeZhushouPhase(parsed.phase)
        ? { phase: normalizeZhushouPhase(parsed.phase) }
        : {}),
    };
  } catch {
    return null;
  }
}

export function encodeZhushouTextSignature(params: {
  id: string;
  phase?: ZhushouPhase;
}): string {
  return JSON.stringify({
    v: 1,
    id: params.id,
    ...(params.phase ? { phase: params.phase } : {}),
  });
}

export function resolveZhushouMessagePhase(message: unknown): ZhushouPhase | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const entry = message as { phase?: unknown; content?: unknown };
  const directPhase = normalizeZhushouPhase(entry.phase);
  if (directPhase) {
    return directPhase;
  }
  if (!Array.isArray(entry.content)) {
    return undefined;
  }
  const explicitPhases = new Set<ZhushouPhase>();
  for (const block of entry.content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as { type?: unknown; textSignature?: unknown };
    if (record.type !== "text") {
      continue;
    }
    const phase = parseZhushouTextSignature(record.textSignature)?.phase;
    if (phase) {
      explicitPhases.add(phase);
    }
  }
  return explicitPhases.size === 1 ? [...explicitPhases][0] : undefined;
}

export function extractZhushouTextForPhase(
  message: unknown,
  options?: {
    phase?: ZhushouPhase;
    sanitizeText?: (text: string) => string;
    joinWith?: string;
  },
): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const entry = message as { text?: unknown; content?: unknown; phase?: unknown };
  const messagePhase = normalizeZhushouPhase(entry.phase);
  const phase = options?.phase;
  const shouldIncludeContent = (resolvedPhase?: ZhushouPhase) => {
    if (phase) {
      return resolvedPhase === phase;
    }
    return resolvedPhase === undefined;
  };
  const sanitizeText = options?.sanitizeText;
  const joinWith = options?.joinWith ?? "\n";
  const sanitizeBlockText = (text: string) => (sanitizeText ? sanitizeText(text) : text);
  const normalizeJoinedText = (text: string) => {
    const normalized = text.trim();
    return normalized || undefined;
  };

  if (typeof entry.text === "string") {
    if (!shouldIncludeContent(messagePhase)) {
      return undefined;
    }
    return normalizeJoinedText(sanitizeBlockText(entry.text));
  }

  if (typeof entry.content === "string") {
    if (!shouldIncludeContent(messagePhase)) {
      return undefined;
    }
    return normalizeJoinedText(sanitizeBlockText(entry.content));
  }

  if (!Array.isArray(entry.content)) {
    return undefined;
  }

  const hasExplicitPhasedTextBlocks = entry.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    const record = block as { type?: unknown; textSignature?: unknown };
    if (record.type !== "text") {
      return false;
    }
    return Boolean(parseZhushouTextSignature(record.textSignature)?.phase);
  });

  // Once explicit phased blocks exist, unphased extraction should not revive
  // legacy text from the same message.
  if (!phase && hasExplicitPhasedTextBlocks) {
    return undefined;
  }

  const parts = entry.content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return null;
      }
      const record = block as { type?: unknown; text?: unknown; textSignature?: unknown };
      if (record.type !== "text" || typeof record.text !== "string") {
        return null;
      }
      const signature = parseZhushouTextSignature(record.textSignature);
      const resolvedPhase =
        signature?.phase ?? (hasExplicitPhasedTextBlocks ? undefined : messagePhase);
      if (!shouldIncludeContent(resolvedPhase)) {
        return null;
      }
      const sanitized = sanitizeBlockText(record.text);
      return sanitized.trim() ? sanitized : null;
    })
    .filter((value): value is string => typeof value === "string");

  if (parts.length === 0) {
    return undefined;
  }
  return normalizeJoinedText(parts.join(joinWith));
}

export function extractZhushouVisibleText(message: unknown): string | undefined {
  const finalAnswerText = extractZhushouTextForPhase(message, { phase: "final_answer" });
  if (finalAnswerText) {
    return finalAnswerText;
  }
  return extractZhushouTextForPhase(message);
}
