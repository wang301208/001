import { describe, expect, it } from "vitest";
import { loadHostEnvSecurityPolicy } from "./host-env-security-policy.js";
import hostEnvSecurityPolicy from "./host-env-security-policy.json" with { type: "json" };

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values)).toSorted((a, b) => a.localeCompare(b));
}

describe("host env security policy parity", () => {
  it("loads the shared JSON host env policy used by terminal runtimes", () => {
    const policy = loadHostEnvSecurityPolicy(hostEnvSecurityPolicy);

    expect(policy.blockedInheritedKeys.length).toBeGreaterThan(0);
    expect(policy.blockedOverrideKeys?.length ?? 0).toBeGreaterThan(0);
    expect(policy.blockedPrefixes.length).toBeGreaterThan(0);
  });

  it("derives inherited and override lists from explicit policy buckets", () => {
    const rawPolicy = hostEnvSecurityPolicy as Record<string, string[]>;
    const policy = loadHostEnvSecurityPolicy(rawPolicy);
    const allowedInheritedOverrideOnlyKeys = new Set(
      (rawPolicy.allowedInheritedOverrideOnlyKeys ?? []).map((value: string) =>
        value.toUpperCase(),
      ),
    );

    expect(policy.blockedKeys).toEqual(sortUnique([...policy.blockedEverywhereKeys]));
    expect(policy.blockedOverrideKeys).toEqual(sortUnique([...policy.blockedOverrideOnlyKeys]));
    expect(policy.blockedInheritedKeys).toEqual(
      sortUnique([
        ...policy.blockedEverywhereKeys,
        ...policy.blockedOverrideOnlyKeys.filter(
          (value) => !allowedInheritedOverrideOnlyKeys.has(value.toUpperCase()),
        ),
      ]),
    );
    expect(policy.blockedInheritedPrefixes).toEqual(
      sortUnique(rawPolicy.blockedInheritedPrefixes ?? rawPolicy.blockedPrefixes ?? []),
    );
  });
});
