import { describe, expect, it } from "vitest";
import {
  isAssistantOwnerOnlyCoreToolName,
  ASSISTANT_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createAssistantTools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(ASSISTANT_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isAssistantOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isAssistantOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isAssistantOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isAssistantOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
