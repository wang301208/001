import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["zhushou/plugin-sdk/llm-task"]).toBe(
      aliasMap["@zhushou/plugin-sdk/llm-task"],
    );
    expect(aliasMap["zhushou/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@zhushou/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["zhushou/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@zhushou/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["zhushou/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@zhushou/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["zhushou/plugin-sdk/speech-core"]).toBe(
      aliasMap["@zhushou/plugin-sdk/speech-core"],
    );
  });
});
