import { normalizeOptionalString } from "./string-coerce.js";

export function coerceIdentityValue(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  if (maxLength <= 0) {
    return "";
  }
  const chars = Array.from(trimmed);
  if (chars.length <= maxLength) {
    return trimmed;
  }
  return chars.slice(0, maxLength).join("");
}
