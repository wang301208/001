import { describe, expect, it } from "vitest";
import {
  ensureZhushouExecMarkerOnProcess,
  markZhushouExecEnv,
  ZHUSHOU_CLI_ENV_VALUE,
  ZHUSHOU_CLI_ENV_VAR,
} from "./zhushou-exec-env.js";

describe("markZhushouExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", ZHUSHOU_CLI: "0" };
    const marked = markZhushouExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      ZHUSHOU_CLI: ZHUSHOU_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.ZHUSHOU_CLI).toBe("0");
  });
});

describe("ensureZhushouExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [ZHUSHOU_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureZhushouExecMarkerOnProcess(env)).toBe(env);
    expect(env[ZHUSHOU_CLI_ENV_VAR]).toBe(ZHUSHOU_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[ZHUSHOU_CLI_ENV_VAR];
    delete process.env[ZHUSHOU_CLI_ENV_VAR];

    try {
      expect(ensureZhushouExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[ZHUSHOU_CLI_ENV_VAR]).toBe(ZHUSHOU_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[ZHUSHOU_CLI_ENV_VAR];
      } else {
        process.env[ZHUSHOU_CLI_ENV_VAR] = previous;
      }
    }
  });
});
