import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "zhushou",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "zhushou", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "zhushou",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "zhushou",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "zhushou", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "zhushou", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "zhushou", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "zhushou", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "zhushou", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "zhushou", "status", "--deep"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "zhushou", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "zhushou", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "zhushou", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "zhushou", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "zhushou", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "zhushou", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".zhushou-dev");
    expect(env.ZHUSHOU_PROFILE).toBe("dev");
    expect(env.ZHUSHOU_STATE_DIR).toBe(expectedStateDir);
    expect(env.ZHUSHOU_CONFIG_PATH).toBe(path.join(expectedStateDir, "zhushou.json"));
    expect(env.ZHUSHOU_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      ZHUSHOU_STATE_DIR: "/custom",
      ZHUSHOU_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.ZHUSHOU_STATE_DIR).toBe("/custom");
    expect(env.ZHUSHOU_GATEWAY_PORT).toBe("19099");
    expect(env.ZHUSHOU_CONFIG_PATH).toBe(path.join("/custom", "zhushou.json"));
  });

  it("uses ZHUSHOU_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      ZHUSHOU_HOME: "/srv/zhushou-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/zhushou-home");
    expect(env.ZHUSHOU_STATE_DIR).toBe(path.join(resolvedHome, ".zhushou-work"));
    expect(env.ZHUSHOU_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".zhushou-work", "zhushou.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "zhushou doctor --fix",
      env: {},
      expected: "zhushou doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "zhushou doctor --fix",
      env: { ZHUSHOU_PROFILE: "default" },
      expected: "zhushou doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "zhushou doctor --fix",
      env: { ZHUSHOU_PROFILE: "Default" },
      expected: "zhushou doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "zhushou doctor --fix",
      env: { ZHUSHOU_PROFILE: "bad profile" },
      expected: "zhushou doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "zhushou --profile work doctor --fix",
      env: { ZHUSHOU_PROFILE: "work" },
      expected: "zhushou --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "zhushou --dev doctor",
      env: { ZHUSHOU_PROFILE: "dev" },
      expected: "zhushou --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("zhushou doctor --fix", { ZHUSHOU_PROFILE: "work" })).toBe(
      "zhushou --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("zhushou doctor --fix", { ZHUSHOU_PROFILE: "  jbopenclaw  " })).toBe(
      "zhushou --profile jbopenclaw doctor --fix",
    );
  });

  it("handles command with no args after zhushou", () => {
    expect(formatCliCommand("zhushou", { ZHUSHOU_PROFILE: "test" })).toBe(
      "zhushou --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm zhushou doctor", { ZHUSHOU_PROFILE: "work" })).toBe(
      "pnpm zhushou --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("openclaw gateway status --deep", { OPENCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("zhushou --container demo gateway status --deep");
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("openclaw gateway status --deep", {
        OPENCLAW_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("openclaw gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("zhushou doctor", {
        OPENCLAW_CONTAINER_HINT: "demo",
        ZHUSHOU_PROFILE: "work",
      }),
    ).toBe("zhushou --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("zhushou update", { OPENCLAW_CONTAINER_HINT: "demo" })).toBe(
      "zhushou update",
    );
    expect(
      formatCliCommand("pnpm zhushou update --channel beta", { OPENCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm zhushou update --channel beta");
  });
});
