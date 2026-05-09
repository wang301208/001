import { describe, expect, it } from "vitest";
import {
  ensureAssistantExecMarkerOnProcess,
  markAssistantExecEnv,
  ASSISTANT_CLI_ENV_VALUE,
  ASSISTANT_CLI_ENV_VAR,
} from "./assistant-exec-env.js";

describe("markAssistantExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", ASSISTANT_CLI: "0" };
    const marked = markAssistantExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      ASSISTANT_CLI: ASSISTANT_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.ASSISTANT_CLI).toBe("0");
  });
});

describe("ensureAssistantExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [ASSISTANT_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureAssistantExecMarkerOnProcess(env)).toBe(env);
    expect(env[ASSISTANT_CLI_ENV_VAR]).toBe(ASSISTANT_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[ASSISTANT_CLI_ENV_VAR];
    delete process.env[ASSISTANT_CLI_ENV_VAR];

    try {
      expect(ensureAssistantExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[ASSISTANT_CLI_ENV_VAR]).toBe(ASSISTANT_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[ASSISTANT_CLI_ENV_VAR];
      } else {
        process.env[ASSISTANT_CLI_ENV_VAR] = previous;
      }
    }
  });
});
