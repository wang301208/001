import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";

const CROSS_ORIGIN_REDIRECT_SAFE_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "cache-control",
  "content-language",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-unmodified-since",
  "pragma",
  "range",
  "user-agent",
]);

export function retainSafeHeadersForCrossOriginRedirect(
  headers?: HeadersInit | Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }
  const safeHeaders: Record<string, string> = {};
  const incoming =
    headers instanceof Headers
      ? headers.entries()
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers);
  for (const [key, value] of incoming) {
    const normalizedKey = normalizeLowercaseStringOrEmpty(key);
    const normalizedValue = normalizeHeaderValueForRedirect(value);
    if (
      CROSS_ORIGIN_REDIRECT_SAFE_HEADERS.has(normalizedKey) &&
      normalizedKey &&
      normalizedValue !== undefined
    ) {
      safeHeaders[normalizedKey] = normalizedValue;
    }
  }
  return safeHeaders;
}

function normalizeHeaderValueForRedirect(value: unknown): string | undefined {
  const normalized = String(value);
  return /^[\t\x20-\x7e\x80-\xff]*$/u.test(normalized) ? normalized : undefined;
}
