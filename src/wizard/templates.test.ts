import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  applyTemplate,
  findTemplate,
  templateSelectOptions,
  WIZARD_TEMPLATES,
} from "./templates.js";

function emptyConfig(): OpenClawConfig {
  return {} as OpenClawConfig;
}

// ─── WIZARD_TEMPLATES ─────────────────────────────────────────────────────────

describe("WIZARD_TEMPLATES", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(WIZARD_TEMPLATES)).toBe(true);
    expect(WIZARD_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("every template has id, name, description, and config", () => {
    for (const t of WIZARD_TEMPLATES) {
      expect(typeof t.id).toBe("string");
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.config).toBeDefined();
      expect(typeof t.config).toBe("object");
    }
  });

  it("template IDs are unique", () => {
    const ids = WIZARD_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes a minimal template", () => {
    expect(WIZARD_TEMPLATES.some((t) => t.id === "minimal")).toBe(true);
  });

  it("includes a tailscale-serve template", () => {
    expect(WIZARD_TEMPLATES.some((t) => t.id === "tailscale-serve")).toBe(true);
  });

  it("includes a tailscale-funnel template", () => {
    expect(WIZARD_TEMPLATES.some((t) => t.id === "tailscale-funnel")).toBe(true);
  });

  it("tailscale-funnel template enforces password auth", () => {
    const funnel = WIZARD_TEMPLATES.find((t) => t.id === "tailscale-funnel");
    expect(funnel?.config.gateway?.auth?.mode).toBe("password");
  });

  it("tailscale templates enforce loopback bind", () => {
    for (const t of WIZARD_TEMPLATES.filter((t) => t.id.startsWith("tailscale"))) {
      expect(t.config.gateway?.bind).toBe("loopback");
    }
  });
});

// ─── findTemplate ─────────────────────────────────────────────────────────────

describe("findTemplate", () => {
  it("finds a template by ID", () => {
    const t = findTemplate("minimal");
    expect(t).toBeDefined();
    expect(t?.id).toBe("minimal");
  });

  it("returns undefined for an unknown ID", () => {
    expect(findTemplate("does-not-exist")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(findTemplate("")).toBeUndefined();
  });
});

// ─── applyTemplate ────────────────────────────────────────────────────────────

describe("applyTemplate", () => {
  it("applies template config on top of an empty base", () => {
    const template = findTemplate("minimal")!;
    const result = applyTemplate(emptyConfig(), template);
    expect(result.ui?.assistant?.name).toBe("助手");
    expect(result.gateway?.mode).toBe("local");
    expect(result.gateway?.bind).toBe("loopback");
    expect(result.gateway?.auth?.mode).toBe("token");
    expect(result.gateway?.tailscale?.mode).toBe("off");
  });

  it("preserves base config fields not touched by template", () => {
    const base: OpenClawConfig = {
      agents: { defaults: { workspace: "/my/workspace" } },
    } as OpenClawConfig;
    const template = findTemplate("minimal")!;
    const result = applyTemplate(base, template);
    expect(result.agents?.defaults?.workspace).toBe("/my/workspace");
    expect(result.gateway?.bind).toBe("loopback");
  });

  it("template values override base values for the same path", () => {
    const base: OpenClawConfig = {
      gateway: { bind: "lan", auth: { mode: "password" } },
    } as OpenClawConfig;
    const template = findTemplate("minimal")!;
    const result = applyTemplate(base, template);
    expect(result.gateway?.bind).toBe("loopback");
    expect(result.gateway?.auth?.mode).toBe("token");
  });

  it("deep-merges nested objects rather than replacing them", () => {
    const base: OpenClawConfig = {
      gateway: { port: 9000, bind: "lan" },
    } as OpenClawConfig;
    const template = findTemplate("minimal")!;
    const result = applyTemplate(base, template);
    // port from base should be preserved because template doesn't set port
    expect(result.gateway?.port).toBe(9000);
    // bind overridden by template
    expect(result.gateway?.bind).toBe("loopback");
  });

  it("does not mutate the original base config", () => {
    const base: OpenClawConfig = {
      gateway: { bind: "lan" },
    } as OpenClawConfig;
    const template = findTemplate("minimal")!;
    applyTemplate(base, template);
    expect((base as unknown as Record<string, unknown>).gateway).toEqual({ bind: "lan" });
  });

  it("applies lan template correctly", () => {
    const template = findTemplate("lan")!;
    const result = applyTemplate(emptyConfig(), template);
    expect(result.gateway?.bind).toBe("lan");
  });

  it("applies remote-gateway template correctly", () => {
    const template = findTemplate("remote-gateway")!;
    const result = applyTemplate(emptyConfig(), template);
    expect(result.gateway?.mode).toBe("remote");
  });

  it("applies tailscale-serve template correctly", () => {
    const template = findTemplate("tailscale-serve")!;
    const result = applyTemplate(emptyConfig(), template);
    expect(result.gateway?.tailscale?.mode).toBe("serve");
    expect(result.gateway?.bind).toBe("loopback");
  });
});

// ─── templateSelectOptions ────────────────────────────────────────────────────

describe("templateSelectOptions", () => {
  it("returns one option per template plus a skip option", () => {
    const opts = templateSelectOptions();
    expect(opts.length).toBe(WIZARD_TEMPLATES.length + 1);
  });

  it("includes a skip option with value __skip__", () => {
    const opts = templateSelectOptions();
    expect(opts.some((o) => o.value === "__skip__")).toBe(true);
  });

  it("every non-skip option maps to an existing template ID", () => {
    const opts = templateSelectOptions().filter((o) => o.value !== "__skip__");
    for (const opt of opts) {
      expect(findTemplate(opt.value)).toBeDefined();
    }
  });

  it("all options have non-empty label and hint", () => {
    for (const opt of templateSelectOptions()) {
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
      expect(typeof opt.hint).toBe("string");
      expect(opt.hint.length).toBeGreaterThan(0);
    }
  });
});
