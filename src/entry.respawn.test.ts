import { describe, expect, it } from "vitest";
import {
  buildCliRespawnPlan,
  EXPERIMENTAL_WARNING_FLAG,
  hasExperimentalWarningSuppressed,
} from "./entry.respawn.js";

describe("buildCliRespawnPlan", () => {
  it("does not create a CLI respawn plan", () => {
    expect(
      buildCliRespawnPlan({
        argv: ["node", "assistant", "gateway", "run"],
        env: {},
        execArgv: [],
        autoNodeExtraCaCerts: "/etc/ssl/certs/ca-certificates.crt",
      }),
    ).toBeNull();
  });

  it("does not create a plan even when startup guards are missing", () => {
    expect(
      buildCliRespawnPlan({
        argv: ["node", "assistant", "status"],
        env: {
          NODE_EXTRA_CA_CERTS: "",
        },
        execArgv: [],
        autoNodeExtraCaCerts: "/etc/ssl/certs/ca-certificates.crt",
      }),
    ).toBeNull();
  });
});

describe("hasExperimentalWarningSuppressed", () => {
  it("detects warning suppression from NODE_OPTIONS", () => {
    expect(
      hasExperimentalWarningSuppressed({
        env: { NODE_OPTIONS: EXPERIMENTAL_WARNING_FLAG },
        execArgv: [],
      }),
    ).toBe(true);
  });

  it("detects warning suppression from execArgv", () => {
    expect(
      hasExperimentalWarningSuppressed({
        env: {},
        execArgv: ["--no-warnings"],
      }),
    ).toBe(true);
  });
});
