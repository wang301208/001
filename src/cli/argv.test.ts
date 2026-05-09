import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isRootHelpInvocation,
  isRootVersionInvocation,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "assistant", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "assistant", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "assistant", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "assistant", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "assistant", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "assistant", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "assistant", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "assistant", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "assistant", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "assistant", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "assistant", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "assistant", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "assistant", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "assistant", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "assistant", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "assistant", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "assistant", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "assistant", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "assistant", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "assistant", "nodes", "invoke", "--", "device.status", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "assistant", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "assistant", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "assistant", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "assistant", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "assistant", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "assistant",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "assistant", "config", "get", "--log-level", "debug", "update.channel", "--json"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "assistant", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "assistant", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "assistant", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "assistant"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "assistant", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "assistant", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "assistant", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "assistant", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "assistant", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "assistant", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "assistant", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "assistant", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "assistant", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "assistant", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "assistant", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "assistant", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "assistant", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "assistant", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "assistant", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it.each([
    {
      name: "keeps plain node argv",
      rawArgs: ["node", "assistant", "status"],
      expected: ["node", "assistant", "status"],
    },
    {
      name: "keeps version-suffixed node binary",
      rawArgs: ["node-22", "assistant", "status"],
      expected: ["node-22", "assistant", "status"],
    },
    {
      name: "keeps windows versioned node exe",
      rawArgs: ["node-22.2.0.exe", "assistant", "status"],
      expected: ["node-22.2.0.exe", "assistant", "status"],
    },
    {
      name: "keeps dotted node binary",
      rawArgs: ["node-22.2", "assistant", "status"],
      expected: ["node-22.2", "assistant", "status"],
    },
    {
      name: "keeps dotted node exe",
      rawArgs: ["node-22.2.exe", "assistant", "status"],
      expected: ["node-22.2.exe", "assistant", "status"],
    },
    {
      name: "keeps absolute versioned node path",
      rawArgs: ["/usr/bin/node-22.2.0", "assistant", "status"],
      expected: ["/usr/bin/node-22.2.0", "assistant", "status"],
    },
    {
      name: "keeps node24 shorthand",
      rawArgs: ["node24", "assistant", "status"],
      expected: ["node24", "assistant", "status"],
    },
    {
      name: "keeps absolute node24 shorthand",
      rawArgs: ["/usr/bin/node24", "assistant", "status"],
      expected: ["/usr/bin/node24", "assistant", "status"],
    },
    {
      name: "keeps windows node24 exe",
      rawArgs: ["node24.exe", "assistant", "status"],
      expected: ["node24.exe", "assistant", "status"],
    },
    {
      name: "keeps nodejs binary",
      rawArgs: ["nodejs", "assistant", "status"],
      expected: ["nodejs", "assistant", "status"],
    },
    {
      name: "prefixes fallback when first arg is not a node launcher",
      rawArgs: ["node-dev", "assistant", "status"],
      expected: ["node", "assistant", "node-dev", "assistant", "status"],
    },
    {
      name: "prefixes fallback when raw args start at program name",
      rawArgs: ["assistant", "status"],
      expected: ["node", "assistant", "status"],
    },
    {
      name: "keeps bun execution argv",
      rawArgs: ["bun", "src/entry.ts", "status"],
      expected: ["bun", "src/entry.ts", "status"],
    },
  ] as const)("builds parse argv from raw args: $name", ({ rawArgs, expected }) => {
    const parsed = buildParseArgv({
      programName: "assistant",
      rawArgs: [...rawArgs],
    });
    expect(parsed).toEqual([...expected]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "assistant",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "assistant", "status"]);
  });

  it.each([
    { argv: ["node", "assistant", "status"], expected: false },
    { argv: ["node", "assistant", "health"], expected: false },
    { argv: ["node", "assistant", "sessions"], expected: false },
    { argv: ["node", "assistant", "config", "get", "update"], expected: false },
    { argv: ["node", "assistant", "config", "unset", "update"], expected: false },
    { argv: ["node", "assistant", "models", "list"], expected: false },
    { argv: ["node", "assistant", "models", "status"], expected: false },
    { argv: ["node", "assistant", "update", "status", "--json"], expected: false },
    { argv: ["node", "assistant", "agent", "--message", "hi"], expected: false },
    { argv: ["node", "assistant", "agents", "list"], expected: true },
    { argv: ["node", "assistant", "message", "send"], expected: true },
  ] as const)("decides when to migrate state: $argv", ({ argv, expected }) => {
    expect(shouldMigrateState([...argv])).toBe(expected);
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
