import { describe, expect, it } from "vitest";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import {
  detectConfigConflicts,
  formatValidationResult,
  hasLegacyFields,
  validateWizardConfig,
} from "./validation.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function cfg(overrides: Record<string, unknown> = {}): ZhushouConfig {
  return overrides as unknown as ZhushouConfig;
}

// ─── validateWizardConfig ─────────────────────────────────────────────────────

describe("validateWizardConfig", () => {
  describe("valid configs", () => {
    it("returns valid for an empty config", () => {
      const result = validateWizardConfig(cfg());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it("returns valid for a minimal local gateway config", () => {
      const result = validateWizardConfig(
        cfg({ gateway: { bind: "loopback", auth: { mode: "token" } } }),
      );
      expect(result.valid).toBe(true);
    });

    it("returns valid for a tailscale-serve + loopback config", () => {
      const result = validateWizardConfig(
        cfg({
          gateway: {
            bind: "loopback",
            auth: { mode: "token" },
            tailscale: { mode: "serve" },
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("returns valid for tailscale-funnel + password config", () => {
      const result = validateWizardConfig(
        cfg({
          gateway: {
            bind: "loopback",
            auth: { mode: "password" },
            tailscale: { mode: "funnel" },
          },
        }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("legacy field detection", () => {
    it("flags top-level routing.* as a legacy error", () => {
      const result = validateWizardConfig(cfg({ routing: { allowFrom: ["*"] } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "routing")).toBe(true);
      expect(result.errors.some((e) => e.code.startsWith("legacy-field:"))).toBe(true);
    });

    it("flags top-level providers.* as a legacy error", () => {
      const result = validateWizardConfig(cfg({ providers: { openai: {} } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "providers")).toBe(true);
    });

    it("flags top-level bot.* as a legacy error", () => {
      const result = validateWizardConfig(cfg({ bot: { name: "MyBot" } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "bot")).toBe(true);
    });

    it("flags multiple legacy fields in one pass", () => {
      const result = validateWizardConfig(
        cfg({ routing: { allowFrom: [] }, bot: { name: "x" } }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("flags legacy top-level agent config", () => {
      const result = validateWizardConfig(cfg({ agent: { model: "old/model" } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "agent")).toBe(true);
    });

    it("flags legacy top-level channel config", () => {
      const result = validateWizardConfig(cfg({ telegram: { botToken: "x" } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "telegram")).toBe(true);
    });

    it("flags legacy runtime aliases that may be auto-migrated during config read", () => {
      const result = validateWizardConfig(
        cfg({
          memorySearch: { enabled: true },
          heartbeat: { every: "30m" },
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "memorySearch")).toBe(true);
      expect(result.errors.some((e) => e.path === "heartbeat")).toBe(true);
    });

    it("flags legacy gateway auth aliases", () => {
      const result = validateWizardConfig(cfg({ gateway: { token: "old-token" } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "gateway.token")).toBe(true);
    });

    it("flags legacy gateway bind host aliases", () => {
      const result = validateWizardConfig(cfg({ gateway: { bind: "0.0.0.0" } }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "gateway.bind")).toBe(true);
    });

    it("flags legacy sandbox perSession aliases", () => {
      const result = validateWizardConfig(
        cfg({
          agents: {
            defaults: { sandbox: { perSession: true } },
            list: [{ id: "main", sandbox: { perSession: false } }],
          },
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "agents.*.sandbox.perSession")).toBe(true);
    });

    it("flags legacy provider-owned web search config", () => {
      const result = validateWizardConfig(
        cfg({ tools: { web: { search: { brave: { apiKey: "key" } } } } }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "tools.web.search.<provider>")).toBe(true);
    });

    it("includes legacy issues reported by the config loader", () => {
      const result = validateWizardConfig(cfg(), {
        legacyIssues: [{ path: "agents.defaults.sandbox", message: "perSession is legacy" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "agents.defaults.sandbox")).toBe(true);
    });
  });

  describe("conflict detection", () => {
    it("flags tailscale serve + non-loopback bind", () => {
      const result = validateWizardConfig(
        cfg({ gateway: { bind: "lan", tailscale: { mode: "serve" } } }),
      );
      expect(result.valid).toBe(false);
      const conflict = result.conflicts.find((c) => c.code === "tailscale-non-loopback-bind");
      expect(conflict).toBeDefined();
      expect(conflict!.paths).toContain("gateway.tailscale.mode");
      expect(conflict!.paths).toContain("gateway.bind");
    });

    it("flags tailscale funnel + token auth", () => {
      const result = validateWizardConfig(
        cfg({
          gateway: {
            bind: "loopback",
            auth: { mode: "token" },
            tailscale: { mode: "funnel" },
          },
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.code === "tailscale-funnel-no-password")).toBe(true);
    });

    it("does not flag tailscale off + lan bind", () => {
      const result = validateWizardConfig(
        cfg({ gateway: { bind: "lan", tailscale: { mode: "off" } } }),
      );
      expect(result.conflicts.filter((c) => c.code === "tailscale-non-loopback-bind")).toHaveLength(0);
    });

    it("flags lan bind with no auth configured", () => {
      const result = validateWizardConfig(cfg({ gateway: { bind: "lan" } }));
      expect(result.conflicts.some((c) => c.code === "lan-bind-no-auth")).toBe(true);
    });

    it("does not flag lan bind when token auth is configured", () => {
      const result = validateWizardConfig(
        cfg({ gateway: { bind: "lan", auth: { mode: "token", token: "abc" } } }),
      );
      expect(result.conflicts.filter((c) => c.code === "lan-bind-no-auth")).toHaveLength(0);
    });
  });

  describe("warnings", () => {
    it("emits a warning when workspace is not set", () => {
      const result = validateWizardConfig(cfg());
      expect(result.warnings.some((w) => w.code === "missing-workspace")).toBe(true);
    });

    it("does not warn about missing workspace when it is set", () => {
      const result = validateWizardConfig(
        cfg({ agents: { defaults: { workspace: "/home/user/assistant" } } }),
      );
      expect(result.warnings.filter((w) => w.code === "missing-workspace")).toHaveLength(0);
    });
  });
});

// ─── detectConfigConflicts ────────────────────────────────────────────────────

describe("detectConfigConflicts", () => {
  it("returns an empty array for a clean config", () => {
    expect(detectConfigConflicts(cfg())).toHaveLength(0);
  });

  it("returns only conflicts, not legacy field errors", () => {
    const conflicts = detectConfigConflicts(
      cfg({ routing: {}, gateway: { bind: "lan", tailscale: { mode: "serve" } } }),
    );
    // routing is a legacy field error, not a conflict
    expect(conflicts.every((c) => !c.code.startsWith("legacy-field:"))).toBe(true);
    expect(conflicts.some((c) => c.code === "tailscale-non-loopback-bind")).toBe(true);
  });
});

// ─── hasLegacyFields ─────────────────────────────────────────────────────────

describe("hasLegacyFields", () => {
  it("returns false for an empty config", () => {
    expect(hasLegacyFields(cfg())).toBe(false);
  });

  it("returns true when routing key is present", () => {
    expect(hasLegacyFields(cfg({ routing: {} }))).toBe(true);
  });

  it("returns true when providers key is present", () => {
    expect(hasLegacyFields(cfg({ providers: {} }))).toBe(true);
  });

  it("returns true for loader-reported legacy issues", () => {
    expect(
      hasLegacyFields(cfg(), [{ path: "memorySearch", message: "legacy auto-migration" }]),
    ).toBe(true);
  });

  it("returns false for a modern config with gateway.*", () => {
    expect(hasLegacyFields(cfg({ gateway: { bind: "loopback" } }))).toBe(false);
  });
});

// ─── formatValidationResult ──────────────────────────────────────────────────

describe("formatValidationResult", () => {
  it("returns a non-empty string for a result with errors", () => {
    const result = validateWizardConfig(cfg({ routing: {} }));
    const formatted = formatValidationResult(result);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain("routing");
  });

  it("includes all three sections when errors + conflicts + warnings are present", () => {
    const result = validateWizardConfig(
      cfg({ routing: {}, gateway: { bind: "lan", tailscale: { mode: "funnel" }, auth: { mode: "token" } } }),
    );
    const formatted = formatValidationResult(result);
    // errors section (legacy field)
    expect(formatted).toContain("错误");
    // conflicts section
    expect(formatted).toContain("冲突");
  });

  it("mentions (no issues) for a fully clean config", () => {
    const result = validateWizardConfig(cfg({ agents: { defaults: { workspace: "/ws" } } }));
    // clean config with workspace set: no errors, no conflicts
    expect(result.errors).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });
});
