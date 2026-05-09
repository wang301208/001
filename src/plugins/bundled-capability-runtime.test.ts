import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["assistant/plugin-sdk/llm-task"]).toBe(
      aliasMap["@assistant/plugin-sdk/llm-task"],
    );
    expect(aliasMap["assistant/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@assistant/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["assistant/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@assistant/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["assistant/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@assistant/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["assistant/plugin-sdk/speech-core"]).toBe(
      aliasMap["@assistant/plugin-sdk/speech-core"],
    );
  });
});
