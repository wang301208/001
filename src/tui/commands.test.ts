import { describe, expect, it } from "vitest";
import { getSlashCommands, helpText, parseCommand } from "./commands.js";

describe("parseCommand", () => {
  it("normalizes aliases and keeps command args", () => {
    expect(parseCommand("/elev full")).toEqual({ name: "elevated", args: "full" });
  });

  it("normalizes gateway-status aliases", () => {
    expect(parseCommand("/gwstatus")).toEqual({ name: "gateway-status", args: "" });
  });

  it("normalizes experience and self-model aliases", () => {
    expect(parseCommand("/remember deploy lesson")).toEqual({
      name: "experience-capture",
      args: "deploy lesson",
    });
    expect(parseCommand("/recall deploy")).toEqual({
      name: "experience-search",
      args: "deploy",
    });
    expect(parseCommand("/skills-candidates")).toEqual({
      name: "skill-candidates",
      args: "",
    });
  });

  it("normalizes steer and redirect aliases", () => {
    expect(parseCommand("/steer change course")).toEqual({
      name: "steer",
      args: "change course",
    });
    expect(parseCommand("/redirect change course")).toEqual({
      name: "steer",
      args: "change course",
    });
  });

  it("returns empty name for empty input", () => {
    expect(parseCommand("   ")).toEqual({ name: "", args: "" });
  });
});

describe("getSlashCommands", () => {
  it("provides level completions for built-in toggles", () => {
    const commands = getSlashCommands();
    const verbose = commands.find((command) => command.name === "verbose");
    const activation = commands.find((command) => command.name === "activation");
    expect(verbose?.getArgumentCompletions?.("o")).toEqual([
      { value: "on", label: "on" },
      { value: "off", label: "off" },
    ]);
    expect(activation?.getArgumentCompletions?.("a")).toEqual([
      { value: "always", label: "always" },
    ]);
  });

  it("keeps session status on the shared command path and exposes gateway status separately", () => {
    const commands = getSlashCommands();
    const status = commands.find((command) => command.name === "status");
    const gatewayStatus = commands.find((command) => command.name === "gateway-status");
    expect(status?.description).toBe("Show current status.");
    expect(gatewayStatus?.description).toBe("Show gateway status summary");
  });

  it("exposes experience, skill candidate, and self-model commands", () => {
    const names = getSlashCommands().map((command) => command.name);
    expect(names).toContain("experience-capture");
    expect(names).toContain("experience-search");
    expect(names).toContain("experience-summary");
    expect(names).toContain("skill-candidates");
    expect(names).toContain("skill-candidate-create");
    expect(names).toContain("self-model");
    expect(names).toContain("self-model-update");
  });

  it("exposes run steering commands for terminal redirection", () => {
    const names = getSlashCommands().map((command) => command.name);
    expect(names).toContain("steer");
    expect(names).toContain("redirect");
  });
});

describe("helpText", () => {
  it("includes slash command help for aliases", () => {
    const output = helpText();
    expect(output).toContain("/elevated <on|off|ask|full>");
    expect(output).toContain("/elev <on|off|ask|full>");
    expect(output).toContain("/gateway-status");
    expect(output).toContain("/gwstatus");
    expect(output).toContain("/experience-search");
    expect(output).toContain("/self-model");
    expect(output).toContain("/steer");
  });
});
