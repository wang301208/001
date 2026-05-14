import { describe, expect, it } from "vitest";
import {
  isZhushouOwnerOnlyCoreToolName,
  ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createZhushouTools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(ZHUSHOU_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isZhushouOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isZhushouOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isZhushouOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isZhushouOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
