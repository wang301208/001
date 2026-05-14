import { describe, expect, it } from "vitest";
import { coerceIdentityValue } from "./zhushou-identity-values.js";

describe("shared/zhushou-identity-values", () => {
  it("returns undefined for missing or blank values", () => {
    expect(coerceIdentityValue(undefined, 10)).toBeUndefined();
    expect(coerceIdentityValue("   ", 10)).toBeUndefined();
    expect(coerceIdentityValue(42 as unknown as string, 10)).toBeUndefined();
  });

  it("trims values and preserves strings within the limit", () => {
    expect(coerceIdentityValue("  助手  ", 20)).toBe("助手");
    expect(coerceIdentityValue("  助手  ", 8)).toBe("助手");
  });

  it("truncates overlong trimmed values at the exact limit", () => {
    expect(coerceIdentityValue("  助手 Zhushou  ", 8)).toBe("助手 Assis");
  });

  it("returns an empty string when truncating to a zero-length limit", () => {
    expect(coerceIdentityValue("  助手  ", 0)).toBe("");
    expect(coerceIdentityValue("  助手  ", -1)).toBe("");
  });
});
